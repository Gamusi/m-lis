import pytest
import sqlite3
from backend.app.database import SCHEMA_SQL
from backend.app.seed import seed_reference_ranges
from backend.app.biochem_validator import validate_biochem_parameter, validate_panel_consistency

@pytest.fixture
def db_conn():
    conn = sqlite3.connect(":memory:", check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA_SQL)
    cur = conn.cursor()
    seed_reference_ranges(cur)
    conn.commit()
    yield conn
    conn.close()

def test_validate_potassium_within_sanity(db_conn):
    res = validate_biochem_parameter(db_conn, "Serum Potassium (K+)", "4.8", age=30, sex="Male", unit="mmol/L")
    assert res["flag"] is None
    assert res["is_abnormal"] is False

def test_validate_potassium_critical_high(db_conn):
    res = validate_biochem_parameter(db_conn, "Serum Potassium (K+)", "6.5", age=30, sex="Male", unit="mmol/L")
    assert res["flag"] == "H*"
    assert res["is_abnormal"] is True

def test_validate_potassium_breaches_sanity_limits(db_conn):
    with pytest.raises(ValueError) as exc_info:
        validate_biochem_parameter(db_conn, "Serum Potassium (K+)", "14.5", age=30, sex="Male", unit="mmol/L")
    assert "breaches physiological sanity limits" in str(exc_info.value)

def test_validate_potassium_breaches_sanity_floor(db_conn):
    with pytest.raises(ValueError) as exc_info:
        validate_biochem_parameter(db_conn, "Serum Potassium (K+)", "0.5", age=30, sex="Male", unit="mmol/L")
    assert "breaches physiological sanity limits" in str(exc_info.value)

def test_dynamic_sanity_limit_update(db_conn):
    # Admin updates sanity_max for Potassium to 8.0
    cur = db_conn.cursor()
    cur.execute("UPDATE reference_ranges SET sanity_max = 8.0 WHERE parameter_name = 'Serum Potassium (K+)'")
    db_conn.commit()

    # Now 9.0 should breach sanity
    with pytest.raises(ValueError) as exc_info:
        validate_biochem_parameter(db_conn, "Serum Potassium (K+)", "9.0", age=30, sex="Male", unit="mmol/L")
    assert "breaches physiological sanity limits" in str(exc_info.value)

def test_dual_unit_glucose_validation(db_conn):
    # FBS in mmol/L
    res_mmol = validate_biochem_parameter(db_conn, "FBS (Fasting Blood Sugar)", "8.5", age=45, sex="Female", unit="mmol/L")
    assert res_mmol["is_abnormal"] is True
    assert res_mmol["flag"] in ["H", "H*"]

    # FBS in mg/dL normal
    res_mg_normal = validate_biochem_parameter(db_conn, "FBS (Fasting Blood Sugar)", "85.0", age=45, sex="Female", unit="mg/dL")
    assert res_mg_normal["flag"] is None

    # FBS in mg/dL diabetic
    res_mg_diabetic = validate_biochem_parameter(db_conn, "FBS (Fasting Blood Sugar)", "140.0", age=45, sex="Female", unit="mg/dL")
    assert res_mg_diabetic["is_abnormal"] is True

    # FBS in mg/dL breaches sanity
    with pytest.raises(ValueError) as exc_info:
        validate_biochem_parameter(db_conn, "FBS (Fasting Blood Sugar)", "1200.0", age=45, sex="Female", unit="mg/dL")
    assert "breaches physiological sanity limits" in str(exc_info.value)

def test_cross_analyte_bilirubin_consistency():
    # Direct Bili > Total Bili should raise ValueError
    param_map = {
        "Total Bilirubin": (10.0, "µmol/L"),
        "Direct Bilirubin": (15.0, "µmol/L")
    }
    with pytest.raises(ValueError) as exc_info:
        validate_panel_consistency(param_map)
    assert "Direct (Conjugated) Bilirubin cannot exceed Total Bilirubin" in str(exc_info.value)

    # Valid Bilirubin
    param_map_valid = {
        "Total Bilirubin": (15.0, "µmol/L"),
        "Direct Bilirubin": (3.5, "µmol/L")
    }
    validate_panel_consistency(param_map_valid)

def test_cross_analyte_lipid_consistency():
    # LDL > Total Chol should raise ValueError
    param_map = {
        "Total Cholesterol": (4.5, "mmol/L"),
        "LDL Cholesterol": (5.0, "mmol/L")
    }
    with pytest.raises(ValueError) as exc_info:
        validate_panel_consistency(param_map)
    assert "LDL Cholesterol cannot exceed Total Cholesterol" in str(exc_info.value)

def test_cross_analyte_ckmb_consistency():
    # CK-MB > Total CK should raise ValueError
    param_map = {
        "Total CK (Creatine Kinase)": (100.0, "U/L"),
        "CK-MB (Creatine Kinase-MB)": (150.0, "U/L")
    }
    with pytest.raises(ValueError) as exc_info:
        validate_panel_consistency(param_map)
    assert "CK-MB fraction cannot exceed Total CK activity" in str(exc_info.value)

def test_cross_analyte_edta_contamination():
    # Potassium > 10.0 and Calcium < 0.5 mmol/L
    param_map = {
        "Serum Potassium (K+)": (11.0, "mmol/L"),
        "Total Calcium (Ca2+)": (0.3, "mmol/L")
    }
    with pytest.raises(ValueError) as exc_info:
        validate_panel_consistency(param_map)
    assert "EDTA tube contamination detected" in str(exc_info.value)

def test_creatinine_and_lft_validation_by_unit(db_conn):
    # 4.8 mg/dL is elevated but valid physiologically (bounds: 0.17–28.28 mg/dL)
    res_mg = validate_biochem_parameter(db_conn, "Serum Creatinine", "4.8", age=42, sex="Male", unit="mg/dL")
    assert res_mg["flag"] in ["H", "H*"]
    assert res_mg["is_abnormal"] is True

    # 4.8 umol/L is an improbable sanity violation (sanity bounds: 15–2500 umol/L)
    with pytest.raises(ValueError) as exc_info:
        validate_biochem_parameter(db_conn, "Serum Creatinine", "4.8", age=42, sex="Male", unit="µmol/L")
    assert "breaches physiological sanity limits" in str(exc_info.value)

