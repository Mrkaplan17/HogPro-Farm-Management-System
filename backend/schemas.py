from pydantic import BaseModel, Field, EmailStr, field_validator
from typing import Optional, List
from datetime import date, datetime
from enum import Enum


class Role(str, Enum):
    ADMIN = "admin"
    WORKER = "worker"


class BatchStatus(str, Enum):
    ACTIVE = "active"
    CLOSED = "closed"


class ExpenseCategory(str, Enum):
    PIGLETS = "piglets"
    FEED = "feed"
    MEDICINE = "medicine"
    VETERINARY = "veterinary"
    UTILITIES = "utilities"
    LABOR = "labor"
    MAINTENANCE = "maintenance"
    INVENTORY = "inventory"
    MISC = "misc"


class InventoryCategory(str, Enum):
    FEED = "feed"
    MEDICINE = "medicine"
    VITAMIN = "vitamin"
    SUPPLIES = "supplies"


class TransactionType(str, Enum):
    RESTOCK = "restock"
    ISSUE = "issue"


# ─── AUTH & ONBOARDING ─────────────────────────────────────────────

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6, max_length=100)
    full_name: str = Field("", max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    """Google OAuth 2.0 credential (id_token or short-lived access_token)."""
    credential: str = Field(..., min_length=1)
    mode: str = Field("id_token", pattern="^(id_token|access_token)$")


class FacebookLoginRequest(BaseModel):
    """Facebook JS SDK short-lived user access token (verified server-side)."""
    access_token: str = Field(..., min_length=1)
    user_id: str = Field("", max_length=100)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6, max_length=100)


class OnboardRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=100)
    farm_name: str = Field("", max_length=120)


class UpdateProfileRequest(BaseModel):
    """Profile updates. NOTE: email is intentionally NOT accepted here —
    email is strictly read-only and can never be changed by the user."""
    full_name: Optional[str] = Field(None, max_length=100)
    farm_name: Optional[str] = Field(None, max_length=120)
    farm_location: Optional[str] = Field(None, max_length=120)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., min_length=1, max_length=100)
    new_password: str = Field(..., min_length=6, max_length=100)


class UserOut(BaseModel):
    id: int
    email: str
    username: Optional[str] = None
    full_name: str
    farm_name: str
    farm_location: str
    role: str
    is_active: bool
    subscription_status: str
    is_onboarded: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ─── BATCH / PRODUCTION ─────────────────────────────────────────────

class CageCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    head_count: int = Field(..., gt=0)


class CageUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    head_count: Optional[int] = Field(None, gt=0)


class CageResponse(BaseModel):
    id: int
    batch_id: int
    name: str
    head_count: int

    model_config = {"from_attributes": True}


class BatchCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    initial_head_count: int = Field(0, ge=0)
    start_date: date
    market_price_per_kg: Optional[float] = Field(140.0, gt=0)
    notes: Optional[str] = ""
    cages: Optional[List[CageCreate]] = None


class BatchUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    notes: Optional[str] = None
    market_price_per_kg: Optional[float] = Field(None, gt=0)


class BatchResponse(BaseModel):
    id: int
    name: str
    initial_head_count: int
    current_head_count: int
    start_date: date
    status: str
    market_price_per_kg: float
    notes: str
    created_at: datetime
    updated_at: datetime
    closed_at: Optional[datetime] = None
    cages: Optional[List[CageResponse]] = []

    model_config = {"from_attributes": True}


# ─── EXPENSES LEDGER ────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    batch_id: Optional[int] = None
    category: ExpenseCategory
    description: str = Field(..., min_length=1, max_length=255)
    quantity: Optional[float] = Field(None, gt=0)
    unit_price: Optional[float] = Field(None, ge=0)
    amount: Optional[float] = Field(None, gt=0)
    date: date
    cage_id: Optional[int] = None
    head_count: Optional[int] = Field(None, ge=1)
    inventory_item_id: Optional[int] = None

    @field_validator("amount", mode="before")
    @classmethod
    def _amount_default(cls, v):
        return v  # amount computed server-side when omitted


class ExpenseUpdate(BaseModel):
    batch_id: Optional[int] = None
    category: Optional[ExpenseCategory] = None
    description: Optional[str] = Field(None, min_length=1, max_length=255)
    quantity: Optional[float] = Field(None, gt=0)
    unit_price: Optional[float] = Field(None, ge=0)
    amount: Optional[float] = Field(None, gt=0)
    date: Optional[date] = None
    cage_id: Optional[int] = None
    head_count: Optional[int] = Field(None, ge=1)


class ExpenseResponse(BaseModel):
    id: int
    batch_id: Optional[int] = None
    category: str
    description: str
    quantity: float
    unit_price: float
    amount: float
    date: date
    cage_id: Optional[int] = None
    head_count: Optional[int] = None
    source: str
    inventory_item_id: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── SALES ──────────────────────────────────────────────────────────

class SaleItemCreate(BaseModel):
    cage_id: Optional[int] = None
    tag_id: Optional[str] = ""
    head_count: int = Field(1, ge=1)
    mode: str = Field("per_kilo", pattern="^(per_head|per_kilo)$")
    live_weight_kg: float = Field(0.0, ge=0)
    price_per_kilo: float = Field(0.0, ge=0)
    price_per_head: float = Field(0.0, ge=0)
    amount: Optional[float] = Field(None, gt=0)


class SaleItemResponse(BaseModel):
    id: int
    sale_id: int
    cage_id: Optional[int] = None
    tag_id: str
    head_count: int
    mode: str
    live_weight_kg: float
    price_per_kilo: float
    price_per_head: float
    amount: float

    model_config = {"from_attributes": True}


class SaleCreate(BaseModel):
    batch_id: int
    heads_sold: int = Field(..., gt=0)
    weight_kg: Optional[float] = Field(None, ge=0)
    price_per_kilo: Optional[float] = Field(None, gt=0)
    total_revenue: Optional[float] = Field(None, gt=0)
    buyer_name: Optional[str] = ""
    buyer_contact: Optional[str] = ""
    sale_date: date
    notes: Optional[str] = ""
    items: Optional[List[SaleItemCreate]] = None


class SaleUpdate(BaseModel):
    heads_sold: Optional[int] = Field(None, gt=0)
    weight_kg: Optional[float] = Field(None, ge=0)
    price_per_kilo: Optional[float] = Field(None, ge=0)
    total_revenue: Optional[float] = Field(None, gt=0)
    buyer_name: Optional[str] = None
    buyer_contact: Optional[str] = None
    sale_date: Optional[date] = None
    notes: Optional[str] = None
    items: Optional[List[SaleItemCreate]] = None


class SaleResponse(BaseModel):
    id: int
    batch_id: int
    heads_sold: int
    weight_kg: float
    price_per_kilo: float
    total_revenue: float
    buyer_name: str
    buyer_contact: str
    sale_date: date
    notes: str
    created_at: datetime
    items: Optional[List[SaleItemResponse]] = []

    model_config = {"from_attributes": True}


# ─── MORTALITY ──────────────────────────────────────────────────────

class MortalityCreate(BaseModel):
    batch_id: int
    cage_id: Optional[int] = None
    date: date
    head_count: int = Field(..., gt=0)
    cause: Optional[str] = ""
    notes: Optional[str] = ""


class MortalityUpdate(BaseModel):
    cage_id: Optional[int] = None
    date: Optional[date] = None
    head_count: Optional[int] = Field(None, gt=0)
    cause: Optional[str] = None
    notes: Optional[str] = None


class MortalityResponse(BaseModel):
    id: int
    batch_id: int
    cage_id: Optional[int] = None
    date: date
    head_count: int
    cause: str
    notes: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── INVENTORY ──────────────────────────────────────────────────────

class InventoryItemCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    category: InventoryCategory
    unit: str = Field("kg", max_length=20)
    stock_qty: Optional[float] = Field(0.0, ge=0)
    threshold_qty: Optional[float] = Field(0.0, ge=0)
    unit_cost: Optional[float] = Field(0.0, ge=0)
    supplier: Optional[str] = ""
    notes: Optional[str] = ""


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    category: Optional[InventoryCategory] = None
    unit: Optional[str] = Field(None, max_length=20)
    threshold_qty: Optional[float] = Field(None, ge=0)
    unit_cost: Optional[float] = Field(None, ge=0)
    supplier: Optional[str] = None
    notes: Optional[str] = None


class InventoryItemResponse(BaseModel):
    id: int
    name: str
    category: str
    unit: str
    stock_qty: float
    threshold_qty: float
    unit_cost: float
    supplier: str
    notes: str
    is_low_stock: bool
    created_at: datetime
    updated_at: datetime
    last_restocked_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class RestockRequest(BaseModel):
    qty: float = Field(..., gt=0)
    unit_cost: Optional[float] = Field(None, ge=0)
    batch_id: Optional[int] = None
    notes: Optional[str] = ""
    create_expense: Optional[bool] = False


class IssueRequest(BaseModel):
    qty: float = Field(..., gt=0)
    batch_id: Optional[int] = None
    notes: Optional[str] = ""
    create_expense: Optional[bool] = False


class InventoryTransactionResponse(BaseModel):
    id: int
    item_id: int
    type: str
    qty: float
    unit_cost: float
    batch_id: Optional[int] = None
    notes: str
    creates_expense: bool
    expense_id: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class LowStockAlert(BaseModel):
    item: InventoryItemResponse
    status: str  # "low" | "critical"


class ReminderItem(BaseModel):
    id: int
    title: str
    description: str
    reminder_type: str
    batch_id: Optional[int] = None
    due_date: date
    status: str
    recurring: bool

    model_config = {"from_attributes": True}


# ─── VITAMINS / HEALTH SCHEDULE ─────────────────────────────────────

class VitaminLogCreate(BaseModel):
    batch_id: Optional[int] = None
    cage_id: Optional[int] = None
    vitamin_name: str = Field(..., min_length=1, max_length=120)
    dosage: Optional[float] = Field(0.0, ge=0)
    unit: str = Field("ml", max_length=20)
    date_administered: date
    next_due_date: Optional[date] = None
    notes: Optional[str] = ""
    create_reminder: Optional[bool] = False


class VitaminLogUpdate(BaseModel):
    batch_id: Optional[int] = None
    cage_id: Optional[int] = None
    vitamin_name: Optional[str] = Field(None, min_length=1, max_length=120)
    dosage: Optional[float] = Field(None, ge=0)
    unit: Optional[str] = Field(None, max_length=20)
    date_administered: Optional[date] = None
    next_due_date: Optional[date] = None
    notes: Optional[str] = None


class VitaminLogResponse(BaseModel):
    id: int
    batch_id: Optional[int] = None
    cage_id: Optional[int] = None
    vitamin_name: str
    dosage: float
    unit: str
    date_administered: date
    next_due_date: Optional[date] = None
    notes: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ReminderCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = ""
    reminder_type: str = Field("general", pattern="^(vitamin|general)$")
    batch_id: Optional[int] = None
    due_date: date
    recurring: Optional[bool] = False


class ReminderUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = None
    reminder_type: Optional[str] = Field(None, pattern="^(vitamin|general)$")
    batch_id: Optional[int] = None
    due_date: Optional[date] = None
    status: Optional[str] = Field(None, pattern="^(pending|done|cancelled)$")
    recurring: Optional[bool] = None


class ReminderResponse(BaseModel):
    id: int
    title: str
    description: str
    reminder_type: str
    batch_id: Optional[int] = None
    due_date: date
    status: str
    recurring: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── CONTACT ────────────────────────────────────────────────────────

class ContactCreate(BaseModel):
    subject: str = Field(..., min_length=3, max_length=200)
    message: str = Field(..., min_length=10, max_length=5000)


class ContactResponse(BaseModel):
    id: int
    subject: str
    user_id: Optional[int] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── DASHBOARD / REPORTS ────────────────────────────────────────────

class GrowthPoint(BaseModel):
    month: str
    avg_weight_kg: float


class BatchSummary(BaseModel):
    batch: BatchResponse
    total_expenses: float
    feed_cost: float
    other_expenses: float
    total_revenue: float
    net_profit: float
    roi_percentage: float
    profit_margin_pct: float
    cost_per_head: float
    profit_per_head: float
    avg_selling_price_kg: float
    avg_live_weight_kg: float
    total_weight_sold: float
    piglet_cost: float
    piglet_heads: int
    buy_price_per_head: float
    sell_price_per_head: float
    heads_sold: int
    heads_remaining: int
    heads_lost: int
    expense_breakdown: dict
    growth: List[GrowthPoint]


class DashboardOverview(BaseModel):
    active_batches: int
    closed_batches: int
    total_current_heads: int
    projected_revenue: float
    total_expenses: float
    total_revenue: float
    total_profit: float
    low_stock_alerts: List[LowStockAlert]
    pending_reminders: List[ReminderItem]
    batches: List[BatchSummary]


class Statement(BaseModel):
    batch: BatchResponse
    period_end: date
    total_revenue: float
    total_expenses: float
    net_income: float
    profit_margin_pct: float
    other_expenses: float
    expense_breakdown: dict
    total_weight_kg: float
    heads_sold: int
    heads_remaining: int
    heads_lost: int
    feed_cost: float
    avg_selling_price_kg: float
    piglet_cost: float
    piglet_heads: int
    buy_price_per_head: float
    sell_price_per_head: float
    cost_per_head: float
    profit_per_head: float
    sales: List[SaleResponse]