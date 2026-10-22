"""Prevent text keywords or database IDs from fabricating signs in a scene."""
from types import SimpleNamespace
import signs
import review

def test_reviewed_expressway_ending_has_only_the_visible_sign():
    assert [s['code'] for s in signs.signs_for_reviewed_scene('Test01/screenshots/q02.jpg')] == ['E45']
    assert [s['code'] for s in signs.signs_for_reviewed_scene('/test-images/Test01/screenshots/q02.jpg?v=2')] == ['E45']

def test_unreviewed_image_does_not_inherit_phrase_guesses():
    question=SimpleNamespace(id=2,test_id=1,question_index=2,question_text='Maximum permitted speed outside built-up area',question_text_ru='',explanation='End of expressway',explanation_ru='',image_path='Test01/screenshots/not-reviewed.jpg',answers=[])
    assert review.as_payload(question)['signs'] == []

def test_image_link_does_not_depend_on_database_question_id():
    question=SimpleNamespace(id=9123,test_id=1,question_index=2,question_text='Question',question_text_ru='',explanation='',explanation_ru='',image_path='Test01/screenshots/q02.jpg',answers=[])
    assert [s['code'] for s in review.as_payload(question)['signs']] == ['E45']

def test_existing_reviewed_scene_preserves_both_visible_signs():
    codes={s['code'] for s in signs.signs_for_reviewed_scene('Test02/screenshots/q03.jpg')}
    assert {'C61','E17'} <= codes
