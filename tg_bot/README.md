# Telegram AI Assistant Bot

Персональный ИИ-ассистент на базе Gemini 2.5 Pro. Классифицирует сообщения, сохраняет в Supabase, создаёт заметки в Notion, отправляет напоминания.

## Возможности

- Обрабатывает текст, голосовые сообщения (OGG → Gemini Audio), фото (Gemini Vision)
- Классифицирует каждое сообщение: задача / мысль / идея / напоминание
- Сохраняет в Supabase с категорией, приоритетом, тегами, статусом
- Разбирает время из напоминаний, отправляет в назначенное время
- Поддерживает повторяющиеся напоминания (каждый день, каждый пн и т.д.)
- Записывает структурированные заметки в Notion
- Ежедневный дайджест в 09:00
- Команды /итоги, /задачи, /done
- Закрытие задачи словом «сделал»
- Теги через #хэштег
- Контекст: перед ответом подтягивает последние 20 записей

---

## Структура проекта

```
tg_bot/
├── bot/
│   ├── main.py              # Точка входа, webhook, APScheduler
│   ├── config.py            # Переменные окружения
│   ├── handlers/
│   │   ├── commands.py      # /задачи, /итоги, /done, /start
│   │   └── messages.py      # Текст, голос, фото
│   ├── services/
│   │   ├── gemini.py        # Gemini 2.5 Pro: классификация, транскрипция, ответы
│   │   ├── supabase_client.py  # CRUD для записей
│   │   ├── notion.py        # Создание заметок в Notion
│   │   └── scheduler.py     # APScheduler: дайджест, напоминания
│   └── utils/
│       └── parser.py        # Парсинг тегов, детект «сделал»
├── requirements.txt
├── render.yaml
├── supabase_schema.sql      # SQL для создания таблицы
└── .env.example
```

---

## Шаг 1 — Supabase

1. Зайди на [supabase.com](https://supabase.com), создай проект
2. Открой **SQL Editor** и выполни содержимое `supabase_schema.sql`
3. Перейди в **Project Settings → API**:
   - Скопируй `Project URL` → `SUPABASE_URL`
   - Скопируй `anon public` ключ → `SUPABASE_KEY`

### Notion Database (для заметок)

Создай БД в Notion со следующими свойствами:

| Поле | Тип |
|------|-----|
| Name | Title |
| Category | Select |
| Priority | Select |
| Status | Select |
| Tags | Multi-select |
| Created | Date |
| Reminder | Date |

---

## Шаг 2 — Notion Integration

1. Перейди на [notion.so/my-integrations](https://www.notion.so/my-integrations)
2. Создай интеграцию, скопируй **Internal Integration Secret** → `NOTION_TOKEN`
3. Открой свою Notion-базу данных → **Share → Invite** → добавь свою интеграцию
4. Скопируй ID базы данных из URL: `notion.so/xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx?v=...`
   - Первые 32 символа после последнего `/` — это `NOTION_DB_ID`

---

## Шаг 3 — Telegram Bot

1. Открой [@BotFather](https://t.me/BotFather) в Telegram
2. `/newbot` → задай имя и username
3. Скопируй токен → `BOT_TOKEN`
4. Узнай свой Chat ID: напиши боту [@userinfobot](https://t.me/userinfobot) → `MY_CHAT_ID`

---

## Шаг 4 — Gemini API

1. Перейди на [aistudio.google.com](https://aistudio.google.com)
2. **Get API Key** → создай ключ → `GEMINI_API_KEY`

---

## Шаг 5 — Деплой на Render

### 5.1 Подготовь репозиторий

```bash
cd tg_bot
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

### 5.2 Создай Web Service на Render

1. Зайди на [render.com](https://render.com) → **New → Web Service**
2. Подключи GitHub репозиторий
3. Настройки:
   - **Environment**: Python
   - **Build Command**: `pip install -r requirements.txt`
   - **Start Command**: `python -m bot.main`
   - **Instance Type**: Free (или Starter для продакшена)

### 5.3 Переменные окружения на Render

В разделе **Environment** добавь все переменные:

```
BOT_TOKEN=...
GEMINI_API_KEY=...
SUPABASE_URL=...
SUPABASE_KEY=...
NOTION_TOKEN=...
NOTION_DB_ID=...
WEBHOOK_URL=https://your-app-name.onrender.com
MY_CHAT_ID=...
TIMEZONE=Europe/Moscow
PORT=8000
```

> **WEBHOOK_URL** — это URL твоего сервиса на Render (без `/webhook` на конце)

### 5.4 Деплой

После добавления всех переменных нажми **Deploy**. Render автоматически:
- Установит зависимости
- Запустит бота
- Настроит webhook

---

## Локальный запуск (для разработки)

```bash
cd tg_bot
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# Заполни .env своими данными
```

Для локальной разработки используй [ngrok](https://ngrok.com) вместо Render:

```bash
ngrok http 8000
# Скопируй HTTPS URL в WEBHOOK_URL в .env
python -m bot.main
```

---

## Использование

| Действие | Результат |
|----------|-----------|
| Написать текст | Классифицируется, сохраняется, создаётся заметка в Notion |
| `Напомни мне завтра в 10 позвонить врачу` | Напоминание в 10:00 |
| `Каждый понедельник в 8 утра напоминай про планёрку` | Повторяющееся напоминание |
| `Сделал позвонить врачу` | Бот найдёт и закроет задачу |
| `/задачи` | Список открытых задач с id и приоритетом |
| `/done 42` | Закрыть задачу по id |
| `/итоги` | Дайджест за день и неделю |
| Голосовое сообщение | Транскрипция → обработка |
| Фото (с подписью или без) | Описание через Gemini Vision → сохранение |

---

## Troubleshooting

**Бот не отвечает на Render**
- Проверь логи в Render Dashboard → Logs
- Убедись что WEBHOOK_URL не заканчивается на `/`

**Ошибки Supabase**
- Проверь что таблица `records` создана через `supabase_schema.sql`
- Проверь SUPABASE_URL и SUPABASE_KEY

**Notion не создаёт заметки**
- Убедись что интеграция добавлена к базе данных (Share → Invite)
- Проверь что NOTION_DB_ID правильный (32 символа hex)

**Напоминания не приходят**
- На бесплатном плане Render сервис засыпает после 15 мин бездействия
- Используй [cron-job.org](https://cron-job.org) чтобы пинговать `https://your-app.onrender.com/webhook` каждые 10 мин
- Или перейди на платный план Render Starter
