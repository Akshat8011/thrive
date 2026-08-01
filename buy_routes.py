"""
============================================================
BUY ANALYZER — Product link inspection for Should I Buy This
Extracts title, price, rating, image, and review signals.
============================================================
"""

import json
import re
from html import unescape
from urllib.parse import urlparse

import requests
from flask import Blueprint, jsonify, request

buy_bp = Blueprint('buy', __name__)

UA = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
)
TIMEOUT = 12


def _meta(html, *keys):
    for key in keys:
        patterns = [
            rf'<meta[^>]+(?:property|name)=["\']{re.escape(key)}["\'][^>]+content=["\']([^"\']+)["\']',
            rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+(?:property|name)=["\']{re.escape(key)}["\']',
        ]
        for pat in patterns:
            m = re.search(pat, html, re.I)
            if m:
                return unescape(m.group(1).strip())
    return ''


def _parse_price(text):
    if not text:
        return None
    cleaned = text.replace(',', '').replace('\u20b9', '₹').replace('Rs.', '₹').replace('INR', '₹')
    # Prefer explicit currency markers
    for pat in [
        r'₹\s*([\d]+(?:\.\d+)?)',
        r'(?:Rs\.?|INR)\s*([\d]+(?:\.\d+)?)',
        r'\$\s*([\d]+(?:\.\d+)?)',
        r'([\d]+(?:\.\d+)?)\s*(?:₹|Rs\.?|INR)',
    ]:
        m = re.search(pat, cleaned, re.I)
        if m:
            try:
                return float(m.group(1))
            except ValueError:
                pass
    # Fallback: first large-looking number
    m = re.search(r'([\d]{2,}(?:\.\d+)?)', cleaned.replace(',', ''))
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            return None
    return None


def _parse_rating(html):
    candidates = [
        _meta(html, 'og:rating', 'product:rating', 'twitter:data1'),
        '',
    ]
    for pat in [
        r'"ratingValue"\s*:\s*"?([\d.]+)"?',
        r'"aggregateRating"[^}]*"ratingValue"\s*:\s*"?([\d.]+)"?',
        r'([\d.]+)\s*out of\s*5',
        r'([\d.]+)\s*/\s*5',
        r'aria-label=["\']([\d.]+)\s*out of\s*5',
    ]:
        m = re.search(pat, html, re.I)
        if m:
            try:
                val = float(m.group(1))
                if 0 < val <= 5:
                    return val
            except ValueError:
                pass
    for c in candidates:
        if c:
            p = _parse_price(c)  # reuse numeric parse loosely
            if p and 0 < p <= 5:
                return p
    return None


def _parse_review_count(html):
    for pat in [
        r'"reviewCount"\s*:\s*"?([\d,]+)"?',
        r'([\d,]+)\s+ratings?',
        r'([\d,]+)\s+reviews?',
        r'([\d,]+)\s+customer reviews?',
    ]:
        m = re.search(pat, html, re.I)
        if m:
            try:
                return int(m.group(1).replace(',', ''))
            except ValueError:
                pass
    return None


def _extract_json_ld(html):
    blocks = re.findall(
        r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>',
        html, re.I | re.S
    )
    products = []
    for block in blocks:
        try:
            data = json.loads(block.strip())
        except Exception:
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if not isinstance(item, dict):
                continue
            types = item.get('@type', '')
            type_list = types if isinstance(types, list) else [types]
            if any(t and 'Product' in str(t) for t in type_list):
                products.append(item)
            # nested graph
            if '@graph' in item and isinstance(item['@graph'], list):
                for g in item['@graph']:
                    if isinstance(g, dict):
                        gt = g.get('@type', '')
                        gt_list = gt if isinstance(gt, list) else [gt]
                        if any(t and 'Product' in str(t) for t in gt_list):
                            products.append(g)
    return products


def _from_json_ld(products):
    if not products:
        return {}
    p = products[0]
    out = {
        'title': p.get('name') or '',
        'description': p.get('description') or '',
        'image': '',
        'price': None,
        'currency': 'INR',
        'rating': None,
        'review_count': None,
        'brand': '',
        'availability': '',
    }
    img = p.get('image')
    if isinstance(img, list) and img:
        out['image'] = img[0] if isinstance(img[0], str) else img[0].get('url', '')
    elif isinstance(img, str):
        out['image'] = img
    elif isinstance(img, dict):
        out['image'] = img.get('url', '')

    offers = p.get('offers')
    if isinstance(offers, list) and offers:
        offers = offers[0]
    if isinstance(offers, dict):
        price = offers.get('price') or offers.get('lowPrice')
        if price is not None:
            try:
                out['price'] = float(str(price).replace(',', ''))
            except ValueError:
                out['price'] = _parse_price(str(price))
        out['currency'] = offers.get('priceCurrency') or out['currency']
        out['availability'] = str(offers.get('availability', '')).split('/')[-1]

    agg = p.get('aggregateRating')
    if isinstance(agg, dict):
        try:
            if agg.get('ratingValue') is not None:
                out['rating'] = float(agg['ratingValue'])
            if agg.get('reviewCount') is not None:
                out['review_count'] = int(str(agg['reviewCount']).replace(',', ''))
            elif agg.get('ratingCount') is not None:
                out['review_count'] = int(str(agg['ratingCount']).replace(',', ''))
        except (ValueError, TypeError):
            pass

    brand = p.get('brand')
    if isinstance(brand, dict):
        out['brand'] = brand.get('name', '')
    elif isinstance(brand, str):
        out['brand'] = brand

    return out


def _sentiment_from_text(text):
    """Lightweight keyword sentiment on page text for review vibe."""
    if not text:
        return {'score': 50, 'positive_hits': 0, 'negative_hits': 0, 'summary': 'No review text found on page.'}
    lower = text.lower()
    positive = [
        'excellent', 'amazing', 'great', 'love', 'perfect', 'recommend', 'worth',
        'superb', 'outstanding', 'fantastic', 'durable', 'value for money', 'best',
        'awesome', 'satisfied', 'happy', 'good quality', 'must buy'
    ]
    negative = [
        'waste', 'poor', 'bad', 'terrible', 'awful', 'defect', 'broken', 'scam',
        'fake', 'disappointed', 'not worth', 'return', 'refund', 'worst', 'cheap quality',
        'do not buy', "don't buy", 'useless', 'damaged', 'overpriced'
    ]
    pos = sum(lower.count(w) for w in positive)
    neg = sum(lower.count(w) for w in negative)
    total = pos + neg
    if total == 0:
        return {'score': 55, 'positive_hits': 0, 'negative_hits': 0, 'summary': 'Mixed or sparse review signals on the page.'}
    score = round(100 * pos / total)
    if score >= 70:
        summary = 'Page language leans positive — reviewers seem mostly happy.'
    elif score >= 45:
        summary = 'Mixed signals — praise and complaints both show up.'
    else:
        summary = 'Page language leans negative — proceed carefully.'
    return {'score': score, 'positive_hits': pos, 'negative_hits': neg, 'summary': summary}


def analyze_product_url(url):
    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https') or not parsed.netloc:
        return {'ok': False, 'error': 'Invalid URL. Use a full http(s) product link.'}

    headers = {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-IN,en;q=0.9',
    }
    try:
        resp = requests.get(url, headers=headers, timeout=TIMEOUT, allow_redirects=True)
        resp.raise_for_status()
        html = resp.text[:900000]
    except requests.Timeout:
        return {'ok': False, 'error': 'Timed out fetching the product page.'}
    except Exception as e:
        return {'ok': False, 'error': f'Could not fetch product page: {str(e)[:120]}'}

    ld = _from_json_ld(_extract_json_ld(html))

    title = (
        ld.get('title')
        or _meta(html, 'og:title', 'twitter:title')
        or (re.search(r'<title[^>]*>(.*?)</title>', html, re.I | re.S) or [None, ''])[1]
    )
    title = unescape(re.sub(r'\s+', ' ', title or '')).strip()[:200]

    description = (
        ld.get('description')
        or _meta(html, 'og:description', 'twitter:description', 'description')
    )
    description = unescape(re.sub(r'\s+', ' ', description or '')).strip()[:500]

    image = ld.get('image') or _meta(html, 'og:image', 'twitter:image')
    price = ld.get('price')
    if price is None:
        price_meta = _meta(html, 'product:price:amount', 'og:price:amount', 'twitter:data1')
        price = _parse_price(price_meta)
    if price is None:
        # Scan common price patterns in body
        for pat in [
            r'₹\s*([\d,]+(?:\.\d+)?)',
            r'"price"\s*:\s*"?([\d.]+)"?',
            r'data-price=["\']([\d.]+)',
            r'class=["\'][^"\']*price[^"\']*["\'][^>]*>\s*₹?\s*([\d,]+)',
        ]:
            m = re.search(pat, html, re.I)
            if m:
                price = _parse_price(m.group(0))
                if price:
                    break

    rating = ld.get('rating') or _parse_rating(html)
    review_count = ld.get('review_count') or _parse_review_count(html)
    brand = ld.get('brand') or _meta(html, 'product:brand', 'og:brand')
    availability = ld.get('availability') or ''
    currency = ld.get('currency') or _meta(html, 'product:price:currency', 'og:price:currency') or 'INR'

    # Lightweight text extract for sentiment (avoid heavy trafilatura when possible)
    text_bits = ' '.join(filter(None, [title, description]))
    # Pull a slice of visible-ish text
    stripped = re.sub(r'<script[\s\S]*?</script>', ' ', html, flags=re.I)
    stripped = re.sub(r'<style[\s\S]*?</style>', ' ', stripped, flags=re.I)
    stripped = re.sub(r'<[^>]+>', ' ', stripped)
    stripped = re.sub(r'\s+', ' ', stripped)
    text_bits += ' ' + stripped[:8000]
    sentiment = _sentiment_from_text(text_bits)

    host = parsed.netloc.replace('www.', '')
    return {
        'ok': True,
        'url': resp.url if hasattr(resp, 'url') else url,
        'host': host,
        'title': title or 'Unknown product',
        'description': description,
        'image': image or '',
        'price': price,
        'currency': currency,
        'rating': rating,
        'review_count': review_count,
        'brand': brand or '',
        'availability': availability,
        'sentiment': sentiment,
        'note': (
            'Price/rating extracted from page metadata when available. '
            'You can override the price manually before analysis.'
        ),
    }


@buy_bp.route('/api/buy/analyze', methods=['POST'])
def api_analyze():
    data = request.get_json(silent=True) or {}
    url = (data.get('url') or '').strip()
    if not url:
        return jsonify({'ok': False, 'error': 'Product URL is required.'}), 400
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    result = analyze_product_url(url)
    status = 200 if result.get('ok') else 422
    return jsonify(result), status
