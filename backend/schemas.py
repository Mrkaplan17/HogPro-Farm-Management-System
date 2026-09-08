from pydantic import BaseModel, Field
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
    MISC = "misc"


# ─── AUTH ───────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=100)
    full_name: str = Field("", max_length=100)


class LoginRequest(BaseModel):
    username: str
    password: str


class UserOut(BaseModel):
    id: int
    username: str
    full_name: str
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


# ─── BATCH ──────────────────────────────────────────────────────────

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
    initial_head_count: int = Field(..., gt=0)
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


# ─── EXPENSE ────────────────────────────────────────────────────────

class ExpenseCreate(BaseModel):
    batch_id: int
    category: ExpenseCategory
    description: str = Field(..., min_length=1, max_length=255)
    quantity: Optional[float] = Field(None, gt=0)
    unit_price: Optional[float] = Field(None, ge=0)
    amount: Optional[float] = Field(None, gt=0)
    date: date
    cage_id: Optional[int] = None
    head_count: Optional[int] = Field(None, ge=1)


class ExpenseUpdate(BaseModel):
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
    batch_id: int
    category: str
    description: str
    quantity: float
    unit_price: float
    amount: float
    date: date
    cage_id: Optional[int] = None
    head_count: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


# ─── SALE + ITEMS ───────────────────────────────────────────────────

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


# ─── FEED LOG ───────────────────────────────────────────────────────

class FeedLogCreate(BaseModel):
    batch_id: int
    cage_id: Optional[int] = None
    date: date
    feed_type: str = Field("grower", min_length=1, max_length=50)
    sacks: Optional[float] = Field(0.0, ge=0)
    quantity_kg: Optional[float] = Field(0.0, ge=0)
    notes: Optional[str] = ""


class FeedLogUpdate(BaseModel):
    cage_id: Optional[int] = None
    date: Optional[date] = None
    feed_type: Optional[str] = Field(None, min_length=1, max_length=50)
    sacks: Optional[float] = Field(None, ge=0)
    quantity_kg: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None


class FeedLogResponse(BaseModel):
    id: int
    batch_id: int
    cage_id: Optional[int] = None
    date: date
    feed_type: str
    sacks: float
    quantity_kg: float
    cost: float
    notes: str
    created_at: datetime

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


# ─── DASHBOARD / REPORTS ────────────────────────────────────────────

class GrowthPoint(BaseModel):
    month: str
    avg_weight_kg: float


class BatchSummary(BaseModel):
    batch: BatchResponse
    total_expenses: float
    feed_cost: float
    feed_quantity_kg: float
    other_expenses: float
    total_revenue: float
    net_profit: float
    roi_percentage: float
    profit_margin_pct: float
    cost_per_head: float
    profit_per_head: float
    feed_cost_per_kg_sold: float
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
    total_feeds_consumed_kg: float
    projected_revenue: float
    total_expenses: float
    total_revenue: float
    total_profit: float
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
    feed_kg: float
    feed_cost: float
    avg_selling_price_kg: float
    piglet_cost: float
    piglet_heads: int
    buy_price_per_head: float
    sell_price_per_head: float
    cost_per_head: float
    profit_per_head: float
    sales: List[SaleResponse]