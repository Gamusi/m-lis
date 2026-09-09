import datetime
import sqlite3
import logging
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from ..database import get_db
from ..schemas import BacklogSaveRequest, DailyEntryResponse
from ..auth import get_current_user, require_admin

logger = logging.getLogger("mlis_backlog")

router = APIRouter(prefix="/api/backlog", tags=["Backlog Data"])

@router.get("")
def get_backlog_for_date(
    date_str: str = Query(..., alias="date"),
    conn: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    try:
        entry_date = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    cur = conn.cursor()
    cur.execute("SELECT id, name, sort_order FROM sections ORDER BY sort_order, id")
    sections = cur.fetchall()

    cur.execute("""
        SELECT 
            t.id as test_id, t.name as test_name, t.section_id, t.is_tracked, t.sort_order,
            e.done, e.positive, e.in_house, e.referral, e.outreach, e.self_request,
            e.entered_by_user_id, e.updated_at
        FROM tests t
        LEFT JOIN backlog_entries e ON e.test_id = t.id AND e.entry_date = ?
        WHERE t.is_active = 1 AND t.parent_rollup_id IS NULL
        ORDER BY t.section_id, t.sort_order, t.id
    """, (date_str,))
    all_tests = cur.fetchall()

    tests_by_section: Dict[int, List[Any]] = {}
    for row in all_tests:
        sec_id = row["section_id"]
        if sec_id not in tests_by_section:
            tests_by_section[sec_id] = []
        tests_by_section[sec_id].append(row)

    result_sections = []
    total_done = 0
    total_positive = 0
    total_in_house = 0
    total_referral = 0
    total_outreach = 0
    total_self_request = 0
    logged_tests_count = 0

    for sec in sections:
        sec_id = sec["id"]
        tests = tests_by_section.get(sec_id, [])
        test_items = []

        sec_done = 0
        sec_pos = 0

        for t in tests:
            done = t["done"] if t["done"] is not None else 0
            pos = t["positive"] if t["positive"] is not None else None
            in_house = t["in_house"] if t["in_house"] is not None else 0
            referral = t["referral"] if t["referral"] is not None else 0
            outreach = t["outreach"] if t["outreach"] is not None else 0
            self_req = t["self_request"] if t["self_request"] is not None else 0

            if done > 0 or (pos is not None and pos > 0):
                logged_tests_count += 1
                total_done += done
                sec_done += done
                if pos is not None:
                    total_positive += pos
                    sec_pos += pos
                total_in_house += in_house
                total_referral += referral
                total_outreach += outreach
                total_self_request += self_req

            test_items.append({
                "test_id": t["test_id"],
                "test_name": t["test_name"],
                "is_tracked": bool(t["is_tracked"]),
                "done": done,
                "positive": pos if t["is_tracked"] else None,
                "in_house": in_house,
                "referral": referral,
                "outreach": outreach,
                "self_request": self_req,
                "entered_by": t["entered_by_user_id"],
                "updated_at": t["updated_at"]
            })

        result_sections.append({
            "section_id": sec["id"],
            "section_name": sec["name"],
            "section_total_done": sec_done,
            "section_total_positive": sec_pos,
            "tests": test_items
        })

    return {
        "entry_date": date_str,
        "sections": result_sections,
        "summary": {
            "logged_tests_count": logged_tests_count,
            "total_done": total_done,
            "total_positive": total_positive,
            "total_in_house": total_in_house,
            "total_referral": total_referral,
            "total_outreach": total_outreach,
            "total_self_request": total_self_request
        }
    }

@router.post("")
def save_backlog(
    req: BacklogSaveRequest,
    conn: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    entry_date_str = req.entry_date.strftime("%Y-%m-%d") if isinstance(req.entry_date, datetime.date) else str(req.entry_date)
    cur = conn.cursor()
    saved_count = 0
    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    for item in req.entries:
        cur.execute("SELECT id, is_tracked FROM tests WHERE id = ?", (item.test_id,))
        test = cur.fetchone()
        if not test:
            continue

        ref_val = max(0, int(item.referral or 0))
        outreach_val = max(0, int(item.outreach or 0))
        self_val = max(0, int(item.self_request or 0))
        in_house_input = int(item.in_house) if item.in_house is not None else 0
        cat_sum = in_house_input + ref_val + outreach_val + self_val

        done_val = max(0, int(item.done or 0))
        if done_val == 0 and cat_sum > 0:
            done_val = cat_sum
        elif done_val < cat_sum:
            done_val = cat_sum

        if in_house_input == 0 and done_val > (ref_val + outreach_val + self_val):
            in_house_val = max(0, done_val - (ref_val + outreach_val + self_val))
        else:
            in_house_val = in_house_input

        pos_val = None
        if test["is_tracked"] and item.positive is not None:
            pos_val = max(0, min(done_val, int(item.positive)))

        cur.execute("""
            INSERT INTO backlog_entries (
                entry_date, test_id, done, positive, in_house, referral, outreach, self_request,
                entered_by_user_id, entered_at, updated_by_user_id, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(entry_date, test_id) DO UPDATE SET
                done = excluded.done,
                positive = excluded.positive,
                in_house = excluded.in_house,
                referral = excluded.referral,
                outreach = excluded.outreach,
                self_request = excluded.self_request,
                updated_by_user_id = excluded.entered_by_user_id,
                updated_at = excluded.entered_at
        """, (
            entry_date_str, test["id"], done_val, pos_val,
            in_house_val, ref_val, outreach_val, self_val,
            current_user["id"], now_str, current_user["id"], now_str
        ))
        saved_count += 1

    # Log action to audit log
    cur.execute("""
        INSERT INTO audit_log (user_id, action, detail)
        VALUES (?, 'BACKLOG_SAVE', ?)
    """, (current_user["id"], f"Saved backlog data for date {entry_date_str} ({saved_count} test items)"))

    conn.commit()
    return {
        "status": "success",
        "entry_date": entry_date_str,
        "saved_count": saved_count
    }

@router.get("/status")
def get_backlog_status(
    start_date: str = Query(..., description="Start date YYYY-MM-DD"),
    end_date: str = Query(..., description="End date YYYY-MM-DD"),
    conn: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    try:
        s_date = datetime.datetime.strptime(start_date, "%Y-%m-%d").date()
        e_date = datetime.datetime.strptime(end_date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    if s_date > e_date:
        raise HTTPException(status_code=400, detail="start_date must be before or equal to end_date.")

    cur = conn.cursor()
    cur.execute("""
        SELECT 
            entry_date,
            COUNT(test_id) as logged_tests_count,
            SUM(done) as total_done,
            SUM(CASE WHEN positive IS NOT NULL THEN positive ELSE 0 END) as total_positive,
            SUM(in_house) as total_in_house,
            SUM(referral) as total_referral,
            SUM(outreach) as total_outreach,
            SUM(self_request) as total_self_request
        FROM backlog_entries
        WHERE entry_date >= ? AND entry_date <= ? AND done > 0
        GROUP BY entry_date
        ORDER BY entry_date ASC
    """, (start_date, end_date))
    
    rows = cur.fetchall()
    day_map = {r["entry_date"]: dict(r) for r in rows}

    days_list = []
    curr = s_date
    total_tests_done = 0
    total_positive = 0
    days_with_data = 0

    while curr <= e_date:
        d_str = curr.strftime("%Y-%m-%d")
        if d_str in day_map:
            d_info = day_map[d_str]
            days_with_data += 1
            total_tests_done += d_info["total_done"] or 0
            total_positive += d_info["total_positive"] or 0
            days_list.append({
                "date": d_str,
                "has_data": True,
                "tests_done": d_info["total_done"] or 0,
                "positives": d_info["total_positive"] or 0,
                "in_house": d_info["total_in_house"] or 0,
                "referral": d_info["total_referral"] or 0,
                "outreach": d_info["total_outreach"] or 0,
                "self_request": d_info["total_self_request"] or 0,
                "active_tests_count": d_info["logged_tests_count"]
            })
        else:
            days_list.append({
                "date": d_str,
                "has_data": False,
                "tests_done": 0,
                "positives": 0,
                "in_house": 0,
                "referral": 0,
                "outreach": 0,
                "self_request": 0,
                "active_tests_count": 0
            })
        curr += datetime.timedelta(days=1)

    total_calendar_days = len(days_list)
    return {
        "start_date": start_date,
        "end_date": end_date,
        "total_calendar_days": total_calendar_days,
        "total_days_logged": days_with_data,
        "completion_rate": round((days_with_data / total_calendar_days) * 100, 1) if total_calendar_days > 0 else 0.0,
        "total_tests_done": total_tests_done,
        "total_positive": total_positive,
        "days": days_list
    }

@router.delete("")
def delete_backlog_for_date(
    date_str: str = Query(..., alias="date"),
    conn: sqlite3.Connection = Depends(get_db),
    admin_user: dict = Depends(require_admin)
):
    try:
        datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD.")

    cur = conn.cursor()
    cur.execute("DELETE FROM backlog_entries WHERE entry_date = ?", (date_str,))
    deleted = cur.rowcount
    
    cur.execute("""
        INSERT INTO audit_log (user_id, action, detail)
        VALUES (?, 'BACKLOG_DELETE', ?)
    """, (admin_user["id"], f"Deleted backlog entries for date {date_str} ({deleted} rows deleted)"))
    
    conn.commit()
    return {"status": "success", "date": date_str, "deleted_rows": deleted}
