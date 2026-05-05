import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN: str = os.environ["BOT_TOKEN"]
GEMINI_API_KEY: str = os.environ["GEMINI_API_KEY"]
SUPABASE_URL: str = os.environ["SUPABASE_URL"]
SUPABASE_KEY: str = os.environ["SUPABASE_KEY"]
NOTION_TOKEN: str = os.environ["NOTION_TOKEN"]
NOTION_DB_ID: str = os.environ["NOTION_DB_ID"]
WEBHOOK_URL: str = os.environ["WEBHOOK_URL"]
MY_CHAT_ID: int = int(os.environ["MY_CHAT_ID"])
PORT: int = int(os.getenv("PORT", "8000"))
TIMEZONE: str = os.getenv("TIMEZONE", "Europe/Moscow")
