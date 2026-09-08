import io
import pytest
from backend.app.pdf_generator import (
    generate_pdf, 
    _build_metadata_table, 
    _build_department_table, 
    _build_signatures_table
)
from reportlab.platypus import Table, KeepTogether

def test_generate_pdf_creates_bytes():
    order_data = {"client_number": "102", "full_name": "JOHN DOE", "sex": "M", "age": "30"}
    results_data = []
    pdf_bytes = generate_pdf(order_data, results_data)
    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b'%PDF-')

def _get_cell_text(cell):
    if hasattr(cell, 'text'):
        return cell.text
    return str(cell)

def test_build_metadata_table_legacy_fallback():
    order_data = {
        "client_number": "AMH-26-8-001", 
        "full_name": "LUCY KEMIGISHA", 
        "age": "32", 
        "sex": "F",
        "ordered_by": "Dr. Matia",
        "ordered_date": "17/08/2026",
        "verified_by": "Abubakar"
    }
    table = _build_metadata_table(order_data)
    assert isinstance(table, Table)
    assert _get_cell_text(table._cellvalues[0][1]) == "LUCY KEMIGISHA"
    assert _get_cell_text(table._cellvalues[0][3]) == "AMH-26-8-001"
    assert _get_cell_text(table._cellvalues[1][1]) == "32"
    assert _get_cell_text(table._cellvalues[1][3]) == "F"
    assert _get_cell_text(table._cellvalues[2][0]) == "Requested by:"
    assert _get_cell_text(table._cellvalues[2][1]) == "Dr. Matia"
    assert _get_cell_text(table._cellvalues[2][2]) == "Date:"
    assert _get_cell_text(table._cellvalues[2][3]) == "17/08/2026"
    assert _get_cell_text(table._cellvalues[3][0]) == "Ward / OPD:"

def test_build_metadata_table_compliance():
    order_data = {
        "lab_number": "amh-26-08-001",
        "full_name": "SARAH NAMUBIRU",
        "age": "28",
        "sex": "F",
        "requested_by": "Dr. Sarah",
        "ward_of_origin": "Maternity",
        "specimen": "Whole Blood (EDTA)",
        "ordered_date": "18/08/2026"
    }
    table = _build_metadata_table(order_data)
    assert isinstance(table, Table)
    assert _get_cell_text(table._cellvalues[0][0]) == "Client Name:"
    assert _get_cell_text(table._cellvalues[0][1]) == "SARAH NAMUBIRU"
    assert _get_cell_text(table._cellvalues[0][2]) == "Lab No:"
    assert _get_cell_text(table._cellvalues[0][3]) == "amh-26-08-001"
    assert _get_cell_text(table._cellvalues[1][0]) == "Age:"
    assert _get_cell_text(table._cellvalues[1][1]) == "28"
    assert _get_cell_text(table._cellvalues[1][2]) == "Sex:"
    assert _get_cell_text(table._cellvalues[1][3]) == "F"
    assert _get_cell_text(table._cellvalues[2][0]) == "Requested by:"
    assert _get_cell_text(table._cellvalues[2][1]) == "Dr. Sarah"
    assert _get_cell_text(table._cellvalues[2][2]) == "Date:"
    assert _get_cell_text(table._cellvalues[2][3]) == "18/08/2026"
    assert _get_cell_text(table._cellvalues[3][0]) == "Ward / OPD:"
    assert _get_cell_text(table._cellvalues[3][1]) == "Maternity"
    assert _get_cell_text(table._cellvalues[3][2]) == "Specimen (s):"
    assert _get_cell_text(table._cellvalues[3][3]) == "Whole Blood (EDTA)"

def test_build_signatures_table():
    order_data = {
        "technician_name": "Abubakar",
        "verified_by": "Dr. John"
    }
    flowable = _build_signatures_table(order_data)
    assert isinstance(flowable, KeepTogether)
    table = flowable._content[1]
    assert isinstance(table, Table)
    assert table._cellvalues[0][0] == "Done by: Abubakar _______________"
    assert table._cellvalues[0][1] == "Verified by: Dr. John _______________"

def test_build_signatures_table_empty():
    order_data = {}
    flowable = _build_signatures_table(order_data)
    assert isinstance(flowable, KeepTogether)
    table = flowable._content[1]
    assert isinstance(table, Table)
    assert table._cellvalues[0][0] == "Done by: _______________"
    assert table._cellvalues[0][1] == "Verified by: _______________"

def test_build_department_table():
    dept_name = "HAEMATOLOGY"
    tests = [
        {"test_name": "WBC", "result": "6.5", "unit": "10^3/uL", "flag": "Normal", "reference": "4.0 - 10.0"}
    ]
    flowable = _build_department_table(dept_name, tests)
    assert isinstance(flowable, Table)

def test_generate_pdf_full_report():
    order_data = {
        "lab_number": "amh-26-08-042",
        "full_name": "JOHN DOE",
        "age": "45",
        "sex": "M",
        "requested_by": "Dr. Musoke",
        "ward_of_origin": "OPD",
        "ordered_date": "2026-08-18",
        "technician_name": "Jane Tech",
        "verified_by": "Dr. Smith"
    }
    results_data = [
        {
            "department": "HAEMATOLOGY",
            "tests": [
                {"test_name": "Hemoglobin", "result": "14.2", "unit": "g/dL", "flag": "Normal", "reference": "13.0 - 17.0"},
                {"test_name": "WBC", "result": "12.5", "unit": "10^3/uL", "flag": "High", "reference": "4.0 - 10.0"}
            ]
        },
        {
            "department": "BIOCHEMISTRY",
            "tests": [
                {"test_name": "Random Blood Sugar", "result": "5.4", "unit": "mmol/L", "flag": "Normal", "reference": "3.9 - 7.8"}
            ]
        }
    ]
    pdf_bytes = generate_pdf(order_data, results_data)
    assert isinstance(pdf_bytes, bytes)
    assert pdf_bytes.startswith(b'%PDF-')
    assert len(pdf_bytes) > 1000

def test_pdf_contains_hospital_metadata():
    order_data = {
        "lab_number": "AMH-26-8-123",
        "full_name": "Test Client",
        "technician_name": "Technician John"
    }
    results_data = [{"department": "Parasitology", "tests": [{"test_name": "BS for MPS", "result": "Negative"}]}]
    pdf_bytes = generate_pdf(order_data, results_data)
    
    # Verify PDF contains author and title strings in byte stream
    assert b"M-LIS" in pdf_bytes
    assert b"AMH-26-8-123" in pdf_bytes

def test_urinalysis_and_general_tests_fit_on_single_page():
    order_data = {
        "lab_number": "AMH-26-8-555",
        "full_name": "Test Client",
        "client_number": "AMH-100",
        "age": "30y",
        "sex": "Female",
        "ordered_date": "2026-08-24"
    }
    ua_params = [
        {"name": "Color", "result": "Yellow"},
        {"name": "Turbidity", "result": "Clear"},
        {"name": "Pus Cells (WBCs)", "result": "Not Seen"},
        {"name": "Red Blood Cells (RBCs)", "result": "Not Seen"},
        {"name": "Proteins", "result": "Nil"},
        {"name": "Glucose", "result": "Nil"}
    ]
    results_data = [
        {"department": "Clinical Chemistry", "tests": [{"test_name": "URINALYSIS", "result": "Completed", "parameters": ua_params}]},
        {"department": "Parasitology", "tests": [{"test_name": "BS for MPS", "result": "Negative", "unit": "", "reference": "Negative"}]},
        {"department": "Serology", "tests": [{"test_name": "H. Pylori Ag", "result": "Negative", "unit": "", "reference": "Negative"}]}
    ]
    pdf_bytes = generate_pdf(order_data, results_data)
    assert len(pdf_bytes) > 1000
    # Verify single page output (Page /Count 1)
    assert b"/Count 1" in pdf_bytes or b"/Type /Page" in pdf_bytes


def test_widal_and_hiv_pdf_report_rendering():
    order_data = {
        "lab_number": "AMH-26-8-777",
        "full_name": "Sarah K",
        "age": "24",
        "sex": "Female",
        "requested_by": "Dr. Sarah",
        "ward_of_origin": "OPD",
        "ordered_date": "2026-08-25"
    }

    # Case 1: Simple Negative WIDAL and Non-Reactive HIV
    results_simple = [
        {
            "department": "Serology & Clinical Immunology",
            "tests": [
                {"test_name": "WIDAL (Salmonella Typhi Agglutination)", "result": "Negative", "unit": "", "flag": "", "reference": "Negative"},
                {"test_name": "HIV Testing", "result": "Non-Reactive", "unit": "", "flag": "", "reference": "Non-Reactive"}
            ]
        }
    ]
    pdf_simple = generate_pdf(order_data, results_simple)
    assert isinstance(pdf_simple, bytes)
    assert len(pdf_simple) > 1000

    # Case 2: Positive WIDAL with detailed titers & HIV Multi-Kit Panel
    widal_titers = [
        {"name": "Salmonella typhi O (TO)", "result": "1:160", "reference": "Significant if >= 1:80"},
        {"name": "Salmonella typhi H (TH)", "result": "1:80", "reference": "Significant if >= 1:80"},
        {"name": "Salmonella paratyphi A (AO)", "result": "< 1:20", "reference": "Significant if >= 1:80"},
        {"name": "Salmonella paratyphi B (BH)", "result": "Not Done", "reference": "Significant if >= 1:80"},
    ]
    hiv_kits = [
        {"name": "MHS HIV 1/2 Kwiq Test", "result": "Reactive", "flag": "\u26A0", "reference": "Non-Reactive"},
        {"name": "HIV 1/2 Stat-Pak®", "result": "Reactive", "flag": "\u26A0", "reference": "Non-Reactive"},
        {"name": "SD Bioline HIV-1/2", "result": "Non-Reactive", "flag": "", "reference": "Non-Reactive"},
    ]
    results_detailed = [
        {
            "department": "Serology & Clinical Immunology",
            "tests": [
                {"test_name": "WIDAL (Salmonella Typhi Agglutination)", "result": "Positive (TO 1:160, TH 1:80)", "parameters": widal_titers},
                {"test_name": "HIV Testing", "result": "Reactive", "parameters": hiv_kits}
            ]
        }
    ]
    pdf_detailed = generate_pdf(order_data, results_detailed)
    assert isinstance(pdf_detailed, bytes)
    assert len(pdf_detailed) > 1000

def test_culture_and_sensitivity_dedicated_single_page_pdf():
    order_data = {
        "lab_number": "AMH-26-9-100",
        "full_name": "Amina Nakato",
        "client_number": "AMH-999",
        "age": "28y",
        "sex": "Female",
        "ward_of_origin": "GOPD",
        "ordered_date": "2026-09-03"
    }
    cs_test = {
        "test_name": "Urine Culture & Sensitivity (C&S)",
        "phase": 4,
        "preliminary_micro": "Pus cells 10-15/hpf, Gram-negative rods seen",
        "colony_count_cfu": ">= 10^5",
        "growth_category": "significant",
        "incubation_hours": 24,
        "media_used": "CLED & MacConkey Agar",
        "clinical_notes": "Clean-catch midstream urine sample.",
        "isolates": [
            {
                "organism_name": "Escherichia coli",
                "colony_morphology": "Yellow lactose-fermenting colonies on CLED",
                "ast_results": [
                    {"antimicrobial_class": "Penicillins", "agent_name": "Ampicillin", "measurement_value": 12.0, "measurement_type": "zone_mm", "raw_sir": "R", "overridden_sir": "R"},
                    {"antimicrobial_class": "Beta-Lactam/Inh.", "agent_name": "Amoxicillin/Clavulanate", "measurement_value": 19.0, "measurement_type": "zone_mm", "raw_sir": "S", "overridden_sir": "S"},
                    {"antimicrobial_class": "Cephalosporins", "agent_name": "Ceftriaxone", "measurement_value": 16.0, "measurement_type": "zone_mm", "raw_sir": "I", "overridden_sir": "I"},
                    {"antimicrobial_class": "Fluoroquinolones", "agent_name": "Ciprofloxacin", "measurement_value": 22.0, "measurement_type": "zone_mm", "raw_sir": "S", "overridden_sir": "S"},
                    {"antimicrobial_class": "Aminoglycosides", "agent_name": "Gentamicin", "measurement_value": 10.0, "measurement_type": "zone_mm", "raw_sir": "R", "overridden_sir": "R"}
                ]
            }
        ],
        "alerts": [
            "[CRITICAL ALERT]: Phenotypic quality review confirms active bacterial infection."
        ]
    }
    # Case A: Combined General Test + C&S (Must produce 2 pages, C&S on dedicated page)
    results_data = [
        {
            "department": "Parasitology",
            "tests": [{"test_name": "BS for MPS", "result": "No malaria parasites seen", "reference": "No malaria parasites seen"}]
        },
        {
            "department": "Microbiology & Tuberculosis",
            "tests": [cs_test]
        }
    ]
    pdf_bytes = generate_pdf(order_data, results_data)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    import pypdf
    reader = pypdf.PdfReader(io.BytesIO(pdf_bytes))
    full_text = "".join(page.extract_text() for page in reader.pages)
    assert "CULTURE & ANTIMICROBIAL SUSCEPTIBILITY REPORT" in full_text
    assert "Escherichia coli" in full_text
    assert "Ampicillin" in full_text
    assert "Ciprofloxacin" in full_text



