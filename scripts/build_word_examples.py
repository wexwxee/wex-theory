"""Give every exam word a real sentence from the question bank.

A phrase like "hold back" means nothing on its own; it means something in
"I am ready to hold back for vehicles approaching from the right". Those
sentences already exist in this library, together with their Russian
translation, so the example is real rather than invented.

Run it from the project root:

    python scripts/build_word_examples.py

Writes static/js/exam-words-examples.js, loaded by the Exam Words page.
"""

from __future__ import annotations

import json
import re
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_JS = ROOT / "static" / "js" / "exam-words-data.js"
OUT_JS = ROOT / "static" / "js" / "exam-words-examples.js"

TERM_RE = re.compile(r'\{ dk: "([^"]+)", en: "([^"]+)"')
MAX_SENTENCE = 190
MIN_SENTENCE = 25


def term_id(danish: str) -> str:
    return re.sub(r"[^a-zA-Z0-9æøåÆØÅ]", "", danish).lower()


def load_terms() -> list[tuple[str, str]]:
    """(id, english phrase) for every term in the dictionary."""
    text = DATA_JS.read_text(encoding="utf-8")
    return [(term_id(dk), en) for dk, en in TERM_RE.findall(text)]


def sentences_with_translation(db_path: Path):
    """Pairs of (english sentence, russian sentence) from questions and answers."""
    connection = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    pairs = []

    rows = connection.execute(
        "select question_text, coalesce(question_text_ru, '') from questions"
    ).fetchall()
    rows += connection.execute("select text, coalesce(text_ru, '') from answers").fetchall()

    for english, russian in rows:
        english = re.sub(r"\s+", " ", english or "").strip()
        russian = re.sub(r"\s+", " ", russian or "").strip()
        if not english or not russian:
            continue
        # One sentence beats a paragraph, but only if the pair still lines up.
        if english.count(".") <= 1 and len(english) <= MAX_SENTENCE:
            pairs.append((english, russian))
    return pairs


def variants(phrase: str) -> list[str]:
    """The forms a phrase can take in a sentence."""
    forms = set()
    for part in phrase.split("/"):
        cleaned = re.sub(r"\s+", " ", part).strip().lower()
        cleaned = re.sub(r"[?!.]+$", "", cleaned)
        if not cleaned:
            continue
        forms.add(cleaned)
        if cleaned.startswith("to "):
            stem = cleaned[3:]
            forms.add(stem)
            # "to overtake" also appears as "overtakes", "overtaking", "overtook"
            if stem.endswith("e"):
                forms.add(stem[:-1] + "ing")
            else:
                forms.add(stem + "ing")
            forms.add(stem + "s")
    return sorted(forms, key=len, reverse=True)


def find_example(phrase: str, pairs) -> dict | None:
    best = None
    for form in variants(phrase):
        if len(form) < 3:
            continue
        pattern = re.compile(rf"\b{re.escape(form)}\b", re.IGNORECASE)
        for english, russian in pairs:
            if len(english) < MIN_SENTENCE:
                continue
            if not pattern.search(english):
                continue
            # Shortest sentence that still shows the phrase in context.
            if best is None or len(english) < len(best["en"]):
                best = {"en": english, "ru": russian, "match": form}
        if best:
            break
    return best


def main() -> int:
    db_path = Path(sys.argv[1] if len(sys.argv) > 1 else ROOT / "wex_theory.db")
    if not db_path.exists():
        raise SystemExit(f"No database at {db_path}")

    terms = load_terms()
    pairs = sentences_with_translation(db_path)
    print(f"{len(terms)} terms, {len(pairs)} translated sentences to draw from")

    examples = {}
    for identifier, english in terms:
        found = find_example(english, pairs)
        if found:
            examples[identifier] = found

    OUT_JS.write_text(
        "/* Real sentences from this library's questions, one per word where we\n"
        "   have one, with the Russian translation that ships with the question.\n"
        "   Built by scripts/build_word_examples.py - do not edit by hand. */\n"
        "const EXAM_WORD_EXAMPLES = "
        + json.dumps(examples, ensure_ascii=False, indent=1, sort_keys=True)
        + ";\n",
        encoding="utf-8",
    )
    print(f"Examples for {len(examples)} of {len(terms)} terms -> static/js/exam-words-examples.js")
    return 0


if __name__ == "__main__":
    sys.exit(main())
