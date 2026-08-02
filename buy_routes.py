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


def _parse_count(raw):
    """Parse 1,234 / 2,46,421 / 9.4K style counts."""
    if raw is None:
        return None
    s = str(raw).strip().replace(',', '')
    m = re.match(r'^([\d.]+)\s*([kmb])?$', s, re.I)
    if not m:
        digits = re.sub(r'[^\d]', '', s)
        return int(digits) if digits else None
    try:
        val = float(m.group(1))
    except ValueError:
        return None
    suf = (m.group(2) or '').lower()
    if suf == 'k':
        val *= 1000
    elif suf == 'm':
        val *= 1000000
    elif suf == 'b':
        val *= 1000000000
    return int(round(val))


def _strip_related_noise(text):
    """Remove sponsored/related carousels that leak other products' ratings."""
    if not text:
        return ''
    cut_markers = [
        r'Products related to this item',
        r'Customers who viewed this item also viewed',
        r'Customers who bought this item also bought',
        r'Compare with similar items',
        r'Sponsored products related to this item',
        r'4 stars and above',
        r'Inspired by your browsing history',
        r'What other items do customers buy after viewing',
    ]
    cleaned = text
    for marker in cut_markers:
        cleaned = re.sub(marker + r'[\s\S]{0,12000}?(?=## |\Z)', ' ', cleaned, flags=re.I)
    # Drop markdown links that point at a different product-reviews ASIN block's star text is handled later
    return cleaned


def _extract_rating_bundle(text, asin=None):
    """
    Extract THIS listing's rating + review/rating count with confidence.
    Avoids first-match traps from related/sponsored products.
    """
    if not text:
        return {'rating': None, 'review_count': None, 'confidence': 0, 'source': None, 'star_breakdown': None}

    asin = (asin or '').upper()
    candidates = []

    def add(rating, count, confidence, source, breakdown=None):
        try:
            rating = float(rating) if rating is not None else None
        except (TypeError, ValueError):
            rating = None
        count = _parse_count(count) if count is not None else None
        if rating is not None and not (0 < rating <= 5):
            return
        if rating is None and count is None:
            return
        candidates.append({
            'rating': rating,
            'review_count': count,
            'confidence': confidence,
            'source': source,
            'star_breakdown': breakdown,
        })

    # --- Highest confidence: Amazon Customer Reviews table / global ratings block ---
    m = re.search(
        r'Customer Reviews\s*\|\s*\[([\d.]+)\s*_([\d.]+) out of 5 stars_\][^\[]{0,160}\[\(([\d,]+)\)\]',
        text, re.I
    )
    if m:
        add(m.group(1), m.group(3), 98, 'amazon-reviews-table')

    m = re.search(
        r'([\d.]+)\s*out of\s*5\s*stars?,\s*([\d,]+)\s*ratings',
        text, re.I
    )
    if m:
        add(m.group(1), m.group(2), 96, 'amazon-stars-ratings-pair')

    m = re.search(
        r'##\s*Customer reviews\s*_?([\d.]+)\s*out of\s*5\s*stars?_?\s*([\d.]+)\s*out of\s*5\s*([\d,]+)\s*global ratings',
        text, re.I
    )
    if m:
        add(m.group(1), m.group(3), 97, 'amazon-customer-reviews-heading')

    m = re.search(
        r'_([\d.]+)\s*out of\s*5\s*stars_\s*([\d.]+)\s*out of\s*5\s*([\d,]+)\s*global ratings',
        text, re.I
    )
    if m:
        add(m.group(1), m.group(3), 97, 'amazon-global-ratings')

    # ASIN-scoped histogram / review portal (ties count to THIS asin)
    if asin:
        m = re.search(
            rf'([\d.]+)\s*out of\s*5[\s\S]{{0,240}}?([\d,]+)\s*global ratings[\s\S]{{0,200}}?'
            rf'(?:portal/customer-reviews|product-reviews)/{re.escape(asin)}',
            text, re.I
        )
        if m:
            add(m.group(1), m.group(2), 95, 'amazon-asin-scoped-block')

        # HTML hooks often present in direct HTML
        m = re.search(
            rf'["\']?asin["\']?\s*[:=]\s*["\']{re.escape(asin)}["\'][\s\S]{{0,400}}?'
            rf'"ratingValue"\s*:\s*"?([\d.]+)"?[\s\S]{{0,200}}?"reviewCount"\s*:\s*"?([\d,]+)"?',
            text, re.I
        )
        if m:
            add(m.group(1), m.group(2), 94, 'json-asin-aggregate')

        m = re.search(
            rf'data-asin=["\']{re.escape(asin)}["\'][\s\S]{{0,800}}?'
            rf'aria-label=["\']([\d.]+)\s*out of\s*5[\s\S]{{0,400}}?'
            rf'(?:acrCustomerReviewText|totalReviewCount)[^>]*>\s*([\d,]+)',
            text, re.I
        )
        if m:
            add(m.group(1), m.group(2), 93, 'html-asin-acr')

    # data-hook HTML (direct Amazon HTML)
    m = re.search(
        r'data-hook=["\']rating-out-of-text["\'][^>]*>\s*([\d.]+)\s*out of\s*5',
        text, re.I
    )
    m2 = re.search(
        r'(?:id=["\']acrCustomerReviewText["\']|data-hook=["\']total-review-count["\'])[^>]*>\s*([\d,]+)',
        text, re.I
    )
    if m and m2:
        add(m.group(1), m2.group(1), 92, 'amazon-data-hook-pair')

    # Flipkart: [4.6 | 2,46,421]
    m = re.search(r'\[(\d(?:\.\d)?)\s*\|\s*([\d,]+)\]', text)
    if m:
        add(m.group(1), m.group(2), 95, 'flipkart-rating-pipe')
    m = re.search(r'([\d.]+)\s*★\s*\(?\s*([\d,]+)\s*\)?', text)
    if m:
        add(m.group(1), m.group(2), 90, 'flipkart-star-count')
    m = re.search(r'([\d.]+)\s*(?:\||·)\s*([\d,]+)\s*ratings?', text, re.I)
    if m:
        add(m.group(1), m.group(2), 88, 'flipkart-ratings-line')

    # JSON-LD Product aggregate — only if a single clear Product or ASIN matches
    products = _extract_json_ld(text) if '<script' in text.lower() else []
    for p in products:
        agg = p.get('aggregateRating') if isinstance(p, dict) else None
        if not isinstance(agg, dict):
            continue
        sku = str(p.get('sku') or p.get('productID') or p.get('@id') or '')
        conf = 70
        if asin and asin in sku.upper():
            conf = 93
        elif asin and asin in text[max(0, text.find(str(agg)[:20]) - 200):].upper():
            conf = 80
        add(agg.get('ratingValue'), agg.get('reviewCount') or agg.get('ratingCount'), conf, 'json-ld-product')

    # Star breakdown near Customer reviews (Amazon jina markdown packs % like 51%20%11%4%14%)
    breakdown = None
    hist_block = ''
    mhist = re.search(r'##\s*Customer reviews([\s\S]{0,1600})', text, re.I)
    if mhist:
        hist_block = mhist.group(1)
    pcts = re.findall(
        r'1 star\s*5 star\s*4 star\s*3 star\s*2 star\s*1 star\s*1 star\s*(\d{1,3})%(\d{1,3})%(\d{1,3})%(\d{1,3})%(\d{1,3})%',
        hist_block, re.I
    )
    if not pcts:
        # fallback: first five percentages after "5 star 4 star 3 star 2 star 1 star"
        m = re.search(
            r'5 star\s*4 star\s*3 star\s*2 star\s*1 star\s*5 star\s*(\d{1,3})%(\d{1,3})%(\d{1,3})%(\d{1,3})%(\d{1,3})%',
            hist_block, re.I
        )
        if m:
            pcts = [m.groups()]
    if pcts:
        try:
            p = pcts[0]
            breakdown = {'5': int(p[0]), '4': int(p[1]), '3': int(p[2]), '2': int(p[3]), '1': int(p[4])}
        except (ValueError, IndexError):
            breakdown = None

    # Low-confidence fallback ONLY on noise-stripped text, requiring rating+count nearby
    safe = _strip_related_noise(text)
    # Remove other-ASIN product-reviews star chips: [_4.3 out of 5 stars_ 5,123](…/product-reviews/OTHER…)
    if asin:
        safe = re.sub(
            rf'_[\d.]+\s*out of\s*5 stars_[\s\S]{{0,40}}?product-reviews/(?!{re.escape(asin)})[A-Z0-9]{{10}}',
            ' ', safe, flags=re.I
        )
    m = re.search(
        r'([\d.]+)\s*out of\s*5(?:\s*stars?)?[^\n]{0,40}?([\d,]+)\s*(?:global\s+)?(?:ratings?|reviews?|customer reviews?)',
        safe, re.I
    )
    if m:
        add(m.group(1), m.group(2), 60, 'fallback-paired-out-of-five')

    if not candidates:
        return {'rating': None, 'review_count': None, 'confidence': 0, 'source': None, 'star_breakdown': breakdown}

    # Prefer highest confidence; tie-break by having both fields, then larger review count (real listing aggregates)
    candidates.sort(
        key=lambda c: (
            c['confidence'],
            1 if c['rating'] is not None else 0,
            1 if c['review_count'] is not None else 0,
            c['review_count'] or 0,
        ),
        reverse=True
    )
    best = candidates[0]
    # Reject weak lone ratings with no count — those are usually related-product chips
    if best['confidence'] < 70 and (best['rating'] is None or best['review_count'] is None):
        return {'rating': None, 'review_count': None, 'confidence': 0, 'source': None, 'star_breakdown': breakdown}
    if breakdown and not best.get('star_breakdown'):
        best['star_breakdown'] = breakdown
    return best


def _parse_rating(html):
    """Back-compat wrapper."""
    return _extract_rating_bundle(html).get('rating')


def _parse_review_count(html):
    """Back-compat wrapper."""
    return _extract_rating_bundle(html).get('review_count')


def _extract_buyer_insights(text, asin=None):
    """Pull buyer pros/cons + sample reviews from Customers say / aspect stats / top reviews."""
    empty = {
        'customers_say': '',
        'aspects': [],
        'pros': [],
        'cons': [],
        'sample_reviews': [],
        'reviews_analyzed': 0,
        'summary': 'No buyer-review themes found on the page.',
    }
    if not text:
        return empty

    customers_say = ''
    m = re.search(
        r'(?:###\s*)?Customers say\s+(.{80,900}?)(?:\n\s*AI Generated|\n\s*####|\n\s*Quality\(|\n\s*\d[\d,]*\s+customers mention)',
        text, re.I | re.S
    )
    if m:
        customers_say = re.sub(r'\s+', ' ', m.group(1)).strip()

    aspects = []
    seen = set()
    for m in re.finditer(
        r'([\d,]+)\s+customers mention\s+"?([^"\n,]{2,60}?)"?\s*,?\s*([\d,]+)\s+positive,?\s*([\d,]+)\s+negative',
        text, re.I
    ):
        name = m.group(2).strip().title()
        key = name.lower()
        if key in seen:
            continue
        seen.add(key)
        total = _parse_count(m.group(1)) or 0
        pos = _parse_count(m.group(3)) or 0
        neg = _parse_count(m.group(4)) or 0
        if total <= 0:
            continue
        aspects.append({
            'name': name,
            'total': total,
            'positive': pos,
            'negative': neg,
            'positive_pct': round(100 * pos / total),
            'negative_pct': round(100 * neg / total),
        })
    aspects.sort(key=lambda a: a['total'], reverse=True)

    pros, cons = [], []
    for a in aspects:
        entry = {
            'text': a['name'],
            'count': a['total'],
            'positive': a['positive'],
            'negative': a['negative'],
            'detail': f"{a['positive']:,} positive / {a['negative']:,} negative mentions",
        }
        if a['positive_pct'] >= 70:
            pros.append(entry)
        if a['negative_pct'] >= 30 or a['positive_pct'] < 55:
            cons.append({
                **entry,
                'count': a['negative'],
                'detail': f"{a['negative']:,} of {a['total']:,} mention issues with {a['name'].lower()}",
            })

    # Sample top reviews (dedupe by title+stars)
    samples = []
    seen_rev = set()
    review_region = text
    mreg = re.search(r'Top reviews(?: from [^\n]+)?([\s\S]{0,50000})', text, re.I)
    if mreg:
        review_region = mreg.group(1)
    headers = list(re.finditer(
        r'_([1-5]) out of 5 stars_\s*#####\s*\[([^\]]{2,120})\]',
        review_region, re.I
    ))
    for idx, m in enumerate(headers):
        stars = int(m.group(1))
        title = re.sub(r'\s+', ' ', m.group(2)).strip()
        start = m.end()
        end = headers[idx + 1].start() if idx + 1 < len(headers) else min(len(review_region), start + 2500)
        chunk = review_region[start:end]
        # Flatten markdown first so "Verified Purchase" isn't buried inside link URLs
        body = re.sub(r'!\[.*?\]\([^)]+\)', ' ', chunk)
        body = re.sub(r'\[([^\]]*)\]\([^)]+\)', r'\1', body)
        body = re.sub(r'https?://\S+', ' ', body)
        body = re.sub(r'Brief content visible.*?brief content\.', ' ', body, flags=re.I | re.S)
        body = re.sub(r'Read more(?: Read less)?', ' ', body, flags=re.I)
        body = re.sub(
            r'(Helpful|Sending feedback|Thank you for your feedback|Report|Sorry, we failed|Sorry, We failed).*$',
            '', body, flags=re.I | re.S
        )
        vm = re.search(
            r'(?:Verified Purchase|Reviewed in [A-Za-z ]+ on [^\n]{0,40})\s*(.*)$',
            body, re.I | re.S
        )
        if vm:
            body = vm.group(1)
        # Colour / variant chips sometimes precede the text
        body = re.sub(r'^(?:Colour|Color|Size|Pattern|Style)\s*:\s*[^\n.]{1,40}\s*', '', body, flags=re.I)
        body = re.sub(r'\s+', ' ', body).strip(' -•\n\t')
        key = (stars, title.lower())
        if key in seen_rev or len(body) < 30:
            continue
        seen_rev.add(key)
        samples.append({'stars': stars, 'title': title[:120], 'body': body[:340]})
        if len(samples) >= 10:
            break

    # Fallback keyword mining from sample review text if aspects missing
    if not pros and not cons and samples:
        blob = ' '.join(s['title'] + ' ' + s['body'] for s in samples).lower()
        pro_kw = [
            ('battery', 'Battery life praised'), ('display', 'Display quality liked'),
            ('value', 'Value for money'), ('quality', 'Build quality'),
            ('comfort', 'Comfortable to use/wear'), ('feature', 'Feature set'),
            ('sound', 'Sound quality'), ('design', 'Design / looks'),
        ]
        con_kw = [
            ('drain', 'Battery drain complaints'), ('scratch', 'Scratches / finish issues'),
            ('lag', 'Lag / performance issues'), ('defect', 'Defects reported'),
            ('fake', 'Authenticity concerns'), ('return', 'Returns / replacements'),
            ('heat', 'Heating issues'), ("don't buy", 'Strong buy warnings'),
            ('waste', 'Waste-of-money mentions'),
        ]
        for key, label in pro_kw:
            c = blob.count(key)
            if c:
                pros.append({'text': label, 'count': c, 'positive': c, 'negative': 0, 'detail': f'Seen in {c} sample review snippets'})
        for key, label in con_kw:
            c = blob.count(key)
            if c:
                cons.append({'text': label, 'count': c, 'positive': 0, 'negative': c, 'detail': f'Seen in {c} sample review snippets'})

    reviews_analyzed = len(samples) + sum(1 for _ in aspects)
    if customers_say and aspects:
        summary = (
            f'Analyzed Amazon buyer themes across {aspects[0]["total"]:,}+ aspect mentions '
            f'and {len(samples)} top reviews.'
        )
    elif customers_say:
        summary = 'Pulled Amazon “Customers say” summary and top reviews.'
    elif samples:
        summary = f'Read {len(samples)} top customer reviews from the listing page.'
    elif aspects:
        summary = f'Found {len(aspects)} buyer aspect themes with mention counts.'
    else:
        summary = empty['summary']

    # Sentiment-ish score from aspect polarity
    pos_sum = sum(a['positive'] for a in aspects) or sum(1 for s in samples if s['stars'] >= 4)
    neg_sum = sum(a['negative'] for a in aspects) or sum(1 for s in samples if s['stars'] <= 2)
    total = pos_sum + neg_sum
    score = round(100 * pos_sum / total) if total else 55

    return {
        'customers_say': customers_say,
        'aspects': aspects[:12],
        'pros': pros[:8],
        'cons': cons[:8],
        'sample_reviews': samples,
        'reviews_analyzed': reviews_analyzed,
        'summary': summary,
        'score': score,
        'positive_hits': pos_sum,
        'negative_hits': neg_sum,
    }


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


def _from_json_ld(products, asin=None):
    if not products:
        return {}
    p = products[0]
    if asin:
        for cand in products:
            blob = json.dumps(cand, ensure_ascii=False).upper()
            if asin.upper() in blob:
                p = cand
                break
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
                'text': text[:220000], 'title': title, 'image': image,
                'html': text[:220000],
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
    asin = _amazon_asin(url)

    title = ''
    description = ''
    image = ''
    price = None
    brand = ''
    availability = ''
    currency = 'INR'
    final_url = url
    sources_used = []
    combined_text = ''
    rating_candidates = []

    for ch in chunks:
        if not ch or not ch.get('ok'):
            continue
        sources_used.append(ch.get('source', '?'))
        if ch.get('final_url'):
            final_url = ch['final_url']
            asin = asin or _amazon_asin(final_url)

        html = ch.get('html') or ch.get('text') or ''
        # Keep a large window — reviews live deep in Amazon pages
        combined_text += '\n' + html[:180000]

        if html and '<script' in html.lower():
            ld = _from_json_ld(_extract_json_ld(html), asin=asin)
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
            if 'conditions of use' not in cand_desc.lower():
                description = cand_desc

        cand_img = ch.get('image') or ld.get('image') or _meta(html, 'og:image', 'twitter:image') or ''
        if cand_img and not image and not str(cand_img).startswith('data:image'):
            image = cand_img

        if price is None:
            price = ld.get('price')
        if price is None:
            price = _parse_price(_meta(html, 'product:price:amount', 'og:price:amount', 'twitter:data1'))
        if price is None:
            price = _best_price_from_text(html)

        # Per-source rating bundle (never trust bare first "X out of 5")
        bundle = _extract_rating_bundle(html, asin=asin)
        if bundle.get('confidence', 0) >= 60:
            rating_candidates.append(bundle)
        elif ld.get('rating') is not None and ld.get('review_count') is not None:
            rating_candidates.append({
                'rating': ld.get('rating'),
                'review_count': ld.get('review_count'),
                'confidence': 72,
                'source': 'json-ld-merged',
                'star_breakdown': None,
            })

        if not brand:
            brand = ld.get('brand') or _meta(html, 'product:brand', 'og:brand') or ch.get('publisher') or ''
        if not availability:
            availability = ld.get('availability') or ''
        if ld.get('currency'):
            currency = ld['currency']

    asin = _amazon_asin(final_url) or asin or _amazon_asin(url)

    # Final rating pass on the full combined corpus (highest signal)
    best_rating = _extract_rating_bundle(combined_text, asin=asin)
    for cand in rating_candidates:
        if cand.get('confidence', 0) > best_rating.get('confidence', 0):
            best_rating = cand
        elif cand.get('confidence', 0) == best_rating.get('confidence', 0):
            # Prefer candidate that has both fields
            if (cand.get('rating') is not None and cand.get('review_count') is not None) and \
               (best_rating.get('rating') is None or best_rating.get('review_count') is None):
                best_rating = cand

    rating = best_rating.get('rating')
    review_count = best_rating.get('review_count')
    star_breakdown = best_rating.get('star_breakdown')

    buyer = _extract_buyer_insights(combined_text, asin=asin)
    page_sent = _sentiment_from_text(combined_text[:12000] + ' ' + title + ' ' + description)
    # Prefer buyer-aspect polarity when we actually mined reviews
    if buyer.get('aspects') or buyer.get('sample_reviews'):
        sentiment = {
            'score': buyer.get('score', page_sent['score']),
            'positive_hits': buyer.get('positive_hits', 0),
            'negative_hits': buyer.get('negative_hits', 0),
            'summary': buyer.get('summary') or page_sent.get('summary'),
        }
    else:
        sentiment = page_sent

    if _is_junk_title(title):
        title = url_title or f'Product on {host or "link"}'
    if not description:
        description = f'Product link from {host}. Details filled from best available source.'
    if asin and not brand:
        brand = 'Amazon listing'

    note_parts = []
    if sources_used:
        note_parts.append('Sources: ' + ', '.join(dict.fromkeys(sources_used)))
    else:
        note_parts.append('Used URL heuristics (stores blocked the fetch).')
    if price is None:
        note_parts.append('Price not detected — enter it manually.')
    else:
        note_parts.append('You can override the price before analysis.')
    if rating is not None and review_count is not None:
        note_parts.append(
            f'Listing rating {rating:.1f}★ from {review_count:,} ratings'
            + (f' ({best_rating.get("source")})' if best_rating.get('source') else '')
            + '.'
        )
    elif rating is None:
        note_parts.append('Could not confidently read this listing’s rating (ignored related-product stars).')
    if buyer.get('pros') or buyer.get('cons'):
        note_parts.append(
            f'Buyer themes: {len(buyer.get("pros") or [])} pros / {len(buyer.get("cons") or [])} cons mined from reviews.'
        )

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
        'rating_source': best_rating.get('source'),
        'rating_confidence': best_rating.get('confidence') or 0,
        'star_breakdown': star_breakdown,
        'brand': brand or '',
        'availability': availability,
        'sentiment': sentiment,
        'buyer_insights': buyer,
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
