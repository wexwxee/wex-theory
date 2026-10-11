"""Optional "Explain my mistake" answers written by Claude.

Off until an admin switches it on and ANTHROPIC_API_KEY is set. Each case
(question, chosen answers, language, wording) is generated once and stored,
so repeat requests are free and the admin can read what students were shown.
"""

from __future__ import annotations

import base64
import os
from datetime import datetime
from pathlib import Path
from typing import Optional

import anthropic
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

import models

SETTING_KEY = "ai_explain_enabled"
MODEL = "claude-opus-5-5"
LANGUAGES = {"en": "English", "ru": "Russian"}
IMAGE_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif"}
MAX_IMAGE_BYTES = 3_700_000  # stays under the API's 5 MB limit once base64-encoded

SYSTEM_PROMPT = """You are the tutor inside WEX Theory, a practice site for the Danish driving theory test (category B).
A student has just reviewed one question. You get the question, the photo when there is one, every answer option with the official key, which options the student selected, and the official explanation.

Explain in {language}, in plain words, why the student's choice was wrong and what the correct reasoning is:
- Treat the official key as correct. Never contradict it or suggest the key is mistaken.
- Base the reasoning on the official explanation and on what is visible in the photo. If they do not settle a detail, say what to look for instead of inventing a rule, a number or a paragraph reference.
- Address the student directly. Name the options by their wording, not by letters or ids.
- Finish with one short tip that helps with similar questions.
- 80-160 words. Plain text only: no headings, no markdown, no lists longer than three short lines."""


def api_key_configured() -> bool:
    return bool((os.environ.get("ANTHROPIC_API_KEY") or "").strip())


def is_switched_on(db: Session) -> bool:
    row = db.get(models.AppSetting, SETTING_KEY)
    return bool(row and row.value == "1")


def is_enabled(db: Session) -> bool:
    return api_key_configured() and is_switched_on(db)


def set_switched_on(db: Session, enabled: bool) -> None:
    row = db.get(models.AppSetting, SETTING_KEY)
    if row is None:
        row = models.AppSetting(key=SETTING_KEY)
        db.add(row)
    row.value = "1" if enabled else "0"
    row.updated_at = datetime.utcnow()
    db.commit()


def stored_count(db: Session) -> int:
    return db.query(models.AiExplanation.id).count()


def daily_limit() -> int:
    """New explanations allowed per UTC day across the whole site (cost guard)."""
    try:
        return max(0, int(os.environ.get("AI_EXPLAIN_DAILY_LIMIT") or 200))
    except ValueError:
        return 200


def generated_today(db: Session, now: Optional[datetime] = None) -> int:
    start = (now or datetime.utcnow()).replace(hour=0, minute=0, second=0, microsecond=0)
    return db.query(models.AiExplanation.id).filter(models.AiExplanation.created_at >= start).count()


def selected_key(selected_ids: list[int]) -> str:
    return ",".join(str(answer_id) for answer_id in sorted(set(selected_ids)))


def find_stored(db: Session, question_id: int, key: str, lang: str, wording_mode: str) -> Optional[models.AiExplanation]:
    return db.query(models.AiExplanation).filter_by(
        question_id=question_id, selected_key=key, lang=lang, wording_mode=wording_mode,
    ).first()


def store(db: Session, *, question_id: int, key: str, lang: str, wording_mode: str, text: str) -> str:
    """Save a new explanation; if a parallel request saved one first, keep that one."""
    db.add(models.AiExplanation(
        question_id=question_id, selected_key=key, lang=lang,
        wording_mode=wording_mode, text=text, model=MODEL,
    ))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = find_stored(db, question_id, key, lang, wording_mode)
        if existing:
            return existing.text
    return text


def image_block(images_dir: Path, image_path: str) -> Optional[dict]:
    rel = (image_path or "").strip().lstrip("/")
    if rel.startswith("test-images/"):
        rel = rel[len("test-images/"):]
    if not rel:
        return None
    root = images_dir.resolve()
    file = (root / rel).resolve()
    media_type = IMAGE_TYPES.get(file.suffix.lower())
    if not media_type or root not in file.parents or not file.is_file():
        return None
    data = file.read_bytes()
    if len(data) > MAX_IMAGE_BYTES:
        return None
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": media_type, "data": base64.standard_b64encode(data).decode("ascii")},
    }


def build_case_text(*, question_text: str, answers: list[dict], selected_ids: list[int], official_explanation: str) -> str:
    chosen = set(selected_ids)
    lines = [f"Question: {question_text}", "", "Answer options:"]
    for answer in answers:
        key = "correct" if answer["is_correct"] else "incorrect"
        student = "selected by the student" if answer["id"] in chosen else "not selected"
        lines.append(f"- \"{answer['text']}\" — {key}; {student}")
    if not chosen:
        lines.append("(The student selected nothing.)")
    lines += ["", f"Official explanation: {official_explanation.strip() or '(none provided)'}"]
    return "\n".join(lines)


class ExplainError(Exception):
    """A failure the student can be told about in one sentence."""


async def generate(*, case_text: str, image: Optional[dict], lang: str) -> str:
    client = anthropic.AsyncAnthropic(timeout=60.0, max_retries=1)
    content = ([image] if image else []) + [{"type": "text", "text": case_text}]
    try:
        response = await client.beta.messages.create(
            model=MODEL,
            max_tokens=4000,
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
            output_config={"effort": "low"},
            system=SYSTEM_PROMPT.format(language=LANGUAGES[lang]),
            messages=[{"role": "user", "content": content}],
        )
    except anthropic.RateLimitError as e:
        raise ExplainError("The AI tutor is busy right now. Please try again in a minute.") from e
    except anthropic.APIStatusError as e:
        print(f"[AI EXPLAIN] API error status={e.status_code} request_id={getattr(e, 'request_id', None)}")
        raise ExplainError("The AI tutor is not available right now.") from e
    except anthropic.APIConnectionError as e:
        print(f"[AI EXPLAIN] connection error: {type(e).__name__}")
        raise ExplainError("The AI tutor could not be reached. Please try again.") from e
    finally:
        await client.close()

    if response.stop_reason == "refusal":
        raise ExplainError("The AI tutor could not explain this question. Use the official explanation above.")
    text = "\n".join(block.text for block in response.content if block.type == "text").strip()
    if not text:
        raise ExplainError("The AI tutor returned an empty answer. Please try again.")
    return text
