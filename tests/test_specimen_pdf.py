import pytest
from backend.app.pdf_generator import generate_pdf

def test_generate_pdf_with_custom_specimen():
    order_data = {
        'client_number': 'C-1002',
        'full_name': 'JOHN DOE',
        'age': '35y',
        'sex': 'Male',
        'lab_number': 'LAB-99201',
        'ward_of_origin': 'MALE WARD',
        'specimen': 'Synovial Fluid, Plasma',
        'requested_by': 'DR. SMITH',
        'ordered_date': '2026-09-09'
    }

    results_data = [
        {
            'department': 'Clinical Biochemistry',
            'tests': [
                {
                    'test_name': 'Uric Acid',
                    'result': '420',
                    'unit': 'umol/L',
                    'reference': '200 - 430',
                    'flag': ''
                }
            ]
        }
    ]

    pdf_bytes = generate_pdf(order_data, results_data)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b'%PDF')

def test_generate_pdf_cbc_uses_order_specimen():
    order_data = {
        'client_number': 'C-1003',
        'full_name': 'JANE DOE',
        'age': '28y',
        'sex': 'Female',
        'lab_number': 'LAB-99202',
        'ward_of_origin': 'MATERNITY',
        'specimen': 'Capillary / Fingerstick Blood',
        'requested_by': 'DR. JONES',
        'ordered_date': '2026-09-09'
    }

    results_data = [
        {
            'department': 'Hematology',
            'tests': [
                {
                    'test_name': 'Complete Blood Count (CBC)',
                    'parameters': [
                        {'name': 'Hemoglobin (Hb)', 'result': '12.5', 'unit': 'g/dL', 'reference': '12.0 - 15.5'}
                    ]
                }
            ]
        }
    ]

    pdf_bytes = generate_pdf(order_data, results_data)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b'%PDF')
