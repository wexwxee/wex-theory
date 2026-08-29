"""Build the road sign catalogue from Wikimedia sources.

Codes, names and file names come from the English Wikipedia article
"Road signs in Denmark", which lists the signs of executive order 425/2023
(bekendtgorelse om vejafmaerkning). The images come from Wikimedia Commons,
where they are published on the basis of section 9 of the Danish copyright
act: laws and executive orders carry no copyright.

Run it from the project root:

    python scripts/fetch_signs.py

It writes:
    static/signs/<CODE>.svg      one file per sign
    data/signs/signs.json        the catalogue the site reads

Both are safe to re-run: existing files are overwritten, nothing else is
touched. Signs the article marks as historic are skipped.
"""

from __future__ import annotations

import json
import re
import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
IMAGE_DIR = ROOT / "static" / "signs"
DATA_DIR = ROOT / "data" / "signs"

USER_AGENT = "WEXTheory/1.0 (https://wextheory.cv; support@wextheory.cv) sign-catalogue"
WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
ARTICLE = "Road signs in Denmark"

# Article sections we take signs from, with the label shown on the site.
SECTIONS = {
    "Warning signs": "Warning signs",
    "Priority signs": "Priority signs",
    "Prohibitory signs": "Prohibitory signs",
    "Mandatory signs": "Mandatory signs",
    "Special regulation signs": "Special regulation signs",
    "Direction signs": "Direction signs",
    "Distance and locality signs": "Distance and locality signs",
    "Signs used on motorways": "Motorway signs",
    "Service signs": "Service signs",
    "Additional subpanels": "Subpanels",
}
SKIP_SECTIONS = {"Historic signs", "1932 road signs", "Route designations", "Symbols"}


def fetch_wikitext() -> str:
    response = httpx.get(
        WIKIPEDIA_API,
        params={
            "action": "parse",
            "page": ARTICLE,
            "prop": "wikitext",
            "format": "json",
            "formatversion": "2",
        },
        headers={"User-Agent": USER_AGENT},
        timeout=30,
    )
    response.raise_for_status()
    return response.json()["parse"]["wikitext"]


def clean_caption(text: str) -> str:
    """Turn a gallery caption into plain text."""
    text = re.sub(r"\{\{refn\|.*?\}\}", "", text, flags=re.S)
    text = re.sub(r"\{\{[^{}]*\}\}", "", text)
    text = re.sub(r"<ref[^>]*/>", "", text)
    text = re.sub(r"<ref[^>]*>.*?</ref>", "", text, flags=re.S)
    text = re.sub(r"\[\[File:[^\]]*\]\]", "", text)
    text = re.sub(r"\[\[[^\]|]*\|([^\]]*)\]\]", r"\1", text)
    text = re.sub(r"\[\[([^\]]*)\]\]", r"\1", text)
    text = re.sub(r"<br\s*/?>", " ", text)
    text = re.sub(r"'''?", "", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip(" .;:")


def parse_signs(wikitext: str) -> list[dict]:
    signs: list[dict] = []
    seen: set[str] = set()
    section = ""
    in_gallery = False

    for raw_line in wikitext.splitlines():
        line = raw_line.strip()

        heading = re.match(r"^=+\s*(.*?)\s*=+$", line)
        if heading:
            section = heading.group(1)
            continue
        if line.startswith("<gallery"):
            in_gallery = True
            continue
        if line.startswith("</gallery"):
            in_gallery = False
            continue
        if not in_gallery or "|" not in line:
            continue
        if section in SKIP_SECTIONS or section not in SECTIONS:
            continue

        filename, _, caption = line.partition("|")
        filename = filename.strip()
        if filename.lower().startswith("file:"):
            filename = filename[len("file:") :].strip()
        if not filename.lower().endswith((".svg", ".png", ".jpg")):
            continue

        caption = clean_caption(caption)
        code, _, name = caption.partition(":")
        code = code.strip()
        name = name.strip() or code
        if not re.fullmatch(r"U?[A-Z]{1,2}\s?\d{1,3}(\.\d{1,2})?(\s?[a-z])?", code):
            continue
        code = code.replace(" ", "")
        if code in seen:
            continue
        seen.add(code)

        # The letter of the code is the real family: A warning, C prohibitory,
        # U subpanel and so on. The article section only gives it a readable name.
        group = "U" if code.startswith("U") else re.match(r"[A-Z]+", code).group(0)
        signs.append(
            {
                "code": code,
                "group": group,
                "group_label": "Subpanels" if group == "U" else SECTIONS[section],
                "section": section,
                "name_en": name,
                "commons_file": filename,
                "image": f"/static/signs/{code}{Path(filename).suffix.lower()}",
            }
        )
    return signs


def resolve_image_urls(signs: list[dict]) -> dict[str, str]:
    """Ask Commons for the direct download URL of every file, 50 at a time."""
    urls: dict[str, str] = {}
    titles = [f"File:{sign['commons_file']}" for sign in signs]
    for start in range(0, len(titles), 50):
        batch = titles[start : start + 50]
        response = httpx.get(
            COMMONS_API,
            params={
                "action": "query",
                "titles": "|".join(batch),
                "prop": "imageinfo",
                "iiprop": "url",
                "format": "json",
                "formatversion": "2",
            },
            headers={"User-Agent": USER_AGENT},
            timeout=30,
        )
        response.raise_for_status()
        for page in response.json().get("query", {}).get("pages", []):
            info = page.get("imageinfo")
            if info:
                urls[page["title"][len("File:") :]] = info[0]["url"]
        time.sleep(0.3)
    return urls


def fetch_one(client: httpx.Client, url: str) -> bytes:
    """One image, politely: back off and retry when Wikimedia asks us to."""
    delay = 1.0
    for attempt in range(4):
        response = client.get(url)
        if response.status_code == 200:
            return response.content
        if response.status_code in (429, 500, 502, 503, 504):
            wait = float(response.headers.get("Retry-After", delay))
            time.sleep(min(wait, 30))
            delay *= 2
            continue
        response.raise_for_status()
    raise httpx.HTTPError(f"gave up after retries: {url}")


def download_images(signs: list[dict], urls: dict[str, str]) -> tuple[int, list[str]]:
    IMAGE_DIR.mkdir(parents=True, exist_ok=True)
    saved = 0
    missing: list[str] = []
    with httpx.Client(headers={"User-Agent": USER_AGENT}, timeout=30, follow_redirects=True) as client:
        for index, sign in enumerate(signs, 1):
            url = urls.get(sign["commons_file"])
            if not url:
                missing.append(f"{sign['code']} (no file on Commons)")
                continue
            try:
                content = fetch_one(client, url)
            except httpx.HTTPError as error:
                missing.append(f"{sign['code']} ({error})")
                continue
            (IMAGE_DIR / Path(sign["image"]).name).write_bytes(content)
            saved += 1
            if index % 25 == 0:
                print(f"  {index}/{len(signs)} ...")
            time.sleep(0.35)
    return saved, missing


def main() -> int:
    print("Reading the article ...")
    signs = parse_signs(fetch_wikitext())
    if not signs:
        print("No signs parsed - the article layout probably changed.")
        return 1
    print(f"Parsed {len(signs)} signs")

    print("Resolving image URLs on Commons ...")
    urls = resolve_image_urls(signs)

    print("Downloading images ...")
    saved, missing = download_images(signs, urls)
    print(f"Saved {saved} images, {len(missing)} missing")
    if missing:
        print("Missing:", ", ".join(missing))

    signs = [sign for sign in signs if (IMAGE_DIR / Path(sign["image"]).name).exists()]
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": (
            "Codes and names: English Wikipedia, 'Road signs in Denmark', listing the signs of "
            "executive order 425 of 13 April 2023. Images: Wikimedia Commons, free of copyright "
            "under section 9 of the Danish copyright act."
        ),
        "fetched": time.strftime("%Y-%m-%d"),
        "count": len(signs),
        "signs": sorted(signs, key=lambda s: (s["group"], s["code"])),
    }
    (DATA_DIR / "signs.json").write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"Catalogue written: {len(signs)} signs in data/signs/signs.json")
    return 0


if __name__ == "__main__":
    sys.exit(main())
