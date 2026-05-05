import logging
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from aiogram import Bot
from bot.config import MY_CHAT_ID, TIMEZONE
import bot.services.supabase_client as db
from bot.services.gemini import generate_digest

logger = logging.getLogger(__name__)


async def send_daily_digest(bot: Bot) -> None:
    try:
        records = await db.get_records_for_period(MY_CHAT_ID, days=1)
        text = await generate_digest(records, period="день")
        await bot.send_message(MY_CHAT_ID, text, parse_mode="Markdown")
    except Exception as e:
        logger.error("send_daily_digest error: %s", e)


async def check_one_time_reminders(bot: Bot) -> None:
    try:
        reminders = await db.get_pending_reminders()
        for r in reminders:
            await bot.send_message(
                r["chat_id"],
                f"⏰ *Напоминание:*\n{r.get('ai_summary') or r['content']}",
                parse_mode="Markdown",
            )
            await db.mark_reminder_sent(r["id"])
    except Exception as e:
        logger.error("check_one_time_reminders error: %s", e)


async def reload_recurring_reminders(scheduler: AsyncIOScheduler, bot: Bot) -> None:
    try:
        reminders = await db.get_recurring_reminders()
        for r in reminders:
            job_id = f"recurring_{r['id']}"
            if scheduler.get_job(job_id):
                continue
            cron = r.get("reminder_cron")
            if not cron:
                continue
            parts = cron.strip().split()
            if len(parts) != 5:
                continue
            minute, hour, day, month, day_of_week = parts
            scheduler.add_job(
                _send_recurring,
                CronTrigger(
                    minute=minute,
                    hour=hour,
                    day=day,
                    month=month,
                    day_of_week=day_of_week,
                    timezone=TIMEZONE,
                ),
                args=[bot, r["chat_id"], r.get("ai_summary") or r["content"]],
                id=job_id,
                replace_existing=False,
                misfire_grace_time=300,
            )
    except Exception as e:
        logger.error("reload_recurring_reminders error: %s", e)


async def _send_recurring(bot: Bot, chat_id: int, text: str) -> None:
    await bot.send_message(chat_id, f"⏰ *Повторяющееся напоминание:*\n{text}", parse_mode="Markdown")


def setup_scheduler(scheduler: AsyncIOScheduler, bot: Bot) -> None:
    # Daily digest at 09:00
    scheduler.add_job(
        send_daily_digest,
        CronTrigger(hour=9, minute=0, timezone=TIMEZONE),
        args=[bot],
        id="daily_digest",
        replace_existing=True,
    )

    # Check one-time reminders every minute
    scheduler.add_job(
        check_one_time_reminders,
        "interval",
        minutes=1,
        args=[bot],
        id="check_reminders",
        replace_existing=True,
    )

    # Reload recurring reminders every 5 minutes
    scheduler.add_job(
        reload_recurring_reminders,
        "interval",
        minutes=5,
        args=[scheduler, bot],
        id="reload_recurring",
        replace_existing=True,
    )
