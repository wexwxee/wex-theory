import logging
from datetime import datetime, timedelta, timezone
from typing import Optional
from supabase import create_client, Client
from bot.config import SUPABASE_URL, SUPABASE_KEY

logger = logging.getLogger(__name__)

_client: Optional[Client] = None


def get_client() -> Client:
    global _client
    if _client is None:
        _client = create_client(SUPABASE_URL, SUPABASE_KEY)
    return _client


async def save_record(
    chat_id: int,
    content: str,
    category: str,
    priority: str,
    tags: list[str],
    summary: str,
    reminder_time: Optional[str] = None,
    reminder_cron: Optional[str] = None,
    notion_page_id: Optional[str] = None,
) -> dict:
    db = get_client()
    data = {
        "chat_id": chat_id,
        "content": content,
        "category": category,
        "priority": priority,
        "tags": tags,
        "ai_summary": summary,
        "status": "open",
        "reminder_time": reminder_time,
        "reminder_cron": reminder_cron,
        "notion_page_id": notion_page_id,
    }
    result = db.table("records").insert(data).execute()
    return result.data[0] if result.data else {}


async def get_recent_records(chat_id: int, limit: int = 20) -> list[dict]:
    db = get_client()
    result = (
        db.table("records")
        .select("*")
        .eq("chat_id", chat_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


async def get_open_tasks(chat_id: int) -> list[dict]:
    db = get_client()
    result = (
        db.table("records")
        .select("*")
        .eq("chat_id", chat_id)
        .eq("category", "задача")
        .eq("status", "open")
        .order("priority")
        .execute()
    )
    return result.data or []


async def close_task(record_id: int) -> bool:
    db = get_client()
    result = (
        db.table("records")
        .update({"status": "done"})
        .eq("id", record_id)
        .execute()
    )
    return bool(result.data)


async def find_task_by_text(chat_id: int, text: str) -> Optional[dict]:
    db = get_client()
    result = (
        db.table("records")
        .select("*")
        .eq("chat_id", chat_id)
        .eq("status", "open")
        .ilike("content", f"%{text}%")
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


async def get_records_for_period(chat_id: int, days: int) -> list[dict]:
    db = get_client()
    since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    result = (
        db.table("records")
        .select("*")
        .eq("chat_id", chat_id)
        .gte("created_at", since)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data or []


async def get_pending_reminders() -> list[dict]:
    db = get_client()
    now = datetime.now(timezone.utc).isoformat()
    result = (
        db.table("records")
        .select("*")
        .eq("category", "напоминание")
        .eq("reminder_sent", False)
        .lte("reminder_time", now)
        .is_("reminder_cron", "null")
        .execute()
    )
    return result.data or []


async def mark_reminder_sent(record_id: int) -> None:
    db = get_client()
    db.table("records").update({"reminder_sent": True}).eq("id", record_id).execute()


async def get_recurring_reminders() -> list[dict]:
    db = get_client()
    result = (
        db.table("records")
        .select("*")
        .eq("category", "напоминание")
        .not_.is_("reminder_cron", "null")
        .execute()
    )
    return result.data or []
