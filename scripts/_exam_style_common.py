"""
Shared helpers for applying exam-style rewrites across all 13 theory tests.

Each per-test script (`apply_testN_exam_style.py`) imports `apply_rewrites`
and hands it a dict keyed by question id. The helper handles validation,
DB writes, idempotency and a short stdout summary.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import models  # noqa: E402
from database import SessionLocal  # noqa: E402


def apply_rewrites(test_id: int, rewrites: dict[int, dict]) -> None:
    """
    rewrites[qid] = {
        "q": "<new question text>",
        "answers": { answer_id: "<new answer text>", ... }
    }
    """
    db = SessionLocal()
    try:
        questions = (
            db.query(models.Question)
            .filter(models.Question.test_id == test_id)
            .order_by(models.Question.question_index)
            .all()
        )
        ids_in_db = {q.id for q in questions}
        ids_in_data = set(rewrites.keys())

        missing_in_data = ids_in_db - ids_in_data
        extra_in_data = ids_in_data - ids_in_db
        if missing_in_data or extra_in_data:
            print(f"[test {test_id}] MISMATCH")
            if missing_in_data:
                print(f"  db has qids without rewrite: {sorted(missing_in_data)}")
            if extra_in_data:
                print(f"  rewrite has qids not in db: {sorted(extra_in_data)}")
            sys.exit(2)

        updated_q = 0
        updated_a = 0
        for q in questions:
            data = rewrites[q.id]
            new_q = str(data.get("q", "")).strip()
            if not new_q:
                print(f"[test {test_id}] qid={q.id} has empty question text")
                sys.exit(2)
            q.exam_style_text = new_q
            updated_q += 1

            answers_by_id = {a.id: a for a in q.answers}
            rewrite_answers: dict[int, str] = data.get("answers", {})

            ans_missing = set(answers_by_id.keys()) - set(rewrite_answers.keys())
            ans_extra = set(rewrite_answers.keys()) - set(answers_by_id.keys())
            if ans_missing or ans_extra:
                print(f"[test {test_id}] qid={q.id} answer id mismatch")
                if ans_missing:
                    print(f"  db has answer ids without rewrite: {sorted(ans_missing)}")
                if ans_extra:
                    print(f"  rewrite has answer ids not in db: {sorted(ans_extra)}")
                sys.exit(2)

            for aid, new_text in rewrite_answers.items():
                clean = str(new_text).strip()
                if not clean:
                    print(f"[test {test_id}] qid={q.id} aid={aid} empty answer text")
                    sys.exit(2)
                answers_by_id[aid].exam_style_text = clean
                updated_a += 1

        db.commit()
        print(f"[test {test_id}] ok: {updated_q} questions, {updated_a} answers updated")
    finally:
        db.close()
