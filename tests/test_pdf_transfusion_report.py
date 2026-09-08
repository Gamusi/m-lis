import io
import datetime
import pytest
from backend.app.pdf_generator import generate_pdf, generate_blood_bag_label

def test_transfusion_pdf_report_contains_unit_details():
    order_data = {
        "full_name": "WANELOBA DANIEL",
        "client_number": "AMH-C26-0094",
        "lab_number": "MLIS-26-09-0094",
        "age": "28y",
        "sex": "Male",
        "ordered_date": "2026-09-03",
        "requested_by": "DR. TUGUME",
        "ward_of_origin": "MALE WARD",
        "technician_name": "Lab Tech John",
        "verified_by": "Dr. Sarah"
    }
    results_data = [
        {
            "department": "Blood Transfusion & Immunohematology",
            "tests": [
                {
                    "test_name": "Blood group (ABO & Rh typing)",
                    "result": "O Rh(D) Positive",
                    "parameters": [
                        {"name": "Forward Anti-A", "result": "No Agglutination (-)"},
                        {"name": "Forward Anti-B", "result": "No Agglutination (-)"},
                        {"name": "Forward Anti-D", "result": "Agglutination (+)"},
                        {"name": "Reverse A1-cells", "result": "Agglutination (+)"},
                        {"name": "Reverse B-cells", "result": "Agglutination (+)"},
                        {"name": "Consolidated Blood Group", "result": "O Rh(D) Positive"}
                    ]
                },
                {
                    "test_name": "Direct coombs (Direct Antiglobulin Test)",
                    "result": "Positive",
                    "parameters": [
                        {"name": "DAT Qualitative Status", "result": "Positive"},
                        {"name": "Reaction Strength", "result": "2+"},
                        {"name": "Reagent Specificity", "result": "Polyspecific AHG"}
                    ]
                },
                {
                    "test_name": "Compatibility Testing (Cross-matching)",
                    "result": "Completed",
                    "crossmatches": [
                        {
                            "donor_unit_id": "UG-BTS-2026-98715",
                            "donor_blood_group": "O Rh(D) Positive",
                            "product_type": "Packed Red Blood Cells (PRBC)",
                            "expiry_date": "2026-09-28",
                            "phase_is": "Negative",
                            "phase_thermophase": "Negative",
                            "phase_ahg": "Negative",
                            "compatibility_status": "COMPATIBLE",
                            "release_status": "RELEASED FOR INFUSION",
                            "clinical_summary": "Donor Blood Unit UG-BTS-2026-98715 is fully COMPATIBLE. Blood is safe to issue."
                        }
                    ]
                }
            ]
        }
    ]

    pdf_bytes = generate_pdf(order_data, results_data)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF-")

def test_transfusion_pdf_report_forward_only():
    order_data = {
        "full_name": "WANELOBA DANIEL",
        "client_number": "AMH-C26-0094",
        "lab_number": "MLIS-26-09-0094",
        "age": "28y",
        "sex": "Male",
        "ordered_date": "2026-09-03",
        "requested_by": "DR. TUGUME",
        "ward_of_origin": "MALE WARD",
        "technician_name": "Lab Tech John",
        "verified_by": "Dr. Sarah"
    }
    # Blood group with only forward typing - reverse typing omitted
    results_data = [
        {
            "department": "Blood Transfusion & Immunohematology",
            "tests": [
                {
                    "test_name": "Blood group (ABO & Rh typing)",
                    "result": "A Rh(D) Positive",
                    "parameters": [
                        {"name": "Forward Anti-A", "result": "Agglutination (+)"},
                        {"name": "Forward Anti-B", "result": "No Agglutination (-)"},
                        {"name": "Forward Anti-D", "result": "Agglutination (+)"},
                        {"name": "Consolidated Blood Group", "result": "A Rh(D) Positive"}
                    ]
                }
            ]
        }
    ]

    pdf_bytes = generate_pdf(order_data, results_data)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF-")

    import pypdf
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    full_text = "".join(page.extract_text() or "" for page in reader.pages)
    assert "Forward Typing:" in full_text
    assert "Anti-A: Agglutination (+)" in full_text
    assert "Reverse Typing:" not in full_text
    assert "A1-cells" not in full_text

def test_blood_bag_label_generation():
    label_data = {
        "client_name": "WANELOBA DANIEL",
        "client_number": "AMH-C26-0094",
        "lab_number": "MLIS-26-09-0094",
        "ward": "MALE WARD",
        "donor_unit_id": "UG-BTS-2026-98715",
        "donor_blood_group": "O Rh(D) Positive",
        "client_blood_group": "O Rh(D) Positive",
        "product_type": "Packed Red Blood Cells (PRBC)",
        "expiry_date": "2026-09-28",
        "compatibility_status": "COMPATIBLE",
        "release_status": "RELEASED FOR INFUSION",
        "technician_name": "Lab Tech John",
        "verified_by": "Dr. Sarah",
        "issued_at": "2026-09-03 15:30"
    }
    label_bytes = generate_blood_bag_label(label_data)
    assert len(label_bytes) > 500
    assert label_bytes.startswith(b"%PDF-")

def test_blood_bag_label_endpoint():
    import sqlite3
    from fastapi.testclient import TestClient
    from backend.app.main import app
    from backend.app.database import get_db, SCHEMA_SQL, _ensure_transfusion_schema
    from backend.app.auth import get_current_user

    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQL)
    _ensure_transfusion_schema(conn)

    cur = conn.cursor()
    cur.execute("INSERT OR IGNORE INTO clinicians (name) VALUES ('SELF REQUEST')")
    cur.execute("INSERT INTO specimen_types (name, is_active) VALUES ('Whole Blood (EDTA)', 1)")
    cur.execute("INSERT INTO sections (name, sort_order) VALUES ('Blood Transfusion & Immunohematology', 1)")
    sec_id = cur.lastrowid
    cur.execute("INSERT INTO tests (name, section_id, is_active, is_tracked) VALUES ('Compatibility Testing (Cross-matching)', ?, 1, 1)", (sec_id,))
    t_id = cur.lastrowid
    cur.execute("INSERT INTO clients (client_number, full_name) VALUES ('AMH-C26-0001', 'Test Client')")
    c_id = cur.lastrowid
    cur.execute("INSERT INTO visits (client_id, lab_number) VALUES (?, 'MLIS-26-09-001')", (c_id,))
    v_id = cur.lastrowid
    cur.execute("INSERT INTO test_orders (visit_id, test_id) VALUES (?, ?)", (v_id, t_id))
    o_id = cur.lastrowid

    cur.execute("""
        INSERT INTO donor_crossmatches (
            order_id, donor_unit_id, donor_blood_group, product_type, expiry_date,
            phase_is, phase_thermophase, phase_ahg, compatibility_status,
            release_status, clinical_summary, is_locked
        ) VALUES (?, 'UG-BTS-2026-98715', 'O Rh(D) Positive', 'Packed Red Blood Cells (PRBC)', '2026-09-30', 'Negative', 'Negative', 'Negative', 'COMPATIBLE', 'RELEASED FOR INFUSION', 'Compatible', 0)
    """, (o_id,))
    cm_id = cur.lastrowid
    conn.commit()

    tc = TestClient(app)
    app.dependency_overrides[get_db] = lambda: conn
    app.dependency_overrides[get_current_user] = lambda: {"id": 1, "username": "admin", "full_name": "Admin Tech", "role": "admin"}

    res = tc.get(f"/api/reports/crossmatch/{cm_id}/bag-label")
    assert res.status_code == 200
    assert res.headers["content-type"] == "application/pdf"
    assert res.content.startswith(b"%PDF-")

    app.dependency_overrides.clear()
    conn.close()

