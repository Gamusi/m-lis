import datetime
import sqlite3
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.database import get_db, SCHEMA_SQL
from backend.app.auth import get_current_user

client = TestClient(app)

@pytest.fixture
def mock_db():
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQL)
    
    # Pre-seed clinician 'SELF REQUEST'
    cur = conn.cursor()
    cur.execute("INSERT OR IGNORE INTO clinicians (name) VALUES ('SELF REQUEST')")
    
    # Pre-seed a specimen type
    cur.execute("INSERT INTO specimen_types (name, is_active) VALUES ('Whole Blood (EDTA)', 1)")
    specimen_id = cur.lastrowid

    # Pre-seed a test section and test
    cur.execute("INSERT INTO sections (name, sort_order) VALUES ('Hematology', 1)")
    sec_id = cur.lastrowid
    cur.execute("INSERT INTO tests (name, section_id, is_active, is_tracked) VALUES ('CBC', ?, 1, 1)", (sec_id,))
    cbc_id = cur.lastrowid
    cur.execute("INSERT INTO tests (name, section_id, is_active, is_tracked) VALUES ('BS for MPS', ?, 1, 1)", (sec_id,))
    mps_id = cur.lastrowid
    
    # Insert test parameters for CBC
    cur.execute("INSERT INTO test_parameters (test_id, parameter_name, unit, ref_range, sort_order) VALUES (?, 'WBC', 'x10^9/L', '4.0-10.0', 1)", (cbc_id,))
    wbc_param_id = cur.lastrowid
    cur.execute("INSERT INTO test_parameters (test_id, parameter_name, unit, ref_range, sort_order) VALUES (?, 'Hemoglobin', 'g/dL', '12.0-16.0', 2)", (cbc_id,))
    hb_param_id = cur.lastrowid
    
    conn.commit()
    
    def override_get_db():
        yield conn
        
    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = lambda: {"id": 1, "username": "labtech1", "full_name": "Lab Technician", "role": "admin"}
    
    yield {
        "conn": conn,
        "section_id": sec_id,
        "specimen_id": specimen_id,
        "cbc_id": cbc_id,
        "mps_id": mps_id,
        "wbc_param_id": wbc_param_id,
        "hb_param_id": hb_param_id
    }
    
    app.dependency_overrides.clear()
    conn.close()

def test_list_clinicians(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()
    cur.execute("INSERT INTO clinicians (name, is_active) VALUES ('Dr. Mugisha', 1)")
    cur.execute("INSERT INTO clinicians (name, is_active) VALUES ('Dr. Inactive', 0)")
    conn.commit()
    
    response = client.get("/api/clinicians")
    assert response.status_code == 200
    data = response.json()
    names = [c["name"] for c in data]
    assert "SELF REQUEST" in names
    assert "Dr. Mugisha" in names
    assert "Dr. Inactive" not in names

def test_create_visit_success(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()
    cur.execute("INSERT INTO clients (client_number, full_name, sex) VALUES ('AMH-001', 'Alice Nabirye', 'Female')")
    client_id = cur.lastrowid
    cur.execute("INSERT INTO clinicians (name) VALUES ('Dr. Okello')")
    clinician_id = cur.lastrowid
    conn.commit()
    
    payload = {
        "client_id": client_id,
        "clinician_id": clinician_id,
        "ward_of_origin": "Maternity",
        "specimen_type_id": mock_db["specimen_id"],
        "test_ids": [mock_db["cbc_id"], mock_db["mps_id"]],
        "sample_id": "SAMP-101"
    }
    
    response = client.post("/api/visits", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "created"
    assert "visit_id" in data
    
    visit_id = data["visit_id"]
    cur.execute("SELECT * FROM visits WHERE id = ?", (visit_id,))
    v_row = cur.fetchone()
    assert v_row is not None
    assert v_row["client_id"] == client_id
    assert v_row["clinician_id"] == clinician_id
    assert v_row["ward_of_origin"] == "MATERNITY"
    assert v_row["specimen_type_id"] == mock_db["specimen_id"]
    assert v_row["lab_number"] is None  # Initialized as NULL before result entry
    
    cur.execute("SELECT * FROM test_orders WHERE visit_id = ?", (visit_id,))
    orders = cur.fetchall()
    assert len(orders) == 2
    assert {o["test_id"] for o in orders} == {mock_db["cbc_id"], mock_db["mps_id"]}
    for o in orders:
        assert o["status"] == "pending"
        assert o["ordered_by_user_id"] == 1
        assert o["specimen_type_id"] == mock_db["specimen_id"]

def test_create_visit_validations(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()
    cur.execute("INSERT INTO clients (client_number, full_name, sex) VALUES ('AMH-002', 'Ben Mukasa', 'Male')")
    cid = cur.lastrowid
    cur.execute("INSERT INTO clinicians (name) VALUES ('Dr. Nabeta')")
    clinician_id = cur.lastrowid
    conn.commit()

    # Non-existent client
    res = client.post("/api/visits", json={
        "client_id": 9999,
        "clinician_id": clinician_id,
        "ward_of_origin": "OPD",
        "specimen_type_id": mock_db["specimen_id"],
        "test_ids": [mock_db["cbc_id"]]
    })
    assert res.status_code == 404
    assert "Client not found" in res.json()["detail"]
    
    # Missing required fields (e.g. ward_of_origin, clinician_id, specimen_type_id)
    res_missing = client.post("/api/visits", json={"client_id": cid, "test_ids": [mock_db["cbc_id"]]})
    assert res_missing.status_code == 422  # Pydantic validation error for missing required fields
    
    # Valid client, invalid clinician
    res = client.post("/api/visits", json={
        "client_id": cid,
        "clinician_id": 9999,
        "ward_of_origin": "OPD",
        "specimen_type_id": mock_db["specimen_id"],
        "test_ids": [mock_db["cbc_id"]]
    })
    assert res.status_code == 400
    assert "Clinician not found" in res.json()["detail"]

    # Valid client, invalid specimen
    res = client.post("/api/visits", json={
        "client_id": cid,
        "clinician_id": clinician_id,
        "ward_of_origin": "OPD",
        "specimen_type_id": 9999,
        "test_ids": [mock_db["cbc_id"]]
    })
    assert res.status_code == 400
    assert "Specimen type not found" in res.json()["detail"]
    
    # Empty test_ids
    res = client.post("/api/visits", json={
        "client_id": cid,
        "clinician_id": clinician_id,
        "ward_of_origin": "OPD",
        "specimen_type_id": mock_db["specimen_id"],
        "test_ids": []
    })
    assert res.status_code == 400
    
    # Invalid test_id
    res = client.post("/api/visits", json={
        "client_id": cid,
        "clinician_id": clinician_id,
        "ward_of_origin": "OPD",
        "specimen_type_id": mock_db["specimen_id"],
        "test_ids": [9999]
    })
    assert res.status_code == 404

def test_enter_result_sets_verification_and_sequential_lab_number(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()
    
    # Create client and visit 1
    cur.execute("INSERT INTO clients (client_number, full_name, date_of_birth, sex) VALUES ('AMH-100', 'Grace Nalubega', '1995-05-10', 'Female')")
    c1_id = cur.lastrowid
    cur.execute("INSERT INTO visits (client_id, ward_of_origin) VALUES (?, 'OPD')", (c1_id,))
    v1_id = cur.lastrowid
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (v1_id, mock_db["mps_id"]))
    order1_id = cur.lastrowid
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (v1_id, mock_db["cbc_id"]))
    order2_id = cur.lastrowid
    conn.commit()
    
    # Enter single result for Order 1
    res1 = client.post("/api/results", json={
        "order_id": order1_id,
        "result_value": "Negative",
        "is_positive": False
    })
    assert res1.status_code == 200
    res1_data = res1.json()
    assert res1_data["status"] == "result_saved"
    
    today = datetime.date.today()
    expected_lab_no_1 = f"AMH-{today.strftime('%y')}-{today.month}-001"
    assert res1_data["lab_number"] == expected_lab_no_1
    
    # Check visit 1 lab number is now assigned
    cur.execute("SELECT lab_number FROM visits WHERE id = ?", (v1_id,))
    v1_row = cur.fetchone()
    assert v1_row["lab_number"] == expected_lab_no_1
    
    # Check test result verified fields
    cur.execute("SELECT * FROM test_results WHERE order_id = ?", (order1_id,))
    tr1 = cur.fetchone()
    assert tr1["entered_by_user_id"] == 1
    assert tr1["verified_by_user_id"] == 1
    assert tr1["verified_at"] is not None
    
    # Check order status
    cur.execute("SELECT status FROM test_orders WHERE id = ?", (order1_id,))
    assert cur.fetchone()["status"] == "completed"
    
    # Enter parameter results for Order 2 (same visit)
    res2 = client.post("/api/results", json={
        "order_id": order2_id,
        "parameter_results": [
            {"parameter_id": mock_db["wbc_param_id"], "result_value": "6.5", "is_positive": False},
            {"parameter_id": mock_db["hb_param_id"], "result_value": "13.8", "is_positive": False}
        ]
    })
    assert res2.status_code == 200
    # Lab number should remain the same for the visit, NOT incremented again
    assert res2.json()["lab_number"] == expected_lab_no_1
    
    cur.execute("SELECT lab_number FROM visits WHERE id = ?", (v1_id,))
    assert cur.fetchone()["lab_number"] == expected_lab_no_1
    
    # Check sequence tracker value is still 1
    seq_name = f"lab_number_{today.strftime('%y')}_{today.month}"
    cur.execute("SELECT last_value FROM sequence_tracker WHERE seq_name = ?", (seq_name,))
    assert cur.fetchone()["last_value"] == 1
    
    # Now create Visit 2 for another client in the same month
    cur.execute("INSERT INTO clients (client_number, full_name, sex) VALUES ('AMH-101', 'David Kintu', 'Male')")
    c2_id = cur.lastrowid
    cur.execute("INSERT INTO visits (client_id, ward_of_origin) VALUES (?, 'Emergency')", (c2_id,))
    v2_id = cur.lastrowid
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (v2_id, mock_db["mps_id"]))
    order3_id = cur.lastrowid
    conn.commit()
    
    # Enter result for Visit 2 -> sequence should increment to 2
    res3 = client.post("/api/results", json={
        "order_id": order3_id,
        "result_value": "Positive (+++)",
        "is_positive": True
    })
    assert res3.status_code == 200
    expected_lab_no_2 = f"AMH-{today.strftime('%y')}-{today.month}-002"
    assert res3.json()["lab_number"] == expected_lab_no_2
    
    cur.execute("SELECT lab_number FROM visits WHERE id = ?", (v2_id,))
    assert cur.fetchone()["lab_number"] == expected_lab_no_2
    
    cur.execute("SELECT last_value FROM sequence_tracker WHERE seq_name = ?", (seq_name,))
    assert cur.fetchone()["last_value"] == 2

def test_visit_pdf_report_generation(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()
    
    cur.execute("INSERT INTO clients (client_number, full_name, date_of_birth, sex) VALUES ('AMH-200', 'Sarah Namutebi', '1998-03-15', 'Female')")
    client_id = cur.lastrowid
    cur.execute("INSERT INTO clinicians (name) VALUES ('Dr. Kato')")
    clinician_id = cur.lastrowid
    cur.execute("INSERT INTO visits (client_id, clinician_id, ward_of_origin) VALUES (?, ?, 'GOPD')", (client_id, clinician_id))
    visit_id = cur.lastrowid
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (visit_id, mock_db["cbc_id"]))
    order_id = cur.lastrowid
    conn.commit()
    
    # Save result (which verifies and generates lab number)
    res = client.post("/api/results", json={
        "order_id": order_id,
        "result_value": "14.2 g/dL"
    })
    assert res.status_code == 200
    
    # Fetch PDF report by visit_id
    pdf_res = client.get(f"/api/reports/visit/{visit_id}/pdf")
    assert pdf_res.status_code == 200
    assert pdf_res.headers["content-type"] == "application/pdf"
    assert pdf_res.content.startswith(b'%PDF-')
    
    # Backward compatibility: fetch by client_id
    client_pdf_res = client.get(f"/api/reports/client/{client_id}/pdf")
    assert client_pdf_res.status_code == 200
    assert client_pdf_res.headers["content-type"] == "application/pdf"
    assert client_pdf_res.content.startswith(b'%PDF-')
    
    # 404 for non-existent visit
    not_found_res = client.get("/api/reports/visit/99999/pdf")
    assert not_found_res.status_code == 404

def test_wards_crud_endpoints(mock_db):
    # 1. GET empty wards list
    res = client.get("/api/config/wards")
    assert res.status_code == 200
    assert res.json() == []

    # 2. POST create ward
    res = client.post("/api/config/wards", json={"name": "Maternity"})
    assert res.status_code == 200
    w1 = res.json()
    assert w1["name"] == "MATERNITY"
    assert w1["is_active"] is True
    assert "id" in w1

    # Create second ward
    res = client.post("/api/config/wards", json={"name": "Emergency"})
    assert res.status_code == 200
    w2 = res.json()
    assert w2["name"] == "EMERGENCY"

    # Validation: Duplicate name
    res = client.post("/api/config/wards", json={"name": "maternity"})
    assert res.status_code == 400
    assert "already exists" in res.json()["detail"]

    # Validation: Empty name
    res = client.post("/api/config/wards", json={"name": "   "})
    assert res.status_code == 400

    # 3. GET list wards (alphabetical order)
    res = client.get("/api/config/wards")
    assert res.status_code == 200
    ward_names = [w["name"] for w in res.json()]
    assert ward_names == ["EMERGENCY", "MATERNITY"]

    # 4. PUT update ward name
    res = client.put(f"/api/config/wards/{w1['id']}", json={"name": "Maternity Ward"})
    assert res.status_code == 200
    assert res.json()["name"] == "MATERNITY WARD"

    # PUT validation: duplicate name
    res = client.put(f"/api/config/wards/{w1['id']}", json={"name": "Emergency"})
    assert res.status_code == 400

    # 5. DELETE ward (soft delete is_active=0)
    res = client.delete(f"/api/config/wards/{w2['id']}")
    assert res.status_code == 200
    assert res.json() == {"status": "deleted"}

    # Verify soft delete in active_only query
    res = client.get("/api/config/wards?active_only=true")
    assert res.status_code == 200
    active_names = [w["name"] for w in res.json()]
    assert active_names == ["MATERNITY WARD"]

    # 6. Not found cases
    res = client.put("/api/config/wards/99999", json={"name": "Ghost Ward"})
    assert res.status_code == 404

    res = client.delete("/api/config/wards/99999")
    assert res.status_code == 404

def test_clinicians_crud_endpoints(mock_db):
    # 1. GET clinicians list (contains pre-seeded SELF REQUEST)
    res = client.get("/api/config/clinicians")
    assert res.status_code == 200
    names = [c["name"] for c in res.json()]
    assert "SELF REQUEST" in names

    # 2. POST create clinician
    res = client.post("/api/config/clinicians", json={"name": "Dr. Sarah"})
    assert res.status_code == 200
    c1 = res.json()
    assert c1["name"] == "DR. SARAH"
    assert c1["is_active"] is True

    # Duplicate name validation
    res = client.post("/api/config/clinicians", json={"name": "dr. sarah"})
    assert res.status_code == 400
    assert "already exists" in res.json()["detail"]

    # Empty name validation
    res = client.post("/api/config/clinicians", json={"name": "   "})
    assert res.status_code == 400

    # 3. PUT update clinician
    res = client.put(f"/api/config/clinicians/{c1['id']}", json={"name": "Dr. Sarah Namubiru"})
    assert res.status_code == 200
    assert res.json()["name"] == "DR. SARAH NAMUBIRU"

    # 4. DELETE soft-delete clinician
    res = client.delete(f"/api/config/clinicians/{c1['id']}")
    assert res.status_code == 200
    assert res.json() == {"status": "deleted"}

    # Verify active_only filter
    res = client.get("/api/config/clinicians?active_only=true")
    assert res.status_code == 200
    active_names = [c["name"] for c in res.json()]
    assert "DR. SARAH NAMUBIRU" not in active_names

    # 5. Not found cases
    res = client.put("/api/config/clinicians/99999", json={"name": "Ghost"})
    assert res.status_code == 404
    res = client.delete("/api/config/clinicians/99999")
    assert res.status_code == 404


def test_seed_database_wards(tmp_path, monkeypatch):
    from backend.app.seed import seed_database
    from backend.app.database import get_connection

    test_db_file = str(tmp_path / "seed_test.db")
    monkeypatch.setattr("backend.app.database.DB_PATH", test_db_file)

    seed_database()

    conn = get_connection()
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute("SELECT name, is_active FROM wards ORDER BY name ASC")
    rows = cur.fetchall()
    conn.close()

    seeded_wards = {r["name"] for r in rows}
    expected_wards = {"ANC", "MCH", "Emergency", "Theater", "Labour", "OPD", "IPD", "PAEDIATRIC", "TB Clinic"}
    assert expected_wards.issubset(seeded_wards)
    for r in rows:
        assert r["is_active"] == 1

def test_add_orders_to_visit(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()
    cur.execute("INSERT INTO clients (client_number, full_name, sex) VALUES ('AMH-301', 'Test Client', 'Male')")
    client_id = cur.lastrowid
    cur.execute("INSERT INTO visits (client_id, ward_of_origin) VALUES (?, 'OPD')", (client_id,))
    visit_id = cur.lastrowid
    conn.commit()

    # Success: Add test orders to visit
    res = client.post(f"/api/visits/{visit_id}/orders", json={"test_ids": [mock_db["cbc_id"], mock_db["mps_id"]]})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "orders_added"
    assert data["visit_id"] == visit_id
    assert len(data["order_ids"]) == 2

    # Check orders in DB
    cur.execute("SELECT * FROM test_orders WHERE visit_id = ?", (visit_id,))
    orders = cur.fetchall()
    assert len(orders) == 2

    # Validation: Non-existent visit
    res_404 = client.post("/api/visits/99999/orders", json={"test_ids": [mock_db["cbc_id"]]})
    assert res_404.status_code == 404

    # Validation: Empty test_ids
    res_empty = client.post(f"/api/visits/{visit_id}/orders", json={"test_ids": []})
    assert res_empty.status_code == 400

    # Validation: Invalid test_id
    res_invalid_test = client.post(f"/api/visits/{visit_id}/orders", json={"test_ids": [99999]})
    assert res_invalid_test.status_code == 404

def test_enter_result_auto_positive_evaluation_text(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()
    cur.execute("INSERT INTO clients (client_number, full_name, sex) VALUES ('AMH-302', 'Tracked Client', 'Female')")
    client_id = cur.lastrowid
    cur.execute("INSERT INTO visits (client_id, ward_of_origin) VALUES (?, 'OPD')", (client_id,))
    visit_id = cur.lastrowid
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (visit_id, mock_db["mps_id"]))
    order_pos_id = cur.lastrowid
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (visit_id, mock_db["mps_id"]))
    order_neg_id = cur.lastrowid
    conn.commit()

    # Enter positive result (without passing is_positive in request)
    res_pos = client.post("/api/results", json={
        "order_id": order_pos_id,
        "result_value": "Reactive"
    })
    assert res_pos.status_code == 200
    cur.execute("SELECT is_positive FROM test_results WHERE order_id = ?", (order_pos_id,))
    assert cur.fetchone()["is_positive"] == 1

    # Enter negative result (without passing is_positive in request)
    res_neg = client.post("/api/results", json={
        "order_id": order_neg_id,
        "result_value": "Negative"
    })
    assert res_neg.status_code == 200
    cur.execute("SELECT is_positive FROM test_results WHERE order_id = ?", (order_neg_id,))
    assert cur.fetchone()["is_positive"] == 0

def test_enter_result_auto_positive_evaluation_numeric(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()
    # Pre-seed WBC test
    cur.execute("INSERT INTO tests (name, section_id, is_active, is_tracked) VALUES ('WBC', ?, 1, 1)", (mock_db["section_id"],))
    wbc_test_id = cur.lastrowid

    # 35 year old Male
    cur.execute("INSERT INTO clients (client_number, full_name, date_of_birth, sex) VALUES ('AMH-303', 'Adult Male', '1990-01-01', 'Male')")
    client_id = cur.lastrowid
    cur.execute("INSERT INTO visits (client_id, ward_of_origin) VALUES (?, 'OPD')", (client_id,))
    visit_id = cur.lastrowid

    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (visit_id, wbc_test_id))
    order_high_id = cur.lastrowid
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (visit_id, wbc_test_id))
    order_norm_id = cur.lastrowid
    conn.commit()

    # WBC 15.0 -> High (normal adult WBC 4.0 - 11.0)
    res_high = client.post("/api/results", json={
        "order_id": order_high_id,
        "result_value": "15.0"
    })
    assert res_high.status_code == 200
    cur.execute("SELECT is_positive FROM test_results WHERE order_id = ?", (order_high_id,))
    assert cur.fetchone()["is_positive"] == 1

    # WBC 6.5 -> Normal
    res_norm = client.post("/api/results", json={
        "order_id": order_norm_id,
        "result_value": "6.5"
    })
    assert res_norm.status_code == 200
    cur.execute("SELECT is_positive FROM test_results WHERE order_id = ?", (order_norm_id,))
    assert cur.fetchone()["is_positive"] == 0

def test_enter_result_parameter_results_auto_evaluation(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()
    # 35 year old Female -> normal Hb is 12.0 - 15.5
    cur.execute("INSERT INTO clients (client_number, full_name, date_of_birth, sex) VALUES ('AMH-304', 'Adult Female', '1990-01-01', 'Female')")
    client_id = cur.lastrowid
    cur.execute("INSERT INTO visits (client_id, ward_of_origin) VALUES (?, 'OPD')", (client_id,))
    visit_id = cur.lastrowid

    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (visit_id, mock_db["cbc_id"]))
    order_id = cur.lastrowid
    conn.commit()

    # Hb is 9.5 (Low for female -> abnormal), WBC is 7.0 (Normal)
    res = client.post("/api/results", json={
        "order_id": order_id,
        "parameter_results": [
            {"parameter_id": mock_db["wbc_param_id"], "result_value": "7.0"},
            {"parameter_id": mock_db["hb_param_id"], "result_value": "9.5"}
        ]
    })
    assert res.status_code == 200

    cur.execute("SELECT parameter_id, is_positive FROM test_results WHERE order_id = ?", (order_id,))
    rows = {r["parameter_id"]: r["is_positive"] for r in cur.fetchall()}
    assert rows[mock_db["wbc_param_id"]] == 0
    assert rows[mock_db["hb_param_id"]] == 1


def test_soft_delete_visit_cleans_pending_orders_and_hides_from_history(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()

    # Override auth to admin role
    app.dependency_overrides[get_current_user] = lambda: {"id": 1, "username": "admin1", "role": "admin", "full_name": "Admin User"}

    cur.execute("INSERT INTO clients (client_number, full_name, sex) VALUES ('AMH-SD1', 'Soft Delete Test', 'Male')")
    client_id = cur.lastrowid
    cur.execute("INSERT INTO visits (client_id, ward_of_origin) VALUES (?, 'OPD')", (client_id,))
    visit_id = cur.lastrowid
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (visit_id, mock_db["cbc_id"]))
    order_id = cur.lastrowid
    conn.commit()

    # Confirm visit shows in history
    res = client.get(f"/api/clients/{client_id}/visits")
    assert res.status_code == 200
    visits = res.json()
    assert any(v["visit_id"] == visit_id for v in visits)

    # Confirm pending order appears
    res = client.get(f"/api/clients/{client_id}/orders")
    assert res.status_code == 200
    orders = res.json()
    assert any(o["order_id"] == order_id for o in orders)

    # Delete the visit
    res = client.delete(f"/api/visits/{visit_id}")
    assert res.status_code == 200
    assert res.json()["status"] == "deleted"

    # Visit should no longer appear in history
    res = client.get(f"/api/clients/{client_id}/visits")
    assert res.status_code == 200
    visits_after = res.json()
    assert not any(v["visit_id"] == visit_id for v in visits_after)

    # Pending orders should be gone
    res = client.get(f"/api/clients/{client_id}/orders")
    assert res.status_code == 200
    orders_after = res.json()
    assert not any(o["order_id"] == order_id for o in orders_after)

    # Visit row still exists in DB but is soft-deleted
    cur.execute("SELECT is_deleted FROM visits WHERE id = ?", (visit_id,))
    row = cur.fetchone()
    assert row is not None
    assert row["is_deleted"] == 1


def test_update_client_details(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()

    cur.execute("INSERT INTO clients (client_number, full_name, sex, phone) VALUES ('AMH-UPD1', 'Original Name', 'Male', '0700000000')")
    client_id = cur.lastrowid
    conn.commit()

    res = client.put(f"/api/clients/{client_id}", json={
        "full_name": "Updated Name",
        "sex": "Female",
        "phone": "0711111111",
        "age_string": "30y",
        "age_category": "Adult"
    })
    assert res.status_code == 200
    updated = res.json()
    assert updated["full_name"] == "UPDATED NAME"
    assert updated["sex"] == "Female"
    assert updated["phone"] == "0711111111"
    assert updated["age_category"] == "Adult"
    assert updated["age_years"] is not None and updated["age_years"] > 0


def test_get_client_endpoint(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()
    cur.execute("INSERT INTO clients (client_number, full_name, sex, age_years, age_category, phone) VALUES ('AMH-GET1', 'John Doe', 'Male', 25.0, 'Adult', '0722000000')")
    client_id = cur.lastrowid
    conn.commit()

    res = client.get(f"/api/clients/{client_id}")
    assert res.status_code == 200
    data = res.json()
    assert data["full_name"] == "John Doe"
    assert data["sex"] == "Male"
    assert data["age_category"] == "Adult"
    assert data["age_display"] == "25y"
    assert data["phone"] == "0722000000"


def test_urinalysis_parameter_results_save_and_pdf(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()

    # Create urinalysis test and parameters in mock_db
    cur.execute("INSERT INTO tests (name, section_id, is_tracked, result_type) VALUES ('URINALYSIS', 1, 1, 'panel')")
    ua_id = cur.lastrowid

    # Pre-seed test_parameters for Urinalysis
    URINALYSIS_PARAMS = [
        ("Color", None, None, 1, '["Straw", "Yellow", "Amber", "Red", "Brown"]'),
        ("Turbidity", None, None, 2, '["Clear", "Slightly Turbid", "Turbid"]'),
        ("Pus Cells (WBCs)", None, "<5 / lpf", 3, '["Not Seen", "1-2 / lpf", "3-4 / lpf", "5-10 / lpf", "10-15 / lpf", ">15 / lpf"]'),
        ("Red Blood Cells (RBCs)", None, "<3 / lpf", 4, '["Not Seen", "1-2 / lpf", "3-5 / lpf", "5-10 / lpf", ">10 / lpf"]'),
        ("Epithelial Cells", None, "Few", 5, '["Not Seen", "Few", "Moderate", "Plenty"]'),
        ("Casts", None, "Not Seen", 6, '["Not Seen", "Hyaline Casts (0-1 / lpf)", "Granular Casts", "Waxy Casts", "RBC Casts", "WBC Casts"]'),
        ("Crystals", None, "Not Seen", 7, '["Not Seen", "Calcium Oxalate (++)", "Triple Phosphate (++)", "Uric Acid Crystals"]'),
        ("Specific Gravity (S.G)", "Ratio", "1.005 - 1.030", 8, '["1.000", "1.005", "1.010", "1.015", "1.020", "1.025", "1.030"]'),
        ("PH", "pH", "5.0 - 8.5", 9, '["5.0", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5"]'),
        ("Proteins (Albuminuria Screening)", None, "Nil", 10, '["Nil", "Trace (15 mg/dL)", "1+ (30 mg/dL)", "2+ (100 mg/dL)", "3+ (300 mg/dL)", "4+ (≥2000 mg/dL)"]'),
        ("Glucose (Glucosuria Screening)", None, "Nil", 11, '["Nil", "Trace (100 mg/dL)", "1+ (250 mg/dL)", "2+ (500 mg/dL)", "3+ (1000 mg/dL)", "4+ (≥2000 mg/dL)"]'),
        ("Bilirubin (Bilirubinuria)", None, "Nil", 12, '["Nil", "Small (+)", "Moderate (++)", "Large (+++)"]'),
        ("Urobilinogen", None, "Normal", 13, '["Normal (1.0 EU/dL)", "2.0 EU/dL", "4.0 EU/dL", "8.0 EU/dL"]'),
        ("Ketones (Ketonuria)", None, "Nil", 14, '["Nil", "Trace (5 mg/dL)", "1+ (15 mg/dL)", "2+ (40 mg/dL)", "3+ (80 mg/dL)", "4+ (160 mg/dL)"]'),
        ("Blood (Hematuria/Hemoglobinuria)", None, "Nil", 15, '["Nil", "Non-Hemolyzed Trace", "Hemolyzed Trace", "1+ (Small)", "2+ (Moderate)", "3+ (Large)"]'),
        ("Nitrates (Nitrite Screening)", None, "Negative", 16, '["Negative", "Positive"]'),
        ("Leukocytes (Leukocyte Esterase)", None, "Nil", 17, '["Nil", "Trace", "1+ (Small)", "2+ (Moderate)", "3+ (Large)"]')
    ]
    for pname, punit, pref, porder, popts in URINALYSIS_PARAMS:
        cur.execute("""
            INSERT INTO test_parameters (test_id, parameter_name, unit, ref_range, sort_order, options)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (ua_id, pname, punit, pref, porder, popts))
    conn.commit()

    # Get parameters
    param_res = client.get(f"/api/config/tests/{ua_id}/parameters")
    assert param_res.status_code == 200
    params = param_res.json()
    assert len(params) == 17

    # Create client, visit, order
    cur.execute("INSERT INTO clients (client_number, full_name, sex, date_of_birth) VALUES ('AMH-UA-1', 'Amina Ali', 'Female', '1995-05-10')")
    client_id = cur.lastrowid
    cur.execute("INSERT INTO clinicians (name) VALUES ('Dr. Musa')")
    clinician_id = cur.lastrowid
    cur.execute("INSERT INTO visits (client_id, clinician_id, ward_of_origin) VALUES (?, ?, 'ANC')", (client_id, clinician_id))
    visit_id = cur.lastrowid
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (visit_id, ua_id))
    order_id = cur.lastrowid
    conn.commit()

    # Submit parameter results
    param_payload = [{"parameter_id": p["id"], "result_value": "Straw" if p["parameter_name"] == "Color" else "Not Seen"} for p in params]
    save_res = client.post("/api/clients/results", json={
        "order_id": order_id,
        "result_value": "Completed",
        "parameter_results": param_payload
    })
    assert save_res.status_code == 200

    # Verify results in DB
    cur.execute("SELECT COUNT(*) FROM test_results WHERE order_id = ?", (order_id,))
    assert cur.fetchone()[0] == 17

    # Verify visit PDF generates cleanly
    pdf_res = client.get(f"/api/reports/visit/{visit_id}/pdf")
    assert pdf_res.status_code == 200
    assert pdf_res.content.startswith(b'%PDF-')

def test_pdf_report_includes_client_age(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()
    cur.execute("INSERT INTO clients (client_number, full_name, sex, date_of_birth, age_years) VALUES ('AMH-AGE-1', 'Grace Akello', 'Female', '2000-01-01', 26.0)")
    cid = cur.lastrowid
    cur.execute("INSERT INTO clinicians (name) VALUES ('Dr. Kato')")
    clid = cur.lastrowid
    cur.execute("INSERT INTO visits (client_id, clinician_id, ward_of_origin, lab_number) VALUES (?, ?, 'GOPD', 'AMH-26-8-099')", (cid, clid))
    vid = cur.lastrowid
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'completed')", (vid, mock_db["cbc_id"]))
    oid = cur.lastrowid
    cur.execute("INSERT INTO test_results (order_id, parameter_id, result_value) VALUES (?, ?, '13.5')", (oid, mock_db["hb_param_id"]))
    conn.commit()

    res = client.get(f"/api/reports/visit/{vid}/pdf")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b'%PDF-')

    # Also test age_years fallback without date_of_birth
    cur.execute("INSERT INTO clients (client_number, full_name, sex, age_years) VALUES ('AMH-AGE-2', 'Baby John', 'Male', 0.5)")
    cid2 = cur.lastrowid
    cur.execute("INSERT INTO visits (client_id, clinician_id, ward_of_origin, lab_number) VALUES (?, ?, 'Pediatric', 'AMH-26-8-100')", (cid2, clid))
    vid2 = cur.lastrowid
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'completed')", (vid2, mock_db["mps_id"]))
    oid2 = cur.lastrowid
    cur.execute("INSERT INTO test_results (order_id, result_value) VALUES (?, 'Negative')", (oid2,))
    conn.commit()

    res2 = client.get(f"/api/reports/visit/{vid2}/pdf")
    assert res2.status_code == 200
    assert res2.content.startswith(b'%PDF-')

def test_pdf_report_content_disposition_header(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()
    cur.execute("INSERT INTO clients (client_number, full_name, sex) VALUES ('AMH-FIL-1', 'Mary Namaganda', 'Female')")
    cid = cur.lastrowid
    cur.execute("INSERT INTO visits (client_id, ward_of_origin, lab_number) VALUES (?, 'ANC', 'AMH-26-8-777')", (cid,))
    vid = cur.lastrowid
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'completed')", (vid, mock_db["mps_id"]))
    oid = cur.lastrowid
    cur.execute("INSERT INTO test_results (order_id, result_value) VALUES (?, 'Negative')", (oid,))
    conn.commit()

    res = client.get(f"/api/reports/visit/{vid}/pdf")
    assert res.status_code == 200
    assert 'filename="AMH-26-8-777.pdf"' in res.headers.get("content-disposition", "")

def test_staff_entry_leaves_order_unverified_and_blocks_staff_pdf(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()
    cur.execute("INSERT INTO clients (client_number, full_name, sex) VALUES ('AMH-V1', 'David O', 'Male')")
    cid = cur.lastrowid
    cur.execute("INSERT INTO visits (client_id, ward_of_origin, lab_number) VALUES (?, 'GOPD', 'AMH-26-8-050')", (cid,))
    vid = cur.lastrowid
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (vid, mock_db["mps_id"]))
    oid = cur.lastrowid
    conn.commit()

    # Enter result as staff user (role: staff)
    app.dependency_overrides[get_current_user] = lambda: {"id": 2, "username": "staff1", "full_name": "Staff Tech", "role": "staff"}
    res = client.post("/api/clients/results", json={"order_id": oid, "result_value": "Negative"})
    assert res.status_code == 200

    # Verify order is in 'entered' status, not verified
    cur.execute("SELECT status FROM test_orders WHERE id = ?", (oid,))
    assert cur.fetchone()["status"] == "entered"
    cur.execute("SELECT verified_by_user_id FROM test_results WHERE order_id = ?", (oid,))
    assert cur.fetchone()["verified_by_user_id"] is None

    # Staff attempts to fetch PDF -> 403 Forbidden
    pdf_res = client.get(f"/api/reports/visit/{vid}/pdf")
    assert pdf_res.status_code == 403
    assert "verified" in pdf_res.json()["detail"].lower()

    # Admin verifies the order
    app.dependency_overrides[get_current_user] = lambda: {"id": 1, "username": "admin1", "full_name": "Admin Lab", "role": "admin"}
    verify_res = client.post(f"/api/clients/orders/{oid}/verify")
    assert verify_res.status_code == 200

    # Check order is now completed and verified
    cur.execute("SELECT status FROM test_orders WHERE id = ?", (oid,))
    assert cur.fetchone()["status"] == "completed"

    # Now staff can fetch PDF
    app.dependency_overrides[get_current_user] = lambda: {"id": 2, "username": "staff1", "full_name": "Staff Tech", "role": "staff"}
    pdf_res_after = client.get(f"/api/reports/visit/{vid}/pdf")
    assert pdf_res_after.status_code == 200

def test_admin_can_reset_staff_password(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()
    from backend.app.auth import hash_password
    cur.execute("INSERT INTO users (username, full_name, password_hash, role, is_active) VALUES ('tech2', 'Tech Two', ?, 'staff', 1)", (hash_password("oldpass123"),))
    user_id = cur.lastrowid
    conn.commit()

    # Admin resets password
    app.dependency_overrides[get_current_user] = lambda: {"id": 1, "username": "admin1", "full_name": "Admin", "role": "admin"}
    res = client.post(f"/api/auth/users/{user_id}/reset-password", json={"temporary_password": "TempPass2026"})
    assert res.status_code == 200

    # Verify user record updated with password_reset_required = 1
    cur.execute("SELECT password_reset_required, password_hash FROM users WHERE id = ?", (user_id,))
    row = cur.fetchone()
    assert row["password_reset_required"] == 1
    from backend.app.auth import verify_password
    assert verify_password("TempPass2026", row["password_hash"])

def test_staff_can_delete_empty_visit_but_not_visit_with_results(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()
    cur.execute("INSERT INTO clients (client_number, full_name, sex) VALUES ('AMH-DEL-1', 'Grace N', 'Female')")
    cid = cur.lastrowid
    cur.execute("INSERT INTO visits (client_id, ward_of_origin) VALUES (?, 'GOPD')", (cid,))
    vid1 = cur.lastrowid
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (vid1, mock_db["mps_id"]))
    
    # Visit 2 has entered result
    cur.execute("INSERT INTO visits (client_id, ward_of_origin) VALUES (?, 'GOPD')", (cid,))
    vid2 = cur.lastrowid
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'entered')", (vid2, mock_db["mps_id"]))
    oid2 = cur.lastrowid
    cur.execute("INSERT INTO test_results (order_id, result_value) VALUES (?, 'Positive')", (oid2,))
    conn.commit()

    # Staff user tries to delete visit 1 (only pending tests) -> SUCCESS
    app.dependency_overrides[get_current_user] = lambda: {"id": 2, "username": "staff1", "full_name": "Staff Tech", "role": "staff"}
    res1 = client.delete(f"/api/visits/{vid1}")
    assert res1.status_code == 200
    assert res1.json()["status"] == "deleted"

    # Staff user tries to delete visit 2 (has saved results) -> 403 Forbidden
    res2 = client.delete(f"/api/visits/{vid2}")
    assert res2.status_code == 403
    assert "administrator" in res2.json()["detail"].lower()

    # Admin user deletes visit 2 -> SUCCESS
    app.dependency_overrides[get_current_user] = lambda: {"id": 1, "username": "admin1", "full_name": "Admin Lab", "role": "admin"}
    res2_admin = client.delete(f"/api/visits/{vid2}")
    assert res2_admin.status_code == 200
    assert res2_admin.json()["status"] == "deleted"

def test_admin_can_preview_unverified_pdf(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()
    cur.execute("INSERT INTO clients (client_number, full_name, sex) VALUES ('AMH-PRV-1', 'Peter O', 'Male')")
    cid = cur.lastrowid
    cur.execute("INSERT INTO visits (client_id, ward_of_origin, lab_number) VALUES (?, 'OPD', 'AMH-26-8-999')", (cid,))
    vid = cur.lastrowid
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'entered')", (vid, mock_db["mps_id"]))
    oid = cur.lastrowid
    cur.execute("INSERT INTO test_results (order_id, result_value) VALUES (?, 'Negative')", (oid,))
    conn.commit()

    # Admin can generate/preview PDF even when unverified
    app.dependency_overrides[get_current_user] = lambda: {"id": 1, "username": "admin1", "full_name": "Admin Lab", "role": "admin"}
    res = client.get(f"/api/reports/visit/{vid}/pdf")
    assert res.status_code == 200
    assert res.content.startswith(b'%PDF-')


def test_evaluator_clinical_flags_and_critical_alerts():
    from backend.app.evaluator import evaluate_result
    import datetime

    today = datetime.date(2026, 8, 24)
    dob_adult_female = datetime.date(1995, 1, 1) # 31y Female

    # Normal Hb (12.0 - 15.5)
    r1 = evaluate_result("Hemoglobin (Hb)", "13.0", dob_adult_female, "Female", today)
    assert r1["flag"] is None
    assert not r1["is_abnormal"]

    # Low Hb (e.g. 10.5 g/dL -> 'L')
    r2 = evaluate_result("Hemoglobin (Hb)", "10.5", dob_adult_female, "Female", today)
    assert r2["flag"] == "L"
    assert r2["is_abnormal"]

    # Critical Low / Severe Anemia Watch (< 8.0 g/dL -> 'L*')
    r3 = evaluate_result("Hemoglobin (Hb)", "6.8", dob_adult_female, "Female", today)
    assert r3["flag"] == "L*"
    assert r3["is_abnormal"]

    # High FBS (> 5.5 mmol/L -> 'H')
    r4 = evaluate_result("Fasting Blood Sugar (FBS)", "7.8", dob_adult_female, "Female", today)
    assert r4["flag"] == "H"

    # Qualitative positive/reactive -> '\u26A0'
    r5 = evaluate_result("Malaria RDT", "Positive", dob_adult_female, "Female", today)
    assert r5["flag"] == "\u26A0"
    assert r5["is_abnormal"]


def test_admin_reference_range_crud(mock_db):
    conn = mock_db["conn"]
    app.dependency_overrides[get_current_user] = lambda: {"id": 1, "username": "admin1", "role": "admin"}

    # Create new rule
    payload = {
        "parameter_name": "Serum Creatinine",
        "age_min": 18,
        "age_max": 999,
        "sex": "Male",
        "normal_min": 60.0,
        "normal_max": 110.0,
        "critical_min": 40.0,
        "critical_max": 350.0,
        "unit": "umol/L"
    }
    create_res = client.post("/api/config/reference-ranges", json=payload)
    assert create_res.status_code == 200
    rule_id = create_res.json()["id"]
    assert create_res.json()["parameter_name"] == "Serum Creatinine"

    # List rules
    list_res = client.get("/api/config/reference-ranges")
    assert list_res.status_code == 200
    assert any(r["parameter_name"] == "Serum Creatinine" for r in list_res.json())

    # Update rule
    update_res = client.put(f"/api/config/reference-ranges/{rule_id}", json={"normal_max": 115.0})
    assert update_res.status_code == 200
    assert update_res.json()["normal_max"] == 115.0

    # Delete rule
    del_res = client.delete(f"/api/config/reference-ranges/{rule_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"

def test_staff_can_edit_test_results_with_reason(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()
    cur.execute("INSERT INTO clients (client_number, full_name, sex) VALUES ('AMH-ED-1', 'Sarah K', 'Female')")
    cid = cur.lastrowid
    cur.execute("INSERT INTO visits (client_id, ward_of_origin) VALUES (?, 'GOPD')", (cid,))
    vid = cur.lastrowid
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (vid, mock_db["mps_id"]))
    oid = cur.lastrowid
    conn.commit()

    # Initial entry by staff
    app.dependency_overrides[get_current_user] = lambda: {"id": 2, "username": "staff1", "full_name": "Staff One", "role": "staff"}
    res1 = client.post("/api/clients/results", json={"order_id": oid, "result_value": "Negative"})
    assert res1.status_code == 200

    # Staff edits result without reason -> 400
    res_no_reason = client.post("/api/clients/results", json={"order_id": oid, "result_value": "Positive", "edit_reason": ""})
    assert res_no_reason.status_code == 400
    assert "reason" in res_no_reason.json()["detail"].lower()

    # Staff edits result with valid reason -> 200
    res_edit = client.post("/api/clients/results", json={"order_id": oid, "result_value": "Positive", "edit_reason": "Corrected slide re-read"})
    assert res_edit.status_code == 200

    # Verify result updated and order remains/resets to 'entered' (unverified)
    cur.execute("SELECT status FROM test_orders WHERE id = ?", (oid,))
    assert cur.fetchone()["status"] == "entered"

    cur.execute("SELECT result_value, edit_reason, edited_by_user_id FROM test_results WHERE order_id = ?", (oid,))
    row = cur.fetchone()
    assert row["result_value"] == "Positive"
    assert row["edit_reason"] == "Corrected slide re-read"
    assert row["edited_by_user_id"] == 2


def test_widal_optional_titration_and_hiv_result_interpretation(mock_db):
    conn = mock_db["conn"]
    cur = conn.cursor()
    cur.execute("INSERT INTO clients (client_number, full_name, sex) VALUES ('AMH-SERO-1', 'Grace N', 'Female')")
    cid = cur.lastrowid
    cur.execute("INSERT INTO visits (client_id, ward_of_origin, lab_number) VALUES (?, 'OPD', 'AMH-26-8-995')", (cid,))
    vid = cur.lastrowid

    # Create WIDAL test in tests and test_parameters
    cur.execute("INSERT INTO tests (name, section_id, is_active, is_tracked, result_type) VALUES ('WIDAL (Salmonella Typhi Agglutination)', ?, 1, 1, 'options')", (mock_db["section_id"],))
    widal_id = cur.lastrowid
    WIDAL_PARAMS = [
        ("Salmonella typhi O (TO)", None, "Significant if >= 1:80", 1),
        ("Salmonella typhi H (TH)", None, "Significant if >= 1:80", 2),
        ("Salmonella paratyphi A (AO)", None, "Significant if >= 1:80", 3),
        ("Salmonella paratyphi B (BH)", None, "Significant if >= 1:80", 4),
    ]
    w_param_ids = {}
    for pname, punit, pref, porder in WIDAL_PARAMS:
        cur.execute("INSERT INTO test_parameters (test_id, parameter_name, unit, ref_range, sort_order) VALUES (?, ?, ?, ?, ?)", (widal_id, pname, punit, pref, porder))
        w_param_ids[pname] = cur.lastrowid

    # Create HIV parent test and kit parameters
    cur.execute("INSERT INTO tests (name, section_id, is_active, is_tracked, result_type) VALUES ('HIV Testing', ?, 1, 1, 'panel')", (mock_db["section_id"],))
    hiv_id = cur.lastrowid
    HIV_PARAMS = [
        ("MHS HIV 1/2 Kwiq Test", None, None, 1),
        ("Determine™ HIV-1/2", None, None, 2),
        ("HIV 1/2 Stat-Pak®", None, None, 3),
    ]
    hiv_param_ids = {}
    for pname, punit, pref, porder in HIV_PARAMS:
        cur.execute("INSERT INTO test_parameters (test_id, parameter_name, unit, ref_range, sort_order) VALUES (?, ?, ?, ?, ?)", (hiv_id, pname, punit, pref, porder))
        hiv_param_ids[pname] = cur.lastrowid

    # Order 1: Simple Positive WIDAL (slide test without titers)
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (vid, widal_id))
    w_oid1 = cur.lastrowid
    conn.commit()

    res_w1 = client.post("/api/clients/results", json={
        "order_id": w_oid1,
        "result_value": "Positive"
    })
    assert res_w1.status_code == 200

    cur.execute("SELECT result_value, clinical_flag, is_positive FROM test_results WHERE order_id = ?", (w_oid1,))
    r1 = cur.fetchone()
    assert r1["result_value"] == "Positive"
    assert r1["is_positive"] == 1
    assert r1["clinical_flag"] == "\u26A0"

    # Order 2: Detailed WIDAL with significant titers (TO >= 1:80)
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (vid, widal_id))
    w_oid2 = cur.lastrowid
    conn.commit()

    w_payload = [
        {"parameter_id": p_id, "result_value": "1:160" if "TO" in p_name else ("1:80" if "TH" in p_name else "< 1:20")}
        for p_name, p_id in w_param_ids.items()
    ]
    res_w2 = client.post("/api/clients/results", json={
        "order_id": w_oid2,
        "result_value": "Positive (TO 1:160, TH 1:80)",
        "parameter_results": w_payload
    })
    assert res_w2.status_code == 200

    cur.execute("SELECT parameter_id, result_value, clinical_flag, is_positive FROM test_results WHERE order_id = ?", (w_oid2,))
    w2_results = cur.fetchall()
    assert len(w2_results) == 4
    for r in w2_results:
        if r["result_value"] in ("1:160", "1:80"):
            assert r["is_positive"] == 1
            assert r["clinical_flag"] == "\u26A0"
        elif r["result_value"] == "< 1:20":
            assert r["is_positive"] == 0
            assert r["clinical_flag"] is None

    # Order 3: HIV Multi-Kit Testing
    cur.execute("INSERT INTO test_orders (visit_id, test_id, status) VALUES (?, ?, 'pending')", (vid, hiv_id))
    h_oid = cur.lastrowid
    conn.commit()

    hiv_payload = [
        {"parameter_id": hiv_param_ids["MHS HIV 1/2 Kwiq Test"], "result_value": "Reactive"},
        {"parameter_id": hiv_param_ids["Determine™ HIV-1/2"], "result_value": "Reactive"},
        {"parameter_id": hiv_param_ids["HIV 1/2 Stat-Pak®"], "result_value": "Non-Reactive"}
    ]
    res_hiv = client.post("/api/clients/results", json={
        "order_id": h_oid,
        "result_value": "Completed",
        "parameter_results": hiv_payload
    })
    assert res_hiv.status_code == 200

    cur.execute("SELECT parameter_id, result_value, clinical_flag, is_positive FROM test_results WHERE order_id = ?", (h_oid,))
    h_results = cur.fetchall()
    assert len(h_results) == 3
    for r in h_results:
        if r["result_value"] == "Reactive":
            assert r["is_positive"] == 1
            assert r["clinical_flag"] == "\u26A0"
        else:
            assert r["is_positive"] == 0
            assert r["clinical_flag"] is None


def test_hiv_conclusive_algorithm_derivations():
    from backend.app.evaluator import derive_hiv_outcome

    # 1. Screening Non-Reactive -> Negative
    out1 = derive_hiv_outcome([{"name": "MHS HIV 1/2 Kwiq Test", "result": "Non-Reactive"}])
    assert out1["conclusive_status"] == "Negative"
    assert out1["display_result"] == "Negative"
    assert out1["clinical_flag"] is None

    # 2. Concordant Reactive (A1+, A2+, A3+) -> Positive
    out2 = derive_hiv_outcome([
        {"name": "MHS HIV 1/2 Kwiq Test", "result": "Reactive"},
        {"name": "HIV 1/2 Stat-Pak®", "result": "Reactive"},
        {"name": "SD Bioline HIV-1/2", "result": "Reactive"}
    ])
    assert out2["conclusive_status"] == "Positive"
    assert out2["display_result"] == "Positive"
    assert out2["clinical_flag"] == "\u26A0"
    assert "CD4" in out2["advisory"]

    # 2b. Screening + Confirmatory Reactive without A3 (A1+, A2+) -> Positive
    out2b = derive_hiv_outcome([
        {"name": "MHS HIV 1/2 Kwiq Test", "result": "Reactive"},
        {"name": "HIV 1/2 Stat-Pak®", "result": "Reactive"}
    ])
    assert out2b["conclusive_status"] == "Positive"
    assert out2b["display_result"] == "Positive"
    assert out2b["clinical_flag"] == "\u26A0"

    # 3. Discordant Resolved Negative (A1+, A2-, A3-) -> Negative
    out3 = derive_hiv_outcome([
        {"name": "MHS HIV 1/2 Kwiq Test", "result": "Reactive"},
        {"name": "HIV 1/2 Stat-Pak®", "result": "Non-Reactive"},
        {"name": "SD Bioline HIV-1/2", "result": "Non-Reactive"}
    ])
    assert out3["conclusive_status"] == "Negative"
    assert out3["display_result"] == "Negative"
    assert out3["clinical_flag"] is None

    # 4. Inconclusive Discrepant (A1+, A2+, A3-) -> Inconclusive
    out4 = derive_hiv_outcome([
        {"name": "MHS HIV 1/2 Kwiq Test", "result": "Reactive"},
        {"name": "HIV 1/2 Stat-Pak®", "result": "Reactive"},
        {"name": "SD Bioline HIV-1/2", "result": "Non-Reactive"}
    ])
    assert out4["conclusive_status"] == "Inconclusive"
    assert out4["display_result"] == "Inconclusive"
    assert out4["clinical_flag"] == "\u26A0"
    assert "14 days" in out4["advisory"]

    # 5. Inconclusive Discrepant (A1+, A2-, A3+) -> Inconclusive
    out5 = derive_hiv_outcome([
        {"name": "MHS HIV 1/2 Kwiq Test", "result": "Reactive"},
        {"name": "HIV 1/2 Stat-Pak®", "result": "Non-Reactive"},
        {"name": "SD Bioline HIV-1/2", "result": "Reactive"}
    ])
    assert out5["conclusive_status"] == "Inconclusive"
    assert out5["display_result"] == "Inconclusive"
    assert out5["clinical_flag"] == "\u26A0"

    # 6. EID PCR Positive (reported independently)
    out6 = derive_hiv_outcome([{"name": "EID 1st PCR (4-6 Weeks)", "result": "Positive (Detected)"}])
    assert out6["conclusive_status"] == "Positive"
    assert out6["display_result"] == "Positive"
    assert out6["clinical_flag"] == "\u26A0"

    # 7. EID PCR Negative (reported independently)
    out7 = derive_hiv_outcome([{"name": "EID 1st PCR (4-6 Weeks)", "result": "Negative (Not Detected)"}])
    assert out7["conclusive_status"] == "Negative"
    assert out7["display_result"] == "Negative"
    assert out7["clinical_flag"] is None

    # 8. HIVST Self-Test Screening
    out8 = derive_hiv_outcome([{"name": "OraQuick® HIV Self-Test", "result": "Reactive"}])
    assert out8["conclusive_status"] == "Inconclusive"
    assert out8["display_result"] == "Inconclusive"
    assert out8["clinical_flag"] == "\u26A0"



def test_health_check_endpoint():
    res = client.get("/api/health")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert data["app"] == "M-LIS"









