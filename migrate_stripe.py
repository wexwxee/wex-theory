"""Run once to add Stripe columns to existing SQLite DB: py migrate_stripe.py"""
import sqlite3

conn = sqlite3.connect("wex_theory.db")
cur = conn.cursor()

migrations = [
    "ALTER TABLE users ADD COLUMN stripe_customer_id TEXT",
    "ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT",
    "ALTER TABLE users ADD COLUMN subscription_status TEXT DEFAULT 'free'",
    "ALTER TABLE users ADD COLUMN current_period_end DATETIME",
]

for sql in migrations:
    try:
        cur.execute(sql)
        print(f"OK: {sql}")
    except Exception as e:
        print(f"SKIP: {e}")

conn.commit()
conn.close()
print("Migration complete.")
