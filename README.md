# THRIVE

Personal life OS — habits, knowledge hub, and voice-assisted productivity in a lightweight web app.

**Live demo:** [https://thrive-six-psi.vercel.app](https://thrive-six-psi.vercel.app)

## Features

- Daily tracking and personal dashboard (PWA-ready)
- Financial Ledger with budgets, debts, and spending trends
- **Should I Buy This?** — paste a product link, answer honest questions, and get a ledger-aware spendability meter plus a 100+ parameter audit (buy / wait / don't)
- Knowledge hub via RSS proxy
- Vita voice-assistant routes
- Flask backend with optional Supabase sync

## Tech stack

Python · Flask · Vercel · optional Supabase · service worker PWA

## Quick start

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env   # optional Supabase keys
python app.py
```

Or deploy with the included `vercel.json`.

## Configuration

Optional environment variables (see `.env.example`):

- `SUPABASE_URL`, `SUPABASE_KEY`

## Author

**Akshat Choudhary** — Electrical Engineering + Software  
[github.com/Akshat8011](https://github.com/Akshat8011)