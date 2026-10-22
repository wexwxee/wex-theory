"""Pull the official Danish name of every sign from the executive order.

Source: bekendtgorelse nr. 425 af 13. april 2023 om vejafmaerkning, published on
retsinformation.dk. Danish law carries no copyright (section 9 of the copyright
act), and this is the naming the driving school and the examiner use.

Run it from the project root:

    python scripts/fetch_danish_names.py

Writes data/signs/da.json. Codes in the order are written "C 11,1"; here they
are normalised to the "C11.1" form the catalogue uses.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import httpx
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "data" / "signs"
PDF_URL = "https://www.retsinformation.dk/eli/lta/2023/425/pdf"
# retsinformation refuses a plain script user agent
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126 Safari/537.36"
)

CODE_LINE = re.compile(r"^(U?[A-Z]{1,2})\s?(\d{1,3}(?:,\d{1,2})*)\s+(\S.*)$")
BARE_CODE = re.compile(r"^(U?[A-Z]{1,2})\s?\d{1,3}(?:,\d{1,2})*$")


def download_text(cache: Path) -> str:
    if cache.exists():
        return cache.read_text(encoding="utf-8")
    pdf_path = cache.with_suffix(".pdf")
    if not pdf_path.exists():
        response = httpx.get(PDF_URL, headers={"User-Agent": USER_AGENT}, timeout=90, follow_redirects=True)
        response.raise_for_status()
        pdf_path.write_bytes(response.content)
    reader = PdfReader(str(pdf_path))
    text = "\n".join((page.extract_text() or "") for page in reader.pages)
    cache.write_text(text, encoding="utf-8")
    return text


def normalise(prefix: str, number: str) -> str:
    return f"{prefix}{number.replace(',', '.')}"


def clean_name(name: str) -> str:
    name = re.sub(r"\s+", " ", name).strip(" .,;:")
    # The order often qualifies a name with a clause; the short form is the name.
    name = re.split(r",\s+(?:hvor|som|der|når|med angivelse)", name)[0]
    return name.strip(" .,;:")


def parse_names(text: str) -> dict[str, str]:
    names: dict[str, str] = {}
    lines = [line.strip() for line in text.splitlines()]

    for index, line in enumerate(lines):
        match = CODE_LINE.match(line)
        if not match:
            continue
        prefix, number, rest = match.groups()
        # A line that is only a list of codes is a cross-reference, not a name.
        if BARE_CODE.match(rest) or re.match(r"^(U?[A-Z]{1,2})\s?\d", rest):
            continue
        code = normalise(prefix, number)
        if code in names:
            continue
        name = rest
        # A name can wrap onto the next line; take it unless that line starts a new sign.
        if len(name) < 45 and index + 1 < len(lines):
            following = lines[index + 1]
            if following and not CODE_LINE.match(following) and following[:1].islower():
                name = f"{name} {following}"
        cleaned = clean_name(name)
        if 2 <= len(cleaned) <= 90:
            names[code] = cleaned
    return names


def main() -> int:
    cache = DATA_DIR / "_bek425_text.txt"
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    print("Reading the executive order ...")
    names = parse_names(download_text(cache))
    print(f"Parsed {len(names)} Danish names")

    catalogue_path = DATA_DIR / "signs.json"
    if catalogue_path.exists():
        catalogue = json.loads(catalogue_path.read_text(encoding="utf-8"))["signs"]
        known = {sign["code"] for sign in catalogue}
        # The order names a family once and then lists its variants as drawings:
        # D 11 "Påbudt kørselsretning" covers D11.1 to D11.8. Inherit the name.
        for code in known:
            base = code
            while code not in names and "." in base:
                base = base.rsplit(".", 1)[0]
                if base in names:
                    names[code] = names[base]
        names = {code: name for code, name in names.items() if code in known}
        missing = sorted(known - set(names))
        print(f"Matched {len(names)} of {len(known)} catalogue signs")
        if missing:
            print("No Danish name for:", ", ".join(missing[:40]), "..." if len(missing) > 40 else "")

    (DATA_DIR / "da.json").write_text(
        json.dumps(
            {
                "note": (
                    "Official Danish names from bekendtgorelse nr. 425 of 13 April 2023 on road "
                    "marking (retsinformation.dk). Danish law is free of copyright, section 9 of "
                    "the copyright act."
                ),
                "names": dict(sorted(names.items())),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    cache.unlink(missing_ok=True)
    cache.with_suffix(".pdf").unlink(missing_ok=True)
    print("Written: data/signs/da.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
