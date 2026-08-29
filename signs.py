"""Road sign catalogue.

The catalogue is a JSON file built by scripts/fetch_signs.py, not a database
table: it is reference data that changes when the Danish executive order
changes, not when a user does something. Loading it here keeps main.py free of
the details and makes the data easy to rebuild.
"""

from __future__ import annotations

import json
import re
import threading
from pathlib import Path
from typing import Optional

DATA_DIR = Path(__file__).resolve().parent / "data" / "signs"
DATA_FILE = DATA_DIR / "signs.json"
MEANINGS_FILE = DATA_DIR / "meanings.json"

# Order the groups the way a learner meets them, not alphabetically.
GROUP_ORDER = ["A", "B", "C", "D", "E", "U", "F", "H", "I", "J", "K", "G", "M"]

# One line per family, so a sign card says something even before we add the
# full wording from the executive order.
GROUP_NOTES = {
    "A": (
        "Triangular with a red border: something ahead needs your attention. Outside built-up "
        "areas they normally stand 150-250 m before the hazard, closer inside town."
    ),
    "B": "Who gives way: yield, stop, priority road, and priority against oncoming traffic.",
    "C": "Round with a red border: something is forbidden - entry, a manoeuvre, a speed, parking.",
    "D": "Round and blue: something is required - a direction, a cycle path, a minimum speed.",
    "E": "Mostly rectangular: they announce a regime, such as motorway, one-way street, zone or parking.",
    "U": "Small plates under a main sign. They narrow it or extend it: times, vehicle types, distances.",
    "F": "Where the roads lead: destinations, exits and the lanes that serve them.",
    "H": "Distances and place names along the route.",
    "I": "Exit signs on motorways, counting down to the junction.",
    "J": "Lane signs above the carriageway: which lane goes where.",
    "K": "Route confirmation after a junction: you are on the road you wanted.",
    "G": "Portal and gantry signs mounted over the carriageway.",
    "M": "Service signs: fuel, food, rest areas and other facilities.",
}

_lock = threading.Lock()
_cache: Optional[dict] = None


def _load() -> dict:
    global _cache
    with _lock:
        if _cache is not None:
            return _cache
        if not DATA_FILE.exists():
            _cache = {"signs": [], "count": 0, "fetched": "", "source": ""}
            return _cache
        try:
            payload = json.loads(DATA_FILE.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as error:
            print(f"[signs] catalogue unreadable: {error}")
            payload = {"signs": [], "count": 0, "fetched": "", "source": ""}
        payload.setdefault("signs", [])
        meanings = _load_meanings()
        for sign in payload["signs"]:
            sign["meaning"] = meanings.get(sign["code"], "")
        payload["signs"].sort(key=lambda sign: (_group_rank(sign["group"]), code_key(sign["code"])))
        payload["explained"] = sum(1 for sign in payload["signs"] if sign["meaning"])
        _cache = payload
        return _cache


def _load_meanings() -> dict:
    """Our own study wording, kept in its own file so rebuilding never eats it."""
    if not MEANINGS_FILE.exists():
        return {}
    try:
        return json.loads(MEANINGS_FILE.read_text(encoding="utf-8")).get("meanings", {})
    except (OSError, json.JSONDecodeError) as error:
        print(f"[signs] meanings unreadable: {error}")
        return {}


def code_key(code: str) -> tuple:
    """Sort A2 before A11 before A100, the way the codes are meant to read."""
    letters = re.match(r"[A-Z]+", code)
    numbers = [int(part) for part in re.findall(r"\d+", code)]
    return (letters.group(0) if letters else code, numbers)


def _group_rank(group: str) -> int:
    return GROUP_ORDER.index(group) if group in GROUP_ORDER else len(GROUP_ORDER)


def reload_catalogue() -> None:
    """Drop the cache so the next request re-reads the file."""
    global _cache
    with _lock:
        _cache = None


def all_signs() -> list[dict]:
    return _load()["signs"]


def catalogue_meta() -> dict:
    payload = _load()
    return {
        "count": len(payload["signs"]),
        "explained": payload.get("explained", 0),
        "fetched": payload.get("fetched", ""),
        "source": payload.get("source", ""),
    }


def by_code(code: str) -> Optional[dict]:
    wanted = (code or "").strip().upper()
    for sign in all_signs():
        if sign["code"].upper() == wanted:
            return sign
    return None


def group_note(group: str) -> str:
    return GROUP_NOTES.get(group, "")


def groups() -> list[dict]:
    """Groups in learning order, each with its label and sign count."""
    counts: dict[str, dict] = {}
    for sign in all_signs():
        entry = counts.setdefault(
            sign["group"],
            {
                "group": sign["group"],
                "label": sign["group_label"],
                "note": group_note(sign["group"]),
                "count": 0,
            },
        )
        entry["count"] += 1
    return sorted(counts.values(), key=lambda item: (_group_rank(item["group"]), item["group"]))


def related_signs(sign: dict, limit: int = 8) -> list[dict]:
    """Other signs of the same group - the ones most easily confused with it."""
    family = [s for s in all_signs() if s["group"] == sign["group"]]
    family.sort(key=lambda s: code_key(s["code"]))
    if len(family) < 2:
        return []
    position = next((i for i, s in enumerate(family) if s["code"] == sign["code"]), 0)
    start = max(0, min(position - limit // 2, len(family) - limit - 1))
    window = [s for s in family[start : start + limit + 1] if s["code"] != sign["code"]]
    return window[:limit]
