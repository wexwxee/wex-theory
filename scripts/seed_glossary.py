"""
Seed the WordTranslation table with a curated driving-theory glossary.

Each entry is a single English token (lowercased) mapped to the best Russian
equivalent in the context of UK/EU driving theory. These are used by the
word-hover popup on the test and results pages so that common driving terms
get a high-quality, context-aware translation instead of a literal one.

Run once:
    python scripts/seed_glossary.py

Re-running is safe — existing curated entries are updated in place.
"""
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import models
from database import SessionLocal


# (english_word, russian_translation, optional part-of-speech hint)
GLOSSARY: list[tuple[str, str, str | None]] = [
    # ─── Road infrastructure ──────────────────────────────────────────────
    ("road", "дорога", "n"),
    ("roadway", "проезжая часть", "n"),
    ("highway", "автомагистраль", "n"),
    ("motorway", "автомагистраль", "n"),
    ("street", "улица", "n"),
    ("lane", "полоса движения", "n"),
    ("carriageway", "проезжая часть", "n"),
    ("kerb", "бордюр", "n"),
    ("curb", "бордюр", "n"),
    ("verge", "обочина", "n"),
    ("shoulder", "обочина", "n"),
    ("hard", "твёрдый", "adj"),
    ("median", "разделительная полоса", "n"),
    ("intersection", "перекрёсток", "n"),
    ("junction", "перекрёсток", "n"),
    ("crossroads", "перекрёсток", "n"),
    ("roundabout", "круговое движение", "n"),
    ("bend", "поворот дороги", "n"),
    ("curve", "поворот", "n"),
    ("hill", "холм", "n"),
    ("slope", "уклон", "n"),
    ("gradient", "уклон", "n"),
    ("bridge", "мост", "n"),
    ("tunnel", "тоннель", "n"),
    ("underpass", "подземный переезд", "n"),
    ("overpass", "эстакада", "n"),
    ("viaduct", "виадук", "n"),
    ("ramp", "съезд", "n"),
    ("exit", "съезд", "n"),
    ("entry", "въезд", "n"),
    ("entrance", "въезд", "n"),
    ("driveway", "выезд с участка", "n"),
    ("layby", "карман для остановки", "n"),
    ("forecourt", "площадка перед заправкой", "n"),

    # ─── Crossings & markings ─────────────────────────────────────────────
    ("crossing", "переход", "n"),
    ("pedestrian", "пешеход", "n"),
    ("zebra", "зебра", "n"),
    ("pelican", "пешеходный переход «пеликан»", "n"),
    ("puffin", "переход «паффин»", "n"),
    ("toucan", "переход «тукан»", "n"),
    ("crosswalk", "пешеходный переход", "n"),
    ("markings", "разметка", "n"),
    ("marking", "разметка", "n"),
    ("hatched", "заштрихованная", "adj"),
    ("solid", "сплошная", "adj"),
    ("broken", "прерывистая", "adj"),
    ("dashed", "прерывистая", "adj"),
    ("white", "белая", "adj"),
    ("yellow", "жёлтая", "adj"),
    ("line", "линия разметки", "n"),
    ("edge", "край", "n"),
    ("centre", "центр", "n"),
    ("center", "центр", "n"),
    ("arrow", "стрелка", "n"),
    ("arrows", "стрелки", "n"),

    # ─── Signs & signals ──────────────────────────────────────────────────
    ("sign", "дорожный знак", "n"),
    ("signs", "дорожные знаки", "n"),
    ("signal", "сигнал", "n"),
    ("signals", "сигналы", "n"),
    ("traffic", "движение транспорта", "n"),
    ("light", "светофор", "n"),
    ("lights", "светофор", "n"),
    ("red", "красный", "adj"),
    ("green", "зелёный", "adj"),
    ("amber", "жёлтый", "adj"),
    ("flashing", "мигающий", "adj"),
    ("warning", "предупреждение", "n"),
    ("prohibition", "запрещение", "n"),
    ("mandatory", "предписывающий", "adj"),
    ("priority", "приоритет", "n"),
    ("yield", "уступить дорогу", "v"),
    ("give", "уступать", "v"),
    ("way", "дорога / уступить дорогу", "n"),
    ("stop", "остановка", "n"),

    # ─── Vehicles & road users ────────────────────────────────────────────
    ("vehicle", "транспортное средство", "n"),
    ("vehicles", "транспортные средства", "n"),
    ("car", "автомобиль", "n"),
    ("cars", "автомобили", "n"),
    ("truck", "грузовик", "n"),
    ("lorry", "грузовик", "n"),
    ("hgv", "грузовое транспортное средство", "n"),
    ("bus", "автобус", "n"),
    ("coach", "междугородний автобус", "n"),
    ("tram", "трамвай", "n"),
    ("taxi", "такси", "n"),
    ("motorcycle", "мотоцикл", "n"),
    ("motorbike", "мотоцикл", "n"),
    ("moped", "мопед", "n"),
    ("scooter", "скутер", "n"),
    ("cyclist", "велосипедист", "n"),
    ("cyclists", "велосипедисты", "n"),
    ("bicycle", "велосипед", "n"),
    ("bike", "велосипед", "n"),
    ("rider", "водитель двухколёсного", "n"),
    ("driver", "водитель", "n"),
    ("drivers", "водители", "n"),
    ("passenger", "пассажир", "n"),
    ("passengers", "пассажиры", "n"),
    ("pedestrians", "пешеходы", "n"),
    ("child", "ребёнок", "n"),
    ("children", "дети", "n"),
    ("elderly", "пожилые", "adj"),
    ("disabled", "инвалид", "adj"),
    ("horse", "лошадь", "n"),
    ("animal", "животное", "n"),

    # ─── Vehicle parts ────────────────────────────────────────────────────
    ("indicator", "указатель поворота", "n"),
    ("indicators", "указатели поворота", "n"),
    ("blinker", "указатель поворота", "n"),
    ("headlight", "фара", "n"),
    ("headlights", "фары", "n"),
    ("dipped", "ближний", "adj"),
    ("beam", "свет фар", "n"),
    ("beams", "свет фар", "n"),
    ("main", "дальний", "adj"),
    ("full", "дальний", "adj"),
    ("fog", "противотуманный", "adj"),
    ("brake", "тормоз", "n"),
    ("brakes", "тормоза", "n"),
    ("braking", "торможение", "n"),
    ("clutch", "сцепление", "n"),
    ("gear", "передача", "n"),
    ("gears", "передачи", "n"),
    ("steering", "руль", "n"),
    ("wheel", "колесо", "n"),
    ("wheels", "колёса", "n"),
    ("tyre", "шина", "n"),
    ("tyres", "шины", "n"),
    ("tire", "шина", "n"),
    ("mirror", "зеркало", "n"),
    ("mirrors", "зеркала", "n"),
    ("seatbelt", "ремень безопасности", "n"),
    ("airbag", "подушка безопасности", "n"),
    ("bonnet", "капот", "n"),
    ("boot", "багажник", "n"),
    ("windscreen", "лобовое стекло", "n"),
    ("windshield", "лобовое стекло", "n"),
    ("wiper", "стеклоочиститель", "n"),
    ("wipers", "стеклоочистители", "n"),
    ("horn", "клаксон", "n"),
    ("engine", "двигатель", "n"),
    ("exhaust", "выхлоп", "n"),
    ("battery", "аккумулятор", "n"),
    ("fuel", "топливо", "n"),
    ("petrol", "бензин", "n"),
    ("diesel", "дизель", "n"),

    # ─── Manoeuvres & verbs ──────────────────────────────────────────────
    ("turn", "поворот", "n"),
    ("turning", "поворот", "n"),
    ("left", "налево", "adv"),
    ("right", "направо", "adv"),
    ("straight", "прямо", "adv"),
    ("ahead", "впереди", "adv"),
    ("behind", "позади", "adv"),
    ("front", "перед", "n"),
    ("back", "сзади", "adv"),
    ("forward", "вперёд", "adv"),
    ("backward", "назад", "adv"),
    ("reverse", "движение задним ходом", "n"),
    ("reversing", "движение задним ходом", "n"),
    ("overtake", "обгон", "n"),
    ("overtaking", "обгон", "n"),
    ("overtaken", "обогнан", "v"),
    ("pass", "проехать / обгонять", "v"),
    ("passing", "обгон", "n"),
    ("merge", "перестроение", "n"),
    ("merging", "перестроение", "n"),
    ("join", "выехать на", "v"),
    ("leave", "съехать с", "v"),
    ("enter", "въехать", "v"),
    ("exit", "съезжать", "v"),
    ("approach", "приближаться", "v"),
    ("approaching", "приближаясь к", "v"),
    ("slow", "замедлиться", "v"),
    ("accelerate", "ускоряться", "v"),
    ("brake", "тормозить", "v"),
    ("stop", "остановиться", "v"),
    ("stopping", "остановка", "n"),
    ("park", "припарковаться", "v"),
    ("parking", "парковка", "n"),
    ("parked", "припаркован", "adj"),
    ("wait", "ждать", "v"),
    ("waiting", "ожидание", "n"),
    ("proceed", "продолжать движение", "v"),
    ("continue", "продолжать", "v"),
    ("stay", "оставаться", "v"),
    ("keep", "держаться", "v"),
    ("follow", "следовать за", "v"),
    ("change", "сменить", "v"),
    ("changing", "смена полосы", "n"),
    ("signal", "подавать сигнал", "v"),
    ("indicate", "подать указатель", "v"),
    ("flash", "моргнуть фарами", "v"),
    ("yield", "уступить", "v"),
    ("emerge", "выезжать", "v"),
    ("emerging", "выезжая", "v"),
    ("manoeuvre", "манёвр", "n"),
    ("maneuver", "манёвр", "n"),

    # ─── Speed & distance ────────────────────────────────────────────────
    ("speed", "скорость", "n"),
    ("speeding", "превышение скорости", "n"),
    ("limit", "предел", "n"),
    ("limits", "ограничения", "n"),
    ("kmh", "км/ч", "n"),
    ("mph", "миль/ч", "n"),
    ("distance", "дистанция", "n"),
    ("gap", "интервал", "n"),
    ("space", "расстояние", "n"),
    ("close", "близко", "adv"),
    ("far", "далеко", "adv"),
    ("near", "рядом", "adv"),
    ("between", "между", "prep"),
    ("metre", "метр", "n"),
    ("metres", "метров", "n"),
    ("meter", "метр", "n"),
    ("meters", "метров", "n"),

    # ─── Conditions & visibility ─────────────────────────────────────────
    ("weather", "погода", "n"),
    ("rain", "дождь", "n"),
    ("rainy", "дождливый", "adj"),
    ("wet", "мокрый", "adj"),
    ("snow", "снег", "n"),
    ("snowy", "снежный", "adj"),
    ("ice", "лёд", "n"),
    ("icy", "обледенелый", "adj"),
    ("frost", "иней", "n"),
    ("slippery", "скользкий", "adj"),
    ("dry", "сухой", "adj"),
    ("fog", "туман", "n"),
    ("foggy", "туманный", "adj"),
    ("mist", "дымка", "n"),
    ("dark", "темно", "adv"),
    ("darkness", "темнота", "n"),
    ("night", "ночь", "n"),
    ("nighttime", "ночное время", "n"),
    ("dusk", "сумерки", "n"),
    ("dawn", "рассвет", "n"),
    ("daylight", "дневной свет", "n"),
    ("visibility", "видимость", "n"),
    ("glare", "ослепление", "n"),
    ("dazzle", "ослепить", "v"),
    ("dazzled", "ослеплён", "adj"),
    ("wind", "ветер", "n"),
    ("windy", "ветреный", "adj"),
    ("storm", "шторм", "n"),

    # ─── Safety & rules ───────────────────────────────────────────────────
    ("safe", "безопасно", "adv"),
    ("safety", "безопасность", "n"),
    ("safely", "безопасно", "adv"),
    ("dangerous", "опасный", "adj"),
    ("danger", "опасность", "n"),
    ("hazard", "опасность", "n"),
    ("hazardous", "опасный", "adj"),
    ("risk", "риск", "n"),
    ("careful", "осторожный", "adj"),
    ("carefully", "осторожно", "adv"),
    ("attention", "внимание", "n"),
    ("alert", "внимательно", "adv"),
    ("aware", "осознавать", "v"),
    ("awareness", "осведомлённость", "n"),
    ("rule", "правило", "n"),
    ("rules", "правила", "n"),
    ("law", "закон", "n"),
    ("legal", "законный", "adj"),
    ("illegal", "незаконный", "adj"),
    ("offence", "нарушение", "n"),
    ("offense", "нарушение", "n"),
    ("fine", "штраф", "n"),
    ("penalty", "штраф", "n"),
    ("licence", "права", "n"),
    ("license", "права", "n"),
    ("insurance", "страховка", "n"),
    ("mot", "техосмотр", "n"),
    ("inspection", "осмотр", "n"),

    # ─── Common context words ────────────────────────────────────────────
    ("oncoming", "встречный", "adj"),
    ("opposite", "противоположный", "adj"),
    ("opposing", "встречный", "adj"),
    ("incoming", "приближающийся", "adj"),
    ("approaching", "приближающийся", "adj"),
    ("nearside", "со стороны бордюра", "adj"),
    ("offside", "со стороны центра дороги", "adj"),
    ("inside", "внутри", "prep"),
    ("outside", "снаружи", "prep"),
    ("middle", "середина", "n"),
    ("side", "сторона", "n"),
    ("corner", "угол", "n"),
    ("end", "конец", "n"),
    ("start", "начало", "n"),
    ("beginning", "начало", "n"),
    ("position", "положение", "n"),
    ("positioning", "позиционирование", "n"),
    ("place", "место", "n"),
    ("area", "зона", "n"),
    ("zone", "зона", "n"),
    ("section", "участок", "n"),
    ("part", "часть", "n"),
    ("island", "островок безопасности", "n"),
    ("bollard", "тумба", "n"),
    ("bollards", "тумбы", "n"),
    ("barrier", "ограждение", "n"),
    ("fence", "забор", "n"),
    ("wall", "стена", "n"),
    ("building", "здание", "n"),
    ("buildings", "здания", "n"),
    ("house", "дом", "n"),

    # ─── Actions on others ────────────────────────────────────────────────
    ("priority", "преимущество", "n"),
    ("right-of-way", "право проезда", "n"),
    ("permit", "разрешать", "v"),
    ("permitted", "разрешено", "adj"),
    ("allow", "разрешать", "v"),
    ("allowed", "разрешено", "adj"),
    ("forbid", "запрещать", "v"),
    ("forbidden", "запрещено", "adj"),
    ("require", "требовать", "v"),
    ("required", "требуется", "adj"),
    ("must", "должен", "v"),
    ("should", "следует", "v"),
    ("may", "можно", "v"),
    ("can", "можно", "v"),

    # ─── Frequency / time ────────────────────────────────────────────────
    ("always", "всегда", "adv"),
    ("never", "никогда", "adv"),
    ("often", "часто", "adv"),
    ("sometimes", "иногда", "adv"),
    ("immediately", "немедленно", "adv"),
    ("quickly", "быстро", "adv"),
    ("slowly", "медленно", "adv"),
    ("gradually", "постепенно", "adv"),
    ("suddenly", "внезапно", "adv"),
    ("before", "перед", "prep"),
    ("after", "после", "prep"),
    ("while", "пока", "conj"),
    ("during", "во время", "prep"),
    ("until", "до тех пор пока", "prep"),

    # ─── Misc driving terms ──────────────────────────────────────────────
    ("convoy", "колонна", "n"),
    ("queue", "очередь", "n"),
    ("congestion", "затор", "n"),
    ("jam", "пробка", "n"),
    ("breakdown", "поломка", "n"),
    ("collision", "столкновение", "n"),
    ("crash", "авария", "n"),
    ("accident", "ДТП", "n"),
    ("emergency", "экстренный", "adj"),
    ("ambulance", "скорая помощь", "n"),
    ("police", "полиция", "n"),
    ("fire", "пожарная", "n"),
    ("siren", "сирена", "n"),
    ("warning", "предупреждение", "n"),
    ("triangle", "знак аварийной остановки", "n"),
    ("hazard", "аварийная сигнализация", "n"),
    ("flashers", "аварийная сигнализация", "n"),
    ("recovery", "эвакуация", "n"),
    ("tow", "буксировать", "v"),
    ("towing", "буксировка", "n"),
    ("trailer", "прицеп", "n"),
    ("caravan", "автодом-прицеп", "n"),
    ("load", "груз", "n"),
    ("loaded", "загруженный", "adj"),

    # ─── Position / direction extras ─────────────────────────────────────
    ("north", "север", "n"),
    ("south", "юг", "n"),
    ("east", "восток", "n"),
    ("west", "запад", "n"),
    ("northbound", "в северном направлении", "adj"),
    ("southbound", "в южном направлении", "adj"),
    ("eastbound", "в восточном направлении", "adj"),
    ("westbound", "в западном направлении", "adj"),
    ("uphill", "в гору", "adv"),
    ("downhill", "под гору", "adv"),

    # ─── Common verbs in questions ───────────────────────────────────────
    ("see", "видеть", "v"),
    ("notice", "заметить", "v"),
    ("look", "смотреть", "v"),
    ("watch", "следить", "v"),
    ("check", "проверять", "v"),
    ("listen", "слушать", "v"),
    ("hear", "слышать", "v"),
    ("show", "показывать", "v"),
    ("shows", "показывает", "v"),
    ("mean", "означать", "v"),
    ("means", "означает", "v"),
    ("indicate", "указывать", "v"),
    ("indicates", "указывает", "v"),
    ("warn", "предупреждать", "v"),
    ("warns", "предупреждает", "v"),
    ("expect", "ожидать", "v"),
    ("avoid", "избегать", "v"),
    ("prevent", "предотвращать", "v"),
    ("cause", "вызывать", "v"),
    ("happen", "происходить", "v"),
    ("occur", "происходить", "v"),

    # ─── Question-specific helpers ───────────────────────────────────────
    ("question", "вопрос", "n"),
    ("answer", "ответ", "n"),
    ("correct", "правильный", "adj"),
    ("wrong", "неправильный", "adj"),
    ("incorrect", "неправильный", "adj"),
    ("true", "верно", "adj"),
    ("false", "неверно", "adj"),
    ("option", "вариант", "n"),
    ("choose", "выбрать", "v"),
    ("select", "выбрать", "v"),

    # ─── UK-specific extras seen in tests ────────────────────────────────
    ("dual", "разделённая", "adj"),
    ("single", "одна", "adj"),
    ("two-way", "двустороннее движение", "n"),
    ("one-way", "одностороннее движение", "n"),
    ("contraflow", "встречное реверсивное движение", "n"),
    ("chevron", "знак направления поворота", "n"),
    ("chevrons", "знаки направления поворота", "n"),
    ("rumble", "шумовая полоса", "n"),
    ("traffic-calming", "успокоение движения", "n"),
    ("speedhump", "лежачий полицейский", "n"),
    ("speedbump", "лежачий полицейский", "n"),
    ("pothole", "яма на дороге", "n"),
    ("gravel", "гравий", "n"),
    ("mud", "грязь", "n"),
    ("debris", "обломки", "n"),
    ("oil", "масло", "n"),
    ("spill", "разлив", "n"),
    ("leaves", "листья", "n"),
]


def main() -> None:
    db = SessionLocal()
    try:
        added = 0
        updated = 0
        skipped_dupes_in_input = 0
        seen_in_input: set[str] = set()

        for word_en, translation_ru, pos in GLOSSARY:
            key = word_en.strip().lower()
            if not key or not translation_ru.strip():
                continue
            if key in seen_in_input:
                skipped_dupes_in_input += 1
                continue
            seen_in_input.add(key)

            existing = (
                db.query(models.WordTranslation)
                .filter(models.WordTranslation.word_en == key)
                .first()
            )
            if existing:
                existing.translation_ru = translation_ru.strip()
                existing.pos = pos
                existing.is_curated = True
                existing.updated_at = datetime.utcnow()
                updated += 1
            else:
                db.add(
                    models.WordTranslation(
                        word_en=key,
                        translation_ru=translation_ru.strip(),
                        pos=pos,
                        is_curated=True,
                        updated_at=datetime.utcnow(),
                    )
                )
                added += 1

        db.commit()
        total = db.query(models.WordTranslation).count()
        print(f"Glossary seeded: {added} added, {updated} updated, "
              f"{skipped_dupes_in_input} duplicates in input skipped.")
        print(f"WordTranslation total rows: {total}")
    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
