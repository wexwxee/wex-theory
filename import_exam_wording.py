"""
Load manual exam-style wording from data/exam_wording/*.json into the database.

Examples:
  py import_exam_wording.py --test 1
  py import_exam_wording.py --all
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import models
from database import SessionLocal, engine
from sqlalchemy import inspect as sql_inspect, text as sql_text
from sqlalchemy.orm import selectinload


models.Base.metadata.create_all(bind=engine)

BASE_DIR = Path(__file__).resolve().parent
EXAM_WORDING_DIR = BASE_DIR / "data" / "exam_wording"


def ensure_exam_wording_columns() -> None:
    db = SessionLocal()
    try:
        inspector = sql_inspect(engine)

        question_columns = {col["name"] for col in inspector.get_columns("questions")}
        if "exam_style_text" not in question_columns:
            db.execute(sql_text("ALTER TABLE questions ADD COLUMN exam_style_text TEXT"))
            db.commit()

        answer_columns = {col["name"] for col in inspector.get_columns("answers")}
        if "exam_style_text" not in answer_columns:
            db.execute(sql_text("ALTER TABLE answers ADD COLUMN exam_style_text TEXT"))
            db.commit()

        attempt_columns = {col["name"] for col in inspector.get_columns("user_test_attempts")}
        if "wording_mode" not in attempt_columns:
            db.execute(sql_text("ALTER TABLE user_test_attempts ADD COLUMN wording_mode VARCHAR DEFAULT 'original'"))
            db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def ordered_answers(question: models.Question):
    return sorted(question.answers, key=lambda answer: answer.id)


def load_exam_wording_file(path: Path) -> dict:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def apply_question_wording(question: models.Question, payload: dict) -> tuple[bool, int]:
    updated_question = False
    updated_answers = 0

    if "question_text" in payload:
        text = str(payload.get("question_text") or "").strip()
        question.exam_style_text = text or None
        updated_question = True

    answers_payload = payload.get("answers") or {}
    if not isinstance(answers_payload, dict):
        return updated_question, updated_answers

    answers = ordered_answers(question)
    for key, value in answers_payload.items():
        try:
            answer_index = int(key)
        except (TypeError, ValueError):
            continue
        if answer_index < 1 or answer_index > len(answers):
            continue
        answer = answers[answer_index - 1]
        answer.exam_style_text = str(value or "").strip() or None
        updated_answers += 1

    return updated_question, updated_answers


def import_exam_wording_for_test(test_id: int, *, data_dir: Path = EXAM_WORDING_DIR) -> None:
    file_path = data_dir / f"test_{test_id:02d}.json"
    if not file_path.exists():
        raise FileNotFoundError(f"Missing file: {file_path}")

    payload = load_exam_wording_file(file_path)
    payload_test_id = int(payload.get("test_id") or 0)
    if payload_test_id != test_id:
        raise ValueError(f"{file_path.name} has test_id={payload_test_id}, expected {test_id}")

    db = SessionLocal()
    try:
        questions = (
            db.query(models.Question)
            .options(selectinload(models.Question.answers))
            .filter(models.Question.test_id == test_id)
            .order_by(models.Question.question_index)
            .all()
        )
        q_map = {q.question_index: q for q in questions}

        updated_questions = 0
        updated_answers = 0
        missing_questions: list[int] = []

        for q_payload in payload.get("questions", []):
            try:
                question_index = int(q_payload.get("question_index"))
            except (TypeError, ValueError):
                continue
            question = q_map.get(question_index)
            if not question:
                missing_questions.append(question_index)
                continue
            q_updated, a_updated = apply_question_wording(question, q_payload)
            if q_updated:
                updated_questions += 1
            updated_answers += a_updated

        db.commit()

        print(f"[IMPORT] Test {test_id}: updated {updated_questions} question texts, {updated_answers} answer texts")
        if missing_questions:
            print(f"[IMPORT] Missing question_index values in DB: {sorted(set(missing_questions))}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> None:
    parser = argparse.ArgumentParser(description="Import manual exam-style wording into the database.")
    parser.add_argument("--test", type=int, help="Import one test, e.g. --test 1")
    parser.add_argument("--all", action="store_true", help="Import all JSON files from data/exam_wording")
    args = parser.parse_args()

    if not args.test and not args.all:
        parser.error("Use --test <id> or --all")

    ensure_exam_wording_columns()

    if args.all:
        for test_id in range(1, 14):
            file_path = EXAM_WORDING_DIR / f"test_{test_id:02d}.json"
            if file_path.exists():
                import_exam_wording_for_test(test_id)
        return

    import_exam_wording_for_test(args.test)


if __name__ == "__main__":
    main()
