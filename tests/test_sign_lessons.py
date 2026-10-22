"""Check that public lesson routes never offer missing or duplicate signs."""
import sign_lessons
import signs

def test_practice_sets_are_small_and_resolve_to_real_catalogue_entries():
    lessons = sign_lessons.all_lessons()
    assert len(lessons) == 18
    known = {sign['code'] for sign in signs.all_signs()}
    assert len({lesson['id'] for lesson in lessons}) == len(lessons)
    for lesson in lessons:
        assert 4 <= len(lesson['codes']) <= 12
        assert len(set(lesson['codes'])) == len(lesson['codes'])
        assert set(lesson['codes']) <= known
        assert lesson['title'] and lesson['title_ru']
        assert lesson['focus'] and lesson['focus_ru']

def test_lookup_and_returned_collections_do_not_mutate_shared_lesson_data():
    first = sign_lessons.by_id('priority')
    first['codes'].clear()
    assert len(sign_lessons.by_id('priority')['codes']) == 7
    assert sign_lessons.by_id('unknown') is None
