"""Checks for the road sign catalogue.

They guard the data, not the wording: every sign must have a code, a picture
that actually exists on disk, and a family. If scripts/fetch_signs.py ever
parses the source badly, these fail instead of the site quietly showing
broken images.
"""

from pathlib import Path

import pytest

import signs as catalogue

ROOT = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="module")
def all_signs():
    signs = catalogue.all_signs()
    if not signs:
        pytest.skip("catalogue not built - run scripts/fetch_signs.py")
    return signs


def test_catalogue_has_the_main_families(all_signs):
    families = {sign["group"] for sign in all_signs}
    assert {"A", "B", "C", "D", "E", "U"} <= families


def test_codes_are_unique(all_signs):
    codes = [sign["code"] for sign in all_signs]
    assert len(codes) == len(set(codes))


def test_every_sign_has_an_image_on_disk(all_signs):
    missing = [
        sign["code"]
        for sign in all_signs
        if not (ROOT / sign["image"].lstrip("/")).exists()
    ]
    assert missing == []


def test_every_sign_has_a_name(all_signs):
    unnamed = [sign["code"] for sign in all_signs if not sign["name_en"].strip()]
    assert unnamed == []


def test_lookup_is_case_insensitive(all_signs):
    code = all_signs[0]["code"]
    assert catalogue.by_code(code.lower())["code"] == code
    assert catalogue.by_code("  " + code + " ")["code"] == code
    assert catalogue.by_code("definitely-not-a-sign") is None


def test_codes_sort_naturally():
    assert catalogue.code_key("A2") < catalogue.code_key("A11") < catalogue.code_key("A100")


def test_related_signs_stay_in_the_same_family(all_signs):
    sign = next(s for s in all_signs if s["group"] == "C")
    related = catalogue.related_signs(sign)
    assert related, "a family with several signs should suggest neighbours"
    assert all(other["group"] == "C" for other in related)
    assert all(other["code"] != sign["code"] for other in related)


def test_every_sign_is_explained(all_signs):
    """A name is not an explanation - every sign says what you do about it."""
    unexplained = [sign["code"] for sign in all_signs if not sign["meaning"].strip()]
    assert unexplained == []


def test_most_signs_carry_their_official_danish_name(all_signs):
    """The Danish name is what the driving school and the examiner use.
    A handful of subpanels are named only as a family in the order, so this
    checks the bulk rather than demanding every single one."""
    named = [sign for sign in all_signs if sign["name_da"].strip()]
    assert len(named) > len(all_signs) * 0.9


def test_meanings_do_not_leak_into_the_generated_file():
    """Rebuilding the catalogue must never be able to wipe our own wording."""
    import json

    raw = json.loads((ROOT / "data" / "signs" / "signs.json").read_text(encoding="utf-8"))
    assert all("meaning" not in sign for sign in raw["signs"])


def test_every_sign_has_a_russian_name(all_signs):
    """The audience reads Russian faster than English - names must all be there."""
    missing = [sign["code"] for sign in all_signs if not sign["name_ru"].strip()]
    assert missing == []


def test_russian_explanations_match_the_english_ones(all_signs):
    """Wherever we explain a sign in English, the Russian must exist too."""
    missing = [
        sign["code"]
        for sign in all_signs
        if sign["meaning"].strip() and not sign["meaning_ru"].strip()
    ]
    assert missing == []


def test_every_family_has_a_russian_label_and_note():
    for group in catalogue.groups():
        assert group["label_ru"].strip()
        assert group["note_ru"].strip()


def test_signs_sharing_a_name_exist_in_the_same_family(all_signs):
    """Why the quiz must never offer two options with the same wording:
    D11.1-D11.8 are all called "Mandatory direction", so two identical answers
    would both be correct. The trainer picks distractors by distinct label."""
    from collections import Counter

    names = Counter((sign["group"], sign["name_en"]) for sign in all_signs)
    assert any(count > 1 for count in names.values())


def test_groups_are_counted_and_ordered(all_signs):
    groups = catalogue.groups()
    assert sum(group["count"] for group in groups) == len(all_signs)
    assert [group["group"] for group in groups][:3] == ["A", "B", "C"]
    assert all(group["label"] for group in groups)


def test_questions_link_only_to_signs_that_exist(all_signs):
    """The question-to-sign map is built by a script; a stale code there would
    render a broken chip under a question."""
    import json

    path = ROOT / "data" / "signs" / "question_signs.json"
    if not path.exists():
        pytest.skip("question links not built - run scripts/tag_question_signs.py")
    links = json.loads(path.read_text(encoding="utf-8"))["questions"]
    known = {sign["code"] for sign in all_signs}
    unknown = sorted({code for codes in links.values() for code in codes} - known)
    assert unknown == []
    assert all(len(codes) <= 4 for codes in links.values()), "four chips is already a wall"


def test_signs_for_question_returns_full_sign_records():
    import json

    path = ROOT / "data" / "signs" / "question_signs.json"
    if not path.exists():
        pytest.skip("question links not built")
    links = json.loads(path.read_text(encoding="utf-8"))["questions"]
    question_id = int(next(iter(links)))
    found = catalogue.signs_for_question(question_id)
    assert found and all(sign["name_en"] and sign["image"] for sign in found)
    assert catalogue.signs_for_question(-1) == []
