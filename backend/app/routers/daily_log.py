import datetime, sqlite3
from fastapi import APIRouter, Depends, HTTPException, Query
from ..database import get_db
from ..schemas import DailyLogSaveRequest
from ..auth import get_current_user, require_admin

router = APIRouter(prefix="/api/daily-log", tags=["Daily Log"])

def is_daily_log_order_positive(test_name: str, results: list) -> bool:
    t_name_lower = (test_name or "").lower()

    # 1. CBC / Hematology panel
    if "cbc" in t_name_lower or "blood count" in t_name_lower:
        for res in results:
            if res["is_positive"] == 1:
                return True
            flag = (res["clinical_flag"] or "").strip().lower()
            p_name = (res["parameter_name"] or "").lower()
            val_str = str(res["result_value"] or "").strip()

            if flag in ["l*", "h*", "critical", "panic", "critical low", "critical high", "abnormal", "h", "l"]:
                return True

            if "hb" in p_name or "hemoglobin" in p_name:
                if flag in ["l", "h", "abnormal", "low", "high"]:
                    return True
                try:
                    hb_val = float(val_str.split()[0])
                    if hb_val < 8.0:
                        return True
                except (ValueError, TypeError):
                    pass
        return False

    # 2. Urinalysis Profile (Broad urinalysis pathology)
    if "urinalysis" in t_name_lower or "urine routine" in t_name_lower:
        for res in results:
            p_name = (res["parameter_name"] or "").lower()
            val_str = str(res["result_value"] or "").strip().lower()
            flag = (res["clinical_flag"] or "").strip().lower()
            is_pos = res["is_positive"] == 1

            if "pus cells" in p_name or "pus cell" in p_name:
                if is_pos or flag in ["h", "abnormal", "high", "critical", "panic"]:
                    return True
                if any(x in val_str for x in ["5-10", "10-15", ">15", "moderate", "plenty"]):
                    return True

            if "nitrate" in p_name or "nitrite" in p_name:
                if is_pos or "positive" in val_str:
                    return True

            if "leukocyte" in p_name:
                if is_pos or any(x in val_str for x in ["trace", "1+", "2+", "3+", "positive", "small", "moderate", "large"]):
                    return True

            if "blood" in p_name:
                if is_pos or any(x in val_str for x in ["trace", "1+", "2+", "3+", "positive", "small", "moderate", "large", "hemolyzed"]):
                    return True

            if "protein" in p_name:
                if is_pos or any(x in val_str for x in ["trace", "1+", "2+", "3+", "4+", "positive"]):
                    return True

            if "glucose" in p_name:
                if is_pos or any(x in val_str for x in ["trace", "1+", "2+", "3+", "4+", "positive"]):
                    return True

            if "cast" in p_name:
                if is_pos or (val_str and val_str not in ["not seen", "nil", "none", "-", "normal"]):
                    return True
        return False

    # 3. HIV Testing
    if "hiv" in t_name_lower:
        from ..evaluator import derive_hiv_outcome
        hiv_data = [{"name": res["parameter_name"], "result": res["result_value"]} for res in results if res["result_value"]]
        if hiv_data:
            outcome = derive_hiv_outcome(hiv_data)
            return outcome.get("conclusive_status") == "Positive"

    # 4. Stool Analysis
    if "stool" in t_name_lower:
        for res in results:
            p_name = (res["parameter_name"] or "").lower()
            val_str = str(res["result_value"] or "").strip().lower()
            if "occult blood" in p_name and ("positive" in val_str or res["is_positive"] == 1):
                return True
            if "macroscopy" in p_name and any(x in val_str for x in ["blood", "mucus"]):
                return True
            if "microscopy" in p_name and any(x in val_str for x in ["cyst", "trophozoite", "ova", "seen"]) and "no ova" not in val_str:
                return True

    # 5. Default / Single tests
    for res in results:
        if res["is_positive"] == 1:
            return True
        val = str(res["result_value"] or "").strip().lower()
        if val in ["positive", "abnormal", "reactive", "detected"] or val.startswith("positive") or val.startswith("reactive"):
            return True
        flag = (res["clinical_flag"] or "").strip().lower()
        if flag in ["panic", "critical", "abnormal", "high", "h*", "l*", "l", "h"]:
            return True

    return False

@router.get("")
def get_daily_log(date_str: str = Query(..., alias="date"), conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    try:
        entry_date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    cur = conn.cursor()
    cur.execute("SELECT id, name, sort_order FROM sections ORDER BY sort_order, id")
    sections = cur.fetchall()
    
    # 1. Fetch live completed test orders for this date
    cur.execute("""
        SELECT 
            o.id as order_id,
            o.test_id,
            t.name as test_name,
            t.is_tracked
        FROM test_orders o
        JOIN visits v ON o.visit_id = v.id
        JOIN tests t ON o.test_id = t.id
        WHERE o.status = 'completed'
          AND v.is_deleted = 0
          AND DATE(o.ordered_at) = ?
    """, (date_str,))
    completed_orders = cur.fetchall()

    live_done_map = {}
    live_pos_map = {}

    if completed_orders:
        order_ids = [o["order_id"] for o in completed_orders]
        placeholders = ",".join("?" for _ in order_ids)
        cur.execute(f"""
            SELECT 
                tr.order_id,
                tr.parameter_id,
                tr.result_value,
                tr.clinical_flag,
                tr.is_positive,
                tp.parameter_name
            FROM test_results tr
            LEFT JOIN test_parameters tp ON tr.parameter_id = tp.id
            WHERE tr.order_id IN ({placeholders})
        """, order_ids)
        order_results_map = {}
        for r in cur.fetchall():
            oid = r["order_id"]
            if oid not in order_results_map:
                order_results_map[oid] = []
            order_results_map[oid].append(r)

        for o in completed_orders:
            tid = o["test_id"]
            live_done_map[tid] = live_done_map.get(tid, 0) + 1
            if o["is_tracked"]:
                results = order_results_map.get(o["order_id"], [])
                if is_daily_log_order_positive(o["test_name"], results):
                    live_pos_map[tid] = live_pos_map.get(tid, 0) + 1

    # 2. Fetch manual physical register backlog entries for this date
    cur.execute("""
        SELECT 
            b.test_id, b.done, b.positive, b.entered_by_user_id, b.updated_at
        FROM backlog_entries b
        WHERE b.entry_date = ?
    """, (date_str,))
    backlog_map = {r["test_id"]: r for r in cur.fetchall()}

    # 3. Query all active catalog tests (Parent rollup / orderable tests only)
    cur.execute("""
        SELECT id as test_id, name as test_name, section_id, is_tracked, sort_order
        FROM tests
        WHERE is_active = 1 AND parent_rollup_id IS NULL
        ORDER BY section_id, sort_order, id
    """)
    all_tests = cur.fetchall()

    # Group tests by section_id
    tests_by_section = {}
    for row in all_tests:
        sec_id = row["section_id"]
        if sec_id not in tests_by_section:
            tests_by_section[sec_id] = []
        tests_by_section[sec_id].append(row)

    result_sections = []
    total_done_today = 0
    total_positive_today = 0
    total_rows_today = 0

    for sec in sections:
        sec_id = sec["id"]
        tests = tests_by_section.get(sec_id, [])
        test_items = []
        
        for t in tests:
            tid = t["test_id"]
            live_done = live_done_map.get(tid, 0)
            live_pos = live_pos_map.get(tid, 0)
            b_item = backlog_map.get(tid)
            b_done = b_item["done"] if b_item else 0
            b_pos = b_item["positive"] if b_item else None

            total_test_done = live_done + b_done
            
            total_test_pos = None
            if t["is_tracked"]:
                pos_vals = []
                if live_pos > 0:
                    pos_vals.append(live_pos)
                if b_pos is not None:
                    pos_vals.append(b_pos)
                total_test_pos = sum(pos_vals) if pos_vals else (0 if total_test_done > 0 else None)

            if total_test_done > 0 or (total_test_pos is not None and total_test_pos > 0):
                total_rows_today += 1
                total_done_today += total_test_done
                if total_test_pos is not None:
                    total_positive_today += total_test_pos

            test_items.append({
                "test_id": tid,
                "test_name": t["test_name"],
                "is_tracked": bool(t["is_tracked"]),
                "done": total_test_done,
                "positive": total_test_pos if t["is_tracked"] else None,
                "entered_by": b_item["entered_by_user_id"] if b_item else None,
                "updated_at": b_item["updated_at"] if b_item else None
            })
        
        result_sections.append({
            "section_id": sec["id"],
            "section_name": sec["name"],
            "tests": test_items
        })

    # Fetch order stats for the date
    cur.execute("""
        SELECT status, COUNT(*) as count
        FROM test_orders
        WHERE date(ordered_at) = ?
        GROUP BY status
    """, (date_str,))
    
    order_stats = cur.fetchall()
    total_orders = 0
    pending_orders = 0
    entered_orders = 0
    completed_orders = 0
    
    for stat in order_stats:
        status = stat["status"].lower()
        count = stat["count"]
        total_orders += count
        if status == "pending":
            pending_orders += count
        elif status == "entered":
            entered_orders += count
        elif status == "completed":
            completed_orders += count

    return {
        "entry_date": date_str,
        "sections": result_sections,
        "today_check": {
            "rows_logged": total_rows_today,
            "total_done": total_done_today,
            "total_positive": total_positive_today
        },
        "order_summary": {
            "total": total_orders,
            "pending": pending_orders,
            "entered": entered_orders,
            "completed": completed_orders
        }
    }

@router.post("")
def save_daily_log(req: DailyLogSaveRequest, conn: sqlite3.Connection = Depends(get_db), admin_user: dict = Depends(require_admin)):
    cur = conn.cursor()
    saved_count = 0
    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    for item in req.entries:
        cur.execute("SELECT id, is_tracked FROM tests WHERE id = ?", (item.test_id,))
        test = cur.fetchone()
        if not test:
            continue
        
        done_val = max(0, item.done)
        pos_val = None
        if test["is_tracked"] and item.positive is not None:
            pos_val = max(0, min(done_val, item.positive))

        cur.execute("""
            INSERT INTO daily_entries (entry_date, test_id, done, positive, entered_by_user_id, entered_at, updated_by_user_id, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(entry_date, test_id) DO UPDATE SET
            done = MAX(daily_entries.done, excluded.done),
            positive = CASE 
                WHEN excluded.positive IS NULL THEN daily_entries.positive
                WHEN daily_entries.positive IS NULL THEN excluded.positive
                ELSE MAX(daily_entries.positive, excluded.positive)
            END,
            updated_by_user_id = excluded.entered_by_user_id,
            updated_at = excluded.entered_at
        """, (req.entry_date, test["id"], done_val, pos_val, admin_user["id"], now_str, admin_user["id"], now_str))
        
        saved_count += 1

    conn.commit()
    return {"status": "saved", "rows_saved": saved_count}


