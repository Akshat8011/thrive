"""
============================================================
BUY ANALYZER — Reliable product link inspection
Multi-source fetch so Amazon/Flipkart/etc. work consistently.
============================================================
"""

import json
import re
from html import unescape
from urllib.parse import unquote, urlparse

import requests
from flask import Blueprint, jsonify, request

buy_bp = Blueprint('buy', __name__)

UA_DESKTOP = (
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
)
UA_MOBILE = (
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 '
    '(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
)
TIMEOUT_DIRECT = 10
TIMEOUT_PROXY = 28


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
    if text is None:
        return None
    if isinstance(text, (int, float)):
        return float(text)
    cleaned = str(text).replace(',', '').replace('\u20b9', '₹').replace('Rs.', '₹').replace('INR', '₹')
    for pat in [
        r'₹\s*([\d]+(?:\.\d+)?)',
        r'(?:Rs\.?|INR)\s*([\d]+(?:\.\d+)?)',
        r'\$\s*([\d]+(?:\.\d+)?)',
        r'([\d]+(?:\.\d+)?)\s*(?:₹|Rs\.?|INR)',
    ]:
        m = re.search(pat, cleaned, re.I)
        if m:
            try:
                val = float(m.group(1))
                if 1 <= val <= 10000000:
                    return val
            except ValueError:
                pass
    m = re.search(r'([\d]{2,}(?:\.\d+)?)', cleaned.replace(',', ''))
    if m:
        try:
            val = float(m.group(1))
            if 1 <= val <= 10000000:
                return val
        except ValueError:
            return None
    return None


def _best_price_from_text(text):
    """Pick the most plausible product price from messy page text."""
    if not text:
        return None

    # Highest-confidence structured amounts (Amazon buybox JSON etc.)
    for pat in [
        r'"priceAmount"\s*:\s*([\d.]+)',
        r'"price"\s*:\s*"?(?:₹|Rs\.?\s*)?([\d,]+(?:\.\d+)?)"?',
        r'displayPrice"\s*:\s*"₹([\d,]+(?:\.\d+)?)"',
    ]:
        m = re.search(pat, text, re.I)
        if m:
            try:
                val = float(m.group(1).replace(',', ''))
                if 50 <= val <= 10000000:
                    return val
            except ValueError:
                pass

    # Prefer selling/deal price — never prefer bare M.R.P. first
    labeled = []
    for pat in [
        r'(?:Deal Price|Selling Price|Current Price|Price)\s*[:\-]?\s*₹\s*([\d,]+(?:\.\d+)?)',
        r'₹\s*([\d,]+(?:\.\d+)?)\s*with\s+\d+\s+percent\s+savings',
        r'₹\s*([\d,]+(?:\.\d+)?)\s*(?:inclusive of all taxes)',
    ]:
        for m in re.finditer(pat, text, re.I):
            try:
                val = float(m.group(1).replace(',', ''))
                if 50 <= val <= 10000000:
                    labeled.append(val)
            except ValueError:
                pass
    if labeled:
        freq = {}
        for p in labeled:
            freq[p] = freq.get(p, 0) + 1
        return sorted(labeled, key=lambda p: (-freq[p], p))[0]

    # Strip EMI-heavy sections before generic scan
    trimmed = re.sub(r'EMI[\s\S]{0,8000}', ' ', text, flags=re.I)
    prices = []
    for m in re.finditer(r'₹\s*([\d,]+(?:\.\d+)?)', trimmed):
        try:
            val = float(m.group(1).replace(',', ''))
            if 100 <= val <= 10000000:
                prices.append(val)
        except ValueError:
            pass
    if not prices:
        return None
    freq = {}
    for p in prices:
        freq[p] = freq.get(p, 0) + 1
    top_freq = max(freq.values())
    top = sorted([p for p in freq if freq[p] == top_freq])
    return top[0]


def _parse_rating(html):
    for pat in [
        r'"ratingValue"\s*:\s*"?([\d.]+)"?',
        r'"aggregateRating"[^}]*"ratingValue"\s*:\s*"?([\d.]+)"?',
        r'([\d.]+)\s*out of\s*5',
        r'([\d.]+)\s*/\s*5',
        r'aria-label=["\']([\d.]+)\s*out of\s*5',
        r'Rating:\s*([\d.]+)',
    ]:
        m = re.search(pat, html, re.I)
        if m:
            try:
                val = float(m.group(1))
                if 0 < val <= 5:
                    return val
            except ValueError:
                pass
    return None


def _parse_review_count(html):
    for pat in [
        r'"reviewCount"\s*:\s*"?([\d,]+)"?',
        r'"ratingCount"\s*:\s*"?([\d,]+)"?',
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
        out['image'] = img[0] if isinstance(img[0], str) else (img[0].get('url', '') if isinstance(img[0], dict) else '')
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
    if not text:
        return {
            'score': 50, 'positive_hits': 0, 'negative_hits': 0,
            'summary': 'No review text found on page.'
        }
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
        return {
            'score': 55, 'positive_hits': 0, 'negative_hits': 0,
            'summary': 'Mixed or sparse review signals on the page.'
        }
    score = round(100 * pos / total)
    if score >= 70:
        summary = 'Page language leans positive — reviewers seem mostly happy.'
    elif score >= 45:
        summary = 'Mixed signals — praise and complaints both show up.'
    else:
        summary = 'Page language leans negative — proceed carefully.'
    return {'score': score, 'positive_hits': pos, 'negative_hits': neg, 'summary': summary}


def _title_from_url(url):
    """Best-effort product name from URL path (Amazon/Flipkart style)."""
    try:
        path = unquote(urlparse(url).path)
    except Exception:
        return ''
    # Amazon: /Product-Name-Here/dp/ASIN
    m = re.search(r'/([^/]{5,})/dp/[A-Z0-9]{8,}', path, re.I)
    if m:
        return m.group(1).replace('-', ' ').strip().title()[:160]
    # Flipkart: /product-name/p/itm...
    m = re.search(r'/([^/]{5,})/p/[a-z0-9]+', path, re.I)
    if m:
        return m.group(1).replace('-', ' ').strip().title()[:160]
    # Generic last meaningful slug
    parts = [p for p in path.split('/') if p and p.lower() not in ('dp', 'gp', 'product', 'p', 'in', 'en')]
    if parts:
        cand = parts[-1]
        if not re.fullmatch(r'[A-Z0-9]{8,}', cand) and len(cand) > 4:
            return cand.replace('-', ' ').replace('_', ' ').strip().title()[:160]
    return ''


def _amazon_asin(url):
    m = re.search(r'/(?:dp|gp/product|gp/aw/d)/([A-Z0-9]{10})', url, re.I)
    return m.group(1).upper() if m else None


def _is_junk_title(title):
    if not title:
        return True
    t = title.strip().lower()
    junk = [
        'amazon.in', 'amazon.com', 'page not found', '503', 'access denied',
        'robot check', 'captcha', 'site maintenance', 'just a moment',
        'flipkart', 'error', 'unavailable', 'blocked', 'amazon',
        'buy products online at best price in india - all categories',
        'online shopping site for mobiles, electronics, furniture, grocery',
        'online shopping india', 'flipkart.com',
    ]
    if t in junk:
        return True
    if len(t) < 3:
        return True
    if 'service unavailable' in t or "we're sorry" in t:
        return True
    if t.startswith('buy products online'):
        return True
    if 'all categories' in t and 'price' in t:
        return True
    return False


def _clean_title(title):
    if not title:
        return ''
    title = unescape(re.sub(r'\s+', ' ', str(title))).strip()
    # Strip common store suffixes
    title = re.sub(r'\s*[:|\-–]\s*Amazon\.in.*$', '', title, flags=re.I)
    title = re.sub(r'\s*Online at Best Price On Flipkart\.com.*$', '', title, flags=re.I)
    title = re.sub(r'\s*\|\s*Flipkart.*$', '', title, flags=re.I)
    return title.strip()[:200]


def _fetch_direct(url):
    headers_list = [
        {
            'User-Agent': UA_DESKTOP,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-IN,en;q=0.9',
            'Cache-Control': 'no-cache',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
        },
        {
            'User-Agent': UA_MOBILE,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-IN,en;q=0.9',
        },
    ]
    last_err = None
    for headers in headers_list:
        try:
            resp = requests.get(
                url, headers=headers, timeout=TIMEOUT_DIRECT,
                allow_redirects=True
            )
            # Accept even non-200 if body has useful HTML
            if resp.text and len(resp.text) > 200:
                return {
                    'ok': True, 'source': 'direct', 'final_url': resp.url,
                    'html': resp.text[:900000], 'status': resp.status_code
                }
            last_err = f'HTTP {resp.status_code}'
        except Exception as e:
            last_err = str(e)[:120]
    return {'ok': False, 'source': 'direct', 'error': last_err or 'direct fetch failed'}


def _fetch_jina(url):
    """Jina reader often bypasses marketplace bot walls."""
    # Keep headers minimal — extra browser headers can trigger 403 from Jina.
    endpoints = [
        ('https://r.jina.ai/' + url, {'Accept': 'text/plain'}),
        ('https://r.jina.ai/' + url, {}),
    ]
    # Also try http rewrite if original is https
    if url.startswith('https://'):
        endpoints.append(
            ('https://r.jina.ai/http://' + url[len('https://'):], {'Accept': 'text/plain'})
        )

    for ep, headers in endpoints:
        try:
            resp = requests.get(ep, headers=headers, timeout=TIMEOUT_PROXY)
            text = resp.text or ''
            if resp.status_code >= 400 or len(text) < 40:
                continue
            low = text.lower()
            if 'title: 503' in low or ('service unavailable error' in low and 'amazon' in low and len(text) < 2000):
                continue
            title = ''
            m = re.search(r'^Title:\s*(.+)$', text, re.M)
            if m:
                title = m.group(1).strip()
            if _is_junk_title(title) and '₹' not in text and '$' not in text:
                continue
            image = ''
            img_m = re.search(r'!\[[^\]]*\]\((https?://[^)]+)\)', text)
            if img_m:
                image = img_m.group(1)
            return {
                'ok': True, 'source': 'jina', 'final_url': url,
                'text': text[:120000], 'title': title, 'image': image,
                'html': text[:120000],
            }
        except Exception:
            continue
    return {'ok': False, 'source': 'jina', 'error': 'jina unavailable'}


def _fetch_microlink(url):
    try:
        resp = requests.get(
            'https://api.microlink.io',
            params={'url': url},
            headers={'User-Agent': UA_DESKTOP},
            timeout=TIMEOUT_PROXY,
        )
        data = resp.json() if resp.content else {}
        if data.get('status') != 'success':
            return {'ok': False, 'source': 'microlink', 'error': data.get('message') or 'microlink fail'}
        d = data.get('data') or {}
        image = ''
        if isinstance(d.get('image'), dict):
            image = d['image'].get('url') or ''
        elif isinstance(d.get('image'), str):
            image = d['image']
        return {
            'ok': True, 'source': 'microlink', 'final_url': d.get('url') or url,
            'title': d.get('title') or '',
            'description': d.get('description') or '',
            'image': image,
            'publisher': d.get('publisher') or '',
            'html': '',  # meta only
        }
    except Exception as e:
        return {'ok': False, 'source': 'microlink', 'error': str(e)[:120]}


def _merge_product(url, chunks):
    """Merge multi-source fetch results into one product payload. Always ok."""
    parsed = urlparse(url)
    host = (parsed.netloc or '').replace('www.', '')
    url_title = _title_from_url(url)

    title = ''
    description = ''
    image = ''
    price = None
    rating = None
    review_count = None
    brand = ''
    availability = ''
    currency = 'INR'
    final_url = url
    sources_used = []
    combined_text = ''

    for ch in chunks:
        if not ch or not ch.get('ok'):
            continue
        sources_used.append(ch.get('source', '?'))
        if ch.get('final_url'):
            final_url = ch['final_url']

        html = ch.get('html') or ch.get('text') or ''
        combined_text += '\n' + html[:20000]

        # Structured json-ld when HTML present
        if html and '<script' in html.lower():
            ld = _from_json_ld(_extract_json_ld(html))
        else:
            ld = {}

        cand_title = _clean_title(
            ch.get('title')
            or ld.get('title')
            or _meta(html, 'og:title', 'twitter:title')
            or ((re.search(r'<title[^>]*>(.*?)</title>', html, re.I | re.S) or [None, ''])[1])
        )
        if cand_title and not _is_junk_title(cand_title) and (not title or len(cand_title) > len(title)):
            title = cand_title

        cand_desc = (
            ch.get('description')
            or ld.get('description')
            or _meta(html, 'og:description', 'twitter:description', 'description')
            or ''
        )
        cand_desc = unescape(re.sub(r'\s+', ' ', cand_desc)).strip()[:500]
        if cand_desc and len(cand_desc) > len(description):
            # skip boilerplate privacy blurbs
            if 'conditions of use' not in cand_desc.lower():
                description = cand_desc

        cand_img = ch.get('image') or ld.get('image') or _meta(html, 'og:image', 'twitter:image') or ''
        if cand_img and not image:
            image = cand_img

        if price is None:
            price = ld.get('price')
        if price is None:
            price = _parse_price(_meta(html, 'product:price:amount', 'og:price:amount', 'twitter:data1'))
        if price is None:
            price = _best_price_from_text(html)

        if rating is None:
            rating = ld.get('rating') or _parse_rating(html)
        if review_count is None:
            review_count = ld.get('review_count') or _parse_review_count(html)
        if not brand:
            brand = ld.get('brand') or _meta(html, 'product:brand', 'og:brand') or ch.get('publisher') or ''
        if not availability:
            availability = ld.get('availability') or ''
        if ld.get('currency'):
            currency = ld['currency']

    if _is_junk_title(title):
        title = url_title or f'Product on {host or "link"}'
    if not description:
        description = f'Product link from {host}. Details filled from best available source.'

    # Amazon ASIN annotate
    asin = _amazon_asin(final_url) or _amazon_asin(url)
    if asin and not brand:
        brand = 'Amazon listing'

    sentiment = _sentiment_from_text(combined_text[:12000] + ' ' + title + ' ' + description)

    note_parts = []
    if sources_used:
        note_parts.append('Sources: ' + ', '.join(dict.fromkeys(sources_used)))
    else:
        note_parts.append('Used URL heuristics (stores blocked the fetch).')
    if price is None:
        note_parts.append('Price not detected — enter it manually.')
    else:
        note_parts.append('You can override the price before analysis.')

    return {
        'ok': True,
        'url': final_url,
        'host': host,
        'title': title,
        'description': description,
        'image': image or '',
        'price': price,
        'currency': currency,
        'rating': rating,
        'review_count': review_count,
        'brand': brand or '',
        'availability': availability,
        'sentiment': sentiment,
        'asin': asin,
        'sources': list(dict.fromkeys(sources_used)) or ['url-heuristic'],
        'partial': price is None or not sources_used or sources_used == ['url-heuristic'],
        'note': ' '.join(note_parts),
    }


def _candidate_urls(url):
    """Variant URLs that sometimes unlock blocked Amazon short links."""
    out = [url]
    asin = _amazon_asin(url)
    host = urlparse(url).netloc or 'www.amazon.in'
    if asin and re.search(r'amazon\.', host, re.I):
        variants = [
            f'https://{host}/dp/{asin}',
            f'https://{host}/gp/product/{asin}',
            f'https://{host}/gp/aw/d/{asin}',
        ]
        for v in variants:
            if v not in out:
                out.append(v)
    return out


def analyze_product_url(url):
    parsed = urlparse(url)
    if parsed.scheme not in ('http', 'https') or not parsed.netloc:
        return {'ok': False, 'error': 'Invalid URL. Use a full http(s) product link.'}

    chunks = []
    tried = _candidate_urls(url)

    # 1) Jina first — best success rate on marketplaces
    for u in tried:
        jina = _fetch_jina(u)
        if jina.get('ok'):
            chunks.append(jina)
            break

    # 2) Direct HTML
    for u in tried[:2]:
        direct = _fetch_direct(u)
        if direct.get('ok'):
            chunks.append(direct)
            break

    # 3) Microlink meta
    micro = _fetch_microlink(url)
    if micro.get('ok'):
        chunks.append(micro)

    # 4) AllOrigins CORS proxy as last HTML attempt
    if not any(c.get('source') == 'jina' for c in chunks):
        try:
            proxy = 'https://api.allorigins.win/raw?url=' + requests.utils.quote(url, safe='')
            resp = requests.get(proxy, timeout=TIMEOUT_PROXY, headers={'User-Agent': UA_DESKTOP})
            if resp.ok and resp.text and len(resp.text) > 400:
                chunks.append({
                    'ok': True, 'source': 'allorigins', 'final_url': url,
                    'html': resp.text[:900000]
                })
        except Exception:
            pass

    # Always merge — never hard-fail for blocked stores
    return _merge_product(url, chunks)


@buy_bp.route('/api/buy/analyze', methods=['POST'])
def api_analyze():
    data = request.get_json(silent=True) or {}
    url = (data.get('url') or '').strip()
    if not url:
        return jsonify({'ok': False, 'error': 'Product URL is required.'}), 400
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    # Strip tracking junk that sometimes breaks fetches
    url = url.split()[0].strip('<>"\'')
    result = analyze_product_url(url)
    # Invalid URL still 400; everything else 200 so the UI never dies
    status = 400 if (not result.get('ok') and result.get('error', '').startswith('Invalid')) else 200
    if not result.get('ok') and status == 200:
        # belt-and-suspenders soft success
        result = _merge_product(url, [])
    return jsonify(result), status


@buy_bp.route('/api/buy/analyze', methods=['GET'])
def api_analyze_get():
    """Convenience GET for debugging: /api/buy/analyze?url=..."""
    url = (request.args.get('url') or '').strip()
    if not url:
        return jsonify({'ok': False, 'error': 'Product URL is required.'}), 400
    if not url.startswith(('http://', 'https://')):
        url = 'https://' + url
    return jsonify(analyze_product_url(url)), 200
