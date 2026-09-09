import sqlite3
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import get_db, SCHEMA_SQL
from backend.app.auth import get_current_user, require_admin

client = TestClient(app)

@pytest.fixture
def specimen_db():
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQL)
    cur = conn.cursor()
    cur.execute("INSERT INTO users (full_name, username, password_hash, role) VALUES ('Admin User', 'admin', 'hash', 'admin')")
    admin_id = cur.lastrowid
    conn.commit()

    def override_get_db():
        yield conn

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: {"id": admin_id, "username": "admin", "full_name": "Admin User", "role": "admin"}
    app.dependency_overrides[require_admin] = lambda: {"id": admin_id, "username": "admin", "full_name": "Admin User", "role": "admin"}

    yield {"conn": conn, "admin_id": admin_id}
    app.dependency_overrides.clear()
    conn.close()

def test_specimen_types_has_storage_temp_column(specimen_db):
    cur = specimen_db["conn"].cursor()
    cur.execute("PRAGMA table_info(specimen_types)")
    cols = [r["name"] for r in cur.fetchall()]
    assert "storage_temp" in cols

def test_specimen_crud_and_protection(specimen_db):
    conn = specimen_db["conn"]
    # 1. Create specimen
    res = client.post("/api/config/specimens", json={
        "name": "Synovial Fluid",
        "container": "Sterile Plain Tube",
        "min_volume": "1.0 - 2.0 mL",
        "storage_temp": "2 - 8°C (Refrigerated)",
        "sort_order": 20
    })
    assert res.status_code == 200, res.text
    spec_data = res.json()
    spec_id = spec_data["id"]
    assert spec_data["name"] == "Synovial Fluid"
    assert spec_data["storage_temp"] == "2 - 8°C (Refrigerated)"
    assert spec_data["is_active"] is True

    # Duplicate name should fail
    dup_res = client.post("/api/config/specimens", json={"name": "synovial fluid"})
    assert dup_res.status_code == 400

    # 2. Get specimens (active_only=True by default or when filtered)
    res_list = client.get("/api/config/specimens")
    assert res_list.status_code == 200
    names = [s["name"] for s in res_list.json()]
    assert "Synovial Fluid" in names

    # 3. Update specimen
    res_up = client.put(f"/api/config/specimens/{spec_id}", json={
        "storage_temp": "Room Temperature (20 - 25°C)",
        "min_volume": "3.0 mL"
    })
    assert res_up.status_code == 200
    updated = res_up.json()
    assert updated["storage_temp"] == "Room Temperature (20 - 25°C)"
    assert updated["min_volume"] == "3.0 mL"
    assert updated["name"] == "Synovial Fluid"

    # 4. Check usage when 0
    res_usage = client.get(f"/api/config/specimens/{spec_id}/usage")
    assert res_usage.status_code == 200
    usage_data = res_usage.json()
    assert usage_data["pending_orders_count"] == 0
    assert usage_data["total_orders_count"] == 0
    assert usage_data["visits_count"] == 0

    # 5. Add pending order referencing this specimen
    cur = conn.cursor()
    cur.execute("INSERT INTO clients (client_number, full_name) VALUES ('C100', 'JOHN DOE')")
    client_id = cur.lastrowid
    cur.execute("INSERT INTO visits (lab_number, client_id, specimen_type_id) VALUES ('LAB100', ?, ?)", (client_id, spec_id))
    visit_id = cur.lastrowid
    cur.execute("INSERT INTO sections (name) VALUES ('Hematology')")
    sec_id = cur.lastrowid
    cur.execute("INSERT INTO tests (name, section_id, result_type) VALUES ('Test X', ?, 'qualitative')", (sec_id,))
    t_id = cur.lastrowid
    cur.execute("INSERT INTO test_orders (visit_id, test_id, specimen_type_id, status) VALUES (?, ?, ?, 'pending')", (visit_id, t_id, spec_id))
    conn.commit()

    # Check usage now
    res_usage2 = client.get(f"/api/config/specimens/{spec_id}/usage")
    assert res_usage2.status_code == 200
    u2 = res_usage2.json()
    assert u2["pending_orders_count"] == 1
    assert u2["total_orders_count"] == 1
    assert u2["visits_count"] == 1

    # Attempt delete should fail with 400 because pending order exists
    res_del_fail = client.delete(f"/api/config/specimens/{spec_id}")
    assert res_del_fail.status_code == 400
    assert "pending" in res_del_fail.json()["detail"].lower()

    # Complete order
    cur.execute("UPDATE test_orders SET status = 'completed' WHERE specimen_type_id = ?", (spec_id,))
    conn.commit()

    # Attempt delete should now succeed (soft delete)
    res_del_ok = client.delete(f"/api/config/specimens/{spec_id}")
    assert res_del_ok.status_code == 200
    assert res_del_ok.json()["status"] == "deleted"

    # Should not appear in active_only list
    res_active = client.get("/api/config/specimens?active_only=true")
    assert spec_id not in [s["id"] for s in res_active.json()]

    # Should appear in active_only=false
    res_all = client.get("/api/config/specimens?active_only=false")
    assert spec_id in [s["id"] for s in res_all.json()]
