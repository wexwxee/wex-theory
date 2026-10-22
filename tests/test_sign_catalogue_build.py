"""An omitted gallery row must not erase the official steep-descent sign."""
import runpy
from pathlib import Path

parse = runpy.run_path(str(Path(__file__).resolve().parents[1] / 'scripts/fetch_signs.py'))['parse_signs']


def test_missing_descent_is_retained_but_a_broken_source_still_alarms():
    source = '== Warning signs ==\n<gallery>\nDenmark road sign A46.2.svg|A46.2: Steep ascent\n</gallery>'
    signs = parse(source)
    assert {sign['code'] for sign in signs} == {'A46.1', 'A46.2'}
    assert next(sign for sign in signs if sign['code'] == 'A46.1')['commons_file'] == 'Denmark road sign A46.1.svg'
    assert parse('No gallery here') == []


def test_existing_descent_is_never_duplicated_or_relabelled():
    source = '== Warning signs ==\n<gallery>\nDenmark road sign A46.1.svg|A46.1: Downward gradient\n</gallery>'
    signs = parse(source)
    assert len(signs) == 1
    assert signs[0]['name_en'] == 'Downward gradient'
