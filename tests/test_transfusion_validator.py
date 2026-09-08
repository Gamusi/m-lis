import datetime
import pytest
from backend.app.transfusion_validator import (
    evaluate_blood_group,
    check_biological_compatibility,
    evaluate_crossmatch,
    get_dat_interpretation,
    get_iat_interpretation,
)

def test_blood_group_concordance_o_pos():
    res = evaluate_blood_group(
        anti_a="No Agglutination (-)",
        anti_b="No Agglutination (-)",
        anti_d="Agglutination (+)",
        a1_cells="Agglutination (+)",
        b_cells="Agglutination (+)"
    )
    assert res["is_concordant"] is True
    assert res["consolidated_group"] == "O Rh(D) Positive"
    assert res["discrepancy_reason"] is None

def test_blood_group_concordance_a_neg():
    res = evaluate_blood_group(
        anti_a="Agglutination (+)",
        anti_b="No Agglutination (-)",
        anti_d="No Agglutination (-)",
        a1_cells="No Agglutination (-)",
        b_cells="Agglutination (+)"
    )
    assert res["is_concordant"] is True
    assert res["consolidated_group"] == "A Rh(D) Negative"

def test_blood_group_forward_only_omitted():
    # Reverse typing omitted completely (None)
    res = evaluate_blood_group(
        anti_a="Agglutination (+)",
        anti_b="No Agglutination (-)",
        anti_d="Agglutination (+)",
        a1_cells=None,
        b_cells=None
    )
    assert res["is_concordant"] is True
    assert res["consolidated_group"] == "A Rh(D) Positive"
    assert res["discrepancy_reason"] is None
    assert res["reverse_abo"] is None

def test_blood_group_forward_only_not_done():
    # Reverse typing marked 'Not Done'
    res = evaluate_blood_group(
        anti_a="No Agglutination (-)",
        anti_b="Agglutination (+)",
        anti_d="No Agglutination (-)",
        a1_cells="Not Done",
        b_cells="Not Done (Optional)"
    )
    assert res["is_concordant"] is True
    assert res["consolidated_group"] == "B Rh(D) Negative"
    assert res["discrepancy_reason"] is None

def test_blood_group_discordance():
    # Forward A, Reverse O
    res = evaluate_blood_group(
        anti_a="Agglutination (+)",
        anti_b="No Agglutination (-)",
        anti_d="Agglutination (+)",
        a1_cells="Agglutination (+)",
        b_cells="Agglutination (+)"
    )
    assert res["is_concordant"] is False
    assert res["consolidated_group"] == "Grouping Discrepancy"
    assert "Discrepancy" in res["discrepancy_reason"]

def test_biological_compatibility_prbc_incompatible():
    # Recipient B Neg cannot receive A Pos
    compat = check_biological_compatibility("B Rh(D) Negative", "A Rh(D) Positive", "Packed Red Blood Cells (PRBC)")
    assert compat["is_compatible"] is False
    assert "ABSOLUTE SAFETY BLOCK" in compat["message"]

def test_biological_compatibility_prbc_compatible():
    # Recipient AB Pos can receive O Pos
    compat = check_biological_compatibility("AB Rh(D) Positive", "O Rh(D) Positive", "Packed Red Blood Cells (PRBC)")
    assert compat["is_compatible"] is True

def test_biological_compatibility_rh_incompatible():
    # Rh negative recipient should not receive Rh positive blood
    compat = check_biological_compatibility("O Rh(D) Negative", "O Rh(D) Positive", "Packed Red Blood Cells (PRBC)")
    assert compat["is_compatible"] is False
    assert "Rh" in compat["message"]

def test_crossmatch_expired_unit():
    yesterday = datetime.date.today() - datetime.timedelta(days=1)
    res = evaluate_crossmatch(
        client_name="John Doe",
        client_group="O Rh(D) Positive",
        donor_unit_id="UG-BTS-2026-98715",
        donor_group="O Rh(D) Positive",
        product_type="Packed Red Blood Cells (PRBC)",
        expiry_date=yesterday.strftime("%Y-%m-%d"),
        phase_is="Negative",
        phase_thermophase="Negative",
        phase_ahg="Negative"
    )
    assert res["is_valid"] is False
    assert "EXPIRED" in res["error"]

def test_crossmatch_compatible():
    future_date = datetime.date.today() + datetime.timedelta(days=20)
    res = evaluate_crossmatch(
        client_name="John Doe",
        client_group="O Rh(D) Positive",
        donor_unit_id="UG-BTS-2026-98715",
        donor_group="O Rh(D) Positive",
        product_type="Packed Red Blood Cells (PRBC)",
        expiry_date=future_date.strftime("%Y-%m-%d"),
        phase_is="Negative",
        phase_thermophase="Negative",
        phase_ahg="Negative"
    )
    assert res["is_valid"] is True
    assert res["compatibility_status"] == "COMPATIBLE"
    assert res["release_status"] == "RELEASED FOR INFUSION"
    assert "safe to issue" in res["clinical_summary"]

def test_crossmatch_incompatible_phase_ahg():
    future_date = datetime.date.today() + datetime.timedelta(days=20)
    res = evaluate_crossmatch(
        client_name="John Doe",
        client_group="O Rh(D) Positive",
        donor_unit_id="UG-BTS-2026-98715",
        donor_group="O Rh(D) Positive",
        product_type="Packed Red Blood Cells (PRBC)",
        expiry_date=future_date.strftime("%Y-%m-%d"),
        phase_is="Negative",
        phase_thermophase="Negative",
        phase_ahg="3+"
    )
    assert res["is_valid"] is True
    assert res["compatibility_status"] == "INCOMPATIBLE"
    assert res["release_status"] == "UNSAFE FOR TRANSFUSION"
    assert "CRITICAL" in res["clinical_summary"]
    assert "3+" in res["clinical_summary"]
    assert "AHG/Coombs" in res["clinical_summary"]

def test_dat_interpretation():
    interp = get_dat_interpretation("Positive", "2+", "Polyspecific AHG")
    assert interp["clinical_flag"] == "\u26A0"
    assert "Autoimmune Hemolytic Anemia" in interp["comment"]

def test_iat_interpretation():
    interp = get_iat_interpretation("Positive", {"Cell I": "3+", "Cell II": "Negative", "Cell III": "Negative"})
    assert interp["clinical_flag"] == "\u26A0"
    assert interp["high_risk"] is True
    assert "unexpected red cell alloantibodies" in interp["comment"]
