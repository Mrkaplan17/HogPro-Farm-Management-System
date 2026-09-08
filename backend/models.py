from sqlalchemy import Column, Integer, Float, String, Date, DateTime, Boolean, ForeignKey, Text
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
    MISC = "misc"


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
    feed_logs = relationship("FeedLog", back_populates="batch", cascade="all, delete-orphan")
    mortalities = relationship("Mortality", back_populates="batch", cascade="all, delete-orphan")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(100), default="")
    role = Column(String(20), default="worker")  # admin | worker
    created_at = Column(DateTime, default=datetime.utcnow)


class Cage(Base):
    __tablename__ = "cages"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    name = Column(String(50), nullable=False)
    head_count = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="cages")


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    category = Column(String(50), nullable=False)
    description = Column(String(255), nullable=False)
    quantity = Column(Float, default=1.0)
    unit_price = Column(Float, default=0.0)
    amount = Column(Float, nullable=False)
    date = Column(Date, nullable=False)
    cage_id = Column(Integer, ForeignKey("cages.id"), nullable=True)
    head_count = Column(Integer, nullable=True)
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="expenses")


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


class FeedLog(Base):
    """Daily feed consumption per batch (optionally per cage). Cost is captured
    through piglets/feed expense entries; this table only tracks consumption."""

    __tablename__ = "feed_logs"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), nullable=False)
    cage_id = Column(Integer, ForeignKey("cages.id"), nullable=True)
    date = Column(Date, nullable=False)
    feed_type = Column(String(50), default="grower")
    sacks = Column(Float, default=0.0)
    quantity_kg = Column(Float, default=0.0)
    cost = Column(Float, default=0.0)
    notes = Column(Text, default="")
    recorded_by_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("Batch", back_populates="feed_logs")


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