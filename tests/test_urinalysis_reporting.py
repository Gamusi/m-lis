import pytest
from backend.app.pdf_generator import _clean_urinalysis_name, _build_department_table, _build_transfusion_table
from reportlab.platypus import Paragraph

def test_clean_urinalysis_name_optics():
    assert _clean_urinalysis_name("Pus Cells (WBCs)") == "Pus Cells (/ lpf)"
    assert _clean_urinalysis_name("Red Blood Cells (RBCs)") == "Red Blood Cells (/ lpf)"
    assert _clean_urinalysis_name("Epithelial Cells") == "Epithelial Cells (/ lpf)"
    assert _clean_urinalysis_name("Casts") == "Casts (/ lpf)"
    assert _clean_urinalysis_name("Proteins (Albuminuria Screening)") == "Proteins"

def test_selective_multiparameter_reporting():
    # Only non-empty parameters should be rendered in the table
    test_data = [
        {
            "test_name": "Renal Function Tests (RFTs)",
            "parameters": [
                {"name": "Serum Urea", "result": "4.5", "unit": "mmol/L", "reference_range": "2.5 - 7.8"},
                {"name": "Serum Creatinine", "result": "", "unit": "µmol/L", "reference_range": "62 - 115"},
                {"name": "Serum Potassium (K+)", "result": "None", "unit": "mmol/L", "reference_range": "3.5 - 5.1"},
                {"name": "Serum Sodium (Na+)", "result": "140", "unit": "mmol/L", "reference_range": "135 - 145"}
            ]
        }
    ]
    table = _build_department_table("Clinical Biochemistry", test_data)
    row_texts = []
    for row in table._cellvalues:
        for cell in row:
            if isinstance(cell, Paragraph):
                row_texts.append(cell.text)
            elif isinstance(cell, str):
                row_texts.append(cell)

    assert "Serum Urea" in row_texts
    assert "Serum Sodium (Na+)" in row_texts
    assert "Serum Creatinine" not in row_texts

def test_transfusion_optional_reverse_and_no_donor_subtext():
    # Case 1: No reverse typing done
    tests_no_reverse = [
        {
            "test_name": "ABO & Rh(D) Blood Grouping",
            "result": "O Rh(D) POSITIVE",
            "parameters": [
                {"name": "Forward Anti-A", "result": "Negative (0)"},
                {"name": "Forward Anti-B", "result": "Negative (0)"},
                {"name": "Forward Anti-D", "result": "Positive (4+)"},
                {"name": "Reverse A1-cells", "result": "-"},
                {"name": "Reverse B-cells", "result": "-"}
            ]
        }
    ]
    kt = _build_transfusion_table(tests_no_reverse)
    all_text = " ".join([getattr(f, "text", "") for f in kt._content if hasattr(f, "text")] + 
                        [c.text for f in kt._content if hasattr(f, "_cellvalues") for row in f._cellvalues for c in row if hasattr(c, "text")])
    
    assert "Reverse Typing:" not in all_text
    assert "Donor segments preserved at 2°C - 6°C" not in all_text

    # Case 2: Reverse typing done
    tests_with_reverse = [
        {
            "test_name": "ABO & Rh(D) Blood Grouping",
            "result": "O Rh(D) POSITIVE",
            "parameters": [
                {"name": "Forward Anti-A", "result": "Negative (0)"},
                {"name": "Forward Anti-B", "result": "Negative (0)"},
                {"name": "Forward Anti-D", "result": "Positive (4+)"},
                {"name": "Reverse A1-cells", "result": "Agglutination (4+)"},
                {"name": "Reverse B-cells", "result": "Agglutination (4+)"}
            ]
        }
    ]
    kt2 = _build_transfusion_table(tests_with_reverse)
    all_text2 = " ".join([getattr(f, "text", "") for f in kt2._content if hasattr(f, "text")] + 
                         [c.text for f in kt2._content if hasattr(f, "_cellvalues") for row in f._cellvalues for c in row if hasattr(c, "text")])
    assert "Reverse Typing:" in all_text2
    assert "Donor segments preserved at 2°C - 6°C" not in all_text2
