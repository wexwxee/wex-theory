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


def test_every_exam_family_sign_is_explained(all_signs):
    """A, B, C, D, E and the subpanels are what the test asks about."""
    unexplained = [
        sign["code"]
        for sign in all_signs
        if sign["group"] in {"A", "B", "C", "D", "E", "U"} and not sign["meaning"].strip()
    ]
    assert unexplained == []


def test_meanings_do_not_leak_into_the_generated_file():
    """Rebuilding the catalogue must never be able to wipe our own wording."""
    import json

    raw = json.loads((ROOT / "data" / "signs" / "signs.json").read_text(encoding="utf-8"))
    assert all("meaning" not in sign for sign in raw["signs"])


def test_groups_are_counted_and_ordered(all_signs):
    groups = catalogue.groups()
    assert sum(group["count"] for group in groups) == len(all_signs)
    assert [group["group"] for group in groups][:3] == ["A", "B", "C"]
    assert all(group["label"] for group in groups)
