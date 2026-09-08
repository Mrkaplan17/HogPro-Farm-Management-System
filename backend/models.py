from sqlalchemy import Column, Integer, Float, String, Date, DateTime, Boolean, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from database import Base


class BatchStatus(str, enum.Enum):
    ACTIVE = "active"
    CLOSED = "closed"


class ExpenseCategory(str, enum.Enum):
    PIGLETS = "piglets"
    FEED = "feed"
    MEDICINE = "medicine"
    VETERINARY = "veterinary"
    UTILITIES = "utilities"
    LABOR = "labor"
    MAINTENANCE = "maintenance"
    INVENTORY = "inventory"
    MISC = "misc"


class InventoryCategory(str, enum.Enum):
    FEED = "feed"
    MEDICINE = "medicine"
    VITAMIN = "vitamin"
    SUPPLIES = "supplies"


class TransactionType(str, enum.Enum):
    RESTOCK = "restock"
    ISSUE = "issue"


class SubscriptionStatus(str, enum.Enum):
    FREE = "free"
    PRO = "pro"
    SUSPENDED = "suspended"


# ─── USERS (auth / onboarding / subscription hook) ───────────────────

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(50), unique=True, nullable=True, index=True)
    password_hash = Column(String(255), nullable=True)          # None for OAuth-only accounts
    full_name = Column(String(100), default="")
    farm_name = Column(String(120), default="")
    farm_location = Column(String(120), default="")
    role = Column(String(20), default="worker")                 # admin | worker
    is_active = Column(Boolean, default=True)
    subscription_status = Column(String(20), default=SubscriptionStatus.FREE.value)
    is_onboarded = Column(Boolean, default=False)
    google_sub = Column(String(100), unique=True, nullable=True)
    facebook_sub = Column(String(100), unique=True, nullable=True)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    expenses = relationship("Expense", back_populates="recorded_by", foreign_keys="Expense.recorded_by_id")


# ─── PRODUCTION: BATCH / PIGPEN TRACKING ────────────────────────────

class Batch(Base):
    __tablename__ = "batches"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), unique=True, nullable=False)
    initial_head_count = Column(Integer, nullable=False)
    current_head_count = Column(Integer, nullable=False)
    start_date = Column(Date, nullable=False)
    status = Column(String(20), default=BatchStatus.ACTIVE.value)
    market_price_per_kg = Column(Float, default=140.0)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    closed_at = Column(DateTime, nullable=True)

    cages = relationship("Cage", back_populates="batch", cascade="all, delete-orphan", order_by="Cage.id")
    expenses = relationship("Expense", back_populates="batch", cascade="all, delete-orphan")
    sales = relationship("Sale", back_populates="batch", cascade="all, delete-orphan")
    mortalities = relationship("Mortality", back_populates="batch", cascade="all, delete-orphan")
    vitamin_logs = relationship("VitaminLog", back_populates="batch")
    transactions = relationship("InventoryTransaction", back_populates="batch")


class Cage(Base):
    __tablename__ = "cages"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    name = Column(String(50), nullable=False)
    head_count = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="cages")


# ─── PRODUCTION: OPERATIONAL LOGS ───────────────────────────────────

class Sale(Base):
    __tablename__ = "sales"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    heads_sold = Column(Integer, nullable=False)
    weight_kg = Column(Float, nullable=False)
    price_per_kilo = Column(Float, nullable=False)
    total_revenue = Column(Float, nullable=False)
    buyer_name = Column(String(100), default="")
    buyer_contact = Column(String(100), default="")
    sale_date = Column(Date, nullable=False)
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="sales")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan", order_by="SaleItem.id")


class SaleItem(Base):
    """Per-head or per-cage line item within a sale."""

    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False)
    cage_id = Column(Integer, ForeignKey("cages.id"), nullable=True)
    tag_id = Column(String(50), default="")
    head_count = Column(Integer, default=1)
    mode = Column(String(10), default="per_kilo")  # per_head | per_kilo
    live_weight_kg = Column(Float, nullable=False, default=0.0)  # 0 for per_head sales
    price_per_kilo = Column(Float, nullable=False, default=0.0)
    price_per_head = Column(Float, nullable=False, default=0.0)
    amount = Column(Float, nullable=False)

    sale = relationship("Sale", back_populates="items")


class Mortality(Base):
    __tablename__ = "mortalities"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    cage_id = Column(Integer, ForeignKey("cages.id"), nullable=True)
    date = Column(Date, nullable=False)
    head_count = Column(Integer, nullable=False)
    cause = Column(String(100), default="")
    notes = Column(Text, default="")
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="mortalities")


# ─── EXPENSES: FINANCIAL LEDGER ─────────────────────────────────────

class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)   # optional (general ledger)
    category = Column(String(50), nullable=False)
    description = Column(String(255), nullable=False)
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float, default=0.0)
    amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False)
    cage_id = Column(Integer, ForeignKey("cages.id"), nullable=True)
    head_count = Column(Integer, nullable=True)
    source = Column(String(20), default="manual")                # manual | inventory
    inventory_item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="expenses")
    inventory_item = relationship("InventoryItem", foreign_keys=[inventory_item_id])
    recorded_by = relationship("User", foreign_keys=[recorded_by_id])

    __table_args__ = (Index("ix_expenses_batch_date", "batch_id", "date"),)


# ─── INVENTORY: FEEDS / MEDICINES / VITAMINS ────────────────────────

class InventoryItem(Base):
    __tablename__ = "inventory_items"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    category = Column(String(20), nullable=False)                # feed | medicine | vitamin | supplies
    unit = Column(String(20), default="kg")                     # kg | sack | bottle | vial | ml | piece
    stock_qty = Column(Float, default=0.0)
    threshold_qty = Column(Float, default=0.0)
    unit_cost = Column(Float, default=0.0)
    supplier = Column(String(120), default="")
    notes = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_restocked_at = Column(DateTime, nullable=True)

    transactions = relationship("InventoryTransaction", back_populates="item", cascade="all, delete-orphan", order_by="InventoryTransaction.id")


class InventoryTransaction(Base):
    """A stock movement line. Restock lines are inventory batches: each carries
    its own unit_cost and total_cost (qty x unit_cost), linked to the Expense
    record that was auto-created for that purchase."""

    __tablename__ = "inventory_transactions"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("inventory_items.id"), nullable=False)
    type = Column(String(10), nullable=False)                   # restock | issue
    qty = Column(Float, nullable=False)
    unit_cost = Column(Float, default=0.0)
    total_cost = Column(Float, default=0.0)                     # qty x unit_cost
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)
    notes = Column(Text, default="")
    creates_expense = Column(Boolean, default=False)
    expense_id = Column(Integer, ForeignKey("expenses.id"), nullable=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    item = relationship("InventoryItem", back_populates="transactions")
    batch = relationship("Batch", back_populates="transactions")
    expense = relationship("Expense", foreign_keys=[expense_id])


# ─── VITAMINS / HEALTH SCHEDULE ─────────────────────────────────────

class VitaminLog(Base):
    __tablename__ = "vitamin_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)
    cage_id = Column(Integer, ForeignKey("cages.id"), nullable=True)
    vitamin_name = Column(String(120), nullable=False)
    dosage = Column(Float, default=0.0)
    unit = Column(String(20), default="ml")                     # ml | cc | dose | mg
    date_administered = Column(Date, nullable=False)
    next_due_date = Column(Date, nullable=True)
    notes = Column(Text, default="")
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="vitamin_logs")


class Reminder(Base):
    """Future schedule entries / calendar reminders (vitamin schedules, tasks)."""

    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    description = Column(Text, default="")
    reminder_type = Column(String(20), default="general")       # vitamin | general
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=True)
    due_date = Column(Date, nullable=False)
    status = Column(String(20), default="pending")              # pending | done | cancelled
    recurring = Column(Boolean, default=False)
    created_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch")


# ─── CONTACT / FEEDBACK ─────────────────────────────────────────────

class ContactMessage(Base):
    __tablename__ = "contact_messages"

    id = Column(Integer, primary_key=True, index=True)
    subject = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    status = Column(String(20), default="received")             # received | sent | failed
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")