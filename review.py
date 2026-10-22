"""Daily review derived from test mistakes, with separately saved practice.

New test mistakes restart the schedule. Successful practice returns after
1/3/7/21 days; a fifth success completes it. Test history is never rewritten.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy.orm import Session, selectinload

import models
import sign_tests
import signs as signs_catalogue

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


def missed_question_ids(db: Session, user_id: int, now=None) -> list[int]:
    """Question ids whose latest answer was wrong, weakest first."""
    latest: dict[int, bool] = {}
    misses: dict[int, int] = defaultdict(int)
    last_seen: dict[int, int] = {}

    for answer in _history(db, user_id):
        latest[answer.question_id] = bool(answer.is_correct)
        last_seen[answer.question_id] = answer.id
        if not answer.is_correct:
            misses[answer.question_id] += 1

    now = now or datetime.utcnow()
    progress = {row.question_id: row for row in db.query(models.ReviewProgress).filter_by(user_id=user_id).all()}
    pending = []
    for question_id, was_right in latest.items():
        if was_right:
            continue
        row = progress.get(question_id)
        if row and row.source_answer_id == last_seen[question_id]:
            if row.due_at is None or row.due_at > now:
                continue
        pending.append(question_id)
    pending.sort(key=lambda question_id: (-misses[question_id], last_seen[question_id]))
    return pending


def next_review_at(db: Session, user_id: int):
    latest = {answer.question_id: answer for answer in _history(db, user_id)}
    dates = [row.due_at for row in db.query(models.ReviewProgress).filter_by(user_id=user_id).all()
             if row.due_at and row.question_id in latest
             and not latest[row.question_id].is_correct
             and latest[row.question_id].id == row.source_answer_id]
    return min(dates).isoformat() + "Z" if dates else None


def record_answer(db: Session, user_id: int, question_id: int, selected_ids: list[int], request_id: str, now=None):
    """Grade on the server and schedule practice, without modifying test history."""
    now = now or datetime.utcnow()
    # Serialize changes for one learner, including concurrent first submissions.
    db.query(models.User).filter_by(id=user_id).with_for_update().one()
    source = (db.query(models.UserAnswer).join(models.UserTestAttempt)
              .filter(models.UserTestAttempt.user_id == user_id, models.UserAnswer.question_id == question_id)
              .order_by(models.UserAnswer.id.desc()).first())
    if not source or source.is_correct:
        raise ValueError("This question is not in your review list")
    row = db.query(models.ReviewProgress).filter_by(user_id=user_id, question_id=question_id).first()
    if row and row.source_answer_id == source.id and row.last_request_id == request_id:
        return {"correct": row.last_correct, "due_at": row.due_at.isoformat() + "Z" if row.due_at else None}
    if row and row.source_answer_id == source.id and (row.due_at is None or row.due_at > now):
        raise ValueError("This question has already been reviewed. Reload to continue.")
    answers = db.query(models.Answer).filter_by(question_id=question_id).all()
    if not selected_ids or not set(selected_ids).issubset({answer.id for answer in answers}):
        raise ValueError("Choose answers from this question")
    correct = set(selected_ids) == {answer.id for answer in answers if answer.is_correct}
    if row is None:
        row = models.ReviewProgress(user_id=user_id, question_id=question_id, source_answer_id=source.id, streak=0)
        db.add(row)
    if row.source_answer_id != source.id:
        row.streak = 0
    row.source_answer_id = source.id
    row.streak = row.streak + 1 if correct else 0
    intervals = (1, 3, 7, 21)
    row.due_at = (None if row.streak > len(intervals) else
                  now + timedelta(days=intervals[max(0, row.streak - 1)]))
    row.last_request_id = request_id
    row.last_correct = correct
    db.commit()
    return {"correct": correct, "due_at": row.due_at.isoformat() + "Z" if row.due_at else None}


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
        "test_label": (f"Road signs test {sign_tests.number(question.test_id)}"
                       if sign_tests.is_sign_test(question.test_id) else f"Test {question.test_id}"),
        "question_index": question.question_index,
        "misses": misses,
        "question_text": text_of(question, "question_text"),
        "question_text_ru": question.question_text_ru or "",
        "explanation": question.explanation or "",
        "explanation_ru": question.explanation_ru or "",
        "image_path": question.image_path or "",
        "signs": [
            {
                "code": sign["code"],
                "name": sign["name_en"],
                "name_ru": sign.get("name_ru", ""),
                "image": sign["image"],
            }
            for sign in signs_catalogue.signs_for_reviewed_scene(question.image_path)
        ],
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
