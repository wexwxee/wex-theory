import json
import base64
import logging
import re
from typing import Optional
import google.generativeai as genai
from bot.config import GEMINI_API_KEY

logger = logging.getLogger(__name__)

genai.configure(api_key=GEMINI_API_KEY)
_model = genai.GenerativeModel("gemini-2.5-pro")

_CLASSIFY_PROMPT = """
Ты помощник по классификации сообщений. Проанализируй сообщение пользователя.

Категории:
- задача — что нужно сделать
- мысль — наблюдение, размышление, факт
- идея — новая идея, предложение, план
- напоминание — напоминание о чём-то в конкретное время

Правила для напоминаний:
- Если есть время/дата → категория "напоминание"
- Повторяющиеся: "каждый день" → cron "0 9 * * *" (или указанное время), "каждый понедельник" → "0 9 * * 1"
- reminder_time — ISO 8601 с учётом часового пояса Europe/Moscow (текущий год {year})
- Если время не указано явно — поставь 09:00 текущего или следующего дня

Теги: извлеки все #хэштеги из текста.

Ответь СТРОГО валидным JSON (без markdown, без пояснений):
{{
  "category": "задача|мысль|идея|напоминание",
  "priority": "высокий|средний|низкий",
  "tags": ["тег1", "тег2"],
  "reminder_time": "2024-01-15T09:00:00+03:00 или null",
  "reminder_cron": "cron-строка или null",
  "summary": "краткое описание в 1 предложении"
}}

Сообщение: {text}
"""

_RESPONSE_PROMPT = """
Ты персональный ИИ-ассистент. Отвечай кратко, по делу, на русском языке.

Контекст последних записей пользователя:
{context}

Текущее сообщение пользователя: {text}

Дай полезный ответ. Если это задача/идея/мысль — подтверди сохранение и дай краткий совет или наблюдение.
Если напоминание — подтверди время.
"""


def _extract_json(text: str) -> dict:
    text = text.strip()
    # strip markdown code fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    return json.loads(text)


async def classify_message(text: str) -> dict:
    from datetime import datetime
    year = datetime.now().year
    prompt = _CLASSIFY_PROMPT.format(text=text, year=year)
    try:
        response = await _model.generate_content_async(prompt)
        return _extract_json(response.text)
    except Exception as e:
        logger.error("classify_message error: %s", e)
        return {
            "category": "мысль",
            "priority": "средний",
            "tags": [],
            "reminder_time": None,
            "reminder_cron": None,
            "summary": text[:100],
        }


async def generate_response(text: str, context_records: list[dict]) -> str:
    context_lines = []
    for r in context_records:
        line = f"[{r.get('category', '?')}] {r.get('ai_summary') or r.get('content', '')[:80]}"
        context_lines.append(line)
    context = "\n".join(context_lines) if context_lines else "Записей нет."
    prompt = _RESPONSE_PROMPT.format(context=context, text=text)
    try:
        response = await _model.generate_content_async(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error("generate_response error: %s", e)
        return "Записал. Что-то пошло не так с генерацией ответа, но данные сохранены."


async def transcribe_voice(audio_bytes: bytes, mime_type: str = "audio/ogg") -> str:
    prompt = "Транскрибируй эту голосовую запись на русском языке. Верни только текст, без пояснений."
    audio_part = {"mime_type": mime_type, "data": base64.b64encode(audio_bytes).decode()}
    try:
        response = await _model.generate_content_async([prompt, audio_part])
        return response.text.strip()
    except Exception as e:
        logger.error("transcribe_voice error: %s", e)
        return ""


async def describe_photo(image_bytes: bytes, caption: Optional[str] = None) -> str:
    prompt = (
        f"Опиши что на фото и извлеки ключевую информацию. "
        f"{'Подпись пользователя: ' + caption if caption else ''}"
        f" Ответь на русском языке."
    )
    image_part = {"mime_type": "image/jpeg", "data": base64.b64encode(image_bytes).decode()}
    try:
        response = await _model.generate_content_async([prompt, image_part])
        return response.text.strip()
    except Exception as e:
        logger.error("describe_photo error: %s", e)
        return caption or "Фото без описания"


async def generate_digest(records: list[dict], period: str = "день") -> str:
    if not records:
        return f"За {period} нет записей."

    items = []
    for r in records:
        items.append(
            f"- [{r.get('category')}|{r.get('priority')}|{r.get('status')}] "
            f"{r.get('ai_summary') or r.get('content', '')[:100]}"
        )
    records_text = "\n".join(items)

    prompt = (
        f"Сделай структурированный дайджест за {period} на русском языке.\n"
        f"Записи:\n{records_text}\n\n"
        f"Формат:\n"
        f"📊 **Дайджест за {period}**\n"
        f"✅ Задачи: ...\n"
        f"💡 Идеи: ...\n"
        f"🧠 Мысли: ...\n"
        f"⏰ Напоминания: ...\n"
        f"📈 Итог и рекомендация на завтра: ..."
    )
    try:
        response = await _model.generate_content_async(prompt)
        return response.text.strip()
    except Exception as e:
        logger.error("generate_digest error: %s", e)
        return f"Дайджест за {period}:\n" + records_text
