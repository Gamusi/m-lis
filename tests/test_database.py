import pytest
import sqlite3
from backend.app.database import SCHEMA_SQL, init_db, get_connection

def test_schema_creates_all_required_tables(db_connection):
    cur = db_connection.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = {row["name"] for row in cur.fetchall()}
    
    expected_tables = {
        "users", "user_sessions", "sections", "tests", "test_parameters",
        "daily_entries", "audit_log", "clients", "clinicians", "wards",
        "sequence_tracker", "visits", "test_orders", "test_results"
    }
    for table in expected_tables:
        assert table in tables, f"Expected table '{table}' not found in database"

def test_wards_table_columns(db_connection):
    cur = db_connection.cursor()
    cur.execute("PRAGMA table_info(wards)")
    columns = {row["name"]: row["type"] for row in cur.fetchall()}
    
    assert "id" in columns
    assert "name" in columns
    assert "is_active" in columns

def test_clinicians_table_columns_and_preseed(db_connection):
    cur = db_connection.cursor()
    cur.execute("PRAGMA table_info(clinicians)")
    columns = {row["name"]: row["type"] for row in cur.fetchall()}
    
    assert "id" in columns
    assert "name" in columns
    assert "is_active" in columns
    assert "created_at" in columns
    
    # Check pre-seeded 'SELF REQUEST'
    cur.execute("SELECT * FROM clinicians WHERE name = 'SELF REQUEST'")
    row = cur.fetchone()
    assert row is not None
    assert row["name"] == "SELF REQUEST"
    assert row["is_active"] == 1

def test_sequence_tracker_table_columns_and_behavior(db_connection):
    cur = db_connection.cursor()
    cur.execute("PRAGMA table_info(sequence_tracker)")
    columns = {row["name"]: row["type"] for row in cur.fetchall()}
    
    assert "id" in columns
    assert "seq_name" in columns
    assert "last_value" in columns
    
    cur.execute("INSERT INTO sequence_tracker (seq_name, last_value) VALUES ('lab_number', 10)")
    db_connection.commit()
    
    cur.execute("SELECT * FROM sequence_tracker WHERE seq_name = 'lab_number'")
    row = cur.fetchone()
    assert row["last_value"] == 10

def test_visits_table_columns_and_foreign_keys(db_connection):
    cur = db_connection.cursor()
    cur.execute("PRAGMA table_info(visits)")
    columns = {row["name"]: row["type"] for row in cur.fetchall()}
    
    assert "id" in columns
    assert "client_id" in columns
    assert "clinician_id" in columns
    assert "ward_of_origin" in columns
    assert "lab_number" in columns
    assert "created_at" in columns
    
    # Insert client and clinician
    cur.execute("INSERT INTO clients (client_number, full_name) VALUES ('C100', 'Jane Doe')")
    client_id = cur.lastrowid
    
    cur.execute("INSERT INTO clinicians (name) VALUES ('Dr. Alex')")
    clinician_id = cur.lastrowid
    
    # Insert visit
    cur.execute(
        "INSERT INTO visits (client_id, clinician_id, ward_of_origin, lab_number) VALUES (?, ?, 'Maternity', 'LAB-100')",
        (client_id, clinician_id)
    )
    visit_id = cur.lastrowid
    assert visit_id is not None
    
    # Lab number uniqueness
    with pytest.raises(sqlite3.IntegrityError):
        cur.execute(
            "INSERT INTO visits (client_id, clinician_id, ward_of_origin, lab_number) VALUES (?, ?, 'OPD', 'LAB-100')",
            (client_id, clinician_id)
        )

def test_test_orders_table_has_visit_id(db_connection):
    cur = db_connection.cursor()
    cur.execute("PRAGMA table_info(test_orders)")
    columns = {row["name"]: row["type"] for row in cur.fetchall()}
    
    assert "visit_id" in columns
    assert "client_id" not in columns
    assert "test_id" in columns
    assert "sample_id" in columns
    assert "ordered_by_user_id" in columns
    assert "ordered_at" in columns
    assert "status" in columns
    
    # Foreign key check
    cur.execute("INSERT INTO sections (name) VALUES ('General')")
    sec_id = cur.lastrowid
    cur.execute("INSERT INTO tests (name, section_id) VALUES ('Malaria Test', ?)", (sec_id,))
    test_id = cur.lastrowid
    
    cur.execute("INSERT INTO clients (client_number, full_name) VALUES ('C101', 'Bob Smith')")
    client_id = cur.lastrowid
    
    cur.execute("INSERT INTO visits (client_id, ward_of_origin, lab_number) VALUES (?, 'OPD', 'LAB-101')", (client_id,))
    visit_id = cur.lastrowid
    
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (visit_id, test_id))
    order_id = cur.lastrowid
    assert order_id is not None

def test_init_db_idempotency(tmp_path, monkeypatch):
    test_db_file = str(tmp_path / "test_amh.db")
    monkeypatch.setattr("backend.app.database.DB_PATH", test_db_file)
    
    # First init
    init_db()
    
    # Second init (should be idempotent)
    init_db()
    
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) as cnt FROM clinicians WHERE name = 'SELF REQUEST'")
    row = cur.fetchone()
    assert row["cnt"] == 1
    conn.close()

def test_ward_seeding_paediatric(tmp_path, monkeypatch):
    from backend.app.seed import seed_database
    test_db_file = str(tmp_path / "test_paed.db")
    monkeypatch.setattr("backend.app.database.DB_PATH", test_db_file)
    init_db()
    
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    seed_database(conn)
    cur = conn.cursor()
    cur.execute("SELECT name FROM wards WHERE UPPER(name) LIKE '%PAED%' OR UPPER(name) LIKE '%PED%'")
    rows = [r["name"] for r in cur.fetchall()]
    conn.close()
    assert "PAEDIATRIC" in rows
    assert "Pediatrics" not in rows
    assert "Paediatrics" not in rows

