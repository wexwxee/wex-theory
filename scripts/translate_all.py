"""
One-time batch translator: fills Question.question_text_ru, Question.explanation_ru,
and Answer.text_ru using Google's free translate endpoint.

Features:
- Skips items that already have a translation (idempotent — safe to re-run)
- Per-request retry with backoff on errors / rate-limit
- Progress logging
- Commits every BATCH_COMMIT_EVERY items so partial progress is preserved
"""
import os
import sys
import time
import json
import urllib.parse
import urllib.request

# Make project root importable when running from scripts/
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import models  # noqa: E402
from database import SessionLocal  # noqa: E402

GOOGLE_URL = (
    "https://translate.googleapis.com/translate_a/single"
    "?client=gtx&sl=en&tl=ru&dt=t&q={q}"
)
HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
}
BATCH_COMMIT_EVERY = 50
MAX_RETRIES = 5
SLEEP_BETWEEN = 0.20  # polite spacing between requests
RETRY_BACKOFF_BASE = 2.0


def google_translate(text: str) -> str | None:
    if not text or not text.strip():
        return None
    snippet = text.strip()[:4500]  # google free endpoint limit ~5k
    url = GOOGLE_URL.format(q=urllib.parse.quote(snippet))
    last_err: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            req = urllib.request.Request(url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read().decode("utf-8")
            data = json.loads(raw)
            if not isinstance(data, list) or not isinstance(data[0], list):
                return None
            parts = []
            for chunk in data[0]:
                if isinstance(chunk, list) and chunk and isinstance(chunk[0], str):
                    parts.append(chunk[0])
            translated = "".join(parts).strip()
            return translated or None
        except Exception as e:
            last_err = e
            wait = RETRY_BACKOFF_BASE ** attempt
            print(f"   ! retry {attempt + 1}/{MAX_RETRIES} after {wait:.1f}s ({e})")
            time.sleep(wait)
    print(f"   X giving up on text: {text[:50]!r} ({last_err})")
    return None


def main() -> None:
    db = SessionLocal()
    try:
        questions = db.query(models.Question).order_by(models.Question.id).all()
        answers = db.query(models.Answer).order_by(models.Answer.id).all()

        # Build the work list: (kind, obj, source_text, target_attr)
        work: list[tuple[str, object, str, str]] = []
        for q in questions:
            if q.question_text and not q.question_text_ru:
                work.append(("Q.text", q, q.question_text, "question_text_ru"))
            if q.explanation and not q.explanation_ru:
                work.append(("Q.expl", q, q.explanation, "explanation_ru"))
        for a in answers:
            if a.text and not a.text_ru:
                work.append(("A.text", a, a.text, "text_ru"))

        total = len(work)
        print(f"[translate_all] {len(questions)} questions, {len(answers)} answers")
        print(f"[translate_all] {total} fragments to translate (skipping already-done)")
        if total == 0:
            print("[translate_all] Nothing to do.")
            return

        done = 0
        ok = 0
        failed = 0
        since_commit = 0
        start_ts = time.time()

        for kind, obj, src, attr in work:
            translated = google_translate(src)
            if translated:
                setattr(obj, attr, translated)
                ok += 1
            else:
                failed += 1
            done += 1
            since_commit += 1

            if since_commit >= BATCH_COMMIT_EVERY:
                db.commit()
                since_commit = 0

            if done % 25 == 0 or done == total:
                elapsed = time.time() - start_ts
                rate = done / elapsed if elapsed > 0 else 0
                eta_sec = (total - done) / rate if rate > 0 else 0
                print(
                    f"[translate_all] {done}/{total}  ok={ok} fail={failed}  "
                    f"rate={rate:.1f}/s  eta={eta_sec:.0f}s"
                )

            time.sleep(SLEEP_BETWEEN)

        db.commit()
        print(f"[translate_all] DONE. ok={ok} failed={failed} of {total}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
