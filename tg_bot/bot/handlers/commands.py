import logging
from aiogram import Router
from aiogram.filters import Command
from aiogram.types import Message
import bot.services.supabase_client as db
from bot.services.gemini import generate_digest

router = Router()
logger = logging.getLogger(__name__)

PRIORITY_ORDER = {"высокий": 0, "средний": 1, "низкий": 2}


@router.message(Command("задачи", "tasks"))
async def cmd_tasks(message: Message) -> None:
    tasks = await db.get_open_tasks(message.chat.id)
    if not tasks:
        await message.answer("✅ Открытых задач нет!")
        return

    lines = ["📋 *Открытые задачи:*\n"]
    for t in tasks:
        priority_icon = {"высокий": "🔴", "средний": "🟡", "низкий": "🟢"}.get(t.get("priority", ""), "⚪")
        tags = " ".join(t.get("tags") or [])
        text = t.get("ai_summary") or t["content"][:60]
        lines.append(f"{priority_icon} `{t['id']}` — {text} {tags}")

    lines.append("\nЗакрыть: /done [id] или напиши «сделал [часть задачи]»")
    await message.answer("\n".join(lines), parse_mode="Markdown")


@router.message(Command("done"))
async def cmd_done(message: Message) -> None:
    parts = message.text.split(maxsplit=1) if message.text else []
    if len(parts) < 2 or not parts[1].strip().isdigit():
        await message.answer("Укажи id задачи: /done 42")
        return

    record_id = int(parts[1].strip())
    success = await db.close_task(record_id)
    if success:
        await message.answer(f"✅ Задача `{record_id}` закрыта!", parse_mode="Markdown")
    else:
        await message.answer(f"Задача `{record_id}` не найдена.", parse_mode="Markdown")


@router.message(Command("итоги", "summary"))
async def cmd_summary(message: Message) -> None:
    day_records = await db.get_records_for_period(message.chat.id, days=1)
    week_records = await db.get_records_for_period(message.chat.id, days=7)

    day_text = await generate_digest(day_records, period="день")
    week_text = await generate_digest(week_records, period="неделю")

    await message.answer(day_text, parse_mode="Markdown")
    await message.answer(week_text, parse_mode="Markdown")


@router.message(Command("start", "help"))
async def cmd_start(message: Message) -> None:
    text = (
        "👋 *Персональный ИИ-ассистент*\n\n"
        "Просто пиши мне — я классифицирую, сохраню и отвечу.\n\n"
        "*Форматы:*\n"
        "• Текст — задача, идея, мысль или напоминание\n"
        "• Голосовое сообщение — транскрибирую и обработаю\n"
        "• Фото — опишу и сохраню\n"
        "• #тег — добавь теги к любому сообщению\n\n"
        "*Команды:*\n"
        "/задачи — список открытых задач\n"
        "/итоги — дайджест за день и неделю\n"
        "/done [id] — закрыть задачу\n\n"
        "Также можешь написать «сделал [задача]» — я найду и закрою."
    )
    await message.answer(text, parse_mode="Markdown")
