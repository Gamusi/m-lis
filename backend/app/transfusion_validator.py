"""
Clinical Transfusion Medicine & Immunohematology Validation Engine.
Strictly grounded in ISO 15189:2022 Post-Analytical Quality Requirements,
LMK QMS-M003 Table 2 Laboratory Guidelines, and MLIS-SOP-BTM-V1.
"""

import datetime
from typing import Dict, Any, Optional

def _is_reactive(value: Optional[str]) -> bool:
    if not value:
        return False
    v = value.strip().lower()
    if "no agglutination" in v or v in ["negative", "neg", "-", "nil"]:
        return False
    if "agglutination" in v or "+" in v or "trace" in v or "positive" in v or "pos" in v or "reactive" in v:
        return True
    return False

def _is_omitted(value: Optional[str]) -> bool:
    if not value:
        return True
    v = value.strip().lower()
    return v in ["not done", "not done (omitted)", "not done (optional)", "omitted", "none", "-", "n/a", "na", ""]

def evaluate_blood_group(
    anti_a: Optional[str],
    anti_b: Optional[str],
    anti_d: Optional[str],
    a1_cells: Optional[str] = None,
    b_cells: Optional[str] = None
) -> Dict[str, Any]:
    """
    Evaluates ABO & Rh(D) forward and reverse agglutination concordance.
    Reverse grouping (a1_cells, b_cells) is optional.
    When reverse typing is omitted or marked 'Not Done', consolidated blood group
    is derived directly from forward typing.
    """
    pos_a = _is_reactive(anti_a)
    pos_b = _is_reactive(anti_b)
    pos_d = _is_reactive(anti_d)

    # Derive forward ABO
    if pos_a and not pos_b:
        fwd_abo = "A"
    elif not pos_a and pos_b:
        fwd_abo = "B"
    elif pos_a and pos_b:
        fwd_abo = "AB"
    else:
        fwd_abo = "O"

    rh_str = "Positive" if pos_d else "Negative"

    # If reverse typing is omitted or marked Not Done, forward typing determines consolidated group
    if _is_omitted(a1_cells) and _is_omitted(b_cells):
        return {
            "is_concordant": True,
            "forward_abo": fwd_abo,
            "reverse_abo": None,
            "rh": rh_str,
            "consolidated_group": f"{fwd_abo} Rh(D) {rh_str}",
            "discrepancy_reason": None
        }

    pos_a1 = _is_reactive(a1_cells)
    pos_b_cells = _is_reactive(b_cells)

    # Derive reverse ABO
    # Group A has anti-B (A1-, B+)
    # Group B has anti-A (A1+, B-)
    # Group AB has neither (A1-, B-)
    # Group O has both (A1+, B+)
    if not pos_a1 and pos_b_cells:
        rev_abo = "A"
    elif pos_a1 and not pos_b_cells:
        rev_abo = "B"
    elif not pos_a1 and not pos_b_cells:
        rev_abo = "AB"
    elif pos_a1 and pos_b_cells:
        rev_abo = "O"
    else:
        rev_abo = None

    if fwd_abo == rev_abo:
        return {
            "is_concordant": True,
            "forward_abo": fwd_abo,
            "reverse_abo": rev_abo,
            "rh": rh_str,
            "consolidated_group": f"{fwd_abo} Rh(D) {rh_str}",
            "discrepancy_reason": None
        }
    else:
        reason = f"Grouping Discrepancy detected: Forward typing indicates Group {fwd_abo}, but reverse typing indicates Group {rev_abo}. Manual supervisor resolution required before unit release."
        return {
            "is_concordant": False,
            "forward_abo": fwd_abo,
            "reverse_abo": rev_abo,
            "rh": rh_str,
            "consolidated_group": "Grouping Discrepancy",
            "discrepancy_reason": reason
        }

def _parse_blood_group(group_str: Optional[str]) -> tuple:
    if not group_str:
        return "", ""
    import re
    g = group_str.strip()
    m = re.search(r'\b(AB|A|B|O)\b', g, re.IGNORECASE)
    abo = m.group(1).upper() if m else ""
    g_upper = g.upper()
    rh = "Positive" if ("POS" in g_upper or "+" in g_upper) else ("Negative" if ("NEG" in g_upper or "-" in g_upper) else "")
    return abo, rh

def check_biological_compatibility(
    client_group: Optional[str],
    donor_group: Optional[str],
    product_type: str = "Packed Red Blood Cells (PRBC)"
) -> Dict[str, Any]:
    """
    Enforces biological compatibility between recipient and donor blood groups.
    """
    c_abo, c_rh = _parse_blood_group(client_group)
    d_abo, d_rh = _parse_blood_group(donor_group)

    if not c_abo or not d_abo:
        return {"is_compatible": True, "message": "Client or donor blood group unconfirmed."}

    is_plasma = any(k in product_type.lower() for k in ["plasma", "ffp", "platelet"])

    if is_plasma:
        # Plasma matching logic:
        # AB is universal plasma donor
        plasma_compat = {
            "AB": ["AB"],
            "A": ["A", "AB"],
            "B": ["B", "AB"],
            "O": ["O", "A", "B", "AB"]
        }
        allowed = plasma_compat.get(c_abo, [])
        if d_abo not in allowed:
            return {
                "is_compatible": False,
                "message": f"ABSOLUTE SAFETY BLOCK: Biological plasma incompatibility. Client is Group {client_group}; Donor Unit is Group {donor_group}."
            }
    else:
        # Red cell / whole blood matching logic:
        # O is universal red cell donor
        rbc_compat = {
            "O": ["O"],
            "A": ["A", "O"],
            "B": ["B", "O"],
            "AB": ["AB", "A", "B", "O"]
        }
        allowed = rbc_compat.get(c_abo, [])
        if d_abo not in allowed:
            return {
                "is_compatible": False,
                "message": f"ABSOLUTE SAFETY BLOCK: Biological ABO incompatibility detected. Client is Group {client_group}. Selected Donor Unit is Group {donor_group}. Cross-match is blocked to prevent fatal immediate hemolysis."
            }

        # Rh compatibility: Rh negative client cannot receive Rh positive red cells
        if c_rh == "Negative" and d_rh == "Positive":
            return {
                "is_compatible": False,
                "message": f"ABSOLUTE SAFETY BLOCK: Biological Rh incompatibility detected. Client is Rh(D) Negative. Selected Donor Unit is Rh(D) Positive. Transfusion prohibited to prevent anti-D alloimmunization."
            }

    return {"is_compatible": True, "message": "Biological compatibility confirmed."}

def evaluate_crossmatch(
    client_name: str,
    client_group: Optional[str],
    donor_unit_id: str,
    donor_group: str,
    product_type: str,
    expiry_date: str,
    phase_is: str,
    phase_thermophase: str,
    phase_ahg: str,
    today: Optional[datetime.date] = None
) -> Dict[str, Any]:
    """
    Evaluates unit expiration, biological safety, and multi-phase agglutination reactions.
    """
    today_date = today or datetime.date.today()

    # 1. Expiration check
    try:
        exp = datetime.datetime.strptime(expiry_date[:10], "%Y-%m-%d").date()
        if exp < today_date:
            return {
                "is_valid": False,
                "error": f"Donor unit {donor_unit_id} has EXPIRED on {expiry_date}. Expired blood is strictly prohibited for cross-matching or transfusion."
            }
    except Exception:
        return {
            "is_valid": False,
            "error": f"Invalid unit expiry date format '{expiry_date}'. Use YYYY-MM-DD."
        }

    # 2. Biological compatibility check
    if client_group:
        bio = check_biological_compatibility(client_group, donor_group, product_type)
        if not bio["is_compatible"]:
            return {
                "is_valid": False,
                "error": bio["message"]
            }

    # 3. Phase reaction evaluation
    is_reactive = _is_reactive(phase_is)
    thermo_reactive = _is_reactive(phase_thermophase)
    ahg_reactive = _is_reactive(phase_ahg)

    if not is_reactive and not thermo_reactive and not ahg_reactive:
        c_group_display = client_group or "Documented Group"
        summary = (
            f"Donor Blood Unit {donor_unit_id} (Group {donor_group}, {product_type}) "
            f"is fully COMPATIBLE with Client {client_name} (Group {c_group_display}) across all cross-match phases. "
            f"Blood is safe to issue."
        )
        return {
            "is_valid": True,
            "compatibility_status": "COMPATIBLE",
            "release_status": "RELEASED FOR INFUSION",
            "clinical_summary": summary,
            "failing_phase": None,
            "failing_grade": None
        }
    else:
        # Determine worst / highest reactive phase
        if ahg_reactive:
            failing_phase = "AHG/Coombs"
            failing_grade = phase_ahg
        elif thermo_reactive:
            failing_phase = "37°C Thermophase"
            failing_grade = phase_thermophase
        else:
            failing_phase = "Immediate Spin"
            failing_grade = phase_is

        c_group_display = client_group or "Documented Group"
        summary = (
            f"CRITICAL: Donor Blood Unit {donor_unit_id} (Group {donor_group}, {product_type}) "
            f"is INCOMPATIBLE with Client {client_name} (Group {c_group_display}) due to [{failing_grade}] reaction "
            f"detected in the [{failing_phase}] phase of testing. Blood is UNSAFE for transfusion. DO NOT ISSUE."
        )
        return {
            "is_valid": True,
            "compatibility_status": "INCOMPATIBLE",
            "release_status": "UNSAFE FOR TRANSFUSION",
            "clinical_summary": summary,
            "failing_phase": failing_phase,
            "failing_grade": failing_grade
        }

def get_dat_interpretation(status: str, strength: Optional[str] = None, specificity: Optional[str] = None) -> Dict[str, Any]:
    if status and status.strip().lower() == "positive":
        spec_text = f" ({specificity})" if specificity else ""
        str_text = f" [{strength}]" if strength else ""
        comment = (
            f"Direct Coombs Positive{str_text}{spec_text} indicates in vivo coating of red blood cells. "
            f"Correlates strongly with Autoimmune Hemolytic Anemia (AIHA), Drug-Induced Hemolysis, "
            f"or Hemolytic Disease of the Newborn (HDN) if performed on cord blood."
        )
        return {
            "clinical_flag": "\u26A0",
            "comment": comment
        }
    return {
        "clinical_flag": "",
        "comment": "Direct Coombs Negative: No in vivo red cell sensitization detected."
    }

def get_iat_interpretation(status: str, cell_results: Optional[Dict[str, str]] = None) -> Dict[str, Any]:
    if status and status.strip().lower() == "positive":
        comment = (
            "Indirect Coombs Positive indicates circulating unexpected red cell alloantibodies "
            "(e.g., anti-D, anti-K, anti-Fya) in the client's serum. Immediate major cross-matching "
            "using a 3-phase Coombs/AHG protocol is required to find antigen-negative donor blood."
        )
        return {
            "clinical_flag": "\u26A0",
            "high_risk": True,
            "comment": comment
        }
    return {
        "clinical_flag": "",
        "high_risk": False,
        "comment": "Indirect Coombs Negative: No unexpected circulating red cell antibodies detected."
    }
