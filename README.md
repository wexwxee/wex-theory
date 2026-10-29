# WEXTheory

Practice platform for the Danish category B driving theory test: photo questions in the real test format, road-sign lessons and exam vocabulary, with explanations in English and Russian.

**Live:** https://wextheory.cv

## Features

- **Practice tests:** 13 tests with 325 photo questions, plus Exam mode (25 mixed questions, 20/25 to pass)
- **Review:** saved questions, attempt history, review of mistakes with explanations, optional AI explanation of mistakes
- **Road signs:** a course of 18 short lessons with spaced review (1, 3, 7, 14 and 30 days) and a full sign catalogue
- **Exam Words:** vocabulary from the test with English–Russian practice
- **Free start:** a 15-question starter test that needs no account
- **Accounts:** email sign-up with verification, paid access managed by the admin

## Stack

Python 3.11 · FastAPI · SQLAlchemy (PostgreSQL in production, SQLite locally) · Jinja2 templates · Stripe · Resend (email) · Anthropic API (optional explanations) · Render

## Running locally

```bash
python -m venv .venv
.venv/bin/pip install -r requirements-dev.txt     # Windows: .venv\Scripts\pip
.venv/bin/python scripts/run_local.py             # http://127.0.0.1:8010
```

`scripts/run_local.py` creates a local SQLite database and a secret key in `.local/` and turns off real email delivery. On Windows, `start-local.ps1` does the same.

Tests: `pytest` (Python) and `tests/browser/` (browser tests, see its README).

## Project layout

```
main.py              FastAPI app and routes
auth.py, models.py   accounts, sessions and database models
study.py, review.py  practice tests, results and review
sign_*.py, signs.py  road-sign course, lessons and catalogue
templates/, static/  pages, styles and scripts
data/, test-images/  question bank and question photos
scripts/             data import, translation and launch checks
docs/                launch checklist, email setup, working notes
```

Production settings are listed in `render.yaml`; `scripts/check_launch.py` verifies them before launch.

## Disclaimer

Independent practice material, not the official Danish theory test.
