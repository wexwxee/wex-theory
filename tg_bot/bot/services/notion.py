import logging
from datetime import datetime, timezone
from typing import Optional
from notion_client import AsyncClient
from bot.config import NOTION_TOKEN, NOTION_DB_ID

logger = logging.getLogger(__name__)

_client: Optional[AsyncClient] = None

CATEGORY_EMOJI = {
    "задача": "✅",
    "мысль": "🧠",
    "идея": "💡",
    "напоминание": "⏰",
}

PRIORITY_COLOR = {
    "высокий": "red",
    "средний": "yellow",
    "низкий": "green",
}


def get_client() -> AsyncClient:
    global _client
    if _client is None:
        _client = AsyncClient(auth=NOTION_TOKEN)
    return _client


async def create_note(
    content: str,
    category: str,
    priority: str,
    tags: list[str],
    summary: str,
    reminder_time: Optional[str] = None,
) -> Optional[str]:
    notion = get_client()
    emoji = CATEGORY_EMOJI.get(category, "📝")
    title = f"{emoji} {summary[:80]}"

    properties: dict = {
        "Name": {"title": [{"text": {"content": title}}]},
        "Category": {"select": {"name": category}},
        "Priority": {"select": {"name": priority, "color": PRIORITY_COLOR.get(priority, "default")}},
        "Status": {"select": {"name": "open"}},
        "Created": {"date": {"start": datetime.now(timezone.utc).isoformat()}},
    }

    if tags:
        properties["Tags"] = {"multi_select": [{"name": t.lstrip("#")} for t in tags[:5]]}

    if reminder_time:
        properties["Reminder"] = {"date": {"start": reminder_time}}

    children = [
        {
            "object": "block",
            "type": "paragraph",
            "paragraph": {
                "rich_text": [{"type": "text", "text": {"content": content[:2000]}}]
            },
        }
    ]

    try:
        page = await notion.pages.create(
            parent={"database_id": NOTION_DB_ID},
            properties=properties,
            children=children,
        )
        return page["id"]
    except Exception as e:
        logger.error("notion create_note error: %s", e)
        return None
