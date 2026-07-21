"""
============================================================
VITA — Voice Intelligence & Thrive Assistant
Flask Backend: LOCAL Fuzzy-Match Brain + Free Edge TTS
============================================================

100% LOCAL. No API keys. No rate limits. No cloud.
Uses fuzzy keyword scoring to match ANY question to ANY
data in the Thrive app. Works every single time.

============================================================
"""

import os
import json
import uuid
import time
import re
import asyncio
from flask import Blueprint, request, jsonify, send_from_directory

vita_bp = Blueprint('vita', __name__)

AUDIO_DIR = '/tmp/vita_audio'
os.makedirs(AUDIO_DIR, exist_ok=True)

VITA_TTS_VOICE = os.environ.get('VITA_TTS_VOICE', 'en-US-GuyNeural')


# =============================================================
#  SCORING ENGINE — Maps ANY query to the best data category
# =============================================================

# Each category has: (name, keywords, aliases)
# Keywords are scored by overlap with the user's query
CATEGORIES = {
    'expense_today': {
        'keywords': ['expense', 'spend', 'spent', 'spending', 'money', 'cost', 'pay', 'paid', 'kharcha', 'kharche', 'expenditure', 'purchase'],
        'time_words': ['today', 'aaj', 'now', 'current'],
        'boost': 2,
    },
    'expense_week': {
        'keywords': ['expense', 'spend', 'spent', 'spending', 'money', 'cost', 'kharcha'],
        'time_words': ['week', 'weekly', 'is hafte', 'hafte', 'saptah'],
        'boost': 2,
    },
    'expense_month': {
        'keywords': ['expense', 'spend', 'spent', 'spending', 'money', 'cost', 'kharcha'],
        'time_words': ['month', 'monthly', 'mahine', 'mahina', 'is mahine'],
        'boost': 2,
    },
    'expense_breakdown': {
        'keywords': ['breakdown', 'breakup', 'detail', 'details', 'category', 'categories', 'category wise', 'type', 'types', 'where', 'kyu', 'kaise', 'analysis', 'distribution'],
        'time_words': ['today', 'month', 'monthly'],
        'boost': 4,
    },
    'budget': {
        'keywords': ['budget', 'remaining', 'left', 'over', 'under', 'limit', 'track', 'monthly'],
        'time_words': [],
        'boost': 3,
    },
    'debt_lent': {
        'keywords': ['lent', 'lend', 'lending', 'given', 'gave', 'diya', 'diye', 'owe me', 'owes me'],
        'time_words': [],
        'boost': 3,
    },
    'debt_borrowed': {
        'keywords': ['borrow', 'borrowed', 'borrowing', 'owe', 'owing', 'liya', 'udhar', 'debt', 'i owe'],
        'time_words': [],
        'boost': 3,
    },
    'debt_all': {
        'keywords': ['debt', 'debts', 'all debt', 'total debt', 'udhar', 'settlements', 'settled', 'unsettled'],
        'time_words': [],
        'boost': 2,
    },
    'milestone': {
        'keywords': ['milestone', 'milestones', 'countdown', 'counting', 'days left', 'days until', 'upcoming', 'target date', 'nearest', 'closest', 'next milestone', 'important date', 'event date', 'countdown timer', 'big day', 'special day'],
        'time_words': [],
        'boost': 3,
    },
    'goals': {
        'keywords': ['goal', 'goals', 'target', 'achievement', 'progress', 'daily goal', 'objective', 'aim', 'mission', 'track', 'streak'],
        'time_words': [],
        'boost': 2,
    },
    'goals_progress': {
        'keywords': ['progress', 'done', 'completed', 'completion', 'how much done', 'percentage', 'how am i', 'status'],
        'time_words': ['today', 'daily'],
        'boost': 1,
    },
    'reminders': {
        'keywords': ['reminder', 'reminders', 'remind', 'remember', 'yaad', 'note', 'alert', 'notification', 'pending', 'upcoming reminder', 'new reminder', 'latest reminder', 'recent reminder', 'my reminder'],
        'time_words': [],
        'boost': 3,
    },
    'todos': {
        'keywords': ['todo', 'todos', 'to-do', 'to do', 'task', 'tasks', 'pending task', 'what to do', 'list', 'today task', 'kaam'],
        'time_words': [],
        'boost': 3,
    },
    'checklist': {
        'keywords': ['checklist', 'check list', 'check', 'checked', 'unchecked', 'tick', 'daily checklist', 'routine'],
        'time_words': [],
        'boost': 3,
    },
    'purchases': {
        'keywords': ['purchase', 'purchases', 'buy', 'bought', 'shopping', 'shop', 'kharidna', 'to buy', 'shopping list', 'wish list', 'wishlist'],
        'time_words': [],
        'boost': 3,
    },
    'pomodoro': {
        'keywords': ['pomodoro', 'focus', 'session', 'sessions', 'timer', 'study', 'concentration', 'work session', 'deep work', 'focused', 'hours studied', 'quote', 'thought', 'vichar', 'motivation'],
        'time_words': ['today'],
        'boost': 4,
    },
    'ideas': {
        'keywords': ['idea', 'ideas', 'thought', 'thoughts', 'brainstorm', 'creative', 'inspiration', 'concept', 'my idea', 'new idea', 'latest idea', 'recent idea'],
        'time_words': [],
        'boost': 3,
    },
    'journals': {
        'keywords': ['journal', 'journals', 'diary', 'entry', 'mood', 'feeling', 'write', 'wrote', 'writing', 'reflection', 'my journal', 'recent journal', 'last entry', 'latest entry'],
        'time_words': [],
        'boost': 3,
    },
    'income': {
        'keywords': ['income', 'earning', 'earnings', 'salary', 'revenue', 'money in', 'received', 'credit', 'kamai', 'aaya', 'earn'],
        'time_words': [],
        'boost': 3,
    },
    'knowledge_hub': {
        'keywords': ['feed', 'feeds', 'rss', 'news', 'articles', 'article', 'reading', 'read', 'unread', 'knowledge hub', 'blog', 'blogs', 'subscription', 'subscriptions', 'opml', 'sources', 'reader'],
        'time_words': [],
        'boost': 3,
    },
    'calendar': {
        'keywords': ['calendar', 'event', 'events', 'holiday', 'holidays', 'festival', 'occasion', 'upcoming', 'next', 'coming', 'schedule', 'plan', 'agenda', 'tyohaar', 'chutti', 'when'],
        'time_words': [],
        'boost': 2,
    },
    'summary': {
        'keywords': ['summary', 'summarize', 'overview', 'overall', 'status', 'recap', 'report', 'everything', 'all', 'how am i', 'my day', 'daily', 'snapshot', 'dashboard'],
        'time_words': ['today'],
        'boost': 1,
    },
    'greeting': {
        'keywords': ['hi', 'hello', 'hey', 'sup', 'yo', 'namaste', 'good morning', 'good evening', 'good night', 'howdy'],
        'time_words': [],
        'boost': 5,
    },
    'identity': {
        'keywords': ['who are you', 'your name', 'what are you', 'what can you do', 'about you', 'introduce', 'kaun ho', 'kaun hai', 'capabilities'],
        'time_words': [],
        'boost': 5,
    },
    'help': {
        'keywords': ['help', 'how to', 'what can i ask', 'commands', 'questions', 'guide', 'options', 'features', 'what all'],
        'time_words': [],
        'boost': 4,
    },
}

# Common stop words to ignore in scoring
STOP_WORDS = {'is', 'the', 'a', 'an', 'what', 'how', 'my', 'i', 'me', 'do', 'did', 'does',
              'am', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'can', 'could',
              'will', 'would', 'should', 'may', 'might', 'about', 'of', 'in', 'on', 'at',
              'to', 'for', 'from', 'with', 'by', 'up', 'so', 'if', 'or', 'and', 'but',
              'not', 'no', 'this', 'that', 'it', 'its', 'any', 'much', 'many', 'tell',
              'give', 'show', 'please', 'just', 'also', 'very'}


def _score_category(query_words, query_raw, cat_data):
    """Score how well a query matches a category."""
    score = 0
    kw_set = set(cat_data['keywords'])
    time_set = set(cat_data.get('time_words', []))

    # 1. Direct word overlap
    for word in query_words:
        if word in kw_set:
            score += cat_data.get('boost', 1)

    # 2. Substring / phrase matching (catches "next milestone", "to do", etc.)
    query_lower = query_raw.lower()
    for kw in cat_data['keywords']:
        if len(kw) > 3 and kw in query_lower:
            score += cat_data.get('boost', 1) * 1.5

    # 3. Time-word bonus
    for word in query_words:
        if word in time_set:
            score += 1.5

    return score


def _detect_intent(query):
    """Detect the best-matching intent using fuzzy keyword scoring."""
    query_lower = query.lower().strip()
    query_words = set(re.findall(r'[a-z]+', query_lower)) - STOP_WORDS

    best_intent = 'unknown'
    best_score = 0

    for intent_name, cat_data in CATEGORIES.items():
        score = _score_category(query_words, query_lower, cat_data)
        if score > best_score:
            best_score = score
            best_intent = intent_name

    # If score is very low, try a smart fallback
    if best_score < 1.5:
        best_intent = _smart_fallback(query_lower, query_words)

    return best_intent, best_score


def _smart_fallback(query_lower, query_words):
    """If no category scored well, try to infer from context clues."""
    # Check for question patterns
    if any(w in query_words for w in ['nearest', 'closest', 'next', 'upcoming', 'coming']):
        # What's next? Check if any domain word is present
        if any(w in query_lower for w in ['milestone', 'event', 'holiday']):
            return 'milestone' if 'milestone' in query_lower else 'calendar'
        return 'calendar'  # Default "nearest/next" to calendar

    if any(w in query_words for w in ['new', 'latest', 'recent', 'last']):
        # "new X" pattern — try to match X
        for domain, cat in [('reminder', 'reminders'), ('idea', 'ideas'), ('journal', 'journals'),
                            ('expense', 'expense_today'), ('goal', 'goals'), ('milestone', 'milestone'),
                            ('todo', 'todos'), ('task', 'todos')]:
            if domain in query_lower:
                return cat

    if any(w in query_words for w in ['total', 'count', 'number', 'kitne', 'kitna']):
        return 'summary'

    return 'summary'  # Default: show a full summary


# =============================================================
#  RESPONSE GENERATOR — Produces natural text from data
# =============================================================

def _fmt(amount):
    """Format Indian Rupees."""
    if amount == 0:
        return 'Rs.0'
    return 'Rs.' + f'{amount:,.0f}'


def _fdate(date_str):
    """Convert ISO date to natural format."""
    try:
        from datetime import datetime
        d = datetime.strptime(date_str, '%Y-%m-%d')
        day = d.day
        sfx = 'th'
        if day in (1, 21, 31): sfx = 'st'
        elif day in (2, 22): sfx = 'nd'
        elif day in (3, 23): sfx = 'rd'
        return d.strftime(f'%B {day}{sfx}')
    except:
        return date_str


def _generate_response(intent, ctx, query=""):
    """Generate a precise response for any intent from the full context."""

    fin = ctx.get('finances', {})
    cal = ctx.get('calendar', {})
    gp = ctx.get('goals_progress', {})
    goals = ctx.get('goals', [])
    milestones = ctx.get('milestones', [])
    reminders = ctx.get('reminders', [])
    todos = ctx.get('todos', [])
    checklist = ctx.get('checklist', [])
    purchases = ctx.get('purchases', [])
    pomo = ctx.get('pomodoro', {})
    ideas = ctx.get('ideas', [])
    journals = ctx.get('journals', [])
    income = ctx.get('income', [])
    day_name = ctx.get('day_of_week', '')
    time_now = ctx.get('time', '')

    # ===================== EXPENSES =====================
    if intent == 'expense_today':
        total = fin.get('today_spend', 0)
        items = fin.get('today_expenses', [])
        if total == 0 and not items:
            return "You haven't spent anything today. Clean slate."
        r = f"You've spent {_fmt(total)} today."
        if items:
            top = sorted(items, key=lambda x: x.get('amount', 0), reverse=True)[:4]
            det = ', '.join([f"{x.get('description', '?')} ({_fmt(x.get('amount', 0))})" for x in top])
            r += f" Here's the breakdown: {det}."
        return r

    if intent == 'expense_breakdown':
        if 'month' in query.lower():
            cats = fin.get('monthly_category_spend', {})
            if not cats: return "I don't have your monthly category breakdown right now."
            lines = [f"{c} {_fmt(a)}" for c,a in sorted(cats.items(), key=lambda x: x[1], reverse=True)[:4]]
            return "This month's top spending categories are: " + ", ".join(lines) + "."
        else:
            cats = fin.get('today_category_spend', {})
            if not cats: return "No category spending today."
            lines = [f"{c} {_fmt(a)}" for c,a in sorted(cats.items(), key=lambda x: x[1], reverse=True)[:4]]
            return "Today's top categories: " + ", ".join(lines) + "."

    if intent == 'expense_week':
        t = fin.get('week_spend', 0)
        return f"This week's total spending is {_fmt(t)}." if t > 0 else "Zero spending this week."

    if intent == 'expense_month':
        t = fin.get('month_spend', 0)
        b = fin.get('monthly_budget', 0)
        r = f"This month you've spent {_fmt(t)}."
        if b > 0:
            rem = fin.get('budget_remaining', b - t)
            pct = int((t / b) * 100) if b > 0 else 0
            r += f" That's {pct}% of your {_fmt(b)} budget, with {_fmt(rem)} remaining."
        return r if t > 0 else "No expenses recorded this month yet."

    if intent == 'expense_breakdown':
        items = fin.get('today_expenses', [])
        if not items:
            return "No expenses logged today to break down."
        cats = {}
        for item in items:
            c = item.get('category', 'other')
            cats[c] = cats.get(c, 0) + item.get('amount', 0)
        lines = [f"  {cat.title()}: {_fmt(amt)}" for cat, amt in sorted(cats.items(), key=lambda x: x[1], reverse=True)]
        return "Today's spending by category: " + ', '.join([f"{cat.title()} {_fmt(amt)}" for cat, amt in sorted(cats.items(), key=lambda x: x[1], reverse=True)])

    # ===================== BUDGET =====================
    if intent == 'budget':
        b = fin.get('monthly_budget', 0)
        s = fin.get('month_spend', 0)
        rem = fin.get('budget_remaining', 0)
        if b == 0:
            return "No monthly budget is set. Set one in the Financial Ledger to track your spending."
        if rem < 0:
            return f"You're {_fmt(abs(rem))} OVER your {_fmt(b)} budget. Total spent: {_fmt(s)}. Time to slow down."
        pct = int((s / b) * 100) if b > 0 else 0
        return f"Budget: {_fmt(b)}. Spent: {_fmt(s)} ({pct}%). Remaining: {_fmt(rem)}."

    # ===================== DEBTS =====================
    if intent == 'debt_lent':
        t = fin.get('total_lent', 0)
        d = fin.get('lent_details', [])
        if t == 0:
            return "You haven't lent money to anyone, according to the records."
        ppl = ', '.join([f"{x.get('person', '?')} ({_fmt(x.get('amount', 0))})" for x in d[:5]])
        return f"Total lent: {_fmt(t)} to {len(d)} {'person' if len(d)==1 else 'people'}. {ppl}."

    if intent == 'debt_borrowed':
        t = fin.get('total_borrowed', 0)
        d = fin.get('borrowed_details', [])
        if t == 0:
            return "You don't owe anyone anything. Debt-free."
        ppl = ', '.join([f"{x.get('person', '?')} ({_fmt(x.get('amount', 0))})" for x in d[:5]])
        return f"Total borrowed: {_fmt(t)} from {len(d)} {'person' if len(d)==1 else 'people'}. {ppl}."

    if intent == 'debt_all':
        l = fin.get('total_lent', 0)
        b = fin.get('total_borrowed', 0)
        sc = fin.get('settled_count', 0)
        if l == 0 and b == 0:
            return "No debts recorded. Clean books."
        n = l - b
        r = f"Lent: {_fmt(l)}. Borrowed: {_fmt(b)}."
        if n > 0: r += f" Net: people owe you {_fmt(n)}."
        elif n < 0: r += f" Net: you owe others {_fmt(abs(n))}."
        if sc > 0: r += f" {sc} debts already settled."
        return r

    # ===================== MILESTONES =====================
    if intent == 'milestone':
        if not milestones:
            return "No milestones set. Go to the Dashboard and add your important dates."
        active = [m for m in milestones if not m.get('completed')]
        if not active:
            return f"All {len(milestones)} milestones are completed! Set new ones."
        lines = []
        for m in active[:5]:
            days = m.get('daysUntil')
            name = m.get('name', 'Unnamed')
            date = _fdate(m.get('targetDate', ''))
            if days is not None:
                if days == 0: lines.append(f"{name} is TODAY!")
                elif days == 1: lines.append(f"{name} is tomorrow ({date})")
                elif days < 0: lines.append(f"{name} was {abs(days)} days ago ({date})")
                else: lines.append(f"{name} in {days} days ({date})")
            else:
                lines.append(f"{name} (no date set)")
        return f"Your milestones: " + ". ".join(lines) + "."

    # ===================== GOALS =====================
    if intent == 'goals':
        if not goals:
            return "No goals set yet. Head to the Dashboard and set your targets."
        active = [g for g in goals if not g.get('completed')]
        done = [g for g in goals if g.get('completed')]
        lines = []
        for g in active[:5]:
            name = g.get('name')
            pct = g.get('percent', 0)
            cur = g.get('current', 0)
            tgt = g.get('target', 0)
            unit = g.get('unit', '')
            lines.append(f"{name}: {cur}/{tgt} {unit} ({pct}%)")
        r = f"{len(active)} active goals, {len(done)} completed. "
        if lines:
            r += "Active: " + ", ".join(lines) + "."
        return r

    if intent == 'goals_progress':
        if not gp:
            return "No goal progress logged for today yet."
        c = gp.get('completed', 0)
        t = gp.get('total', 0)
        p = gp.get('percent', 0)
        if t == 0: return "No goals set for today."
        if p == 100: return f"All {t} daily goals completed! 100%."
        return f"Today's progress: {c}/{t} goals done ({p}%)."

    # ===================== REMINDERS =====================
    if intent == 'reminders':
        if not reminders:
            return "No reminders found. You can add them from the Reminders section."
        pending = [r for r in reminders if not r.get('done')]
        done_r = [r for r in reminders if r.get('done')]
        if not pending:
            return f"All {len(reminders)} reminders are done. No pending ones."
        lines = []
        for r in pending[:5]:
            title = r.get('title', 'Untitled')
            days = r.get('daysUntil')
            date = _fdate(r.get('date', ''))
            if days is not None:
                if days == 0: lines.append(f"{title} (TODAY)")
                elif days == 1: lines.append(f"{title} (tomorrow)")
                elif days < 0: lines.append(f"{title} (overdue by {abs(days)} days)")
                else: lines.append(f"{title} ({date}, {days} days away)")
            else: lines.append(title)
        return f"{len(pending)} pending reminders: " + ", ".join(lines) + "."

    # ===================== TODOS =====================
    if intent == 'todos':
        if not todos:
            return "No to-do items for today. Add some to stay on track."
        done_t = [t for t in todos if t.get('done')]
        pend = [t for t in todos if not t.get('done')]
        r = f"Today's to-do: {len(done_t)}/{len(todos)} done."
        if pend:
            names = [t.get('text', '?') for t in pend[:5]]
            r += f" Pending: {', '.join(names)}."
        return r

    # ===================== CHECKLIST =====================
    if intent == 'checklist':
        if not checklist:
            return "Checklist is empty. Add items to your daily checklist."
        checked = [c for c in checklist if c.get('checked')]
        unchecked = [c for c in checklist if not c.get('checked')]
        r = f"Checklist: {len(checked)}/{len(checklist)} items done."
        if unchecked:
            names = [c.get('text', '?') for c in unchecked[:5]]
            r += f" Remaining: {', '.join(names)}."
        return r

    # ===================== PURCHASES =====================
    if intent == 'purchases':
        if not purchases:
            return "No purchase items logged today."
        done_p = [p for p in purchases if p.get('done')]
        pend = [p for p in purchases if not p.get('done')]
        r = f"Purchases: {len(done_p)}/{len(purchases)} bought."
        if pend:
            names = [p.get('text', '?') for p in pend[:5]]
            r += f" Still to buy: {', '.join(names)}."
        return r

    # ===================== POMODORO =====================
    if intent == 'pomodoro':
        s = pomo.get('today_sessions', 0)
        m = pomo.get('today_minutes', 0)
        h = pomo.get('today_hours', '0.0')
        
        if 'quote' in query.lower():
            import random
            quotes = [
                "Focus on being productive instead of busy.",
                "Starve your distractions, feed your focus.",
                "The successful warrior is the average man, with laser-like focus.",
                "Concentrate all your thoughts upon the work in hand."
            ]
            q = random.choice(quotes)
            return f"Today's focus quote: {q} You've completed {s} sessions so far."

        if s == 0:
            return "No Pomodoro sessions today. Time to focus?"
        return f"Today's focus: {s} Pomodoro {'session' if s==1 else 'sessions'}, totaling {m} minutes ({h} hours)."

    # ===================== IDEAS =====================
    if intent == 'ideas':
        if not ideas:
            return "No ideas logged yet. When inspiration strikes, save it in the Creative section."
        lines = [i.get('title', 'Untitled') for i in ideas[-5:]]
        return f"Your recent ideas ({len(ideas)} total): {', '.join(lines)}."

    # ===================== JOURNALS =====================
    if intent == 'journals':
        if not journals:
            return "No journal entries found. Try writing one in the Creative section."
        latest = journals[-1]
        mood = latest.get('mood', '')
        preview = latest.get('preview', '')
        date = _fdate(latest.get('date', ''))
        r = f"Latest journal entry ({date})"
        if mood: r += f", mood: {mood}"
        if preview: r += f". Preview: \"{preview}...\""
        r += f". Total entries: {len(journals)}."
        return r

    # ===================== INCOME =====================
    if intent == 'income':
        if not income:
            return "No income recorded this month."
        total = sum(i.get('amount', 0) for i in income)
        sources = [f"{i.get('source', '?')} ({_fmt(i.get('amount', 0))})" for i in income[:5]]
        return f"This month's income: {_fmt(total)}. Sources: {', '.join(sources)}."

    # ===================== CALENDAR =====================
    if intent == 'calendar':
        events = cal.get('upcoming_events', [])
        if not events:
            return "No upcoming events or holidays on the radar."
        lines = []
        for ev in events[:5]:
            name = ev.get('name', 'Unknown')
            days = ev.get('daysUntil', '?')
            date = _fdate(ev.get('date', ''))
            if days == 0: lines.append(f"{name} is TODAY!")
            elif days == 1: lines.append(f"{name} is tomorrow ({date})")
            else: lines.append(f"{name} in {days} days ({date})")
        return "Upcoming: " + ". ".join(lines) + "."

    # ===================== KNOWLEDGE HUB =====================
    if intent == 'knowledge_hub':
        kh = ctx.get('knowledge_hub', {})
        total = kh.get('total_articles', 0)
        unread = kh.get('unread_articles', 0)
        feeds = kh.get('total_feeds', 0)
        folders = kh.get('total_folders', 0)
        sources = kh.get('top_sources', [])
        recent_headlines = kh.get('recent_headlines', [])

        if total == 0:
            return "Knowledge Hub is empty. Import your RSS feeds using an OPML file to start reading."
            
        r = f"Knowledge Hub currently has {unread} unread articles out of {total} total. "
        
        # Check if user specifically asks to read news/headlines
        if any(w in query.lower() for w in ['read', 'news', 'headlines', 'latest', 'what']):
            if recent_headlines:
                r += "Here are a few recent headlines: " + ". ".join(recent_headlines) + "."
            else:
                r += "There are no new unread headlines to read right now."
        else:
            if sources:
                r += f"Top sources include {', '.join(sources[:3])}."
        return r

    # ===================== SUMMARY =====================
    if intent == 'summary':
        parts = []
        ts = fin.get('today_spend', 0)
        parts.append(f"Spent {_fmt(ts)} today")
        b = fin.get('monthly_budget', 0)
        if b > 0: parts.append(f"{_fmt(fin.get('budget_remaining', 0))} left in budget")
        if gp and gp.get('total', 0) > 0:
            parts.append(f"{gp.get('completed',0)}/{gp.get('total',0)} daily goals done")
        if goals:
            ag = len([g for g in goals if not g.get('completed')])
            parts.append(f"{ag} active goals")
        if milestones:
            am = [m for m in milestones if not m.get('completed')]
            if am:
                parts.append(f"Next milestone: {am[0].get('name','?')} in {am[0].get('daysUntil','?')} days")
        pnd = [r for r in reminders if not r.get('done')]
        if pnd: parts.append(f"{len(pnd)} pending reminders")
        if todos:
            dt = len([t for t in todos if t.get('done')])
            parts.append(f"{dt}/{len(todos)} todos done")
        ps = pomo.get('today_sessions', 0)
        if ps > 0: parts.append(f"{ps} Pomodoro sessions")
        l = fin.get('total_lent', 0)
        br = fin.get('total_borrowed', 0)
        if l > 0 or br > 0: parts.append(f"Lent {_fmt(l)}, owe {_fmt(br)}")
        evts = cal.get('upcoming_events', [])
        if evts:
            parts.append(f"Next event: {evts[0].get('name','?')} in {evts[0].get('daysUntil','?')} days")
        return f"Your {day_name} snapshot: " + '. '.join(parts) + '.'

    # ===================== GREETING =====================
    if intent == 'greeting':
        import random
        greetings = [
            f"Hey! It's {day_name}, {time_now}. What do you need?",
            f"Hello. I'm ready. Ask me anything about your Thrive data.",
            f"Hey there. Fire away, I know everything about your app.",
        ]
        return random.choice(greetings)

    # ===================== IDENTITY =====================
    if intent == 'identity':
        return "I'm Vita, your personal data assistant built into Thrive. I know everything in your app: expenses, debts, budget, goals, milestones, reminders, todos, checklist, pomodoro sessions, ideas, journals, income, RSS feeds, and calendar events. Ask me anything."

    # ===================== HELP =====================
    if intent == 'help':
        return """Here's what you can ask me:
  Expenses: "What did I spend today?", "This week's expenses", "Monthly spending"
  Budget: "Budget status", "Am I over budget?"
  Debts: "How much have I lent?", "What do I owe?"
  Milestones: "Nearest milestone", "My milestones"
  Goals: "My goals", "Today's progress"
  Reminders: "My reminders", "Pending reminders"
  Todos: "Today's tasks", "What's pending?"
  Pomodoro: "Focus sessions today", "How long did I study?"
  Ideas: "My recent ideas"
  Journal: "Latest journal entry"
  Income: "This month's income"
  Feeds: "My RSS feeds", "Unread articles", "News feed status"
  Calendar: "Next holiday", "Upcoming events"
  Summary: "How am I doing today?", "Daily snapshot"."""

    # ===================== UNKNOWN FALLBACK =====================
    # Instead of refusing, give a summary
    return _generate_response('summary', ctx, query)


# =============================================================
#  TTS — Free Edge Voice
# =============================================================
def _tts_edge(text):
    """(DEPRECATED) Backend TTS is disabled. Vita Voice rendering has been successfully offloaded 100% to the blazing-fast offline Frontend Native API to bypass PythonAnywhere firewalls."""
    return None


def _cleanup_old_audio():
    try:
        cutoff = time.time() - 600
        for f in os.listdir(AUDIO_DIR):
            fp = os.path.join(AUDIO_DIR, f)
            if os.path.isfile(fp) and os.path.getmtime(fp) < cutoff:
                os.remove(fp)
    except Exception as e:
        print(f"[Vita] Cleanup error: {e}")


# =============================================================
#  FLASK ROUTES
# =============================================================
@vita_bp.route('/api/vita/ask', methods=['POST'])
def vita_ask():
    try:
        data = request.get_json(force=True)
        query = data.get('query', '').strip()
        local_context = data.get('local_context', {})

        if not query:
            return jsonify({"error": "Empty query."}), 400

        _cleanup_old_audio()

        intent, score = _detect_intent(query)
        print(f"[Vita] Query: '{query}' -> Intent: {intent} (score: {score})")

        response_text = _generate_response(intent, local_context, query)

        audio_url = None
        try:
            audio_filename = _tts_edge(response_text)
            if audio_filename:
                audio_url = f"/api/vita/audio/{audio_filename}"
        except Exception as tts_err:
            print(f"[Vita] TTS error (non-fatal): {tts_err}")

        return jsonify({
            "response": response_text,
            "audio_url": audio_url
        })

    except Exception as e:
        print(f"[Vita] Error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            "response": f"Internal error: {str(e).encode('ascii','replace').decode()}",
            "audio_url": None
        })


@vita_bp.route('/api/vita/speak', methods=['POST'])
def vita_speak():
    try:
        data = request.get_json(force=True)
        text = data.get('text', '').strip()
        
        if not text:
            return jsonify({"error": "Empty text."}), 400
            
        _cleanup_old_audio()
        
        audio_url = None
        try:
            audio_filename = _tts_edge(text)
            if audio_filename:
                audio_url = f"/api/vita/audio/{audio_filename}"
        except Exception as tts_err:
            print(f"[Vita] TTS API error (Blocked): {tts_err}")
            
        return jsonify({"audio_url": audio_url})
    except Exception as e:
        print(f"[Vita] TTS direct error: {e}")
        return jsonify({"error": str(e)}), 500


@vita_bp.route('/api/vita/audio/<filename>', methods=['GET'])
def vita_audio(filename):
    return send_from_directory(AUDIO_DIR, filename, mimetype='audio/mpeg')
