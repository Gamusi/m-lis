import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import SCHEMA_SQL, get_db
from backend.app.auth import get_current_user, require_admin
import sqlite3

client = TestClient(app)

@pytest.fixture
def setup_dispatch_db():
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQL)
    
    cur = conn.cursor()
    cur.execute("INSERT OR IGNORE INTO users (id, username, full_name, role, password_hash) VALUES (1, 'tech1', 'Lab Tech', 'admin', 'fakehash')")
    cur.execute("INSERT OR IGNORE INTO clinicians (id, name) VALUES (1, 'DR SMITH')")
    cur.execute("INSERT INTO clients (id, client_number, full_name, age_years, age_category, sex) VALUES (1, 'AMH-C26-0001', 'JOHN DOE', 25, 'Adult', 'Male')")
    cur.execute("INSERT INTO visits (id, client_id, clinician_id, ward_of_origin, lab_number) VALUES (1, 1, 1, 'OPD', 'AMH-26-9-001')")
    cur.execute("INSERT INTO sections (id, name, sort_order) VALUES (1, 'Hematology', 1)")
    cur.execute("INSERT INTO tests (id, name, section_id) VALUES (1, 'Malaria RDT', 1)")
    cur.execute("INSERT INTO test_orders (id, visit_id, test_id, status) VALUES (1, 1, 1, 'completed')")
    cur.execute("INSERT INTO test_results (id, order_id, result_value, entered_by_user_id, verified_by_user_id) VALUES (1, 1, 'Negative', 1, 1)")
    conn.commit()

    def override_get_db():
        yield conn

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: {"id": 1, "username": "tech1", "full_name": "Lab Tech", "role": "admin"}
    app.dependency_overrides[require_admin] = lambda: {"id": 1, "username": "tech1", "full_name": "Lab Tech", "role": "admin"}

    yield {"conn": conn, "visit_id": 1}

    app.dependency_overrides.clear()
    conn.close()

def test_dispatch_visit_success(setup_dispatch_db):
    v_id = setup_dispatch_db["visit_id"]
    res = client.post(f"/api/visits/{v_id}/dispatch", json={"dispatched_to": "Ward Nurse"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "dispatched"
    assert data["dispatched_to"] == "Ward Nurse"
    assert data["dispatched_at"] is not None

    # Check visit details
    v_res = client.get(f"/api/visits/{v_id}")
    assert v_res.status_code == 200
    v_data = v_res.json()
    assert v_data["dispatched_to"] == "Ward Nurse"
    assert v_data["dispatched_at"] is not None
    assert v_data["dispatched_by_name"] == "Lab Tech"

def test_revert_dispatch_success(setup_dispatch_db):
    v_id = setup_dispatch_db["visit_id"]
    # Dispatch first
    client.post(f"/api/visits/{v_id}/dispatch", json={"dispatched_to": "Patient"})
    # Revert
    del_res = client.delete(f"/api/visits/{v_id}/dispatch")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "reverted"

    # Verify cleared in visit details
    v_res = client.get(f"/api/visits/{v_id}")
    v_data = v_res.json()
    assert v_data["dispatched_at"] is None
    assert v_data["dispatched_to"] is None
