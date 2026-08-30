"""The questions a learner still gets wrong.

Everything here is derived from answers already stored: no new tables, no
migration. A question needs review when the learner's most recent answer to it
was wrong, and it leaves the list by itself once they answer it correctly in a
real test - which is exactly the behaviour a learner expects.

Ordering puts the questions missed most often first, then the ones missed
longest ago, so a short daily set hits the weakest material.
"""

from __future__ import annotations

from collections import defaultdict
from typing import Optional

from sqlalchemy.orm import Session, selectinload

import models

DEFAULT_LIMIT = 10
MAX_LIMIT = 25


def _history(db: Session, user_id: int) -> list[models.UserAnswer]:
    return (
        db.query(models.UserAnswer)
        .join(models.UserTestAttempt, models.UserAnswer.attempt_id == models.UserTestAttempt.id)
        .filter(models.UserTestAttempt.user_id == user_id)
        .order_by(models.UserAnswer.id)
        .all()
    )


def miss_counts(db: Session, user_id: int) -> dict[int, int]:
    """How many times each still-pending question has been answered wrong."""
    latest: dict[int, bool] = {}
    misses: dict[int, int] = defaultdict(int)

    for answer in _history(db, user_id):
        latest[answer.question_id] = bool(answer.is_correct)
        if not answer.is_correct:
            misses[answer.question_id] += 1

    return {
        question_id: misses[question_id]
        for question_id, was_right in latest.items()
        if not was_right
    }


def missed_question_ids(db: Session, user_id: int) -> list[int]:
    """Question ids whose latest answer was wrong, weakest first."""
    latest: dict[int, bool] = {}
    misses: dict[int, int] = defaultdict(int)
    last_seen: dict[int, int] = {}

    for answer in _history(db, user_id):
        latest[answer.question_id] = bool(answer.is_correct)
        last_seen[answer.question_id] = answer.id
        if not answer.is_correct:
            misses[answer.question_id] += 1

    pending = [question_id for question_id, was_right in latest.items() if not was_right]
    pending.sort(key=lambda question_id: (-misses[question_id], last_seen[question_id]))
    return pending


def attempts_taken(db: Session, user_id: int) -> int:
    """How many test attempts the pending list was built from."""
    return (
        db.query(models.UserTestAttempt)
        .filter(models.UserTestAttempt.user_id == user_id)
        .count()
    )


def review_count(db: Session, user_id: int) -> int:
    return len(missed_question_ids(db, user_id))


def review_questions(db: Session, user_id: int, limit: int = DEFAULT_LIMIT) -> list[models.Question]:
    limit = max(1, min(limit, MAX_LIMIT))
    ids = missed_question_ids(db, user_id)[:limit]
    if not ids:
        return []
    questions = (
        db.query(models.Question)
        .options(selectinload(models.Question.answers))
        .filter(models.Question.id.in_(ids))
        .all()
    )
    order = {question_id: position for position, question_id in enumerate(ids)}
    questions.sort(key=lambda question: order.get(question.id, 0))
    return questions


def as_payload(question: models.Question, wording_mode: str = "original", misses: int = 0) -> dict:
    """One question in the shape the review page needs."""
    use_exam = wording_mode == "exam"

    def text_of(item, field: str) -> str:
        exam_text = getattr(item, "exam_style_text", None)
        if use_exam and exam_text:
            return exam_text
        return getattr(item, field) or ""

    return {
        "id": question.id,
        "test_id": question.test_id,
        "question_index": question.question_index,
        "misses": misses,
        "question_text": text_of(question, "question_text"),
        "question_text_ru": question.question_text_ru or "",
        "explanation": question.explanation or "",
        "explanation_ru": question.explanation_ru or "",
        "image_path": question.image_path or "",
        "answers": [
            {
                "id": answer.id,
                "text": text_of(answer, "text"),
                "text_ru": answer.text_ru or "",
                "is_correct": bool(answer.is_correct),
            }
            for answer in sorted(question.answers, key=lambda item: item.id)
        ],
    }
