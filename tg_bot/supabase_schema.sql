-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS records (
    id BIGSERIAL PRIMARY KEY,
    chat_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    category TEXT CHECK (category IN ('задача', 'мысль', 'идея', 'напоминание')),
    priority TEXT CHECK (priority IN ('высокий', 'средний', 'низкий')) DEFAULT 'средний',
    status TEXT CHECK (status IN ('open', 'done')) DEFAULT 'open',
    tags TEXT[] DEFAULT '{}',
    reminder_time TIMESTAMPTZ,
    reminder_cron TEXT,
    reminder_sent BOOLEAN DEFAULT FALSE,
    notion_page_id TEXT,
    ai_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_records_chat_id ON records(chat_id);
CREATE INDEX idx_records_category ON records(category);
CREATE INDEX idx_records_status ON records(status);
CREATE INDEX idx_records_reminder ON records(reminder_time) WHERE reminder_sent = FALSE;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER records_updated_at
    BEFORE UPDATE ON records
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
