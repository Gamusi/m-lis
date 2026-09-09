import os, sqlite3, logging

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DATA_DIR = os.path.join(BASE_DIR, "data")

DEFAULT_DB = os.path.join(DATA_DIR, "mlis.db")
LEGACY_DB = os.path.join(DATA_DIR, "amh_lab.db")
DB_PATH = os.environ.get("MLIS_DB_PATH", os.environ.get("AMH_DB_PATH", DEFAULT_DB))

logger = logging.getLogger("mlis_db")

SCHEMA_SQL = """
    CREATE TABLE IF NOT EXISTS facility_settings (
        id INTEGER PRIMARY KEY DEFAULT 1,
        facility_name TEXT NOT NULL DEFAULT 'Ahmadiyya Muslim Hospital',
        facility_acronym TEXT NOT NULL DEFAULT 'AMH',
        facility_code TEXT DEFAULT 'AMH',
        address TEXT DEFAULT 'P.O. Box 2309, Mbale, Uganda',
        phone TEXT DEFAULT '+256 700 000 000',
        email TEXT DEFAULT 'lab@hospital.org',
        letterhead_path TEXT,
        logo_path TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'staff',
        cadre TEXT,
        is_active BOOLEAN NOT NULL DEFAULT 1,
        password_reset_required BOOLEAN NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        token TEXT UNIQUE NOT NULL,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        section_id INTEGER NOT NULL REFERENCES sections(id),
        is_tracked BOOLEAN NOT NULL DEFAULT 0,
        parent_rollup_id INTEGER REFERENCES tests(id),
        is_active BOOLEAN NOT NULL DEFAULT 1,
        sort_order INTEGER DEFAULT 0,
        result_type TEXT DEFAULT 'qualitative',
        default_unit TEXT,
        secondary_unit TEXT,
        ref_range TEXT,
        panic_value_low FLOAT,
        panic_value_high FLOAT,
        options TEXT,
        clinical_comments TEXT,
        tracks_stock BOOLEAN NOT NULL DEFAULT 0,
        consumable_name TEXT,
        UNIQUE(name, section_id)
    );

    CREATE TABLE IF NOT EXISTS test_parameters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_id INTEGER NOT NULL REFERENCES tests(id),
        parameter_name TEXT NOT NULL,
        unit TEXT,
        secondary_unit TEXT,
        ref_range TEXT,
        sort_order INTEGER DEFAULT 0,
        options TEXT
    );

    CREATE TABLE IF NOT EXISTS daily_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_date DATE NOT NULL,
        test_id INTEGER NOT NULL REFERENCES tests(id),
        done INTEGER NOT NULL DEFAULT 0,
        positive INTEGER,
        in_house INTEGER NOT NULL DEFAULT 0,
        referral INTEGER NOT NULL DEFAULT 0,
        outreach INTEGER NOT NULL DEFAULT 0,
        self_request INTEGER NOT NULL DEFAULT 0,
        entered_by_user_id INTEGER REFERENCES users(id),
        entered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by_user_id INTEGER REFERENCES users(id),
        updated_at DATETIME,
        UNIQUE(entry_date, test_id)
    );

    CREATE TABLE IF NOT EXISTS backlog_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entry_date DATE NOT NULL,
        test_id INTEGER NOT NULL REFERENCES tests(id),
        done INTEGER NOT NULL DEFAULT 0,
        positive INTEGER,
        in_house INTEGER NOT NULL DEFAULT 0,
        referral INTEGER NOT NULL DEFAULT 0,
        outreach INTEGER NOT NULL DEFAULT 0,
        self_request INTEGER NOT NULL DEFAULT 0,
        entered_by_user_id INTEGER REFERENCES users(id),
        entered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_by_user_id INTEGER REFERENCES users(id),
        updated_at DATETIME,
        UNIQUE(entry_date, test_id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        action TEXT NOT NULL,
        detail TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_number TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        date_of_birth DATE,
        age_years FLOAT,
        age_category TEXT,
        sex TEXT,
        phone TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS clinicians (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS wards (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        is_active INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS sequence_tracker (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        seq_name TEXT UNIQUE NOT NULL,
        last_value INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS specimen_types (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        container TEXT,
        min_volume TEXT,
        storage_temp TEXT,
        is_active BOOLEAN NOT NULL DEFAULT 1,
        sort_order INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER NOT NULL REFERENCES clients(id),
        clinician_id INTEGER REFERENCES clinicians(id),
        ward_of_origin TEXT,
        lab_number TEXT UNIQUE,
        order_category TEXT DEFAULT 'in-house',
        specimen_type_id INTEGER REFERENCES specimen_types(id),
        dispatched_at DATETIME,
        dispatched_to TEXT,
        dispatched_by_user_id INTEGER REFERENCES users(id),
        is_deleted BOOLEAN NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS test_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visit_id INTEGER NOT NULL REFERENCES visits(id),
        test_id INTEGER NOT NULL REFERENCES tests(id),
        sample_id TEXT,
        specimen_type_id INTEGER REFERENCES specimen_types(id),
        ordered_by_user_id INTEGER REFERENCES users(id),
        ordered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'pending',
        order_category TEXT DEFAULT 'in-house'
    );

    CREATE TABLE IF NOT EXISTS test_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES test_orders(id),
        parameter_id INTEGER REFERENCES test_parameters(id),
        result_value TEXT,
        result_unit TEXT,
        clinical_flag TEXT,
        is_positive BOOLEAN,
        entered_by_user_id INTEGER REFERENCES users(id),
        entered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        verified_by_user_id INTEGER REFERENCES users(id),
        verified_at DATETIME,
        edit_reason TEXT,
        edited_by_user_id INTEGER REFERENCES users(id),
        edited_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS reference_ranges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_id INTEGER REFERENCES tests(id),
        parameter_name TEXT NOT NULL,
        age_min INTEGER DEFAULT 0,
        age_max INTEGER DEFAULT 999,
        sex TEXT,
        normal_min REAL,
        normal_max REAL,
        critical_min REAL,
        critical_max REAL,
        sanity_min REAL,
        sanity_max REAL,
        plausible_min REAL,
        plausible_max REAL,
        unit TEXT
    );

    CREATE TABLE IF NOT EXISTS diagnostic_kit_lots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        test_id INTEGER REFERENCES tests(id),
        kit_name TEXT NOT NULL,
        category TEXT DEFAULT 'General',
        lot_number TEXT NOT NULL,
        expiry_date DATE NOT NULL,
        initial_quantity INTEGER NOT NULL,
        current_quantity INTEGER NOT NULL,
        min_threshold INTEGER DEFAULT 25,
        is_active BOOLEAN DEFAULT 1,
        received_date DATE DEFAULT (DATE('now')),
        received_by_user_id INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS diagnostic_kit_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        lot_id INTEGER NOT NULL REFERENCES diagnostic_kit_lots(id),
        transaction_type TEXT NOT NULL,
        quantity_delta INTEGER NOT NULL,
        order_id INTEGER REFERENCES test_orders(id),
        reason TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        user_id INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS donor_crossmatches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES test_orders(id) ON DELETE CASCADE,
        donor_unit_id TEXT NOT NULL,
        donor_blood_group TEXT NOT NULL,
        product_type TEXT NOT NULL,
        expiry_date DATE NOT NULL,
        phase_is TEXT NOT NULL,
        phase_thermophase TEXT NOT NULL,
        phase_ahg TEXT NOT NULL,
        compatibility_status TEXT NOT NULL,
        release_status TEXT NOT NULL,
        clinical_summary TEXT NOT NULL,
        is_locked BOOLEAN NOT NULL DEFAULT 0,
        entered_by_user_id INTEGER REFERENCES users(id),
        verified_by_user_id INTEGER REFERENCES users(id),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS culture_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL UNIQUE REFERENCES test_orders(id) ON DELETE CASCADE,
        phase INTEGER NOT NULL DEFAULT 1,
        preliminary_micro TEXT,
        preliminary_micro_date DATETIME,
        colony_count_cfu TEXT,
        growth_category TEXT,
        incubation_hours INTEGER DEFAULT 24,
        media_used TEXT,
        clinical_notes TEXT,
        is_emergency_callback_done BOOLEAN DEFAULT 0,
        emergency_callback_time DATETIME,
        emergency_callback_recipient TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS culture_isolates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        culture_order_id INTEGER NOT NULL REFERENCES culture_orders(id) ON DELETE CASCADE,
        isolate_number INTEGER NOT NULL DEFAULT 1,
        organism_name TEXT NOT NULL,
        colony_morphology TEXT,
        is_pathogen BOOLEAN NOT NULL DEFAULT 1,
        is_contaminant BOOLEAN NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS culture_ast_results (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        isolate_id INTEGER NOT NULL REFERENCES culture_isolates(id) ON DELETE CASCADE,
        antimicrobial_class TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        measurement_type TEXT NOT NULL DEFAULT 'zone_mm',
        measurement_value REAL,
        raw_sir TEXT NOT NULL,
        overridden_sir TEXT NOT NULL,
        override_reason TEXT,
        clinical_note TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_clients_full_name ON clients(full_name);
    CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone);
    CREATE INDEX IF NOT EXISTS idx_visits_client_id ON visits(client_id);
    CREATE INDEX IF NOT EXISTS idx_test_orders_visit_id ON test_orders(visit_id);
    CREATE INDEX IF NOT EXISTS idx_test_results_order_id ON test_results(order_id);
    CREATE INDEX IF NOT EXISTS idx_daily_entries_date_test ON daily_entries(entry_date, test_id);
    CREATE INDEX IF NOT EXISTS idx_stock_tx_lot_id ON diagnostic_kit_transactions(lot_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
    CREATE INDEX IF NOT EXISTS idx_donor_crossmatches_order_id ON donor_crossmatches(order_id);
    CREATE INDEX IF NOT EXISTS idx_donor_crossmatches_unit ON donor_crossmatches(donor_unit_id);
    CREATE INDEX IF NOT EXISTS idx_culture_orders_order_id ON culture_orders(order_id);
    CREATE INDEX IF NOT EXISTS idx_culture_isolates_order_id ON culture_isolates(culture_order_id);
    CREATE INDEX IF NOT EXISTS idx_culture_ast_isolate_id ON culture_ast_results(isolate_id);
"""

def get_connection():
    db_dir = os.path.dirname(os.path.abspath(DB_PATH))
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    # Automatic migration from legacy amh_lab.db if mlis.db does not exist yet
    if DB_PATH == DEFAULT_DB and not os.path.exists(DEFAULT_DB) and os.path.exists(LEGACY_DB):
        try:
            import shutil
            shutil.copy2(LEGACY_DB, DEFAULT_DB)
            logger.info(f"Auto-migrated legacy database from {LEGACY_DB} to {DEFAULT_DB}")
        except Exception as e:
            logger.warning(f"Could not copy legacy database: {e}")
    conn = sqlite3.connect(DB_PATH, timeout=10.0, check_same_thread=False)
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    conn.execute("PRAGMA busy_timeout = 5000;")

    # Ensure daily_entries category columns and backlog_entries table exist
    try:
        cur = conn.cursor()
        cur.execute("PRAGMA table_info(daily_entries)")
        cols = {r[1] for r in cur.fetchall()}
        if cols:
            for c in ["in_house", "referral", "outreach", "self_request"]:
                if c not in cols:
                    cur.execute(f"ALTER TABLE daily_entries ADD COLUMN {c} INTEGER NOT NULL DEFAULT 0")
        
        cur.execute("""
            CREATE TABLE IF NOT EXISTS backlog_entries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_date DATE NOT NULL,
                test_id INTEGER NOT NULL REFERENCES tests(id),
                done INTEGER NOT NULL DEFAULT 0,
                positive INTEGER,
                in_house INTEGER NOT NULL DEFAULT 0,
                referral INTEGER NOT NULL DEFAULT 0,
                outreach INTEGER NOT NULL DEFAULT 0,
                self_request INTEGER NOT NULL DEFAULT 0,
                entered_by_user_id INTEGER REFERENCES users(id),
                entered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_by_user_id INTEGER REFERENCES users(id),
                updated_at DATETIME,
                UNIQUE(entry_date, test_id)
            );
        """)
        conn.commit()
    except Exception as e:
        logger.debug(f"Column/table migration check: {e}")

    _ensure_transfusion_schema(conn)

    logger.debug(f"Connected to database at {DB_PATH}")
    return conn

def _ensure_transfusion_schema(conn):
    try:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS donor_crossmatches (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL REFERENCES test_orders(id) ON DELETE CASCADE,
                donor_unit_id TEXT NOT NULL,
                donor_blood_group TEXT NOT NULL,
                product_type TEXT NOT NULL,
                expiry_date DATE NOT NULL,
                phase_is TEXT NOT NULL,
                phase_thermophase TEXT NOT NULL,
                phase_ahg TEXT NOT NULL,
                compatibility_status TEXT NOT NULL,
                release_status TEXT NOT NULL,
                clinical_summary TEXT NOT NULL,
                is_locked BOOLEAN NOT NULL DEFAULT 0,
                entered_by_user_id INTEGER REFERENCES users(id),
                verified_by_user_id INTEGER REFERENCES users(id),
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur.execute("CREATE INDEX IF NOT EXISTS idx_donor_crossmatches_order_id ON donor_crossmatches(order_id);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_donor_crossmatches_unit ON donor_crossmatches(donor_unit_id);")

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
            bg_id = bg_row[0]
            for pname, punit, pref, porder, popts in BLOOD_GROUP_PARAMS:
                cur.execute("SELECT id FROM test_parameters WHERE test_id = ? AND parameter_name = ?", (bg_id, pname))
                p_ex = cur.fetchone()
                if not p_ex:
                    cur.execute("""
                        INSERT INTO test_parameters (test_id, parameter_name, unit, ref_range, sort_order, options)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (bg_id, pname, punit, pref, porder, popts))
                else:
                    cur.execute("UPDATE test_parameters SET sort_order = ?, options = ? WHERE id = ?", (porder, popts, p_ex[0]))

        DIRECT_COOMBS_PARAMS = [
            ("DAT Qualitative Status", None, None, 1, '["Negative", "Positive"]'),
            ("Reaction Strength", None, None, 2, '["Negative", "Trace", "1+", "2+", "3+", "4+"]'),
            ("Reagent Specificity", None, None, 3, '["Polyspecific AHG", "Anti-IgG", "Anti-C3d"]'),
        ]
        cur.execute("SELECT id FROM tests WHERE LOWER(name) LIKE '%direct coombs%'")
        for dc_row in cur.fetchall():
            dc_id = dc_row[0]
            for pname, punit, pref, porder, popts in DIRECT_COOMBS_PARAMS:
                cur.execute("SELECT id FROM test_parameters WHERE test_id = ? AND parameter_name = ?", (dc_id, pname))
                p_ex = cur.fetchone()
                if not p_ex:
                    cur.execute("""
                        INSERT INTO test_parameters (test_id, parameter_name, unit, ref_range, sort_order, options)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (dc_id, pname, punit, pref, porder, popts))
                else:
                    cur.execute("UPDATE test_parameters SET sort_order = ?, options = ? WHERE id = ?", (porder, popts, p_ex[0]))

        INDIRECT_COOMBS_PARAMS = [
            ("IAT Qualitative Status", None, None, 1, '["Negative", "Positive"]'),
            ("Screening Cell I", None, None, 2, '["Negative", "Trace", "1+", "2+", "3+", "4+"]'),
            ("Screening Cell II", None, None, 3, '["Negative", "Trace", "1+", "2+", "3+", "4+"]'),
            ("Screening Cell III", None, None, 4, '["Negative", "Trace", "1+", "2+", "3+", "4+"]'),
        ]
        cur.execute("SELECT id FROM tests WHERE LOWER(name) LIKE '%indirect coombs%'")
        for ic_row in cur.fetchall():
            ic_id = ic_row[0]
            for pname, punit, pref, porder, popts in INDIRECT_COOMBS_PARAMS:
                cur.execute("SELECT id FROM test_parameters WHERE test_id = ? AND parameter_name = ?", (ic_id, pname))
                p_ex = cur.fetchone()
                if not p_ex:
                    cur.execute("""
                        INSERT INTO test_parameters (test_id, parameter_name, unit, ref_range, sort_order, options)
                        VALUES (?, ?, ?, ?, ?, ?)
                    """, (ic_id, pname, punit, pref, porder, popts))
                else:
                    cur.execute("UPDATE test_parameters SET sort_order = ?, options = ? WHERE id = ?", (porder, popts, p_ex[0]))

        conn.commit()
    except Exception as e:
        logger.debug(f"Transfusion schema migration error: {e}")

def get_db():
    conn = get_connection()
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()
        logger.debug("Closed database connection")

def init_db():
    logger.info("Initializing database schema...")
    conn = get_connection()
    cursor = conn.cursor()
    cursor.executescript(SCHEMA_SQL)

    # Pre-seed facility_settings with id=1 if not exists
    cursor.execute("SELECT id FROM facility_settings WHERE id = 1")
    if not cursor.fetchone():
        cursor.execute("""
            INSERT INTO facility_settings (id, facility_name, facility_acronym, facility_code, address, phone, email)
            VALUES (1, 'Ahmadiyya Muslim Hospital', 'AMH', 'AMH', 'P.O. Box 2309, Mbale, Uganda', '+256 700 000 000', 'lab@hospital.org')
        """)
        logger.info("Pre-seeded default facility settings")
    
    # Pre-seed clinicians with 'SELF REQUEST' if it doesn't exist
    cursor.execute("SELECT id FROM clinicians WHERE name = 'SELF REQUEST'")
    if not cursor.fetchone():
        cursor.execute("INSERT INTO clinicians (name) VALUES ('SELF REQUEST')")
        logger.info("Pre-seeded clinician 'SELF REQUEST'")

    # Safe Migrations for existing database columns
    migrations = [
        ("tests", "parent_rollup_id", "INTEGER REFERENCES tests(id)"),
        ("tests", "tracks_stock", "BOOLEAN NOT NULL DEFAULT 0"),
        ("tests", "consumable_name", "TEXT"),
        ("test_orders", "sample_id", "TEXT"),
        ("test_orders", "visit_id", "INTEGER REFERENCES visits(id)"),
        ("test_results", "parameter_id", "INTEGER REFERENCES test_parameters(id)"),
        ("test_results", "clinical_flag", "TEXT"),
        ("users", "password_reset_required", "BOOLEAN NOT NULL DEFAULT 0"),
        ("users", "cadre", "TEXT"),
        ("test_orders", "order_category", "TEXT DEFAULT 'in-house'"),
        ("tests", "result_type", "TEXT DEFAULT 'qualitative'"),
        ("tests", "default_unit", "TEXT"),
        ("tests", "options", "TEXT"),
        ("tests", "clinical_comments", "TEXT"),
        ("clients", "age_years", "FLOAT"),
        ("clients", "age_category", "TEXT"),
        ("tests", "ref_range", "TEXT"),
        ("tests", "panic_value_low", "FLOAT"),
        ("tests", "panic_value_high", "FLOAT"),
        ("tests", "secondary_unit", "TEXT"),
        ("test_results", "result_unit", "TEXT"),
        ("test_results", "edit_reason", "TEXT"),
        ("test_results", "edited_by_user_id", "INTEGER"),
        ("test_results", "edited_at", "DATETIME"),
        ("visits", "order_category", "TEXT DEFAULT 'in-house'"),
        ("visits", "is_deleted", "BOOLEAN NOT NULL DEFAULT 0"),
        ("test_parameters", "options", "TEXT"),
        ("test_parameters", "secondary_unit", "TEXT"),
        ("reference_ranges", "sanity_min", "REAL"),
        ("reference_ranges", "sanity_max", "REAL"),
        ("reference_ranges", "plausible_min", "REAL"),
        ("reference_ranges", "plausible_max", "REAL"),
        ("diagnostic_kit_lots", "min_threshold", "INTEGER DEFAULT 25"),
        ("visits", "specimen_type_id", "INTEGER REFERENCES specimen_types(id)"),
        ("test_orders", "specimen_type_id", "INTEGER REFERENCES specimen_types(id)"),
        ("daily_entries", "in_house", "INTEGER NOT NULL DEFAULT 0"),
        ("daily_entries", "referral", "INTEGER NOT NULL DEFAULT 0"),
        ("daily_entries", "outreach", "INTEGER NOT NULL DEFAULT 0"),
        ("daily_entries", "self_request", "INTEGER NOT NULL DEFAULT 0"),
        ("visits", "dispatched_at", "DATETIME"),
        ("visits", "dispatched_to", "TEXT"),
        ("visits", "dispatched_by_user_id", "INTEGER REFERENCES users(id)"),
        ("specimen_types", "storage_temp", "TEXT")
    ]
    for table, col, col_def in migrations:
        try:
            cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}")
            logger.info(f"Migration: Added column {col} to table {table}")
        except sqlite3.OperationalError:
            pass # Column already exists

    # Data normalization migration: ensure all names and wards are uppercase
    cursor.execute("UPDATE clients SET full_name = UPPER(TRIM(full_name)) WHERE full_name IS NOT NULL AND full_name != UPPER(TRIM(full_name))")
    cursor.execute("UPDATE clinicians SET name = UPPER(TRIM(name)) WHERE name IS NOT NULL AND name != UPPER(TRIM(name))")
    cursor.execute("UPDATE users SET full_name = UPPER(TRIM(full_name)) WHERE full_name IS NOT NULL AND full_name != UPPER(TRIM(full_name))")
    # Deduplicate wards case-insensitively before uppercase normalization
    cursor.execute("""
        DELETE FROM wards
        WHERE id NOT IN (
            SELECT MIN(id) FROM wards GROUP BY UPPER(TRIM(name))
        )
    """)
    cursor.execute("UPDATE wards SET name = UPPER(TRIM(name)) WHERE name IS NOT NULL AND name != UPPER(TRIM(name))")
    cursor.execute("UPDATE wards SET name = 'PAEDIATRIC' WHERE name IN ('PEDIATRICS', 'PAEDIATRICS', 'PEDIATRIC')")
    cursor.execute("UPDATE visits SET ward_of_origin = UPPER(TRIM(ward_of_origin)) WHERE ward_of_origin IS NOT NULL AND ward_of_origin != UPPER(TRIM(ward_of_origin))")
    cursor.execute("UPDATE visits SET ward_of_origin = 'PAEDIATRIC' WHERE ward_of_origin IN ('PEDIATRICS', 'PAEDIATRICS', 'PEDIATRIC')")
    conn.commit()



    # Ensure standardized test names
    cursor.execute("UPDATE tests SET name = 'ZN Staining For AFBs' WHERE name LIKE 'ZN FOR AFBs%' OR name LIKE 'ZN Staining%'")
    cursor.execute("UPDATE tests SET name = 'Blood smear for Malaria Parasites' WHERE name LIKE 'Blood smear Mps%'")
    cursor.execute("""
        UPDATE test_parameters
        SET options = '["Not Done", "Not Seen (No Parasites)", "Plasmodium falciparum", "Plasmodium vivax", "Plasmodium malariae", "Plasmodium ovale", "Mixed infection (P. falciparum + P. malariae)", "Mixed infection (P. falciparum + P. vivax)"]'
        WHERE parameter_name LIKE '%Thin Smear%' OR parameter_name LIKE '%Species Identification%'
    """)
    conn.commit()

    # Pre-seed CBC test parameters if CBC exists in tests
    CBC_PARAMS = [
        ("Total WBC Count (White Blood Cells)", "10³/µL", "4.0 - 9.0", 1),
        ("Neutrophils (%) [Relative Count]", "%", "28.0 - 78.0", 2),
        ("Lymphocytes (%) [Relative Count]", "%", "17.0 - 57.0", 3),
        ("Monocytes (%) [Relative Count]", "%", "0.0 - 10.0", 4),
        ("Eosinophils (%) [Relative Count]", "%", "0.0 - 10.0", 5),
        ("Basophils (%) [Relative Count]", "%", "0.0 - 2.0", 6),
        ("Neutrophils (Absolute Count)", "10⁹/µL", "1.1 - 7.0", 7),
        ("Lymphocytes (Absolute Count)", "10⁹/µL", "0.7 - 5.1", 8),
        ("Monocytes (Absolute Count)", "10⁹/µL", "0.0 - 0.9", 9),
        ("Eosinophils (Absolute Count)", "10⁹/µL", "0.0 - 0.9", 10),
        ("Basophils (Absolute Count)", "10⁹/µL", "0.0 - 0.2", 11),
        ("Red Blood Cells (RBC)", "10⁶/µL", "3.76 - 5.70", 12),
        ("Hemoglobin (Hb)", "g/dL", "12.0 - 18.0", 13),
        ("Hematocrit (HCT)", "%", "33.5 - 52.0", 14),
        ("Mean Cell Volume (MCV)", "fL", "80.0 - 100", 15),
        ("Mean Cell Hb (MCH)", "pg", "28.0 - 32.0", 16),
        ("Mean Cell Hb Conc (MCHC)", "g/dL", "31.0 - 35.0", 17),
        ("RBC Distribution Width (RDW)", "%", "11.6 - 14.0", 18),
        ("Platelets Count (PLT)", "10³/µL", "150 - 350", 19),
        ("Thrombocrit (PCT)", "%", "0.16 - 0.33", 20),
        ("Mean Platelet Volume (MPV)", "fL", "7.0 - 11.0", 21),
        ("PLT Distribution Width (PDW)", "%", "15.0 - 17.0", 22),
    ]
    cursor.execute("SELECT id FROM tests WHERE LOWER(name) LIKE '%cbc%' OR LOWER(name) LIKE '%blood count%'")
    for cbc_row in cursor.fetchall():
        cbc_id = cbc_row[0]
        for pname, punit, pref, porder in CBC_PARAMS:
            cursor.execute("SELECT id FROM test_parameters WHERE test_id = ? AND parameter_name = ?", (cbc_id, pname))
            if not cursor.fetchone():
                cursor.execute("""
                    INSERT INTO test_parameters (test_id, parameter_name, unit, ref_range, sort_order)
                    VALUES (?, ?, ?, ?, ?)
                """, (cbc_id, pname, punit, pref, porder))

    # Pre-seed URINALYSIS test parameters with options for tripartite entry
    URINALYSIS_PARAMS = [
        ("Color", None, None, 1, '["Straw", "Yellow", "Amber", "Red", "Brown"]'),
        ("Turbidity", None, None, 2, '["Clear", "Slightly Turbid", "Turbid"]'),
        ("Pus Cells (WBCs)", "/ lpf", "<5 / lpf", 3, '["Not Seen", "1-2 / lpf", "3-4 / lpf", "5-10 / lpf", "10-15 / lpf", ">15 / lpf"]'),
        ("Red Blood Cells (RBCs)", "/ lpf", "<3 / lpf", 4, '["Not Seen", "1-2 / lpf", "3-5 / lpf", "5-10 / lpf", ">10 / lpf"]'),
        ("Epithelial Cells", "/ lpf", "Few (1-4 / lpf)", 5, '["Not Seen", "Few (1-4 / lpf)", "Moderate (5-10 / lpf)", "Plenty (>10 / lpf)"]'),
        ("Casts", "/ lpf", "Not Seen", 6, '["Not Seen", "Hyaline Casts (0-1 / lpf)", "Granular Casts (1-2 / lpf)", "Cellular Casts (1-2 / lpf)", "Waxy Casts (1-2 / lpf)", "RBC Casts (1-2 / lpf)", "WBC Casts (1-2 / lpf)"]'),
        ("Crystals", None, "Not Seen", 7, '["Not Seen", "Calcium Oxalate (+)", "Calcium Oxalate (++)", "Triple Phosphate (+)", "Triple Phosphate (++)", "Uric Acid Crystals (+)", "Amorphous Urates/Phosphates"]'),
        ("Specific Gravity (S.G)", "Ratio", "1.005 - 1.030", 8, '["1.000", "1.005", "1.010", "1.015", "1.020", "1.025", "1.030"]'),
        ("PH", "pH", "5.0 - 8.5", 9, '["5.0", "6.0", "6.5", "7.0", "7.5", "8.0", "8.5"]'),
        ("Proteins", None, "Nil", 10, '["Nil", "Trace (15 mg/dL)", "1+ (30 mg/dL)", "2+ (100 mg/dL)", "3+ (300 mg/dL)", "4+ (≥2000 mg/dL)"]'),
        ("Glucose", None, "Nil", 11, '["Nil", "Trace (100 mg/dL)", "1+ (250 mg/dL)", "2+ (500 mg/dL)", "3+ (1000 mg/dL)", "4+ (≥2000 mg/dL)"]'),
        ("Bilirubin", None, "Nil", 12, '["Nil", "Small (+)", "Moderate (++)", "Large (+++)"]'),
        ("Urobilinogen", None, "Normal", 13, '["Normal (1.0 EU/dL)", "2.0 EU/dL", "4.0 EU/dL", "8.0 EU/dL"]'),
        ("Ketones", None, "Nil", 14, '["Nil", "Trace (5 mg/dL)", "1+ (15 mg/dL)", "2+ (40 mg/dL)", "3+ (80 mg/dL)", "4+ (160 mg/dL)"]'),
        ("Blood", None, "Nil", 15, '["Nil", "Non-Hemolyzed Trace", "Hemolyzed Trace", "1+ (Small)", "2+ (Moderate)", "3+ (Large)"]'),
        ("Nitrate", None, "Negative", 16, '["Negative", "Positive"]'),
        ("Leukocyte Esterase", None, "Nil", 17, '["Nil", "Trace", "1+ (Small)", "2+ (Moderate)", "3+ (Large)"]')
    ]
    cursor.execute("SELECT id FROM tests WHERE LOWER(name) = 'urinalysis'")
    for ua_row in cursor.fetchall():
        ua_id = ua_row[0]
        # Clean up any legacy parameters under urinalysis
        cursor.execute("DELETE FROM test_parameters WHERE test_id = ? AND parameter_name IN ('Macroscopy (Physical Profile)', 'Microscopy (Sediment Cytology)')", (ua_id,))
        
        # Rename old parameter names if present
        RENAMES = [
            ("Proteins (Albuminuria Screening)", "Proteins"),
            ("Glucose (Glucosuria Screening)", "Glucose"),
            ("Bilirubin (Bilirubinuria)", "Bilirubin"),
            ("Ketones (Ketonuria)", "Ketones"),
            ("Blood (Hematuria/Hemoglobinuria)", "Blood"),
            ("Nitrates (Nitrite Screening)", "Nitrate"),
            ("Nitrates", "Nitrate"),
            ("Leukocytes (Leukocyte Esterase)", "Leukocyte Esterase"),
            ("Leukocytes", "Leukocyte Esterase"),
        ]
        for old_n, new_n in RENAMES:
            cursor.execute("UPDATE test_parameters SET parameter_name = ? WHERE test_id = ? AND parameter_name = ?", (new_n, ua_id, old_n))

        for pname, punit, pref, porder, popts in URINALYSIS_PARAMS:
            cursor.execute("SELECT id FROM test_parameters WHERE test_id = ? AND parameter_name = ?", (ua_id, pname))
            existing_p = cursor.fetchone()
            if not existing_p:
                cursor.execute("""
                    INSERT INTO test_parameters (test_id, parameter_name, unit, ref_range, sort_order, options)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (ua_id, pname, punit, pref, porder, popts))
            else:
                cursor.execute("""
                    UPDATE test_parameters
                    SET unit = ?, ref_range = ?, sort_order = ?, options = ?
                    WHERE id = ?
                """, (punit, pref, porder, popts, existing_p[0]))

    # Pre-seed HIV test parameters (Ordered: Self-tests -> Screening -> Confirmatory -> Tie-breaker)
    HIV_PARAMS = [
        ("OraQuick® HIV Self-Test", None, None, 1, '["Non-Reactive", "Reactive"]'),
        ("Fingerstick HIVST", None, None, 2, '["Non-Reactive", "Reactive"]'),
        ("MHS HIV 1/2 Kwiq Test", None, None, 3, '["Non-Reactive", "Reactive"]'),
        ("Determine™ HIV-1/2", None, None, 4, '["Non-Reactive", "Reactive"]'),
        ("HIV 1/2 Stat-Pak®", None, None, 5, '["Non-Reactive", "Reactive"]'),
        ("SD Bioline HIV-1/2", None, None, 6, '["Non-Reactive", "Reactive"]'),
    ]
    cursor.execute("UPDATE tests SET name = 'HIV Testing' WHERE name IN ('HIV (MoH Three-Test Algorithm)', 'HIV Testing Service')")
    cursor.execute("SELECT id FROM tests WHERE name IN ('HIV Testing', 'HIV Testing Service')")
    for hiv_row in cursor.fetchall():
        hiv_id = hiv_row[0]
        cursor.execute("DELETE FROM test_parameters WHERE test_id = ? AND parameter_name IN ('Determine', 'Stat-Pak', 'SD Bioline')", (hiv_id,))
        # Decouple EID tests from the HIV rapid antibody algorithm panel
        cursor.execute("DELETE FROM test_parameters WHERE test_id = ? AND parameter_name LIKE 'EID %'", (hiv_id,))
        for pname, punit, pref, porder, popts in HIV_PARAMS:
            cursor.execute("SELECT id FROM test_parameters WHERE test_id = ? AND parameter_name = ?", (hiv_id, pname))
            existing_p = cursor.fetchone()
            if not existing_p:
                cursor.execute("""
                    INSERT INTO test_parameters (test_id, parameter_name, unit, ref_range, sort_order, options)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (hiv_id, pname, punit, pref, porder, popts))
            else:
                cursor.execute("""
                    UPDATE test_parameters
                    SET unit = ?, ref_range = ?, sort_order = ?, options = ?
                    WHERE id = ?
                """, (punit, pref, porder, popts, existing_p[0]))

    # Ensure EID tests exist as independent tests in Serology section
    cursor.execute("SELECT id FROM sections WHERE name = 'Serology & Clinical Immunology'")
    serology_sec = cursor.fetchone()
    if serology_sec:
        ser_sec_id = serology_sec[0]
        EID_STANDALONE = [
            ("EID 1st PCR (4-6 Weeks)", '["Negative (Not Detected)", "Positive (Detected)"]'),
            ("EID 2nd PCR (9 Months)", '["Negative (Not Detected)", "Positive (Detected)"]'),
            ("EID Final Rapid Test (18 Months)", '["Non-Reactive", "Reactive"]')
        ]
        for ename, eopts in EID_STANDALONE:
            cursor.execute("SELECT id FROM tests WHERE name = ?", (ename,))
            if not cursor.fetchone():
                cursor.execute("""
                    INSERT INTO tests (name, section_id, is_tracked, result_type, options, is_active)
                    VALUES (?, ?, 0, 'options', ?, 1)
                """, (ename, ser_sec_id, eopts))

    # Pre-seed WIDAL test parameters
    WIDAL_PARAMS = [
        ("Salmonella typhi O (TO)", None, "Significant if >= 1:80", 1, '["Not Done", "< 1:20 (Low / Normal)", "1:20 (Low / Normal)", "1:40 (Low / Normal)", "1:80 (Borderline Significant)", "1:160 (High / Reactive)", "1:320 (High / Reactive)", ">= 1:640 (Very High / Reactive)"]'),
        ("Salmonella typhi H (TH)", None, "Significant if >= 1:80", 2, '["Not Done", "< 1:20 (Low / Normal)", "1:20 (Low / Normal)", "1:40 (Low / Normal)", "1:80 (Borderline Significant)", "1:160 (High / Reactive)", "1:320 (High / Reactive)", ">= 1:640 (Very High / Reactive)"]'),
        ("Salmonella paratyphi A (AO)", None, "Significant if >= 1:80", 3, '["Not Done", "< 1:20 (Low / Normal)", "1:20 (Low / Normal)", "1:40 (Low / Normal)", "1:80 (Borderline Significant)", "1:160 (High / Reactive)", "1:320 (High / Reactive)", ">= 1:640 (Very High / Reactive)"]'),
        ("Salmonella paratyphi B (BH)", None, "Significant if >= 1:80", 4, '["Not Done", "< 1:20 (Low / Normal)", "1:20 (Low / Normal)", "1:40 (Low / Normal)", "1:80 (Borderline Significant)", "1:160 (High / Reactive)", "1:320 (High / Reactive)", ">= 1:640 (Very High / Reactive)"]'),
    ]
    cursor.execute("SELECT id FROM tests WHERE LOWER(name) LIKE '%widal%'")
    for widal_row in cursor.fetchall():
        widal_id = widal_row[0]
        for pname, punit, pref, porder, popts in WIDAL_PARAMS:
            cursor.execute("SELECT id FROM test_parameters WHERE test_id = ? AND parameter_name = ?", (widal_id, pname))
            existing_p = cursor.fetchone()
            if not existing_p:
                cursor.execute("""
                    INSERT INTO test_parameters (test_id, parameter_name, unit, ref_range, sort_order, options)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (widal_id, pname, punit, pref, porder, popts))
            else:
                cursor.execute("""
                    UPDATE test_parameters
                    SET unit = ?, ref_range = ?, sort_order = ?, options = ?
                    WHERE id = ?
                """, (punit, pref, porder, popts, existing_p[0]))

    # Pre-seed Malaria Microscopy test parameters
    MALARIA_PARAMS = [
        ("Examination Method / Film Done", None, None, 1, '["Thick Film", "Thin Film", "Both (Thick & Thin Film)"]'),
        ("Parasite Density (Thick Film)", None, None, 2, '["No malaria parasites seen", "1+ (1-10 parasites per 100 thick-film fields)", "2+ (11-100 parasites per 100 thick-film fields)", "3+ (1-10 parasites per single thick-film field)", "4+ (>10 parasites per single thick-film field)", "Not Done"]'),
        ("Species Identification (Thin Smear)", None, None, 3, '["Not Seen (No Parasites)", "Plasmodium falciparum", "Plasmodium vivax", "Plasmodium malariae", "Plasmodium ovale", "Mixed infection (P. falciparum + P. malariae)", "Mixed infection (P. falciparum + P. vivax)", "Not Done"]'),
    ]
    cursor.execute("SELECT id FROM tests WHERE LOWER(name) LIKE '%blood smear mps%' OR LOWER(name) LIKE '%malaria microscopy%'")
    for mal_row in cursor.fetchall():
        mal_id = mal_row[0]
        for pname, punit, pref, porder, popts in MALARIA_PARAMS:
            cursor.execute("SELECT id FROM test_parameters WHERE test_id = ? AND parameter_name = ?", (mal_id, pname))
            existing_p = cursor.fetchone()
            if not existing_p:
                cursor.execute("""
                    INSERT INTO test_parameters (test_id, parameter_name, unit, ref_range, sort_order, options)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (mal_id, pname, punit, pref, porder, popts))
            else:
                cursor.execute("""
                    UPDATE test_parameters
                    SET unit = ?, ref_range = ?, sort_order = ?, options = ?
                    WHERE id = ?
                """, (punit, pref, porder, popts, existing_p[0]))

    # Pre-seed CD4 tests (Point-of-Care Cytometry and Semi-Quantitative Rapid Test Strip)
    cursor.execute("SELECT id FROM sections WHERE name = 'Serology & Clinical Immunology'")
    ser_row = cursor.fetchone()
    if ser_row:
        ser_sec_id = ser_row[0]
        # Rename or ensure Absolute CD4 Count (Cytometry)
        cursor.execute("UPDATE tests SET name = 'Absolute CD4 Count (Cytometry)' WHERE name = 'CD4 COUNT'")
        cursor.execute("SELECT id FROM tests WHERE name = 'Absolute CD4 Count (Cytometry)'")
        cd4_quant_row = cursor.fetchone()
        if not cd4_quant_row:
            cursor.execute("""
                INSERT INTO tests (name, section_id, is_tracked, result_type, default_unit, ref_range, is_active, tracks_stock, consumable_name, clinical_comments)
                VALUES ('Absolute CD4 Count (Cytometry)', ?, 1, 'quantitative', 'cells/µL', '500 - 1500 cells/µL', 1, 1, 'CD4 POC Cartridges (PIMA/FACSPresto)',
                        'Absolute CD4 T-cell count performed via automated POC cytometry. < 200 cells/µL defines Advanced HIV Disease (AHD).')
            """, (ser_sec_id,))
            cd4_quant_id = cursor.lastrowid
        else:
            cd4_quant_id = cd4_quant_row[0]
            cursor.execute("""
                UPDATE tests
                SET is_tracked = 1, result_type = 'quantitative', default_unit = 'cells/µL', ref_range = '500 - 1500 cells/µL',
                    tracks_stock = 1, consumable_name = 'CD4 POC Cartridges (PIMA/FACSPresto)',
                    clinical_comments = 'Absolute CD4 T-cell count performed via automated POC cytometry. < 200 cells/µL defines Advanced HIV Disease (AHD).'
                WHERE id = ?
            """, (cd4_quant_id,))

        # Ensure CD4 Count (Rapid Test Strip)
        cursor.execute("SELECT id FROM tests WHERE name = 'CD4 Count (Rapid Test Strip)'")
        cd4_rdt_row = cursor.fetchone()
        if not cd4_rdt_row:
            cursor.execute("""
                INSERT INTO tests (name, section_id, is_tracked, result_type, options, is_active, tracks_stock, consumable_name, clinical_comments)
                VALUES ('CD4 Count (Rapid Test Strip)', ?, 1, 'options',
                        '["CD4 Count: Below 200 cells/µL", "CD4 Count: 200 cells/µL or above", "Invalid"]', 1, 1, 'VISITECT CD4 Rapid Test Strips',
                        'Semi-quantitative lateral-flow CD4 assay. Below 200 cells/µL defines Advanced HIV Disease (AHD).')
            """, (ser_sec_id,))
        else:
            cursor.execute("""
                UPDATE tests
                SET is_tracked = 1, result_type = 'options',
                    options = '["CD4 Count: Below 200 cells/µL", "CD4 Count: 200 cells/µL or above", "Invalid"]',
                    tracks_stock = 1, consumable_name = 'VISITECT CD4 Rapid Test Strips',
                    clinical_comments = 'Semi-quantitative lateral-flow CD4 assay. Below 200 cells/µL defines Advanced HIV Disease (AHD).'
                WHERE id = ?
            """, (cd4_rdt_row[0],))

        # Ensure CD4 Percentage exists for pediatric staging (< 60 months)
        cursor.execute("SELECT id FROM tests WHERE name = 'CD4 Percentage'")
        cd4_pct_row = cursor.fetchone()
        if not cd4_pct_row:
            cursor.execute("""
                INSERT INTO tests (name, section_id, is_tracked, result_type, default_unit, ref_range, is_active, clinical_comments)
                VALUES ('CD4 Percentage', ?, 0, 'quantitative', '%', '>= 25%', 1,
                        'Pediatric CD4 immunological monitoring (< 5 years). < 25% defines Pediatric Advanced HIV Disease (AHD).')
            """, (ser_sec_id,))

    # Seed reference ranges for CD4
    CD4_REF_RANGES = [
        ("Absolute CD4 Count (Cytometry)", 5, 999, None, 500.0, 1500.0, 200.0, None, 0.0, 5000.0, 10.0, 3000.0, "cells/µL"),
        ("CD4 COUNT", 5, 999, None, 500.0, 1500.0, 200.0, None, 0.0, 5000.0, 10.0, 3000.0, "cells/µL"),
        ("CD4 Percentage", 0, 4, None, 25.0, 65.0, 25.0, None, 0.0, 100.0, 5.0, 65.0, "%"),
    ]
    for pname, a_min, a_max, s_sex, n_min, n_max, c_min, c_max, s_min, s_max, p_min, p_max, r_unit in CD4_REF_RANGES:
        cursor.execute("SELECT id FROM tests WHERE name = ?", (pname,))
        t_match = cursor.fetchone()
        t_id_match = t_match[0] if t_match else None
        cursor.execute("""
            SELECT id FROM reference_ranges
            WHERE parameter_name = ? AND age_min = ? AND age_max = ? AND (unit = ? OR (unit IS NULL AND ? IS NULL))
        """, (pname, a_min, a_max, r_unit, r_unit))
        rr_existing = cursor.fetchone()
        if not rr_existing:
            cursor.execute("""
                INSERT INTO reference_ranges (test_id, parameter_name, age_min, age_max, sex, normal_min, normal_max, critical_min, critical_max, sanity_min, sanity_max, plausible_min, plausible_max, unit)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (t_id_match, pname, a_min, a_max, s_sex, n_min, n_max, c_min, c_max, s_min, s_max, p_min, p_max, r_unit))
        else:
            cursor.execute("""
                UPDATE reference_ranges
                SET test_id = ?, normal_min = ?, normal_max = ?, critical_min = ?, critical_max = ?, sanity_min = ?, sanity_max = ?, plausible_min = ?, plausible_max = ?, unit = ?
                WHERE id = ?
            """, (t_id_match, n_min, n_max, c_min, c_max, s_min, s_max, p_min, p_max, r_unit, rr_existing[0]))

    # Set default stock-tracking flags on existing kit/strip tests
    STOCK_TRACKED_TESTS = [
        ("HIV Testing", "HIV Diagnostic Kits"),
        ("Malaria RDT", "Malaria Rapid Diagnostic Test (RDT)"),
        ("HBsAg (Hepatitis B)", "HBsAg Rapid Test Strip"),
        ("HCV Ab (Hepatitis C)", "HCV Ab Rapid Test Strip"),
        ("HCG Urine", "HCG Urine Pregnancy Strip"),
        ("H.Pylori Ag (Stool Antigen)", "H. Pylori Stool Ag / Serum Ab Cassette"),
        ("H.Pylori Ab (Serum Antibody)", "H. Pylori Stool Ag / Serum Ab Cassette"),
        ("URINALYSIS", "Siemens Multistix 10SG Reagent Strips"),
        ("CrAg (Cryptococcal Antigen)", "CrAg Lateral Flow Strip"),
        ("TB LAM (Urine Tuberculosis LAM)", "TB LAM Urine Ag Strip"),
        ("BAT (Brucella Antigen Test)", "BAT (Brucella Antigen Test) Slide"),
        ("VDRL/RPR (Syphilis Screening)", "Syphilis TPHA / RPR Test Reagents"),
        ("TPHA (Confirmatory Syphilis Test)", "Syphilis TPHA / RPR Test Reagents"),
        ("Absolute CD4 Count (Cytometry)", "CD4 POC Cartridges (PIMA/FACSPresto)"),
        ("CD4 Count (Rapid Test Strip)", "VISITECT CD4 Rapid Test Strips"),
    ]
    for tname, cname in STOCK_TRACKED_TESTS:
        cursor.execute("UPDATE tests SET tracks_stock = 1, consumable_name = ? WHERE LOWER(name) = LOWER(?)", (cname, tname))

    # Migration: Update tracking status for expanded positive/abnormal criteria
    TRACKED_TEST_UPDATES = [
        ("HCG Blood", 1),
        ("CD4 Percentage", 1),
        ("ASO Titer (Anti-Streptolysin O)", 1),
        ("EID 1st PCR (4-6 Weeks)", 1),
        ("EID 2nd PCR (9 Months)", 1),
        ("EID Final Rapid Test (18 Months)", 1),
        ("Blood group (ABO & Rh typing)", 0),
    ]
    for t_name, trk in TRACKED_TEST_UPDATES:
        cursor.execute("UPDATE tests SET is_tracked = ? WHERE LOWER(name) = LOWER(?)", (trk, t_name))

    conn.commit()
    conn.close()
    logger.info("Database schema initialized and migrated successfully")

if __name__ == "__main__":
    init_db()
    print(f"Database schema created successfully at {DB_PATH}!")
