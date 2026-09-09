import sqlite3
import pytest
from backend.app.database import get_connection, SCHEMA_SQL

def test_visits_table_has_dispatch_columns():
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(visits)")
    cols = {row[1]: row[2] for row in cur.fetchall()}
    
    assert "dispatched_at" in cols, "visits table missing dispatched_at column"
    assert "dispatched_to" in cols, "visits table missing dispatched_to column"
    assert "dispatched_by_user_id" in cols, "visits table missing dispatched_by_user_id column"

def test_visits_schema_sql_has_dispatch_columns():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQL)
    cur = conn.cursor()
    cur.execute("PRAGMA table_info(visits)")
    cols = {row[1]: row[2] for row in cur.fetchall()}
    
    assert "dispatched_at" in cols
    assert "dispatched_to" in cols
    assert "dispatched_by_user_id" in cols
    conn.close()
