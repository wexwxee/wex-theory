"""Topic tests: WEXTheory's own practice tests, one section of Færdselsstyrelsen's category B
teaching plan at a time (ids 201 and up).

They live in the ordinary test tables like the road-sign tests, so the test room, scoring, results,
mistake review and history work unchanged. Questions, statements and the teaching-plan point behind
every statement are in data/topic_tests.json.
"""
import json
import re
from functools import lru_cache
from pathlib import Path

import sign_tests

ROOT = Path(__file__).resolve().parent
QUESTIONS_PER_TEST = 25


@lru_cache(maxsize=1)
def _data():
    return json.loads((ROOT / "data/topic_tests.json").read_text(encoding="utf-8"))


def tests():
    return [dict(test) for test in _data()["tests"]]


def test_ids():
    return {test["id"] for test in _data()["tests"]}


def is_topic_test(test_id) -> bool:
    return test_id in test_ids()


def number(test_id):
    return next((test["number"] for test in _data()["tests"] if test["id"] == test_id), None)


def questions(test_id):
    return next(test for test in _data()["tests"] if test["id"] == test_id)["questions"]


def sources(question):
    """The teaching-plan points behind a question's statements, each named once, in order:
    sources "1.2.3 (4)" and "1.2.3 (22)" become "1.2.3 (4), (22)"."""
    points = {}
    for statement in question["statements"]:
        for part in statement["source"].split(";"):
            point, items = part.strip().split(" ", 1)
            numbers = points.setdefault(point, [])
            numbers.extend(n for n in re.findall(r"\d+", items) if n not in numbers)
    return [f"{point} " + ", ".join(f"({n})" for n in sorted(numbers, key=int)) for point, numbers in points.items()]


def explanation(question, lang):
    """The road-sign explanation (overall reason, then each statement's verdict) plus where it comes from."""
    label = {"en": "Source", "ru": "Источник"}[lang]
    return (f"{sign_tests.explanation(question, lang)} "
            f"{label}: {_data()['source'][lang]}, {'; '.join(sources(question))}.")


def sync(db) -> None:
    """Create or update every topic test."""
    for test in _data()["tests"]:
        sign_tests.write_test(db, test["id"], test["title"], test["description"], test["questions"], explanation)
    db.commit()
