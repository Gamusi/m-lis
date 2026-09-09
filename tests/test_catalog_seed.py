import pytest
import sqlite3
from backend.app.database import SCHEMA_SQL
from backend.app.seed import TESTS, SECTIONS, seed_database
from backend.app.database import get_connection, init_db

def test_qualitative_and_semi_qualitative_tests_tracking_configuration():
    # Verify seed definitions in TESTS dictionary
    for t in TESTS:
        if t.get("parent_name"):
            continue
        name = t["name"]
        res_type = t["result_type"]
        is_tracked = bool(t["is_tracked"])
        
        # Binary / Infectious assays must be tracked
        if name in ("Malaria RDT", "HBsAg (Hepatitis B)", "HIV Testing", "HIV Testing Service", "HIV (MoH Three-Test Algorithm)", "TB LAM (Urine Tuberculosis LAM)", "COVID19RDT", "CrAg (Cryptococcal Antigen)", "HCV Ab (Hepatitis C)", "TPHA (Confirmatory Syphilis Test)"):
            assert is_tracked is True, f"{name} must be tracked"
            assert res_type in ("qualitative", "options", "panel")

        # Standard biochemistry panels tracking configuration
        if name in ("LFTS", "RFTS", "CARDIAC", "ELECTROLYTES"):
            assert is_tracked is True, f"Panel {name} must be tracked"

        # Surveillance glucometry and composite panels must be tracked
        if name in ("CBC", "URINALYSIS", "STOOL ANALYSIS", "FBS (Fasting Blood Sugar)", "RBS (Random Blood Sugar)"):
            assert is_tracked is True, f"{name} must be tracked"


def test_urinalysis_seed_subparameters():
    from backend.app.seed import PANELS
    ua_children = [t for t in TESTS if t.get("parent_name") == "URINALYSIS"]
    assert len(ua_children) == 17
    assert len(PANELS["URINALYSIS"]) == 17

    # Check Macroscopy (sort_order 1-2)
    macro = [t for t in ua_children if t["sort_order"] in (1, 2)]
    assert len(macro) == 2
    assert {t["name"] for t in macro} == {"Color", "Turbidity"}

    # Check Microscopy (sort_order 3-7)
    micro = [t for t in ua_children if 3 <= t["sort_order"] <= 7]
    assert len(micro) == 5
    assert {t["name"] for t in micro} == {
        "Pus Cells (WBCs)", "Red Blood Cells (RBCs)", "Epithelial Cells", "Casts", "Crystals"
    }
    # Check Dipstick (sort_order 8-17)
    dip = [t for t in ua_children if 8 <= t["sort_order"] <= 17]
    assert len(dip) == 10
    dip_names = {t["name"] for t in dip}
    assert "Specific Gravity (S.G)" in dip_names
    assert "PH" in dip_names
    assert "Proteins" in dip_names
    assert "Glucose" in dip_names
    assert "Bilirubin" in dip_names
    assert "Ketones" in dip_names
    assert "Blood" in dip_names
    assert "Nitrate" in dip_names
    assert "Leukocyte Esterase" in dip_names

def test_culture_and_sensitivity_catalog_entries():
    from backend.app.seed import TESTS
    cs_tests = [t for t in TESTS if "Culture & Sensitivity" in t["name"] or "C&S" in t["name"]]
    names = {t["name"] for t in cs_tests}
    assert "Urine Culture & Sensitivity (C&S)" in names
    assert "Blood Culture & Sensitivity (C&S)" in names
    assert "CSF & Sterile Fluid Culture & Sensitivity (C&S)" in names
    for t in cs_tests:
        assert t["result_type"] == "culture_panel"


def test_reference_ranges_schema_and_clinical_flag_column(db_connection):
    cur = db_connection.cursor()
    
    # Check test_results has clinical_flag
    cur.execute("PRAGMA table_info(test_results)")
    cols = [r["name"] for r in cur.fetchall()]
    assert "clinical_flag" in cols

    # Check reference_ranges table exists and has sanity columns
    cur.execute("PRAGMA table_info(reference_ranges)")
    cols_rr = [r["name"] for r in cur.fetchall()]
    assert "parameter_name" in cols_rr
    assert "normal_min" in cols_rr
    assert "critical_min" in cols_rr
    assert "sanity_min" in cols_rr
    assert "sanity_max" in cols_rr
    assert "plausible_min" in cols_rr
    assert "plausible_max" in cols_rr

def test_biochemistry_panels_seeded_reference_ranges(db_connection):
    from backend.app.seed import seed_reference_ranges
    cur = db_connection.cursor()
    seed_reference_ranges(cur)
    # Check Potassium has sanity limits
    cur.execute("SELECT normal_min, normal_max, sanity_min, sanity_max, unit FROM reference_ranges WHERE parameter_name = 'Serum Potassium (K+)' AND unit = 'mmol/L'")
    k_row = cur.fetchone()
    assert k_row is not None
    assert k_row["sanity_min"] == 1.0
    assert k_row["sanity_max"] == 12.0

    # Check Glucose has dual units seeded
    cur.execute("SELECT normal_min, normal_max, sanity_min, sanity_max, unit FROM reference_ranges WHERE parameter_name = 'FBS (Fasting Blood Sugar)' AND unit = 'mg/dL'")
    fbs_mg = cur.fetchone()
    assert fbs_mg is not None
    assert fbs_mg["sanity_min"] == 18.0
    assert fbs_mg["sanity_max"] == 900.0


def test_hiv_testing_catalog_seeding(db_connection):
    import json
    from backend.app.seed import seed_database
    seed_database(conn=db_connection)
    cur = db_connection.cursor()

    cur.execute("SELECT id FROM tests WHERE name IN ('HIV Testing', 'HIV Testing Service')")
    hiv_row = cur.fetchone()
    assert hiv_row is not None
    hiv_id = hiv_row["id"]

    cur.execute("SELECT parameter_name, options FROM test_parameters WHERE test_id = ?", (hiv_id,))
    params = {r["parameter_name"]: json.loads(r["options"]) if r["options"] else [] for r in cur.fetchall()}

    assert "MHS HIV 1/2 Kwiq Test" in params
    assert "Determine™ HIV-1/2" in params or "Determine" in params
    assert "HIV 1/2 Stat-Pak®" in params or "Stat-Pak" in params
    assert "SD Bioline HIV-1/2" in params or "SD Bioline" in params
    assert any("OraQuick" in p for p in params)
    assert len(params) == 6

    # Verify EID tests are independent tests, not part of the algorithm
    cur.execute("SELECT name FROM tests WHERE name LIKE 'EID %' AND parent_rollup_id IS NULL")
    eid_tests = [r[0] for r in cur.fetchall()]
    assert "EID 1st PCR (4-6 Weeks)" in eid_tests
    assert "EID 2nd PCR (9 Months)" in eid_tests
    assert "EID Final Rapid Test (18 Months)" in eid_tests



def test_widal_structured_antigen_parameters(db_connection):
    import json
    from backend.app.seed import seed_database
    seed_database(conn=db_connection)
    cur = db_connection.cursor()

    cur.execute("SELECT id FROM tests WHERE name LIKE '%WIDAL%'")
    widal_row = cur.fetchone()
    assert widal_row is not None
    widal_id = widal_row["id"]

    cur.execute("SELECT parameter_name, options FROM test_parameters WHERE test_id = ? ORDER BY sort_order", (widal_id,))
    widal_params = cur.fetchall()
    assert len(widal_params) == 4
    names = [r["parameter_name"] for r in widal_params]
    assert any("TO" in n or "O Antigen" in n for n in names)
    assert any("TH" in n or "H Antigen" in n for n in names)

    opts = json.loads(widal_params[0]["options"])
    assert "Not Done" in opts
    assert any("1:80" in o for o in opts)
    assert any("1:160" in o for o in opts)

def test_specimen_types_seeding(db_connection):
    from backend.app.seed import seed_database, SPECIMEN_TYPES
    seed_database(conn=db_connection)
    cur = db_connection.cursor()

    cur.execute("SELECT id, name, container, min_volume FROM specimen_types ORDER BY sort_order")
    rows = cur.fetchall()
    assert len(rows) == len(SPECIMEN_TYPES)
    names = [r["name"] for r in rows]
    assert "EDTA Whole Blood" in names
    assert "Blood (for Culture)" in names
    assert "Serum (Red Top)" in names
    assert "Clean-Catch Midstream Urine" in names
    assert "Random Stool / Feces" in names
    assert "Cerebrospinal Fluid (CSF)" in names

def test_malaria_microscopy_parameters_seeding(db_connection):
    import json
    from backend.app.seed import seed_database
    seed_database(conn=db_connection)
    cur = db_connection.cursor()

    cur.execute("SELECT id FROM tests WHERE name = 'Blood smear for Malaria Parasites'")
    mal_row = cur.fetchone()
    assert mal_row is not None
    mal_id = mal_row["id"]

    cur.execute("SELECT id FROM tests WHERE name = 'ZN Staining For AFBs'")
    assert cur.fetchone() is not None

    cur.execute("SELECT parameter_name, options FROM test_parameters WHERE test_id = ? ORDER BY sort_order", (mal_id,))
    params = cur.fetchall()
    assert len(params) == 3
    names = [p["parameter_name"] for p in params]
    assert "Examination Method / Film Done" in names
    assert "Parasite Density (Thick Film)" in names
    assert "Species Identification (Thin Smear)" in names

    density_opts = json.loads(params[1]["options"])
    assert "No malaria parasites seen" in density_opts
    assert "1+ (1-10 parasites per 100 thick-film fields)" in density_opts
    assert "4+ (>10 parasites per single thick-film field)" in density_opts

    species_opts = json.loads(params[2]["options"])
    assert species_opts[0] == "Not Done"
    assert "Plasmodium falciparum" in species_opts
    assert "Plasmodium vivax" in species_opts

def test_rft_panel_and_standalone_uric_acid(db_connection):
    from backend.app.seed import seed_database
    seed_database(conn=db_connection)
    cur = db_connection.cursor()
    cur.execute("SELECT id FROM tests WHERE name = 'RFTS'")
    rft_id = cur.fetchone()[0]
    cur.execute("SELECT parameter_name FROM test_parameters WHERE test_id = ?", (rft_id,))
    rft_params = [r[0] for r in cur.fetchall()]
    assert "Serum Potassium (K+)" in rft_params
    assert "Serum Sodium (Na+)" in rft_params
    assert "Serum Chloride (Cl-)" in rft_params
    assert "Serum Creatinine" in rft_params
    assert "Serum Urea" in rft_params
    assert "Serum Uric Acid" in rft_params

    # Check standalone Uric Acid
    cur.execute("SELECT id, result_type FROM tests WHERE name = 'Serum Uric Acid' AND parent_rollup_id IS NULL")
    row = cur.fetchone()
    assert row is not None
    assert row[1] == "quantitative"


