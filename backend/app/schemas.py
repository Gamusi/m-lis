from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict
import datetime

class UserBase(BaseModel):
    username: str
    full_name: str
    role: str = "staff"
    cadre: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def uppercase_full_name(cls, v: str) -> str:
        return v.strip().upper() if v else v

class UserCreate(UserBase):
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    password_reset_required: bool = False
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    username: str
    password: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class SectionResponse(BaseModel):
    id: int
    name: str
    sort_order: int

    class Config:
        from_attributes = True

class TestBase(BaseModel):
    name: str
    section_id: int
    is_tracked: Optional[bool] = None
    sort_order: int = 0
    result_type: str = "qualitative"
    default_unit: Optional[str] = None
    options: Optional[str] = None
    parent_rollup_id: Optional[int] = None
    tracks_stock: Optional[bool] = False
    consumable_name: Optional[str] = None
    clinical_comments: Optional[str] = None

class TestCreate(TestBase):
    pass

class TestResponse(TestBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True

class DailyEntryItem(BaseModel):
    test_id: int
    done: int = 0
    positive: Optional[int] = None
    in_house: Optional[int] = 0
    referral: Optional[int] = 0
    outreach: Optional[int] = 0
    self_request: Optional[int] = 0

class DailyLogSaveRequest(BaseModel):
    entry_date: datetime.date # YYYY-MM-DD
    entries: List[DailyEntryItem]

class BacklogEntryItem(BaseModel):
    test_id: int
    done: int = 0
    positive: Optional[int] = None
    in_house: Optional[int] = None
    referral: Optional[int] = 0
    outreach: Optional[int] = 0
    self_request: Optional[int] = 0

class BacklogSaveRequest(BaseModel):
    entry_date: datetime.date # YYYY-MM-DD
    entries: List[BacklogEntryItem]

class DailyEntryResponse(BaseModel):
    id: int
    entry_date: str
    test_id: int
    done: int
    positive: Optional[int]
    in_house: int = 0
    referral: int = 0
    outreach: int = 0
    self_request: int = 0
    entered_by_user_id: Optional[int]
    entered_at: Optional[datetime.datetime]
    updated_by_user_id: Optional[int]
    updated_at: Optional[datetime.datetime]

    class Config:
        from_attributes = True

class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int]
    username: Optional[str] = None
    action: str
    detail: Optional[str]
    timestamp: datetime.datetime

    class Config:
        from_attributes = True

class ReportFilterRequest(BaseModel):
    period_type: str # Day, Week, Month, Quarter, Half-Year, Year, Financial Year
    reference_date: Optional[str] = None # YYYY-MM-DD
    financial_year: Optional[str] = None # e.g. "2026/27"
    month: Optional[str] = None # e.g. "July"

class TrendFilterRequest(BaseModel):
    from_month: str # YYYY-MM
    to_month: str # YYYY-MM

class UserRegister(BaseModel):
    username: str
    full_name: str
    password: str
    cadre: Optional[str] = None

class UserUpdate(BaseModel):
    role: str
    is_active: bool
    password: Optional[str] = None
    cadre: Optional[str] = None

class ClinicianBase(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def uppercase_name(cls, v: str) -> str:
        return v.strip().upper() if v else v

class ClinicianCreate(ClinicianBase):
    pass

class ClinicianUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def uppercase_name(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper() if v else v

class ClinicianResponse(ClinicianBase):
    id: int
    is_active: bool = True
    created_at: Optional[datetime.datetime] = None

class ClientUpdate(BaseModel):
    full_name: Optional[str] = None
    age_string: Optional[str] = None
    age_raw: Optional[str] = None
    age_category: Optional[str] = None
    sex: Optional[str] = None
    phone: Optional[str] = None

    @field_validator("full_name")
    @classmethod
    def uppercase_full_name(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper() if v else v


class ResultEdit(BaseModel):
    order_id: int
    result_value: Optional[str] = None
    parameter_results: Optional[list] = None
    result_unit: Optional[str] = None
    edit_reason: str

class SpecimenTypeBase(BaseModel):
    name: str
    container: Optional[str] = None
    min_volume: Optional[str] = None
    sort_order: int = 0

class SpecimenTypeCreate(SpecimenTypeBase):
    pass

class SpecimenTypeResponse(SpecimenTypeBase):
    id: int
    is_active: bool = True

    class Config:
        from_attributes = True

class TestOrderItemCreate(BaseModel):
    test_id: int
    specimen_type_id: int

class VisitCreate(BaseModel):
    client_id: int
    clinician_id: int
    ward_of_origin: str
    specimen_type_id: Optional[int] = None
    specimen_type_ids: Optional[List[int]] = None
    test_ids: Optional[List[int]] = None
    test_specimen_map: Optional[Dict[str, int]] = None
    test_orders: Optional[List[TestOrderItemCreate]] = None
    sample_id: Optional[str] = None
    order_category: Optional[str] = 'in-house' 

    @field_validator("ward_of_origin")
    @classmethod
    def uppercase_ward(cls, v: str) -> str:
        return v.strip().upper() if v else v

class VisitResponse(BaseModel):
    id: int
    client_id: int
    clinician_id: Optional[int] = None
    ward_of_origin: Optional[str] = None
    lab_number: Optional[str] = None
    specimen_type_id: Optional[int] = None
    created_at: Optional[datetime.datetime] = None

    class Config:
        from_attributes = True

class WardBase(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def uppercase_name(cls, v: str) -> str:
        return v.strip().upper() if v else v

class WardCreate(WardBase):
    pass

class WardUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def uppercase_name(cls, v: Optional[str]) -> Optional[str]:
        return v.strip().upper() if v else v

class WardResponse(WardBase):
    id: int
    is_active: bool

    class Config:
        from_attributes = True

class ParameterResultItem(BaseModel):
    parameter_id: int
    result_value: str
    result_unit: Optional[str] = None

class TestResultCreate(BaseModel):
    order_id: int
    result_value: Optional[str] = None
    result_unit: Optional[str] = None
    parameter_results: Optional[List[ParameterResultItem]] = None
    edit_reason: Optional[str] = None

class AddOrdersRequest(BaseModel):
    test_ids: List[int]
    sample_id: Optional[str] = None
    order_category: Optional[str] = "in-house"

class BulkOrderDeleteRequest(BaseModel):
    order_ids: List[int]

class BulkVisitDeleteRequest(BaseModel):
    visit_ids: List[int]

class BulkClientDeleteRequest(BaseModel):
    client_ids: List[int]

class ReferenceRangeBase(BaseModel):
    test_id: Optional[int] = None
    parameter_name: str
    age_min: Optional[int] = 0
    age_max: Optional[int] = 999
    sex: Optional[str] = None
    normal_min: Optional[float] = None
    normal_max: Optional[float] = None
    critical_min: Optional[float] = None
    critical_max: Optional[float] = None
    sanity_min: Optional[float] = None
    sanity_max: Optional[float] = None
    plausible_min: Optional[float] = None
    plausible_max: Optional[float] = None
    unit: Optional[str] = None

    @field_validator("normal_min", "normal_max", "critical_min", "critical_max", "sanity_min", "sanity_max", "plausible_min", "plausible_max")
    @classmethod
    def validate_non_negative_values(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Laboratory reference and sanity values must be non-negative (>= 0)")
        return v

    @field_validator("age_min", "age_max")
    @classmethod
    def validate_non_negative_age(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("Age values must be non-negative (>= 0)")
        return v

class ReferenceRangeCreate(ReferenceRangeBase):
    pass

class ReferenceRangeUpdate(BaseModel):
    test_id: Optional[int] = None
    parameter_name: Optional[str] = None
    age_min: Optional[int] = None
    age_max: Optional[int] = None
    sex: Optional[str] = None
    normal_min: Optional[float] = None
    normal_max: Optional[float] = None
    critical_min: Optional[float] = None
    critical_max: Optional[float] = None
    sanity_min: Optional[float] = None
    sanity_max: Optional[float] = None
    plausible_min: Optional[float] = None
    plausible_max: Optional[float] = None
    unit: Optional[str] = None

    @field_validator("normal_min", "normal_max", "critical_min", "critical_max", "sanity_min", "sanity_max", "plausible_min", "plausible_max")
    @classmethod
    def validate_non_negative_values(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v < 0:
            raise ValueError("Laboratory reference and sanity values must be non-negative (>= 0)")
        return v

    @field_validator("age_min", "age_max")
    @classmethod
    def validate_non_negative_age(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and v < 0:
            raise ValueError("Age values must be non-negative (>= 0)")
        return v

class ReferenceRangeResponse(ReferenceRangeBase):
    id: int

    class Config:
        from_attributes = True

class StockReceiveRequest(BaseModel):
    kit_name: str
    category: Optional[str] = "General"
    lot_number: str
    expiry_date: str # YYYY-MM-DD
    initial_quantity: int
    min_threshold: Optional[int] = 25
    test_id: Optional[int] = None

class StockAdjustRequest(BaseModel):
    lot_id: int
    transaction_type: str # 'WASTAGE_QC', 'ADJUSTMENT'
    quantity_delta: int # Negative for deduction/wastage, positive for stock-in adjustment
    reason: str

class StockLotResponse(BaseModel):
    id: int
    test_id: Optional[int] = None
    kit_name: str
    category: str
    lot_number: str
    expiry_date: str
    initial_quantity: int
    current_quantity: int
    min_threshold: int
    is_active: bool
    received_date: Optional[str] = None
    status: str # 'Active', 'Low Stock', 'Near Expiry', 'Expired'

    class Config:
        from_attributes = True

class StockSummaryResponse(BaseModel):
    kit_name: str
    category: str
    total_quantity: int
    min_threshold: int
    active_lots_count: int
    expiring_soon_count: int
    expired_count: int
    status: str

class StockTransactionResponse(BaseModel):
    id: int
    lot_id: int
    kit_name: str
    lot_number: str
    category: str
    transaction_type: str
    quantity_delta: int
    order_id: Optional[int] = None
    reason: Optional[str] = None
    created_at: str
    username: Optional[str] = None

    class Config:
        from_attributes = True

class StockAlertResponse(BaseModel):
    alert_type: str # 'LOW_STOCK', 'NEAR_EXPIRY', 'EXPIRED'
    message: str
    kit_name: str
    lot_number: Optional[str] = None
    expiry_date: Optional[str] = None
    current_quantity: int
    min_threshold: int

class StockReconciliationItem(BaseModel):
    kit_name: str
    category: str
    tests_completed: int
    kits_consumed: int
    wastage_recorded: int
    variance: int

class FacilitySettingsBase(BaseModel):
    facility_name: str
    facility_acronym: str
    facility_code: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    letterhead_path: Optional[str] = None
    logo_path: Optional[str] = None

class FacilitySettingsUpdate(BaseModel):
    facility_name: Optional[str] = None
    facility_acronym: Optional[str] = None
    facility_code: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    letterhead_path: Optional[str] = None
    logo_path: Optional[str] = None

class FacilitySettingsResponse(FacilitySettingsBase):
    id: int
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True

class CrossmatchCreate(BaseModel):
    donor_unit_id: str
    donor_blood_group: str
    product_type: str = "Packed Red Blood Cells (PRBC)"
    expiry_date: str
    phase_is: str = "Negative"
    phase_thermophase: str = "Negative"
    phase_ahg: str = "Negative"

class CrossmatchResponse(BaseModel):
    id: int
    order_id: int
    donor_unit_id: str
    donor_blood_group: str
    product_type: str
    expiry_date: str
    phase_is: str
    phase_thermophase: str
    phase_ahg: str
    compatibility_status: str
    release_status: str
    clinical_summary: str
    is_locked: bool
    entered_by_user_id: Optional[int] = None
    verified_by_user_id: Optional[int] = None
    created_at: Optional[str] = None

    class Config:
        from_attributes = True

class CultureAstItem(BaseModel):
    id: Optional[int] = None
    antimicrobial_class: str
    agent_name: str
    measurement_type: str = "zone_mm" # 'zone_mm' or 'mic_ug_ml'
    measurement_value: Optional[float] = None
    raw_sir: str # 'S', 'I', 'R'
    overridden_sir: Optional[str] = None
    override_reason: Optional[str] = None
    clinical_note: Optional[str] = None

class CultureIsolateItem(BaseModel):
    id: Optional[int] = None
    isolate_number: int = 1
    organism_name: str
    colony_morphology: Optional[str] = None
    is_pathogen: bool = True
    is_contaminant: bool = False
    ast_results: Optional[List[CultureAstItem]] = None

class CultureOrderSaveRequest(BaseModel):
    phase: int = 1 # 1: Micro, 2: Colony count, 3: ID, 4: AST/Final
    preliminary_micro: Optional[str] = None
    colony_count_cfu: Optional[str] = None
    growth_category: Optional[str] = None
    incubation_hours: Optional[int] = 24
    media_used: Optional[str] = None
    clinical_notes: Optional[str] = None
    is_emergency_callback_done: Optional[bool] = False
    emergency_callback_recipient: Optional[str] = None
    is_esbl_positive: Optional[bool] = False
    is_mrsa_positive: Optional[bool] = False
    isolates: Optional[List[CultureIsolateItem]] = None
    edit_reason: Optional[str] = None

class CultureOrderResponse(BaseModel):
    id: Optional[int] = None
    order_id: int
    phase: int = 1
    preliminary_micro: Optional[str] = None
    preliminary_micro_date: Optional[str] = None
    colony_count_cfu: Optional[str] = None
    growth_category: Optional[str] = None
    incubation_hours: int = 24
    media_used: Optional[str] = None
    clinical_notes: Optional[str] = None
    is_emergency_callback_done: bool = False
    emergency_callback_time: Optional[str] = None
    emergency_callback_recipient: Optional[str] = None
    alerts: Optional[List[str]] = None
    isolates: List[CultureIsolateItem] = []
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

    class Config:
        from_attributes = True

