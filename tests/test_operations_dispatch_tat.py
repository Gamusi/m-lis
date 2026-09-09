import pytest
import sqlite3
import datetime
from backend.app.database import SCHEMA_SQL
from backend.app.operations_analytics import calculate_operations_metrics

def test_operations_analytics_dispatch_tat():
    conn = sqlite3.connect(":memory:")
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQL)
    cur = conn.cursor()

    cur.execute("INSERT INTO users (id, username, full_name, role, password_hash) VALUES (1, 'tech1', 'Lab Tech', 'admin', 'fake')")
    cur.execute("INSERT INTO clients (id, client_number, full_name, age_years, age_category, sex) VALUES (1, 'AMH-C26-0001', 'JOHN DOE', 25, 'Adult', 'Male')")
    cur.execute("INSERT INTO sections (id, name, sort_order) VALUES (1, 'Hematology', 1)")
    cur.execute("INSERT INTO tests (id, name, section_id, is_active) VALUES (1, 'CBC', 1, 1)")

    # Visit 1: Ordered at 10:00, entered at 10:30, dispatched at 11:00 (TAT=60 mins, Lag=30 mins)
    cur.execute("""
        INSERT INTO visits (id, client_id, lab_number, ward_of_origin, created_at, dispatched_at, dispatched_to, dispatched_by_user_id)
        VALUES (1, 1, 'AMH-26-9-001', 'OPD', '2026-09-01 10:00:00', '2026-09-01 11:00:00', 'Patient', 1)
    """)
    cur.execute("""
        INSERT INTO test_orders (id, visit_id, test_id, ordered_at, status)
        VALUES (1, 1, 1, '2026-09-01 10:00:00', 'completed')
    """)
    cur.execute("""
        INSERT INTO test_results (id, order_id, result_value, entered_at, entered_by_user_id)
        VALUES (1, 1, 'Normal', '2026-09-01 10:30:00', 1)
    """)

    # Visit 2: Ordered at 12:00, entered at 12:45, not dispatched
    cur.execute("""
        INSERT INTO visits (id, client_id, lab_number, ward_of_origin, created_at)
        VALUES (2, 1, 'AMH-26-9-002', 'OPD', '2026-09-01 12:00:00')
    """)
    cur.execute("""
        INSERT INTO test_orders (id, visit_id, test_id, ordered_at, status)
        VALUES (2, 2, 1, '2026-09-01 12:00:00', 'completed')
    """)
    cur.execute("""
        INSERT INTO test_results (id, order_id, result_value, entered_at, entered_by_user_id)
        VALUES (2, 2, 'Normal', '2026-09-01 12:45:00', 1)
    """)
    conn.commit()

    metrics = calculate_operations_metrics(conn, period_type="Day", reference_date="2026-09-01")
    
    assert "dispatch_metrics" in metrics
    disp = metrics["dispatch_metrics"]
    assert disp["total_visits"] == 2
    assert disp["total_dispatched_visits"] == 1
    assert disp["dispatch_rate_pct"] == 50.0
    assert disp["avg_clinical_tat_mins"] == 60.0 # 10:00 to 11:00
    assert disp["avg_dispatch_lag_mins"] == 30.0 # 10:30 to 11:00
    conn.close()
