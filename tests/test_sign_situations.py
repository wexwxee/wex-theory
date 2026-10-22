"""Exam-style sign situations: one picture, 2-4 true/false statements, answered as a set."""
import json
from pathlib import Path

import sign_curriculum
import sign_lessons
import signs

ROOT = Path(__file__).resolve().parents[1]
DATA = json.loads((ROOT / 'data/signs/situations.json').read_text(encoding='utf-8'))


def test_every_situation_is_complete_bilingual_and_uses_checked_signs():
    known_sources = {source['id'] for source in sign_curriculum.catalogue()['sources']}
    ids = [item['id'] for item in DATA['situations']]
    assert len(ids) == len(set(ids))
    for item in DATA['situations']:
        lesson = sign_lessons.by_id(item['lesson'])
        assert lesson and item['lesson'] in DATA['revisions'], item['id']
        assert item['codes'] and all(signs.by_code(code) and signs.by_code(code)['teaching'] for code in item['codes'])
        assert item['codes'][0] in lesson['codes'], item['id']
        assert 2 <= len(item['statements']) <= 4 and any(s['correct'] for s in item['statements']), item['id']
        for field in ('prompt', 'alt', 'explanation'):
            assert all(item[field][lang].strip() for lang in ('en', 'ru')), (item['id'], field)
        for statement in item['statements']:
            assert type(statement['correct']) is bool
            assert all(statement['text'][lang].strip() and statement['why'][lang].strip() for lang in ('en', 'ru'))
        assert item['source_ids'] and set(item['source_ids']) <= known_sources and item['basis']
        image = ROOT / item['image'].lstrip('/')
        checked_photos = {q['image'] for q in sign_curriculum.catalogue()['questions'] if q.get('image')}
        assert image.is_file() and (image.parent == ROOT / 'static/signs/situations' or item['image'] in checked_photos), item['id']


def test_situations_replace_the_lesson_questions_with_a_new_revision_and_bit_mask_answers():
    for lesson_id, lesson_revision in DATA['revisions'].items():
        questions = sign_curriculum.for_lesson(lesson_id)['questions']
        own = [item for item in DATA['situations'] if item['lesson'] == lesson_id]
        assert [q['id'] for q in questions] == [item['id'] for item in own]
        assert sign_curriculum.revision(lesson_id) == lesson_revision != sign_curriculum.revision()
        for question, item in zip(questions, own):
            assert question['kind'] == 'statements' and question['code'] == item['codes'][0]
            assert question['optionCount'] == 1 << len(item['statements'])
            assert question['correct'] == sum(1 << i for i, s in enumerate(item['statements']) if s['correct'])
    assert set(DATA['revisions']) == {lesson['id'] for lesson in sign_lessons.all_lessons()}


def test_lesson_page_carries_the_situations_and_the_result_api_counts_them():
    import os
    os.environ.setdefault("SECRET_KEY", "sign-situation-tests-secret-key-with-enough-entropy")
    from fastapi.testclient import TestClient
    import main
    client = TestClient(main.app)
    page = client.get('/signs/lesson/parking')
    assert page.status_code == 200
    assert '/static/signs/situations/04-1.webp' in page.text and '"kind": "statements"' in page.text
    assert sign_curriculum.checks()['parking']['questions'][0]['optionCount'] == 8
