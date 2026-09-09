import sqlite3
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from ..database import get_db
from ..schemas import StockReceiveRequest, StockAdjustRequest
from ..auth import get_current_user, require_admin

router = APIRouter(prefix="/api/stock", tags=["Inventory & Diagnostic Kits"])

def deplete_kit_stock(conn: sqlite3.Connection, kit_name: Optional[str] = None, test_id: Optional[int] = None, order_id: Optional[int] = None, user_id: Optional[int] = None, count: int = 1):
    """
    FEFO (First-Expiring-First-Out) Auto-Depletion Engine.
    Deducts stock from the earliest-expiring active unexpired lot(s).
    Supports multi-lot split depletion if count exceeds a single lot.
    Enforces strict Expiry Lockout Safety Gate.
    """
    cur = conn.cursor()
    today_str = datetime.date.today().isoformat()

    # Find candidate active lots
    query = """
        SELECT id, kit_name, lot_number, expiry_date, current_quantity, min_threshold
        FROM diagnostic_kit_lots
        WHERE is_active = 1
    """
    params = []

    if test_id is not None:
        query += " AND (test_id = ? OR LOWER(kit_name) = (SELECT LOWER(name) FROM tests WHERE id = ?) OR LOWER(kit_name) = (SELECT LOWER(consumable_name) FROM tests WHERE id = ?))"
        params.extend([test_id, test_id, test_id])
    elif kit_name:
        query += " AND (LOWER(kit_name) = LOWER(?) OR kit_name LIKE ?)"
        params.extend([kit_name.strip(), f"%{kit_name.strip()}%"])
    else:
        return None

    query += " ORDER BY expiry_date ASC, id ASC"
    cur.execute(query, params)
    lots = cur.fetchall()

    if not lots:
        return None

    unexpired_lots = [l for l in lots if str(l["expiry_date"]) >= today_str and l["current_quantity"] > 0]
    matched_name = lots[0]["kit_name"]

    if not unexpired_lots:
        raise HTTPException(
            status_code=400,
            detail=f"Safety Block: Attempted use of expired kit lot for '{matched_name}'. All active lots have expired or are depleted."
        )

    total_avail = sum(l["current_quantity"] for l in unexpired_lots)
    if total_avail < count:
        raise HTTPException(
            status_code=400,
            detail=f"Stock Depleted: Insufficient unexpired stock for '{matched_name}' ({total_avail} available, {count} required)."
        )

    remaining_to_deduct = count
    depleted_records = []

    for lot in unexpired_lots:
        if remaining_to_deduct <= 0:
            break
        lot_id = lot["id"]
        deduct_from_this_lot = min(lot["current_quantity"], remaining_to_deduct)
        new_qty = lot["current_quantity"] - deduct_from_this_lot

        cur.execute("UPDATE diagnostic_kit_lots SET current_quantity = ? WHERE id = ?", (new_qty, lot_id))
        cur.execute("""
            INSERT INTO diagnostic_kit_transactions (lot_id, transaction_type, quantity_delta, order_id, reason, user_id)
            VALUES (?, 'TEST_USAGE', ?, ?, 'Automated clinical test deduction', ?)
        """, (lot_id, -deduct_from_this_lot, order_id, user_id))

        depleted_records.append({
            "lot_id": lot_id,
            "kit_name": lot["kit_name"],
            "lot_number": lot["lot_number"],
            "deducted": deduct_from_this_lot,
            "current_quantity": new_qty
        })
        remaining_to_deduct -= deduct_from_this_lot

    return depleted_records[0] if len(depleted_records) == 1 else {"depleted_lots": depleted_records, "total_deducted": count}


def compute_lot_status(expiry_date_str: str, current_quantity: int, min_threshold: int) -> str:
    today = datetime.date.today()
    try:
        exp_date = datetime.date.fromisoformat(str(expiry_date_str)[:10])
    except Exception:
        exp_date = today

    days_to_exp = (exp_date - today).days

    if days_to_exp < 0:
        return "Expired"
    if current_quantity <= 0:
        return "Depleted"
    if days_to_exp <= 60:
        return "Near Expiry"
    if current_quantity <= min_threshold:
        return "Low Stock"
    return "Active"


@router.get("/lots")
def get_lots(
    category: Optional[str] = None,
    active_only: bool = True,
    conn: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    cur = conn.cursor()
    query = """
        SELECT id, test_id, kit_name, category, lot_number, expiry_date,
               initial_quantity, current_quantity, min_threshold, is_active, received_date
        FROM diagnostic_kit_lots
        WHERE 1=1
    """
    params = []
    if active_only:
        query += " AND is_active = 1"
    if category and category.lower() != "all":
        query += " AND LOWER(category) LIKE LOWER(?)"
        params.append(f"%{category}%")

    query += " ORDER BY category ASC, kit_name ASC, expiry_date ASC"
    cur.execute(query, params)
    rows = cur.fetchall()

    result = []
    today = datetime.date.today()
    for r in rows:
        d = dict(r)
        d["status"] = compute_lot_status(d["expiry_date"], d["current_quantity"], d["min_threshold"])
        try:
            exp_date = datetime.date.fromisoformat(str(d["expiry_date"])[:10])
            d["days_to_expiry"] = (exp_date - today).days
        except Exception:
            d["days_to_expiry"] = None
        result.append(d)
    return result


@router.get("/summary")
def get_stock_summary(
    category: Optional[str] = None,
    conn: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    cur = conn.cursor()
    today_str = datetime.date.today().isoformat()
    near_expiry_str = (datetime.date.today() + datetime.timedelta(days=60)).isoformat()

    query = """
        SELECT kit_name, category,
               SUM(current_quantity) as total_quantity,
               MAX(min_threshold) as min_threshold,
               COUNT(id) as total_lots,
               SUM(CASE WHEN is_active = 1 AND current_quantity > 0 AND expiry_date >= ? THEN 1 ELSE 0 END) as active_lots_count,
               SUM(CASE WHEN is_active = 1 AND expiry_date >= ? AND expiry_date <= ? THEN 1 ELSE 0 END) as expiring_soon_count,
               SUM(CASE WHEN is_active = 1 AND expiry_date < ? THEN 1 ELSE 0 END) as expired_count
        FROM diagnostic_kit_lots
        WHERE is_active = 1
    """
    params = [today_str, today_str, near_expiry_str, today_str]

    if category and category.lower() != "all":
        query += " AND LOWER(category) LIKE LOWER(?)"
        params.append(f"%{category}%")

    query += " GROUP BY kit_name, category ORDER BY category ASC, kit_name ASC"
    cur.execute(query, params)
    rows = cur.fetchall()

    summary = []
    for r in rows:
        total_qty = r["total_quantity"] or 0
        min_thresh = r["min_threshold"] or 25
        expiring = r["expiring_soon_count"] or 0
        expired = r["expired_count"] or 0

        if total_qty <= 0:
            status = "Depleted"
        elif total_qty <= min_thresh:
            status = "Low Stock"
        elif expiring > 0:
            status = "Near Expiry"
        else:
            status = "Adequate"

        summary.append({
            "kit_name": r["kit_name"],
            "category": r["category"],
            "total_quantity": total_qty,
            "min_threshold": min_thresh,
            "active_lots_count": r["active_lots_count"] or 0,
            "expiring_soon_count": expiring,
            "expired_count": expired,
            "status": status
        })

    # Also include tracked diagnostic test consumables from tests catalog if not yet registered in lots
    existing_kit_names = {s["kit_name"].lower() for s in summary}
    cur.execute("""
        SELECT t.name, t.consumable_name, s.name as section_name
        FROM tests t
        LEFT JOIN sections s ON t.section_id = s.id
        WHERE t.is_active = 1 AND (t.tracks_stock = 1 OR t.consumable_name IS NOT NULL)
    """)
    for t in cur.fetchall():
        c_name = t["consumable_name"] or t["name"]
        if c_name.lower() not in existing_kit_names:
            cat = "General"
            sec = (t["section_name"] or "").lower()
            if "hiv" in sec or "hiv" in c_name.lower(): cat = "Serology / HIV"
            elif "parasit" in sec or "malaria" in c_name.lower(): cat = "Parasitology"
            elif "urinalysis" in sec: cat = "Urinalysis"
            elif "serology" in sec: cat = "Serology"
            elif "molecular" in sec: cat = "Molecular / EID"

            if not category or category.lower() == "all" or category.lower() in cat.lower():
                summary.append({
                    "kit_name": c_name,
                    "category": cat,
                    "total_quantity": 0,
                    "min_threshold": 25,
                    "active_lots_count": 0,
                    "expiring_soon_count": 0,
                    "expired_count": 0,
                    "status": "No Stock Registered"
                })
                existing_kit_names.add(c_name.lower())

    return summary


@router.post("/receive")
def receive_stock_lot(
    req: StockReceiveRequest,
    conn: sqlite3.Connection = Depends(get_db),
    admin_user: dict = Depends(require_admin)
):
    if req.initial_quantity <= 0:
        raise HTTPException(status_code=400, detail="Initial quantity must be greater than 0")
    
    kit_name = req.kit_name.strip()
    lot_number = req.lot_number.strip()
    if not kit_name or not lot_number:
        raise HTTPException(status_code=400, detail="Kit name and lot number are required")

    try:
        exp_date = datetime.date.fromisoformat(req.expiry_date.strip()[:10])
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid expiry date format. Expected YYYY-MM-DD.")
    
    if exp_date <= datetime.date.today():
        raise HTTPException(status_code=400, detail=f"Safety Gate: Cannot receive expired stock lot (Expiry date {req.expiry_date}). Expiry must be a future date.")

    try:
        cur = conn.cursor()
        cur.execute("SELECT id FROM diagnostic_kit_lots WHERE LOWER(kit_name) = LOWER(?) AND LOWER(lot_number) = LOWER(?)", (kit_name, lot_number))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail=f"Lot '{lot_number}' already exists for kit '{kit_name}'")

        cur.execute("""
            INSERT INTO diagnostic_kit_lots (test_id, kit_name, category, lot_number, expiry_date, initial_quantity, current_quantity, min_threshold, is_active, received_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
        """, (req.test_id, kit_name, req.category or "General", lot_number, req.expiry_date, req.initial_quantity, req.initial_quantity, max(0, req.min_threshold or 25), admin_user["id"]))
        lot_id = cur.lastrowid

        cur.execute("""
            INSERT INTO diagnostic_kit_transactions (lot_id, transaction_type, quantity_delta, reason, user_id)
            VALUES (?, 'RECEIPT', ?, 'New stock lot received', ?)
        """, (lot_id, req.initial_quantity, admin_user["id"]))

        conn.execute("INSERT INTO audit_log (user_id, action, detail) VALUES (?, 'STOCK_RECEIVE', ?)",
                     (admin_user["id"], f"Received {req.initial_quantity} units of {kit_name} (Lot {lot_number}, Exp: {req.expiry_date})"))
        conn.commit()
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to receive stock lot: {str(e)}")

    return {"status": "success", "lot_id": lot_id, "message": f"Successfully received {req.initial_quantity} units of {kit_name}"}


@router.post("/adjust")
def adjust_stock(
    req: StockAdjustRequest,
    conn: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    if not req.reason or not req.reason.strip():
        raise HTTPException(status_code=400, detail="Reason is strictly required for stock adjustments or wastage logging")

    delta = req.quantity_delta
    if req.transaction_type == "WASTAGE_QC" and delta > 0:
        delta = -delta

    if delta == 0:
        raise HTTPException(status_code=400, detail="Quantity adjustment cannot be zero")

    try:
        cur = conn.cursor()
        cur.execute("SELECT id, kit_name, lot_number, current_quantity FROM diagnostic_kit_lots WHERE id = ?", (req.lot_id,))
        lot = cur.fetchone()
        if not lot:
            raise HTTPException(status_code=404, detail="Stock lot not found")

        new_qty = lot["current_quantity"] + delta
        if new_qty < 0:
            raise HTTPException(status_code=400, detail=f"Adjustment would result in negative stock ({new_qty}). Current on hand: {lot['current_quantity']}")

        cur.execute("UPDATE diagnostic_kit_lots SET current_quantity = ? WHERE id = ?", (new_qty, req.lot_id))
        cur.execute("""
            INSERT INTO diagnostic_kit_transactions (lot_id, transaction_type, quantity_delta, reason, user_id)
            VALUES (?, ?, ?, ?, ?)
        """, (req.lot_id, req.transaction_type, delta, req.reason.strip(), current_user["id"]))

        conn.execute("INSERT INTO audit_log (user_id, action, detail) VALUES (?, 'STOCK_ADJUST', ?)",
                     (current_user["id"], f"Adjusted {lot['kit_name']} (Lot {lot['lot_number']}) by {delta} ({req.transaction_type}). Reason: {req.reason}"))
        conn.commit()
    except HTTPException:
        conn.rollback()
        raise
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to adjust stock: {str(e)}")

    return {"status": "success", "new_quantity": new_qty, "message": f"Stock updated. New balance: {new_qty} units"}


@router.get("/transactions")
def get_stock_transactions(
    lot_id: Optional[int] = None,
    limit: int = 100,
    conn: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    cur = conn.cursor()
    query = """
        SELECT t.id, t.lot_id, l.kit_name, l.lot_number, l.category,
               t.transaction_type, t.quantity_delta, t.order_id, t.reason,
               t.created_at, u.username
        FROM diagnostic_kit_transactions t
        JOIN diagnostic_kit_lots l ON t.lot_id = l.id
        LEFT JOIN users u ON t.user_id = u.id
        WHERE 1=1
    """
    params = []
    if lot_id:
        query += " AND t.lot_id = ?"
        params.append(lot_id)

    query += " ORDER BY t.created_at DESC, t.id DESC LIMIT ?"
    params.append(limit)

    cur.execute(query, params)
    return [dict(r) for r in cur.fetchall()]


@router.get("/alerts")
def get_stock_alerts(
    conn: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    cur = conn.cursor()
    today_str = datetime.date.today().isoformat()
    near_expiry_str = (datetime.date.today() + datetime.timedelta(days=60)).isoformat()

    alerts = []

    # 1. Total stock at or below minimum threshold
    cur.execute("""
        SELECT kit_name, category, SUM(current_quantity) as total_qty, MAX(min_threshold) as min_thresh
        FROM diagnostic_kit_lots
        WHERE is_active = 1
        GROUP BY kit_name, category
        HAVING total_qty <= min_thresh
        ORDER BY total_qty ASC
    """)
    for r in cur.fetchall():
        alerts.append({
            "alert_type": "LOW_STOCK",
            "message": f"Low stock warning: '{r['kit_name']}' is at {r['total_qty']} units (Minimum threshold: {r['min_thresh']}).",
            "kit_name": r["kit_name"],
            "lot_number": None,
            "expiry_date": None,
            "current_quantity": r["total_qty"],
            "min_threshold": r["min_thresh"]
        })

    # 2. Lots expiring within 60 days
    cur.execute("""
        SELECT kit_name, lot_number, expiry_date, current_quantity, min_threshold
        FROM diagnostic_kit_lots
        WHERE is_active = 1 AND current_quantity > 0 AND expiry_date >= ? AND expiry_date <= ?
        ORDER BY expiry_date ASC
    """, (today_str, near_expiry_str))
    for r in cur.fetchall():
        alerts.append({
            "alert_type": "NEAR_EXPIRY",
            "message": f"Near expiry: '{r['kit_name']}' Lot {r['lot_number']} expires on {r['expiry_date']} ({r['current_quantity']} units remaining).",
            "kit_name": r["kit_name"],
            "lot_number": r["lot_number"],
            "expiry_date": r["expiry_date"],
            "current_quantity": r["current_quantity"],
            "min_threshold": r["min_threshold"]
        })

    # 3. Expired active lots with remaining stock
    cur.execute("""
        SELECT kit_name, lot_number, expiry_date, current_quantity, min_threshold
        FROM diagnostic_kit_lots
        WHERE is_active = 1 AND current_quantity > 0 AND expiry_date < ?
        ORDER BY expiry_date ASC
    """, (today_str,))
    for r in cur.fetchall():
        alerts.append({
            "alert_type": "EXPIRED",
            "message": f"Expired lot: '{r['kit_name']}' Lot {r['lot_number']} expired on {r['expiry_date']}. Usage is locked.",
            "kit_name": r["kit_name"],
            "lot_number": r["lot_number"],
            "expiry_date": r["expiry_date"],
            "current_quantity": r["current_quantity"],
            "min_threshold": r["min_threshold"]
        })

    return alerts


@router.get("/reconciliation")
def get_stock_reconciliation(
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    conn: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    cur = conn.cursor()
    today_str = datetime.date.today().isoformat()
    start_date = from_date or f"{today_str[:7]}-01"
    end_date = to_date or today_str

    # Get distinct kits
    cur.execute("SELECT DISTINCT kit_name, category FROM diagnostic_kit_lots ORDER BY category, kit_name")
    kits = cur.fetchall()

    reconciliation = []
    for k in kits:
        k_name = k["kit_name"]
        k_cat = k["category"]

        # 1. Total kit usage transactions in date range
        cur.execute("""
            SELECT COALESCE(SUM(ABS(t.quantity_delta)), 0)
            FROM diagnostic_kit_transactions t
            JOIN diagnostic_kit_lots l ON t.lot_id = l.id
            WHERE LOWER(l.kit_name) = LOWER(?)
              AND t.transaction_type = 'TEST_USAGE'
              AND DATE(t.created_at) >= ? AND DATE(t.created_at) <= ?
        """, (k_name, start_date, end_date))
        consumed = cur.fetchone()[0]

        # 2. Total wastage / QC transactions
        cur.execute("""
            SELECT COALESCE(SUM(ABS(t.quantity_delta)), 0)
            FROM diagnostic_kit_transactions t
            JOIN diagnostic_kit_lots l ON t.lot_id = l.id
            WHERE LOWER(l.kit_name) = LOWER(?)
              AND t.transaction_type = 'WASTAGE_QC'
              AND DATE(t.created_at) >= ? AND DATE(t.created_at) <= ?
        """, (k_name, start_date, end_date))
        wastage = cur.fetchone()[0]

        # 3. Clinical test orders completed matching this kit
        cur.execute("""
            SELECT COUNT(o.id)
            FROM test_orders o
            JOIN tests t ON o.test_id = t.id
            WHERE o.status IN ('entered', 'completed')
              AND (LOWER(t.name) = LOWER(?) OR LOWER(t.consumable_name) = LOWER(?))
              AND DATE(o.ordered_at) >= ? AND DATE(o.ordered_at) <= ?
        """, (k_name, k_name, start_date, end_date))
        tests_done = cur.fetchone()[0]

        # 4. Check for sub-parameter kit usage (e.g. Determine, Stat-Pak, Multistix)
        if tests_done == 0:
            cur.execute("""
                SELECT COUNT(tr.id)
                FROM test_results tr
                JOIN test_parameters tp ON tr.parameter_id = tp.id
                JOIN test_orders o ON tr.order_id = o.id
                WHERE o.status IN ('entered', 'completed')
                  AND (LOWER(tp.parameter_name) = LOWER(?) OR LOWER(tp.parameter_name) LIKE ?)
                  AND tr.result_value IS NOT NULL
                  AND LOWER(tr.result_value) NOT IN ('not done', 'pending', '', 'none')
                  AND DATE(o.ordered_at) >= ? AND DATE(o.ordered_at) <= ?
            """, (k_name, f"%{k_name}%", start_date, end_date))
            param_done = cur.fetchone()[0]
            if param_done > 0:
                tests_done = param_done

        variance = consumed - tests_done

        reconciliation.append({
            "kit_name": k_name,
            "category": k_cat,
            "tests_completed": tests_done,
            "kits_consumed": consumed,
            "wastage_recorded": wastage,
            "variance": variance
        })

    return reconciliation
