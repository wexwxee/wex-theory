"""
Rewrite Question.exam_style_text and Answer.exam_style_text in the
"Official DVSA / Danish driving test" tone.

Why: the official Danish driving theory exam in English uses very specific
legalistic phrasing translated from Danish. Our default `question_text` /
`answer.text` are too plain, so users who train on us underperform on the
real exam. This script generates a stricter, glossary-driven variant and
stores it in `exam_style_text`, which the app already exposes via
`?wording=exam`.

Rules (encoded in the prompt):
  - Strict reuse of glossary terms from data/exam_glossary.txt
  - Formal, bureaucratic tone, slightly longer
  - All answers in first person ("I ...") like the Danish original ("Jeg ...")
  - Meaning of correct/incorrect MUST NOT change

Usage:
  ANTHROPIC_API_KEY=sk-... python scripts/exam_style_rewrite.py --test 1
  ANTHROPIC_API_KEY=sk-... python scripts/exam_style_rewrite.py --all --force
  python scripts/exam_style_rewrite.py --test 1 --dry-run    # no API, no DB writes

Flags:
  --test N        only this test (1..14). Repeatable.
  --all           every test
  --skip-existing keep rows that already have exam_style_text
  --dry-run       print what would change, no API calls, no DB writes
  --limit N       cap how many questions to process this run
  --model NAME    override Claude model (default: claude-sonnet-4-6)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

# Make project root importable when running from scripts/
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import models  # noqa: E402
from database import SessionLocal  # noqa: E402

DEFAULT_MODEL = "claude-sonnet-4-6"
GLOSSARY_PATH = ROOT / "data" / "exam_glossary.txt"
BATCH_COMMIT_EVERY = 5
SLEEP_BETWEEN = 0.30
MAX_RETRIES = 4
RETRY_BACKOFF_BASE = 2.0


SYSTEM_PROMPT = """You are an expert localiser for the official Danish Driving \
Theory Test (taken in English). Your job is to rewrite plain-English driving \
questions and answers in the exact tone, vocabulary and register of the real \
DVSA-style Danish-to-English exam.

You MUST follow these rules:

1. STRICT GLOSSARY: Reuse the official terms from the glossary below. When the \
   plain text says something the glossary covers, swap it. Examples:
   - "give way"          -> "duty to give way to all traffic"
   - "rules"             -> "legal provision" / "statutory requirements"
   - "car in front"      -> "vehicle in front"
   - "intersection"      -> "intersection / junction" (use junction-style wording)
   - "stop sign / stop"  -> "duty to stop"
   - "pedestrian crossing" -> "crosswalk"
   - "biker / cyclist"   -> "bicyclist"
   - "low beams"         -> "low-beam headlights"
   - "drink driving"     -> "driving under the influence (DUI)"
   - "blind turn"        -> "dangerous bend in the road"
   Do NOT invent terms that contradict the glossary.

2. FORMAL, SLIGHTLY LONGER: The real exam phrasing is bureaucratic and \
   reads like a translation from Danish legal text. Lengthen the question, \
   add hedging like "in this situation", "according to the legal provisions", \
   "what statutory requirements apply", "how must you proceed". Avoid \
   contractions ("don't" -> "do not").

3. ANSWERS IN FIRST PERSON: Every answer choice — correct AND incorrect — \
   must start with "I ..." mirroring the Danish original "Jeg ...". \
   Never use imperative form ("Brake and wait" is wrong; \
   "I brake and remain behind the vehicle in front" is right).

4. MEANING IS LOCKED: Do not change which answer is right vs. wrong. Do not \
   add new facts. Do not invent road conditions that were not in the original. \
   The reworded answer must be logically equivalent to the original answer.

5. NO MARKDOWN, NO QUOTES around the output text. Plain sentences only.

You will receive ONE question with its answers, and you MUST return STRICT \
JSON in this exact shape:

{
  "question": "<reworded question text>",
  "answers": [
    {"id": <int>, "text": "<reworded answer text>"},
    ...
  ]
}

The "id" values MUST match the input ids. The number of answers MUST match. \
Output the JSON object and nothing else."""


def load_glossary() -> str:
    text = GLOSSARY_PATH.read_text(encoding="utf-8")
    return text.strip()


def build_user_prompt(glossary: str, q_text: str, answers: list[dict]) -> str:
    answer_lines = "\n".join(
        f'  - id={a["id"]} (correct={a["is_correct"]}): {a["text"]}'
        for a in answers
    )
    return f"""GLOSSARY (Danish -> Official English exam term):
{glossary}

ORIGINAL QUESTION:
{q_text}

ORIGINAL ANSWERS:
{answer_lines}

Rewrite the question and every answer following all the rules above. \
Return only the JSON object."""


def call_claude(client, model: str, glossary: str, q_text: str, answers: list[dict]) -> dict | None:
    user_msg = build_user_prompt(glossary, q_text, answers)
    last_err: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            resp = client.messages.create(
                model=model,
                max_tokens=2000,
                system=SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_msg}],
            )
            raw = "".join(
                block.text for block in resp.content
                if getattr(block, "type", None) == "text"
            ).strip()
            if raw.startswith("```"):
                raw = raw.strip("`")
                if raw.lower().startswith("json"):
                    raw = raw[4:].strip()
            data = json.loads(raw)
            if not isinstance(data, dict) or "question" not in data or "answers" not in data:
                raise ValueError(f"bad shape: {raw[:200]}")
            if len(data["answers"]) != len(answers):
                raise ValueError(f"answer count mismatch: got {len(data['answers'])} expected {len(answers)}")
            ids_in = {a["id"] for a in answers}
            ids_out = {a["id"] for a in data["answers"]}
            if ids_in != ids_out:
                raise ValueError(f"answer ids mismatch: in={ids_in} out={ids_out}")
            return data
        except Exception as e:
            last_err = e
            wait = RETRY_BACKOFF_BASE ** attempt
            print(f"   ! retry {attempt + 1}/{MAX_RETRIES} after {wait:.1f}s ({e})")
            time.sleep(wait)
    print(f"   X giving up on question (last error: {last_err})")
    return None


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser()
    p.add_argument("--test", type=int, action="append", default=[],
                   help="Test id (1..14). Repeat for multiple.")
    p.add_argument("--all", action="store_true", help="Run on every test.")
    p.add_argument("--skip-existing", action="store_true",
                   help="Skip questions that already have exam_style_text.")
    p.add_argument("--dry-run", action="store_true",
                   help="No API calls, no DB writes — just count work.")
    p.add_argument("--limit", type=int, default=0,
                   help="Max number of questions to process this run.")
    p.add_argument("--model", default=DEFAULT_MODEL, help="Claude model id.")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    if not args.all and not args.test:
        print("ERROR: pass --test 1 (repeatable) or --all")
        sys.exit(2)

    db = SessionLocal()
    try:
        q = db.query(models.Question)
        if not args.all:
            q = q.filter(models.Question.test_id.in_(args.test))
        questions = q.order_by(models.Question.test_id, models.Question.question_index).all()

        if args.skip_existing:
            questions = [x for x in questions if not (x.exam_style_text or "").strip()]
        if args.limit:
            questions = questions[: args.limit]

        print(f"[exam_style] {len(questions)} questions to process "
              f"(skip_existing={args.skip_existing}, dry_run={args.dry_run}, model={args.model})")
        if not questions:
            print("[exam_style] Nothing to do.")
            return

        glossary = load_glossary()

        client = None
        if not args.dry_run:
            try:
                from anthropic import Anthropic
            except ImportError:
                print("ERROR: pip install anthropic")
                sys.exit(2)
            api_key = os.environ.get("ANTHROPIC_API_KEY")
            if not api_key:
                print("ERROR: set ANTHROPIC_API_KEY in env")
                sys.exit(2)
            client = Anthropic(api_key=api_key)

        ok = 0
        failed = 0
        since_commit = 0
        start_ts = time.time()

        for idx, question in enumerate(questions, 1):
            answers = sorted(question.answers, key=lambda a: a.id)
            answer_payload = [
                {"id": a.id, "is_correct": bool(a.is_correct), "text": a.text}
                for a in answers
            ]

            print(f"\n[{idx}/{len(questions)}] test={question.test_id} q_idx={question.question_index} qid={question.id}")
            print(f"  ORIG Q: {question.question_text[:120]}")

            if args.dry_run:
                ok += 1
                continue

            data = call_claude(client, args.model, glossary, question.question_text, answer_payload)
            if not data:
                failed += 1
                continue

            new_q = data["question"].strip()
            question.exam_style_text = new_q
            print(f"  NEW  Q: {new_q[:120]}")

            answers_by_id = {a.id: a for a in answers}
            for new_a in data["answers"]:
                tgt = answers_by_id.get(new_a["id"])
                if not tgt:
                    continue
                new_text = (new_a.get("text") or "").strip()
                if not new_text:
                    continue
                tgt.exam_style_text = new_text
                marker = "OK" if tgt.is_correct else "  "
                print(f"   {marker} A{tgt.id}: {new_text[:110]}")

            ok += 1
            since_commit += 1
            if since_commit >= BATCH_COMMIT_EVERY:
                db.commit()
                since_commit = 0
                elapsed = time.time() - start_ts
                rate = idx / elapsed if elapsed > 0 else 0
                eta = (len(questions) - idx) / rate if rate > 0 else 0
                print(f"  -- committed batch. {idx}/{len(questions)} ok={ok} fail={failed} rate={rate:.2f}/s eta={eta:.0f}s")

            time.sleep(SLEEP_BETWEEN)

        db.commit()
        print(f"\n[exam_style] DONE. ok={ok} failed={failed} of {len(questions)}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
