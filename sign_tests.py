"""Road-sign tests: four practice tests of 25 exam-style sign situations.

They live in the ordinary test tables (ids 101-104), so the test room, scoring, results, mistake
review and history work for them exactly as for Theory Tests 1-13. The questions are built from
data/signs/situations.json (the lesson situations) and the test-only situations in
data/signs/sign_tests.json; each test's order is fixed in that file.
"""
import json
from functools import lru_cache
from pathlib import Path

import models

ROOT = Path(__file__).resolve().parent
QUESTIONS_PER_TEST = 25


@lru_cache(maxsize=1)
def _data():
    tests = json.loads((ROOT / "data/signs/sign_tests.json").read_text(encoding="utf-8"))
    lessons = json.loads((ROOT / "data/signs/situations.json").read_text(encoding="utf-8"))["situations"]
    by_id = {item["id"]: item for item in [*lessons, *tests["extra_situations"]]}
    return tests["tests"], by_id


def tests():
    return [dict(test) for test in _data()[0]]


def test_ids():
    return {test["id"] for test in _data()[0]}


def is_sign_test(test_id) -> bool:
    return test_id in test_ids()


def number(test_id):
    return next((test["number"] for test in _data()[0] if test["id"] == test_id), None)


def image_path(situation):
    """The test room shows /test-images/<image_path>. Lesson pictures are copied to test-images/Signs."""
    image = situation["image"]
    if image.startswith("/test-images/"):
        return image[len("/test-images/"):]
    return "Signs/" + image.rsplit("/", 1)[-1]


def explanation(situation, lang):
    """One paragraph for the results review: the overall reason, then each statement's verdict."""
    verdict = {"en": ("true", "false"), "ru": ("верно", "неверно")}[lang]
    parts = [situation["explanation"][lang]]
    for statement in situation["statements"]:
        word = verdict[0] if statement["correct"] else verdict[1]
        parts.append(f"«{statement['text'][lang].rstrip('.')}» — {word}. {statement['why'][lang]}")
    return " ".join(parts)


def questions(test_id):
    test = next(test for test in _data()[0] if test["id"] == test_id)
    by_id = _data()[1]
    return [by_id[situation_id] for situation_id in test["situations"]]


def sync(db) -> None:
    """Create or update the four sign tests."""
    for test in _data()[0]:
        write_test(db, test["id"], test["title"], f"{QUESTIONS_PER_TEST} exam-style road-sign situations.",
                   questions(test["id"]))
    db.commit()


def write_test(db, test_id, title, description, situations, explain=explanation) -> None:
    """Store one test of situations in the ordinary test tables. Question and answer rows are updated
    in place, so the ids that earlier attempts point to stay the same. The caller commits."""
    row = db.query(models.Test).filter(models.Test.id == test_id).first()
    if not row:
        row = models.Test(id=test_id, title=title, description=description)
        db.add(row)
        db.flush()
    row.title, row.description = title, description
    existing = {question.question_index: question for question in
                db.query(models.Question).filter(models.Question.test_id == test_id).all()}
    for index, situation in enumerate(situations, start=1):
        question = existing.pop(index, None)
        if question is None:
            question = models.Question(test_id=test_id, question_index=index, question_text="")
            db.add(question)
            db.flush()
        question.question_text = situation["prompt"]["en"]
        question.question_text_ru = situation["prompt"]["ru"]
        question.explanation = explain(situation, "en")
        question.explanation_ru = explain(situation, "ru")
        question.image_path = image_path(situation)
        question.exam_style_text = None
        answers = sorted(question.answers, key=lambda answer: answer.id)
        for position, statement in enumerate(situation["statements"]):
            if position < len(answers):
                answer = answers[position]
            else:
                answer = models.Answer(question_id=question.id, text="")
                db.add(answer)
            answer.text = statement["text"]["en"]
            answer.text_ru = statement["text"]["ru"]
            answer.is_correct = statement["correct"]
            answer.exam_style_text = None
        for extra in answers[len(situation["statements"]):]:
            db.delete(extra)
    for stale in existing.values():
        db.delete(stale)
