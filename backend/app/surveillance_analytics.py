import sqlite3
import datetime
from typing import Optional, Dict, Any
from .operations_analytics import calculate_date_range, format_reporting_period

def is_order_surveillance_incident(test_name: str, results: list, crossmatches: list = None) -> bool:
    """
    Determines if a completed test order represents a positive / incident / abnormal case for surveillance.
    - For quantitative Hematology (CBC): Critical Anemia (Hb < 8.0 g/dL) or panic/critical/abnormal flags count.
    - For Urinalysis / Stool: positive/abnormal parameters count.
    - For Crossmatch: any incompatible donor unit counts.
    - For Blood HCG: >= 25 mIU/mL counts.
    - For CD4: Absolute < 500 or < 200, CD4% < 25%, or RDT < 200 counts.
    - For ASO Titer: >= 200 IU/mL counts.
    - For EID: PCR or Rapid positive/detected counts.
    - For infectious diseases & qualitative assays (Malaria, HIV, BAT, HBsAg, VDRL, Sickling, Widal): positive/reactive counts.
    """
    t_name_lower = (test_name or "").lower()
    
    # 1. CBC / Hematology
    if "cbc" in t_name_lower or "blood count" in t_name_lower:
        for res in results:
            flag = (res["clinical_flag"] or "").strip().lower()
            p_name = (res["parameter_name"] or "").lower()
            val_str = str(res["result_value"] or "").strip()
            
            if flag in ["l*", "h*", "critical", "panic", "critical low", "critical high", "abnormal", "h", "l"]:
                return True
            
            if "hb" in p_name or "hemoglobin" in p_name:
                try:
                    hb_val = float(val_str.split()[0])
                    if hb_val < 8.0:
                        return True
                except (ValueError, TypeError):
                    pass
        return False

    # 2. Crossmatch & Compatibility testing
    if crossmatches:
        for cm in crossmatches:
            c_stat = str(cm.get("compatibility_status") or "").upper()
            if "INCOMPATIBLE" in c_stat or cm.get("failing_phase"):
                return True

    # 3. Blood HCG (>= 25 mIU/mL is positive)
    if "hcg" in t_name_lower and ("blood" in t_name_lower or "serum" in t_name_lower or "b-hcg" in t_name_lower):
        for res in results:
            val_str = str(res["result_value"] or "").strip()
            try:
                val_num = float(val_str.split()[0].replace(">", "").replace("<", ""))
                if val_num >= 25.0:
                    return True
            except (ValueError, TypeError):
                if any(x in val_str.lower() for x in ["positive", "reactive"]):
                    return True

    # 4. CD4 (Absolute < 500 or < 200, CD4% < 25%, or RDT < 200)
    if "cd4" in t_name_lower:
        for res in results:
            val_str = str(res["result_value"] or "").strip()
            flag = (res["clinical_flag"] or "").strip().lower()
            if flag in ["l", "l*", "critical", "panic", "abnormal"]:
                return True
            if "< 200" in val_str.lower() or "below 200" in val_str.lower():
                return True
            try:
                num = float(val_str.replace("%", "").split()[0].replace(">", "").replace("<", ""))
                if "percent" in t_name_lower or "%" in t_name_lower:
                    if num < 25.0:
                        return True
                else:
                    if num < 500.0:
                        return True
            except (ValueError, TypeError):
                pass

    # 5. ASO Titer (>= 200 IU/mL is abnormal/reactive)
    if "aso" in t_name_lower:
        for res in results:
            val_str = str(res["result_value"] or "").strip()
            flag = (res["clinical_flag"] or "").strip().lower()
            if flag in ["h", "h*", "critical", "panic", "abnormal"]:
                return True
            try:
                num = float(val_str.split()[0].replace(">", "").replace("<", ""))
                if num >= 200.0:
                    return True
            except (ValueError, TypeError):
                if any(x in val_str.lower() for x in ["positive", "reactive"]):
                    return True

    # 6. EID PCR & Rapid (Positive / Detected / Reactive)
    if "eid" in t_name_lower:
        for res in results:
            val_str = str(res["result_value"] or "").strip().lower()
            if any(x in val_str for x in ["positive", "detected", "reactive"]) and "not detected" not in val_str and "non-reactive" not in val_str:
                return True

    # 7. Default / Single tests
    for res in results:
        if res["is_positive"] == 1:
            return True
        val = (res["result_value"] or "").strip().lower()
        if val in ["positive", "abnormal", "reactive", "detected"] or val.startswith("positive") or val.startswith("reactive"):
            return True
        flag = (res["clinical_flag"] or "").strip().lower()
        if flag in ["panic", "critical", "abnormal", "high", "h*", "l*", "l", "h"]:
            return True
            
    return False

def calculate_surveillance_metrics(
    conn: sqlite3.Connection,
    period_type: str = "Month",
    reference_date: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
) -> Dict[str, Any]:
    """
    Calculates deterministic AMH Laboratory Epidemiological Surveillance & Disease Incidence metrics.
    Focuses strictly on assays and clinical panels configured with is_tracked = 1.
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

    # Query all active tracked tests (is_tracked = 1)
    cur.execute("""
        SELECT 
            s.id AS section_id,
            s.name AS section_name,
            t.id AS test_id,
            t.name AS test_name,
            t.parent_rollup_id
        FROM tests t
        JOIN sections s ON t.section_id = s.id
        WHERE t.is_active = 1 AND t.is_tracked = 1
        ORDER BY s.sort_order, s.id, t.name
    """)
    tracked_catalog = cur.fetchall()

    # Tracked parent/orderable tests
    orderable_tracked_map = {}
    for t in tracked_catalog:
        if t["parent_rollup_id"] is None:
            orderable_tracked_map[t["test_id"]] = {
                "test_id": t["test_id"],
                "test_name": t["test_name"],
                "section_id": t["section_id"],
                "section_name": t["section_name"],
                "evaluated": 0,
                "positive": 0,
                "negative": 0,
                "incidence_rate": 0.0
            }

    # Query completed orders for tracked tests within the period
    cur.execute("""
        SELECT 
            to_ord.id AS order_id,
            to_ord.visit_id,
            to_ord.test_id,
            to_ord.ordered_at,
            t.name AS test_name,
            t.parent_rollup_id,
            s.id AS section_id,
            s.name AS section_name,
            v.ward_of_origin
        FROM test_orders to_ord
        JOIN tests t ON to_ord.test_id = t.id
        JOIN sections s ON t.section_id = s.id
        JOIN visits v ON to_ord.visit_id = v.id
        WHERE to_ord.status = 'completed'
          AND v.is_deleted = 0
          AND t.is_tracked = 1
          AND t.parent_rollup_id IS NULL
          AND DATE(to_ord.ordered_at) >= ?
          AND DATE(to_ord.ordered_at) <= ?
        ORDER BY to_ord.ordered_at
    """, (s_str, e_str))
    order_rows = cur.fetchall()

    # Section accumulators
    cur.execute("SELECT id, name FROM sections ORDER BY sort_order, id")
    all_sections = cur.fetchall()
    section_stats: Dict[int, Dict[str, Any]] = {
        sec["id"]: {
            "section_id": sec["id"],
            "section_name": sec["name"],
            "evaluated_count": 0,
            "incident_count": 0,
            "incidence_rate_percent": 0.0
        }
        for sec in all_sections
    }

    # Ward of origin accumulators: {ward: {"evaluated": int, "positive": int}}
    ward_stats: Dict[str, Dict[str, int]] = {}

    total_evaluated = 0
    total_incident_cases = 0

    for row in order_rows:
        oid = row["order_id"]
        tid = row["test_id"]
        sec_id = row["section_id"]
        w_origin = row["ward_of_origin"] or "Outpatient / GOPD"

        if w_origin not in ward_stats:
            ward_stats[w_origin] = {"evaluated": 0, "positive": 0}
        ward_stats[w_origin]["evaluated"] += 1

        total_evaluated += 1
        if sec_id in section_stats:
            section_stats[sec_id]["evaluated_count"] += 1

        if tid in orderable_tracked_map:
            orderable_tracked_map[tid]["evaluated"] += 1

        # Check if the order had any positive/abnormal result
        cur.execute("""
            SELECT tr.is_positive, tr.clinical_flag, tr.result_value, tp.parameter_name
            FROM test_results tr
            LEFT JOIN test_parameters tp ON tr.parameter_id = tp.id
            WHERE tr.order_id = ?
        """, (oid,))
        results = cur.fetchall()

        cur.execute("""
            SELECT compatibility_status
            FROM donor_crossmatches
            WHERE order_id = ?
        """, (oid,))
        cms = [dict(r) for r in cur.fetchall()]

        is_order_incident = is_order_surveillance_incident(row["test_name"], results, cms)

        if is_order_incident:
            total_incident_cases += 1
            if sec_id in section_stats:
                section_stats[sec_id]["incident_count"] += 1
            if tid in orderable_tracked_map:
                orderable_tracked_map[tid]["positive"] += 1
            ward_stats[w_origin]["positive"] += 1

    # Blend manual summary entries from backlog_entries for tracked tests
    cur.execute("""
        SELECT 
            b.test_id,
            t.name AS test_name,
            s.id AS section_id,
            s.name AS section_name,
            SUM(b.done) AS sum_done,
            SUM(CASE WHEN b.positive IS NOT NULL THEN b.positive ELSE 0 END) AS sum_positive
        FROM backlog_entries b
        JOIN tests t ON b.test_id = t.id
        JOIN sections s ON t.section_id = s.id
        WHERE b.entry_date >= ? AND b.entry_date <= ? AND t.is_tracked = 1 AND t.parent_rollup_id IS NULL AND b.done > 0
        GROUP BY b.test_id
    """, (s_str, e_str))
    backlog_tracked_rows = cur.fetchall()

    for b_row in backlog_tracked_rows:
        b_tid = b_row["test_id"]
        sec_id = b_row["section_id"]
        sec_name = b_row["section_name"] or ""
        test_name = b_row["test_name"] or ""
        done_val = b_row["sum_done"] or 0
        pos_val = b_row["sum_positive"] or 0

        if done_val > 0:
            total_evaluated += done_val
            total_incident_cases += pos_val

            if sec_id in section_stats:
                section_stats[sec_id]["evaluated_count"] += done_val
                section_stats[sec_id]["incident_count"] += pos_val
            else:
                section_stats[sec_id] = {
                    "section_id": sec_id,
                    "section_name": sec_name,
                    "evaluated_count": done_val,
                    "incident_count": pos_val,
                    "incidence_rate_percent": 0.0
                }

            if b_tid in orderable_tracked_map:
                orderable_tracked_map[b_tid]["evaluated"] += done_val
                orderable_tracked_map[b_tid]["positive"] += pos_val

    # Calculate rates for each test
    surveillance_ledger = []
    for tid, item in orderable_tracked_map.items():
        ev = item["evaluated"]
        pos = item["positive"]
        item["negative"] = max(0, ev - pos)
        item["incidence_rate"] = round((pos / ev) * 100.0, 1) if ev > 0 else 0.0
        surveillance_ledger.append(item)

    # Sort ledger by section then test name
    surveillance_ledger.sort(key=lambda x: (x["section_name"], x["test_name"]))

    # Calculate rates for sections
    sections_breakdown = []
    for s_id, s_info in section_stats.items():
        ev = s_info["evaluated_count"]
        pos = s_info["incident_count"]
        rate = round((pos / ev) * 100.0, 1) if ev > 0 else 0.0
        s_info["incidence_rate_percent"] = rate
        sections_breakdown.append(s_info)

    # Calculate overall incidence rate
    overall_incidence_rate = round((total_incident_cases / total_evaluated) * 100.0, 1) if total_evaluated > 0 else 0.0

    # Ward breakdown list
    wards_breakdown = []
    for w_name, w_info in sorted(ward_stats.items(), key=lambda x: x[1]["positive"], reverse=True):
        ev = w_info["evaluated"]
        pos = w_info["positive"]
        rate = round((pos / ev) * 100.0, 1) if ev > 0 else 0.0
        wards_breakdown.append({
            "ward": w_name,
            "evaluated": ev,
            "positive_cases": pos,
            "incidence_rate": rate
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

    # Identify all tracked conditions that had positive cases during this Financial Year
    fy_start_str = f"{trend_months[0][2]}-01"
    fy_end_str = f"{trend_months[-1][2]}-31"

    cur.execute("""
        SELECT t.name as test_name,
               COUNT(DISTINCT to_ord.id) as pos_cnt
        FROM test_orders to_ord
        JOIN tests t ON to_ord.test_id = t.id
        JOIN test_results tr ON tr.order_id = to_ord.id
        WHERE to_ord.status = 'completed'
          AND t.is_tracked = 1
          AND t.parent_rollup_id IS NULL
          AND DATE(to_ord.ordered_at) >= ? AND DATE(to_ord.ordered_at) <= ?
          AND (tr.is_positive = 1 OR (tr.clinical_flag IS NOT NULL AND tr.clinical_flag != '' AND tr.clinical_flag != 'Normal'))
        GROUP BY t.name
    """, (fy_start_str, fy_end_str))
    live_fy_pos = dict(cur.fetchall())

    cur.execute("""
        SELECT t.name as test_name,
               SUM(CASE WHEN b.positive IS NOT NULL THEN b.positive ELSE 0 END) as pos_sum
        FROM backlog_entries b
        JOIN tests t ON b.test_id = t.id
        WHERE b.entry_date >= ? AND b.entry_date <= ? AND t.is_tracked = 1 AND t.parent_rollup_id IS NULL AND b.done > 0
        GROUP BY t.name
    """, (fy_start_str, fy_end_str))
    backlog_fy_pos = dict(cur.fetchall())

    combined_fy_pos = {}
    for tn, cnt in live_fy_pos.items():
        combined_fy_pos[tn] = combined_fy_pos.get(tn, 0) + cnt
    for tn, cnt in backlog_fy_pos.items():
        combined_fy_pos[tn] = combined_fy_pos.get(tn, 0) + (cnt or 0)

    # Sort all conditions with positive cases descending by case count, then alphabetically
    active_conditions = [tn for tn, cnt in sorted(combined_fy_pos.items(), key=lambda x: (x[1], x[0]), reverse=True) if cnt > 0]
    if not active_conditions and surveillance_ledger:
        active_conditions = [t["test_name"] for t in sorted(surveillance_ledger, key=lambda x: x["evaluated"], reverse=True)[:6]]

    # Matrix data structure: {cond_name: [m1, m2, ..., m12, total]}
    condition_matrix = {cn: [0]*12 for cn in active_conditions}
    monthly_totals = [0]*12
    monthly_trends_list = []

    for month_idx, (ty, tm, tmonth_str, m_short) in enumerate(trend_months):
        m_start = f"{tmonth_str}-01"
        if tm == 12:
            m_end = f"{ty}-12-31"
        else:
            m_end = (datetime.date(ty, tm + 1, 1) - datetime.timedelta(days=1)).strftime("%Y-%m-%d")

        cur.execute("""
            SELECT 
                to_ord.id AS order_id,
                t.name AS test_name
            FROM test_orders to_ord
            JOIN tests t ON to_ord.test_id = t.id
            WHERE to_ord.status = 'completed'
              AND t.is_tracked = 1
              AND t.parent_rollup_id IS NULL
              AND DATE(to_ord.ordered_at) >= ? AND DATE(to_ord.ordered_at) <= ?
        """, (m_start, m_end))
        m_orders = cur.fetchall()

        month_label = datetime.date(ty, tm, 1).strftime("%b %Y")
        month_entry = {"month_key": tmonth_str, "month_label": month_label, "total_positives": 0}
        
        for ord_row in m_orders:
            o_id = ord_row["order_id"]
            t_name = ord_row["test_name"]
            cur.execute("""
                SELECT tr.is_positive, tr.clinical_flag, tr.result_value, tp.parameter_name
                FROM test_results tr
                LEFT JOIN test_parameters tp ON tr.parameter_id = tp.id
                WHERE tr.order_id = ?
            """, (o_id,))
            ord_res = cur.fetchall()

            if is_order_surveillance_incident(t_name, ord_res):
                month_entry["total_positives"] += 1
                if t_name in condition_matrix:
                    condition_matrix[t_name][month_idx] += 1

        # Add manual backlog register positive entries
        cur.execute("""
            SELECT t.name as test_name, SUM(CASE WHEN b.positive IS NOT NULL THEN b.positive ELSE 0 END) as pos_sum
            FROM backlog_entries b
            JOIN tests t ON b.test_id = t.id
            WHERE b.entry_date >= ? AND b.entry_date <= ? AND t.is_tracked = 1 AND t.parent_rollup_id IS NULL AND b.done > 0
            GROUP BY t.name
        """, (m_start, m_end))
        for b_pos_row in cur.fetchall():
            p_cnt = b_pos_row["pos_sum"] or 0
            t_nm = b_pos_row["test_name"]
            month_entry["total_positives"] += p_cnt
            if t_nm in condition_matrix:
                condition_matrix[t_nm][month_idx] += p_cnt
            
        monthly_totals[month_idx] = month_entry["total_positives"]
        monthly_trends_list.append(month_entry)

    # Calculate row totals for each condition
    matrix_rows = []
    for cn in active_conditions:
        counts = condition_matrix[cn]
        row_tot = sum(counts)
        matrix_rows.append({
            "condition_name": cn,
            "counts": counts,
            "total": row_tot
        })

    fy_grand_total = sum(monthly_totals)

    return {
        "period": {
            "period_type": period_type,
            "formatted_period": formatted_period,
            "reference_date": ref_date.strftime("%Y-%m-%d"),
            "start_date": s_str,
            "end_date": e_str
        },
        "summary": {
            "total_evaluated": total_evaluated,
            "total_incident_cases": total_incident_cases,
            "overall_incidence_rate": overall_incidence_rate,
            "tracked_menu_count": len(orderable_tracked_map)
        },
        "sections_breakdown": sections_breakdown,
        "surveillance_ledger": surveillance_ledger,
        "wards_breakdown": wards_breakdown,
        "monthly_trends": {
            "month_headers": [m[3] for m in trend_months],
            "conditions": active_conditions,
            "matrix_rows": matrix_rows,
            "monthly_totals": monthly_totals,
            "grand_total": fy_grand_total,
            "trends": monthly_trends_list
        }
    }
