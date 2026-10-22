"""Guard teaching data, public lesson assets and source attribution."""
import ast
from pathlib import Path
from urllib.parse import urlparse
import sign_curriculum
import sign_lessons
import signs

ROOT=Path(__file__).resolve().parents[1]

def test_every_lesson_sign_has_bilingual_action_and_mistake_with_sources():
    content=sign_curriculum.catalogue()
    known_sources={source['id'] for source in content['sources']}
    for lesson in sign_lessons.all_lessons():
        for code in lesson['codes']:
            sign=signs.by_code(code)
            assert sign and sign['teaching']
            for field in ('action','mistake'):
                assert all(sign['teaching'][field][lang].strip() for lang in ('en','ru'))
            assert set(sign['teaching']['source_ids'])<=known_sources
            assert sign['teaching']['checked'] and sign['teaching']['reference']

def test_questions_have_distinct_choices_valid_answers_and_known_signs():
    questions=sign_curriculum.catalogue()['questions']
    assert len(questions)>=18
    assert len({q['id'] for q in questions})==len(questions)
    for q in questions:
        assert signs.by_code(q['code'])
        assert type(q['correct']) is int and 0<=q['correct']<len(q['options'])
        for lang in ('en','ru'):
            choices=[choice[lang] for choice in q['options']]
            assert len(set(choices))==len(choices)
            assert q['prompt'][lang] and q['explanation'][lang]
    assert all(len(sign_curriculum.for_lesson(lesson['id'])['questions'])>=3 for lesson in sign_lessons.all_lessons())

def test_public_scene_examples_are_existing_free_sample_assets():
    assignments=ast.parse((ROOT/'main.py').read_text(encoding='utf-8-sig'))
    mapping=next(ast.literal_eval(node.value) for node in assignments.body if isinstance(node,ast.Assign)
                 and any(isinstance(target,ast.Name) and target.id=='FREE_SAMPLE_QUESTION_MAP' for target in node.targets))
    for photo in sign_curriculum.catalogue()['photos']:
        assert (photo['origin']['test'],photo['origin']['question']) in mapping
        relative=photo['image'].lstrip('/')
        resolved=(ROOT/relative).resolve()
        assert (ROOT/'test-images').resolve() in resolved.parents and resolved.is_file()
        assert signs.by_code(photo['code']) and photo['checked']

def test_sources_use_official_https_hosts():
    for source in sign_curriculum.catalogue()['sources']:
        url=urlparse(source['url'])
        assert url.scheme=='https' and url.hostname in {'www.retsinformation.dk','cdn.fstyr.dk','www.fstyr.dk','api.vejdirektoratet.dk'}

def test_teaching_data_is_copied_and_arrow_equivalents_are_explicit():
    content=sign_curriculum.catalogue();content['notes'].clear()
    assert sign_curriculum.note_for('C61')
    assert signs.by_code('D11.2')['teaching']['quiz_equivalence']==signs.by_code('D11.4')['teaching']['quiz_equivalence']
    assert signs.by_code('D11.3')['teaching']['quiz_equivalence']==signs.by_code('D11.5')['teaching']['quiz_equivalence']

def test_comparisons_only_reference_known_signs_and_lessons():
    lessons={lesson['id'] for lesson in sign_lessons.all_lessons()}
    for comparison in sign_curriculum.catalogue()['comparisons']:
        assert len(set(comparison['codes']))>=2
        assert all(signs.by_code(code) for code in comparison['codes'])
        assert set(comparison['lessons'])<=lessons


def test_reviewed_content_covers_all_mandatory_sign_variants_and_reports_real_count():
    reviewed = [sign for sign in signs.all_signs() if sign['teaching']]
    assert signs.catalogue_meta()['reviewed'] == len(reviewed) == 163
    assert all(sign['teaching'] for sign in signs.all_signs() if sign['group'] in {'A','B','C','D'})
    assert signs.by_code('D26.1')['name_en'] != signs.by_code('D26')['name_en']
    assert 'riders' in signs.by_code('D26.1')['name_en']
    assert 'Actual' in signs.by_code('C31')['name_en']
    assert 'water' in signs.by_code('A38')['meaning']
    assert 'formerly' not in signs.by_code('A44')['name_en']


def test_displayed_sources_are_the_ones_used_for_each_note_and_lesson():
    assert {source['id'] for source in sign_curriculum.sources_for('D26.1')} == {'markings'}
    assert {source['id'] for source in sign_curriculum.for_lesson('subpanels')['sources']} == {'markings'}
    assert {source['id'] for source in sign_curriculum.sources_for('C61')} == {'markings','curriculum'}
    assert sign_curriculum.sources_for('unknown') == []


def test_question_revisions_are_scoped_and_unedited_results_remain_compatible():
    # Since 21 Oct 2026 every lesson asks exam-style situations, so each has its own new revision.
    for lesson in sign_lessons.all_lessons():
        assert sign_curriculum.revision(lesson['id']) != sign_curriculum.revision()
        assert sign_curriculum.for_lesson(lesson['id'])['revision'] == sign_curriculum.revision(lesson['id'])
    for identifier, check in sign_curriculum.checks().items():
        questions = sign_curriculum.for_lesson(identifier)['questions']
        assert [q['id'] for q in check['questions']] == [q['id'] for q in questions]
        assert all(a['optionCount'] == (1 << len(b['statements']) if b.get('kind') == 'statements' else len(b['options']))
                   and a['correct'] == b['correct'] for a, b in zip(check['questions'], questions))


def test_lesson_navigation_covers_every_lesson_without_missing_topic_or_dead_end():
    lessons = sign_lessons.all_lessons()
    topics = {topic['id'] for topic in sign_lessons.TOPICS}
    assert all(lesson['topic'] in topics for lesson in lessons)
    assert [lesson['number'] for lesson in lessons] == list(range(1, len(lessons) + 1))
    assert sign_lessons.next_lesson(lessons[-1]['id']) is None
    assert sign_lessons.next_lesson('unknown') is None
    assert all(sign_lessons.next_lesson(current['id'])['id'] == following['id']
               for current, following in zip(lessons, lessons[1:]))


def test_all_application_material_has_known_sources_and_valid_lesson_assignments():
    content = sign_curriculum.catalogue()
    known_sources = {source['id'] for source in content['sources']}
    lessons = {lesson['id']: lesson for lesson in sign_lessons.all_lessons()}
    for kind in ('questions', 'comparisons'):
        assert len({item['id'] for item in content[kind]}) == len(content[kind])
        for item in content[kind]:
            assert item['source_ids'] and set(item['source_ids']) <= known_sources
            assert item['lessons'] and set(item['lessons']) <= lessons.keys()
            if kind == 'questions':
                assert all(item['code'] in lessons[identifier]['codes'] for identifier in item['lessons'])
    assert {source['id'] for source in sign_curriculum.sources_for('A36.1')} == {'actibump', 'traffic-act'}


def test_questions_with_scene_images_use_only_the_manually_checked_public_examples():
    photos = sign_curriculum.catalogue()['photos']
    approved = {photo['image'] for photo in photos if photo['checked'] and photo['origin']['free_sample']}
    for question in sign_curriculum.catalogue()['questions']:
        if question.get('image'):
            assert question['image'] in approved
            assert any(photo['image'] == question['image'] and photo['code'] == question['code'] for photo in photos)


def test_new_lessons_have_scoped_review_dates_and_leave_older_dates_intact():
    for identifier in ('lanes-merging', 'crossings-stops', 'road-speed', 'shared-areas'):
        material = sign_curriculum.for_lesson(identifier)
        assert material['checked'] == '2026-10-18'
        assert material['revision'] == '2026-10-21.situations1'
        assert len(material['questions']) == len(sign_curriculum.situations_for(identifier)) >= 4
    assert sign_curriculum.for_lesson('priority')['checked'] == '2026-10-17'
    assert sign_curriculum.revision('directions') == sign_curriculum.revision('priority') == '2026-10-21.situations1'


def test_lane_change_speed_and_exit_decisions_have_their_specific_legal_sources():
    for code, clause in [('E16.1', '18(4)'), ('E16.2', '18(2)'), ('E37', '14(5)'), ('E31', '29(2)')]:
        note = sign_curriculum.note_for(code)
        assert clause in note['reference']
        assert set(note['source_ids']) == {'markings', 'traffic-act'}
    assert 'below 15' in sign_curriculum.note_for('E49')['action']['en']
    assert 'give way' in sign_curriculum.note_for('E52')['action']['en'].lower()
    assert '2029' in sign_curriculum.note_for('E34')['meaning']['en']
    for code in ('E11.1', 'E11.4', 'E11.5', 'E11.6', 'E11.7', 'E11.8', 'E11.9'):
        assert 'Lane' in signs.by_code(code)['name_en']
        assert 'полос' in signs.by_code(code)['name_ru']


def test_all_reviewed_notes_override_both_languages_together_with_usable_references():
    for code, note in sign_curriculum.catalogue()['notes'].items():
        assert note['source_ids'] and note['reference'] and note['checked']
        for field in ('meaning', 'name'):
            if field in note:
                assert set(note[field]) == {'en', 'ru'}
                assert all(value.strip() for value in note[field].values())
        if note.get('name'):
            assert signs.by_code(code)['name_en'] == note['name']['en']
            assert signs.by_code(code)['name_ru'] == note['name']['ru']


def _webp_size(path):
    data = path.read_bytes()[:40]
    assert data[:4] == b'RIFF' and data[8:12] == b'WEBP'
    if data[12:16] == b'VP8X':
        return 1 + int.from_bytes(data[24:27], 'little'), 1 + int.from_bytes(data[27:30], 'little')
    if data[12:16] == b'VP8L':
        bits = int.from_bytes(data[21:25], 'little')
        return 1 + (bits & 0x3FFF), 1 + ((bits >> 14) & 0x3FFF)
    return int.from_bytes(data[26:28], 'little') & 0x3FFF, int.from_bytes(data[28:30], 'little') & 0x3FFF


def test_illustrated_examples_are_labelled_light_and_only_for_checked_signs():
    import json
    examples = json.loads((ROOT / 'data/signs/scene_examples.json').read_text(encoding='utf-8'))['examples']
    assert examples
    for code, item in examples.items():
        sign = signs.by_code(code)
        assert sign and sign['teaching'], code
        path = ROOT / item['image'].lstrip('/')
        assert path.parent == ROOT / 'static/signs/scenes' and path.is_file(), code
        assert _webp_size(path) == (1200, 720) and path.stat().st_size < 260_000, code
        assert item['with'] is None or signs.by_code(item['with']), code
        assert sign_curriculum.scene_example(code)['image'] == item['image']
    assert sign_curriculum.scene_example('unknown') is None
    label = 'Illustration: the street is AI-made, the sign is the official drawing.'
    for template in ('sign_lesson.html', 'sign_detail.html'):
        assert label in (ROOT / 'templates' / template).read_text(encoding='utf-8')
