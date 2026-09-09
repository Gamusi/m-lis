import pytest
import sqlite3
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import get_db, SCHEMA_SQL
from backend.app.auth import get_current_user, require_admin

client = TestClient(app)

@pytest.fixture
def mock_db():
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQL)
    
    cur = conn.cursor()
    cur.execute("INSERT INTO sections (name, sort_order) VALUES ('Hematology', 1)")
    sec_id = cur.lastrowid
    cur.execute("INSERT INTO tests (name, section_id, is_active, is_tracked) VALUES ('CBC', ?, 1, 1)", (sec_id,))
    cbc_id = cur.lastrowid
    cur.execute("INSERT INTO tests (name, section_id, is_active, is_tracked) VALUES ('ESR', ?, 1, 0)", (sec_id,))
    esr_id = cur.lastrowid
    conn.commit()

    def override_get_db():
        yield conn

    user = {"id": 1, "username": "admin", "full_name": "Admin User", "role": "admin"}
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[require_admin] = lambda: user

    yield {
        "conn": conn,
        "section_id": sec_id,
        "cbc_id": cbc_id,
        "esr_id": esr_id
    }

    app.dependency_overrides.clear()
    conn.close()

def test_backlog_get_and_save(mock_db):
    # 1. Get backlog template for a historical date
    res = client.get("/api/backlog?date=2026-07-15")
    assert res.status_code == 200
    data = res.json()
    assert "sections" in data
    assert data["entry_date"] == "2026-07-15"
    assert len(data["sections"]) > 0
    
    test_id = data["sections"][0]["tests"][0]["test_id"]
    is_tracked = data["sections"][0]["tests"][0]["is_tracked"]
    
    # 2. Save backlog entry
    save_payload = {
        "entry_date": "2026-07-15",
        "entries": [
            {
                "test_id": test_id,
                "done": 10,
                "positive": 2 if is_tracked else None,
                "in_house": 7,
                "referral": 2,
                "outreach": 1,
                "self_request": 0
            }
        ]
    }
    save_res = client.post("/api/backlog", json=save_payload)
    assert save_res.status_code == 200
    assert save_res.json()["status"] == "success"
    assert save_res.json()["saved_count"] >= 1
    
    # 3. Verify get reflects saved data
    res2 = client.get("/api/backlog?date=2026-07-15")
    assert res2.status_code == 200
    d2 = res2.json()
    t_saved = next(t for sec in d2["sections"] for t in sec["tests"] if t["test_id"] == test_id)
    assert t_saved["done"] == 10
    assert t_saved["in_house"] == 7
    assert t_saved["referral"] == 2
    assert t_saved["outreach"] == 1
    assert t_saved["self_request"] == 0

def test_backlog_flexible_auto_inhouse(mock_db):
    res = client.get("/api/backlog?date=2026-08-01")
    test_id = res.json()["sections"][0]["tests"][0]["test_id"]
    
    # Test that entering done=5 with no category breakdown defaults in_house=5 without error
    save_payload = {
        "entry_date": "2026-08-01",
        "entries": [
            {
                "test_id": test_id,
                "done": 5,
                "positive": 0,
                "in_house": None,
                "referral": 0,
                "outreach": 0,
                "self_request": 0
            }
        ]
    }
    save_res = client.post("/api/backlog", json=save_payload)
    assert save_res.status_code == 200
    
    res2 = client.get("/api/backlog?date=2026-08-01")
    t_saved = next(t for sec in res2.json()["sections"] for t in sec["tests"] if t["test_id"] == test_id)
    assert t_saved["done"] == 5
    assert t_saved["in_house"] == 5

def test_backlog_status_range(mock_db):
    # Insert entry
    client.post("/api/backlog", json={
        "entry_date": "2026-07-10",
        "entries": [
            {"test_id": mock_db["cbc_id"], "done": 12, "positive": 1, "in_house": 12, "referral": 0, "outreach": 0, "self_request": 0}
        ]
    })
    res = client.get("/api/backlog/status?start_date=2026-07-01&end_date=2026-07-31")
    assert res.status_code == 200
    status_data = res.json()
    assert "days" in status_data
    assert status_data["total_tests_done"] >= 12
    assert status_data["total_days_logged"] >= 1

def test_backlog_inhouse_auto_totals_done(mock_db):
    # User types 10 in in_house with done=0
    save_payload = {
        "entry_date": "2026-09-02",
        "entries": [
            {
                "test_id": mock_db["cbc_id"],
                "done": 0,
                "positive": 0,
                "in_house": 10,
                "referral": 0,
                "outreach": 0,
                "self_request": 0
            }
        ]
    }
    save_res = client.post("/api/backlog", json=save_payload)
    assert save_res.status_code == 200
    assert save_res.json()["saved_count"] == 1

    res = client.get("/api/backlog?date=2026-09-02")
    assert res.status_code == 200
    t_saved = next(t for sec in res.json()["sections"] for t in sec["tests"] if t["test_id"] == mock_db["cbc_id"])
    assert t_saved["done"] == 10
    assert t_saved["in_house"] == 10

def test_backlog_excludes_child_parameters(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()
    sec_id = mock_db["section_id"]
    cbc_id = mock_db["cbc_id"]

    # Insert sub-parameters with parent_rollup_id
    cur.execute("INSERT INTO tests (name, section_id, is_active, is_tracked, parent_rollup_id) VALUES ('Neutrophils (%)', ?, 1, 0, ?)", (sec_id, cbc_id))
    cur.execute("INSERT INTO tests (name, section_id, is_active, is_tracked, parent_rollup_id) VALUES ('Hemoglobin (Hb)', ?, 1, 0, ?)", (sec_id, cbc_id))

    # Insert Urinalysis parent and child parameters
    cur.execute("INSERT INTO tests (name, section_id, is_active, is_tracked, parent_rollup_id) VALUES ('URINALYSIS', ?, 1, 1, NULL)", (sec_id,))
    uri_id = cur.lastrowid
    cur.execute("INSERT INTO tests (name, section_id, is_active, is_tracked, parent_rollup_id) VALUES ('Color', ?, 1, 0, ?)", (sec_id, uri_id))
    cur.execute("INSERT INTO tests (name, section_id, is_active, is_tracked, parent_rollup_id) VALUES ('Pus Cells (WBCs)', ?, 1, 0, ?)", (sec_id, uri_id))
    conn.commit()

    res = client.get("/api/backlog?date=2026-09-05")
    assert res.status_code == 200
    data = res.json()

    all_names = [t["test_name"] for sec in data["sections"] for t in sec["tests"]]
    assert "CBC" in all_names
    assert "URINALYSIS" in all_names
    assert "Neutrophils (%)" not in all_names
    assert "Hemoglobin (Hb)" not in all_names
    assert "Color" not in all_names
    assert "Pus Cells (WBCs)" not in all_names


