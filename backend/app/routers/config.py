import sqlite3
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from ..database import get_db
from ..schemas import (
    TestCreate, TestResponse, WardCreate, WardUpdate, WardResponse, 
    ClinicianCreate, ClinicianUpdate, ClinicianResponse,
    ReferenceRangeCreate, ReferenceRangeUpdate, ReferenceRangeResponse,
    FacilitySettingsUpdate, FacilitySettingsResponse,
    SpecimenTypeResponse
)
from ..auth import get_current_user, require_admin
from ..specimen_validator import get_compatible_specimens_for_test, validate_test_specimen_selection
from pydantic import BaseModel

router = APIRouter(prefix="/api/config", tags=["Configuration"])

@router.get("/specimens", response_model=List[SpecimenTypeResponse])
def get_specimens(conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cur = conn.cursor()
    cur.execute("SELECT id, name, container, min_volume, is_active, sort_order FROM specimen_types WHERE is_active = 1 ORDER BY sort_order, id")
    return [dict(r) for r in cur.fetchall()]

@router.get("/sections")
def get_sections(conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cur = conn.cursor()
    cur.execute("SELECT id, name, sort_order FROM sections ORDER BY sort_order, id")
    return [dict(r) for r in cur.fetchall()]

@router.get("/tests")
def get_tests(conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cur = conn.cursor()
    cur.execute("""
        SELECT t.id, t.name, t.section_id, s.name as section_name, t.is_tracked, t.parent_rollup_id, 
               t.ref_range, t.panic_value_low, t.panic_value_high, t.is_active, t.sort_order, 
               t.result_type, t.default_unit, t.secondary_unit, t.options, t.tracks_stock, 
               t.consumable_name, t.clinical_comments 
        FROM tests t
        LEFT JOIN sections s ON t.section_id = s.id
        WHERE t.is_active = 1 
        ORDER BY t.section_id, t.sort_order, t.id
    """)
    rows = cur.fetchall()
    res = []
    for r in rows:
        d = dict(r)
        d["compatible_specimens"] = get_compatible_specimens_for_test(d["name"], d.get("section_name"))
        res.append(d)
    return res

class SpecimenValidateRequest(BaseModel):
    test_ids: List[int]
    specimen_type_ids: List[int]

@router.post("/specimens/validate")
def validate_order_specimens(req: SpecimenValidateRequest, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cur = conn.cursor()
    tests = []
    if req.test_ids:
        placeholders = ",".join("?" for _ in req.test_ids)
        cur.execute(f"SELECT t.id, t.name, s.name as section FROM tests t LEFT JOIN sections s ON t.section_id = s.id WHERE t.id IN ({placeholders})", req.test_ids)
        tests = [dict(r) for r in cur.fetchall()]
        
    specimen_names = []
    if req.specimen_type_ids:
        s_placeholders = ",".join("?" for _ in req.specimen_type_ids)
        cur.execute(f"SELECT name FROM specimen_types WHERE id IN ({s_placeholders})", req.specimen_type_ids)
        specimen_names = [r["name"] for r in cur.fetchall()]

    is_valid, errors, mapping = validate_test_specimen_selection(tests, specimen_names)
    return {
        "is_valid": is_valid,
        "errors": errors,
        "test_to_specimen": mapping
    }

@router.get("/tests/{test_id}/parameters")
def get_test_parameters(test_id: int, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cur = conn.cursor()
    cur.execute("SELECT id, test_id, parameter_name, unit, secondary_unit, ref_range, sort_order, options FROM test_parameters WHERE test_id = ? ORDER BY sort_order, id", (test_id,))
    return [dict(r) for r in cur.fetchall()]

@router.get("/tests/{test_id}/children")
def get_test_children(test_id: int, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    """Return all active child sub-parameters of a panel test, ordered by sort_order."""
    cur = conn.cursor()
    cur.execute(
        """SELECT id, name, section_id, is_tracked, parent_rollup_id, sort_order,
                  result_type, default_unit, secondary_unit, options, tracks_stock, consumable_name, clinical_comments
           FROM tests
           WHERE parent_rollup_id = ? AND is_active = 1
           ORDER BY sort_order, id""",
        (test_id,)
    )
    return [dict(r) for r in cur.fetchall()]


@router.post("/tests")
def create_test(req: TestCreate, admin_user: dict = Depends(require_admin), conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT id FROM sections WHERE id = ?", (req.section_id,))
    if not cur.fetchone():
        raise HTTPException(status_code=400, detail="Invalid section ID")
    
    if req.is_tracked is None:
        effective_tracked = 1 if req.result_type in ("qualitative", "semi_quantitative", "options", "panel") else 0
    else:
        effective_tracked = 1 if req.is_tracked else 0

    tracks_stock_val = 1 if req.tracks_stock else 0

    try:
        cur.execute(
            "INSERT INTO tests (name, section_id, is_tracked, sort_order, result_type, default_unit, secondary_unit, options, parent_rollup_id, tracks_stock, consumable_name, clinical_comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (req.name, req.section_id, effective_tracked, req.sort_order, req.result_type, req.default_unit, req.secondary_unit, req.options, req.parent_rollup_id, tracks_stock_val, req.consumable_name, req.clinical_comments)
        )
        tid = cur.lastrowid
        conn.commit()
    except sqlite3.IntegrityError as e:
        conn.rollback()
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(
                status_code=409,
                detail=f"A test named '{req.name}' already exists in this section. Please edit the existing test from the catalog instead of creating a duplicate."
            )
        raise HTTPException(status_code=400, detail=f"Database integrity error: {str(e)}")
    
    conn.execute("INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)", (admin_user["id"], "create_test", f"Created test '{req.name}'"))
    conn.commit()
    
    return {"id": tid, "name": req.name, "section_id": req.section_id, "is_tracked": bool(effective_tracked), "result_type": req.result_type, "default_unit": req.default_unit, "secondary_unit": req.secondary_unit, "options": req.options, "parent_rollup_id": req.parent_rollup_id, "tracks_stock": bool(tracks_stock_val), "consumable_name": req.consumable_name, "clinical_comments": req.clinical_comments}
    

@router.put("/tests/{test_id}", response_model=TestResponse)
def update_test(test_id: int, req: TestCreate, admin_user: dict = Depends(require_admin), conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT id, is_active FROM tests WHERE id = ?", (test_id,))
    test_row = cur.fetchone()
    if not test_row:
        raise HTTPException(status_code=404, detail="Test not found")
        
    if req.is_tracked is None:
        effective_tracked = 1 if req.result_type in ("qualitative", "semi_quantitative", "options", "panel") else 0
    else:
        effective_tracked = 1 if req.is_tracked else 0

    tracks_stock_val = 1 if req.tracks_stock else 0

    try:
        cur.execute("""
            UPDATE tests
            SET name = ?, section_id = ?, is_tracked = ?, sort_order = ?, result_type = ?, default_unit = ?, secondary_unit = ?, options = ?, parent_rollup_id = ?, tracks_stock = ?, consumable_name = ?, clinical_comments = ?
            WHERE id = ?
        """, (req.name, req.section_id, effective_tracked, req.sort_order, req.result_type, req.default_unit, req.secondary_unit, req.options, req.parent_rollup_id, tracks_stock_val, req.consumable_name, req.clinical_comments, test_id))
        conn.commit()
    except sqlite3.IntegrityError as e:
        conn.rollback()
        if "UNIQUE constraint failed" in str(e):
            raise HTTPException(
                status_code=409,
                detail=f"Another test named '{req.name}' already exists in this section. Please use a distinct name."
            )
        raise HTTPException(status_code=400, detail=f"Database integrity error: {str(e)}")
    
    conn.execute("INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)", (admin_user["id"], "update_test", f"Updated test ID {test_id} ('{req.name}')"))
    conn.commit()
    return TestResponse(
        id=test_id, name=req.name, section_id=req.section_id, 
        is_tracked=bool(effective_tracked), sort_order=req.sort_order, is_active=bool(test_row["is_active"]),
        result_type=req.result_type, default_unit=req.default_unit, secondary_unit=req.secondary_unit, options=req.options,
        parent_rollup_id=req.parent_rollup_id, tracks_stock=bool(tracks_stock_val),
        consumable_name=req.consumable_name, clinical_comments=req.clinical_comments
    )

@router.get("/tests/{test_id}/usage")
def check_test_usage(test_id: int, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cur = conn.cursor()
    cur.execute("SELECT id, name FROM tests WHERE id = ?", (test_id,))
    t = cur.fetchone()
    if not t:
        raise HTTPException(status_code=404, detail="Test not found")
    
    # Check test_orders count
    cur.execute("SELECT COUNT(*) as cnt FROM test_orders WHERE test_id = ?", (test_id,))
    orders_cnt = cur.fetchone()["cnt"]
    
    # Check test_results count
    cur.execute("SELECT COUNT(*) as cnt FROM test_results WHERE test_id = ?", (test_id,))
    results_cnt = cur.fetchone()["cnt"]
    
    # Check reference ranges count
    cur.execute("SELECT COUNT(*) as cnt FROM reference_ranges WHERE test_id = ? OR LOWER(parameter_name) = LOWER(?)", (test_id, t["name"]))
    ref_cnt = cur.fetchone()["cnt"]
    
    return {
        "test_id": test_id,
        "name": t["name"],
        "orders_count": orders_cnt,
        "results_count": results_cnt,
        "reference_ranges_count": ref_cnt,
        "has_history": (orders_cnt > 0 or results_cnt > 0)
    }

@router.delete("/tests/{test_id}")
def delete_test(test_id: int, admin_user: dict = Depends(require_admin), conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT id, name FROM tests WHERE id = ?", (test_id,))
    t = cur.fetchone()
    if not t:
        raise HTTPException(status_code=404, detail="Test not found")
        
    conn.execute("UPDATE tests SET is_active = 0 WHERE id = ?", (test_id,))
    conn.execute("INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)", (admin_user["id"], "delete_test", f"Soft deleted test ID {test_id} ('{t['name']}')"))
    conn.commit()
    return {"status": "deleted", "name": t["name"]}

@router.get("/wards", response_model=List[WardResponse])
def get_wards(active_only: Optional[bool] = None, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cur = conn.cursor()
    if active_only is True:
        cur.execute("SELECT id, name, is_active FROM wards WHERE is_active = 1 ORDER BY name ASC")
    elif active_only is False:
        cur.execute("SELECT id, name, is_active FROM wards WHERE is_active = 0 ORDER BY name ASC")
    else:
        cur.execute("SELECT id, name, is_active FROM wards ORDER BY name ASC")
    return [dict(r) for r in cur.fetchall()]

@router.post("/wards", response_model=WardResponse)
def create_ward(req: WardCreate, admin_user: dict = Depends(require_admin), conn: sqlite3.Connection = Depends(get_db)):
    name = req.name.strip() if req.name else ""
    if not name:
        raise HTTPException(status_code=400, detail="Ward name cannot be empty")
    cur = conn.cursor()
    cur.execute("SELECT id FROM wards WHERE LOWER(name) = LOWER(?)", (name,))
    if cur.fetchone():
        raise HTTPException(status_code=400, detail="Ward already exists")
    cur.execute("INSERT INTO wards (name, is_active) VALUES (?, 1)", (name,))
    wid = cur.lastrowid
    conn.commit()
    conn.execute("INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)", (admin_user["id"], "create_ward", f"Created ward '{name}'"))
    conn.commit()
    return WardResponse(id=wid, name=name, is_active=True)

@router.put("/wards/{ward_id}", response_model=WardResponse)
def update_ward(ward_id: int, req: WardUpdate, admin_user: dict = Depends(require_admin), conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT id, name, is_active FROM wards WHERE id = ?", (ward_id,))
    existing = cur.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Ward not found")
    
    new_name = req.name.strip() if req.name is not None else existing["name"]
    if req.name is not None and not new_name:
        raise HTTPException(status_code=400, detail="Ward name cannot be empty")
        
    if req.name is not None and new_name.lower() != existing["name"].lower():
        cur.execute("SELECT id FROM wards WHERE LOWER(name) = LOWER(?) AND id != ?", (new_name, ward_id))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Ward with this name already exists")
            
    new_is_active = req.is_active if req.is_active is not None else bool(existing["is_active"])
    
    cur.execute("UPDATE wards SET name = ?, is_active = ? WHERE id = ?", (new_name, 1 if new_is_active else 0, ward_id))
    conn.commit()
    conn.execute("INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)", (admin_user["id"], "update_ward", f"Updated ward ID {ward_id} ({new_name})"))
    conn.commit()
    return WardResponse(id=ward_id, name=new_name, is_active=new_is_active)

@router.delete("/wards/{ward_id}")
def delete_ward(ward_id: int, admin_user: dict = Depends(require_admin), conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT id, name FROM wards WHERE id = ?", (ward_id,))
    existing = cur.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Ward not found")
    cur.execute("UPDATE wards SET is_active = 0 WHERE id = ?", (ward_id,))
    conn.commit()
    conn.execute("INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)", (admin_user["id"], "delete_ward", f"Soft deleted ward ID {ward_id} ({existing['name']})"))
    conn.commit()
    return {"status": "deleted"}

@router.get("/clinicians", response_model=List[ClinicianResponse])
def get_clinicians(active_only: Optional[bool] = None, conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cur = conn.cursor()
    if active_only is True:
        cur.execute("SELECT id, name, is_active, created_at FROM clinicians WHERE is_active = 1 ORDER BY name ASC")
    elif active_only is False:
        cur.execute("SELECT id, name, is_active, created_at FROM clinicians WHERE is_active = 0 ORDER BY name ASC")
    else:
        cur.execute("SELECT id, name, is_active, created_at FROM clinicians ORDER BY name ASC")
    return [dict(r) for r in cur.fetchall()]

@router.post("/clinicians", response_model=ClinicianResponse)
def create_clinician(req: ClinicianCreate, admin_user: dict = Depends(require_admin), conn: sqlite3.Connection = Depends(get_db)):
    name = req.name.strip() if req.name else ""
    if not name:
        raise HTTPException(status_code=400, detail="Clinician name cannot be empty")
    cur = conn.cursor()
    cur.execute("SELECT id FROM clinicians WHERE LOWER(name) = LOWER(?)", (name,))
    if cur.fetchone():
        raise HTTPException(status_code=400, detail="Clinician already exists")
    cur.execute("INSERT INTO clinicians (name, is_active) VALUES (?, 1)", (name,))
    cid = cur.lastrowid
    conn.commit()
    conn.execute("INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)", (admin_user["id"], "create_clinician", f"Created clinician '{name}'"))
    conn.commit()
    return ClinicianResponse(id=cid, name=name, is_active=True)

@router.put("/clinicians/{clinician_id}", response_model=ClinicianResponse)
def update_clinician(clinician_id: int, req: ClinicianUpdate, admin_user: dict = Depends(require_admin), conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT id, name, is_active FROM clinicians WHERE id = ?", (clinician_id,))
    existing = cur.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Clinician not found")
    
    new_name = req.name.strip() if req.name is not None else existing["name"]
    if req.name is not None and not new_name:
        raise HTTPException(status_code=400, detail="Clinician name cannot be empty")
        
    if req.name is not None and new_name.lower() != existing["name"].lower():
        cur.execute("SELECT id FROM clinicians WHERE LOWER(name) = LOWER(?) AND id != ?", (new_name, clinician_id))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Clinician with this name already exists")
            
    new_is_active = req.is_active if req.is_active is not None else bool(existing["is_active"])
    
    cur.execute("UPDATE clinicians SET name = ?, is_active = ? WHERE id = ?", (new_name, 1 if new_is_active else 0, clinician_id))
    conn.commit()
    conn.execute("INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)", (admin_user["id"], "update_clinician", f"Updated clinician ID {clinician_id} ({new_name})"))
    conn.commit()
    return ClinicianResponse(id=clinician_id, name=new_name, is_active=new_is_active)

@router.delete("/clinicians/{clinician_id}")
def delete_clinician(clinician_id: int, admin_user: dict = Depends(require_admin), conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT id, name FROM clinicians WHERE id = ?", (clinician_id,))
    existing = cur.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Clinician not found")
    cur.execute("UPDATE clinicians SET is_active = 0 WHERE id = ?", (clinician_id,))
    conn.commit()
    conn.execute("INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)", (admin_user["id"], "delete_clinician", f"Soft deleted clinician ID {clinician_id} ({existing['name']})"))
    conn.commit()
    return {"status": "deleted"}


# Reference Ranges Configuration
@router.get("/reference-ranges", response_model=List[ReferenceRangeResponse])
def get_reference_ranges(conn: sqlite3.Connection = Depends(get_db), current_user: dict = Depends(get_current_user)):
    cur = conn.cursor()
    cur.execute("""
        SELECT id, test_id, parameter_name, age_min, age_max, sex, normal_min, normal_max, critical_min, critical_max, sanity_min, sanity_max, plausible_min, plausible_max, unit
        FROM reference_ranges
        ORDER BY parameter_name ASC, age_min ASC, id ASC
    """)
    return [dict(r) for r in cur.fetchall()]


def _check_range_overlap(conn: sqlite3.Connection, param_name: str, age_min: int, age_max: int, sex: Optional[str], unit: Optional[str] = None, exclude_id: Optional[int] = None):
    cur = conn.cursor()
    query = """
        SELECT id, parameter_name, age_min, age_max, sex, normal_min, normal_max, unit
        FROM reference_ranges
        WHERE LOWER(parameter_name) = LOWER(?)
    """
    params = [param_name.strip()]
    if exclude_id:
        query += " AND id != ?"
        params.append(exclude_id)
        
    cur.execute(query, params)
    rows = cur.fetchall()
    
    overlaps = []
    rule_sex = (sex or "").strip().lower()
    rule_unit = (unit or "").strip().lower()
    for r in rows:
        existing_unit = (r["unit"] or "").strip().lower()
        # Unit-aware check: rules for different units (e.g. mmol/L vs mg/dL) represent distinct scales and are permitted.
        # Only consider overlap if units match (or if either rule has no unit specified).
        if rule_unit and existing_unit and (rule_unit != existing_unit):
            continue

        existing_sex = (r["sex"] or "").strip().lower()
        # Sex condition matches if either is "any"/empty or both match exact
        sex_match = not rule_sex or not existing_sex or (rule_sex == existing_sex)
        if not sex_match:
            continue
            
        r_age_min = r["age_min"] if r["age_min"] is not None else 0
        r_age_max = r["age_max"] if r["age_max"] is not None else 999
        
        # Interval overlap: max(start1, start2) <= min(end1, end2)
        if max(age_min, r_age_min) <= min(age_max, r_age_max):
            sex_desc = r["sex"] if r["sex"] else "Any"
            unit_desc = f" {r['unit']}" if r['unit'] else ""
            overlaps.append(f"Rule #{r['id']} ({sex_desc}, {r_age_min}–{r_age_max} yrs: {r['normal_min']}–{r['normal_max']}{unit_desc})")
            
    return overlaps

@router.post("/reference-ranges", response_model=ReferenceRangeResponse)
def create_reference_range(req: ReferenceRangeCreate, admin_user: dict = Depends(require_admin), conn: sqlite3.Connection = Depends(get_db)):
    param_name = req.parameter_name.strip()
    if not param_name:
        raise HTTPException(status_code=400, detail="Parameter name cannot be empty")
    
    eff_age_min = req.age_min if req.age_min is not None else 0
    eff_age_max = req.age_max if req.age_max is not None else 999
    
    overlaps = _check_range_overlap(conn, param_name, eff_age_min, eff_age_max, req.sex, unit=req.unit)
    if overlaps:
        overlap_details = ", ".join(overlaps)
        raise HTTPException(
            status_code=400,
            detail=f"Age/Sex overlap detected for '{param_name}' with existing interval: {overlap_details}. Please adjust age limits or sex to prevent conflicting evaluation."
        )

    cur = conn.cursor()
    cur.execute("""
        INSERT INTO reference_ranges (test_id, parameter_name, age_min, age_max, sex, normal_min, normal_max, critical_min, critical_max, sanity_min, sanity_max, plausible_min, plausible_max, unit)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (req.test_id, param_name, eff_age_min, eff_age_max, req.sex, req.normal_min, req.normal_max, req.critical_min, req.critical_max, req.sanity_min, req.sanity_max, req.plausible_min, req.plausible_max, req.unit))
    rid = cur.lastrowid
    conn.commit()

    conn.execute("INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)", (admin_user["id"], "create_reference_range", f"Created reference range rule ID {rid} for '{param_name}'"))
    conn.commit()

    return ReferenceRangeResponse(
        id=rid, test_id=req.test_id, parameter_name=param_name,
        age_min=eff_age_min,
        age_max=eff_age_max,
        sex=req.sex, normal_min=req.normal_min, normal_max=req.normal_max,
        critical_min=req.critical_min, critical_max=req.critical_max,
        sanity_min=req.sanity_min, sanity_max=req.sanity_max,
        plausible_min=req.plausible_min, plausible_max=req.plausible_max,
        unit=req.unit
    )


@router.put("/reference-ranges/{range_id}", response_model=ReferenceRangeResponse)
def update_reference_range(range_id: int, req: ReferenceRangeUpdate, admin_user: dict = Depends(require_admin), conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT id, test_id, parameter_name, age_min, age_max, sex, normal_min, normal_max, critical_min, critical_max, sanity_min, sanity_max, plausible_min, plausible_max, unit FROM reference_ranges WHERE id = ?", (range_id,))
    existing = cur.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Reference range not found")

    new_test_id = req.test_id if req.test_id is not None else existing["test_id"]
    new_param = req.parameter_name.strip() if req.parameter_name is not None else existing["parameter_name"]
    new_age_min = req.age_min if req.age_min is not None else existing["age_min"]
    new_age_max = req.age_max if req.age_max is not None else existing["age_max"]
    new_sex = req.sex if req.sex is not None else existing["sex"]
    new_norm_min = req.normal_min if req.normal_min is not None else existing["normal_min"]
    new_norm_max = req.normal_max if req.normal_max is not None else existing["normal_max"]
    new_crit_min = req.critical_min if req.critical_min is not None else existing["critical_min"]
    new_crit_max = req.critical_max if req.critical_max is not None else existing["critical_max"]
    new_sanity_min = req.sanity_min if req.sanity_min is not None else existing["sanity_min"]
    new_sanity_max = req.sanity_max if req.sanity_max is not None else existing["sanity_max"]
    new_plausible_min = req.plausible_min if req.plausible_min is not None else existing["plausible_min"]
    new_plausible_max = req.plausible_max if req.plausible_max is not None else existing["plausible_max"]
    new_unit = req.unit if req.unit is not None else existing["unit"]

    eff_age_min = new_age_min if new_age_min is not None else 0
    eff_age_max = new_age_max if new_age_max is not None else 999

    overlaps = _check_range_overlap(conn, new_param, eff_age_min, eff_age_max, new_sex, unit=new_unit, exclude_id=range_id)
    if overlaps:
        overlap_details = ", ".join(overlaps)
        raise HTTPException(
            status_code=400,
            detail=f"Age/Sex overlap detected for '{new_param}' with existing interval: {overlap_details}. Please adjust age limits or sex to prevent conflicting evaluation."
        )

    cur.execute("""
        UPDATE reference_ranges
        SET test_id = ?, parameter_name = ?, age_min = ?, age_max = ?, sex = ?, normal_min = ?, normal_max = ?, critical_min = ?, critical_max = ?, sanity_min = ?, sanity_max = ?, plausible_min = ?, plausible_max = ?, unit = ?
        WHERE id = ?
    """, (new_test_id, new_param, new_age_min, new_age_max, new_sex, new_norm_min, new_norm_max, new_crit_min, new_crit_max, new_sanity_min, new_sanity_max, new_plausible_min, new_plausible_max, new_unit, range_id))
    conn.commit()

    conn.execute("INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)", (admin_user["id"], "update_reference_range", f"Updated reference range rule ID {range_id} for '{new_param}'"))
    conn.commit()

    return ReferenceRangeResponse(
        id=range_id, test_id=new_test_id, parameter_name=new_param,
        age_min=new_age_min, age_max=new_age_max, sex=new_sex,
        normal_min=new_norm_min, normal_max=new_norm_max,
        critical_min=new_crit_min, critical_max=new_crit_max,
        sanity_min=new_sanity_min, sanity_max=new_sanity_max,
        plausible_min=new_plausible_min, plausible_max=new_plausible_max,
        unit=new_unit
    )


@router.delete("/reference-ranges/{range_id}")
def delete_reference_range(range_id: int, admin_user: dict = Depends(require_admin), conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT id, parameter_name FROM reference_ranges WHERE id = ?", (range_id,))
    existing = cur.fetchone()
    if not existing:
        raise HTTPException(status_code=404, detail="Reference range not found")

    cur.execute("DELETE FROM reference_ranges WHERE id = ?", (range_id,))
    conn.commit()

    conn.execute("INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)", (admin_user["id"], "delete_reference_range", f"Deleted reference range rule ID {range_id} ('{existing['parameter_name']}')"))
    conn.commit()
    return {"status": "deleted"}


@router.get("/facility", response_model=FacilitySettingsResponse)
def get_facility_settings(conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT * FROM facility_settings WHERE id = 1")
    row = cur.fetchone()
    if not row:
        return {
            "id": 1,
            "facility_name": "Ahmadiyya Muslim Hospital",
            "facility_acronym": "AMH",
            "facility_code": "AMH",
            "address": "P.O. Box 2309, Mbale, Uganda",
            "phone": "+256 700 000 000",
            "email": "lab@hospital.org",
            "letterhead_path": None,
            "logo_path": None,
            "updated_at": None
        }
    return dict(row)


@router.put("/facility", response_model=FacilitySettingsResponse)
def update_facility_settings(req: FacilitySettingsUpdate, admin_user: dict = Depends(require_admin), conn: sqlite3.Connection = Depends(get_db)):
    cur = conn.cursor()
    cur.execute("SELECT * FROM facility_settings WHERE id = 1")
    existing = cur.fetchone()
    if not existing:
        cur.execute("""
            INSERT INTO facility_settings (id, facility_name, facility_acronym, facility_code, address, phone, email, letterhead_path, logo_path)
            VALUES (1, 'Ahmadiyya Muslim Hospital', 'AMH', 'AMH', 'P.O. Box 2309, Mbale, Uganda', '+256 700 000 000', 'lab@hospital.org', NULL, NULL)
        """)
        conn.commit()

    updates = []
    params = []
    if req.facility_name is not None:
        updates.append("facility_name = ?")
        params.append(req.facility_name.strip())
    if req.facility_acronym is not None:
        updates.append("facility_acronym = ?")
        params.append(req.facility_acronym.strip().upper())
    if req.facility_code is not None:
        updates.append("facility_code = ?")
        params.append(req.facility_code.strip().upper())
    if req.address is not None:
        updates.append("address = ?")
        params.append(req.address.strip())
    if req.phone is not None:
        updates.append("phone = ?")
        params.append(req.phone.strip())
    if req.email is not None:
        updates.append("email = ?")
        params.append(req.email.strip())
    if req.letterhead_path is not None:
        updates.append("letterhead_path = ?")
        params.append(req.letterhead_path.strip())
    if req.logo_path is not None:
        updates.append("logo_path = ?")
        params.append(req.logo_path.strip())

    if updates:
        updates.append("updated_at = CURRENT_TIMESTAMP")
        cur.execute(f"UPDATE facility_settings SET {', '.join(updates)} WHERE id = 1", tuple(params))
        conn.commit()

        conn.execute("INSERT INTO audit_log (user_id, action, detail) VALUES (?, ?, ?)",
                     (admin_user["id"], "update_facility_settings", f"Updated facility settings: {req.model_dump(exclude_unset=True)}"))
        conn.commit()

    cur.execute("SELECT * FROM facility_settings WHERE id = 1")
    return dict(cur.fetchone())



