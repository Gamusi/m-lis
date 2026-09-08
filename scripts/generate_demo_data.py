import sys
import os
import sqlite3
import datetime
import json

sys.path.insert(0, os.path.abspath('.'))

from backend.app.evaluator import evaluate_result, is_qualitative_abnormal
from backend.app.biochem_validator import validate_biochem_parameter

conn = sqlite3.connect('data/mlis.db')
conn.row_factory = sqlite3.Row
cur = conn.cursor()

admin_id = 1
now_str = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
today = datetime.date.today()
today_str = today.strftime('%Y-%m-%d')

# Cleanup any visits >= 7 cleanly
cur.execute('DELETE FROM culture_ast_results WHERE isolate_id IN (SELECT id FROM culture_isolates WHERE culture_order_id IN (SELECT id FROM culture_orders WHERE order_id IN (SELECT id FROM test_orders WHERE visit_id >= 7)))')
cur.execute('DELETE FROM culture_isolates WHERE culture_order_id IN (SELECT id FROM culture_orders WHERE order_id IN (SELECT id FROM test_orders WHERE visit_id >= 7))')
cur.execute('DELETE FROM culture_orders WHERE order_id IN (SELECT id FROM test_orders WHERE visit_id >= 7)')
cur.execute('DELETE FROM donor_crossmatches WHERE order_id IN (SELECT id FROM test_orders WHERE visit_id >= 7)')
cur.execute('DELETE FROM test_results WHERE order_id IN (SELECT id FROM test_orders WHERE visit_id >= 7)')
cur.execute('DELETE FROM test_orders WHERE visit_id >= 7')
cur.execute('DELETE FROM visits WHERE id >= 7')
conn.commit()

def get_client(name):
    cur.execute('SELECT id, date_of_birth, sex, age_years FROM clients WHERE full_name = ?', (name,))
    return cur.fetchone()

def get_clinician(name):
    cur.execute('SELECT id FROM clinicians WHERE UPPER(name) LIKE ?', (f'%{name.upper()}%',))
    row = cur.fetchone()
    return row['id'] if row else 1

def get_specimen(name_fragment):
    cur.execute('SELECT id FROM specimen_types WHERE LOWER(name) LIKE ?', (f'%{name_fragment.lower()}%',))
    row = cur.fetchone()
    return row['id'] if row else 1

def get_next_lab_number():
    cur.execute("SELECT lab_number FROM visits WHERE lab_number LIKE 'AMH-PILOT-26-9-%'")
    nums = []
    for r in cur.fetchall():
        try:
            nums.append(int(r['lab_number'].split('-')[-1]))
        except Exception:
            pass
    next_num = (max(nums) if nums else 6) + 1
    return f'AMH-PILOT-26-9-{next_num:03d}'

def get_test(name):
    cur.execute('SELECT id, name, section_id, result_type, default_unit, ref_range FROM tests WHERE name = ? AND parent_rollup_id IS NULL', (name,))
    return cur.fetchone()

def get_panel_params(test_id):
    cur.execute('SELECT id, parameter_name, unit, ref_range, options FROM test_parameters WHERE test_id = ? ORDER BY sort_order ASC', (test_id,))
    return cur.fetchall()

def create_visit(client_id, clinician_id, ward, specimen_type_id, lab_no):
    cur.execute('''
        INSERT INTO visits (client_id, clinician_id, ward_of_origin, lab_number, specimen_type_id, order_category, created_at)
        VALUES (?, ?, ?, ?, ?, 'in-house', ?)
    ''', (client_id, clinician_id, ward, lab_no, specimen_type_id, now_str))
    return cur.lastrowid

def add_order(visit_id, test_id):
    cur.execute('''
        INSERT INTO test_orders (visit_id, test_id, ordered_by_user_id, status, order_category, ordered_at)
        VALUES (?, ?, ?, 'completed', 'in-house', ?)
    ''', (visit_id, test_id, admin_id, now_str))
    return cur.lastrowid

def record_standalone_result(order_id, test_name, value, unit=None, client_dob=None, client_sex=None):
    dob_d = datetime.date.fromisoformat(client_dob) if client_dob else None
    eval_res = evaluate_result(test_name, str(value), dob=dob_d, sex=client_sex, entry_date=today, unit=unit)
    flag = eval_res.get("flag")
    is_abn = eval_res.get("is_abnormal", False)
    res_unit = unit or eval_res.get("unit")
    cur.execute('''
        INSERT INTO test_results (order_id, parameter_id, result_value, result_unit, clinical_flag, is_positive, entered_by_user_id, entered_at, verified_by_user_id, verified_at)
        VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (order_id, str(value), res_unit, flag, 1 if is_abn else 0, admin_id, now_str, admin_id, now_str))

def record_panel_results(order_id, test_id, param_val_map, client_age=None, client_sex=None):
    params = get_panel_params(test_id)
    overall_pos = False
    for p in params:
        pname = p['parameter_name']
        if pname not in param_val_map:
            continue
        val, punit = param_val_map[pname]
        try:
            eval_dict = validate_biochem_parameter(cur, pname, str(val), age=client_age, sex=client_sex, unit=punit)
            flag = eval_dict.get("flag")
            is_abn = eval_dict.get("is_abnormal", False)
        except Exception:
            eval_dict = evaluate_result(pname, str(val), sex=client_sex, entry_date=today, unit=punit)
            flag = eval_dict.get("flag")
            is_abn = eval_dict.get("is_abnormal", False)

        if str(val).strip().lower() in ['positive', 'abnormal', 'reactive']:
            is_abn = True
            if not flag:
                flag = "\u26A0"

        if is_abn:
            overall_pos = True

        cur.execute('''
            INSERT INTO test_results (order_id, parameter_id, result_value, result_unit, clinical_flag, is_positive, entered_by_user_id, entered_at, verified_by_user_id, verified_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (order_id, p['id'], str(val), punit or p['unit'], flag, 1 if is_abn else 0, admin_id, now_str, admin_id, now_str))

    # Add roll-up result in test_results
    cur.execute('''
        INSERT INTO test_results (order_id, parameter_id, result_value, is_positive, entered_by_user_id, entered_at, verified_by_user_id, verified_at)
        VALUES (?, NULL, 'Completed', ?, ?, ?, ?, ?)
    ''', (order_id, 1 if overall_pos else 0, admin_id, now_str, admin_id, now_str))

# ==========================================
# VISIT 7 (AMH-PILOT-26-9-007): KASOZI JOSEPH
# Tests: RFTS, CARDIAC, ELECTROLYTES, LIPID PROFILE, FBS
# ==========================================
c_kasozi = get_client('KASOZI JOSEPH')
cid_kasozi = c_kasozi['id']
lab_7 = get_next_lab_number()
v7_id = create_visit(cid_kasozi, get_clinician('DR. MUKASA'), 'OPD', get_specimen('Serum (SST / Gel Separator)'), lab_7)
print(f'Created Visit 7 ({lab_7}) for KASOZI JOSEPH')

# 1. RFTS
t_rfts = get_test('RFTS')
o_rfts = add_order(v7_id, t_rfts['id'])
record_panel_results(o_rfts, t_rfts['id'], {
    'Serum Urea': (14.2, 'mmol/L'),
    'Serum Creatinine': (245, 'µmol/L'),
    'Serum Potassium (K+)': (5.6, 'mmol/L'),
    'Serum Sodium (Na+)': (138.0, 'mmol/L'),
    'Serum Chloride (Cl-)': (102.0, 'mmol/L'),
    'Serum Uric Acid': (460, 'µmol/L')
}, client_age=44, client_sex='Male')

# 2. CARDIAC
t_cardiac = get_test('CARDIAC')
o_cardiac = add_order(v7_id, t_cardiac['id'])
record_panel_results(o_cardiac, t_cardiac['id'], {
    'Total CK (Creatine Kinase)': (380, 'U/L'),
    'CK-MB (Creatine Kinase-MB)': (32.0, 'U/L'),
    'Troponin I (cTnI)': (0.45, 'ng/mL'),
    'Troponin T (cTnT)': ('Positive', None),
    'Myoglobin': (95.0, 'ng/mL'),
    'BNP / NT-proBNP': (210.0, 'pg/mL'),
    'D-Dimer': (0.85, 'µg/mL'),
    'LDH (Lactate Dehydrogenase)': (285, 'U/L')
}, client_age=44, client_sex='Male')

# 3. ELECTROLYTES
t_lytes = get_test('ELECTROLYTES')
o_lytes = add_order(v7_id, t_lytes['id'])
record_panel_results(o_lytes, t_lytes['id'], {
    'Serum Potassium (K+)': (5.6, 'mmol/L'),
    'Serum Sodium (Na+)': (138.0, 'mmol/L'),
    'Serum Chloride (Cl-)': (102.0, 'mmol/L'),
    'Bicarbonate (HCO3-)': (19.0, 'mmol/L'),
    'Total Calcium (Ca2+)': (2.10, 'mmol/L'),
    'Magnesium (Mg2+)': (0.92, 'mmol/L'),
    'Phosphate (PO4)': (1.65, 'mmol/L')
}, client_age=44, client_sex='Male')

# 4. LIPID PROFILE
t_lipids = get_test('LIPID PROFILE')
o_lipids = add_order(v7_id, t_lipids['id'])
record_panel_results(o_lipids, t_lipids['id'], {
    'Total Cholesterol': (6.4, 'mmol/L'),
    'Triglycerides': (2.85, 'mmol/L'),
    'HDL Cholesterol': (0.92, 'mmol/L'),
    'LDL Cholesterol': (4.18, 'mmol/L')
}, client_age=44, client_sex='Male')

# 5. FBS
t_fbs = get_test('FBS (Fasting Blood Sugar)')
o_fbs = add_order(v7_id, t_fbs['id'])
record_standalone_result(o_fbs, 'FBS (Fasting Blood Sugar)', '9.8', unit='mmol/L', client_dob=c_kasozi['date_of_birth'], client_sex='Male')

print('Completed KASOZI JOSEPH orders.')
conn.commit()

# ==========================================
# VISIT 8 (AMH-PILOT-26-9-008): NAMAGANDA AISHA
# Tests: HCG Urine, HCG Blood, VDRL/RPR, WIDAL, BAT, RF, H.Pylori Ag, H.Pylori Ab
# ==========================================
c_aisha = get_client('NAMAGANDA AISHA')
cid_aisha = c_aisha['id']
lab_8 = get_next_lab_number()
v8_id = create_visit(cid_aisha, get_clinician('DR. NAMUTEBI'), 'ANC', get_specimen('Serum (Red Top)'), lab_8)
print(f'Created Visit 8 ({lab_8}) for NAMAGANDA AISHA')

# 1. HCG Urine
t_hcgu = get_test('HCG Urine')
o_hcgu = add_order(v8_id, t_hcgu['id'])
record_standalone_result(o_hcgu, 'HCG Urine', 'Positive')

# 2. HCG Blood
t_hcgb = get_test('HCG Blood')
o_hcgb = add_order(v8_id, t_hcgb['id'])
record_standalone_result(o_hcgb, 'HCG Blood', '4520', unit='mIU/mL')

# 3. VDRL/RPR
t_vdrl = get_test('VDRL/RPR (Syphilis Screening)')
o_vdrl = add_order(v8_id, t_vdrl['id'])
record_standalone_result(o_vdrl, 'VDRL/RPR (Syphilis Screening)', 'Non-Reactive')

# 4. WIDAL
t_widal = get_test('WIDAL (Salmonella Typhi Agglutination)')
o_widal = add_order(v8_id, t_widal['id'])
record_panel_results(o_widal, t_widal['id'], {
    'Salmonella typhi O (TO)': ('1:160 (High / Reactive)', None),
    'Salmonella typhi H (TH)': ('1:80 (Borderline Significant)', None),
    'Salmonella paratyphi A (AO)': ('< 1:20 (Low / Normal)', None),
    'Salmonella paratyphi B (BH)': ('< 1:20 (Low / Normal)', None)
}, client_age=30, client_sex='Female')

# 5. BAT
t_bat = get_test('BAT (Brucella Antigen Test)')
o_bat = add_order(v8_id, t_bat['id'])
record_standalone_result(o_bat, 'BAT (Brucella Antigen Test)', 'Negative')

# 6. RF
t_rf = get_test('RF (Rheumatoid Factor)')
o_rf = add_order(v8_id, t_rf['id'])
record_standalone_result(o_rf, 'RF (Rheumatoid Factor)', 'Negative')

# 7. H.Pylori Ag
t_hp_ag = get_test('H.Pylori Ag (Stool Antigen)')
o_hp_ag = add_order(v8_id, t_hp_ag['id'])
record_standalone_result(o_hp_ag, 'H.Pylori Ag (Stool Antigen)', 'Positive')

# 8. H.Pylori Ab
t_hp_ab = get_test('H.Pylori Ab (Serum Antibody)')
o_hp_ab = add_order(v8_id, t_hp_ab['id'])
record_standalone_result(o_hp_ab, 'H.Pylori Ab (Serum Antibody)', 'Positive')

print('Completed NAMAGANDA AISHA orders.')
conn.commit()

# ==========================================
# VISIT 9 (AMH-PILOT-26-9-009): ATUHAIRWE BRIAN
# Tests: Sickling Test, Reticulocyte Count, E.S.R, STOOL ANALYSIS, ASO Titer, Malaria RDT, CD4 Percentage, EID PCRs
# ==========================================
c_brian = get_client('ATUHAIRWE BRIAN')
cid_brian = c_brian['id']
lab_9 = get_next_lab_number()
v9_id = create_visit(cid_brian, get_clinician('DR. NAMUTEBI'), 'PAEDIATRIC', get_specimen('EDTA Whole Blood'), lab_9)
print(f'Created Visit 9 ({lab_9}) for ATUHAIRWE BRIAN')

# 1. Sickling Test
t_sickle = get_test('Sickling Test (Sodium Metabisulfite)')
o_sickle = add_order(v9_id, t_sickle['id'])
record_standalone_result(o_sickle, 'Sickling Test (Sodium Metabisulfite)', 'Positive')

# 2. Reticulocyte Count
t_retic = get_test('Reticulocyte Count')
o_retic = add_order(v9_id, t_retic['id'])
record_standalone_result(o_retic, 'Reticulocyte Count', '4.5', unit='%', client_dob=c_brian['date_of_birth'], client_sex='Male')

# 3. E.S.R
t_esr = get_test('E.S.R (Erythrocyte Sedimentation Rate)')
o_esr = add_order(v9_id, t_esr['id'])
record_standalone_result(o_esr, 'E.S.R (Erythrocyte Sedimentation Rate)', '35', unit='mm/hour', client_dob=c_brian['date_of_birth'], client_sex='Male')

# 4. STOOL ANALYSIS
t_stool = get_test('STOOL ANALYSIS')
o_stool = add_order(v9_id, t_stool['id'])
record_panel_results(o_stool, t_stool['id'], {
    'Stool Analysis (Macroscopy)': ('Semi-formed, No blood/mucus', None),
    'Stool Analysis (Microscopy)': ('G. lamblia cysts seen', None),
    'Stool Occult Blood': ('Negative', None)
}, client_age=6, client_sex='Male')

# 5. ASO Titer
t_aso = get_test('ASO Titer (Anti-Streptolysin O)')
o_aso = add_order(v9_id, t_aso['id'])
record_standalone_result(o_aso, 'ASO Titer (Anti-Streptolysin O)', '340', unit='IU/mL', client_dob=c_brian['date_of_birth'], client_sex='Male')

# 6. Malaria RDT
t_mrdt = get_test('Malaria RDT')
o_mrdt = add_order(v9_id, t_mrdt['id'])
record_standalone_result(o_mrdt, 'Malaria RDT', 'Negative')

# 7. CD4 Percentage
t_cd4p = get_test('CD4 Percentage')
o_cd4p = add_order(v9_id, t_cd4p['id'])
record_standalone_result(o_cd4p, 'CD4 Percentage', '32.5', unit='%', client_dob=c_brian['date_of_birth'], client_sex='Male')

# 8. EID 1st PCR
t_eid1 = get_test('EID 1st PCR (4-6 Weeks)')
o_eid1 = add_order(v9_id, t_eid1['id'])
record_standalone_result(o_eid1, 'EID 1st PCR (4-6 Weeks)', 'Negative (Not Detected)')

# 9. EID 2nd PCR
t_eid2 = get_test('EID 2nd PCR (9 Months)')
o_eid2 = add_order(v9_id, t_eid2['id'])
record_standalone_result(o_eid2, 'EID 2nd PCR (9 Months)', 'Negative (Not Detected)')

# 10. EID Final Rapid Test
t_eid3 = get_test('EID Final Rapid Test (18 Months)')
o_eid3 = add_order(v9_id, t_eid3['id'])
record_standalone_result(o_eid3, 'EID Final Rapid Test (18 Months)', 'Non-Reactive')

print('Completed ATUHAIRWE BRIAN orders.')
conn.commit()

# ==========================================
# VISIT 10 (AMH-PILOT-26-9-010): OKOT PATRICK
# Tests: TB LAM, ZN Staining For AFBs, Absolute CD4 Count, CD4 Rapid Test Strip, CrAg, COVID19RDT, Gram Stain
# ==========================================
c_okot = get_client('OKOT PATRICK')
cid_okot = c_okot['id']
lab_10 = get_next_lab_number()
v10_id = create_visit(cid_okot, get_clinician('DR. OPWANYA'), 'TB CLINIC', get_specimen('Sputum'), lab_10)
print(f'Created Visit 10 ({lab_10}) for OKOT PATRICK')

# 1. TB LAM
t_lam = get_test('TB LAM (Urine Tuberculosis LAM)')
o_lam = add_order(v10_id, t_lam['id'])
record_standalone_result(o_lam, 'TB LAM (Urine Tuberculosis LAM)', 'Positive')

# 2. ZN Staining For AFBs
t_zn = get_test('ZN Staining For AFBs')
o_zn = add_order(v10_id, t_zn['id'])
record_standalone_result(o_zn, 'ZN Staining For AFBs', '2+ (1-10 AFBs per HPF)')

# 3. Absolute CD4 Count
t_cd4a = get_test('Absolute CD4 Count (Cytometry)')
o_cd4a = add_order(v10_id, t_cd4a['id'])
record_standalone_result(o_cd4a, 'Absolute CD4 Count (Cytometry)', '145', unit='cells/µL', client_dob=c_okot['date_of_birth'], client_sex='Male')

# 4. CD4 Rapid Test Strip
t_cd4s = get_test('CD4 Count (Rapid Test Strip)')
o_cd4s = add_order(v10_id, t_cd4s['id'])
record_standalone_result(o_cd4s, 'CD4 Count (Rapid Test Strip)', 'CD4 Count: Below 200 cells/µL')

# 5. CrAg
t_crag = get_test('CrAg (Cryptococcal Antigen)')
o_crag = add_order(v10_id, t_crag['id'])
record_standalone_result(o_crag, 'CrAg (Cryptococcal Antigen)', 'Positive')

# 6. COVID19RDT
t_cov = get_test('COVID19RDT')
o_cov = add_order(v10_id, t_cov['id'])
record_standalone_result(o_cov, 'COVID19RDT', 'Negative')

# 7. Gram Stain
t_gram = get_test('Gram Stain')
o_gram = add_order(v10_id, t_gram['id'])
record_standalone_result(o_gram, 'Gram Stain', 'Gram-positive cocci in pairs/chains')

print('Completed OKOT PATRICK orders.')
conn.commit()

# ==========================================
# VISIT 11 (AMH-PILOT-26-9-011): KYOMUGISHA STELLA
# Tests: Urine C&S, Blood C&S, CSF C&S, Direct Coombs, Indirect Coombs, Cross-matching, Dengue NS1
# ==========================================
c_stella = get_client('KYOMUGISHA STELLA')
cid_stella = c_stella['id']
lab_11 = get_next_lab_number()
v11_id = create_visit(cid_stella, get_clinician('DR. MUKASA'), 'EMERGENCY', get_specimen('Blood (for Culture)'), lab_11)
print(f'Created Visit 11 ({lab_11}) for KYOMUGISHA STELLA')

# 1. Urine C&S
t_ucs = get_test('Urine Culture & Sensitivity (C&S)')
o_ucs = add_order(v11_id, t_ucs['id'])
cur.execute('''
    INSERT INTO culture_orders (order_id, phase, preliminary_micro, preliminary_micro_date, colony_count_cfu, growth_category, incubation_hours, media_used, clinical_notes, is_emergency_callback_done, created_at, updated_at)
    VALUES (?, 4, 'Moderate pus cells, Gram-negative rods', ?, '>= 10^5', 'significant', 24, 'CLED & MacConkey Agar', 'Significant E. coli bacteriuria identified.', 1, ?, ?)
''', (o_ucs, today_str, now_str, now_str))
co_id_1 = cur.lastrowid
cur.execute('''
    INSERT INTO culture_isolates (culture_order_id, isolate_number, organism_name, colony_morphology, is_pathogen, is_contaminant)
    VALUES (?, 1, 'Escherichia coli', 'Yellow lactose-fermenting colonies on CLED', 1, 0)
''', (co_id_1,))
iso_id_1 = cur.lastrowid
ast_entries = [
    ('Penicillins', 'Ampicillin', 'zone_mm', 12.0, 'R'),
    ('Beta-Lactam/Inh.', 'Amoxicillin/Clavulanate', 'zone_mm', 19.0, 'S'),
    ('Cephalosporins', 'Ceftriaxone', 'zone_mm', 24.0, 'S'),
    ('Fluoroquinolones', 'Ciprofloxacin', 'zone_mm', 23.0, 'S'),
    ('Aminoglycosides', 'Gentamicin', 'zone_mm', 18.0, 'S'),
    ('Carbapenems', 'Nitrofurantoin', 'zone_mm', 20.0, 'S')
]
for a_cls, a_name, m_type, m_val, sir in ast_entries:
    cur.execute('''
        INSERT INTO culture_ast_results (isolate_id, antimicrobial_class, agent_name, measurement_type, measurement_value, raw_sir, overridden_sir, override_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    ''', (iso_id_1, a_cls, a_name, m_type, m_val, sir, sir))
cur.execute('''
    INSERT INTO test_results (order_id, parameter_id, result_value, is_positive, entered_by_user_id, entered_at, verified_by_user_id, verified_at)
    VALUES (?, NULL, 'Significant Growth: Escherichia coli (>= 10^5 CFU/mL)', 1, ?, ?, ?, ?)
''', (o_ucs, admin_id, now_str, admin_id, now_str))

# 2. Blood C&S
t_bcs = get_test('Blood Culture & Sensitivity (C&S)')
o_bcs = add_order(v11_id, t_bcs['id'])
cur.execute('''
    INSERT INTO culture_orders (order_id, phase, preliminary_micro, preliminary_micro_date, growth_category, incubation_hours, media_used, clinical_notes, is_emergency_callback_done, created_at, updated_at)
    VALUES (?, 4, 'Gram-positive cocci in clusters detected in aerobic bottle', ?, 'significant', 48, 'BACTEC Blood Bottle & Blood Agar', 'Staphylococcus aureus bacteremia.', 1, ?, ?)
''', (o_bcs, today_str, now_str, now_str))
co_id_2 = cur.lastrowid
cur.execute('''
    INSERT INTO culture_isolates (culture_order_id, isolate_number, organism_name, colony_morphology, is_pathogen, is_contaminant)
    VALUES (?, 1, 'Staphylococcus aureus', 'Golden-yellow beta-hemolytic colonies', 1, 0)
''', (co_id_2,))
iso_id_2 = cur.lastrowid
ast_entries_b = [
    ('Penicillins', 'Penicillin G', 'zone_mm', 10.0, 'R'),
    ('Cephalosporins', 'Cefoxitin (MRSA screen)', 'zone_mm', 24.0, 'S'),
    ('Glycopeptides', 'Vancomycin', 'zone_mm', 18.0, 'S'),
    ('Aminoglycosides', 'Gentamicin', 'zone_mm', 20.0, 'S'),
    ('Fluoroquinolones', 'Levofloxacin', 'zone_mm', 21.0, 'S')
]
for a_cls, a_name, m_type, m_val, sir in ast_entries_b:
    cur.execute('''
        INSERT INTO culture_ast_results (isolate_id, antimicrobial_class, agent_name, measurement_type, measurement_value, raw_sir, overridden_sir, override_reason)
        VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
    ''', (iso_id_2, a_cls, a_name, m_type, m_val, sir, sir))
cur.execute('''
    INSERT INTO test_results (order_id, parameter_id, result_value, is_positive, entered_by_user_id, entered_at, verified_by_user_id, verified_at)
    VALUES (?, NULL, 'Significant Growth: Staphylococcus aureus (MSSA)', 1, ?, ?, ?, ?)
''', (o_bcs, admin_id, now_str, admin_id, now_str))

# 3. CSF C&S
t_csf = get_test('CSF & Sterile Fluid Culture & Sensitivity (C&S)')
o_csf = add_order(v11_id, t_csf['id'])
cur.execute('''
    INSERT INTO culture_orders (order_id, phase, preliminary_micro, preliminary_micro_date, growth_category, incubation_hours, media_used, clinical_notes, is_emergency_callback_done, created_at, updated_at)
    VALUES (?, 4, 'No bacteria seen on direct CSF Gram stain', ?, 'no_growth', 48, 'Chocolate & Blood Agar', 'No aerobic bacterial growth after 48 hours incubation.', 0, ?, ?)
''', (o_csf, today_str, now_str, now_str))
cur.execute('''
    INSERT INTO test_results (order_id, parameter_id, result_value, is_positive, entered_by_user_id, entered_at, verified_by_user_id, verified_at)
    VALUES (?, NULL, 'No bacterial growth after 48 hours', 0, ?, ?, ?, ?)
''', (o_csf, admin_id, now_str, admin_id, now_str))

# 4. Direct Coombs
t_dc = get_test('Direct coombs (Direct Antiglobulin Test)')
o_dc = add_order(v11_id, t_dc['id'])
record_panel_results(o_dc, t_dc['id'], {
    'DAT Qualitative Status': ('Negative', None),
    'Reaction Strength': ('Negative', None),
    'Reagent Specificity': ('Polyspecific AHG', None)
}, client_age=33, client_sex='Female')

# 5. Indirect Coombs
t_ic = get_test('Indirect coombs (Antibody Screen)')
o_ic = add_order(v11_id, t_ic['id'])
record_panel_results(o_ic, t_ic['id'], {
    'IAT Qualitative Status': ('Negative', None),
    'Screening Cell I': ('Negative', None),
    'Screening Cell II': ('Negative', None),
    'Screening Cell III': ('Negative', None)
}, client_age=33, client_sex='Female')

# 6. Compatibility Testing (Cross-matching)
t_xm = get_test('Compatibility Testing (Cross-matching)')
o_xm = add_order(v11_id, t_xm['id'])
cur.execute('''
    INSERT INTO donor_crossmatches (
        order_id, donor_unit_id, donor_blood_group, product_type, expiry_date,
        phase_is, phase_thermophase, phase_ahg, compatibility_status,
        release_status, clinical_summary, is_locked, entered_by_user_id, verified_by_user_id, created_at
    ) VALUES (?, 'UBTS-KLA-2026-0412', 'O Rh(D) Positive', 'PRBC', '2026-10-15', 'Neg', 'Neg', 'Neg', 'COMPATIBLE', 'RELEASED', 'Unit compatible across all 3 phases (IS, 37C, AHG).', 0, ?, ?, ?)
''', (o_xm, admin_id, admin_id, now_str))
cur.execute('''
    INSERT INTO test_results (order_id, parameter_id, result_value, clinical_flag, is_positive, entered_by_user_id, entered_at, verified_by_user_id, verified_at)
    VALUES (?, NULL, 'Unit UBTS-KLA-2026-0412: COMPATIBLE (RELEASED)', '', 0, ?, ?, ?, ?)
''', (o_xm, admin_id, now_str, admin_id, now_str))

# 7. Dengue NS1
t_dengue = get_test('Dengue NS1 Ag Cassette Test Kit')
o_dengue = add_order(v11_id, t_dengue['id'])
record_standalone_result(o_dengue, 'Dengue NS1 Ag Cassette Test Kit', 'Negative')

print('Completed KYOMUGISHA STELLA orders.')
conn.commit()
conn.close()
print('ALL 37 UNCOVERED TESTS SEEDED SUCCESSFULLY!')
