import logging
from aiohttp import web
from aiogram import Bot, Dispatcher
from aiogram.webhook.aiohttp_server import SimpleRequestHandler, setup_application
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from bot.config import BOT_TOKEN, WEBHOOK_URL, PORT
from bot.handlers import commands, messages
from bot.services.scheduler import setup_scheduler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


async def on_startup(bot: Bot, scheduler: AsyncIOScheduler) -> None:
    webhook_url = f"{WEBHOOK_URL}/webhook"
    await bot.set_webhook(webhook_url, drop_pending_updates=True)
    scheduler.start()
    logger.info("Webhook set to %s", webhook_url)


async def on_shutdown(bot: Bot, scheduler: AsyncIOScheduler) -> None:
    scheduler.shutdown(wait=False)
    await bot.delete_webhook()
    logger.info("Bot stopped")


def main() -> None:
    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher()
    scheduler = AsyncIOScheduler()

    setup_scheduler(scheduler, bot)

    dp.include_router(commands.router)
    dp.include_router(messages.router)

    dp.startup.register(lambda: on_startup(bot, scheduler))
    dp.shutdown.register(lambda: on_shutdown(bot, scheduler))

    app = web.Application()
    SimpleRequestHandler(dispatcher=dp, bot=bot).register(app, path="/webhook")
    setup_application(app, dp, bot=bot)

    web.run_app(app, host="0.0.0.0", port=PORT)


if __name__ == "__main__":
    main()
