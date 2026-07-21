"""
============================================================
RSS PROXY v2 — Knowledge Hub Backend
Full content fetching + images + concurrent feeds
============================================================
"""

import os
import re
import time
import hashlib
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor, as_completed
from flask import Blueprint, request, jsonify

import feedparser

rss_bp = Blueprint('rss', __name__)

MAX_FEEDS = 150
MAX_ARTICLES_PER_FEED = 100
FETCH_TIMEOUT = 12


def _extract_image(entry):
    """Extract the best thumbnail/image from a feed entry."""
    # 1. media:thumbnail
    if hasattr(entry, 'media_thumbnail') and entry.media_thumbnail:
        return entry.media_thumbnail[0].get('url', '')

    # 2. media:content
    if hasattr(entry, 'media_content') and entry.media_content:
        for mc in entry.media_content:
            if mc.get('medium') == 'image' or (mc.get('type', '').startswith('image')):
                return mc.get('url', '')

    # 3. enclosure
    if hasattr(entry, 'enclosures') and entry.enclosures:
        for enc in entry.enclosures:
            if enc.get('type', '').startswith('image'):
                return enc.get('href', enc.get('url', ''))

    # 4. First <img> in content/summary
    html = ''
    if hasattr(entry, 'content') and entry.content:
        html = entry.content[0].get('value', '')
    elif entry.get('summary'):
        html = entry.summary

    if html:
        img_match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', html)
        if img_match:
            return img_match.group(1)

    return ''


def _get_full_content(entry):
    """Get the FULL article content from the feed entry."""
    # feedparser stores full content in entry.content
    if hasattr(entry, 'content') and entry.content:
        # Get the richest version (prefer html)
        best = entry.content[0].get('value', '')
        for c in entry.content:
            if c.get('type', '') == 'text/html':
                best = c.get('value', '')
                break
        return best

    # Fallback to summary/description (which may be full in some feeds)
    if entry.get('summary'):
        return entry.summary
    if entry.get('description'):
        return entry.description

    return ''


def _clean_snippet(html):
    """Strip HTML to get a plain-text snippet."""
    text = re.sub(r'<[^>]+>', '', html)
    text = re.sub(r'\s+', ' ', text).strip()
    return text[:250]


def _fetch_single_feed(url):
    """Fetch and parse a single RSS feed."""
    try:
        feed = feedparser.parse(url, request_headers={'User-Agent': 'Thrive-LifeOS/2.0'})
        if feed.bozo and not feed.entries:
            return []

        source_name = feed.feed.get('title', url)[:60]
        source_icon = feed.feed.get('image', {}).get('href', '') or feed.feed.get('icon', '')
        articles = []

        for entry in feed.entries[:MAX_ARTICLES_PER_FEED]:
            published = entry.get('published_parsed') or entry.get('updated_parsed')
            if published:
                pub_date = datetime(*published[:6]).isoformat() + "Z"
            else:
                # Don't fabricate dates — return None so frontend knows this date is missing
                pub_date = None

            link = entry.get('link', '')
            article_id = hashlib.md5((link or entry.get('title', '') + (pub_date or '')).encode()).hexdigest()[:16]

            full_content = _get_full_content(entry)
            snippet = _clean_snippet(full_content) if full_content else ''
            image = _extract_image(entry)

            # Get author
            author = entry.get('author', '') or ''

            articles.append({
                'id': article_id,
                'title': (entry.get('title') or 'Untitled')[:200],
                'source_name': source_name,
                'source_url': url,
                'source_icon': source_icon,
                'link': link,
                'published_date': pub_date,
                'snippet': snippet,
                'content': full_content,
                'image': image,
                'author': author[:80],
                'read': False,
                'saved': False
            })

        return articles

    except Exception as e:
        print(f"[RSS] Failed: {str(url)[:50]}: {e}")
        return []


@rss_bp.route('/api/rss-proxy', methods=['POST'])
def rss_proxy():
    try:
        data = request.get_json(force=True)
        urls = data.get('urls', [])[:MAX_FEEDS]

        if not urls:
            return jsonify({"error": "No feed URLs provided."}), 400

        all_articles = []
        fetched = 0
        failed = 0

        with ThreadPoolExecutor(max_workers=10) as executor:
            future_to_url = {executor.submit(_fetch_single_feed, url): url for url in urls}
            for future in as_completed(future_to_url, timeout=45):
                try:
                    articles = future.result(timeout=FETCH_TIMEOUT)
                    if articles:
                        all_articles.extend(articles)
                        fetched += 1
                    else:
                        failed += 1
                except Exception:
                    failed += 1

        all_articles.sort(key=lambda a: a.get('published_date', ''), reverse=True)

        return jsonify({
            "articles": all_articles,
            "fetched": fetched,
            "failed": failed,
            "total": len(all_articles)
        })

    except Exception as e:
        print(f"[RSS] Proxy error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500


@rss_bp.route('/api/rss-fetch-full', methods=['POST'])
def rss_fetch_full():
    try:
        data = request.get_json(force=True)
        url = data.get('url')
        if not url:
            return jsonify({"error": "No URL provided."}), 400

        import trafilatura
        import requests
        
        html = None
        try:
            # First try with requests and a real user-agent to bypass basic bot blockers
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
            }
            resp = requests.get(url, headers=headers, timeout=12)
            if resp.status_code == 200:
                html = resp.text
        except Exception as e:
            print(f"[RSS Proxy] requests fallback failed: {e}")
            
        if not html:
            html = trafilatura.fetch_url(url)
            
        if not html:
            return jsonify({"error": "Could not fetch URL."}), 400
            
        result = trafilatura.extract(html, include_formatting=True)
        if not result or len(result.strip()) < 10:
            return jsonify({"error": "Could not extract content."}), 400
            
        # Convert plain text to basically formatted HTML using simple paragraphs
        formatted_html = "".join([f"<p>{p.strip()}</p>" for p in result.split("\n\n") if p.strip()])

        return jsonify({"content": formatted_html})

    except Exception as e:
        print(f"[RSS] Fetch full error: {e}")
        return jsonify({"error": str(e)}), 500
