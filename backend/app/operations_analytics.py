import sqlite3
import datetime
from typing import Optional, Dict, Any

def calculate_date_range(period_type: str, ref_date: datetime.date):
    if period_type == "Day":
        return ref_date, ref_date
    elif period_type == "Week":
        start = ref_date - datetime.timedelta(days=ref_date.weekday())
        end = start + datetime.timedelta(days=6)
        return start, end
    elif period_type == "Month":
        start = ref_date.replace(day=1)
        if start.month == 12:
            end = datetime.date(start.year, 12, 31)
        else:
            end = datetime.date(start.year, start.month + 1, 1) - datetime.timedelta(days=1)
        return start, end
    elif period_type == "Quarter":
        m, y = ref_date.month, ref_date.year
        if m in [7, 8, 9]: return datetime.date(y, 7, 1), datetime.date(y, 9, 30)
        elif m in [10, 11, 12]: return datetime.date(y, 10, 1), datetime.date(y, 12, 31)
        elif m in [1, 2, 3]: return datetime.date(y, 1, 1), datetime.date(y, 3, 31)
        else: return datetime.date(y, 4, 1), datetime.date(y, 6, 30)
    elif period_type == "Half-Year":
        m, y = ref_date.month, ref_date.year
        if m >= 7: return datetime.date(y, 7, 1), datetime.date(y, 12, 31)
        else: return datetime.date(y, 1, 1), datetime.date(y, 6, 30)
    elif period_type == "Financial Year":
        m, y = ref_date.month, ref_date.year
        if m >= 7: return datetime.date(y, 7, 1), datetime.date(y + 1, 6, 30)
        else: return datetime.date(y - 1, 7, 1), datetime.date(y, 6, 30)
    else:
        return datetime.date(ref_date.year, 1, 1), datetime.date(ref_date.year, 12, 31)

def format_reporting_period(period_type: str, ref_date: datetime.date) -> str:
    """Formats period directly without unnecessary verbose labels."""
    m, y, d = ref_date.month, ref_date.year, ref_date.day
    if period_type == "Month":
        return ref_date.strftime("%B, %Y")
    elif period_type == "Week":
        week_num = (d - 1) // 7 + 1
        return f"Week {week_num}, {ref_date.strftime('%B, %Y')}"
    elif period_type == "Day":
        return ref_date.strftime("%d-%m-%Y")
    elif period_type == "Quarter":
        if m in [7, 8, 9]: return f"Qtr 1, {y}/{str(y + 1)[-2:]}"
        elif m in [10, 11, 12]: return f"Qtr 2, {y}/{str(y + 1)[-2:]}"
        elif m in [1, 2, 3]: return f"Qtr 3, {y - 1}/{str(y)[-2:]}"
        else: return f"Qtr 4, {y - 1}/{str(y)[-2:]}"
    elif period_type == "Half-Year":
        if m >= 7: return f"H1, {y}/{str(y + 1)[-2:]}"
        else: return f"H2, {y - 1}/{str(y)[-2:]}"
    elif period_type == "Financial Year":
        if m >= 7: return f"FY {y}/{str(y + 1)[-2:]}"
        else: return f"FY {y - 1}/{str(y)[-2:]}"
    else:
        return str(y)

def _calc_diff_mins(ts_end: Optional[str], ts_start: Optional[str]) -> Optional[float]:
    """Calculates difference in minutes between two ISO timestamp strings without SQL queries."""
    if not ts_end or not ts_start:
        return None
    try:
        # Normalize trailing Z if present and parse
        s_end = ts_end.replace("Z", "").strip()
        s_start = ts_start.replace("Z", "").strip()
        dt_end = datetime.datetime.fromisoformat(s_end)
        dt_start = datetime.datetime.fromisoformat(s_start)
        diff = (dt_end - dt_start).total_seconds() / 60.0
        return max(0.0, float(diff))
    except Exception:
        return None

def calculate_operations_metrics(
    conn: sqlite3.Connection,
    period_type: str = "Month",
    reference_date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Calculates deterministic AMH Laboratory Operations & Performance metrics.
    """
    if not reference_date:
        ref_date = datetime.date.today()
    else:
        try:
            ref_date = datetime.datetime.strptime(reference_date, "%Y-%m-%d").date()
        except ValueError:
            ref_date = datetime.date.today()

    if not start_date or not end_date:
        s_date, e_date = calculate_date_range(period_type, ref_date)
        s_str = s_date.strftime("%Y-%m-%d")
        e_str = e_date.strftime("%Y-%m-%d")
    else:
        s_str = start_date
        e_str = end_date

    formatted_period = format_reporting_period(period_type, ref_date)

    cur = conn.cursor()

    # Query completed orders within the target period
    cur.execute("""
        SELECT 
            to_ord.id AS order_id,
            to_ord.visit_id,
            to_ord.test_id,
            to_ord.ordered_at,
            to_ord.order_category,
            t.name AS test_name,
            t.parent_rollup_id,
            s.id AS section_id,
            s.name AS section_name,
            v.ward_of_origin,
            v.dispatched_at,
            MIN(tr.entered_at) AS min_entered_at,
            MAX(tr.verified_at) AS max_verified_at
        FROM test_orders to_ord
        JOIN tests t ON to_ord.test_id = t.id
        JOIN sections s ON t.section_id = s.id
        JOIN visits v ON to_ord.visit_id = v.id
        LEFT JOIN test_results tr ON tr.order_id = to_ord.id
        WHERE to_ord.status = 'completed'
          AND v.is_deleted = 0
          AND DATE(to_ord.ordered_at) >= ?
          AND DATE(to_ord.ordered_at) <= ?
        GROUP BY to_ord.id
        ORDER BY to_ord.ordered_at
    """, (s_str, e_str))
    order_rows = cur.fetchall()

    total_done = len(order_rows)
    distinct_visits = set()
    visit_dispatch_info: Dict[int, Dict[str, Any]] = {}

    # Section accumulators
    cur.execute("SELECT id, name FROM sections ORDER BY sort_order, id")
    all_sections = cur.fetchall()
    section_stats: Dict[int, Dict[str, Any]] = {
        sec["id"]: {
            "section_id": sec["id"],
            "section_name": sec["name"],
            "test_count": 0,
            "tats": [],
            "on_time_count": 0
        }
        for sec in all_sections
    }

    # Ward of origin accumulators
    ward_counts: Dict[str, int] = {}

    # Category accumulators (In-House, Referral, Outreach, Self-Request)
    category_counts: Dict[str, int] = {
        "In-House": 0,
        "Referral": 0,
        "Outreach": 0,
        "Self-Request": 0
    }

    # Test count tallies for demand ranking
    test_order_tallies: Dict[int, Dict[str, Any]] = {}

    for row in order_rows:
        v_id = row["visit_id"]
        distinct_visits.add(v_id)
        if v_id not in visit_dispatch_info:
            visit_dispatch_info[v_id] = {
                "dispatched_at": row["dispatched_at"],
                "min_ordered_at": row["ordered_at"],
                "min_entered_at": row["min_entered_at"]
            }
        else:
            if row["ordered_at"] and (not visit_dispatch_info[v_id]["min_ordered_at"] or row["ordered_at"] < visit_dispatch_info[v_id]["min_ordered_at"]):
                visit_dispatch_info[v_id]["min_ordered_at"] = row["ordered_at"]
            if row["min_entered_at"] and (not visit_dispatch_info[v_id]["min_entered_at"] or row["min_entered_at"] < visit_dispatch_info[v_id]["min_entered_at"]):
                visit_dispatch_info[v_id]["min_entered_at"] = row["min_entered_at"]

        sec_id = row["section_id"]
        sec_name = row["section_name"] or ""
        test_id = row["test_id"]
        test_name = row["test_name"] or ""
        order_cat = (row["order_category"] or "in-house").lower()
        w_origin = row["ward_of_origin"] or "Outpatient / GOPD"

        # Tally Ward of Origin
        ward_counts[w_origin] = ward_counts.get(w_origin, 0) + 1

        # Tally Category
        if "ref" in order_cat:
            cat_key = "Referral"
        elif "outreach" in order_cat:
            cat_key = "Outreach"
        elif "self" in order_cat:
            cat_key = "Self-Request"
        else:
            cat_key = "In-House"
        category_counts[cat_key] += 1

        # Tally Section
        if sec_id in section_stats:
            section_stats[sec_id]["test_count"] += 1
        else:
            section_stats[sec_id] = {
                "section_id": sec_id,
                "section_name": sec_name,
                "test_count": 1,
                "tats": [],
                "on_time_count": 0
            }

        # Tally test demand (respecting parent tests)
        if test_id not in test_order_tallies:
            test_order_tallies[test_id] = {
                "test_id": test_id,
                "test_name": test_name,
                "section_name": sec_name,
                "count": 0
            }
        test_order_tallies[test_id]["count"] += 1

        # Determine benchmark
        if "microbiology" in sec_name.lower() or "culture" in sec_name.lower():
            sla_benchmark = 2880.0
        else:
            sla_benchmark = 120.0

        # Compute TAT
        ordered_at = row["ordered_at"]
        entered_at = row["min_entered_at"]
        if ordered_at and entered_at:
            tat_val = _calc_diff_mins(entered_at, ordered_at)
            if tat_val is not None:
                section_stats[sec_id]["tats"].append(tat_val)
                if tat_val <= sla_benchmark:
                    section_stats[sec_id]["on_time_count"] += 1

    # Blend manual summary entries from backlog_entries (physical register counts)
    cur.execute("""
        SELECT 
            b.test_id,
            t.name AS test_name,
            s.id AS section_id,
            s.name AS section_name,
            SUM(b.done) AS sum_done,
            SUM(b.in_house) AS sum_in_house,
            SUM(b.referral) AS sum_referral,
            SUM(b.outreach) AS sum_outreach,
            SUM(b.self_request) AS sum_self_request
        FROM backlog_entries b
        JOIN tests t ON b.test_id = t.id
        JOIN sections s ON t.section_id = s.id
        WHERE b.entry_date >= ? AND b.entry_date <= ? AND b.done > 0
        GROUP BY b.test_id
    """, (s_str, e_str))
    backlog_rows = cur.fetchall()

    for b_row in backlog_rows:
        b_tid = b_row["test_id"]
        sec_id = b_row["section_id"]
        sec_name = b_row["section_name"] or ""
        test_name = b_row["test_name"] or ""
        done_val = b_row["sum_done"] or 0

        if done_val > 0:
            total_done += done_val

            category_counts["In-House"] += (b_row["sum_in_house"] or 0)
            category_counts["Referral"] += (b_row["sum_referral"] or 0)
            category_counts["Outreach"] += (b_row["sum_outreach"] or 0)
            category_counts["Self-Request"] += (b_row["sum_self_request"] or 0)

            if sec_id in section_stats:
                section_stats[sec_id]["test_count"] += done_val
            else:
                section_stats[sec_id] = {
                    "section_id": sec_id,
                    "section_name": sec_name,
                    "test_count": done_val,
                    "tats": [],
                    "on_time_count": 0
                }

            if b_tid not in test_order_tallies:
                test_order_tallies[b_tid] = {
                    "test_id": b_tid,
                    "test_name": test_name,
                    "section_name": sec_name,
                    "count": 0
                }
            test_order_tallies[b_tid]["count"] += done_val

    # Menu coverage: Query parent / standalone orderable tests only (parent_rollup_id IS NULL)
    cur.execute("""
        SELECT 
            s.id AS section_id,
            s.name AS section_name,
            t.id AS test_id,
            t.name AS test_name
        FROM tests t
        JOIN sections s ON t.section_id = s.id
        WHERE t.is_active = 1 AND t.parent_rollup_id IS NULL
        ORDER BY s.sort_order, s.id, t.name
    """)
    all_orderable_catalog = cur.fetchall()
    total_active_menu_items = len(all_orderable_catalog) if all_orderable_catalog else 1
    
    orderable_test_ids = {t["test_id"] for t in all_orderable_catalog}
    unique_orderable_ordered = len([tid for tid in test_order_tallies.keys() if tid in orderable_test_ids])
    menu_coverage_rate = round((unique_orderable_ordered / total_active_menu_items) * 100.0, 1)

    # Categories breakdown list
    categories_breakdown = []
    for c_name in ["In-House", "Referral", "Outreach", "Self-Request"]:
        c_cnt = category_counts.get(c_name, 0)
        c_pct = round((c_cnt / total_done) * 100.0, 1) if total_done > 0 else 0.0
        categories_breakdown.append({
            "category": c_name,
            "count": c_cnt,
            "percentage": c_pct
        })

    # Demand Dynamics:
    # 1. Top 5 Most Requested (count >= 1, sorted desc)
    ordered_orderable_tests = [t for tid, t in test_order_tallies.items() if t["count"] >= 1 and tid in orderable_test_ids]
    sorted_desc = sorted(ordered_orderable_tests, key=lambda x: x["count"], reverse=True)
    top_5_requested = sorted_desc[:5]

    # 2. Bottom 5 Least Requested (count >= 1, sorted asc)
    sorted_asc = sorted(ordered_orderable_tests, key=lambda x: x["count"])
    bottom_5_requested = sorted_asc[:5]

    # 3. Tests Not Requested (active orderable tests in catalog with count == 0)
    ordered_ids_set = set(test_order_tallies.keys())
    unrequested_tests = [
        {
            "test_id": t["test_id"],
            "test_name": t["test_name"],
            "section_name": t["section_name"],
            "count": 0
        }
        for t in all_orderable_catalog if t["test_id"] not in ordered_ids_set
    ]

    # 4. Appendix: Complete Diagnostic Menu Activity (Orderable Tests only)
    appendix_menu_activity = []
    for t in all_orderable_catalog:
        tid = t["test_id"]
        cnt = test_order_tallies.get(tid, {}).get("count", 0)
        appendix_menu_activity.append({
            "section_name": t["section_name"],
            "test_name": t["test_name"],
            "completed_count": cnt
        })

    # Section breakdown list
    sections_breakdown = []
    for s_id, s_info in section_stats.items():
        s_count = s_info["test_count"]
        pct = round((s_count / total_done) * 100.0, 1) if total_done > 0 else 0.0
        tats = s_info["tats"]
        if tats:
            avg_tat = round(sum(tats) / len(tats), 1)
            min_tat = round(min(tats), 1)
            max_tat = round(max(tats), 1)
            sla_pct = round((s_info["on_time_count"] / len(tats)) * 100.0, 1)
        else:
            avg_tat = 0.0
            min_tat = 0.0
            max_tat = 0.0
            sla_pct = 100.0

        sections_breakdown.append({
            "section_id": s_id,
            "section_name": s_info["section_name"],
            "test_count": s_count,
            "volume_percentage": pct,
            "avg_tat_mins": avg_tat,
            "min_tat_mins": min_tat,
            "max_tat_mins": max_tat,
            "sla_compliance_percent": sla_pct
        })

    # Ward of Origin breakdown list
    wards_breakdown = []
    for w_name, w_cnt in sorted(ward_counts.items(), key=lambda x: x[1], reverse=True):
        w_pct = round((w_cnt / total_done) * 100.0, 1) if total_done > 0 else 0.0
        wards_breakdown.append({
            "ward": w_name,
            "count": w_cnt,
            "percentage": w_pct
        })

    # Financial Year monthly trends calculation (Full 12-Month Financial Year: Jul .. Jun)
    ref_y, ref_m = ref_date.year, ref_date.month
    fy_start_year = ref_y if ref_m >= 7 else ref_y - 1

    trend_months = []
    curr_y, curr_m = fy_start_year, 7
    for _ in range(12):
        m_str = f"{curr_y}-{curr_m:02d}"
        m_short = datetime.date(curr_y, curr_m, 1).strftime("%b")
        trend_months.append((curr_y, curr_m, m_str, m_short))
        curr_m += 1
        if curr_m > 12:
            curr_m = 1
            curr_y += 1

    fy_window_start = f"{trend_months[0][2]}-01"
    fy_window_end = f"{trend_months[-1][0]}-06-30"

    section_names = [s["name"] for s in all_sections]
    section_matrix = {sn: [0]*12 for sn in section_names}
    monthly_totals = [0]*12
    monthly_trends_list = []

    # Single bulk query for completed orders across full 12 months grouped by month & section
    cur.execute("""
        SELECT 
            strftime('%Y-%m', to_ord.ordered_at) AS ym,
            s.name AS section_name,
            COUNT(to_ord.id) AS count_done
        FROM test_orders to_ord
        JOIN tests t ON to_ord.test_id = t.id
        JOIN sections s ON t.section_id = s.id
        WHERE to_ord.status = 'completed'
          AND DATE(to_ord.ordered_at) >= ? AND DATE(to_ord.ordered_at) <= ?
        GROUP BY ym, s.name
    """, (fy_window_start, fy_window_end))
    all_live_trends = {}
    for r in cur.fetchall():
        all_live_trends[(r["ym"], r["section_name"])] = r["count_done"]

    # Single bulk query for backlog entries across full 12 months grouped by month & section
    cur.execute("""
        SELECT 
            strftime('%Y-%m', b.entry_date) AS ym,
            s.name AS section_name,
            SUM(b.done) AS count_done
        FROM backlog_entries b
        JOIN tests t ON b.test_id = t.id
        JOIN sections s ON t.section_id = s.id
        WHERE b.entry_date >= ? AND b.entry_date <= ? AND b.done > 0
        GROUP BY ym, s.name
    """, (fy_window_start, fy_window_end))
    all_backlog_trends = {}
    for r in cur.fetchall():
        all_backlog_trends[(r["ym"], r["section_name"])] = r["count_done"] or 0

    for month_idx, (ty, tm, tmonth_str, m_short) in enumerate(trend_months):
        month_label = datetime.date(ty, tm, 1).strftime("%b %Y")
        month_entry = {"month_key": tmonth_str, "month_label": month_label, "month_short": m_short, "total": 0}
        
        for sec_name in section_names:
            v = all_live_trends.get((tmonth_str, sec_name), 0) + all_backlog_trends.get((tmonth_str, sec_name), 0)
            section_matrix[sec_name][month_idx] = v
            month_entry[sec_name] = v
            month_entry["total"] += v
            
        monthly_totals[month_idx] = month_entry["total"]
        monthly_trends_list.append(month_entry)

    matrix_rows = []
    for sn in section_names:
        counts = section_matrix[sn]
        row_tot = sum(counts)
        matrix_rows.append({
            "section_name": sn,
            "counts": counts,
            "total": row_tot
        })

    fy_grand_total = sum(monthly_totals)

    # Dispatch & Clinical TAT Completion Metrics
    total_period_visits = len(distinct_visits)
    dispatched_visits = [v for v in visit_dispatch_info.values() if v["dispatched_at"]]
    total_dispatched_visits = len(dispatched_visits)
    dispatch_rate_pct = round((total_dispatched_visits / total_period_visits * 100.0), 1) if total_period_visits > 0 else 0.0

    clinical_tats = []
    dispatch_lags = []
    for dv in dispatched_visits:
        d_at = dv["dispatched_at"]
        o_at = dv["min_ordered_at"]
        e_at = dv["min_entered_at"]
        if d_at and o_at:
            c_tat = _calc_diff_mins(d_at, o_at)
            if c_tat is not None:
                clinical_tats.append(c_tat)
        if d_at and e_at:
            d_lag = _calc_diff_mins(d_at, e_at)
            if d_lag is not None:
                dispatch_lags.append(d_lag)

    avg_clinical_tat_mins = round(sum(clinical_tats) / len(clinical_tats), 1) if clinical_tats else None
    avg_dispatch_lag_mins = round(sum(dispatch_lags) / len(dispatch_lags), 1) if dispatch_lags else None

    dispatch_metrics = {
        "total_visits": total_period_visits,
        "total_dispatched_visits": total_dispatched_visits,
        "dispatch_rate_pct": dispatch_rate_pct,
        "avg_clinical_tat_mins": avg_clinical_tat_mins,
        "avg_dispatch_lag_mins": avg_dispatch_lag_mins
    }

    return {
        "period": {
            "period_type": period_type,
            "formatted_period": formatted_period,
            "reference_date": ref_date.strftime("%Y-%m-%d"),
            "start_date": s_str,
            "end_date": e_str
        },
        "summary": {
            "total_done": total_done,
            "total_clients": len(distinct_visits),
            "menu_coverage_percent": menu_coverage_rate,
            "total_active_menu_items": total_active_menu_items,
            "unique_tests_ordered": unique_orderable_ordered
        },
        "dispatch_metrics": dispatch_metrics,
        "categories_breakdown": categories_breakdown,
        "sections_breakdown": sections_breakdown,
        "wards_breakdown": wards_breakdown,
        "demand_dynamics": {
            "top_requested_tests": top_5_requested,
            "least_requested_tests": bottom_5_requested,
            "unrequested_tests": unrequested_tests
        },
        "appendix_menu_activity": appendix_menu_activity,
        "monthly_trends": {
            "month_headers": [m[3] for m in trend_months],
            "sections": section_names,
            "matrix_rows": matrix_rows,
            "monthly_totals": monthly_totals,
            "grand_total": fy_grand_total,
            "trends": monthly_trends_list
        }
    }
