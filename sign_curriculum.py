"""Source-linked study notes and application questions, separate from generated signs."""
import json
import sign_lessons
from copy import deepcopy
from functools import lru_cache
from pathlib import Path

@lru_cache(maxsize=1)
def _data():
    return json.loads((Path(__file__).resolve().parent / "data/signs/curriculum.json").read_text(encoding="utf-8"))

def catalogue():
    return deepcopy(_data())

def revision(identifier=None):
    situations = _situations()['revisions']
    if identifier in situations:
        return situations[identifier]
    return _data().get('lesson_revisions', {}).get(identifier, _data()['revision'])


@lru_cache(maxsize=1)
def _situations():
    path = Path(__file__).resolve().parent / "data/signs/situations.json"
    if not path.exists():
        return {"revisions": {}, "situations": []}
    data = json.loads(path.read_text(encoding="utf-8"))
    return {"revisions": data.get("revisions", {}), "situations": data.get("situations", [])}


def _situation_question(item):
    """An exam-style situation in the lesson-check shape: the answer is the set of statements the
    learner marks true, stored as a bit mask, so `correct` is the mask of the true statements."""
    question = deepcopy(item)
    question.update(kind="statements", code=item["codes"][0], lessons=[item["lesson"]],
                    correct=sum(1 << i for i, statement in enumerate(item["statements"]) if statement["correct"]),
                    optionCount=1 << len(item["statements"]))
    return question


def situations_for(identifier):
    return [_situation_question(item) for item in _situations()["situations"] if item["lesson"] == identifier]


def note_for(code):
    return deepcopy(_data()["notes"].get(code, {}))

def sources_for(code):
    ids = _data()["notes"].get(code, {}).get("source_ids", [])
    return [deepcopy(source) for source in _data()["sources"] if source["id"] in ids]


def for_lesson(identifier):
    data = _data()
    lesson = sign_lessons.by_id(identifier)
    used = {source for code in lesson["codes"] for source in data["notes"].get(code, {}).get("source_ids", [])} if lesson else set()
    material = {key: [deepcopy(item) for item in data[key] if identifier in item['lessons']]
                for key in ('comparisons', 'photos', 'questions')}
    material['questions'] = situations_for(identifier) or material['questions']
    used.update(source for key in ('comparisons', 'questions') for item in material[key] for source in item.get('source_ids', []))
    checked = data.get('lesson_checked', {}).get(identifier, data.get('checked', '2026-10-16'))
    return {'revision': revision(identifier), 'checked': checked,
            'sources': [deepcopy(source) for source in data['sources'] if source['id'] in used], **material}


def checks():
    return {lesson['id']: {'revision': revision(lesson['id']), 'questions': [
        {'id': question['id'], 'correct': question['correct'], 'optionCount': question.get('optionCount') or len(question['options'])}
        for question in for_lesson(lesson['id'])['questions']]}
        for lesson in sign_lessons.all_lessons()}

def photos_for(code):
    return [deepcopy(photo) for photo in _data()["photos"] if photo["code"] == code]


def comparisons_for(code):
    """Checked comparisons that include this sign, for telling it apart from look-alikes."""
    return [deepcopy(item) for item in _data()["comparisons"] if code in item["codes"]]


ROOT = Path(__file__).resolve().parent


@lru_cache(maxsize=1)
def _scene_examples():
    path = ROOT / "data/signs/scene_examples.json"
    if not path.exists():
        return {}
    examples = json.loads(path.read_text(encoding="utf-8")).get("examples", {})
    return {code: item for code, item in examples.items() if (ROOT / item["image"].lstrip("/")).is_file()}


def scene_example(code):
    """An illustrated example scene: an AI-made street with the official sign drawing placed in it.
    It shows where such a sign stands; it is not a test photograph."""
    item = _scene_examples().get(code)
    return deepcopy(item) if item else None
