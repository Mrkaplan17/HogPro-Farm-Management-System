from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional
from datetime import date, datetime
import os

from database import engine, get_db, Base, DATABASE_URL
from models import Batch, Cage, Expense, Sale, SaleItem, FeedLog, Mortality, User, BatchStatus, ExpenseCategory
from security import hash_password, verify_password, create_access_token, get_current_user, require_admin
from schemas import (
    UserCreate, LoginRequest, UserOut, TokenResponse,
    BatchCreate, BatchUpdate, BatchResponse,
    CageCreate, CageUpdate, CageResponse,
    ExpenseCreate, ExpenseUpdate, ExpenseResponse,
    SaleCreate, SaleUpdate, SaleResponse,
    FeedLogCreate, FeedLogUpdate, FeedLogResponse,
    MortalityCreate, MortalityUpdate, MortalityResponse,
    BatchSummary, DashboardOverview, Statement, GrowthPoint,
)

Base.metadata.create_all(bind=engine)


def _ensure_columns():
    """Lightweight migration for SQLite: add new columns to existing tables."""
    if not DATABASE_URL.startswith("sqlite"):
        return
    with engine.begin() as conn:
        def has_column(table, col):
            rows = conn.exec_driver_sql(f"PRAGMA table_info({table})").fetchall()
            return any(r[1] == col for r in rows)

        if not has_column("expenses", "cage_id"):
            conn.exec_driver_sql("ALTER TABLE expenses ADD COLUMN cage_id INTEGER")
        if not has_column("expenses", "head_count"):
            conn.exec_driver_sql("ALTER TABLE expenses ADD COLUMN head_count INTEGER")
        if not has_column("expenses", "quantity"):
            conn.exec_driver_sql("ALTER TABLE expenses ADD COLUMN quantity FLOAT DEFAULT 1.0")
        if not has_column("expenses", "unit_price"):
            conn.exec_driver_sql("ALTER TABLE expenses ADD COLUMN unit_price FLOAT DEFAULT 0.0")
        if not has_column("sale_items", "mode"):
            conn.exec_driver_sql("ALTER TABLE sale_items ADD COLUMN mode VARCHAR(10) DEFAULT 'per_kilo'")
        if not has_column("sale_items", "price_per_head"):
            conn.exec_driver_sql("ALTER TABLE sale_items ADD COLUMN price_per_head FLOAT DEFAULT 0")
        if not has_column("feed_logs", "sacks"):
            conn.exec_driver_sql("ALTER TABLE feed_logs ADD COLUMN sacks FLOAT DEFAULT 0")
        if not has_column("batches", "closed_at"):
            conn.exec_driver_sql("ALTER TABLE batches ADD COLUMN closed_at DATETIME")


_ensure_columns()

app = FastAPI(title="HogPros API — Farm Management & Batch Profitability", version="2.0.0")

_default_origins = ["http://localhost:5173", "http://localhost:3000"]
_origins_env = os.environ.get("CORS_ORIGINS")
origins = ([o.strip() for o in _origins_env.split(",") if o.strip()] if _origins_env else _default_origins)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── HELPERS ───────────────────────────────────────────────────────

def _get_batch_or_404(batch_id, db):
    batch = db.query(Batch).options(selectinload(Batch.cages)).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


def _ensure_batch_open(batch):
    if batch.status == BatchStatus.CLOSED.value:
        raise HTTPException(status_code=400, detail="Batch is closed and locked. This record is read-only history.")


def _sold_heads(db, batch_id):
    return sum(s.heads_sold for s in db.query(Sale).filter(Sale.batch_id == batch_id).all())


def _sync_head_counts(batch):
    if batch.cages:
        batch.current_head_count = sum(c.head_count for c in batch.cages)


def _deduct_heads(batch, heads, cage_id=None):
    """Reduce inventory by `heads`. With a specific cage, the deduction must
    be fully covered by that cage; otherwise heads are taken from any cage
    (then batch-level). Rejects any request exceeding what is available."""
    requested = max(0, heads)
    total_available = batch.current_head_count
    if requested > total_available:
        raise HTTPException(status_code=400, detail=f"Cannot deduct {heads} heads — only {total_available} head{'s' if total_available != 1 else ''} remain.")
    if cage_id is not None:
        cage = next((c for c in batch.cages if c.id == cage_id), None)
        if cage is None:
            raise HTTPException(status_code=400, detail="Cage does not belong to this batch")
        if requested > cage.head_count:
            raise HTTPException(status_code=400, detail=f"Cage '{cage.name}' only has {cage.head_count} head{'s' if cage.head_count != 1 else ''} left.")
        cage.head_count -= requested
    elif batch.cages:
        for cage in sorted(batch.cages, key=lambda c: c.id):
            if requested <= 0:
                break
            take = min(cage.head_count, requested)
            cage.head_count -= take
            requested -= take
    _sync_head_counts(batch)
    if not batch.cages:
        batch.current_head_count = max(0, batch.current_head_count - requested)


def _restore_heads(batch, heads, cage_id=None):
    if cage_id is not None:
        cage = next((c for c in batch.cages if c.id == cage_id), None)
        if cage is not None:
            cage.head_count += heads
    elif batch.cages:
        batch.cages[-1].head_count += heads
    else:
        batch.current_head_count += heads
        return
    _sync_head_counts(batch)


def _batch_financials(db, batch):
    expenses = db.query(Expense).filter(Expense.batch_id == batch.id).all()
    feeds = db.query(FeedLog).filter(FeedLog.batch_id == batch.id).all()
    sales = db.query(Sale).filter(Sale.batch_id == batch.id).options(selectinload(Sale.items)).all()
    mortalities = db.query(Mortality).filter(Mortality.batch_id == batch.id).all()

    feed_purchases = sum(e.amount for e in expenses if e.category == ExpenseCategory.FEED.value)
    piglet_expenses = [e for e in expenses if e.category == ExpenseCategory.PIGLETS.value]
    piglet_cost = sum(e.amount for e in piglet_expenses)
    piglet_heads = sum(e.head_count or 0 for e in piglet_expenses)
    other_expenses = sum(e.amount for e in expenses if e.category != ExpenseCategory.FEED.value)
    feed_cost = feed_purchases + sum(f.cost for f in feeds)
    feed_kg = sum(f.quantity_kg for f in feeds)
    feed_sacks = sum(f.sacks or 0 for f in feeds)
    total_expenses = other_expenses + feed_cost

    total_revenue = sum(s.total_revenue for s in sales)
    total_weight = sum(s.weight_kg for s in sales)
    heads_sold = sum(s.heads_sold for s in sales)
    heads_lost = sum(m.head_count for m in mortalities)
    net_profit = total_revenue - total_expenses
    heads_remaining = batch.current_head_count

    avg_selling_price_kg = (total_revenue / total_weight) if total_weight > 0 else 0
    avg_live_weight_kg = (total_weight / heads_sold) if heads_sold > 0 else 0
    buy_price_per_head = (piglet_cost / piglet_heads) if piglet_heads > 0 else 0
    sell_price_per_head = (total_revenue / heads_sold) if heads_sold > 0 else 0
    invested_heads = (batch.initial_head_count or 0) + piglet_heads
    cost_per_head = total_expenses / invested_heads if invested_heads > 0 else 0
    profit_per_head = (net_profit / heads_sold) if heads_sold > 0 else 0
    roi = (net_profit / total_expenses * 100) if total_expenses > 0 else 0
    margin = (net_profit / total_revenue * 100) if total_revenue > 0 else 0
    feed_cost_per_kg_sold = (feed_cost / total_weight) if total_weight > 0 else 0

    breakdown = {}
    for e in expenses:
        breakdown[e.category] = breakdown.get(e.category, 0) + e.amount
    feed_log_costs = sum(f.cost for f in feeds)
    if feed_log_costs:
        breakdown["feed"] = breakdown.get("feed", 0) + feed_log_costs

    # Growth timeline: average live weight per head sold, by month
    growth_map = {}
    for s in sales:
        if s.heads_sold > 0 and s.weight_kg > 0:
            month = s.sale_date.strftime("%Y-%m")
            avg_h = s.weight_kg / s.heads_sold
            growth_map.setdefault(month, []).append(avg_h)
    growth = [
        GrowthPoint(month=m, avg_weight_kg=round(sum(v) / len(v), 2))
        for m, v in sorted(growth_map.items())
    ]

    return {
        "other_expenses": other_expenses,
        "feed_cost": feed_cost,
        "feed_kg": feed_kg,
        "feed_sacks": feed_sacks,
        "total_expenses": total_expenses,
        "total_revenue": total_revenue,
        "net_profit": net_profit,
        "total_weight": total_weight,
        "heads_sold": heads_sold,
        "heads_lost": heads_lost,
        "heads_remaining": heads_remaining,
        "avg_selling_price_kg": avg_selling_price_kg,
        "avg_live_weight_kg": avg_live_weight_kg,
        "piglet_cost": piglet_cost,
        "piglet_heads": piglet_heads,
        "buy_price_per_head": buy_price_per_head,
        "sell_price_per_head": sell_price_per_head,
        "cost_per_head": cost_per_head,
        "profit_per_head": profit_per_head,
        "roi": roi,
        "margin": margin,
        "feed_cost_per_kg_sold": feed_cost_per_kg_sold,
        "breakdown": breakdown,
        "growth": growth,
        "expenses": expenses,
        "feeds": feeds,
        "sales": sales,
        "mortalities": mortalities,
    }


# ─── AUTH ENDPOINTS ────────────────────────────────────────────────

@app.post("/api/auth/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == data.username).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@app.post("/api/auth/register", response_model=UserOut)
def register(data: UserCreate, db: Session = Depends(get_db)):
    """Public self-signup. Every account created here is an administrator."""
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")
    user = User(
        username=data.username,
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        role="admin",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.get("/api/auth/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@app.get("/api/users", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return db.query(User).order_by(User.created_at.desc()).all()


# ─── BATCH ENDPOINTS ───────────────────────────────────────────────

@app.get("/api/batches", response_model=List[BatchResponse])
def list_batches(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Batch).options(selectinload(Batch.cages))
    if status:
        query = query.filter(Batch.status == status)
    return query.order_by(Batch.created_at.desc()).all()


@app.get("/api/batches/{batch_id}", response_model=BatchResponse)
def get_batch(
    batch_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_batch_or_404(batch_id, db)


@app.post("/api/batches", response_model=BatchResponse)
def create_batch(batch_data: BatchCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    existing = db.query(Batch).filter(Batch.name == batch_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Batch name already exists")

    total_heads = batch_data.initial_head_count
    if batch_data.cages:
        total_heads = sum(c.head_count for c in batch_data.cages)
        if total_heads <= 0:
            raise HTTPException(status_code=400, detail="Cage head counts must be greater than zero")

    batch = Batch(
        name=batch_data.name,
        initial_head_count=total_heads,
        current_head_count=total_heads,
        start_date=batch_data.start_date,
        status=BatchStatus.ACTIVE.value,
        market_price_per_kg=batch_data.market_price_per_kg or 140.0,
        notes=batch_data.notes or "",
    )
    db.add(batch)
    db.flush()

    if batch_data.cages:
        for cage in batch_data.cages:
            db.add(Cage(batch_id=batch.id, name=cage.name, head_count=cage.head_count))

    db.commit()
    db.refresh(batch)
    return batch


@app.put("/api/batches/{batch_id}", response_model=BatchResponse)
def update_batch(batch_id: int, batch_data: BatchUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    batch = _get_batch_or_404(batch_id, db)
    _ensure_batch_open(batch)
    if batch_data.name is not None:
        existing = db.query(Batch).filter(Batch.name == batch_data.name, Batch.id != batch_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Batch name already exists")
        batch.name = batch_data.name
    if batch_data.notes is not None:
        batch.notes = batch_data.notes
    if batch_data.market_price_per_kg is not None:
        batch.market_price_per_kg = batch_data.market_price_per_kg
    db.commit()
    db.refresh(batch)
    return batch


@app.post("/api/batches/{batch_id}/close", response_model=BatchResponse)
def close_batch(batch_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    batch = _get_batch_or_404(batch_id, db)
    if batch.status == BatchStatus.CLOSED.value:
        raise HTTPException(status_code=400, detail="Batch is already closed")
    if batch.current_head_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot close batch: {batch.current_head_count} heads still remaining. Record all sales first.")
    batch.status = BatchStatus.CLOSED.value
    batch.closed_at = datetime.utcnow()
    db.commit()
    db.refresh(batch)
    return batch


@app.delete("/api/batches/{batch_id}")
def delete_batch(batch_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    batch = _get_batch_or_404(batch_id, db)
    _ensure_batch_open(batch)
    db.delete(batch)
    db.commit()
    return {"message": "Batch deleted"}


@app.get("/api/batches/{batch_id}/statement", response_model=Statement)
def get_statement(batch_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    """Printable Profit & Loss statement for a batch."""
    batch = _get_batch_or_404(batch_id, db)
    fin = _batch_financials(db, batch)
    sales_ordered = sorted(fin["sales"], key=lambda s: s.sale_date)
    period_end = batch.closed_at.date() if (batch.status == BatchStatus.CLOSED.value and batch.closed_at) else date.today()
    return Statement(
        batch=BatchResponse.model_validate(batch),
        period_end=period_end,
        total_revenue=round(fin["total_revenue"], 2),
        total_expenses=round(fin["total_expenses"], 2),
        net_income=round(fin["net_profit"], 2),
        profit_margin_pct=round(fin["margin"], 2),
        other_expenses=round(fin["other_expenses"], 2),
        expense_breakdown={k: round(v, 2) for k, v in fin["breakdown"].items()},
        total_weight_kg=round(fin["total_weight"], 2),
        heads_sold=fin["heads_sold"],
        heads_remaining=fin["heads_remaining"],
        heads_lost=fin["heads_lost"],
        feed_kg=round(fin["feed_kg"], 2),
        feed_cost=round(fin["feed_cost"], 2),
        avg_selling_price_kg=round(fin["avg_selling_price_kg"], 2),
        piglet_cost=round(fin["piglet_cost"], 2),
        piglet_heads=fin["piglet_heads"],
        buy_price_per_head=round(fin["buy_price_per_head"], 2),
        sell_price_per_head=round(fin["sell_price_per_head"], 2),
        cost_per_head=round(fin["cost_per_head"], 2),
        profit_per_head=round(fin["profit_per_head"], 2),
        sales=[SaleResponse.model_validate(s) for s in sales_ordered],
    )


# ─── CAGE ENDPOINTS ────────────────────────────────────────────────

@app.post("/api/cages", response_model=CageResponse)
def create_cage(cage_data: CageCreate, batch_id: int = Query(...), db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    batch = _get_batch_or_404(batch_id, db)
    _ensure_batch_open(batch)
    existing = db.query(Cage).filter(Cage.batch_id == batch_id, Cage.name == cage_data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Cage name already exists in this batch")
    cage = Cage(batch_id=batch_id, name=cage_data.name, head_count=cage_data.head_count)
    batch.cages.append(cage)
    _sync_head_counts(batch)
    db.commit()
    db.refresh(cage)
    return cage


@app.put("/api/cages/{cage_id}", response_model=CageResponse)
def update_cage(cage_id: int, cage_data: CageUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    cage = db.query(Cage).filter(Cage.id == cage_id).first()
    if not cage:
        raise HTTPException(status_code=404, detail="Cage not found")
    batch = _get_batch_or_404(cage.batch_id, db)
    _ensure_batch_open(batch)
    if cage_data.name is not None:
        existing = db.query(Cage).filter(Cage.batch_id == batch.id, Cage.name == cage_data.name, Cage.id != cage_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="Cage name already exists in this batch")
        cage.name = cage_data.name
    if cage_data.head_count is not None:
        sold = _sold_heads(db, batch.id)
        remaining_needed = cage_data.head_count + sum(c.head_count for c in batch.cages if c.id != cage_id)
        if remaining_needed < sold:
            raise HTTPException(status_code=400, detail="Cage head counts cannot go below total heads sold for this batch")
        cage.head_count = cage_data.head_count
    _sync_head_counts(batch)
    db.commit()
    db.refresh(cage)
    return cage


@app.delete("/api/cages/{cage_id}")
def delete_cage(cage_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    cage = db.query(Cage).filter(Cage.id == cage_id).first()
    if not cage:
        raise HTTPException(status_code=404, detail="Cage not found")
    batch = _get_batch_or_404(cage.batch_id, db)
    _ensure_batch_open(batch)
    db.delete(cage)
    db.flush()
    _sync_head_counts(batch)
    db.commit()
    return {"message": "Cage deleted"}


# ─── EXPENSE ENDPOINTS ─────────────────────────────────────────────

@app.get("/api/expenses", response_model=List[ExpenseResponse])
def list_expenses(
    batch_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Expense)
    if batch_id:
        query = query.filter(Expense.batch_id == batch_id)
    if category:
        query = query.filter(Expense.category == category)
    return query.order_by(Expense.date.desc()).all()


@app.post("/api/expenses", response_model=ExpenseResponse)
def create_expense(expense_data: ExpenseCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    batch = _get_batch_or_404(expense_data.batch_id, db)
    _ensure_batch_open(batch)
    data = expense_data.model_dump()

    quantity = data.get("quantity")
    unit_price = data.get("unit_price")
    if quantity is not None and unit_price is not None:
        if quantity <= 0:
            raise HTTPException(status_code=400, detail="Quantity must be greater than zero")
        amount = round(quantity * unit_price, 2)
    elif data.get("amount"):
        amount = data["amount"]
    else:
        raise HTTPException(status_code=400, detail="Provide quantity and unit price (or a total amount)")

    category = data["category"].value if hasattr(data["category"], "value") else data["category"]
    cage = None
    head_count = None
    if category == ExpenseCategory.PIGLETS.value:
        if not expense_data.cage_id:
            raise HTTPException(status_code=400, detail="Cage is required for piglet purchases")
        cage = next((c for c in batch.cages if c.id == expense_data.cage_id), None)
        if cage is None:
            raise HTTPException(status_code=400, detail="Cage does not belong to this batch")
        duplicate = db.query(Expense).filter(
            Expense.batch_id == batch.id,
            Expense.category == ExpenseCategory.PIGLETS.value,
            Expense.cage_id == cage.id,
        ).first()
        if duplicate:
            raise HTTPException(status_code=400, detail="A piglet cost is already recorded for this cage. Piglet cost is recorded once per cage.")
        head_count = int(round(quantity or 0)) or 1

    expense = Expense(
        batch_id=data["batch_id"],
        category=category,
        description=data["description"],
        quantity=quantity,
        unit_price=unit_price,
        amount=amount,
        date=data["date"],
        cage_id=cage.id if cage else None,
        head_count=head_count,
        recorded_by_id=current_user.id,
    )
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@app.put("/api/expenses/{expense_id}", response_model=ExpenseResponse)
def update_expense(expense_id: int, expense_data: ExpenseUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    batch = _get_batch_or_404(expense.batch_id, db)
    _ensure_batch_open(batch)

    update_data = expense_data.model_dump(exclude_unset=True)

    if "quantity" in update_data or "unit_price" in update_data:
        qty = update_data.get("quantity", expense.quantity)
        up = update_data.get("unit_price", expense.unit_price)
        if qty is not None and up is not None:
            update_data["amount"] = round(qty * up, 2)

    category = update_data.get("category", expense.category)
    category = category.value if hasattr(category, "value") else category
    cage_id = update_data.get("cage_id", expense.cage_id)

    if category == ExpenseCategory.PIGLETS.value:
        if not cage_id:
            raise HTTPException(status_code=400, detail="Cage is required for piglet purchases")
        if not any(c.id == cage_id for c in batch.cages):
            raise HTTPException(status_code=400, detail="Cage does not belong to this batch")
        duplicate = db.query(Expense).filter(
            Expense.batch_id == batch.id,
            Expense.category == ExpenseCategory.PIGLETS.value,
            Expense.cage_id == cage_id,
            Expense.id != expense.id,
        ).first()
        if duplicate:
            raise HTTPException(status_code=400, detail="A piglet cost is already recorded for this cage. Piglet cost is recorded once per cage.")
        qty = update_data.get("quantity", expense.quantity)
        if qty is None or qty <= 0:
            raise HTTPException(status_code=400, detail="Number of piglets (quantity) is required for piglet purchases")
        update_data["head_count"] = int(round(qty))

    for key, value in update_data.items():
        setattr(expense, key, value)

    db.commit()
    db.refresh(expense)
    return expense


@app.delete("/api/expenses/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    batch = _get_batch_or_404(expense.batch_id, db)
    _ensure_batch_open(batch)
    db.delete(expense)
    db.commit()
    return {"message": "Expense deleted"}


# ─── SALE ENDPOINTS (ADMIN / FINANCIAL) ────────────────────────────

@app.get("/api/sales", response_model=List[SaleResponse])
def list_sales(batch_id: Optional[int] = Query(None), db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    query = db.query(Sale).options(selectinload(Sale.items))
    if batch_id:
        query = query.filter(Sale.batch_id == batch_id)
    return query.order_by(Sale.sale_date.desc()).all()


@app.post("/api/sales", response_model=SaleResponse)
def create_sale(sale_data: SaleCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    batch = _get_batch_or_404(sale_data.batch_id, db)
    _ensure_batch_open(batch)
    if sale_data.heads_sold > batch.current_head_count:
        raise HTTPException(status_code=400, detail=f"Cannot sell {sale_data.heads_sold} heads. Only {batch.current_head_count} remaining.")

    items = None
    if sale_data.items:
        items = []
        total_heads = 0
        total_weight = 0.0
        total_revenue = 0.0
        for it in sale_data.items:
            amount = round((it.live_weight_kg or 0) * (it.price_per_kilo or 0), 2)
            items.append(dict(
                cage_id=it.cage_id,
                tag_id=it.tag_id or "",
                head_count=it.head_count,
                mode="per_kilo",
                live_weight_kg=it.live_weight_kg or 0,
                price_per_kilo=it.price_per_kilo or 0,
                price_per_head=0.0,
                amount=amount,
            ))
            total_heads += it.head_count
            total_weight += it.live_weight_kg or 0
            total_revenue += amount
        heads_sold = total_heads
        weight_kg = round(total_weight, 2)
        total_revenue = round(total_revenue, 2)
    else:
        heads_sold = sale_data.heads_sold
        weight_kg = sale_data.weight_kg or 0
        total_revenue = sale_data.total_revenue or 0

    sale = Sale(
        batch_id=sale_data.batch_id,
        heads_sold=heads_sold,
        weight_kg=weight_kg,
        price_per_kilo=sale_data.price_per_kilo or 0,
        total_revenue=total_revenue,
        buyer_name=sale_data.buyer_name or "",
        buyer_contact=sale_data.buyer_contact or "",
        sale_date=sale_data.sale_date,
        notes=sale_data.notes or "",
    )
    db.add(sale)
    db.flush()

    if items:
        for it in items:
            db.add(SaleItem(sale_id=sale.id, **it))
            _deduct_heads(batch, it["head_count"], cage_id=it["cage_id"])
    else:
        _deduct_heads(batch, sale_data.heads_sold)

    db.commit()
    db.refresh(sale)
    return sale


@app.put("/api/sales/{sale_id}", response_model=SaleResponse)
def update_sale(sale_id: int, sale_data: SaleUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    batch = _get_batch_or_404(sale.batch_id, db)
    _ensure_batch_open(batch)
    update_data = sale_data.model_dump(exclude_unset=True)
    if "items" in update_data and update_data["items"] is not None:
        # Return the previously-sold heads to inventory before applying the new line items.
        old_items = db.query(SaleItem).filter(SaleItem.sale_id == sale.id).all()
        if old_items:
            for it in old_items:
                _restore_heads(batch, it.head_count, cage_id=it.cage_id)
        else:
            _restore_heads(batch, sale.heads_sold)

        built = []
        total_heads = 0
        total_weight = 0.0
        total_revenue = 0.0
        for it in update_data["items"]:
            amount = round((it.get("live_weight_kg") or 0) * (it.get("price_per_kilo") or 0), 2)
            built.append(dict(
                cage_id=it.get("cage_id"),
                tag_id=it.get("tag_id") or "",
                head_count=it["head_count"],
                mode="per_kilo",
                live_weight_kg=it.get("live_weight_kg") or 0,
                price_per_kilo=it.get("price_per_kilo") or 0,
                price_per_head=0.0,
                amount=amount,
            ))
            total_heads += it["head_count"]
            total_weight += it.get("live_weight_kg") or 0
            total_revenue += amount

        if total_heads > batch.current_head_count:
            raise HTTPException(status_code=400, detail=f"Cannot sell {total_heads} heads. Only {batch.current_head_count} remaining.")

        sale.items = []
        db.flush()
        for it in built:
            db.add(SaleItem(sale_id=sale.id, **it))
            _deduct_heads(batch, it["head_count"], cage_id=it["cage_id"])
        sale.heads_sold = total_heads
        sale.weight_kg = round(total_weight, 2)
        sale.total_revenue = round(total_revenue, 2)
        for k in ("heads_sold", "weight_kg", "total_revenue", "items"):
            update_data.pop(k, None)
    for key, value in update_data.items():
        setattr(sale, key, value)
    db.commit()
    db.refresh(sale)
    return sale


@app.delete("/api/sales/{sale_id}")
def delete_sale(sale_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    batch = _get_batch_or_404(sale.batch_id, db)
    _ensure_batch_open(batch)
    if sale.items:
        for it in sale.items:
            _restore_heads(batch, it.head_count, cage_id=it.cage_id)
    else:
        _restore_heads(batch, sale.heads_sold)
    db.delete(sale)
    db.commit()
    return {"message": "Sale deleted"}


# ─── FEED LOG ENDPOINTS ────────────────────────────────────────────

@app.get("/api/feed-logs", response_model=List[FeedLogResponse])
def list_feed_logs(
    batch_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(FeedLog)
    if batch_id:
        query = query.filter(FeedLog.batch_id == batch_id)
    return query.order_by(FeedLog.date.desc()).all()


@app.post("/api/feed-logs", response_model=FeedLogResponse)
def create_feed_log(log_data: FeedLogCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    batch = _get_batch_or_404(log_data.batch_id, db)
    _ensure_batch_open(batch)
    log = FeedLog(**log_data.model_dump(), recorded_by_id=current_user.id)
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@app.put("/api/feed-logs/{log_id}", response_model=FeedLogResponse)
def update_feed_log(log_id: int, log_data: FeedLogUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    log = db.query(FeedLog).filter(FeedLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Feed log not found")
    batch = _get_batch_or_404(log.batch_id, db)
    _ensure_batch_open(batch)
    update_data = log_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(log, key, value)
    db.commit()
    db.refresh(log)
    return log


@app.delete("/api/feed-logs/{log_id}")
def delete_feed_log(log_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    log = db.query(FeedLog).filter(FeedLog.id == log_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Feed log not found")
    batch = _get_batch_or_404(log.batch_id, db)
    _ensure_batch_open(batch)
    db.delete(log)
    db.commit()
    return {"message": "Feed log deleted"}


# ─── MORTALITY ENDPOINTS ───────────────────────────────────────────

@app.get("/api/mortalities", response_model=List[MortalityResponse])
def list_mortalities(
    batch_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Mortality)
    if batch_id:
        query = query.filter(Mortality.batch_id == batch_id)
    return query.order_by(Mortality.date.desc()).all()


@app.post("/api/mortalities", response_model=MortalityResponse)
def create_mortality(m_data: MortalityCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    batch = _get_batch_or_404(m_data.batch_id, db)
    _ensure_batch_open(batch)
    if m_data.head_count > batch.current_head_count:
        raise HTTPException(status_code=400, detail=f"Cannot record {m_data.head_count} losses. Only {batch.current_head_count} heads remaining.")
    mortality = Mortality(**m_data.model_dump(), recorded_by_id=current_user.id)
    _deduct_heads(batch, m_data.head_count, cage_id=m_data.cage_id)
    db.add(mortality)
    db.commit()
    db.refresh(mortality)
    return mortality


@app.put("/api/mortalities/{m_id}", response_model=MortalityResponse)
def update_mortality(m_id: int, m_data: MortalityUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    mortality = db.query(Mortality).filter(Mortality.id == m_id).first()
    if not mortality:
        raise HTTPException(status_code=404, detail="Mortality not found")
    batch = _get_batch_or_404(mortality.batch_id, db)
    _ensure_batch_open(batch)
    old_count = mortality.head_count
    old_cage_id = mortality.cage_id
    update_data = m_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(mortality, key, value)
    new_count = mortality.head_count
    _restore_heads(batch, old_count, cage_id=old_cage_id)
    if new_count > batch.current_head_count:
        raise HTTPException(status_code=400, detail=f"Cannot record {new_count} losses. Only {batch.current_head_count} heads remaining.")
    _deduct_heads(batch, new_count, cage_id=mortality.cage_id)
    db.commit()
    db.refresh(mortality)
    return mortality


@app.delete("/api/mortalities/{m_id}")
def delete_mortality(m_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    mortality = db.query(Mortality).filter(Mortality.id == m_id).first()
    if not mortality:
        raise HTTPException(status_code=404, detail="Mortality not found")
    batch = _get_batch_or_404(mortality.batch_id, db)
    _ensure_batch_open(batch)
    _restore_heads(batch, mortality.head_count, cage_id=mortality.cage_id)
    db.delete(mortality)
    db.commit()
    return {"message": "Mortality deleted"}


# ─── DASHBOARD / INSIGHTS (ADMIN) ──────────────────────────────────

@app.get("/api/dashboard", response_model=DashboardOverview)
def get_dashboard(
    batch_ids: Optional[List[int]] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    query = db.query(Batch).options(selectinload(Batch.cages))
    if batch_ids:
        query = query.filter(Batch.id.in_(batch_ids))
    batches = query.order_by(Batch.created_at.desc()).all()

    summaries = []
    total_expenses = 0
    total_revenue = 0
    total_current_heads = 0
    total_feeds_kg = 0
    projected_revenue = 0

    for batch in batches:
        fin = _batch_financials(db, batch)
        summaries.append(BatchSummary(
            batch=BatchResponse.model_validate(batch),
            total_expenses=round(fin["total_expenses"], 2),
            feed_cost=round(fin["feed_cost"], 2),
            feed_quantity_kg=round(fin["feed_kg"], 2),
            other_expenses=round(fin["other_expenses"], 2),
            total_revenue=round(fin["total_revenue"], 2),
            net_profit=round(fin["net_profit"], 2),
            roi_percentage=round(fin["roi"], 2),
            profit_margin_pct=round(fin["margin"], 2),
            cost_per_head=round(fin["cost_per_head"], 2),
            profit_per_head=round(fin["profit_per_head"], 2),
            feed_cost_per_kg_sold=round(fin["feed_cost_per_kg_sold"], 2),
            avg_selling_price_kg=round(fin["avg_selling_price_kg"], 2),
            avg_live_weight_kg=round(fin["avg_live_weight_kg"], 2),
            total_weight_sold=round(fin["total_weight"], 2),
            piglet_cost=round(fin["piglet_cost"], 2),
            piglet_heads=fin["piglet_heads"],
            buy_price_per_head=round(fin["buy_price_per_head"], 2),
            sell_price_per_head=round(fin["sell_price_per_head"], 2),
            heads_sold=fin["heads_sold"],
            heads_remaining=fin["heads_remaining"],
            heads_lost=fin["heads_lost"],
            expense_breakdown={k: round(v, 2) for k, v in fin["breakdown"].items()},
            growth=fin["growth"],
        ))
        if batch.status == BatchStatus.ACTIVE.value:
            total_expenses += fin["total_expenses"]
            total_revenue += fin["total_revenue"]
            total_current_heads += batch.current_head_count
            total_feeds_kg += fin["feed_kg"]
            est_weight = fin["avg_live_weight_kg"] or 0
            est_price = fin["avg_selling_price_kg"] or 0
            projected_revenue += batch.current_head_count * est_weight * est_price

    active_batch_count = sum(1 for b in batches if b.status == BatchStatus.ACTIVE.value)
    if active_batch_count == 0:
        total_current_heads = 0
        total_feeds_kg = 0
        projected_revenue = 0
        total_expenses = 0
        total_revenue = 0

    return DashboardOverview(
        active_batches=active_batch_count,
        closed_batches=sum(1 for b in batches if b.status == BatchStatus.CLOSED.value),
        total_current_heads=total_current_heads,
        total_feeds_consumed_kg=round(total_feeds_kg, 2),
        projected_revenue=round(projected_revenue, 2),
        total_expenses=round(total_expenses, 2),
        total_revenue=round(total_revenue, 2),
        total_profit=round(total_revenue - total_expenses, 2),
        batches=summaries,
    )


@app.get("/api/reports/expense-breakdown")
def get_expense_breakdown(batch_id: Optional[int] = Query(None), db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    rows = {}
    if batch_id:
        fin = _batch_financials(db, _get_batch_or_404(batch_id, db))
        return {k: round(v, 2) for k, v in fin["breakdown"].items()}
    for batch in db.query(Batch).all():
        fin = _batch_financials(db, batch)
        for k, v in fin["breakdown"].items():
            rows[k] = rows.get(k, 0) + v
    return {k: round(v, 2) for k, v in rows.items()}


@app.get("/api/reports/monthly")
def get_monthly_report(batch_id: Optional[int] = Query(None), db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    expense_q = db.query(Expense)
    feed_q = db.query(FeedLog)
    sale_q = db.query(Sale)
    if batch_id:
        expense_q = expense_q.filter(Expense.batch_id == batch_id)
        feed_q = feed_q.filter(FeedLog.batch_id == batch_id)
        sale_q = sale_q.filter(Sale.batch_id == batch_id)

    monthly_expenses = {}
    for e in expense_q.all():
        k = e.date.strftime("%Y-%m")
        monthly_expenses[k] = monthly_expenses.get(k, 0) + e.amount
    for f in feed_q.all():
        k = f.date.strftime("%Y-%m")
        monthly_expenses[k] = monthly_expenses.get(k, 0) + f.cost

    monthly_revenue = {}
    for s in sale_q.all():
        k = s.sale_date.strftime("%Y-%m")
        monthly_revenue[k] = monthly_revenue.get(k, 0) + s.total_revenue

    all_months = sorted(set(list(monthly_expenses.keys()) + list(monthly_revenue.keys())))
    result = []
    for month in all_months:
        exp = round(monthly_expenses.get(month, 0), 2)
        rev = round(monthly_revenue.get(month, 0), 2)
        result.append({"month": month, "expenses": exp, "revenue": rev, "profit": round(rev - exp, 2)})
    return result


@app.get("/api/reports/cage-summary")
def get_cage_summary(
    batch_ids: Optional[List[int]] = Query(None),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    query = db.query(Batch).options(selectinload(Batch.cages))
    if batch_ids:
        query = query.filter(Batch.id.in_(batch_ids))
    batches = query.order_by(Batch.created_at.desc()).all()

    results = []
    for batch in batches:
        piglet_heads_per_cage = {}
        for e in db.query(Expense).filter(
            Expense.batch_id == batch.id,
            Expense.category == ExpenseCategory.PIGLETS.value,
        ).all():
            if e.cage_id:
                piglet_heads_per_cage[e.cage_id] = piglet_heads_per_cage.get(e.cage_id, 0) + (e.head_count or 0)

        sold_per_cage = {}
        revenue_per_cage = {}
        for it in db.query(SaleItem).join(Sale).filter(Sale.batch_id == batch.id).all():
            if it.cage_id:
                sold_per_cage[it.cage_id] = sold_per_cage.get(it.cage_id, 0) + it.head_count
                revenue_per_cage[it.cage_id] = revenue_per_cage.get(it.cage_id, 0) + (it.amount or 0)

        dead_per_cage = {}
        for m in db.query(Mortality).filter(Mortality.batch_id == batch.id).all():
            if m.cage_id:
                dead_per_cage[m.cage_id] = dead_per_cage.get(m.cage_id, 0) + m.head_count

        for cage in batch.cages:
            results.append({
                "batch_id": batch.id,
                "batch_name": batch.name,
                "cage_id": cage.id,
                "cage_name": cage.name,
                "current_heads": cage.head_count,
                "purchased_heads": piglet_heads_per_cage.get(cage.id, 0),
                "sold_heads": sold_per_cage.get(cage.id, 0),
                "dead_heads": dead_per_cage.get(cage.id, 0),
                "revenue": round(revenue_per_cage.get(cage.id, 0), 2),
            })

    total_current = sum(r["current_heads"] for r in results)
    total_purchased = sum(r["purchased_heads"] for r in results)
    total_sold = sum(r["sold_heads"] for r in results)
    total_dead = sum(r["dead_heads"] for r in results)
    total_revenue = round(sum(r["revenue"] for r in results), 2)
    return {
        "cages": results,
        "totals": {
            "current_heads": total_current,
            "purchased_heads": total_purchased,
            "sold_heads": total_sold,
            "dead_heads": total_dead,
            "revenue": total_revenue,
        },
    }