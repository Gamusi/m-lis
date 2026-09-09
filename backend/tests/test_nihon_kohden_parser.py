import os
import glob
import pytest
from backend.app.parsers.nihon_kohden import parse_nihon_kohden_output, CBC_PARAMETER_DEFINITIONS

SAMPLE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "docs", "sample_outputs", "nihonsamples")
REF_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "docs", "reference", "REPORT TEMPLATE")

def test_nihon_parser_sample_111():
    path = os.path.join(SAMPLE_DIR, "111.txt")
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    res = parse_nihon_kohden_output(content)
    assert res["status"] == "success"
    assert res["sample_id"] == "0002541"
    assert res["timestamp"] == "2026-09-09 12:19:17"
    assert len(res["parameters"]) == 22
    wbc = res["parameters"][0]
    assert wbc["name"] == "Total WBC Count (White Blood Cells)"
    assert wbc["value"] == "7.4"
    assert wbc["reference_range"] == "4.0 - 9.0"
    neut_pct = res["parameters"][1]
    assert neut_pct["name"] == "Neutrophils (%) [Relative Count]"
    assert neut_pct["value"] == "45.0"
    assert neut_pct["flag"] == "*"
    pdw = res["parameters"][21]
    assert pdw["name"] == "PLT Distribution Width (PDW)"
    assert pdw["value"] == "18.1"
    assert pdw["flag"] == "H"
    assert pdw["reference_range"] == "15.0 - 17.0"

def test_nihon_parser_sample_666_alphabetic_remark():
    path = os.path.join(SAMPLE_DIR, "666.txt")
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    res = parse_nihon_kohden_output(content)
    assert res["status"] == "success"
    assert res["sample_id"] == "0002536"
    assert res["timestamp"] == "2026-09-09 08:50:50"
    assert len(res["parameters"]) == 22
    wbc = res["parameters"][0]
    assert wbc["value"] == "5.1"
    assert wbc["reference_range"] == "4.0 - 9.0"

def test_nihon_parser_sample_777_split_header():
    path = os.path.join(SAMPLE_DIR, "777.txt")
    with open(path, "r", encoding="utf-8", errors="ignore") as f:
        content = f.read()
    res = parse_nihon_kohden_output(content)
    assert res["status"] == "success"
    assert res["sample_id"] == "0002534"
    assert res["timestamp"] == "2026-09-08 16:53:15"
    assert len(res["parameters"]) == 22
    wbc = res["parameters"][0]
    assert wbc["value"] == "11.6"
    assert wbc["flag"] == "*"
    assert wbc["reference_range"] == "4.0 - 9.0"

def test_nihon_parser_all_sample_files():
    files = glob.glob(os.path.join(SAMPLE_DIR, "*.txt")) + glob.glob(os.path.join(REF_DIR, "*.txt"))
    assert len(files) >= 9
    for file_path in files:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
        res = parse_nihon_kohden_output(content)
        filename = os.path.basename(file_path)
        assert res["status"] == "success", f"Failed parsing {filename}: {res.get('detail')}"
        assert res["sample_id"] and res["sample_id"] != "UNKNOWN", f"Missing sample_id in {filename}"
        assert res["timestamp"], f"Missing timestamp in {filename}"
        assert len(res["parameters"]) == 22, f"Expected 22 params in {filename}, got {len(res['parameters'])}"
        wbc_val = res["parameters"][0]["value"]
        assert wbc_val not in ["57", "58", "60", "61", "62", "63", "102", "134"], f"Operator code leaked into WBC in {filename}: {wbc_val}"
        assert res["parameters"][0]["reference_range"] == "4.0 - 9.0", f"EXP reference range missing in {filename}"
