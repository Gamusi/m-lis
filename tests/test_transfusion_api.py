import datetime
import sqlite3
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import get_db, SCHEMA_SQL, _ensure_transfusion_schema
from backend.app.auth import get_current_user

client = TestClient(app)

@pytest.fixture
def mock_db():
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQL)
    _ensure_transfusion_schema(conn)

    cur = conn.cursor()
    cur.execute("INSERT OR IGNORE INTO clinicians (name) VALUES ('SELF REQUEST')")
    cur.execute("INSERT INTO specimen_types (name, is_active) VALUES ('Whole Blood (EDTA)', 1)")
    cur.execute("INSERT INTO sections (name, sort_order) VALUES ('Blood Transfusion & Immunohematology', 1)")
    sec_id = cur.lastrowid
    cur.execute("INSERT INTO tests (name, section_id, is_active, is_tracked, result_type) VALUES ('Compatibility Testing (Cross-matching)', ?, 1, 1, 'options')", (sec_id,))
    compat_id = cur.lastrowid
    cur.execute("INSERT INTO tests (name, section_id, is_active, is_tracked, result_type) VALUES ('Blood group (ABO & Rh typing)', ?, 1, 0, 'options')", (sec_id,))
    bg_id = cur.lastrowid

    # Create client and visit
    cur.execute("INSERT INTO clients (client_number, full_name, date_of_birth, sex) VALUES ('AMH-C26-0001', 'Test Recipient', '1995-05-10', 'Female')")
    client_id = cur.lastrowid
    cur.execute("INSERT INTO visits (client_id, lab_number) VALUES (?, 'MLIS-26-09-001')", (client_id,))
    visit_id = cur.lastrowid

    # Create order for crossmatch
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (visit_id, compat_id))
    compat_order_id = cur.lastrowid

    # Create order for blood group
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (visit_id, bg_id))
    bg_order_id = cur.lastrowid

    conn.commit()
    _ensure_transfusion_schema(conn)

    def override_get_db():
        yield conn

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: {"id": 1, "username": "labtech1", "full_name": "Lab Technician", "role": "admin"}
    yield {
        "conn": conn,
        "compat_order_id": compat_order_id,
        "bg_order_id": bg_order_id,
        "client_id": client_id,
        "visit_id": visit_id
    }
    app.dependency_overrides.clear()
    conn.close()

def test_crossmatch_api_record_compatible(mock_db):
    future_date = (datetime.date.today() + datetime.timedelta(days=25)).strftime("%Y-%m-%d")
    payload = {
        "donor_unit_id": "UG-BTS-2026-98715",
        "donor_blood_group": "O Rh(D) Positive",
        "product_type": "Packed Red Blood Cells (PRBC)",
        "expiry_date": future_date,
        "phase_is": "Negative",
        "phase_thermophase": "Negative",
        "phase_ahg": "Negative"
    }
    res = client.post(f"/api/clients/orders/{mock_db['compat_order_id']}/crossmatch", json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["compatibility_status"] == "COMPATIBLE"
    assert data["release_status"] == "RELEASED FOR INFUSION"
    assert data["donor_unit_id"] == "UG-BTS-2026-98715"

    # Verify query
    get_res = client.get(f"/api/clients/orders/{mock_db['compat_order_id']}/crossmatches")
    assert get_res.status_code == 200
    units = get_res.json()
    assert len(units) == 1
    assert units[0]["compatibility_status"] == "COMPATIBLE"

def test_crossmatch_api_rejects_expired(mock_db):
    past_date = (datetime.date.today() - datetime.timedelta(days=2)).strftime("%Y-%m-%d")
    payload = {
        "donor_unit_id": "UG-BTS-2026-00001",
        "donor_blood_group": "O Rh(D) Positive",
        "product_type": "Packed Red Blood Cells (PRBC)",
        "expiry_date": past_date,
        "phase_is": "Negative",
        "phase_thermophase": "Negative",
        "phase_ahg": "Negative"
    }
    res = client.post(f"/api/clients/orders/{mock_db['compat_order_id']}/crossmatch", json=payload)
    assert res.status_code == 400
    assert "EXPIRED" in res.json()["detail"]

def test_crossmatch_api_record_incompatible(mock_db):
    future_date = (datetime.date.today() + datetime.timedelta(days=25)).strftime("%Y-%m-%d")
    payload = {
        "donor_unit_id": "UG-BTS-2026-98716",
        "donor_blood_group": "O Rh(D) Positive",
        "product_type": "Packed Red Blood Cells (PRBC)",
        "expiry_date": future_date,
        "phase_is": "Negative",
        "phase_thermophase": "1+",
        "phase_ahg": "3+"
    }
    res = client.post(f"/api/clients/orders/{mock_db['compat_order_id']}/crossmatch", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["compatibility_status"] == "INCOMPATIBLE"
    assert data["release_status"] == "UNSAFE FOR TRANSFUSION"
    assert data["is_locked"] == 1
    assert "CRITICAL" in data["clinical_summary"]

def test_crossmatch_biological_incompatibility_block(mock_db):
    # First save recipient blood group as B Negative
    cur = mock_db["conn"].cursor()
    cur.execute("INSERT INTO test_results (order_id, parameter_id, result_value) VALUES (?, NULL, 'B Rh(D) Negative')", (mock_db["bg_order_id"],))
    mock_db["conn"].commit()

    future_date = (datetime.date.today() + datetime.timedelta(days=25)).strftime("%Y-%m-%d")
    # Try to crossmatch A Positive donor blood
    payload = {
        "donor_unit_id": "UG-BTS-2026-1142",
        "donor_blood_group": "A Rh(D) Positive",
        "product_type": "Packed Red Blood Cells (PRBC)",
        "expiry_date": future_date,
        "phase_is": "Negative",
        "phase_thermophase": "Negative",
        "phase_ahg": "Negative"
    }
    res = client.post(f"/api/clients/orders/{mock_db['compat_order_id']}/crossmatch", json=payload)
    assert res.status_code == 400
    assert "ABSOLUTE SAFETY BLOCK" in res.json()["detail"]

def test_blood_group_discordance_in_enter_result(mock_db):
    cur = mock_db["conn"].cursor()
    cur.execute("SELECT id, parameter_name FROM test_parameters WHERE test_id = (SELECT test_id FROM test_orders WHERE id = ?)", (mock_db["bg_order_id"],))
    params = {r["parameter_name"]: r["id"] for r in cur.fetchall()}

    # Enter discordant results: Forward A (Anti-A+, Anti-B-), Reverse O (A1+, B+)
    param_results = [
        {"parameter_id": params["Forward Anti-A"], "result_value": "Agglutination (+)"},
        {"parameter_id": params["Forward Anti-B"], "result_value": "No Agglutination (-)"},
        {"parameter_id": params["Forward Anti-D"], "result_value": "Agglutination (+)"},
        {"parameter_id": params["Reverse A1-cells"], "result_value": "Agglutination (+)"},
        {"parameter_id": params["Reverse B-cells"], "result_value": "Agglutination (+)"},
    ]
    res = client.post("/api/clients/results", json={
        "order_id": mock_db["bg_order_id"],
        "parameter_results": param_results
    })
    assert res.status_code == 200

    # Verify that Consolidated Blood Group has 'Grouping Discrepancy'
    cur.execute("SELECT result_value, clinical_flag FROM test_results WHERE order_id = ? AND parameter_id = ?", (mock_db["bg_order_id"], params["Consolidated Blood Group"]))
    cbg_row = cur.fetchone()
    assert cbg_row["result_value"] == "Grouping Discrepancy"
    assert cbg_row["clinical_flag"] == "\u26A0"

def test_blood_group_forward_only_in_enter_result(mock_db):
    cur = mock_db["conn"].cursor()
    cur.execute("SELECT id, parameter_name FROM test_parameters WHERE test_id = (SELECT test_id FROM test_orders WHERE id = ?)", (mock_db["bg_order_id"],))
    params = {r["parameter_name"]: r["id"] for r in cur.fetchall()}

    # Enter forward-only typing: Anti-A+, Anti-B-, Anti-D+ (A Pos). Reverse typing omitted.
    param_results = [
        {"parameter_id": params["Forward Anti-A"], "result_value": "Agglutination (+)"},
        {"parameter_id": params["Forward Anti-B"], "result_value": "No Agglutination (-)"},
        {"parameter_id": params["Forward Anti-D"], "result_value": "Agglutination (+)"},
    ]
    res = client.post("/api/clients/results", json={
        "order_id": mock_db["bg_order_id"],
        "parameter_results": param_results
    })
    assert res.status_code == 200

    # Verify that Consolidated Blood Group is correctly derived as 'A Rh(D) Positive' with no discrepancy flag
    cur.execute("SELECT result_value, clinical_flag FROM test_results WHERE order_id = ? AND parameter_id = ?", (mock_db["bg_order_id"], params["Consolidated Blood Group"]))
    cbg_row = cur.fetchone()
    assert cbg_row["result_value"] == "A Rh(D) Positive"
    assert cbg_row["clinical_flag"] == ""

    # Verify parent order summary result
    cur.execute("SELECT result_value, clinical_flag FROM test_results WHERE order_id = ? AND parameter_id IS NULL", (mock_db["bg_order_id"],))
    p_row = cur.fetchone()
    assert p_row["result_value"] == "A Rh(D) Positive"
    assert p_row["clinical_flag"] == ""

def test_blood_group_enter_result_lab_number_collision_prevention(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()
    cur.execute("SELECT test_id FROM test_orders WHERE id = ?", (mock_db["bg_order_id"],))
    test_id = cur.fetchone()["test_id"]
    
    cur.execute("INSERT INTO visits (client_id, ward_of_origin) VALUES (1, 'OPD')")
    v_id = cur.lastrowid
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (v_id, test_id))
    ord_id = cur.lastrowid

    today = datetime.date.today()
    seq_name = f"lab_number_{today.strftime('%y')}_{today.month}"
    prefix = f"AMH-{today.strftime('%y')}-{today.month}-"
    for i in range(1, 6):
        cur.execute("INSERT OR IGNORE INTO visits (client_id, lab_number) VALUES (1, ?)", (f"{prefix}{i:03d}",))
    cur.execute("INSERT OR REPLACE INTO sequence_tracker (seq_name, last_value) VALUES (?, 0)", (seq_name,))
    conn.commit()

    cur.execute("SELECT id, parameter_name FROM test_parameters WHERE test_id = ?", (test_id,))
    params = {r["parameter_name"]: r["id"] for r in cur.fetchall()}

    param_results = [
        {"parameter_id": params["Forward Anti-A"], "result_value": "Agglutination (+)"},
        {"parameter_id": params["Forward Anti-B"], "result_value": "No Agglutination (-)"},
        {"parameter_id": params["Forward Anti-D"], "result_value": "Agglutination (+)"},
    ]
    res = client.post("/api/clients/results", json={
        "order_id": ord_id,
        "parameter_results": param_results
    })
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "result_saved"
    cur.execute("SELECT lab_number FROM visits WHERE id = ?", (v_id,))
    v_row = cur.fetchone()
    assert v_row["lab_number"] == f"{prefix}006"

