# M-LIS - Immediate To-Do List

This document tracks high-priority features, infrastructure hardening, and technical tasks earmarked for immediate upcoming releases.

## 1. Database Automated Rolling Backups
- **Priority**: High (Infrastructure & Disaster Recovery)
- **Objective**: Prevent catastrophic data loss from unexpected power failures, generator switches, or hardware failure on hospital workstations.
- **Requirements**:
  - Implement SQLite online backup API (sqlite3_backup) hook running at startup and/or daily cron interval.
  - Target directory: data/backups/.
  - Naming pattern: mlis_backup_YYYY-MM-DD_HHMMSS.db.
  - Verification: Perform test restore integrity check before archiving snapshot.

## 2. Specimen Configuration & Management
- **Priority**: High (Laboratory Workflow & Quality Assurance)
- **Objective**: Provide a dedicated configuration interface for specimen types, collection containers, minimum volumes, and test-to-specimen compatibility rules.
- **Requirements**:
  - CRUD interface in the Configuration tab for laboratory specimen types (e.g., Whole Blood, Serum, Plasma, CSF, Sputum, Urine).
  - Configurable container specifications (e.g., EDTA lavender top, Plain red top, SST gold top, Sodium Citrate blue top, Sterile universal container).
  - Minimum volume thresholds and storage temperature guidelines per specimen type.
  - Linkage matrix mapping tests and panels to compatible specimen types to prevent invalid orders at accessioning.
  - Soft-deactivation protection preventing removal of specimen types referenced by existing clinical orders.

## 3. Hematology Analyzer Parser Output Hardcoding & Failure Handling
- **Priority**: High (Interoperability & Data Ingestion)
- **Objective**: Generalize the hematology analyzer parser to handle varied message formats, delimiters, field offsets, and edge cases.
- **Requirements**:
  - Investigate analyzer parser logic across differing output modes / firmware formats.
  - Collect sample raw payload dumps from failing analyzer outputs.
  - Remove brittle hardcoded field index parsing; introduce resilient header/segment regex matching and graceful fallback error reporting.

