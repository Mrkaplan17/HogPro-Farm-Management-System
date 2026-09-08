"""One-shot database reset: DROPS every table and recreates the schema from scratch.

Usage (from the backend/ directory, with the API server STOPPED):
    python reset_db.py

This permanently deletes ALL data (batches, cages, expenses, feed logs,
mortalities, sales, and user accounts). Start fresh afterwards.
"""

from database import engine, Base
import models  # noqa: F401  (registers all tables on Base)
import main    # noqa: F401  (runs create_all + _ensure_columns)

if __name__ == "__main__":
    import os

    if os.environ.get("RESET_FORCE") != "1":
        confirm = input("This wipes ALL data in piggery.db. Type 'RESET' to continue: ").strip()
        if confirm != "RESET":
            print("Aborted.")
            raise SystemExit(1)

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    try:
        with engine.begin() as conn:
            conn.exec_driver_sql(
                "UPDATE sqlite_sequence SET seq = 0 WHERE name IN "
                "(SELECT name FROM sqlite_sequence)"
            )
    except Exception:
        pass  # no AUTOINCREMENT sequences present — harmless

    print("Database reset complete. All tables recreated.")