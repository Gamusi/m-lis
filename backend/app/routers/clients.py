import datetime, sqlite3, logging
from pydantic import BaseModel, field_validator
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from ..database import get_db
from ..auth import get_current_user, require_admin
from ..schemas import VisitCreate, TestResultCreate, AddOrdersRequest, ClientUpdate, BulkOrderDeleteRequest, BulkVisitDeleteRequest, BulkClientDeleteRequest, CrossmatchCreate, CrossmatchResponse, VisitDispatch
from ..biochem_validator import validate_biochem_parameter, validate_panel_consistency
from ..specimen_validator import validate_test_specimen_selection, get_compatible_specimens_for_test
from ..evaluator import derive_hiv_outcome
from ..transfusion_validator import evaluate_blood_group, check_biological_compatibility, evaluate_crossmatch, get_dat_interpretation, get_iat_interpretation
from .stock import deplete_kit_stock

logger = logging.getLogger("amh_clients")

router = APIRouter(tags=["Clients, Visits & Clinicians"])

class VisitEdit(BaseModel):
    ward_of_origin: Optional[str] = None
    clinician_id: Optional[int] = None
    order_category: Optional[str] = None
    age_years: Optional[float] = None
    sex: Optional[str] = None

class ClientCreate(BaseModel):
    client_number: Optional[str] = None
    full_name: str
    age_string: str
    age_category: str
    sex: str # Male / Female
    phone: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def uppercase_full_name(cls, v: str) -> str:
        return v.strip().upper() if v else v

class TestOrderCreate(BaseModel):
    client_id: Optional[int] = None
    visit_id: Optional[int] = None
    test_id: int
    sample_id: Optional[str] = None
    sample_type: Optional[str] = "Venous Blood"
    ref_doctor_ward: Optional[str] = "OPD"
    order_category: Optional[str] = "in-house"

@router.get("/api/clinicians")
def list_clinicians(conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"User '{current_user['username']}' requested clinicians list")
    cur = conn.cursor()
    cur.execute("SELECT id, name FROM clinicians WHERE is_active = 1 ORDER BY name ASC")
    clinicians = [dict(r) for r in cur.fetchall()]
    return clinicians

@router.get("/api/clients")
def list_clients(query: Optional[str] = None, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"User '{current_user['username']}' requested clients list (query='{query or ''}')")
    cur = conn.cursor()
    if query:
        q = f"%{query}%"
        cur.execute("SELECT * FROM clients WHERE full_name LIKE ? OR client_number LIKE ? OR phone LIKE ? ORDER BY id DESC LIMIT 50", (q, q, q))
    else:
        cur.execute("SELECT * FROM clients ORDER BY id DESC LIMIT 50")
    results = [dict(r) for r in cur.fetchall()]
    logger.info(f"Returned {len(results)} clients")
    return results

@router.get("/api/clients/{client_id}")
def get_client(client_id: int, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cur = conn.cursor()
    cur.execute("SELECT * FROM clients WHERE id = ?", (client_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Client not found")
    client_dict = dict(row)
    # Format age_string for convenience if not explicitly stored
    age_years = client_dict.get("age_years")
    if age_years is not None:
        if age_years < 0.08: # ~29 days
            days = round(age_years * 365.25)
            client_dict["age_display"] = f"{days}d"
        elif age_years < 1.0:
            months = round(age_years * 12)
            client_dict["age_display"] = f"{months}m"
        elif age_years < 3.0:
            yrs = int(age_years)
            rem_m = round((age_years - yrs) * 12)
            client_dict["age_display"] = f"{yrs}y {rem_m}m" if rem_m > 0 else f"{yrs}y"
        else:
            client_dict["age_display"] = f"{int(age_years)}y" if age_years.is_integer() else f"{age_years:g}y"
    else:
        client_dict["age_display"] = ""
    return client_dict

import re

def parse_age_string(s: str) -> float:
    if not s: return 0.0
    s = s.lower().strip()
    if "/365" in s:
        try: return float(s.replace("/365", "").strip()) / 365.0
        except ValueError: pass
    if "/12" in s:
        parts = s.split()
        if len(parts) == 2:
            try: return float(parts[0]) + (float(parts[1].replace("/12", "")) / 12.0)
            except ValueError: pass
        else:
            try: return float(s.replace("/12", "").strip()) / 12.0
            except ValueError: pass
    if s.endswith("d"):
        try: return float(s.replace("d", "").strip()) / 365.0
        except ValueError: pass
    if s.endswith("m"):
        try: return float(s.replace("m", "").strip()) / 12.0
        except ValueError: pass
    m = re.match(r"(\d+)y\s+(\d+)m", s)
    if m:
        return float(m.group(1)) + (float(m.group(2)) / 12.0)
    try: return float(s.replace("y", "").strip())
    except ValueError: return 0.0

def validate_client_demographics(full_name: str, sex: str, age_string: str, age_category: str) -> float:
    name = (full_name or "").strip()
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Client full name is required and must be at least 2 characters.")
    
    if sex not in ("Male", "Female"):
        raise HTTPException(status_code=400, detail="Sex must be either 'Male' or 'Female'.")
        
    valid_categories = ("Neonate", "Infant", "Toddler", "Child", "Adult")
    if age_category not in valid_categories:
        raise HTTPException(status_code=400, detail=f"Invalid age category '{age_category}'. Must be one of {valid_categories}.")

    parsed_age = parse_age_string(age_string)
    if parsed_age < 0.0:
        raise HTTPException(status_code=400, detail="Invalid age value.")

    # Consistency checks
    if age_category == 'Neonate' and parsed_age > 0.0768: # > 28 days
        raise HTTPException(status_code=400, detail=f"Age ({parsed_age*365.25:.0f} days) exceeds Neonate limit (<= 28 days).")
    elif age_category == 'Infant' and (parsed_age <= 0.0768 or parsed_age > 1.0):
        raise HTTPException(status_code=400, detail="Age does not match Infant category (29 days to 1 year).")
    elif age_category == 'Toddler' and (parsed_age <= 1.0 or parsed_age > 3.0):
        raise HTTPException(status_code=400, detail="Age does not match Toddler category (1 to 3 years).")
    elif age_category == 'Child' and (parsed_age <= 3.0 or parsed_age > 14.0):
        raise HTTPException(status_code=400, detail="Age does not match Child category (3 to 14 years).")
    elif age_category == 'Adult' and parsed_age < 15.0:
        raise HTTPException(status_code=400, detail="Age does not match Adult category (>= 15 years).")

    return parsed_age

@router.post("/api/clients")
def create_client(req: ClientCreate, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"User '{current_user['username']}' is creating client: '{req.full_name}'")
    
    parsed_age = validate_client_demographics(req.full_name, req.sex, req.age_string, req.age_category)
    cleaned_name = req.full_name.strip()
    cleaned_phone = req.phone.strip() if req.phone else None

    cur = conn.cursor()
    today = datetime.date.today()
    yy_str = today.strftime("%y")
    seq_name = f"client_number_{yy_str}"
    cur.execute("SELECT facility_acronym FROM facility_settings WHERE id = 1")
    fac_row = cur.fetchone()
    fac_acronym = fac_row["facility_acronym"] if fac_row and fac_row["facility_acronym"] else "AMH"

    prefix = f"{fac_acronym}-C{yy_str}-"

    cur.execute("INSERT OR IGNORE INTO sequence_tracker (seq_name, last_value) VALUES (?, 0)", (seq_name,))
    cur.execute("SELECT last_value FROM sequence_tracker WHERE seq_name = ?", (seq_name,))
    seq_row = cur.fetchone()
    cur_val = seq_row["last_value"] if seq_row else 0

    while True:
        cur_val += 1
        candidate = f"{prefix}{cur_val:04d}"
        cur.execute("SELECT id FROM clients WHERE client_number = ?", (candidate,))
        if not cur.fetchone():
            generated_client_number = candidate
            break

    cur.execute("UPDATE sequence_tracker SET last_value = ? WHERE seq_name = ?", (cur_val, seq_name))
    
    cur.execute("""
        INSERT INTO clients (client_number, full_name, age_years, age_category, sex, phone)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (generated_client_number, cleaned_name, parsed_age, req.age_category, req.sex, cleaned_phone))
    
    pid = cur.lastrowid
    conn.commit()
    logger.info(f"Client created successfully: ID {pid}, Client Number {generated_client_number}")
    return {"status": "created", "client_id": pid, "client_number": generated_client_number}

@router.put("/api/clients/{client_id}")
def update_client(client_id: int, req: ClientUpdate, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"User '{current_user['username']}' is updating client ID {client_id}")
    cur = conn.cursor()
    cur.execute("SELECT id, full_name, age_years, age_category, sex, phone FROM clients WHERE id = ?", (client_id,))
    client_row = cur.fetchone()
    if not client_row:
        raise HTTPException(status_code=404, detail="Client not found")

    new_name = req.full_name.strip() if req.full_name is not None else client_row["full_name"]
    new_sex = req.sex if req.sex is not None else client_row["sex"]
    new_cat = req.age_category if req.age_category is not None else client_row["age_category"]
    
    age_input = req.age_string if req.age_string is not None else req.age_raw
    if age_input is not None:
        parsed_age = parse_age_string(age_input)
    else:
        parsed_age = client_row["age_years"]

    # Validate if any demographic changed
    if any(x is not None for x in [req.full_name, req.sex, age_input, req.age_category]):
        age_str_for_val = age_input if age_input is not None else f"{parsed_age}y"
        parsed_age = validate_client_demographics(new_name, new_sex, age_str_for_val, new_cat)

    updates = []
    params = []

    if req.full_name is not None:
        updates.append("full_name = ?")
        params.append(new_name)
    if age_input is not None:
        updates.append("age_years = ?")
        params.append(parsed_age)
    if req.age_category is not None:
        updates.append("age_category = ?")
        params.append(new_cat)
    if req.sex is not None:
        updates.append("sex = ?")
        params.append(new_sex)
    if req.phone is not None:
        updates.append("phone = ?")
        params.append(req.phone.strip() if req.phone else None)

    if updates:
        params.append(client_id)
        cur.execute(f"UPDATE clients SET {', '.join(updates)} WHERE id = ?", tuple(params))
        conn.commit()

        now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        cur.execute("INSERT INTO audit_log (user_id, action, detail, timestamp) VALUES (?, 'EDIT_CLIENT', ?, ?)",
                    (current_user["id"], f"Updated client ID {client_id}: {req.model_dump(exclude_unset=True)}", now_str))
        conn.commit()

    cur.execute("SELECT * FROM clients WHERE id = ?", (client_id,))
    updated_client = cur.fetchone()
    return dict(updated_client)

@router.post("/api/visits")
def create_visit(req: VisitCreate, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    num_tests = len(req.test_orders) if req.test_orders else (len(req.test_ids) if req.test_ids else 0)
    logger.info(f"User '{current_user['username']}' is creating visit for client ID {req.client_id} with {num_tests} tests")
    cur = conn.cursor()
    
    cur.execute("SELECT id FROM clients WHERE id = ?", (req.client_id,))
    if not cur.fetchone():
        logger.warning(f"Visit creation failed: client ID {req.client_id} not found")
        raise HTTPException(status_code=404, detail="Client not found")

    if not req.ward_of_origin or not req.ward_of_origin.strip():
        logger.warning("Visit creation failed: ward_of_origin is required")
        raise HTTPException(status_code=400, detail="Ward of origin is required")
        
    if not req.clinician_id:
        logger.warning("Visit creation failed: clinician_id is required")
        raise HTTPException(status_code=400, detail="Requesting clinician is required")

    cur.execute("SELECT id FROM clinicians WHERE id = ?", (req.clinician_id,))
    if not cur.fetchone():
        logger.warning(f"Visit creation failed: clinician ID {req.clinician_id} not found")
        raise HTTPException(status_code=400, detail="Clinician not found")

    # Build list of (test_id, specimen_type_id)
    ordered_items = []
    if req.test_orders:
        for item in req.test_orders:
            ordered_items.append((item.test_id, item.specimen_type_id))
    elif req.test_specimen_map and req.test_ids:
        for tid in req.test_ids:
            s_id = req.test_specimen_map.get(str(tid)) or req.test_specimen_map.get(tid)
            if s_id:
                ordered_items.append((tid, s_id))

    if not ordered_items and req.test_ids:
        spec_ids = []
        if req.specimen_type_ids:
            spec_ids = [s for s in req.specimen_type_ids if s]
        elif req.specimen_type_id:
            spec_ids = [req.specimen_type_id]

        if not spec_ids:
            logger.warning("Visit creation failed: at least one specimen is required")
            raise HTTPException(status_code=400, detail="Specimen is required")

        s_placeholders = ",".join("?" for _ in spec_ids)
        cur.execute(f"SELECT id, name FROM specimen_types WHERE id IN ({s_placeholders})", spec_ids)
        spec_rows = cur.fetchall()
        if not spec_rows:
            raise HTTPException(status_code=400, detail="Specimen type not found")

        spec_id_map = {r["name"]: r["id"] for r in spec_rows}
        spec_name_list = [r["name"] for r in spec_rows]

        t_placeholders = ",".join("?" for _ in req.test_ids)
        cur.execute(f"""
            SELECT t.id, t.name, s.name as section 
            FROM tests t
            LEFT JOIN sections s ON t.section_id = s.id
            WHERE t.id IN ({t_placeholders})
        """, req.test_ids)
        test_rows = [dict(r) for r in cur.fetchall()]

        if len(test_rows) != len(set(req.test_ids)):
            raise HTTPException(status_code=404, detail="One or more ordered test IDs not found")

        from ..specimen_validator import validate_test_specimen_selection
        is_valid, errors, test_to_spec = validate_test_specimen_selection(test_rows, spec_name_list)
        if not is_valid:
            raise HTTPException(status_code=400, detail="Specimen Error: " + " | ".join(errors))

        for t_row in test_rows:
            tid = t_row["id"]
            matched_name = test_to_spec.get(t_row["name"])
            matched_id = spec_id_map.get(matched_name, spec_ids[0])
            ordered_items.append((tid, matched_id))

    if not ordered_items:
        raise HTTPException(status_code=400, detail="At least one test must be ordered.")

    # Validate that every ordered test has a specimen_type_id
    for tid, s_id in ordered_items:
        if not s_id:
            raise HTTPException(status_code=400, detail=f"Specimen is strictly required for test ID {tid}.")

    all_spec_ids = list({s_id for _, s_id in ordered_items if s_id})
    s_placeholders = ",".join("?" for _ in all_spec_ids)
    cur.execute(f"SELECT id, name FROM specimen_types WHERE id IN ({s_placeholders})", all_spec_ids)
    spec_rows = cur.fetchall()
    spec_db_map = {r["id"]: r["name"] for r in spec_rows}
    
    for _, s_id in ordered_items:
        if s_id not in spec_db_map:
            raise HTTPException(status_code=400, detail=f"Specimen ID {s_id} not found in database.")

    all_test_ids = list({tid for tid, _ in ordered_items})
    t_placeholders = ",".join("?" for _ in all_test_ids)
    cur.execute(f"""
        SELECT t.id, t.name, s.name as section 
        FROM tests t
        LEFT JOIN sections s ON t.section_id = s.id
        WHERE t.id IN ({t_placeholders})
    """, all_test_ids)
    test_db_map = {r["id"]: dict(r) for r in cur.fetchall()}

    if len(test_db_map) != len(all_test_ids):
        raise HTTPException(status_code=404, detail="One or more ordered test IDs not found.")

    FEMALE_ONLY_TEST_KEYWORDS = ["hcg urine", "hcg blood", "pregnancy"]
    cur.execute("SELECT sex FROM clients WHERE id = ?", (req.client_id,))
    client_row = cur.fetchone()
    client_sex = (client_row["sex"] if client_row and client_row["sex"] else "").strip().lower()

    # Enforce strict test-to-specimen compatibility for every ordered test
    from ..specimen_validator import _is_compatible_specimen, get_compatible_specimens_for_test
    specimen_errors = []
    for tid, s_id in ordered_items:
        t_info = test_db_map[tid]
        t_name = t_info["name"]
        t_name_low = t_name.lower()
        if client_sex == "male" and any(k in t_name_low for k in FEMALE_ONLY_TEST_KEYWORDS):
            raise HTTPException(status_code=400, detail=f"Cannot order female-specific test '{t_name}' for male client.")

        s_name = spec_db_map[s_id]
        compat = get_compatible_specimens_for_test(t_name, t_info.get("section"))
        is_matched = any(_is_compatible_specimen(c, s_name) for c in compat)
        if not is_matched:
            specimen_errors.append(f"Test '{t_name}' requires [{', '.join(compat)}], but '{s_name}' was selected.")

    if specimen_errors:
        raise HTTPException(status_code=400, detail="Specimen Error: " + " | ".join(specimen_errors))

    primary_specimen_id = ordered_items[0][1]
    cur.execute("""
        INSERT INTO visits (client_id, clinician_id, ward_of_origin, specimen_type_id)
        VALUES (?, ?, ?, ?)
    """, (req.client_id, req.clinician_id, req.ward_of_origin.strip(), primary_specimen_id))
    visit_id = cur.lastrowid
    
    for tid, s_id in ordered_items:
        cur.execute("""
            INSERT INTO test_orders (visit_id, test_id, sample_id, specimen_type_id, ordered_by_user_id, status, order_category)
            VALUES (?, ?, ?, ?, ?, 'pending', ?)
        """, (visit_id, tid, req.sample_id, s_id, current_user["id"], req.order_category))
        
    conn.commit()
    logger.info(f"Visit created successfully: visit_id={visit_id}")
    return {"status": "created", "visit_id": visit_id}

@router.put("/api/visits/{visit_id}")
def update_visit(visit_id: int, req: VisitEdit, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"User '{current_user['username']}' is updating visit ID {visit_id}")
    cur = conn.cursor()
    
    cur.execute("SELECT client_id FROM visits WHERE id = ?", (visit_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Visit not found")
        
    if req.clinician_id is not None:
        cur.execute("SELECT id FROM clinicians WHERE id = ?", (req.clinician_id,))
        if not cur.fetchone():
            raise HTTPException(status_code=400, detail="Clinician not found")
            
    # Update visit
    cur.execute("UPDATE visits SET ward_of_origin = ?, clinician_id = ? WHERE id = ?",
                (req.ward_of_origin, req.clinician_id, visit_id))
    
    # Update order_category on all orders for this visit if provided
    if req.order_category:
        cur.execute("UPDATE test_orders SET order_category = ? WHERE visit_id = ?",
                    (req.order_category, visit_id))
    
    conn.commit()
    return {"status": "updated", "visit_id": visit_id}

@router.post("/api/visits/{visit_id}/orders")
def add_orders_to_visit(visit_id: int, req: AddOrdersRequest, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"User '{current_user['username']}' is adding {len(req.test_ids)} orders to visit ID {visit_id}")
    cur = conn.cursor()
    
    cur.execute("SELECT id FROM visits WHERE id = ?", (visit_id,))
    if not cur.fetchone():
        logger.warning(f"Add orders failed: visit ID {visit_id} not found")
        raise HTTPException(status_code=404, detail="Visit not found")
        
    if not req.test_ids:
        raise HTTPException(status_code=400, detail="At least one test ID must be provided")
        
    cur.execute("""
        SELECT c.sex 
        FROM visits v
        JOIN clients c ON v.client_id = c.id
        WHERE v.id = ?
    """, (visit_id,))
    v_client = cur.fetchone()
    client_sex = (v_client["sex"] if v_client and v_client["sex"] else "").strip().lower()
    FEMALE_ONLY_TEST_KEYWORDS = ["hcg urine", "hcg blood", "pregnancy"]

    for tid in req.test_ids:
        cur.execute("SELECT id, name FROM tests WHERE id = ?", (tid,))
        t_row = cur.fetchone()
        if not t_row:
            logger.warning(f"Add orders failed: test ID {tid} not found")
            raise HTTPException(status_code=404, detail=f"Test ID {tid} not found")
        t_name_low = t_row["name"].lower()
        if client_sex == "male" and any(k in t_name_low for k in FEMALE_ONLY_TEST_KEYWORDS):
            raise HTTPException(status_code=400, detail=f"Cannot order female-specific test '{t_row['name']}' for male client.")
            
        # Enforce Single Order Logic
        cur.execute("""
            SELECT o.id, tr.result_value 
            FROM test_orders o
            LEFT JOIN test_results tr ON o.id = tr.order_id
            WHERE o.visit_id = ? AND o.test_id = ?
        """, (visit_id, tid))
        previous_orders = cur.fetchall()
        if previous_orders:
            can_order = True
            for r in previous_orders:
                if r["result_value"] != "Invalid":
                    can_order = False
                    break
            if not can_order:
                raise HTTPException(status_code=400, detail=f"Test ID {tid} already ordered for this visit and is not Invalid.")
            
    added_order_ids = []
    order_cat = req.order_category if hasattr(req, 'order_category') and req.order_category else 'in-house'
    
    cur.execute("SELECT specimen_type_id FROM visits WHERE id = ?", (visit_id,))
    v_spec = cur.fetchone()
    v_spec_id = v_spec["specimen_type_id"] if v_spec else None

    for tid in req.test_ids:
        cur.execute("SELECT t.id, t.name, s.name as section FROM tests t LEFT JOIN sections s ON t.section_id = s.id WHERE t.id = ?", (tid,))
        t_row = cur.fetchone()
        spec_id_to_use = v_spec_id
        if t_row:
            compat = get_compatible_specimens_for_test(t_row["name"], t_row["section"])
            if compat:
                c_placeholders = ",".join("?" for _ in compat)
                cur.execute(f"SELECT id FROM specimen_types WHERE name IN ({c_placeholders}) LIMIT 1", compat)
                c_row = cur.fetchone()
                if c_row:
                    spec_id_to_use = c_row["id"]
        cur.execute("""
            INSERT INTO test_orders (visit_id, test_id, sample_id, specimen_type_id, ordered_by_user_id, status, order_category)
            VALUES (?, ?, ?, ?, ?, 'pending', ?)
        """, (visit_id, tid, req.sample_id, spec_id_to_use, current_user["id"], order_cat))
        added_order_ids.append(cur.lastrowid)
        
    conn.commit()
    logger.info(f"Successfully added orders {added_order_ids} to visit {visit_id}")
    return {"status": "orders_added", "visit_id": visit_id, "order_ids": added_order_ids}

@router.delete("/api/orders/bulk")
def bulk_delete_orders(req: BulkOrderDeleteRequest, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"User '{current_user['username']}' is bulk deleting orders: {req.order_ids}")
    cur = conn.cursor()
    deleted_ids = []
    skipped_ids = []
    
    for order_id in req.order_ids:
        cur.execute("SELECT status FROM test_orders WHERE id = ?", (order_id,))
        row = cur.fetchone()
        if row and row["status"] == "pending":
            cur.execute("DELETE FROM test_orders WHERE id = ?", (order_id,))
            deleted_ids.append(order_id)
        else:
            skipped_ids.append(order_id)
            
    if deleted_ids:
        now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        cur.execute("INSERT INTO audit_log (user_id, action, detail, timestamp) VALUES (?, 'DELETE_ORDERS_BULK', ?, ?)",
                    (current_user["id"], f"Bulk deleted pending test orders: {deleted_ids}", now_str))
        
    conn.commit()
    logger.info(f"Bulk deleted orders result - deleted: {deleted_ids}, skipped: {skipped_ids}")
    return {"status": "deleted", "deleted_order_ids": deleted_ids, "skipped_order_ids": skipped_ids}

@router.delete("/api/orders/{order_id}")
def delete_order(order_id: int, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"User '{current_user['username']}' is deleting order ID {order_id}")
    cur = conn.cursor()
    cur.execute("SELECT status FROM test_orders WHERE id = ?", (order_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Order not found")
    if row["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending orders can be removed")
    
    cur.execute("DELETE FROM test_orders WHERE id = ?", (order_id,))
    conn.commit()
    logger.info(f"Successfully deleted order {order_id}")
    return {"status": "deleted", "order_id": order_id}

@router.get("/api/orders/{order_id}/results")
@router.get("/api/clients/orders/{order_id}/results")
def get_order_results(order_id: int, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cur = conn.cursor()
    cur.execute("""
        SELECT r.id, r.parameter_id, tp.parameter_name, r.result_value, r.result_unit, r.clinical_flag, r.is_positive, r.edit_reason
        FROM test_results r
        LEFT JOIN test_parameters tp ON r.parameter_id = tp.id
        WHERE r.order_id = ?
        ORDER BY tp.sort_order, r.id
    """, (order_id,))
    rows = [dict(r) for r in cur.fetchall()]
    return rows

@router.post("/api/clients/orders")
@router.post("/api/orders")
def create_order(req: TestOrderCreate, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"User '{current_user['username']}' is creating test order: client_id={req.client_id}, visit_id={req.visit_id}, test_id={req.test_id}")
    cur = conn.cursor()
    
    cur.execute("SELECT id, name FROM tests WHERE id = ?", (req.test_id,))
    t_row = cur.fetchone()
    if not t_row:
        logger.warning(f"Order creation failed: test ID {req.test_id} not found")
        raise HTTPException(status_code=404, detail="Test not found")

    visit_id = req.visit_id
    FEMALE_ONLY_TEST_KEYWORDS = ["hcg urine", "hcg blood", "pregnancy"]
    if not visit_id:
        if not req.client_id:
            raise HTTPException(status_code=400, detail="Either visit_id or client_id must be provided")
        cur.execute("SELECT id, sex FROM clients WHERE id = ?", (req.client_id,))
        c_row = cur.fetchone()
        if not c_row:
            logger.warning(f"Order creation failed: client ID {req.client_id} not found")
            raise HTTPException(status_code=404, detail="Client not found")
        client_sex = (c_row["sex"] if c_row and c_row["sex"] else "").strip().lower()
        if client_sex == "male" and any(k in t_row["name"].lower() for k in FEMALE_ONLY_TEST_KEYWORDS):
            raise HTTPException(status_code=400, detail=f"Cannot order female-specific test '{t_row['name']}' for male client.")
        cur.execute("""
            INSERT INTO visits (client_id, ward_of_origin)
            VALUES (?, ?)
        """, (req.client_id, req.ref_doctor_ward))
        visit_id = cur.lastrowid
    else:
        cur.execute("SELECT c.sex FROM visits v JOIN clients c ON v.client_id = c.id WHERE v.id = ?", (visit_id,))
        v_client = cur.fetchone()
        client_sex = (v_client["sex"] if v_client and v_client["sex"] else "").strip().lower()
        if client_sex == "male" and any(k in t_row["name"].lower() for k in FEMALE_ONLY_TEST_KEYWORDS):
            raise HTTPException(status_code=400, detail=f"Cannot order female-specific test '{t_row['name']}' for male client.")

        # Enforce Single Order Logic
        cur.execute("""
            SELECT o.id, tr.result_value 
            FROM test_orders o
            LEFT JOIN test_results tr ON o.id = tr.order_id
            WHERE o.visit_id = ? AND o.test_id = ?
        """, (visit_id, req.test_id))
        previous_orders = cur.fetchall()
        if previous_orders:
            can_order = True
            for r in previous_orders:
                if r["result_value"] != "Invalid":
                    can_order = False
                    break
            if not can_order:
                raise HTTPException(status_code=400, detail=f"Test ID {req.test_id} already ordered for this visit and is not Invalid.")

    order_cat = req.order_category if hasattr(req, 'order_category') and req.order_category else 'in-house'
    cur.execute("""
        INSERT INTO test_orders (visit_id, test_id, sample_id, ordered_by_user_id, status, order_category)
        VALUES (?, ?, ?, ?, 'pending', ?)
    """, (visit_id, req.test_id, req.sample_id, current_user["id"], order_cat))
    
    oid = cur.lastrowid
    conn.commit()
    logger.info(f"Order created successfully: order_id={oid}")
    return {"status": "ordered", "order_id": oid, "visit_id": visit_id}

def increment_daily_entry(cur: sqlite3.Cursor, entry_date: str, test_id: int, is_positive: bool, user_id: int, order_category: str = "in-house"):
    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    cur.execute("SELECT id, is_tracked, parent_rollup_id FROM tests WHERE id = ?", (test_id,))
    t_obj = cur.fetchone()
    if not t_obj:
        return

    is_tr = bool(t_obj["is_tracked"])
    parent_id = t_obj["parent_rollup_id"]

    cat_lower = (order_category or "in-house").lower()
    in_house_inc = 1 if ("in-house" in cat_lower or "inhouse" in cat_lower or ("ref" not in cat_lower and "outreach" not in cat_lower and "self" not in cat_lower)) else 0
    ref_inc = 1 if "ref" in cat_lower else 0
    outreach_inc = 1 if "outreach" in cat_lower else 0
    self_inc = 1 if "self" in cat_lower else 0

    cur.execute("SELECT done, positive, in_house, referral, outreach, self_request FROM daily_entries WHERE entry_date = ? AND test_id = ?", (entry_date, test_id))
    existing = cur.fetchone()

    if existing:
        new_done = existing["done"] + 1
        new_pos = existing["positive"]
        if is_tr:
            curr_pos = new_pos if new_pos is not None else 0
            new_pos = curr_pos + (1 if is_positive else 0)

        new_inhouse = (existing["in_house"] or 0) + in_house_inc
        new_ref = (existing["referral"] or 0) + ref_inc
        new_outreach = (existing["outreach"] or 0) + outreach_inc
        new_self = (existing["self_request"] or 0) + self_inc

        cur.execute("""
            UPDATE daily_entries
            SET done = ?, positive = ?, in_house = ?, referral = ?, outreach = ?, self_request = ?, updated_by_user_id = ?, updated_at = ?
            WHERE entry_date = ? AND test_id = ?
        """, (new_done, new_pos, new_inhouse, new_ref, new_outreach, new_self, user_id, now_str, entry_date, test_id))
    else:
        new_pos = (1 if is_positive else 0) if is_tr else None
        cur.execute("""
            INSERT INTO daily_entries (entry_date, test_id, done, positive, in_house, referral, outreach, self_request, entered_by_user_id, entered_at)
            VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?)
        """, (entry_date, test_id, new_pos, in_house_inc, ref_inc, outreach_inc, self_inc, user_id, now_str))

    # HIV Rapid Testing Algorithm Rollup (e.g. Determine -> HTS master count)
    if parent_id:
        increment_daily_entry(cur, entry_date, parent_id, is_positive, user_id, order_category)

@router.post("/api/results")
@router.post("/api/clients/results")
def enter_result(req: TestResultCreate, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"User '{current_user['username']}' is entering result for order ID {req.order_id}")
    try:
        cur = conn.cursor()
        cur.execute("""
            SELECT 
                o.id as order_id, o.visit_id, o.test_id, o.status, o.order_category, o.specimen_type_id,
                t.name as test_name, t.is_tracked,
                c.date_of_birth, c.age_years, c.sex
            FROM test_orders o
            JOIN tests t ON o.test_id = t.id
            LEFT JOIN visits v ON o.visit_id = v.id
            LEFT JOIN clients c ON v.client_id = c.id
            WHERE o.id = ?
        """, (req.order_id,))
        order = cur.fetchone()
        if not order:
            logger.warning(f"Result entry failed: order ID {req.order_id} not found")
            raise HTTPException(status_code=404, detail="Order not found")

        if not order["specimen_type_id"]:
            # Auto-resolve from visit if available
            cur.execute("SELECT specimen_type_id FROM visits WHERE id = ?", (order["visit_id"],))
            v_spec = cur.fetchone()
            if v_spec and v_spec["specimen_type_id"]:
                cur.execute("UPDATE test_orders SET specimen_type_id = ? WHERE id = ?", (v_spec["specimen_type_id"], req.order_id))
            else:
                cur.execute("SELECT id FROM specimen_types WHERE is_active = 1 ORDER BY sort_order ASC, id ASC LIMIT 1")
                d_spec = cur.fetchone()
                if d_spec:
                    cur.execute("UPDATE test_orders SET specimen_type_id = ? WHERE id = ?", (d_spec["id"], req.order_id))

        is_admin = current_user.get("role") in ["admin", "superadmin"]
        if order["status"] == "completed" and not is_admin:
            raise HTTPException(status_code=403, detail="Only administrators can modify completed/verified test results.")

        now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
        today = datetime.date.today()
        today_str = today.strftime("%Y-%m-%d")

        dob_str = order["date_of_birth"]
        dob = None
        if dob_str:
            try:
                dob = datetime.datetime.strptime(dob_str[:10], "%Y-%m-%d").date()
            except ValueError:
                dob = None
        sex = order["sex"] or ""
        test_name = order["test_name"] or ""
        if dob:
            age = (today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day)))
        elif order["age_years"] is not None:
            age = int(order["age_years"])
        else:
            age = None

        overall_positive = False

        # Insert main result or parameter results with verified_at and verified_by_user_id
        verified_by = current_user["id"] if is_admin else None
        verified_time = now_str if is_admin else None
        order_status = "completed" if is_admin else "entered"

        if req.parameter_results:
            param_map = {}
            param_info_list = []
            for pr in req.parameter_results:
                cur.execute("SELECT parameter_name, unit, secondary_unit FROM test_parameters WHERE id = ?", (pr.parameter_id,))
                p_row = cur.fetchone()
                param_name = ""
                param_default_unit = None
                if p_row:
                    param_name = p_row["parameter_name"]
                    param_default_unit = p_row["unit"]
                else:
                    # Fallback: parameter_id may refer to a child test in the tests table
                    cur.execute("SELECT name, default_unit, secondary_unit FROM tests WHERE id = ?", (pr.parameter_id,))
                    t_row = cur.fetchone()
                    if t_row:
                        param_name = t_row["name"]
                        param_default_unit = t_row["default_unit"]

                effective_unit = pr.result_unit or req.result_unit or param_default_unit
                param_map[param_name] = (pr.result_value, effective_unit)
                param_info_list.append((pr, param_name, effective_unit))

            # Cross-analyte panel consistency check
            try:
                validate_panel_consistency(param_map)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            # Parameter validation, sanity checks, and scoring
            for pr, param_name, effective_unit in param_info_list:
                try:
                    eval_dict = validate_biochem_parameter(cur, param_name, pr.result_value, age=age, sex=sex, unit=effective_unit)
                except ValueError as e:
                    raise HTTPException(status_code=400, detail=str(e))

                clinical_flag = eval_dict.get("flag")
                pr_is_positive = eval_dict.get("is_abnormal", False)
                saved_unit = effective_unit or eval_dict.get("unit")

                if pr.result_value:
                    pr_val_lower = str(pr.result_value).strip().lower()
                    if pr_val_lower in ["positive", "abnormal", "reactive"] or pr_val_lower.startswith("positive") or pr_val_lower.startswith("reactive"):
                        pr_is_positive = True
                        if not clinical_flag:
                            clinical_flag = "\u26A0"

                if pr_is_positive:
                    overall_positive = True

                cur.execute("SELECT id, result_value FROM test_results WHERE order_id = ? AND parameter_id = ?", (req.order_id, pr.parameter_id))
                res_row = cur.fetchone()
                if res_row:
                    if res_row["result_value"] is not None:
                        if not req.edit_reason or not req.edit_reason.strip():
                            raise HTTPException(status_code=400, detail="Reason for editing result is required")
                        cur.execute("""
                            INSERT INTO audit_log (user_id, action, detail, timestamp)
                            VALUES (?, 'EDIT_RESULT', ?, ?)
                        """, (current_user["id"], f"order_id={req.order_id} param_id={pr.parameter_id} old_value={res_row['result_value']!r} new_value={pr.result_value!r} reason={req.edit_reason!r}", now_str))

                    cur.execute("""
                        UPDATE test_results
                        SET result_value = ?, is_positive = ?, result_unit = ?, clinical_flag = ?, edit_reason = ?, edited_by_user_id = ?, edited_at = ?, verified_by_user_id = ?, verified_at = ?
                        WHERE id = ?
                    """, (pr.result_value, pr_is_positive, saved_unit, clinical_flag, req.edit_reason, current_user["id"], now_str, verified_by, verified_time, res_row["id"]))
                else:
                    cur.execute("""
                        INSERT INTO test_results (order_id, parameter_id, result_value, result_unit, clinical_flag, is_positive, entered_by_user_id, entered_at, verified_by_user_id, verified_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (req.order_id, pr.parameter_id, pr.result_value, saved_unit, clinical_flag, pr_is_positive, current_user["id"], now_str, verified_by, verified_time))

            # Conclusive outcome derivation for HIV algorithm panels
            if "hiv" in test_name.lower():
                hiv_kit_data = [{"name": p_name, "result": pr.result_value} for pr, p_name, _ in param_info_list if pr.result_value]
                if hiv_kit_data:
                    hiv_outcome = derive_hiv_outcome(hiv_kit_data)
                    overall_positive = (hiv_outcome.get("conclusive_status") == "Positive")

            # Immunohematology evaluations
            if "blood group" in test_name.lower():
                param_dict = {p_name: pr.result_value for pr, p_name, _ in param_info_list if pr.result_value}
                anti_a = param_dict.get("Forward Anti-A")
                anti_b = param_dict.get("Forward Anti-B")
                anti_d = param_dict.get("Forward Anti-D")
                a1_cells = param_dict.get("Reverse A1-cells")
                b_cells = param_dict.get("Reverse B-cells")

                def _is_omitted_param(v):
                    if not v:
                        return True
                    s = str(v).strip().lower()
                    return s in ["not done", "not done (omitted)", "not done (optional)", "omitted", "none", "-", "n/a", "na", ""]

                if _is_omitted_param(a1_cells) and _is_omitted_param(b_cells):
                    # Clean up any previously stored reverse typing if omitted in this submission
                    cur.execute("""
                        DELETE FROM test_results
                        WHERE order_id = ? AND parameter_id IN (
                            SELECT id FROM test_parameters
                            WHERE test_id = ? AND parameter_name IN ('Reverse A1-cells', 'Reverse B-cells')
                        )
                    """, (req.order_id, order["test_id"]))
                    a1_cells = None
                    b_cells = None

                if anti_a and anti_b and anti_d:
                    bg_eval = evaluate_blood_group(anti_a, anti_b, anti_d, a1_cells, b_cells)
                    cur.execute("SELECT id FROM test_parameters WHERE test_id = ? AND parameter_name = 'Consolidated Blood Group'", (order["test_id"],))
                    cbg_p = cur.fetchone()
                    if cbg_p:
                        c_flag = "\u26A0" if not bg_eval["is_concordant"] else ""
                        cur.execute("SELECT id FROM test_results WHERE order_id = ? AND parameter_id = ?", (req.order_id, cbg_p["id"]))
                        ex_cbg = cur.fetchone()
                        if ex_cbg:
                            cur.execute("""
                                UPDATE test_results
                                SET result_value = ?, clinical_flag = ?, is_positive = ?, verified_by_user_id = ?, verified_at = ?
                                WHERE id = ?
                            """, (bg_eval["consolidated_group"], c_flag, not bg_eval["is_concordant"], verified_by, verified_time, ex_cbg["id"]))
                        else:
                            cur.execute("""
                                INSERT INTO test_results (order_id, parameter_id, result_value, clinical_flag, is_positive, entered_by_user_id, entered_at, verified_by_user_id, verified_at)
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """, (req.order_id, cbg_p["id"], bg_eval["consolidated_group"], c_flag, not bg_eval["is_concordant"], current_user["id"], now_str, verified_by, verified_time))

                    # Also update parent order summary result
                    cur.execute("SELECT id FROM test_results WHERE order_id = ? AND parameter_id IS NULL", (req.order_id,))
                    p_res = cur.fetchone()
                    c_flag = "\u26A0" if not bg_eval["is_concordant"] else ""
                    if p_res:
                        cur.execute("""
                            UPDATE test_results
                            SET result_value = ?, clinical_flag = ?, is_positive = ?
                            WHERE id = ?
                        """, (bg_eval["consolidated_group"], c_flag, not bg_eval["is_concordant"], p_res["id"]))
                    else:
                        cur.execute("""
                            INSERT INTO test_results (order_id, parameter_id, result_value, clinical_flag, is_positive, entered_by_user_id, entered_at)
                            VALUES (?, NULL, ?, ?, ?, ?, ?)
                        """, (req.order_id, bg_eval["consolidated_group"], c_flag, not bg_eval["is_concordant"], current_user["id"], now_str))

                    if not bg_eval["is_concordant"]:
                        overall_positive = True

            elif "direct coombs" in test_name.lower():
                param_dict = {p_name: pr.result_value for pr, p_name, _ in param_info_list if pr.result_value}
                status_val = param_dict.get("DAT Qualitative Status") or req.result_value
                dat_eval = get_dat_interpretation(status_val, param_dict.get("Reaction Strength"), param_dict.get("Reagent Specificity"))
                if dat_eval["clinical_flag"]:
                    overall_positive = True

            elif "indirect coombs" in test_name.lower():
                param_dict = {p_name: pr.result_value for pr, p_name, _ in param_info_list if pr.result_value}
                status_val = param_dict.get("IAT Qualitative Status") or req.result_value
                iat_eval = get_iat_interpretation(status_val)
                if iat_eval["clinical_flag"]:
                    overall_positive = True
        else:
            # Block invalid RDT runs from release as verified client results
            if ("cd4" in test_name.lower() or "visitect" in test_name.lower()) and req.result_value:
                if str(req.result_value).strip().lower() == "invalid":
                    raise HTTPException(
                        status_code=400,
                        detail="Invalid RDT cassette run cannot be released as a final client result. Discard cassette, log wastage in inventory, and repeat test with a new cassette."
                    )

            try:
                eval_dict = validate_biochem_parameter(cur, test_name, req.result_value, age=age, sex=sex, unit=req.result_unit)
            except ValueError as e:
                raise HTTPException(status_code=400, detail=str(e))

            clinical_flag = eval_dict.get("flag")
            is_positive = eval_dict.get("is_abnormal", False)
            saved_unit = req.result_unit or eval_dict.get("unit")

            if req.result_value:
                val_lower = str(req.result_value).strip().lower()
                if "below 200" in val_lower and ("cd4" in test_name.lower() or "visitect" in test_name.lower()):
                    is_positive = True
                    clinical_flag = "L*"
                elif val_lower in ["positive", "abnormal", "reactive"] or val_lower.startswith("positive") or val_lower.startswith("reactive"):
                    is_positive = True
                    if not clinical_flag:
                        clinical_flag = "\u26A0"

            # Check CD4 cytometry quantitative AHD gate (< 200 cells/µL)
            if "cd4" in test_name.lower() and "rapid" not in test_name.lower() and "strip" not in test_name.lower() and "rdt" not in test_name.lower():
                try:
                    num_val = float(str(req.result_value).strip().split()[0])
                    if num_val < 200.0:
                        clinical_flag = "L*"
                        is_positive = True
                except (ValueError, TypeError):
                    pass

            overall_positive = is_positive

            cur.execute("SELECT id, result_value, result_unit FROM test_results WHERE order_id = ? AND parameter_id IS NULL", (req.order_id,))
            res_row = cur.fetchone()
            if res_row:
                if res_row["result_value"] is not None:
                    if not req.edit_reason or not req.edit_reason.strip():
                        raise HTTPException(status_code=400, detail="Reason for editing result is required")
                    cur.execute("""
                        INSERT INTO audit_log (user_id, action, detail, timestamp)
                        VALUES (?, 'EDIT_RESULT', ?, ?)
                    """, (current_user["id"], f"order_id={req.order_id} old_value={res_row['result_value']!r} new_value={req.result_value!r} old_unit={res_row['result_unit']!r} new_unit={saved_unit!r} reason={req.edit_reason!r}", now_str))

                cur.execute("""
                    UPDATE test_results
                    SET result_value = ?, is_positive = ?, result_unit = ?, clinical_flag = ?, edit_reason = ?, edited_by_user_id = ?, edited_at = ?, verified_by_user_id = ?, verified_at = ?
                    WHERE id = ?
                """, (req.result_value, is_positive, saved_unit, clinical_flag, req.edit_reason, current_user["id"], now_str, verified_by, verified_time, res_row["id"]))
            else:
                cur.execute("""
                    INSERT INTO test_results (order_id, parameter_id, result_value, result_unit, clinical_flag, is_positive, entered_by_user_id, entered_at, verified_by_user_id, verified_at)
                    VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (req.order_id, req.result_value, saved_unit, clinical_flag, is_positive, current_user["id"], now_str, verified_by, verified_time))

        cur.execute("UPDATE test_orders SET status = ? WHERE id = ?", (order_status, req.order_id))

        # Generalized Stock / Diagnostic Kit FEFO Auto-Depletion Engine
        cur.execute("SELECT name, tracks_stock, consumable_name FROM tests WHERE id = ?", (order["test_id"],))
        t_info = cur.fetchone()
        t_name = t_info["name"] if t_info else ""
        t_tracks = t_info["tracks_stock"] if t_info else 0
        t_consumable = t_info["consumable_name"] if t_info else None

        if "hiv" in t_name.lower() and req.parameter_results:
            for pr in req.parameter_results:
                if pr.result_value and str(pr.result_value).strip() and str(pr.result_value).strip().lower() != "not done":
                    cur.execute("SELECT parameter_name FROM test_parameters WHERE id = ?", (pr.parameter_id,))
                    p_info = cur.fetchone()
                    if p_info and p_info["parameter_name"]:
                        k_name = p_info["parameter_name"]
                        # Check if this specific kit was already depleted for this order
                        cur.execute("""
                            SELECT id FROM diagnostic_kit_transactions
                            WHERE order_id = ? AND transaction_type = 'TEST_USAGE'
                            AND reason LIKE ?
                        """, (req.order_id, f"%{k_name}%"))
                        if not cur.fetchone():
                            try:
                                deplete_kit_stock(conn, kit_name=k_name, order_id=req.order_id, user_id=current_user["id"], count=1)
                            except Exception as e:
                                logger.warning(f"HIV Stock depletion skipped/failed for {k_name}: {e}")
        elif "urinalysis" in t_name.lower():
            cur.execute("SELECT id FROM diagnostic_kit_transactions WHERE order_id = ? AND transaction_type = 'TEST_USAGE'", (req.order_id,))
            if not cur.fetchone():
                try:
                    deplete_kit_stock(conn, kit_name="Siemens Multistix 10SG Reagent Strips", order_id=req.order_id, user_id=current_user["id"], count=1)
                except Exception as e:
                    logger.warning(f"Urinalysis strip depletion skipped/failed: {e}")
        elif t_tracks or t_consumable:
            cur.execute("SELECT id FROM diagnostic_kit_transactions WHERE order_id = ? AND transaction_type = 'TEST_USAGE'", (req.order_id,))
            if not cur.fetchone():
                target_kit = t_consumable or t_name
                try:
                    deplete_kit_stock(conn, test_id=order["test_id"], kit_name=target_kit, order_id=req.order_id, user_id=current_user["id"], count=1)
                except Exception as e:
                    logger.warning(f"Stock depletion skipped/failed for {target_kit}: {e}")

        # Auto-increment DailyEntry counts on initial submission only (prevents edit double-counting)
        if order["status"] == "pending":
            increment_daily_entry(cur, today_str, order["test_id"], overall_positive, current_user["id"], order["order_category"] or "in-house")

        # Sequential Lab Number Assignment on the parent visit
        assigned_lab_number = None
        visit_id = order["visit_id"]
        if visit_id:
            cur.execute("SELECT id, lab_number FROM visits WHERE id = ?", (visit_id,))
            v_row = cur.fetchone()
            if v_row:
                if not v_row["lab_number"]:
                    today = datetime.date.today()
                    yy_str = today.strftime("%y")
                    m_str = str(today.month)  # Non-zero-padded month (e.g. 8 not 08)
                    ym_key = f"{yy_str}_{m_str}"
                    seq_name = f"lab_number_{ym_key}"

                    cur.execute("SELECT facility_acronym FROM facility_settings WHERE id = 1")
                    fac_row = cur.fetchone()
                    fac_acronym = fac_row["facility_acronym"] if fac_row and fac_row["facility_acronym"] else "AMH"

                    prefix = f"{fac_acronym}-{yy_str}-{m_str}-"

                    cur.execute("INSERT OR IGNORE INTO sequence_tracker (seq_name, last_value) VALUES (?, 0)", (seq_name,))
                    cur.execute("SELECT last_value FROM sequence_tracker WHERE seq_name = ?", (seq_name,))
                    seq_row = cur.fetchone()
                    cur_val = seq_row["last_value"] if seq_row else 0

                    while True:
                        cur_val += 1
                        candidate = f"{prefix}{cur_val:03d}"
                        cur.execute("SELECT id FROM visits WHERE lab_number = ?", (candidate,))
                        if not cur.fetchone():
                            assigned_lab_number = candidate
                            break

                    cur.execute("UPDATE sequence_tracker SET last_value = ? WHERE seq_name = ?", (cur_val, seq_name))
                    cur.execute("UPDATE visits SET lab_number = ? WHERE id = ?", (assigned_lab_number, visit_id))
                else:
                    assigned_lab_number = v_row["lab_number"]

        conn.commit()
        logger.info(f"Result saved successfully for order ID {req.order_id}, lab_number={assigned_lab_number}")
        return {"status": "result_saved", "order_id": req.order_id, "auto_incremented_daily_log": True, "lab_number": assigned_lab_number}
    except Exception as e:
        conn.rollback()
        if isinstance(e, HTTPException):
            raise e
        logger.error(f"Error entering result for order {req.order_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Database error saving result: {str(e)}")



@router.put("/api/results/{result_id}")
def edit_result(result_id: int, req: dict, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Edit an existing test result. Admin/superadmin only. Requires a reason."""
    if current_user["role"] not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Only admins can edit saved results")
    
    edit_reason = req.get("edit_reason", "").strip()
    if not edit_reason:
        raise HTTPException(status_code=400, detail="An edit reason is required")
    
    cur = conn.cursor()
    cur.execute("SELECT id, result_value, order_id, parameter_id FROM test_results WHERE id = ?", (result_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Result not found")
    
    old_value = row["result_value"]
    new_value = req.get("result_value", old_value)
    new_unit = req.get("result_unit")
    
    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    
    cur.execute("""
        UPDATE test_results
        SET result_value = ?, edit_reason = ?, edited_by_user_id = ?, edited_at = ?
        """ + (", result_unit = ?" if new_unit else "") + """
        WHERE id = ?
    """, ([new_value, edit_reason, current_user["id"], now_str] + ([new_unit] if new_unit else []) + [result_id]))
    
    # Log to audit_log
    cur.execute(
        "INSERT INTO audit_log (user_id, action, detail, timestamp) VALUES (?, ?, ?, ?)",
        (current_user["id"], "EDIT_RESULT",
         f"result_id={result_id} order_id={row['order_id']} old_value={old_value!r} new_value={new_value!r} reason={edit_reason!r}",
         now_str)
    )
    
    conn.commit()
    logger.info(f"Admin '{current_user['username']}' edited result ID {result_id}: {old_value!r} -> {new_value!r}")
    return {"status": "updated", "result_id": result_id}

@router.get("/api/clients/report/{order_id}")
@router.get("/api/report/{order_id}")
def get_printable_client_report(order_id: int, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            o.id as order_id, o.sample_id, o.ordered_at, o.status,
            p.client_number, p.full_name as client_name, p.date_of_birth, p.sex, p.phone,
            v.id as visit_id, v.ward_of_origin, v.lab_number,
            c.name as clinician_name,
            t.name as test_name, t.is_tracked, s.name as section_name,
            u.full_name as technician_name
        FROM test_orders o
        JOIN visits v ON o.visit_id = v.id
        JOIN clients p ON v.client_id = p.id
        LEFT JOIN clinicians c ON v.clinician_id = c.id
        JOIN tests t ON o.test_id = t.id
        JOIN sections s ON t.section_id = s.id
        LEFT JOIN users u ON o.ordered_by_user_id = u.id
        WHERE o.id = ? AND v.is_deleted = 0
    """, (order_id,))
    
    order_info = cur.fetchone()
    if not order_info:
        raise HTTPException(status_code=404, detail="Client report order not found")

    cur.execute("""
        SELECT r.id, r.parameter_id, tp.parameter_name, tp.unit, tp.ref_range, r.result_value, r.result_unit, r.clinical_flag, r.is_positive
        FROM test_results r
        LEFT JOIN test_parameters tp ON r.parameter_id = tp.id
        WHERE r.order_id = ?
        ORDER BY tp.sort_order, r.id
    """, (order_id,))
    
    results = [dict(r) for r in cur.fetchall()]
    
    data = dict(order_info)
    data["results"] = results
    return data

@router.get("/api/clients/{client_id}/orders")
def get_client_orders(client_id: int, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            o.id as order_id, o.sample_id, o.ordered_at, o.status,
            o.visit_id, v.ward_of_origin, v.lab_number,
            t.id as test_id, t.name as test_name, t.is_tracked, s.name as section_name,
            u.full_name as technician_name
        FROM test_orders o
        JOIN visits v ON o.visit_id = v.id
        JOIN tests t ON o.test_id = t.id
        JOIN sections s ON t.section_id = s.id
        LEFT JOIN users u ON o.ordered_by_user_id = u.id
        WHERE v.client_id = ? AND v.is_deleted = 0
        ORDER BY o.id DESC
    """, (client_id,))
    
    orders = [dict(r) for r in cur.fetchall()]
    
    for o in orders:
        cur.execute("""
            SELECT r.id, r.parameter_id, tp.parameter_name, tp.unit, tp.ref_range, r.result_value, r.result_unit, r.clinical_flag, r.is_positive
            FROM test_results r
            LEFT JOIN test_parameters tp ON r.parameter_id = tp.id
            WHERE r.order_id = ?
            ORDER BY tp.sort_order, r.id
        """, (o["order_id"],))
        o["results"] = [dict(r) for r in cur.fetchall()]
        
    return orders

@router.get("/api/clients/{client_id}/visits")
def get_client_visits(client_id: int, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            v.id as visit_id, v.ward_of_origin, v.clinician_id, v.lab_number, v.created_at,
            v.dispatched_at, v.dispatched_to, v.dispatched_by_user_id,
            cl.name as clinician_name,
            u_disp.full_name as dispatched_by_name,
            (SELECT COUNT(*) FROM test_orders o WHERE o.visit_id = v.id AND o.status = 'entered') as unverified_count,
            (SELECT COUNT(*) FROM test_orders o WHERE o.visit_id = v.id AND o.status = 'completed') as completed_count
        FROM visits v
        LEFT JOIN clinicians cl ON v.clinician_id = cl.id
        LEFT JOIN users u_disp ON v.dispatched_by_user_id = u_disp.id
        WHERE v.client_id = ? AND v.is_deleted = 0
        ORDER BY v.id DESC
    """, (client_id,))
    return [dict(r) for r in cur.fetchall()]


@router.get("/api/visits/{visit_id}")
def get_visit_details(visit_id: int, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            v.id as visit_id, v.ward_of_origin, v.lab_number, v.created_at,
            v.dispatched_at, v.dispatched_to, v.dispatched_by_user_id,
            c.id as client_id, c.client_number, c.full_name, c.date_of_birth, c.age_years, c.sex, c.phone,
            cl.id as clinician_id, cl.name as clinician_name,
            u_disp.full_name as dispatched_by_name
        FROM visits v
        JOIN clients c ON v.client_id = c.id
        LEFT JOIN clinicians cl ON v.clinician_id = cl.id
        LEFT JOIN users u_disp ON v.dispatched_by_user_id = u_disp.id
        WHERE v.id = ? AND v.is_deleted = 0
    """, (visit_id,))
    visit_row = cur.fetchone()
    if not visit_row:
        raise HTTPException(status_code=404, detail="Visit not found")

    cur.execute("""
        SELECT 
            o.id as order_id, o.sample_id, o.ordered_at, o.status, o.order_category,
            t.id as test_id, t.name as test_name, t.is_tracked, t.ref_range, t.default_unit, t.secondary_unit, t.result_type, s.name as section_name,
            u.full_name as ordered_by_name
        FROM test_orders o
        JOIN tests t ON o.test_id = t.id
        JOIN sections s ON t.section_id = s.id
        LEFT JOIN users u ON o.ordered_by_user_id = u.id
        WHERE o.visit_id = ?
        ORDER BY o.id ASC
    """, (visit_id,))
    orders = [dict(r) for r in cur.fetchall()]

    for o in orders:
        cur.execute("""
            SELECT r.id, r.parameter_id, tp.parameter_name, tp.unit, tp.ref_range, r.result_value, r.result_unit, r.clinical_flag, r.is_positive,
                   r.entered_at, r.verified_at, r.edit_reason, r.edited_at, u1.full_name as entered_by_name, u2.full_name as verified_by_name
            FROM test_results r
            LEFT JOIN test_parameters tp ON r.parameter_id = tp.id
            LEFT JOIN users u1 ON r.entered_by_user_id = u1.id
            LEFT JOIN users u2 ON r.verified_by_user_id = u2.id
            WHERE r.order_id = ?
            ORDER BY tp.sort_order, r.id
        """, (o["order_id"],))
        o["results"] = [dict(r) for r in cur.fetchall()]

    data = dict(visit_row)
    data["orders"] = orders
    return data

@router.delete("/api/clients/bulk")
def bulk_delete_clients(req: BulkClientDeleteRequest, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Only admins can delete clients in bulk")
    logger.info(f"User '{current_user['username']}' is bulk deleting clients: {req.client_ids}")
    cur = conn.cursor()
    deleted_ids = []
    skipped_ids = []
    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    for cid in req.client_ids:
        cur.execute("SELECT id FROM clients WHERE id = ?", (cid,))
        if not cur.fetchone():
            skipped_ids.append(cid)
            continue

        # Get all visits for client
        cur.execute("SELECT id FROM visits WHERE client_id = ?", (cid,))
        visits = cur.fetchall()
        for v in visits:
            vid = v["id"]
            cur.execute("SELECT id FROM test_orders WHERE visit_id = ?", (vid,))
            orders = cur.fetchall()
            for o in orders:
                cur.execute("DELETE FROM test_results WHERE order_id = ?", (o["id"],))
            cur.execute("DELETE FROM test_orders WHERE visit_id = ?", (vid,))
            cur.execute("DELETE FROM visits WHERE id = ?", (vid,))

        cur.execute("DELETE FROM clients WHERE id = ?", (cid,))
        cur.execute(
            "INSERT INTO audit_log (user_id, action, detail, timestamp) VALUES (?, 'DELETE_CLIENT', ?, ?)",
            (current_user["id"], f"Deleted client ID {cid} and associated records (bulk)", now_str)
        )
        deleted_ids.append(cid)

    conn.commit()
    logger.info(f"Bulk deleted clients result - deleted: {deleted_ids}, skipped: {skipped_ids}")
    return {"status": "deleted", "deleted_client_ids": deleted_ids, "skipped_client_ids": skipped_ids}

@router.delete("/api/clients/{client_id}")
def delete_client(client_id: int, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Only administrators can delete clients.")
    logger.info(f"User '{current_user['username']}' is deleting client ID {client_id}")
    cur = conn.cursor()
    cur.execute("SELECT id FROM clients WHERE id = ?", (client_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=404, detail="Client not found")

    cur.execute("SELECT id FROM visits WHERE client_id = ?", (client_id,))
    visits = cur.fetchall()
    for v in visits:
        vid = v["id"]
        cur.execute("SELECT id FROM test_orders WHERE visit_id = ?", (vid,))
        orders = cur.fetchall()
        for o in orders:
            cur.execute("DELETE FROM test_results WHERE order_id = ?", (o["id"],))
        cur.execute("DELETE FROM test_orders WHERE visit_id = ?", (vid,))
        cur.execute("DELETE FROM visits WHERE id = ?", (vid,))

    cur.execute("DELETE FROM clients WHERE id = ?", (client_id,))
    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    cur.execute(
        "INSERT INTO audit_log (user_id, action, detail, timestamp) VALUES (?, 'DELETE_CLIENT', ?, ?)",
        (current_user["id"], f"Deleted client ID {client_id} and associated records", now_str)
    )
    conn.commit()
    return {"status": "deleted", "client_id": client_id}

@router.delete("/api/visits/bulk")
def bulk_delete_visits(req: BulkVisitDeleteRequest, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    if current_user.get("role") not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Only admins can delete visits in bulk")

    logger.info(f"User '{current_user['username']}' is bulk deleting visits: {req.visit_ids}")
    cur = conn.cursor()
    deleted_ids = []
    skipped_ids = []
    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    
    for visit_id in req.visit_ids:
        cur.execute("SELECT id, is_deleted FROM visits WHERE id = ?", (visit_id,))
        visit_row = cur.fetchone()
        if not visit_row or visit_row["is_deleted"] == 1:
            skipped_ids.append(visit_id)
            continue
            
        cur.execute("SELECT id FROM test_orders WHERE visit_id = ?", (visit_id,))
        orders = cur.fetchall()
        for o in orders:
            cur.execute("DELETE FROM test_results WHERE order_id = ?", (o["id"],))
            
        cur.execute("DELETE FROM test_orders WHERE visit_id = ?", (visit_id,))
        cur.execute("UPDATE visits SET is_deleted = 1 WHERE id = ?", (visit_id,))
        cur.execute(
            "INSERT INTO audit_log (user_id, action, detail, timestamp) VALUES (?, 'DELETE_VISIT', ?, ?)",
            (current_user["id"], f"Soft-deleted visit ID {visit_id} and removed associated test orders (bulk)", now_str)
        )
        deleted_ids.append(visit_id)
        
    conn.commit()
    logger.info(f"Bulk deleted visits result - deleted: {deleted_ids}, skipped: {skipped_ids}")
    return {"status": "deleted", "deleted_visit_ids": deleted_ids, "skipped_visit_ids": skipped_ids}

@router.delete("/api/visits/{visit_id}")
def delete_visit(visit_id: int, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    logger.info(f"User '{current_user['username']}' is deleting visit ID {visit_id}")
    cur = conn.cursor()
    
    cur.execute("SELECT id, is_deleted FROM visits WHERE id = ?", (visit_id,))
    visit_row = cur.fetchone()
    if not visit_row or visit_row["is_deleted"] == 1:
        raise HTTPException(status_code=404, detail="Visit not found")

    cur.execute("SELECT COUNT(*) as result_count FROM test_orders WHERE visit_id = ? AND status IN ('entered', 'completed')", (visit_id,))
    res_count = cur.fetchone()["result_count"]
    if res_count > 0 and current_user.get("role") not in ["admin", "superadmin"]:
        raise HTTPException(status_code=403, detail="Visits with saved test results can only be deleted by an Administrator.")
        
    # Find all test orders for this visit
    cur.execute("SELECT id FROM test_orders WHERE visit_id = ?", (visit_id,))
    orders = cur.fetchall()
    
    # Delete test results for these orders
    for o in orders:
        cur.execute("DELETE FROM test_results WHERE order_id = ?", (o["id"],))
        
    # Delete test orders to clean up pending orders completely
    cur.execute("DELETE FROM test_orders WHERE visit_id = ?", (visit_id,))
    
    # Soft delete visit
    cur.execute("UPDATE visits SET is_deleted = 1 WHERE id = ?", (visit_id,))
    
    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    cur.execute("INSERT INTO audit_log (user_id, action, detail, timestamp) VALUES (?, 'DELETE_VISIT', ?, ?)",
                (current_user["id"], f"Soft-deleted visit ID {visit_id} and removed associated test orders", now_str))
    
    conn.commit()
    return {"status": "deleted", "visit_id": visit_id}

@router.post("/api/clients/orders/{order_id}/verify")
@router.post("/api/orders/{order_id}/verify")
def verify_order(
    order_id: int,
    conn: sqlite3.Connection = Depends(get_db),
    admin_user: dict = Depends(require_admin)
):
    cur = conn.cursor()
    cur.execute("SELECT id, visit_id, test_id FROM test_orders WHERE id = ?", (order_id,))
    order = cur.fetchone()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    cur.execute("UPDATE test_orders SET status = 'completed' WHERE id = ?", (order_id,))
    cur.execute("UPDATE test_results SET verified_by_user_id = ?, verified_at = ? WHERE order_id = ?", (admin_user["id"], now_str, order_id))
    cur.execute(
        "INSERT INTO audit_log (user_id, action, detail, timestamp) VALUES (?, 'VERIFY_ORDER', ?, ?)",
        (admin_user["id"], f"Verified order ID {order_id}", now_str)
    )
    conn.commit()
    return {"status": "verified", "order_id": order_id, "verified_by": admin_user["username"]}

@router.post("/api/clients/visits/{visit_id}/verify")
@router.post("/api/visits/{visit_id}/verify")
def verify_visit(
    visit_id: int,
    conn: sqlite3.Connection = Depends(get_db),
    admin_user: dict = Depends(require_admin)
):
    cur = conn.cursor()
    cur.execute("SELECT id FROM visits WHERE id = ? AND is_deleted = 0", (visit_id,))
    visit = cur.fetchone()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    cur.execute("SELECT id FROM test_orders WHERE visit_id = ?", (visit_id,))
    orders = cur.fetchall()
    if not orders:
        raise HTTPException(status_code=404, detail="No test orders found for this visit")

    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    order_ids = [o["id"] for o in orders]
    placeholders = ",".join("?" for _ in order_ids)
    
    cur.execute(f"UPDATE test_orders SET status = 'completed' WHERE id IN ({placeholders})", order_ids)
    cur.execute(f"UPDATE test_results SET verified_by_user_id = ?, verified_at = ? WHERE order_id IN ({placeholders})", [admin_user["id"], now_str] + order_ids)
    
    cur.execute(
        "INSERT INTO audit_log (user_id, action, detail, timestamp) VALUES (?, 'VERIFY_VISIT', ?, ?)",
        (admin_user["id"], f"Verified all test results for visit ID {visit_id}", now_str)
    )
    conn.commit()
    return {"status": "verified", "visit_id": visit_id, "verified_count": len(order_ids)}

@router.post("/api/visits/{visit_id}/dispatch")
def dispatch_visit(
    visit_id: int,
    payload: Optional[VisitDispatch] = None,
    conn: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    cur = conn.cursor()
    cur.execute("SELECT id FROM visits WHERE id = ? AND is_deleted = 0", (visit_id,))
    visit = cur.fetchone()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    dispatched_to = payload.dispatched_to if payload and payload.dispatched_to else "Patient / Ward"
    dispatched_to = dispatched_to.strip() if dispatched_to else "Patient / Ward"

    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    cur.execute(
        "UPDATE visits SET dispatched_at = ?, dispatched_to = ?, dispatched_by_user_id = ? WHERE id = ?",
        (now_str, dispatched_to, current_user["id"], visit_id)
    )
    cur.execute(
        "INSERT INTO audit_log (user_id, action, detail, timestamp) VALUES (?, 'DISPATCH_REPORT', ?, ?)",
        (current_user["id"], f"Dispatched report for visit ID {visit_id} to '{dispatched_to}'", now_str)
    )
    conn.commit()
    return {
        "status": "dispatched",
        "visit_id": visit_id,
        "dispatched_at": now_str,
        "dispatched_to": dispatched_to,
        "dispatched_by_user_id": current_user["id"]
    }

@router.delete("/api/visits/{visit_id}/dispatch")
def revert_dispatch(
    visit_id: int,
    conn: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    cur = conn.cursor()
    cur.execute("SELECT id, dispatched_at, dispatched_to FROM visits WHERE id = ? AND is_deleted = 0", (visit_id,))
    visit = cur.fetchone()
    if not visit:
        raise HTTPException(status_code=404, detail="Visit not found")

    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    cur.execute(
        "UPDATE visits SET dispatched_at = NULL, dispatched_to = NULL, dispatched_by_user_id = NULL WHERE id = ?",
        (visit_id,)
    )
    cur.execute(
        "INSERT INTO audit_log (user_id, action, detail, timestamp) VALUES (?, 'REVERT_DISPATCH', ?, ?)",
        (current_user["id"], f"Reverted dispatch for visit ID {visit_id}", now_str)
    )
    conn.commit()
    return {"status": "reverted", "visit_id": visit_id}

@router.post("/api/clients/orders/{order_id}/crossmatch")
def record_donor_crossmatch(
    order_id: int,
    req: CrossmatchCreate,
    conn: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    cur = conn.cursor()
    cur.execute("""
        SELECT 
            o.id as order_id, o.visit_id, o.test_id, o.status,
            t.name as test_name,
            c.id as client_id, c.full_name
        FROM test_orders o
        JOIN tests t ON o.test_id = t.id
        JOIN visits v ON o.visit_id = v.id
        JOIN clients c ON v.client_id = c.id
        WHERE o.id = ?
    """, (order_id,))
    order = cur.fetchone()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    is_admin = current_user.get("role") in ["admin", "superadmin"]

    # Look up client's known blood group from visits/test_results
    cur.execute("""
        SELECT tr.result_value
        FROM test_results tr
        JOIN test_orders o ON tr.order_id = o.id
        JOIN visits v ON o.visit_id = v.id
        JOIN tests t ON o.test_id = t.id
        WHERE v.client_id = ? AND LOWER(t.name) LIKE '%blood group%'
        AND tr.result_value IS NOT NULL AND tr.result_value NOT LIKE '%Discrepancy%'
        ORDER BY tr.id DESC LIMIT 1
    """, (order["client_id"],))
    bg_row = cur.fetchone()
    client_group = bg_row["result_value"] if bg_row else None

    eval_res = evaluate_crossmatch(
        client_name=order["full_name"],
        client_group=client_group,
        donor_unit_id=req.donor_unit_id.strip().upper(),
        donor_group=req.donor_blood_group,
        product_type=req.product_type,
        expiry_date=req.expiry_date,
        phase_is=req.phase_is,
        phase_thermophase=req.phase_thermophase,
        phase_ahg=req.phase_ahg
    )

    if not eval_res["is_valid"]:
        raise HTTPException(status_code=400, detail=eval_res["error"])

    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    is_incompatible = (eval_res["compatibility_status"] == "INCOMPATIBLE")

    cur.execute("""
        INSERT INTO donor_crossmatches (
            order_id, donor_unit_id, donor_blood_group, product_type, expiry_date,
            phase_is, phase_thermophase, phase_ahg, compatibility_status,
            release_status, clinical_summary, is_locked, entered_by_user_id, verified_by_user_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        order_id,
        req.donor_unit_id.strip().upper(),
        req.donor_blood_group,
        req.product_type,
        req.expiry_date,
        req.phase_is,
        req.phase_thermophase,
        req.phase_ahg,
        eval_res["compatibility_status"],
        eval_res["release_status"],
        eval_res["clinical_summary"],
        1 if is_incompatible else 0,
        current_user["id"],
        current_user["id"] if is_admin else None,
        now_str
    ))
    cm_id = cur.lastrowid

    # Update order status and summary result in test_results
    order_status = "completed" if is_admin else "entered"
    cur.execute("UPDATE test_orders SET status = ? WHERE id = ?", (order_status, order_id))

    summary_val = f"Unit {req.donor_unit_id.strip().upper()}: {eval_res['compatibility_status']} ({eval_res['release_status']})"
    flag_val = "\u26A0" if is_incompatible else ""

    cur.execute("SELECT id FROM test_results WHERE order_id = ? AND parameter_id IS NULL", (order_id,))
    res_row = cur.fetchone()
    if res_row:
        cur.execute("""
            UPDATE test_results
            SET result_value = ?, clinical_flag = ?, is_positive = ?,
                verified_by_user_id = ?, verified_at = ?
            WHERE id = ?
        """, (summary_val, flag_val, is_incompatible, current_user["id"] if is_admin else None, now_str if is_admin else None, res_row["id"]))
    else:
        cur.execute("""
            INSERT INTO test_results (order_id, parameter_id, result_value, clinical_flag, is_positive, entered_by_user_id, entered_at, verified_by_user_id, verified_at)
            VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?)
        """, (order_id, summary_val, flag_val, is_incompatible, current_user["id"], now_str, current_user["id"] if is_admin else None, now_str if is_admin else None))

    # Audit log
    cur.execute("""
        INSERT INTO audit_log (user_id, action, detail, timestamp)
        VALUES (?, 'RECORD_CROSSMATCH', ?, ?)
    """, (current_user["id"], f"order_id={order_id} donor_unit={req.donor_unit_id.strip().upper()} status={eval_res['compatibility_status']}", now_str))

    conn.commit()

    return {
        "id": cm_id,
        "order_id": order_id,
        "donor_unit_id": req.donor_unit_id.strip().upper(),
        "donor_blood_group": req.donor_blood_group,
        "product_type": req.product_type,
        "expiry_date": req.expiry_date,
        "phase_is": req.phase_is,
        "phase_thermophase": req.phase_thermophase,
        "phase_ahg": req.phase_ahg,
        "compatibility_status": eval_res["compatibility_status"],
        "release_status": eval_res["release_status"],
        "clinical_summary": eval_res["clinical_summary"],
        "is_locked": 1 if is_incompatible else 0,
        "entered_by_user_id": current_user["id"],
        "verified_by_user_id": current_user["id"] if is_admin else None,
        "created_at": now_str
    }

@router.get("/api/clients/orders/{order_id}/crossmatches")
def get_donor_crossmatches(
    order_id: int,
    conn: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    cur = conn.cursor()
    cur.execute("""
        SELECT * FROM donor_crossmatches
        WHERE order_id = ?
        ORDER BY id ASC
    """, (order_id,))
    rows = cur.fetchall()
    return [dict(r) for r in rows]

@router.delete("/api/clients/crossmatches/{crossmatch_id}")
def delete_donor_crossmatch(
    crossmatch_id: int,
    conn: sqlite3.Connection = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    cur = conn.cursor()
    cur.execute("SELECT * FROM donor_crossmatches WHERE id = ?", (crossmatch_id,))
    row = cur.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Crossmatch record not found")

    is_admin = current_user.get("role") in ["admin", "superadmin"]
    if row["is_locked"] and not is_admin:
        raise HTTPException(status_code=403, detail="Incompatible units are locked for safety and cannot be removed without supervisor authorization.")

    cur.execute("DELETE FROM donor_crossmatches WHERE id = ?", (crossmatch_id,))
    now_str = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    cur.execute("""
        INSERT INTO audit_log (user_id, action, detail, timestamp)
        VALUES (?, 'DELETE_CROSSMATCH', ?, ?)
    """, (current_user["id"], f"crossmatch_id={crossmatch_id} unit_id={row['donor_unit_id']}", now_str))
    conn.commit()
    return {"status": "deleted", "id": crossmatch_id}


