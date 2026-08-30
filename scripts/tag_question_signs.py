"""Link practice questions to the road signs they are about.

We cannot see the photographs, so this does not claim "signs visible in the
picture". It reads the question and its explanation and links the signs the
text actually talks about: "the sign that indicates you are leaving the
expressway" is E45, "give way" is B11, and so on.

Only multi-word phrases are used. Single words like "crossing" mean four
different signs and would produce noise, and a wrong sign under a question is
worse than no sign at all.

Run it from the project root:

    python scripts/tag_question_signs.py            # writes the map
    python scripts/tag_question_signs.py --report   # shows what matched

Writes data/signs/question_signs.json.
"""

from __future__ import annotations

import json
import os
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

DATA_DIR = ROOT / "data" / "signs"

# phrase -> sign codes. Deliberately conservative: each phrase must point at
# one situation a learner can look up.
PHRASES: dict[str, list[str]] = {
    "give way": ["B11"],
    "unconditional duty to give way": ["B11"],
    "yield sign": ["B11"],
    "stop sign": ["B13"],
    "stop line": ["B13"],
    "main road": ["B16", "B17"],
    "priority road": ["B16"],
    "priority over oncoming": ["B19"],
    "priority for oncoming": ["B18"],
    "speed limit": ["C55", "C56"],
    "maximum permitted speed": ["C55"],
    "local speed limit": ["C55"],
    "no entry": ["C19"],
    "one-way": ["E19"],
    "one way street": ["E19"],
    "no overtaking": ["C51", "C53"],
    "overtaking is prohibited": ["C51"],
    "no parking": ["C62", "E68"],
    "no stopping": ["C61", "E68.2"],
    "parking is prohibited": ["C62"],
    "cycle path": ["D21", "UD21.1"],
    "cycle track": ["D21", "UD21.1"],
    "cycle lane": ["D21"],
    "footway": ["D22"],
    "shared path": ["D27"],
    "mandatory direction": ["D11.1", "D12"],
    "minimum speed": ["D55"],
    "pedestrian crossing": ["E17", "A17"],
    "zebra crossing": ["E17"],
    "level crossing": ["A72", "A73", "A75"],
    "railway crossing": ["A72", "A73"],
    "bus stop": ["E31"],
    "light rail": ["E30", "UB11.3"],
    "built-up area": ["E55", "E56"],
    "urban area": ["E55"],
    "leaving the expressway": ["E45"],
    "end of the expressway": ["E45"],
    "expressway": ["E43", "E45"],
    "motorway": ["E42", "E44"],
    "end of the motorway": ["E44"],
    "living street": ["E51", "E52"],
    "play area": ["E51"],
    "pedestrian zone": ["E49"],
    "traffic calm": ["E53"],
    "roundabout": ["A16", "D12"],
    "dangerous junction": ["A11"],
    "road narrows": ["A43.1"],
    "roadworks": ["A39"],
    "road works": ["A39"],
    "slippery road": ["A31"],
    "speed bump": ["A36"],
    "wild animals": ["A26"],
    "children may": ["A22"],
    "school": ["A22", "UA22"],
    "tunnel": ["A44", "E35"],
    "side wind": ["A95"],
    "queue": ["A20"],
    "traffic signal": ["A19"],
    "parking place": ["E33.1"],
    "parking space": ["E33.1"],
    "charging": ["UE33.4", "M24.1"],
    "low-emission zone": ["E68.9"],
    "environmental zone": ["E68.9"],
    "dead end": ["E18"],
    "advisory speed": ["E39"],
    "lane is reduced": ["E16.1"],
    "merge": ["B15", "E16.1"],
    "subpanel": ["U1.1", "U3.3"],
    "additional panel": ["U1.1"],
}


def load_questions():
    import sqlite3

    db_path = os.environ.get("SIGN_TAG_DB", str(ROOT / "wex_theory.db"))
    if not Path(db_path).exists():
        raise SystemExit(f"No database at {db_path} - point SIGN_TAG_DB at one.")
    connection = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    return connection.execute(
        "select id, test_id, question_index, question_text, coalesce(explanation, '') from questions"
    ).fetchall()


# Explanations sometimes name the sign outright: "The E 42 Motorway sign ...".
# That beats any phrase guess, so those codes go first.
EXPLICIT_CODE = re.compile(r"\b(U?[A-F])\s?(\d{1,3}(?:[.,]\d{1,2})?)\b")
UNITS = ("km", "m ", "metre", "meter", "cm", "kg", "tonne", "ton", "minute",
         "second", "hour", "%")


def explicit_codes(text: str) -> list[str]:
    codes: list[str] = []
    for found in EXPLICIT_CODE.finditer(text):
        # "A 20 km/h limit" is a speed, not sign A20.
        tail = text[found.end():found.end() + 12].strip().lower()
        if tail.startswith(UNITS):
            continue
        code = f"{found.group(1)}{found.group(2).replace(',', '.')}"
        if code not in codes:
            codes.append(code)
    return codes


def match(text: str) -> list[str]:
    lowered = text.lower()
    codes: list[str] = explicit_codes(text)
    for phrase, phrase_codes in PHRASES.items():
        if re.search(rf"\b{re.escape(phrase)}", lowered):
            for code in phrase_codes:
                if code not in codes:
                    codes.append(code)
    return codes


def main() -> int:
    import signs as catalogue

    known = {sign["code"] for sign in catalogue.all_signs()}
    unknown = sorted({code for codes in PHRASES.values() for code in codes} - known)
    if unknown:
        print("These codes are not in the catalogue and will be dropped:", ", ".join(unknown))

    rows = load_questions()
    mapping: dict[str, list[str]] = {}
    hits = Counter()

    for question_id, test_id, index, question_text, explanation in rows:
        codes = [code for code in match(f"{question_text} {explanation}") if code in known]
        if not codes:
            continue
        # More than four chips under a question is a wall, not a hint.
        mapping[str(question_id)] = codes[:4]
        for code in codes[:4]:
            hits[code] += 1
        if "--report" in sys.argv:
            print(f"Test {test_id} Q{index}: {', '.join(codes[:4])}")

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    (DATA_DIR / "question_signs.json").write_text(
        json.dumps(
            {
                "note": (
                    "Signs the question and its explanation talk about, matched by phrase. "
                    "Not a claim about what is visible in the photograph."
                ),
                "questions": mapping,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Linked {len(mapping)} of {len(rows)} questions")
    print("Most linked signs:", ", ".join(f"{code} ({count})" for code, count in hits.most_common(8)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
