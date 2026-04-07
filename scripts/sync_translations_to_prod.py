"""
One-shot migration: copy translations (_ru columns + word_translations table)
from the local SQLite DB to the production PostgreSQL database on Render.

USAGE
─────
1. Get the EXTERNAL database URL from the Render dashboard:
     Render → your PG service → "Connect" → "External Database URL"
   It looks like:
     postgresql://wex_user:XXX@dpg-abcdef-a.frankfurt-postgres.render.com/wex_theory

2. From the project root, run:

     # Windows PowerShell
     $env:TARGET_DATABASE_URL = "postgresql://...external url..."
     python scripts/sync_translations_to_prod.py

     # macOS / Linux
     TARGET_DATABASE_URL="postgresql://...external url..." \
         python scripts/sync_translations_to_prod.py

3. The script is IDEMPOTENT — safe to re-run. It will:
     - Make sure question_text_ru / explanation_ru / text_ru columns exist
       on the prod tables (ALTER TABLE ... ADD COLUMN IF NOT EXISTS).
     - Make sure the word_translations table exists.
     - Copy every non-null _ru value from local SQLite to prod by id.
     - Upsert every row from local word_translations into prod.

It does NOT touch any other table, user data, attempts, etc.
"""

from __future__ import annotations

import os
import sqlite3
import sys
from pathlib import Path

from sqlalchemy import create_engine, text

LOCAL_SQLITE_PATH = Path(__file__).resolve().parent.parent / "wex_theory.db"
BATCH_SIZE = 200


def _normalize_url(url: str) -> str:
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


def ensure_prod_schema(conn) -> None:
    """Add _ru columns and word_translations table on prod if missing."""
    print("[schema] Ensuring _ru columns and word_translations table exist on prod...")
    stmts = [
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS question_text_ru TEXT",
        "ALTER TABLE questions ADD COLUMN IF NOT EXISTS explanation_ru TEXT",
        "ALTER TABLE answers   ADD COLUMN IF NOT EXISTS text_ru TEXT",
        """
        CREATE TABLE IF NOT EXISTS word_translations (
            id              SERIAL PRIMARY KEY,
            word_en         VARCHAR NOT NULL UNIQUE,
            translation_ru  VARCHAR NOT NULL,
            pos             VARCHAR,
            is_curated      BOOLEAN DEFAULT FALSE,
            updated_at      TIMESTAMP DEFAULT NOW()
        )
        """,
        "CREATE INDEX IF NOT EXISTS ix_word_translations_word_en ON word_translations (word_en)",
    ]
    for stmt in stmts:
        conn.execute(text(stmt))
    conn.commit()
    print("[schema] OK")


def sync_questions(local: sqlite3.Connection, conn) -> None:
    rows = local.execute(
        """
        SELECT id, question_text_ru, explanation_ru
        FROM questions
        WHERE question_text_ru IS NOT NULL OR explanation_ru IS NOT NULL
        """
    ).fetchall()
    print(f"[questions] {len(rows)} rows with translations to push")
    updated = 0
    for i in range(0, len(rows), BATCH_SIZE):
        chunk = rows[i : i + BATCH_SIZE]
        for qid, q_ru, e_ru in chunk:
            conn.execute(
                text(
                    """
                    UPDATE questions
                    SET question_text_ru = :q_ru,
                        explanation_ru   = :e_ru
                    WHERE id = :qid
                    """
                ),
                {"qid": qid, "q_ru": q_ru, "e_ru": e_ru},
            )
            updated += 1
        conn.commit()
        print(f"[questions] {updated}/{len(rows)} pushed")
    print(f"[questions] DONE — {updated} rows updated")


def sync_answers(local: sqlite3.Connection, conn) -> None:
    rows = local.execute(
        "SELECT id, text_ru FROM answers WHERE text_ru IS NOT NULL"
    ).fetchall()
    print(f"[answers] {len(rows)} rows with translations to push")
    updated = 0
    for i in range(0, len(rows), BATCH_SIZE):
        chunk = rows[i : i + BATCH_SIZE]
        for aid, t_ru in chunk:
            conn.execute(
                text("UPDATE answers SET text_ru = :t_ru WHERE id = :aid"),
                {"aid": aid, "t_ru": t_ru},
            )
            updated += 1
        conn.commit()
        print(f"[answers] {updated}/{len(rows)} pushed")
    print(f"[answers] DONE — {updated} rows updated")


def sync_word_translations(local: sqlite3.Connection, conn) -> None:
    rows = local.execute(
        """
        SELECT word_en, translation_ru, pos, is_curated
        FROM word_translations
        """
    ).fetchall()
    print(f"[words] {len(rows)} word_translations to upsert")
    upserted = 0
    for i in range(0, len(rows), BATCH_SIZE):
        chunk = rows[i : i + BATCH_SIZE]
        for word_en, tr_ru, pos, curated in chunk:
            conn.execute(
                text(
                    """
                    INSERT INTO word_translations (word_en, translation_ru, pos, is_curated, updated_at)
                    VALUES (:w, :t, :p, :c, NOW())
                    ON CONFLICT (word_en) DO UPDATE
                    SET translation_ru = EXCLUDED.translation_ru,
                        pos            = EXCLUDED.pos,
                        is_curated     = EXCLUDED.is_curated,
                        updated_at     = NOW()
                    """
                ),
                {
                    "w": (word_en or "").strip().lower(),
                    "t": tr_ru,
                    "p": pos,
                    "c": bool(curated),
                },
            )
            upserted += 1
        conn.commit()
        print(f"[words] {upserted}/{len(rows)} upserted")
    print(f"[words] DONE — {upserted} rows upserted")


def main() -> int:
    target_url = os.environ.get("TARGET_DATABASE_URL", "").strip()
    if not target_url:
        print("ERROR: TARGET_DATABASE_URL env var is not set.")
        print("Set it to your Render External Database URL and re-run.")
        return 2
    target_url = _normalize_url(target_url)
    if not target_url.startswith("postgresql://"):
        print(f"ERROR: TARGET_DATABASE_URL must be a Postgres URL, got: {target_url[:24]}...")
        return 2

    if not LOCAL_SQLITE_PATH.exists():
        print(f"ERROR: local SQLite not found at {LOCAL_SQLITE_PATH}")
        return 2

    print(f"[local]  {LOCAL_SQLITE_PATH}")
    print(f"[target] {target_url.split('@')[-1]}")
    print()

    local = sqlite3.connect(str(LOCAL_SQLITE_PATH))
    engine = create_engine(target_url, future=True)

    try:
        with engine.connect() as conn:
            ensure_prod_schema(conn)
            sync_questions(local, conn)
            sync_answers(local, conn)
            sync_word_translations(local, conn)

            # Sanity counts
            q_with_ru = conn.execute(
                text("SELECT COUNT(*) FROM questions WHERE question_text_ru IS NOT NULL")
            ).scalar()
            a_with_ru = conn.execute(
                text("SELECT COUNT(*) FROM answers WHERE text_ru IS NOT NULL")
            ).scalar()
            words_total = conn.execute(text("SELECT COUNT(*) FROM word_translations")).scalar()
            print()
            print("=" * 50)
            print(f"PROD now has:")
            print(f"  questions with question_text_ru : {q_with_ru}")
            print(f"  answers   with text_ru          : {a_with_ru}")
            print(f"  word_translations rows          : {words_total}")
            print("=" * 50)
    finally:
        local.close()

    print("\n✓ Translation sync complete.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
