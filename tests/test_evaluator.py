import pytest
import datetime
from backend.app.evaluator import evaluate_result

def test_evaluator_wbc_child_normal():
    dob = datetime.date(2015, 1, 1)
    entry_date = datetime.date(2025, 1, 1) # age 10
    res = evaluate_result("WBC", "10.0", dob, "Male", entry_date)
    assert res["unit"] in ["10^3/uL", "10³/µL"]
    assert res["reference"] == "6.0 - 14.0"
    assert res["flag"] is None
    assert res["is_abnormal"] is False

def test_evaluator_wbc_child_high():
    dob = datetime.date(2015, 1, 1)
    entry_date = datetime.date(2025, 1, 1) # age 10
    res = evaluate_result("WBC", "15.0", dob, "Male", entry_date)
    assert res["flag"] == "H"
    assert res["is_abnormal"] is True

def test_evaluator_hb_female_low():
    dob = datetime.date(1990, 1, 1)
    entry_date = datetime.date(2025, 1, 1) # age 35
    # Verify a 35-year-old female with Hb 10.0 gets flagged as L
    res = evaluate_result("Hemoglobin (Hb)", "10.0", dob, "Female", entry_date)
    assert res["reference"] == "12.0 - 15.5"
    assert res["flag"] == "L"
    assert res["is_abnormal"] is True

def test_evaluator_hb_male_critical():
    dob = datetime.date(1990, 1, 1)
    entry_date = datetime.date(2025, 1, 1) # age 35
    # Verify an adult male with Hb 7.5 gets flagged as L* (Critical Low)
    res = evaluate_result("Hemoglobin (Hb)", "7.5", dob, "Male", entry_date)
    assert res["reference"] == "13.5 - 17.5"
    assert res["flag"] == "L*"
    assert res["is_abnormal"] is True

def test_evaluator_fbs_high():
    dob = datetime.date(1990, 1, 1)
    entry_date = datetime.date(2025, 1, 1)
    res = evaluate_result("Fasting Blood Sugar (FBS)", "6.0", dob, "Male", entry_date)
    assert res["flag"] == "H"
    assert res["is_abnormal"] is True

def test_evaluator_non_numeric():
    dob = datetime.date(1990, 1, 1)
    entry_date = datetime.date(2025, 1, 1)
    # Ensure it handles non-qualitative unparseable strings gracefully
    res = evaluate_result("WBC", "N/A", dob, "Male", entry_date)
    assert res["flag"] is None
    assert res["is_abnormal"] is False
    assert res["reference"] == "4.0 - 11.0"

def test_evaluator_qualitative_caution():
    dob = datetime.date(1990, 1, 1)
    entry_date = datetime.date(2025, 1, 1)
    res = evaluate_result("Malaria RDT", "Positive", dob, "Male", entry_date)
    assert res["flag"] == "\u26A0"
    assert res["is_abnormal"] is True

def test_evaluator_urinalysis_qualitative_flags():
    dob = datetime.date(1990, 1, 1)
    entry_date = datetime.date(2025, 1, 1)

    # Normal Nil / Negative
    res_prot_nil = evaluate_result("Proteins", "Nil", dob, "Male", entry_date)
    assert res_prot_nil["flag"] is None
    assert res_prot_nil["is_abnormal"] is False

    res_nit_neg = evaluate_result("Nitrate", "Negative", dob, "Male", entry_date)
    assert res_nit_neg["flag"] is None

    # Abnormal findings
    res_prot_2plus = evaluate_result("Proteins", "2+ (100 mg/dL)", dob, "Male", entry_date)
    assert res_prot_2plus["flag"] == "\u26A0"
    assert res_prot_2plus["is_abnormal"] is True

    res_glu_trace = evaluate_result("Glucose", "Trace (100 mg/dL)", dob, "Male", entry_date)
    assert res_glu_trace["flag"] == "\u26A0"

    res_nit_pos = evaluate_result("Nitrate", "Positive", dob, "Male", entry_date)
    assert res_nit_pos["flag"] == "\u26A0"

    res_bld_3plus = evaluate_result("Blood", "3+ (Large)", dob, "Male", entry_date)
    assert res_bld_3plus["flag"] == "\u26A0"

    res_pus_high = evaluate_result("Pus Cells (WBCs)", "10-15 / lpf", dob, "Male", entry_date)
    assert res_pus_high["flag"] == "\u26A0"

def test_evaluator_color_and_turbidity_rules():
    dob = datetime.date(1990, 1, 1)
    entry_date = datetime.date(2025, 1, 1)

    # Turbidity: Clear & Slightly Turbid normal, Turbid flagged
    for val in ["Clear", "Slightly Turbid"]:
        res = evaluate_result("Turbidity", val, dob, "Male", entry_date)
        assert res["flag"] is None
        assert res["is_abnormal"] is False

    res_turbid = evaluate_result("Turbidity", "Turbid", dob, "Male", entry_date)
    assert res_turbid["flag"] == "\u26A0"
    assert res_turbid["is_abnormal"] is True

    # Color: Yellow normal, all others flagged
    res_yellow = evaluate_result("Color", "Yellow", dob, "Male", entry_date)
    assert res_yellow["flag"] is None
    assert res_yellow["is_abnormal"] is False

    for val in ["Straw", "Amber", "Red", "Brown"]:
        res = evaluate_result("Color", val, dob, "Male", entry_date)
        assert res["flag"] == "\u26A0"
        assert res["is_abnormal"] is True

def test_non_cbc_hematology_evaluator():
    dob = datetime.date(1990, 1, 1)
    entry_date = datetime.date(2025, 1, 1) # age 35

    # ESR elevated
    res_esr = evaluate_result("E.S.R (Erythrocyte Sedimentation Rate)", "45", dob, "Male", entry_date)
    assert res_esr["flag"] == "H"
    assert res_esr["is_abnormal"] is True

    # PT elevated
    res_pt = evaluate_result("Prothrombin Time (PT)", "18.5", dob, "Female", entry_date)
    assert res_pt["flag"] == "H"
    assert res_pt["is_abnormal"] is True

    # INR elevated
    res_inr = evaluate_result("International Normalized Ratio (INR)", "2.8", dob, "Male", entry_date)
    assert res_inr["flag"] == "H"
    assert res_inr["is_abnormal"] is True

