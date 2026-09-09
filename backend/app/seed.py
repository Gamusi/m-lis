import sqlite3
import json
from .database import get_connection, init_db

# Auto-generated from amh-comprehensive-test-reporting-specifications.md
SECTIONS = ['Hematology', 'Serology & Clinical Immunology', 'Clinical Biochemistry', 'Urinalysis Profile', 'Parasitology & Stool Diagnostics', 'Microbiology & Tuberculosis', 'Blood Transfusion & Immunohematology']

SPECIMEN_TYPES = [
    {
        'name': 'EDTA Whole Blood',
        'container': 'Lavender / Purple Top (K2/K3 EDTA)',
        'min_volume': '2.0 mL',
        'storage_temp': '2 - 8°C (Refrigerated)',
        'sort_order': 1
    },
    {
        'name': 'Sodium Citrate Whole Blood',
        'container': 'Light Blue Top (3.2% Citrate, 9:1 ratio)',
        'min_volume': '1.8 - 2.7 mL',
        'storage_temp': '20 - 25°C (Room Temp)',
        'sort_order': 2
    },
    {
        'name': 'Blood (for Culture)',
        'container': 'SPS Culture Bottles (Adult/Pediatric Broth)',
        'min_volume': '8.0 - 10.0 mL',
        'storage_temp': '35 - 37°C (Incubator)',
        'sort_order': 3
    },
    {
        'name': 'Capillary / Fingerstick Blood',
        'container': 'Capillary Lancet / Microtainer',
        'min_volume': '10 - 50 µL',
        'storage_temp': '20 - 25°C (Room Temp)',
        'sort_order': 4
    },
    {
        'name': 'Serum (Red Top)',
        'container': 'Plain Red Top Silica Clot Activator',
        'min_volume': '4.0 - 5.0 mL',
        'storage_temp': '2 - 8°C (Refrigerated)',
        'sort_order': 5
    },
    {
        'name': 'Serum (SST / Gel Separator)',
        'container': 'Gold SST Tube (Gel Barrier)',
        'min_volume': '4.0 - 5.0 mL',
        'storage_temp': '2 - 8°C (Refrigerated)',
        'sort_order': 6
    },
    {
        'name': 'Plasma (Lithium Heparin)',
        'container': 'Green Top (Lithium Heparin)',
        'min_volume': '4.0 - 5.0 mL',
        'storage_temp': '2 - 8°C (Refrigerated)',
        'sort_order': 7
    },
    {
        'name': 'Plasma (Fluoride / Oxalate)',
        'container': 'Grey Top (Sodium Fluoride / Potassium Oxalate)',
        'min_volume': '2.0 mL',
        'storage_temp': '2 - 8°C (Refrigerated)',
        'sort_order': 8
    },
    {
        'name': 'Clean-Catch Midstream Urine',
        'container': 'Sterile Wide-Mouth Container',
        'min_volume': '10.0 - 20.0 mL',
        'storage_temp': '2 - 8°C (Refrigerated)',
        'sort_order': 9
    },
    {
        'name': 'Random Stool / Feces',
        'container': 'Clean Dry Stool Container with Scoop Cap',
        'min_volume': '5.0 - 10.0 g',
        'storage_temp': '2 - 8°C (Refrigerated)',
        'sort_order': 10
    },
    {
        'name': 'Cerebrospinal Fluid (CSF)',
        'container': '3x Sterile Plain Screw-Cap Tubes (No Additives)',
        'min_volume': '1.0 - 2.0 mL / tube',
        'storage_temp': '20 - 25°C (Prompt Analysis)',
        'sort_order': 11
    },
    {
        'name': 'Sputum',
        'container': 'Sterile Wide-Mouth Screw-Cap Container',
        'min_volume': '3.0 - 5.0 mL',
        'storage_temp': '2 - 8°C (Refrigerated)',
        'sort_order': 12
    },
    {
        'name': 'Swab (Wound / Throat / Pus / Urogenital)',
        'container': 'Sterile Swab in Amies / Stuart Transport Medium',
        'min_volume': 'Swab tip coated',
        'storage_temp': '2 - 8°C (Refrigerated)',
        'sort_order': 13
    },
    {
        'name': 'Oral Fluid / Saliva',
        'container': 'Collection Spatula / Developer Vial',
        'min_volume': '1 oral swab',
        'storage_temp': '20 - 25°C (Room Temp)',
        'sort_order': 14
    },
    {
        'name': 'Fine Needle Aspirate (FNA) / Tissue Biopsy',
        'container': '95% Ethanol Smears / 10% Neutral Formalin Jar',
        'min_volume': 'Varies',
        'storage_temp': '20 - 25°C (Room Temp)',
        'sort_order': 15
    }
]

PANELS = {
    'Complete Blood Count (CBC)': [
        'Total WBC Count (White Blood Cells)', 'Red Blood Cells (RBC)', 'Hemoglobin (Hb)', 'Hematocrit (HCT)',
        'Mean Cell Volume (MCV)', 'Mean Cell Hb (MCH)', 'Mean Cell Hb Conc (MCHC)', 'Platelets Count (PLT)',
        'Neutrophils (%) [Relative Count]', 'Lymphocytes (%) [Relative Count]', 'Monocytes (%) [Relative Count]',
        'Eosinophils (%) [Relative Count]', 'Basophils (%) [Relative Count]', 'Neutrophils (Absolute Count)',
        'Lymphocytes (Absolute Count)', 'Monocytes (Absolute Count)', 'Eosinophils (Absolute Count)',
        'Basophils (Absolute Count)', 'RBC Distribution Width (RDW)', 'Thrombocrit (PCT)',
        'Mean Platelet Volume (MPV)', 'PLT Distribution Width (PDW)'
    ],
    'LFTS': [
        'ALT / SGPT (Alanine Aminotransferase)', 'AST / SGOT (Aspartate Aminotransferase)',
        'Alkaline Phosphatase (ALP)', 'Total Bilirubin', 'Direct Bilirubin',
        'Total Protein', 'Serum Albumin', 'Gamma-Glutamyl Transferase (GGT)', 'Total Cholesterol'
    ],
    'RFTS': [
        'Serum Urea', 'Serum Creatinine', 'Serum Potassium (K+)', 'Serum Sodium (Na+)',
        'Serum Chloride (Cl-)', 'Serum Uric Acid'
    ],
    'CARDIAC': [
        'Total CK (Creatine Kinase)', 'CK-MB (Creatine Kinase-MB)', 'Troponin I (cTnI)',
        'Troponin T (cTnT)', 'Myoglobin', 'BNP / NT-proBNP', 'D-Dimer', 'LDH (Lactate Dehydrogenase)'
    ],
    'ELECTROLYTES': [
        'Serum Potassium (K+)', 'Serum Sodium (Na+)', 'Serum Chloride (Cl-)',
        'Bicarbonate (HCO3-)', 'Total Calcium (Ca2+)', 'Magnesium (Mg2+)', 'Phosphate (PO4)'
    ],
    'LIPID PROFILE': [
        'Total Cholesterol', 'Triglycerides', 'HDL Cholesterol', 'LDL Cholesterol'
    ],
    'URINALYSIS': [
        'Color', 'Turbidity', 'Pus Cells (WBCs)', 'Red Blood Cells (RBCs)', 'Epithelial Cells', 'Casts',
        'Crystals', 'Specific Gravity (S.G)', 'PH', 'Proteins (Albuminuria Screening)',
        'Glucose (Glucosuria Screening)', 'Bilirubin (Bilirubinuria)', 'Urobilinogen',
        'Ketones (Ketonuria)', 'Blood (Hematuria/Hemoglobinuria)', 'Nitrates (Nitrite Screening)',
        'Leukocytes (Leukocyte Esterase)'
    ],
    'STOOL ANALYSIS': [
        'Stool Analysis (Macroscopy)', 'Stool Analysis (Microscopy)', 'Stool Occult Blood'
    ],
    'HIV Testing': [
        'OraQuick® HIV Self-Test', 'Fingerstick HIVST',
        'MHS HIV 1/2 Kwiq Test', 'Determine™ HIV-1/2', 'HIV 1/2 Stat-Pak®', 'SD Bioline HIV-1/2'
    ]
}


TESTS = [
    {'name': 'Complete Blood Count (CBC)', 'section': 'Hematology', 'is_tracked': 1, 'result_type': 'panel', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Evaluates cellular elements of peripheral blood (erythroid, myeloid, thromboid series). Normal: baseline hematopoiesis. Abnormal: cytopenias indicate marrow suppression/destruction; cytoses indicate reactive/inflammatory or myeloproliferative processes.'},
    {'name': 'LFTS', 'section': 'Clinical Biochemistry', 'is_tracked': 1, 'result_type': 'panel', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Assesses hepatic synthetic function (Albumin, Total Protein), hepatocellular integrity (ALT, AST), and biliary excretion (ALP, Bilirubin, GGT).'},
    {'name': 'RFTS', 'section': 'Clinical Biochemistry', 'is_tracked': 1, 'result_type': 'panel', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Evaluates glomerular filtration, tubular clearance, and nitrogenous waste excretion. Elevated urea/creatinine indicates pre-renal, intrinsic renal, or post-renal azotemia.'},
    {'name': 'CARDIAC', 'section': 'Clinical Biochemistry', 'is_tracked': 1, 'result_type': 'panel', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Screens for acute myocardial necrosis (Troponins, CK-MB, Myoglobin) and hemodynamic myocardial strain/thromboembolism (BNP, D-Dimer).'},
    {'name': 'ELECTROLYTES', 'section': 'Clinical Biochemistry', 'is_tracked': 1, 'result_type': 'panel', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Evaluates fluid balance, cellular transmembrane potential, and acid-base homeostasis (Na, K, Cl, HCO3, Ca, Mg, PO4).'},
    {'name': 'LIPID PROFILE', 'section': 'Clinical Biochemistry', 'is_tracked': 1, 'result_type': 'panel', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Atherogenic risk stratification. Evaluates total cholesterol, triglycerides, LDL, and protective HDL fractions.'},
    {'name': 'URINALYSIS', 'section': 'Urinalysis Profile', 'is_tracked': 1, 'result_type': 'panel', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Screens renal function, urinary tract infection, glomerulonephritis, and metabolic status (glucosuria, ketonuria, proteinuria).'},
    {'name': 'STOOL ANALYSIS', 'section': 'Parasitology & Stool Diagnostics', 'is_tracked': 1, 'result_type': 'panel', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Evaluates intestinal parasitosis, enteric inflammation, and lower gastrointestinal bleeding.'},
    {'name': 'HIV Testing', 'section': 'Serology & Clinical Immunology', 'is_tracked': 1, 'result_type': 'panel', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Standard national algorithm HIV diagnostic screening and rapid antibody confirmation.'},
    {'name': 'E.S.R (Erythrocyte Sedimentation Rate)', 'section': 'Hematology', 'is_tracked': 1, 'result_type': 'quantitative', 'default_unit': 'mm/hour', 'secondary_unit': None, 'ref_range': 'Male: <15, Female: <20 mm/hr', 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Non-specific marker of systemic inflammation, tissue injury, and plasma protein alterations.'},
    {'name': 'Aptt (Activated Partial Thromboplastin Time)', 'section': 'Hematology', 'is_tracked': 1, 'result_type': 'quantitative', 'default_unit': 'Seconds', 'secondary_unit': None, 'ref_range': '25.0 - 35.0 Seconds', 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Screens intrinsic and common coagulation pathways. Prolongation indicates factor deficiency or heparin therapy.'},
    {'name': 'Prothrombin Time (PT)', 'section': 'Hematology', 'is_tracked': 1, 'result_type': 'quantitative', 'default_unit': 'Seconds', 'secondary_unit': None, 'ref_range': '11.0 - 13.5 Seconds', 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Screens extrinsic and common coagulation pathways (Factors VII, X, V, II, I).'},
    {'name': 'International Normalized Ratio (INR)', 'section': 'Hematology', 'is_tracked': 1, 'result_type': 'quantitative', 'default_unit': 'Calculated ratio', 'secondary_unit': None, 'ref_range': '0.8 - 1.2 (Therapeutic: 2.0 - 3.0)', 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Standardized monitoring parameter for oral vitamin K antagonist anticoagulation (Warfarin).'},
    {'name': 'Bleeding Time (BT)', 'section': 'Hematology', 'is_tracked': 1, 'result_type': 'quantitative', 'default_unit': 'Minutes', 'secondary_unit': None, 'ref_range': '2.0 - 7.0 Minutes', 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Screens in-vivo primary hemostatic platelet plug formation and microvascular integrity.'},
    {'name': 'Clotting Time (CT)', 'section': 'Hematology', 'is_tracked': 1, 'result_type': 'quantitative', 'default_unit': 'Minutes', 'secondary_unit': None, 'ref_range': '4.0 - 10.0 Minutes', 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Screens whole-blood intrinsic and common coagulation pathway functional integrity.'},
    {'name': 'Reticulocyte Count', 'section': 'Hematology', 'is_tracked': 1, 'result_type': 'quantitative', 'default_unit': '%', 'secondary_unit': None, 'ref_range': '0.5 - 2.5 %', 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Evaluates dynamic bone marrow erythropoietic activity. Distinguishes hyperregenerative from hyporegenerative anemias.'},
    {'name': 'Sickling Test (Sodium Metabisulfite)', 'section': 'Hematology', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': 'Negative', 'options': ['Positive', 'Negative'], 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Screens for abnormal HbS under deoxygenating conditions (Sickle Cell Trait / Disease).'},
    {'name': 'WIDAL (Salmonella Typhi Agglutination)', 'section': 'Serology & Clinical Immunology', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': '< 1:80', 'options': ['Negative', 'Positive'], 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Serological screen for Salmonella enteric fever agglutinins (O and H antigens). Titer >= 1:80 indicates acute/recent exposure.'},

    {'name': 'VDRL/RPR (Syphilis Screening)', 'section': 'Serology & Clinical Immunology', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Non-Reactive', 'Reactive (1:2)', 'Reactive (1:4)', 'Reactive (1:8)', 'Reactive (1:16)', 'Reactive (1:32)', 'Reactive (1:64)'], 'parent_name': None, 'sort_order': 0},
    {'name': 'HBsAg (Hepatitis B)', 'section': 'Serology & Clinical Immunology', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Positive', 'Negative'], 'parent_name': None, 'sort_order': 0},
    {'name': 'BAT (Brucella Antigen Test)', 'section': 'Serology & Clinical Immunology', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Negative', 'Positive (1:80)', 'Positive (1:160)', 'Positive (1:320)'], 'parent_name': None, 'sort_order': 0},
    {'name': 'RF (Rheumatoid Factor)', 'section': 'Serology & Clinical Immunology', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Positive', 'Negative'], 'parent_name': None, 'sort_order': 0},
    {'name': 'HCG Urine', 'section': 'Serology & Clinical Immunology', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Positive', 'Negative'], 'parent_name': None, 'sort_order': 0},
    {'name': 'HCG Blood', 'section': 'Serology & Clinical Immunology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'mIU/mL', 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': None, 'sort_order': 0},
    {'name': 'H.Pylori Ag (Stool Antigen)', 'section': 'Serology & Clinical Immunology', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Positive', 'Negative'], 'parent_name': None, 'sort_order': 0},
    {'name': 'H.Pylori Ab (Serum Antibody)', 'section': 'Serology & Clinical Immunology', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Positive', 'Negative'], 'parent_name': None, 'sort_order': 0},
    {'name': 'Malaria RDT', 'section': 'Serology & Clinical Immunology', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Positive', 'Negative'], 'parent_name': None, 'sort_order': 0},
    {'name': 'TB LAM (Urine Tuberculosis LAM)', 'section': 'Serology & Clinical Immunology', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Positive', 'Negative'], 'parent_name': None, 'sort_order': 0},
    {'name': 'COVID19RDT', 'section': 'Serology & Clinical Immunology', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Positive', 'Negative'], 'parent_name': None, 'sort_order': 0},
    {'name': 'Absolute CD4 Count (Cytometry)', 'section': 'Serology & Clinical Immunology', 'is_tracked': 1, 'result_type': 'quantitative', 'default_unit': 'cells/µL', 'secondary_unit': None, 'ref_range': '500 - 1500 cells/µL', 'options': None, 'parent_name': None, 'sort_order': 0, 'tracks_stock': 1, 'consumable_name': 'CD4 POC Cartridges (PIMA/FACSPresto)', 'clinical_comments': 'Absolute CD4 T-cell count performed via automated POC cytometry. < 200 cells/µL defines Advanced HIV Disease (AHD).'},
    {'name': 'CD4 Count (Rapid Test Strip)', 'section': 'Serology & Clinical Immunology', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['CD4 Count: Below 200 cells/µL', 'CD4 Count: 200 cells/µL or above', 'Invalid'], 'parent_name': None, 'sort_order': 0, 'tracks_stock': 1, 'consumable_name': 'VISITECT CD4 Rapid Test Strips', 'clinical_comments': 'Semi-quantitative lateral-flow CD4 assay. Below 200 cells/µL defines Advanced HIV Disease (AHD).'},
    {'name': 'CD4 Percentage', 'section': 'Serology & Clinical Immunology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': '%', 'secondary_unit': None, 'ref_range': '>= 25%', 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Pediatric CD4 immunological monitoring (< 5 years). < 25% defines Pediatric Advanced HIV Disease (AHD).'},
    {'name': 'CrAg (Cryptococcal Antigen)', 'section': 'Serology & Clinical Immunology', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Positive', 'Negative'], 'parent_name': None, 'sort_order': 0},
    {'name': 'HCV Ab (Hepatitis C)', 'section': 'Serology & Clinical Immunology', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Positive', 'Negative'], 'parent_name': None, 'sort_order': 0},
    {'name': 'TPHA (Confirmatory Syphilis Test)', 'section': 'Serology & Clinical Immunology', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Reactive', 'Non-Reactive'], 'parent_name': None, 'sort_order': 0},
    {'name': 'ASO Titer (Anti-Streptolysin O)', 'section': 'Serology & Clinical Immunology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'IU/mL', 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': None, 'sort_order': 0},
    {'name': 'FBS (Fasting Blood Sugar)', 'section': 'Clinical Biochemistry', 'is_tracked': 1, 'result_type': 'quantitative', 'default_unit': 'mmol/L', 'secondary_unit': 'mg/dL', 'ref_range': '3.9 - 5.5 mmol/L (70 - 100 mg/dL)', 'options': None, 'parent_name': None, 'sort_order': 0},
    {'name': 'RBS (Random Blood Sugar)', 'section': 'Clinical Biochemistry', 'is_tracked': 1, 'result_type': 'quantitative', 'default_unit': 'mmol/L', 'secondary_unit': 'mg/dL', 'ref_range': '4.0 - 7.8 mmol/L (72 - 140 mg/dL)', 'options': None, 'parent_name': None, 'sort_order': 0},
    {'name': 'Blood smear for Malaria Parasites', 'section': 'Parasitology & Stool Diagnostics', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['No malaria parasites seen', '1+ (1-10 parasites per 100 thick-film fields)', '2+ (11-100 parasites per 100 thick-film fields)', '3+ (1-10 parasites per single thick-film field)', '4+ (>10 parasites per single thick-film field)'], 'parent_name': None, 'sort_order': 0},
    {'name': 'ZN Staining For AFBs', 'section': 'Microbiology & Tuberculosis', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': 'AFB Negative (No bacilli seen in 100 HPF)', 'options': ['AFB Negative', 'Scanty (1-9 AFBs per 100 HPF)', '1+ (10-99 AFBs per 100 HPF)', '2+ (1-10 AFBs per HPF)', '3+ (>10 AFBs per HPF)'], 'parent_name': None, 'sort_order': 0},
    {'name': 'Gram Stain', 'section': 'Microbiology & Tuberculosis', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['No bacteria seen', 'Gram-positive cocci in pairs/chains', 'Gram-positive cocci in clusters', 'Gram-negative rods', 'Gram-negative intracellular diplococci', 'Gram-positive rods'], 'parent_name': None, 'sort_order': 0},
    {'name': 'Urine Culture & Sensitivity (C&S)', 'section': 'Microbiology & Tuberculosis', 'is_tracked': 1, 'result_type': 'culture_panel', 'default_unit': None, 'secondary_unit': None, 'ref_range': '< 10^3 CFU/mL', 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Semi-quantitative aerobic culture on CLED and MacConkey/Blood agar with CLSI S-I-R AST reporting.'},
    {'name': 'Blood Culture & Sensitivity (C&S)', 'section': 'Microbiology & Tuberculosis', 'is_tracked': 1, 'result_type': 'culture_panel', 'default_unit': None, 'secondary_unit': None, 'ref_range': 'No growth after 5 days', 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Continuous or daily monitored aerobic blood culture with immediate preliminary Gram stain alert and CLSI AST.'},
    {'name': 'CSF & Sterile Fluid Culture & Sensitivity (C&S)', 'section': 'Microbiology & Tuberculosis', 'is_tracked': 1, 'result_type': 'culture_panel', 'default_unit': None, 'secondary_unit': None, 'ref_range': 'No growth after 48 hours', 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Sterile body fluid culture with immediate 15-minute verbal callback upon smear positivity and CLSI AST.'},
    {'name': 'Blood group (ABO & Rh typing)', 'section': 'Blood Transfusion & Immunohematology', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['A Rh(D) Positive', 'A Rh(D) Negative', 'B Rh(D) Positive', 'B Rh(D) Negative', 'AB Rh(D) Positive', 'AB Rh(D) Negative', 'O Rh(D) Positive', 'O Rh(D) Negative'], 'parent_name': None, 'sort_order': 0},
    {'name': 'Direct coombs (Direct Antiglobulin Test)', 'section': 'Blood Transfusion & Immunohematology', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Positive', 'Negative'], 'parent_name': None, 'sort_order': 0},
    {'name': 'Indirect coombs (Antibody Screen)', 'section': 'Blood Transfusion & Immunohematology', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Positive', 'Negative'], 'parent_name': None, 'sort_order': 0},
    {'name': 'Compatibility Testing (Cross-matching)', 'section': 'Blood Transfusion & Immunohematology', 'is_tracked': 1, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Compatible', 'Incompatible'], 'parent_name': None, 'sort_order': 0},
    {'name': 'Total WBC Count (White Blood Cells)', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': '10³/µL', 'secondary_unit': '10⁹/L', 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 1},
    {'name': 'Red Blood Cells (RBC)', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': '10⁶/µL', 'secondary_unit': '10¹²/L', 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 2},
    {'name': 'Hemoglobin (Hb)', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'g/dL', 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 3},
    {'name': 'Hematocrit (HCT)', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': '%', 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 4},
    {'name': 'Mean Cell Volume (MCV)', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'fL', 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 5},
    {'name': 'Mean Cell Hb (MCH)', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'pg', 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 6},
    {'name': 'Mean Cell Hb Conc (MCHC)', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'g/dL', 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 7},
    {'name': 'Platelets Count (PLT)', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': '10³/µL', 'secondary_unit': '10⁹/L', 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 8},
    {'name': 'Neutrophils (%) [Relative Count]', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': '%', 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 9},
    {'name': 'Lymphocytes (%) [Relative Count]', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': '%', 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 10},
    {'name': 'Monocytes (%) [Relative Count]', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': '%', 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 11},
    {'name': 'Eosinophils (%) [Relative Count]', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': '%', 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 12},
    {'name': 'Basophils (%) [Relative Count]', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': '%', 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 13},
    {'name': 'Neutrophils (Absolute Count)', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': '10⁹/µL', 'secondary_unit': '10⁹/L', 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 14},
    {'name': 'Lymphocytes (Absolute Count)', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': '10⁹/µL', 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 15},
    {'name': 'Monocytes (Absolute Count)', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': '10⁹/µL', 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 16},
    {'name': 'Eosinophils (Absolute Count)', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': '10⁹/µL', 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 17},
    {'name': 'Basophils (Absolute Count)', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': '10⁹/µL', 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 18},
    {'name': 'RBC Distribution Width (RDW)', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': '%', 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 19},
    {'name': 'Thrombocrit (PCT)', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': '%', 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 20},
    {'name': 'Mean Platelet Volume (MPV)', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'fL', 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 21},
    {'name': 'PLT Distribution Width (PDW)', 'section': 'Hematology', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': '%', 'secondary_unit': None, 'ref_range': None, 'options': None, 'parent_name': 'Complete Blood Count (CBC)', 'sort_order': 22},
    {'name': 'ALT / SGPT (Alanine Aminotransferase)', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'U/L', 'secondary_unit': 'µkat/L', 'ref_range': 'Male: <41, Female: <31 U/L', 'options': None, 'parent_name': 'LFTS', 'sort_order': 1},
    {'name': 'AST / SGOT (Aspartate Aminotransferase)', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'U/L', 'secondary_unit': 'µkat/L', 'ref_range': 'Male: <38, Female: <32 U/L', 'options': None, 'parent_name': 'LFTS', 'sort_order': 2},
    {'name': 'Alkaline Phosphatase (ALP)', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'U/L', 'secondary_unit': 'µkat/L', 'ref_range': 'Male: 40-129, Female: 35-104 U/L', 'options': None, 'parent_name': 'LFTS', 'sort_order': 3},
    {'name': 'Total Bilirubin', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'µmol/L', 'secondary_unit': 'mg/dL', 'ref_range': '0.0 - 17.0 µmol/L (0.0 - 1.0 mg/dL)', 'options': None, 'parent_name': 'LFTS', 'sort_order': 4},
    {'name': 'Direct Bilirubin', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'µmol/L', 'secondary_unit': 'mg/dL', 'ref_range': '0.0 - 4.4 µmol/L (0.0 - 0.25 mg/dL)', 'options': None, 'parent_name': 'LFTS', 'sort_order': 5},
    {'name': 'Total Protein', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'g/L', 'secondary_unit': 'g/dL', 'ref_range': '64.0 - 83.0 g/L (6.4 - 8.3 g/dL)', 'options': None, 'parent_name': 'LFTS', 'sort_order': 6},
    {'name': 'Serum Albumin', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'g/L', 'secondary_unit': 'g/dL', 'ref_range': '35.0 - 50.0 g/L (3.5 - 5.0 g/dL)', 'options': None, 'parent_name': 'LFTS', 'sort_order': 7},
    {'name': 'Gamma-Glutamyl Transferase (GGT)', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'U/L', 'secondary_unit': 'µkat/L', 'ref_range': 'Male: 10-66, Female: 9-35 U/L', 'options': None, 'parent_name': 'LFTS', 'sort_order': 8},
    {'name': 'Total Cholesterol', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'mmol/L', 'secondary_unit': 'mg/dL', 'ref_range': '< 5.2 mmol/L (< 200 mg/dL)', 'options': None, 'parent_name': 'LFTS', 'sort_order': 9},
    {'name': 'Serum Urea', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'mmol/L', 'secondary_unit': 'mg/dL', 'ref_range': '2.5 - 6.7 mmol/L (15 - 40 mg/dL)', 'options': None, 'parent_name': 'RFTS', 'sort_order': 1},
    {'name': 'Serum Creatinine', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'µmol/L', 'secondary_unit': 'mg/dL', 'ref_range': 'Male: 62-106, Female: 44-80 µmol/L', 'options': None, 'parent_name': 'RFTS', 'sort_order': 2},
    {'name': 'Serum Potassium (K+)', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'mmol/L', 'secondary_unit': 'mEq/L', 'ref_range': '3.5 - 5.1 mmol/L', 'options': None, 'parent_name': 'RFTS', 'sort_order': 3},
    {'name': 'Serum Sodium (Na+)', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'mmol/L', 'secondary_unit': 'mEq/L', 'ref_range': '136.0 - 145.0 mmol/L', 'options': None, 'parent_name': 'RFTS', 'sort_order': 4},
    {'name': 'Serum Chloride (Cl-)', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'mmol/L', 'secondary_unit': 'mEq/L', 'ref_range': '98.0 - 107.0 mmol/L', 'options': None, 'parent_name': 'RFTS', 'sort_order': 5},
    {'name': 'Serum Uric Acid', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'µmol/L', 'secondary_unit': 'mg/dL', 'ref_range': 'Male: 200-420, Female: 140-340 µmol/L', 'options': None, 'parent_name': 'RFTS', 'sort_order': 6},
    {'name': 'Serum Uric Acid', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'µmol/L', 'secondary_unit': 'mg/dL', 'ref_range': 'Male: 200-420, Female: 140-340 µmol/L', 'options': None, 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Evaluates purine metabolism and uric acid clearance. Used for gout and pre-eclampsia monitoring.'},

    {'name': 'Total CK (Creatine Kinase)', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'U/L', 'secondary_unit': 'µkat/L', 'ref_range': 'Male: 39-308, Female: 26-140 U/L', 'options': None, 'parent_name': 'CARDIAC', 'sort_order': 1},
    {'name': 'CK-MB (Creatine Kinase-MB)', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'U/L', 'secondary_unit': 'µkat/L', 'ref_range': '7.0 - 25.0 U/L', 'options': None, 'parent_name': 'CARDIAC', 'sort_order': 2},
    {'name': 'Troponin I (cTnI)', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'ng/mL', 'secondary_unit': 'µg/L', 'ref_range': '< 0.1 ng/mL (< 0.1 µg/L)', 'options': None, 'parent_name': 'CARDIAC', 'sort_order': 3},
    {'name': 'Troponin T (cTnT)', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': 'Negative', 'options': ['Negative', 'Positive'], 'parent_name': 'CARDIAC', 'sort_order': 4},
    {'name': 'Myoglobin', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'ng/mL', 'secondary_unit': 'µg/L', 'ref_range': 'Male: 16-76, Female: 7-64 ng/mL', 'options': None, 'parent_name': 'CARDIAC', 'sort_order': 5},
    {'name': 'BNP / NT-proBNP', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'pg/mL', 'secondary_unit': None, 'ref_range': '< 100.0 pg/mL', 'options': None, 'parent_name': 'CARDIAC', 'sort_order': 6},
    {'name': 'D-Dimer', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'µg/mL', 'secondary_unit': None, 'ref_range': '< 0.50 µg/mL', 'options': None, 'parent_name': 'CARDIAC', 'sort_order': 7},
    {'name': 'LDH (Lactate Dehydrogenase)', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'U/L', 'secondary_unit': None, 'ref_range': '125 - 220 U/L', 'options': None, 'parent_name': 'CARDIAC', 'sort_order': 8},
    {'name': 'Serum Potassium (K+)', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'mmol/L', 'secondary_unit': 'mEq/L', 'ref_range': '3.5 - 5.1 mmol/L', 'options': None, 'parent_name': 'ELECTROLYTES', 'sort_order': 1},
    {'name': 'Serum Sodium (Na+)', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'mmol/L', 'secondary_unit': 'mEq/L', 'ref_range': '136.0 - 145.0 mmol/L', 'options': None, 'parent_name': 'ELECTROLYTES', 'sort_order': 2},
    {'name': 'Serum Chloride (Cl-)', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'mmol/L', 'secondary_unit': 'mEq/L', 'ref_range': '98.0 - 107.0 mmol/L', 'options': None, 'parent_name': 'ELECTROLYTES', 'sort_order': 3},
    {'name': 'Bicarbonate (HCO3-)', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'mmol/L', 'secondary_unit': 'mEq/L', 'ref_range': '22.0 - 29.0 mmol/L', 'options': None, 'parent_name': 'ELECTROLYTES', 'sort_order': 4},
    {'name': 'Total Calcium (Ca2+)', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'mmol/L', 'secondary_unit': 'mg/dL', 'ref_range': '2.15 - 2.55 mmol/L (8.6 - 10.2 mg/dL)', 'options': None, 'parent_name': 'ELECTROLYTES', 'sort_order': 5},
    {'name': 'Magnesium (Mg2+)', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'mmol/L', 'secondary_unit': 'mg/dL', 'ref_range': '0.70 - 1.05 mmol/L (1.7 - 2.5 mg/dL)', 'options': None, 'parent_name': 'ELECTROLYTES', 'sort_order': 6},
    {'name': 'Phosphate (PO4)', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'mmol/L', 'secondary_unit': 'mg/dL', 'ref_range': '0.87 - 1.45 mmol/L (2.7 - 4.5 mg/dL)', 'options': None, 'parent_name': 'ELECTROLYTES', 'sort_order': 7},
    {'name': 'Total Cholesterol', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'mmol/L', 'secondary_unit': 'mg/dL', 'ref_range': '< 5.2 mmol/L (< 200 mg/dL)', 'options': None, 'parent_name': 'LIPID PROFILE', 'sort_order': 1},
    {'name': 'Triglycerides', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'mmol/L', 'secondary_unit': 'mg/dL', 'ref_range': '< 1.70 mmol/L (< 150 mg/dL)', 'options': None, 'parent_name': 'LIPID PROFILE', 'sort_order': 2},
    {'name': 'HDL Cholesterol', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'mmol/L', 'secondary_unit': 'mg/dL', 'ref_range': 'Male: >1.0, Female: >1.3 mmol/L', 'options': None, 'parent_name': 'LIPID PROFILE', 'sort_order': 3},
    {'name': 'LDL Cholesterol', 'section': 'Clinical Biochemistry', 'is_tracked': 0, 'result_type': 'quantitative', 'default_unit': 'mmol/L', 'secondary_unit': 'mg/dL', 'ref_range': '< 3.0 mmol/L (< 115 mg/dL)', 'options': None, 'parent_name': 'LIPID PROFILE', 'sort_order': 4},
    # --- URINALYSIS: Macroscopy (sort_order 1-2) ---
    {'name': 'Color', 'section': 'Urinalysis Profile', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Straw', 'Yellow', 'Amber', 'Red', 'Brown'], 'parent_name': 'URINALYSIS', 'sort_order': 1},
    {'name': 'Turbidity', 'section': 'Urinalysis Profile', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Clear', 'Slightly Turbid', 'Turbid'], 'parent_name': 'URINALYSIS', 'sort_order': 2},
    # --- URINALYSIS: Microscopy / Sediment Cytology (sort_order 3-7) — all lpf ---
    {'name': 'Pus Cells (WBCs)', 'section': 'Urinalysis Profile', 'is_tracked': 0, 'result_type': 'options', 'default_unit': '/ lpf', 'secondary_unit': None, 'ref_range': '<5 / lpf', 'options': ['Not Seen', '1-2 / lpf', '3-4 / lpf', '5-10 / lpf', '10-15 / lpf', '>15 / lpf'], 'parent_name': 'URINALYSIS', 'sort_order': 3},
    {'name': 'Red Blood Cells (RBCs)', 'section': 'Urinalysis Profile', 'is_tracked': 0, 'result_type': 'options', 'default_unit': '/ lpf', 'secondary_unit': None, 'ref_range': '<3 / lpf', 'options': ['Not Seen', '1-2 / lpf', '3-5 / lpf', '5-10 / lpf', '>10 / lpf'], 'parent_name': 'URINALYSIS', 'sort_order': 4},
    {'name': 'Epithelial Cells', 'section': 'Urinalysis Profile', 'is_tracked': 0, 'result_type': 'options', 'default_unit': '/ lpf', 'secondary_unit': None, 'ref_range': 'Few (1-4 / lpf)', 'options': ['Not Seen', 'Few (1-4 / lpf)', 'Moderate (5-10 / lpf)', 'Plenty (>10 / lpf)'], 'parent_name': 'URINALYSIS', 'sort_order': 5},
    {'name': 'Casts', 'section': 'Urinalysis Profile', 'is_tracked': 0, 'result_type': 'options', 'default_unit': '/ lpf', 'secondary_unit': None, 'ref_range': 'Not Seen', 'options': ['Not Seen', 'Hyaline Casts (0-1 / lpf)', 'Granular Casts (1-2 / lpf)', 'Cellular Casts (1-2 / lpf)', 'Waxy Casts (1-2 / lpf)', 'RBC Casts (1-2 / lpf)', 'WBC Casts (1-2 / lpf)'], 'parent_name': 'URINALYSIS', 'sort_order': 6},
    {'name': 'Crystals', 'section': 'Urinalysis Profile', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': 'Not Seen', 'options': ['Not Seen', 'Calcium Oxalate (+)', 'Calcium Oxalate (++)', 'Triple Phosphate (+)', 'Triple Phosphate (++)', 'Uric Acid Crystals (+)', 'Amorphous Urates/Phosphates'], 'parent_name': 'URINALYSIS', 'sort_order': 7},
    # --- URINALYSIS: Dry Chemistry Dipstick — Siemens Multistix (sort_order 8-17) ---
    {'name': 'Specific Gravity (S.G)', 'section': 'Urinalysis Profile', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['1.000', '1.005', '1.010', '1.015', '1.020', '1.025', '1.030'], 'parent_name': 'URINALYSIS', 'sort_order': 8},
    {'name': 'PH', 'section': 'Urinalysis Profile', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['5.0', '6.0', '6.5', '7.0', '7.5', '8.0', '8.5'], 'parent_name': 'URINALYSIS', 'sort_order': 9},
    {'name': 'Proteins', 'section': 'Urinalysis Profile', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Nil', 'Trace (15 mg/dL)', '1+ (30 mg/dL)', '2+ (100 mg/dL)', '3+ (300 mg/dL)', '4+ (≥2000 mg/dL)'], 'parent_name': 'URINALYSIS', 'sort_order': 10},
    {'name': 'Glucose', 'section': 'Urinalysis Profile', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Nil', 'Trace (100 mg/dL)', '1+ (250 mg/dL)', '2+ (500 mg/dL)', '3+ (1000 mg/dL)', '4+ (≥2000 mg/dL)'], 'parent_name': 'URINALYSIS', 'sort_order': 11},
    {'name': 'Bilirubin', 'section': 'Urinalysis Profile', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Nil', 'Small (+)', 'Moderate (++)', 'Large (+++)'], 'parent_name': 'URINALYSIS', 'sort_order': 12},
    {'name': 'Urobilinogen', 'section': 'Urinalysis Profile', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Normal (1.0 EU/dL)', '2.0 EU/dL', '4.0 EU/dL', '8.0 EU/dL'], 'parent_name': 'URINALYSIS', 'sort_order': 13},
    {'name': 'Ketones', 'section': 'Urinalysis Profile', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Nil', 'Trace (5 mg/dL)', '1+ (15 mg/dL)', '2+ (40 mg/dL)', '3+ (80 mg/dL)', '4+ (160 mg/dL)'], 'parent_name': 'URINALYSIS', 'sort_order': 14},
    {'name': 'Blood', 'section': 'Urinalysis Profile', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Nil', 'Non-Hemolyzed Trace', 'Hemolyzed Trace', '1+ (Small)', '2+ (Moderate)', '3+ (Large)'], 'parent_name': 'URINALYSIS', 'sort_order': 15},
    {'name': 'Nitrate', 'section': 'Urinalysis Profile', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Negative', 'Positive'], 'parent_name': 'URINALYSIS', 'sort_order': 16},
    {'name': 'Leukocyte Esterase', 'section': 'Urinalysis Profile', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Nil', 'Trace', '1+ (Small)', '2+ (Moderate)', '3+ (Large)'], 'parent_name': 'URINALYSIS', 'sort_order': 17},
    {'name': 'Stool Analysis (Macroscopy)', 'section': 'Parasitology & Stool Diagnostics', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Formed, No blood/mucus', 'Semi-formed, No blood/mucus', 'Loose', 'Watery', 'Blood present', 'Mucus present', 'Blood and mucus present'], 'parent_name': 'STOOL ANALYSIS', 'sort_order': 1},
    {'name': 'Stool Analysis (Microscopy)', 'section': 'Parasitology & Stool Diagnostics', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['No ova, cysts, or trophozoites seen', 'E. histolytica cysts seen', 'E. histolytica trophozoites seen', 'G. lamblia cysts seen', 'G. lamblia trophozoites seen', 'Hookworm ova seen', 'Ascaris lumbricoides ova seen', 'Schistosoma mansoni ova seen', 'Trichuris trichiura ova seen'], 'parent_name': 'STOOL ANALYSIS', 'sort_order': 2},
    {'name': 'Stool Occult Blood', 'section': 'Parasitology & Stool Diagnostics', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Negative', 'Positive'], 'parent_name': 'STOOL ANALYSIS', 'sort_order': 3},
    {'name': 'OraQuick® HIV Self-Test', 'section': 'Serology & Clinical Immunology', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Non-Reactive', 'Reactive'], 'parent_name': 'HIV Testing', 'sort_order': 1},
    {'name': 'Fingerstick HIVST', 'section': 'Serology & Clinical Immunology', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Non-Reactive', 'Reactive'], 'parent_name': 'HIV Testing', 'sort_order': 2},
    {'name': 'MHS HIV 1/2 Kwiq Test', 'section': 'Serology & Clinical Immunology', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Non-Reactive', 'Reactive'], 'parent_name': 'HIV Testing', 'sort_order': 3},
    {'name': 'Determine™ HIV-1/2', 'section': 'Serology & Clinical Immunology', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Non-Reactive', 'Reactive'], 'parent_name': 'HIV Testing', 'sort_order': 4},
    {'name': 'HIV 1/2 Stat-Pak®', 'section': 'Serology & Clinical Immunology', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Non-Reactive', 'Reactive'], 'parent_name': 'HIV Testing', 'sort_order': 5},
    {'name': 'SD Bioline HIV-1/2', 'section': 'Serology & Clinical Immunology', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Non-Reactive', 'Reactive'], 'parent_name': 'HIV Testing', 'sort_order': 6},
    {'name': 'EID 1st PCR (4-6 Weeks)', 'section': 'Serology & Clinical Immunology', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Negative (Not Detected)', 'Positive (Detected)'], 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'First-line molecular PCR for early infant HIV diagnosis at 4-6 weeks.'},
    {'name': 'EID 2nd PCR (9 Months)', 'section': 'Serology & Clinical Immunology', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Negative (Not Detected)', 'Positive (Detected)'], 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Second-line molecular PCR for early infant HIV diagnosis at 9 months.'},
    {'name': 'EID Final Rapid Test (18 Months)', 'section': 'Serology & Clinical Immunology', 'is_tracked': 0, 'result_type': 'options', 'default_unit': None, 'secondary_unit': None, 'ref_range': None, 'options': ['Non-Reactive', 'Reactive'], 'parent_name': None, 'sort_order': 0, 'clinical_comments': 'Final rapid exit test for early infant diagnosis after maternal antibody clearance at 18 months.'}
]


DEFAULT_REFERENCE_RANGES = [
    # CBC / Hematology
    ("Total WBC Count (White Blood Cells)", 0, 11, None, 6.0, 14.0, 2.0, 30.0, 0.5, 150.0, 2.0, 50.0, "10³/µL"),
    ("Total WBC Count (White Blood Cells)", 12, 999, None, 4.0, 10.0, 2.0, 30.0, 0.5, 150.0, 2.0, 50.0, "10³/µL"),
    ("WBC", 0, 11, None, 6.0, 14.0, 2.0, 30.0, 0.5, 150.0, 2.0, 50.0, "10³/µL"),
    ("WBC", 12, 999, None, 4.0, 11.0, 2.0, 30.0, 0.5, 150.0, 2.0, 50.0, "10³/µL"),
    ("Hemoglobin (Hb)", 0, 11, None, 11.5, 15.5, 8.0, 20.0, 2.0, 26.0, 5.0, 22.0, "g/dL"),
    ("Hemoglobin (Hb)", 12, 999, "Male", 13.5, 17.5, 8.0, 20.0, 2.0, 26.0, 5.0, 22.0, "g/dL"),
    ("Hemoglobin (Hb)", 12, 999, "Female", 12.0, 15.5, 8.0, 20.0, 2.0, 26.0, 5.0, 22.0, "g/dL"),
    ("Hemoglobin", 0, 11, None, 11.5, 15.5, 8.0, 20.0, 2.0, 26.0, 5.0, 22.0, "g/dL"),
    ("Hemoglobin", 12, 999, "Male", 13.5, 17.5, 8.0, 20.0, 2.0, 26.0, 5.0, 22.0, "g/dL"),
    ("Hemoglobin", 12, 999, "Female", 12.0, 15.5, 8.0, 20.0, 2.0, 26.0, 5.0, 22.0, "g/dL"),
    ("Red Blood Cells (RBC)", 0, 11, None, 3.8, 5.5, None, None, 1.0, 10.0, 1.5, 8.5, "10⁶/µL"),
    ("Red Blood Cells (RBC)", 12, 999, "Male", 4.5, 5.9, None, None, 1.0, 10.0, 1.5, 8.5, "10⁶/µL"),
    ("Red Blood Cells (RBC)", 12, 999, "Female", 4.0, 5.2, None, None, 1.0, 10.0, 1.5, 8.5, "10⁶/µL"),
    ("Hematocrit (HCT)", 0, 11, None, 34.0, 44.0, None, None, 10.0, 75.0, 15.0, 65.0, "%"),
    ("Hematocrit (HCT)", 12, 999, "Male", 40.0, 52.0, None, None, 10.0, 75.0, 15.0, 65.0, "%"),
    ("Hematocrit (HCT)", 12, 999, "Female", 36.0, 46.0, None, None, 10.0, 75.0, 15.0, 65.0, "%"),
    ("Mean Cell Volume (MCV)", 0, 999, None, 80.0, 100.0, None, None, 40.0, 150.0, 50.0, 130.0, "fL"),
    ("Mean Cell Hb (MCH)", 0, 999, None, 27.0, 33.0, None, None, 10.0, 60.0, 15.0, 50.0, "pg"),
    ("Mean Cell Hb Conc (MCHC)", 0, 999, None, 32.0, 36.0, None, None, 15.0, 50.0, 20.0, 42.0, "g/dL"),
    ("Platelets Count (PLT)", 0, 999, None, 150.0, 450.0, 50.0, 1000.0, 5.0, 3000.0, 20.0, 2000.0, "10³/µL"),
    ("Neutrophils (%) [Relative Count]", 0, 999, None, 40.0, 75.0, None, None, 0.0, 100.0, 0.0, 100.0, "%"),
    ("Lymphocytes (%) [Relative Count]", 0, 999, None, 20.0, 45.0, None, None, 0.0, 100.0, 0.0, 100.0, "%"),
    ("Monocytes (%) [Relative Count]", 0, 999, None, 2.0, 10.0, None, None, 0.0, 100.0, 0.0, 100.0, "%"),
    ("Eosinophils (%) [Relative Count]", 0, 999, None, 1.0, 6.0, None, None, 0.0, 100.0, 0.0, 100.0, "%"),
    ("Basophils (%) [Relative Count]", 0, 999, None, 0.0, 2.0, None, None, 0.0, 100.0, 0.0, 100.0, "%"),
    ("RBC Distribution Width (RDW)", 0, 999, None, 11.5, 14.5, None, None, 5.0, 35.0, 8.0, 30.0, "%"),

    # Blood Sugars (Dual Units)
    ("Fasting Blood Sugar (FBS)", 0, 999, None, 3.9, 5.5, 2.8, 25.0, 1.0, 50.0, 1.5, 35.0, "mmol/L"),
    ("Fasting Blood Sugar (FBS)", 0, 999, None, 70.0, 100.0, 50.0, 450.0, 18.0, 900.0, 27.0, 630.0, "mg/dL"),
    ("FBS (Fasting Blood Sugar)", 0, 999, None, 3.9, 5.5, 2.8, 25.0, 1.0, 50.0, 1.5, 35.0, "mmol/L"),
    ("FBS (Fasting Blood Sugar)", 0, 999, None, 70.0, 100.0, 50.0, 450.0, 18.0, 900.0, 27.0, 630.0, "mg/dL"),
    ("RBS (Random Blood Sugar)", 0, 999, None, 4.0, 7.8, 2.8, 25.0, 1.0, 55.0, 2.0, 45.0, "mmol/L"),
    ("RBS (Random Blood Sugar)", 0, 999, None, 72.0, 140.0, 50.0, 450.0, 18.0, 1000.0, 36.0, 810.0, "mg/dL"),

    # RFTs - Serum Creatinine
    ("Serum Creatinine", 12, 999, "Male", 62.0, 106.0, 30.0, 350.0, 15.0, 2500.0, 61.0, 1200.0, "µmol/L"),
    ("Serum Creatinine", 12, 999, "Male", 0.70, 1.20, 0.34, 3.96, 0.17, 28.28, 0.69, 13.57, "mg/dL"),
    ("Serum Creatinine", 12, 999, "Female", 44.0, 80.0, 25.0, 300.0, 15.0, 2500.0, 43.0, 1000.0, "µmol/L"),
    ("Serum Creatinine", 12, 999, "Female", 0.50, 0.90, 0.28, 3.39, 0.17, 28.28, 0.49, 11.31, "mg/dL"),
    ("Serum Creatinine", 0, 11, None, 20.0, 60.0, 15.0, 200.0, 15.0, 2500.0, 20.0, 400.0, "µmol/L"),
    ("Serum Creatinine", 0, 11, None, 0.23, 0.68, 0.17, 2.26, 0.17, 28.28, 0.23, 4.52, "mg/dL"),

    # RFTs - Serum Urea
    ("Serum Urea", 0, 65, None, 0.0, 8.3, 1.0, 40.0, 0.5, 150.0, 8.3, 60.0, "mmol/L"),
    ("Serum Urea", 0, 65, None, 0.0, 23.2, 2.8, 112.0, 1.4, 420.0, 23.2, 168.0, "mg/dL"),
    ("Serum Urea", 66, 999, None, 0.0, 11.9, 1.0, 50.0, 0.5, 150.0, 11.9, 80.0, "mmol/L"),
    ("Serum Urea", 66, 999, None, 0.0, 33.3, 2.8, 140.0, 1.4, 420.0, 33.3, 224.1, "mg/dL"),

    # RFTs - Serum Uric Acid
    ("Serum Uric Acid", 0, 65, "Male", 0.0, 420.0, None, None, 50.0, 2000.0, 341.0, 1200.0, "µmol/L"),
    ("Serum Uric Acid", 0, 65, "Male", 0.0, 7.06, None, None, 0.84, 33.60, 5.72, 20.16, "mg/dL"),
    ("Serum Uric Acid", 66, 999, "Male", 0.0, 500.0, None, None, 50.0, 2000.0, 341.0, 1400.0, "µmol/L"),
    ("Serum Uric Acid", 66, 999, "Male", 0.0, 8.40, None, None, 0.84, 33.60, 5.72, 23.52, "mg/dL"),
    ("Serum Uric Acid", 0, 999, "Female", 0.0, 340.0, None, None, 50.0, 2000.0, 341.0, 1000.0, "µmol/L"),
    ("Serum Uric Acid", 0, 999, "Female", 0.0, 5.71, None, None, 0.84, 33.60, 5.72, 16.80, "mg/dL"),

    # Electrolytes
    ("Serum Potassium (K+)", 0, 999, None, 4.5, 5.5, 2.8, 6.2, 1.0, 12.0, 1.5, 8.5, "mmol/L"),
    ("Serum Potassium (K+)", 0, 999, None, 4.5, 5.5, 2.8, 6.2, 1.0, 12.0, 1.5, 8.5, "mEq/L"),
    ("Serum Sodium (Na+)", 0, 999, None, 135.0, 145.0, 120.0, 160.0, 95.0, 180.0, 110.0, 165.0, "mmol/L"),
    ("Serum Sodium (Na+)", 0, 999, None, 135.0, 145.0, 120.0, 160.0, 95.0, 180.0, 110.0, 165.0, "mEq/L"),
    ("Serum Chloride (Cl-)", 0, 999, None, 98.0, 107.0, 70.0, 130.0, 60.0, 150.0, 70.0, 130.0, "mmol/L"),
    ("Serum Chloride (Cl-)", 0, 999, None, 98.0, 107.0, 70.0, 130.0, 60.0, 150.0, 70.0, 130.0, "mEq/L"),
    ("Bicarbonate (HCO3-)", 0, 999, None, 22.0, 29.0, 10.0, 40.0, 5.0, 50.0, 10.0, 45.0, "mmol/L"),
    ("Bicarbonate (HCO3-)", 0, 999, None, 22.0, 29.0, 10.0, 40.0, 5.0, 50.0, 10.0, 45.0, "mEq/L"),
    ("Total Calcium (Ca2+)", 0, 49, None, 3.20, 3.60, 1.50, 4.00, 0.5, 6.5, 1.20, 4.50, "mmol/L"),
    ("Total Calcium (Ca2+)", 0, 49, None, 12.80, 14.40, 6.00, 16.00, 2.0, 26.0, 4.80, 18.00, "mg/dL"),
    ("Total Calcium (Ca2+)", 50, 999, None, 3.00, 3.42, 1.50, 4.00, 0.5, 6.5, 1.20, 4.20, "mmol/L"),
    ("Total Calcium (Ca2+)", 50, 999, None, 12.00, 13.68, 6.00, 16.00, 2.0, 26.0, 4.80, 16.80, "mg/dL"),
    ("Calcium (Ca2+)", 0, 49, None, 3.20, 3.60, 1.50, 4.00, 0.5, 6.5, 1.20, 4.50, "mmol/L"),
    ("Calcium (Ca2+)", 0, 49, None, 12.80, 14.40, 6.00, 16.00, 2.0, 26.0, 4.80, 18.00, "mg/dL"),
    ("Calcium (Ca2+)", 50, 999, None, 3.00, 3.42, 1.50, 4.00, 0.5, 6.5, 1.20, 4.20, "mmol/L"),
    ("Calcium (Ca2+)", 50, 999, None, 12.00, 13.68, 6.00, 16.00, 2.0, 26.0, 4.80, 16.80, "mg/dL"),
    ("Magnesium (Mg2+)", 0, 999, None, 0.70, 1.05, 0.40, 2.00, 0.1, 5.5, 0.20, 3.50, "mmol/L"),
    ("Magnesium (Mg2+)", 0, 999, None, 1.70, 2.55, 0.97, 4.86, 0.24, 13.37, 0.49, 8.51, "mg/dL"),
    ("Phosphate (PO4)", 0, 999, None, 0.87, 1.45, 0.30, 3.00, 0.1, 6.0, 0.30, 4.50, "mmol/L"),
    ("Phosphate (PO4)", 0, 999, None, 2.70, 4.50, 0.93, 9.30, 0.31, 18.60, 0.93, 13.95, "mg/dL"),

    # LFTs
    ("Total Bilirubin", 0, 999, None, 0.0, 17.0, None, None, 0.0, 1000.0, 18.0, 600.0, "µmol/L"),
    ("Total Bilirubin", 0, 999, None, 0.0, 1.0, None, None, 0.0, 58.5, 1.05, 35.1, "mg/dL"),
    ("Direct Bilirubin", 0, 999, None, 0.0, 4.4, None, None, 0.0, 1000.0, 4.5, 400.0, "µmol/L"),
    ("Direct Bilirubin", 0, 999, None, 0.0, 0.26, None, None, 0.0, 58.5, 0.26, 23.40, "mg/dL"),
    ("Total Protein", 0, 999, None, 64.0, 83.0, 30.0, 120.0, 15.0, 200.0, 30.0, 150.0, "g/L"),
    ("Total Protein", 0, 999, None, 6.4, 8.3, 3.0, 12.0, 1.5, 20.0, 3.0, 15.0, "g/dL"),
    ("Serum Albumin", 0, 999, None, 35.0, 50.0, 15.0, 60.0, 5.0, 80.0, 10.0, 65.0, "g/L"),
    ("Serum Albumin", 0, 999, None, 3.5, 5.0, 1.5, 6.0, 0.5, 8.0, 1.0, 6.5, "g/dL"),
    ("ALT / SGPT (Alanine Aminotransferase)", 12, 999, "Male", 0.0, 41.0, None, None, 0.0, 12000.0, 42.0, 5000.0, "U/L"),
    ("ALT / SGPT (Alanine Aminotransferase)", 12, 999, "Male", 0.0, 0.68, None, None, 0.0, 200.0, 0.70, 83.50, "µkat/L"),
    ("ALT / SGPT (Alanine Aminotransferase)", 12, 999, "Female", 0.0, 31.0, None, None, 0.0, 12000.0, 32.0, 4000.0, "U/L"),
    ("ALT / SGPT (Alanine Aminotransferase)", 12, 999, "Female", 0.0, 0.52, None, None, 0.0, 200.0, 0.53, 66.80, "µkat/L"),
    ("ALT / SGPT (Alanine Aminotransferase)", 0, 11, None, 0.0, 35.0, None, None, 0.0, 12000.0, 36.0, 3000.0, "U/L"),
    ("ALT / SGPT (Alanine Aminotransferase)", 0, 11, None, 0.0, 0.58, None, None, 0.0, 200.0, 0.60, 50.10, "µkat/L"),
    ("AST / SGOT (Aspartate Aminotransferase)", 12, 999, "Male", 0.0, 38.0, None, None, 0.0, 15000.0, 39.0, 8000.0, "U/L"),
    ("AST / SGOT (Aspartate Aminotransferase)", 12, 999, "Male", 0.0, 0.63, None, None, 0.0, 250.0, 0.65, 133.60, "µkat/L"),
    ("AST / SGOT (Aspartate Aminotransferase)", 12, 999, "Female", 0.0, 32.0, None, None, 0.0, 15000.0, 33.0, 6000.0, "U/L"),
    ("AST / SGOT (Aspartate Aminotransferase)", 12, 999, "Female", 0.0, 0.53, None, None, 0.0, 250.0, 0.55, 100.20, "µkat/L"),
    ("AST / SGOT (Aspartate Aminotransferase)", 0, 11, None, 0.0, 40.0, None, None, 0.0, 15000.0, 41.0, 4000.0, "U/L"),
    ("AST / SGOT (Aspartate Aminotransferase)", 0, 11, None, 0.0, 0.67, None, None, 0.0, 250.0, 0.68, 66.80, "µkat/L"),
    ("Alkaline Phosphatase (ALP)", 12, 999, "Male", 40.0, 129.0, None, None, 10.0, 5000.0, 130.0, 2000.0, "U/L"),
    ("Alkaline Phosphatase (ALP)", 12, 999, "Male", 0.67, 2.15, None, None, 0.17, 83.50, 2.17, 33.40, "µkat/L"),
    ("Alkaline Phosphatase (ALP)", 12, 999, "Female", 35.0, 104.0, None, None, 10.0, 5000.0, 105.0, 1800.0, "U/L"),
    ("Alkaline Phosphatase (ALP)", 12, 999, "Female", 0.58, 1.74, None, None, 0.17, 83.50, 1.75, 30.06, "µkat/L"),
    ("Alkaline Phosphatase (ALP)", 0, 11, None, 0.0, 350.0, None, None, 10.0, 5000.0, 351.0, 1200.0, "U/L"),
    ("Alkaline Phosphatase (ALP)", 0, 11, None, 0.0, 5.85, None, None, 0.17, 83.50, 5.87, 20.04, "µkat/L"),
    ("Gamma-Glutamyl Transferase (GGT)", 0, 999, "Male", 10.0, 66.0, None, None, 0.0, 4000.0, 67.0, 1500.0, "U/L"),
    ("Gamma-Glutamyl Transferase (GGT)", 0, 999, "Male", 0.17, 1.10, None, None, 0.0, 66.80, 1.12, 25.05, "µkat/L"),
    ("Gamma-Glutamyl Transferase (GGT)", 0, 999, "Female", 9.0, 35.0, None, None, 0.0, 4000.0, 36.0, 1000.0, "U/L"),
    ("Gamma-Glutamyl Transferase (GGT)", 0, 999, "Female", 0.15, 0.58, None, None, 0.0, 66.80, 0.60, 16.70, "µkat/L"),

    # Lipids
    ("Total Cholesterol", 0, 999, None, 0.0, 5.2, 6.2, None, 1.0, 25.0, 1.0, 20.0, "mmol/L"),
    ("Total Cholesterol", 0, 999, None, 0.0, 201.0, 240.0, None, 38.6, 965.3, 38.6, 772.0, "mg/dL"),
    ("Triglycerides", 0, 999, None, 0.0, 3.3, 4.52, None, 0.1, 45.0, 3.4, 45.0, "mmol/L"),
    ("Triglycerides", 0, 999, None, 0.0, 292.0, 400.0, None, 8.8, 3982.5, 301.0, 3982.0, "mg/dL"),
    ("HDL Cholesterol", 0, 999, "Male", 1.45, 5.0, 0.90, None, 0.1, 5.0, 0.5, 3.0, "mmol/L"),
    ("HDL Cholesterol", 0, 999, "Male", 56.0, 193.1, 35.0, None, 3.9, 193.1, 19.3, 115.8, "mg/dL"),
    ("HDL Cholesterol", 0, 999, "Female", 1.68, 5.0, 0.90, None, 0.1, 5.0, 0.5, 3.0, "mmol/L"),
    ("HDL Cholesterol", 0, 999, "Female", 65.0, 193.1, 35.0, None, 3.9, 193.1, 19.3, 115.8, "mg/dL"),
    ("LDL Cholesterol", 0, 999, None, 0.0, 3.59, 4.14, None, 0.2, 20.0, 3.59, 15.0, "mmol/L"),
    ("LDL Cholesterol", 0, 999, None, 0.0, 139.0, 160.0, None, 7.7, 772.2, 139.0, 579.0, "mg/dL"),

    # Cardiac
    ("Total CK (Creatine Kinase)", 0, 999, "Male", 39.0, 308.0, None, None, 10.0, 250000.0, 309.0, 100000.0, "U/L"),
    ("Total CK (Creatine Kinase)", 0, 999, "Male", 0.65, 5.14, None, None, 0.17, 4175.0, 5.16, 1670.0, "µkat/L"),
    ("Total CK (Creatine Kinase)", 0, 999, "Female", 26.0, 140.0, None, None, 10.0, 250000.0, 141.0, 80000.0, "U/L"),
    ("Total CK (Creatine Kinase)", 0, 999, "Female", 0.43, 2.34, None, None, 0.17, 4175.0, 2.36, 1336.0, "µkat/L"),
    ("CK-MB (Creatine Kinase-MB)", 0, 999, None, 7.0, 25.0, None, None, 0.0, 250000.0, 26.0, 1500.0, "U/L"),
    ("CK-MB (Creatine Kinase-MB)", 0, 999, None, 0.12, 0.42, None, None, 0.0, 4175.0, 0.43, 25.05, "µkat/L"),
    ("Troponin I (cTnI)", 0, 999, None, 0.0, 0.1, 0.1, None, 0.0, 150.0, 0.1, 150.0, "ng/mL"),
    ("Troponin I (cTnI)", 0, 999, None, 0.0, 0.1, 0.1, None, 0.0, 150.0, 0.1, 150.0, "µg/L"),
    ("Myoglobin", 0, 999, "Male", 16.0, 76.0, None, None, 2.0, 5000.0, 65.0, 3000.0, "ng/mL"),
    ("Myoglobin", 0, 999, "Male", 16.0, 76.0, None, None, 2.0, 5000.0, 65.0, 3000.0, "µg/L"),
    ("Myoglobin", 0, 999, "Female", 7.0, 64.0, None, None, 2.0, 5000.0, 65.0, 3000.0, "ng/mL"),
    ("Myoglobin", 0, 999, "Female", 7.0, 64.0, None, None, 2.0, 5000.0, 65.0, 3000.0, "µg/L"),

    # CD4 T-Lymphocyte Monitoring
    ("Absolute CD4 Count (Cytometry)", 5, 999, None, 500.0, 1500.0, 200.0, None, 0.0, 5000.0, 10.0, 3000.0, "cells/µL"),
    ("CD4 COUNT", 5, 999, None, 500.0, 1500.0, 200.0, None, 0.0, 5000.0, 10.0, 3000.0, "cells/µL"),
    ("CD4 Percentage", 0, 4, None, 25.0, 65.0, 25.0, None, 0.0, 100.0, 5.0, 65.0, "%"),

    # Non-CBC Hematology & Coagulation
    ("E.S.R (Erythrocyte Sedimentation Rate)", 0, 50, "Male", 0.0, 15.0, None, None, 0.0, 150.0, 0.0, 140.0, "mm/hour"),
    ("E.S.R (Erythrocyte Sedimentation Rate)", 51, 999, "Male", 0.0, 20.0, None, None, 0.0, 150.0, 0.0, 140.0, "mm/hour"),
    ("E.S.R (Erythrocyte Sedimentation Rate)", 0, 50, "Female", 0.0, 20.0, None, None, 0.0, 150.0, 0.0, 140.0, "mm/hour"),
    ("E.S.R (Erythrocyte Sedimentation Rate)", 51, 999, "Female", 0.0, 30.0, None, None, 0.0, 150.0, 0.0, 140.0, "mm/hour"),
    ("E.S.R (Erythrocyte Sedimentation Rate)", 0, 11, None, 3.0, 13.0, None, None, 0.0, 150.0, 0.0, 140.0, "mm/hour"),

    ("Prothrombin Time (PT)", 0, 999, None, 11.0, 13.5, None, 30.0, 5.0, 120.0, 9.0, 60.0, "Seconds"),
    ("International Normalized Ratio (INR)", 0, 999, None, 0.8, 1.2, 0.5, 4.5, 0.2, 15.0, 0.5, 8.0, "Calculated ratio"),
    ("Aptt (Activated Partial Thromboplastin Time)", 0, 999, None, 25.0, 35.0, None, 70.0, 10.0, 180.0, 20.0, 100.0, "Seconds"),
    ("Bleeding Time (BT)", 0, 999, None, 2.0, 7.0, None, 15.0, 0.5, 30.0, 1.0, 20.0, "Minutes"),
    ("Clotting Time (CT)", 0, 999, None, 4.0, 10.0, None, 20.0, 1.0, 45.0, 2.0, 25.0, "Minutes"),
    ("Reticulocyte Count", 0, 999, None, 0.5, 2.5, None, None, 0.0, 30.0, 0.1, 20.0, "%"),
]

def seed_reference_ranges(cur):
    for pname, age_min, age_max, sex, n_min, n_max, c_min, c_max, s_min, s_max, p_min, p_max, unit in DEFAULT_REFERENCE_RANGES:
        cur.execute("SELECT id FROM tests WHERE name = ?", (pname,))
        t_row = cur.fetchone()
        test_id = t_row["id"] if t_row else None

        # Check existing rule
        cur.execute("""
            SELECT id FROM reference_ranges
            WHERE parameter_name = ? AND age_min = ? AND age_max = ? 
              AND (sex = ? OR (sex IS NULL AND ? IS NULL))
              AND (unit = ? OR (unit IS NULL AND ? IS NULL))
        """, (pname, age_min, age_max, sex, sex, unit, unit))
        existing = cur.fetchone()
        if not existing:
            cur.execute("""
                INSERT INTO reference_ranges (test_id, parameter_name, age_min, age_max, sex, normal_min, normal_max, critical_min, critical_max, sanity_min, sanity_max, plausible_min, plausible_max, unit)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (test_id, pname, age_min, age_max, sex, n_min, n_max, c_min, c_max, s_min, s_max, p_min, p_max, unit))
        else:
            cur.execute("""
                UPDATE reference_ranges
                SET test_id = ?, normal_min = ?, normal_max = ?, critical_min = ?, critical_max = ?, sanity_min = ?, sanity_max = ?, plausible_min = ?, plausible_max = ?, unit = ?
                WHERE id = ?
            """, (test_id, n_min, n_max, c_min, c_max, s_min, s_max, p_min, p_max, unit, existing["id"]))

def seed_specimens(cur):
    for s in SPECIMEN_TYPES:
        cur.execute("SELECT id FROM specimen_types WHERE name = ?", (s["name"],))
        row = cur.fetchone()
        if not row:
            cur.execute("""
                INSERT INTO specimen_types (name, container, min_volume, storage_temp, sort_order)
                VALUES (?, ?, ?, ?, ?)
            """, (s["name"], s.get("container"), s.get("min_volume"), s.get("storage_temp"), s.get("sort_order", 0)))
        else:
            row_id = row["id"] if isinstance(row, dict) or hasattr(row, '__getitem__') else row[0]
            cur.execute("""
                UPDATE specimen_types
                SET container = ?, min_volume = ?, storage_temp = ?, sort_order = ?
                WHERE id = ?
            """, (s.get("container"), s.get("min_volume"), s.get("storage_temp"), s.get("sort_order", 0), row_id))


def seed_database(conn=None):
    should_close = False
    if conn is None:
        print("Initializing database schema...")
        init_db()
        conn = get_connection()
        conn.row_factory = sqlite3.Row
        should_close = True
    else:
        conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    # Wards
    wards = ["ANC", "MCH", "Emergency", "Theater", "Labour", "OPD", "IPD", "PAEDIATRIC", "TB Clinic"]
    for w_name in wards:
        cur.execute("INSERT OR IGNORE INTO wards (name) VALUES (?)", (w_name,))

    # Sections
    sec_map = {}
    for idx, name in enumerate(SECTIONS, 1):
        cur.execute("SELECT id FROM sections WHERE name = ?", (name,))
        row = cur.fetchone()
        if not row:
            cur.execute("INSERT INTO sections (name, sort_order) VALUES (?, ?)", (name, idx))
            sec_id = cur.lastrowid
        else:
            sec_id = row["id"]
        sec_map[name] = sec_id

    conn.commit()

    # Rename migrations
    cur.execute("UPDATE tests SET name = 'Complete Blood Count (CBC)' WHERE name = 'CBC'")
    cur.execute("UPDATE tests SET name = 'HIV Testing' WHERE name IN ('HIV (MoH Three-Test Algorithm)', 'HIV Testing Service')")

    # Clean relative count test names
    rel_names = [
        ('Neutrophils (%) \\[Relative Count\\]', 'Neutrophils (%) [Relative Count]'),
        ('Lymphocytes (%) \\[Relative Count\\]', 'Lymphocytes (%) [Relative Count]'),
        ('Monocytes (%) \\[Relative Count\\]', 'Monocytes (%) [Relative Count]'),
        ('Eosinophils (%) \\[Relative Count\\]', 'Eosinophils (%) [Relative Count]'),
        ('Basophils (%) \\[Relative Count\\]', 'Basophils (%) [Relative Count]')
    ]
    for old_n, new_n in rel_names:
        cur.execute("UPDATE tests SET name = ? WHERE name = ?", (new_n, old_n))

    # Urinalysis structure migration — remove old parameters replaced by the new tripartite structure
    old_urinalysis_params = [
        'Macroscopy (Physical Profile)',   # replaced by Color + Turbidity
        'Microscopy (Sediment Cytology)',  # replaced by 5 individual microscopy sub-parameters
    ]
    for old_param in old_urinalysis_params:
        # Delete result values referencing this test, then the test itself
        cur.execute("""
            DELETE FROM test_results WHERE parameter_id IN (
                SELECT id FROM tests WHERE name = ?
            )
        """, (old_param,))
        cur.execute("DELETE FROM tests WHERE name = ?", (old_param,))

    # Migrate Specific Gravity and PH from quantitative to options
    cur.execute("""
        UPDATE tests SET result_type = 'options', default_unit = NULL,
            options = '["1.000","1.005","1.010","1.015","1.020","1.025","1.030"]'
        WHERE name = 'Specific Gravity (S.G)'
    """)
    cur.execute("""
        UPDATE tests SET result_type = 'options', default_unit = NULL,
            options = '["5.0","6.0","6.5","7.0","7.5","8.0","8.5"]'
        WHERE name = 'PH'
    """)

    conn.commit()


    test_id_map = {}

    for t in TESTS:
        if t.get("parent_name"):
            continue
        sec_id = sec_map.get(t["section"])
        if not sec_id:
            continue
        opts = json.dumps(t["options"]) if t["options"] else None
        clin_comments = t.get("clinical_comments")
        cur.execute("SELECT id FROM tests WHERE name = ? AND section_id = ?", (t["name"], sec_id))
        r = cur.fetchone()
        tracks_stock = t.get("tracks_stock", 0)
        consumable = t.get("consumable_name")
        if not r:
            cur.execute("""
                INSERT INTO tests (name, section_id, is_tracked, sort_order, result_type,
                    default_unit, secondary_unit, ref_range, options, clinical_comments, tracks_stock, consumable_name)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (t["name"], sec_id, t["is_tracked"], t["sort_order"], t["result_type"],
                  t["default_unit"], t["secondary_unit"], t["ref_range"], opts, clin_comments, tracks_stock, consumable))
            test_id_map[t["name"]] = cur.lastrowid
        else:
            cur.execute("""
                UPDATE tests SET is_tracked=?, result_type=?, default_unit=?, secondary_unit=?, ref_range=?, options=?, clinical_comments=?, tracks_stock=?, consumable_name=?
                WHERE id=?
            """, (t["is_tracked"], t["result_type"], t["default_unit"], t["secondary_unit"], t["ref_range"], opts, clin_comments, tracks_stock, consumable, r["id"]))
            test_id_map[t["name"]] = r["id"]

    conn.commit()

    # Clean legacy short-named parameters and decouple EID from HIV Testing if any
    hiv_parent_id = test_id_map.get("HIV Testing")
    if hiv_parent_id:
        cur.execute("DELETE FROM test_parameters WHERE test_id = ? AND parameter_name IN ('Determine', 'Stat-Pak', 'SD Bioline')", (hiv_parent_id,))
        cur.execute("DELETE FROM test_parameters WHERE test_id = ? AND parameter_name LIKE 'EID %'", (hiv_parent_id,))
        cur.execute("UPDATE tests SET parent_rollup_id = NULL WHERE name LIKE 'EID %'")

    for t in TESTS:
        if not t.get("parent_name"):
            continue
        parent_id = test_id_map.get(t["parent_name"])
        if not parent_id:
            continue
        sec_id = sec_map.get(t["section"])
        if not sec_id:
            sec_id = list(sec_map.values())[0]
        opts = json.dumps(t["options"]) if t["options"] else None
        clin_comments = t.get("clinical_comments")
        cur.execute("SELECT id FROM tests WHERE name = ? AND section_id = ? AND parent_rollup_id = ?", (t["name"], sec_id, parent_id))
        r = cur.fetchone()
        if not r:
            cur.execute("""INSERT OR IGNORE INTO tests (name, section_id, is_tracked, sort_order, result_type,
                    default_unit, secondary_unit, ref_range, options, parent_rollup_id, clinical_comments)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (t["name"], sec_id, t["is_tracked"], t["sort_order"], t["result_type"],
                  t["default_unit"], t["secondary_unit"], t["ref_range"], opts, parent_id, clin_comments))
        else:
            cur.execute("""
                UPDATE tests SET result_type=?, default_unit=?, secondary_unit=?, ref_range=?, options=?, sort_order=?, parent_rollup_id=?, clinical_comments=?
                WHERE id=?
            """, (t["result_type"], t["default_unit"], t["secondary_unit"], t["ref_range"], opts, t["sort_order"], parent_id, clin_comments, r["id"]))


        # Also sync into test_parameters for panel sub-parameter tracking and FK constraints
        cur.execute("SELECT id FROM test_parameters WHERE test_id = ? AND parameter_name = ?", (parent_id, t["name"]))
        tp_row = cur.fetchone()
        if not tp_row:
            cur.execute("""
                INSERT INTO test_parameters (test_id, parameter_name, unit, secondary_unit, ref_range, sort_order, options)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """, (parent_id, t["name"], t["default_unit"], t.get("secondary_unit"), t["ref_range"], t["sort_order"], opts))
        else:
            cur.execute("""
                UPDATE test_parameters SET unit = ?, secondary_unit = ?, ref_range = ?, sort_order = ?, options = ?
                WHERE id = ?
            """, (t["default_unit"], t.get("secondary_unit"), t["ref_range"], t["sort_order"], opts, tp_row["id"]))

    # Seed WIDAL parameters under WIDAL test
    cur.execute("SELECT id FROM tests WHERE name LIKE '%WIDAL%'")
    widal_row = cur.fetchone()
    if widal_row:
        widal_id = widal_row["id"]
        WIDAL_PARAMS = [
            ("Salmonella typhi O (TO)", None, "Significant if >= 1:80", 1, '["Not Done", "< 1:20 (Low / Normal)", "1:20 (Low / Normal)", "1:40 (Low / Normal)", "1:80 (Borderline Significant)", "1:160 (High / Reactive)", "1:320 (High / Reactive)", ">= 1:640 (Very High / Reactive)"]'),
            ("Salmonella typhi H (TH)", None, "Significant if >= 1:80", 2, '["Not Done", "< 1:20 (Low / Normal)", "1:20 (Low / Normal)", "1:40 (Low / Normal)", "1:80 (Borderline Significant)", "1:160 (High / Reactive)", "1:320 (High / Reactive)", ">= 1:640 (Very High / Reactive)"]'),
            ("Salmonella paratyphi A (AO)", None, "Significant if >= 1:80", 3, '["Not Done", "< 1:20 (Low / Normal)", "1:20 (Low / Normal)", "1:40 (Low / Normal)", "1:80 (Borderline Significant)", "1:160 (High / Reactive)", "1:320 (High / Reactive)", ">= 1:640 (Very High / Reactive)"]'),
            ("Salmonella paratyphi B (BH)", None, "Significant if >= 1:80", 4, '["Not Done", "< 1:20 (Low / Normal)", "1:20 (Low / Normal)", "1:40 (Low / Normal)", "1:80 (Borderline Significant)", "1:160 (High / Reactive)", "1:320 (High / Reactive)", ">= 1:640 (Very High / Reactive)"]'),
        ]
        for pname, punit, pref, porder, popts in WIDAL_PARAMS:
            cur.execute("SELECT id FROM test_parameters WHERE test_id = ? AND parameter_name = ?", (widal_id, pname))
            tp_r = cur.fetchone()
            if not tp_r:
                cur.execute("""
                    INSERT INTO test_parameters (test_id, parameter_name, unit, ref_range, sort_order, options)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (widal_id, pname, punit, pref, porder, popts))
            else:
                cur.execute("""
                    UPDATE test_parameters SET unit = ?, ref_range = ?, sort_order = ?, options = ?
                    WHERE id = ?
                """, (punit, pref, porder, popts, tp_r["id"]))

    # Seed Malaria Microscopy parameters under Blood smear for Malaria Parasites
    cur.execute("SELECT id FROM tests WHERE name LIKE '%Blood smear%' OR name LIKE '%Malaria Microscopy%'")
    mal_row = cur.fetchone()
    if mal_row:
        mal_id = mal_row["id"]
        MALARIA_PARAMS = [
            ("Examination Method / Film Done", None, None, 1, '["Thick Film", "Thin Film", "Both (Thick & Thin Film)"]'),
            ("Parasite Density (Thick Film)", None, None, 2, '["No malaria parasites seen", "1+ (1-10 parasites per 100 thick-film fields)", "2+ (11-100 parasites per 100 thick-film fields)", "3+ (1-10 parasites per single thick-film field)", "4+ (>10 parasites per single thick-film field)", "Not Done"]'),
            ("Species Identification (Thin Smear)", None, None, 3, '["Not Done", "Not Seen (No Parasites)", "Plasmodium falciparum", "Plasmodium vivax", "Plasmodium malariae", "Plasmodium ovale", "Mixed infection (P. falciparum + P. malariae)", "Mixed infection (P. falciparum + P. vivax)"]'),
        ]
        for pname, punit, pref, porder, popts in MALARIA_PARAMS:
            cur.execute("SELECT id FROM test_parameters WHERE test_id = ? AND parameter_name = ?", (mal_id, pname))
            tp_r = cur.fetchone()
            if not tp_r:
                cur.execute("""
                    INSERT INTO test_parameters (test_id, parameter_name, unit, ref_range, sort_order, options)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (mal_id, pname, punit, pref, porder, popts))
            else:
                cur.execute("UPDATE test_parameters SET sort_order = ?, options = ? WHERE id = ?", (porder, popts, tp_r["id"]))

    # Seed Immunohematology parameters
    BLOOD_GROUP_PARAMS = [
        ("Forward Anti-A", None, None, 1, '["Agglutination (+)", "No Agglutination (-)"]'),
        ("Forward Anti-B", None, None, 2, '["Agglutination (+)", "No Agglutination (-)"]'),
        ("Forward Anti-D", None, None, 3, '["Agglutination (+)", "No Agglutination (-)"]'),
        ("Reverse A1-cells", None, None, 4, '["Agglutination (+)", "No Agglutination (-)"]'),
        ("Reverse B-cells", None, None, 5, '["Agglutination (+)", "No Agglutination (-)"]'),
        ("Consolidated Blood Group", None, None, 6, '["A Rh(D) Positive", "A Rh(D) Negative", "B Rh(D) Positive", "B Rh(D) Negative", "AB Rh(D) Positive", "AB Rh(D) Negative", "O Rh(D) Positive", "O Rh(D) Negative", "Grouping Discrepancy"]'),
    ]
    cur.execute("SELECT id FROM tests WHERE LOWER(name) LIKE '%blood group%'")
    for bg_row in cur.fetchall():
        bg_id = bg_row["id"]
        for pname, punit, pref, porder, popts in BLOOD_GROUP_PARAMS:
            cur.execute("SELECT id FROM test_parameters WHERE test_id = ? AND parameter_name = ?", (bg_id, pname))
            tp_r = cur.fetchone()
            if not tp_r:
                cur.execute("""
                    INSERT INTO test_parameters (test_id, parameter_name, unit, ref_range, sort_order, options)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (bg_id, pname, punit, pref, porder, popts))
            else:
                cur.execute("UPDATE test_parameters SET sort_order = ?, options = ? WHERE id = ?", (porder, popts, tp_r["id"]))

    DIRECT_COOMBS_PARAMS = [
        ("DAT Qualitative Status", None, None, 1, '["Negative", "Positive"]'),
        ("Reaction Strength", None, None, 2, '["Negative", "Trace", "1+", "2+", "3+", "4+"]'),
        ("Reagent Specificity", None, None, 3, '["Polyspecific AHG", "Anti-IgG", "Anti-C3d"]'),
    ]
    cur.execute("SELECT id FROM tests WHERE LOWER(name) LIKE '%direct coombs%'")
    for dc_row in cur.fetchall():
        dc_id = dc_row["id"]
        for pname, punit, pref, porder, popts in DIRECT_COOMBS_PARAMS:
            cur.execute("SELECT id FROM test_parameters WHERE test_id = ? AND parameter_name = ?", (dc_id, pname))
            tp_r = cur.fetchone()
            if not tp_r:
                cur.execute("""
                    INSERT INTO test_parameters (test_id, parameter_name, unit, ref_range, sort_order, options)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (dc_id, pname, punit, pref, porder, popts))
            else:
                cur.execute("UPDATE test_parameters SET sort_order = ?, options = ? WHERE id = ?", (porder, popts, tp_r["id"]))

    INDIRECT_COOMBS_PARAMS = [
        ("IAT Qualitative Status", None, None, 1, '["Negative", "Positive"]'),
        ("Screening Cell I", None, None, 2, '["Negative", "Trace", "1+", "2+", "3+", "4+"]'),
        ("Screening Cell II", None, None, 3, '["Negative", "Trace", "1+", "2+", "3+", "4+"]'),
        ("Screening Cell III", None, None, 4, '["Negative", "Trace", "1+", "2+", "3+", "4+"]'),
    ]
    cur.execute("SELECT id FROM tests WHERE LOWER(name) LIKE '%indirect coombs%'")
    for ic_row in cur.fetchall():
        ic_id = ic_row["id"]
        for pname, punit, pref, porder, popts in INDIRECT_COOMBS_PARAMS:
            cur.execute("SELECT id FROM test_parameters WHERE test_id = ? AND parameter_name = ?", (ic_id, pname))
            tp_r = cur.fetchone()
            if not tp_r:
                cur.execute("""
                    INSERT INTO test_parameters (test_id, parameter_name, unit, ref_range, sort_order, options)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (ic_id, pname, punit, pref, porder, popts))
            else:
                cur.execute("UPDATE test_parameters SET sort_order = ?, options = ? WHERE id = ?", (porder, popts, tp_r["id"]))

    seed_reference_ranges(cur)
    seed_specimens(cur)
    conn.commit()
    if should_close:
        conn.close()
    print(f"Seeding done: {len(sec_map)} sections, {len(TESTS)} tests, {len(SPECIMEN_TYPES)} specimen types.")


if __name__ == "__main__":
    seed_database()
