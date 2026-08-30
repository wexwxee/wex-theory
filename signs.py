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
RU_FILE = DATA_DIR / "ru.json"
DA_FILE = DATA_DIR / "da.json"
QUESTION_LINKS_FILE = DATA_DIR / "question_signs.json"

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

GROUP_LABELS_RU = {
    "A": "Предупреждающие знаки",
    "B": "Знаки приоритета",
    "C": "Запрещающие знаки",
    "D": "Предписывающие знаки",
    "E": "Информационные знаки",
    "U": "Таблички",
    "F": "Указатели направлений",
    "G": "Портальные указатели",
    "H": "Расстояния и местности",
    "I": "Съезды с автомагистрали",
    "J": "Указатели полос",
    "K": "Подтверждение маршрута",
    "M": "Знаки сервиса",
}

GROUP_NOTES_RU = {
    "A": (
        "Треугольные с красной каймой: впереди то, на что надо обратить внимание. За городом их ставят "
        "обычно за 150–250 метров до опасности, в городе — ближе."
    ),
    "B": "Кто кого пропускает: уступи, стоп, главная дорога и приоритет на узком участке.",
    "C": "Круглые с красной каймой: что-то запрещено — въезд, манёвр, скорость, стоянка.",
    "D": "Круглые синие: что-то обязательно — направление, велодорожка, минимальная скорость.",
    "E": "В основном прямоугольные: объявляют режим — автомагистраль, одностороннее движение, зона, стоянка.",
    "U": "Маленькие таблички под основным знаком. Сужают или расширяют его: время, вид транспорта, расстояние.",
    "F": "Куда ведут дороги: направления, съезды и полосы к ним.",
    "H": "Расстояния и названия мест вдоль маршрута.",
    "I": "Указатели съездов на автомагистрали, с отсчётом до развязки.",
    "J": "Таблички над полосами: какая полоса куда ведёт.",
    "K": "Подтверждение маршрута после перекрёстка: вы на той дороге, что нужна.",
    "G": "Порталы и рамки над проезжей частью.",
    "M": "Сервис: заправки, еда, места отдыха и прочие услуги.",
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
        meanings = _read_side_file(MEANINGS_FILE, "meanings")
        ru_names = _read_side_file(RU_FILE, "names")
        ru_meanings = _read_side_file(RU_FILE, "meanings")
        da_names = _read_side_file(DA_FILE, "names")
        for sign in payload["signs"]:
            code = sign["code"]
            sign["meaning"] = meanings.get(code, "")
            sign["name_ru"] = ru_names.get(code, "")
            sign["meaning_ru"] = ru_meanings.get(code, "")
            sign["name_da"] = da_names.get(code, "")
        payload["signs"].sort(key=lambda sign: (_group_rank(sign["group"]), code_key(sign["code"])))
        payload["explained"] = sum(1 for sign in payload["signs"] if sign["meaning"])
        payload["translated"] = sum(1 for sign in payload["signs"] if sign["name_ru"])
        payload["danish"] = sum(1 for sign in payload["signs"] if sign["name_da"])
        _cache = payload
        return _cache


def _read_side_file(path: Path, key: str) -> dict:
    """Our own wording, kept in its own files so rebuilding never eats it."""
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text(encoding="utf-8")).get(key, {})
    except (OSError, json.JSONDecodeError) as error:
        print(f"[signs] {path.name} unreadable: {error}")
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
        "translated": payload.get("translated", 0),
        "danish": payload.get("danish", 0),
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


def group_note_ru(group: str) -> str:
    return GROUP_NOTES_RU.get(group, "")


def groups() -> list[dict]:
    """Groups in learning order, each with its label and sign count."""
    counts: dict[str, dict] = {}
    for sign in all_signs():
        entry = counts.setdefault(
            sign["group"],
            {
                "group": sign["group"],
                "label": sign["group_label"],
                "label_ru": GROUP_LABELS_RU.get(sign["group"], sign["group_label"]),
                "note": group_note(sign["group"]),
                "note_ru": group_note_ru(sign["group"]),
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


def signs_for_question(question_id: int, limit: int = 4) -> list[dict]:
    """The signs a question is about, for the "look this up" chips.

    Built by scripts/tag_question_signs.py from the wording of the question and
    its explanation - not from the photograph, which we cannot read.
    """
    links = _read_side_file(QUESTION_LINKS_FILE, "questions")
    codes = links.get(str(question_id), [])[:limit]
    found = []
    for code in codes:
        sign = by_code(code)
        if sign:
            found.append(sign)
    return found
