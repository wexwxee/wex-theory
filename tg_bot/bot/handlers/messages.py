import io
import logging
from aiogram import Router, Bot, F
from aiogram.types import Message
import bot.services.supabase_client as db
from bot.services.gemini import (
    classify_message,
    generate_response,
    transcribe_voice,
    describe_photo,
)
from bot.services.notion import create_note
from bot.utils.parser import extract_tags, detect_done_intent

router = Router()
logger = logging.getLogger(__name__)

CATEGORY_EMOJI = {
    "задача": "✅",
    "мысль": "🧠",
    "идея": "💡",
    "напоминание": "⏰",
}


async def _process_and_save(message: Message, bot: Bot, text: str) -> None:
    tags_from_text = extract_tags(text)

    classification = await classify_message(text)
    category = classification.get("category", "мысль")
    priority = classification.get("priority", "средний")
    tags = list(set(tags_from_text + classification.get("tags", [])))
    reminder_time = classification.get("reminder_time")
    reminder_cron = classification.get("reminder_cron")
    summary = classification.get("summary", text[:80])

    context = await db.get_recent_records(message.chat.id, limit=20)

    notion_page_id = await create_note(
        content=text,
        category=category,
        priority=priority,
        tags=tags,
        summary=summary,
        reminder_time=reminder_time,
    )

    record = await db.save_record(
        chat_id=message.chat.id,
        content=text,
        category=category,
        priority=priority,
        tags=tags,
        summary=summary,
        reminder_time=reminder_time,
        reminder_cron=reminder_cron,
        notion_page_id=notion_page_id,
    )

    ai_reply = await generate_response(text, context)

    emoji = CATEGORY_EMOJI.get(category, "📝")
    tags_str = " ".join(tags) if tags else ""
    header = f"{emoji} *{category.capitalize()}* · {priority}"
    if tags_str:
        header += f"\n🏷 {tags_str}"
    if reminder_time:
        header += f"\n⏰ {reminder_time}"
    if reminder_cron:
        header += f"\n🔁 Повтор: `{reminder_cron}`"
    header += f"\n`id: {record.get('id', '?')}`"

    await message.answer(f"{header}\n\n{ai_reply}", parse_mode="Markdown")


@router.message(F.text)
async def handle_text(message: Message, bot: Bot) -> None:
    text = message.text or ""

    if detect_done_intent(text):
        words = text.lower().split()
        search_term = " ".join(words[1:]) if len(words) > 1 else ""
        if search_term:
            task = await db.find_task_by_text(message.chat.id, search_term)
            if task:
                await db.close_task(task["id"])
                await message.answer(
                    f"✅ Закрыл задачу `{task['id']}`: {task.get('ai_summary') or task['content'][:60]}",
                    parse_mode="Markdown",
                )
                return

    await _process_and_save(message, bot, text)


@router.message(F.voice)
async def handle_voice(message: Message, bot: Bot) -> None:
    await message.answer("🎤 Транскрибирую голосовое...")
    try:
        file = await bot.get_file(message.voice.file_id)
        buf = io.BytesIO()
        await bot.download_file(file.file_path, buf)
        audio_bytes = buf.getvalue()

        text = await transcribe_voice(audio_bytes, mime_type="audio/ogg")
        if not text:
            await message.answer("Не удалось распознать голосовое сообщение.")
            return

        await message.answer(f"📝 Распознано: _{text}_", parse_mode="Markdown")
        await _process_and_save(message, bot, text)
    except Exception as e:
        logger.error("handle_voice error: %s", e)
        await message.answer("Ошибка при обработке голосового сообщения.")


@router.message(F.photo)
async def handle_photo(message: Message, bot: Bot) -> None:
    await message.answer("🖼 Анализирую фото...")
    try:
        photo = message.photo[-1]
        file = await bot.get_file(photo.file_id)
        buf = io.BytesIO()
        await bot.download_file(file.file_path, buf)
        image_bytes = buf.getvalue()

        caption = message.caption or ""
        description = await describe_photo(image_bytes, caption=caption)
        combined = f"{caption}\n\n[Фото]: {description}".strip()

        await _process_and_save(message, bot, combined)
    except Exception as e:
        logger.error("handle_photo error: %s", e)
        await message.answer("Ошибка при обработке фото.")
