import json
import os
import secrets
import urllib.parse
import urllib.request
from datetime import date, datetime, timedelta

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session, selectinload
from typing import List, Optional

from database import engine, get_db, Base, DATABASE_URL
from models import (
    Batch, Cage, Expense, Sale, SaleItem, Mortality, User,
    InventoryItem, InventoryTransaction, VitaminLog, Reminder, ContactMessage,
    BatchStatus, ExpenseCategory, InventoryCategory, TransactionType,
)
from security import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_admin,
)
from schemas import (
    RegisterRequest, LoginRequest, GoogleLoginRequest, FacebookLoginRequest, ForgotPasswordRequest,
    ResetPasswordRequest, OnboardRequest, UpdateProfileRequest, ChangePasswordRequest, UserOut, TokenResponse,
    BatchCreate, BatchUpdate, BatchResponse,
    CageCreate, CageUpdate, CageResponse,
    ExpenseCreate, ExpenseUpdate, ExpenseResponse,
    SaleCreate, SaleUpdate, SaleResponse,
    MortalityCreate, MortalityUpdate, MortalityResponse,
    InventoryItemCreate, InventoryItemUpdate, InventoryItemResponse,
    RestockRequest, IssueRequest, InventoryTransactionResponse,
    VitaminLogCreate, VitaminLogUpdate, VitaminLogResponse,
    ReminderCreate, ReminderUpdate, ReminderResponse, ReminderItem,
    ContactCreate, ContactResponse,
    BatchSummary, DashboardOverview, Statement, GrowthPoint,
)
from emailer import send_email, contact_recipient


Base.metadata.create_all(bind=engine)

# Lightweight schema migration for existing deployments: adds columns added
# after a database was already created (create_all only makes new tables).
_existing_cols = {c["name"] for c in inspect(engine).get_columns("users")}
_migrations = [
    ("google_sub", "VARCHAR(100)", True),
    ("facebook_sub", "VARCHAR(100)", True),
    ("farm_location", "VARCHAR(120)", False),
]
with engine.begin() as conn:
    for _col, _col_type, _unique in _migrations:
        if _col not in _existing_cols:
            conn.execute(text(f"ALTER TABLE users ADD COLUMN {_col} {_col_type}"))
            if _col_type != "VARCHAR(100)":
                conn.execute(text(f"UPDATE users SET {_col} = '' WHERE {_col} IS NULL"))
            if _unique:
                try:
                    conn.execute(text(f"CREATE UNIQUE INDEX uq_users_{_col} ON users ({_col})"))
                except Exception:
                    pass

app = FastAPI(title="HogPros API — Farm Management & Batch Profitability", version="3.0.0")

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

FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:5173")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "")
FACEBOOK_APP_ID = os.environ.get("FACEBOOK_APP_ID", "")
FACEBOOK_APP_SECRET = os.environ.get("FACEBOOK_APP_SECRET", "")


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


def _item_or_404(item_id, db):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")
    return item


# ─── FINANCIALS / STATEMENT (no legacy feed-consumption) ────────────

def _batch_financials(db, batch):
    expenses = db.query(Expense).filter(Expense.batch_id == batch.id).all()
    sales = db.query(Sale).filter(Sale.batch_id == batch.id).options(selectinload(Sale.items)).all()
    mortalities = db.query(Mortality).filter(Mortality.batch_id == batch.id).all()

    feed_cost = sum(e.amount for e in expenses if e.category == ExpenseCategory.FEED.value)
    piglet_expenses = [e for e in expenses if e.category == ExpenseCategory.PIGLETS.value]
    piglet_cost = sum(e.amount for e in piglet_expenses)
    piglet_heads = sum(e.head_count or 0 for e in piglet_expenses)
    other_expenses = sum(e.amount for e in expenses if e.category != ExpenseCategory.FEED.value)
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

    breakdown = {}
    for e in expenses:
        breakdown[e.category] = breakdown.get(e.category, 0) + e.amount

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
        "breakdown": breakdown,
        "growth": growth,
        "expenses": expenses,
        "sales": sales,
        "mortalities": mortalities,
    }


# ─── AUTH ───────────────────────────────────────────────────────────

def _token_response(user: User):
    token = create_access_token(user.id, user.role)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@app.post("/api/auth/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email.lower().strip()).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with this email address. Please sign up first.")
    if not user.password_hash or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect password. Please try again.")
    return _token_response(user)


@app.post("/api/auth/register", response_model=UserOut)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=400, detail="An account with this email already exists. Please sign in instead.")
    user = User(
        email=email,
        full_name=data.full_name,
        password_hash=hash_password(data.password),
        role="admin",
        is_onboarded=bool(data.full_name),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/api/auth/google", response_model=TokenResponse)
def google_login(data: GoogleLoginRequest, db: Session = Depends(get_db)):
    """Verify a Google OAuth 2.0 id_token / access_token against Google's
    tokeninfo endpoint, then create-or-login the user by google_sub."""
    try:
        key = "id_token" if data.mode == "id_token" else "access_token"
        url = f"https://oauth2.googleapis.com/tokeninfo?{key}={urllib.parse.quote(data.credential)}"
        with urllib.request.urlopen(url, timeout=10) as resp:
            info = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Unable to verify Google credential.")

    if str(info.get("email_verified", "false")).lower() != "true":
        raise HTTPException(status_code=401, detail="Your Google email is not verified.")
    if GOOGLE_CLIENT_ID and data.mode == "id_token" and info.get("aud") != GOOGLE_CLIENT_ID:
        raise HTTPException(status_code=401, detail="Google credential was issued for a different application.")

    sub = info.get("sub")
    email = (info.get("email") or "").strip().lower()
    if not sub or not email:
        raise HTTPException(status_code=401, detail="Google credential is missing required profile fields.")

    user = db.query(User).filter(User.google_sub == sub).first() or db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            full_name=(info.get("name") or ""),
            role="admin",
            google_sub=sub,
            password_hash=None,
            is_onboarded=False,
        )
        db.add(user)
    else:
        user.google_sub = sub
        if not user.full_name:
            user.full_name = (info.get("name") or "")
    db.commit()
    db.refresh(user)
    return _token_response(user)


@app.post("/api/auth/facebook", response_model=TokenResponse)
def facebook_login(data: FacebookLoginRequest, db: Session = Depends(get_db)):
    """Verify a Facebook JS SDK access token via the Graph API debug_token
    endpoint, then create-or-login the user by facebook_sub."""
    if not FACEBOOK_APP_ID or not FACEBOOK_APP_SECRET:
        raise HTTPException(status_code=503, detail="Facebook login is not configured on this server.")

    app_access_token = urllib.parse.quote(f"{FACEBOOK_APP_ID}|{FACEBOOK_APP_SECRET}")
    debug_url = (
        "https://graph.facebook.com/v18.0/debug_token"
        f"?input_token={urllib.parse.quote(data.access_token)}"
        f"&access_token={app_access_token}"
    )
    try:
        with urllib.request.urlopen(debug_url, timeout=10) as resp:
            info = json.loads(resp.read().decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=401, detail="Unable to verify Facebook credential.")

    db_data = info.get("data") or {}
    sub = str(db_data.get("user_id", ""))
    if not db_data.get("is_valid") or not sub:
        raise HTTPException(status_code=401, detail="Facebook session is invalid or has expired.")
    if data.user_id and data.user_id != sub:
        raise HTTPException(status_code=401, detail="Facebook session does not match the account.")

    profile_url = (
        "https://graph.facebook.com/v18.0/"
        f"{urllib.parse.quote(sub)}?fields=id,name,email"
        f"&access_token={urllib.parse.quote(data.access_token)}"
    )
    try:
        with urllib.request.urlopen(profile_url, timeout=10) as resp:
            profile = json.loads(resp.read().decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=401, detail="Could not fetch your Facebook profile.")

    name = (profile.get("name") or "").strip()
    email = (profile.get("email") or "").strip().lower()
    if not email:
        # Facebook no longer guarantees email on every account — bind by sub
        # using a synthetic login email so the account still has a unique key.
        email = f"fb_{sub}@login.facebook.users"

    user = db.query(User).filter(User.facebook_sub == sub).first()
    if not user:
        user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(
            email=email,
            full_name=name,
            role="admin",
            facebook_sub=sub,
            password_hash=None,
            is_onboarded=False,
        )
        db.add(user)
    else:
        user.facebook_sub = sub
        if not user.full_name:
            user.full_name = name
    db.commit()
    db.refresh(user)
    return _token_response(user)


@app.post("/api/auth/forgot-password")
def forgot_password(data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    email = data.email.strip().lower()
    user = db.query(User).filter(User.email == email).first()
    # Always return the same message (prevents account enumeration).
    if not user:
        return {"message": "If an account exists for that email, a password reset link has been sent."}

    user.reset_token = secrets.token_urlsafe(32)
    user.reset_token_expires = datetime.utcnow() + timedelta(minutes=30)
    db.commit()

    link = f"{FRONTEND_URL}/reset-password?token={user.reset_token}"
    body = (
        f"Hello {user.full_name or 'there'},\n\n"
        "You requested a password reset for your HogPros account.\n\n"
        f"Click the link below to choose a new password (valid for 30 minutes):\n{link}\n\n"
        "If you did not request this, you can safely ignore this email.\n\n"
        "— HogPros Farm Management"
    )
    try:
        send_email(user.email, "HogPros — Password Reset", body)
    except Exception:
        raise HTTPException(status_code=500, detail="Could not send the reset email. Please check that SMTP is configured.")

    return {"message": "If an account exists for that email, a password reset link has been sent."}


@app.post("/api/auth/reset-password")
def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.reset_token == data.token).first()
    if not user or not user.reset_token_expires or user.reset_token_expires < datetime.utcnow():
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired.")
    user.password_hash = hash_password(data.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    return {"message": "Your password has been updated. Please sign in."}


@app.post("/api/auth/onboard", response_model=UserOut)
def onboard(data: OnboardRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    current_user.full_name = data.full_name.strip()
    current_user.farm_name = data.farm_name.strip()
    if data.farm_location is not None:
        current_user.farm_location = data.farm_location.strip()
    current_user.is_onboarded = True
    db.commit()
    db.refresh(current_user)
    return current_user


@app.get("/api/auth/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@app.put("/api/auth/me", response_model=UserOut)
def update_profile(data: UpdateProfileRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Update the authenticated user's profile.
    Email is strictly read-only: it is never accepted by this endpoint."""
    payload = data.model_dump(exclude_unset=True)
    if "email" in payload:
        raise HTTPException(status_code=400, detail="Email cannot be changed.")
    for field, value in payload.items():
        if value is not None:
            setattr(current_user, field, value)
    db.commit()
    db.refresh(current_user)
    return current_user


@app.post("/api/auth/change-password")
def change_password(data: ChangePasswordRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Change the password after verifying the current one."""
    if not current_user.password_hash:
        raise HTTPException(
            status_code=400,
            detail="Your account uses Google/Facebook login and has no password to change.",
        )
    if not verify_password(data.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect. Please try again.")
    current_user.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "Your password has been updated. Please use it on your next sign in."}


@app.get("/api/users", response_model=List[UserOut])
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    return db.query(User).order_by(User.created_at.desc()).all()


# ─── BATCH ENDPOINTS (PRODUCTION) ───────────────────────────────────

@app.get("/api/batches", response_model=List[BatchResponse])
def list_batches(status: Optional[str] = Query(None), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Batch).options(selectinload(Batch.cages))
    if status:
        query = query.filter(Batch.status == status)
    return query.order_by(Batch.created_at.desc()).all()


@app.get("/api/batches/{batch_id}", response_model=BatchResponse)
def get_batch(batch_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
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
    if total_heads <= 0:
        raise HTTPException(status_code=400, detail="initial_head_count must be greater than zero")

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
    batch = _get_batch_or_404(batch_id, db)
    fin = _batch_financials(db, batch)
    sales_ordered = sorted(fin["sales"], key=lambda s: s.sale_date)
    period_end = batch.closed_at.date() if (batch.status == BatchStatus.CLOSED.value and batch.closed_at) else date.today()
    return Statement(
        batch=batch,
        period_end=period_end,
        total_revenue=fin["total_revenue"],
        total_expenses=fin["total_expenses"],
        net_income=fin["net_profit"],
        profit_margin_pct=round(fin["margin"], 2),
        other_expenses=fin["other_expenses"],
        expense_breakdown=fin["breakdown"],
        total_weight_kg=fin["total_weight"],
        heads_sold=fin["heads_sold"],
        heads_remaining=fin["heads_remaining"],
        heads_lost=fin["heads_lost"],
        feed_cost=fin["feed_cost"],
        avg_selling_price_kg=round(fin["avg_selling_price_kg"], 2),
        piglet_cost=fin["piglet_cost"],
        piglet_heads=fin["piglet_heads"],
        buy_price_per_head=round(fin["buy_price_per_head"], 2),
        sell_price_per_head=round(fin["sell_price_per_head"], 2),
        cost_per_head=round(fin["cost_per_head"], 2),
        profit_per_head=round(fin["profit_per_head"], 2),
        sales=sales_ordered,
    )


# ─── CAGE ENDPOINTS ─────────────────────────────────────────────────

@app.post("/api/cages", response_model=CageResponse)
def create_cage(batch_id: int, data: CageCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    batch = _get_batch_or_404(batch_id, db)
    _ensure_batch_open(batch)
    cage = Cage(batch_id=batch_id, name=data.name, head_count=data.head_count)
    db.add(cage)
    db.flush()
    _sync_head_counts(batch)
    db.commit()
    db.refresh(cage)
    return cage


@app.put("/api/cages/{cage_id}", response_model=CageResponse)
def update_cage(cage_id: int, data: CageUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    cage = db.query(Cage).filter(Cage.id == cage_id).first()
    if not cage:
        raise HTTPException(status_code=404, detail="Cage not found")
    batch = _get_batch_or_404(cage.batch_id, db)
    _ensure_batch_open(batch)
    if data.name is not None:
        cage.name = data.name
    if data.head_count is not None:
        cage.head_count = data.head_count
    db.flush()
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


# ─── EXPENSE LEDGER ─────────────────────────────────────────────────

def _apply_expense_fields(expense: Expense, data: ExpenseCreate, db: Session):
    amount = data.amount or ((data.quantity or 1.0) * (data.unit_price or 0.0))
    expense.category = data.category.value if isinstance(data.category, ExpenseCategory) else data.category
    expense.description = data.description
    expense.quantity = data.quantity if data.quantity is not None else 1.0
    expense.unit_price = data.unit_price or 0.0
    expense.amount = round(amount, 2)
    expense.date = data.date
    expense.batch_id = data.batch_id
    expense.cage_id = data.cage_id
    expense.head_count = data.head_count
    expense.inventory_item_id = data.inventory_item_id
    if data.inventory_item_id:
        expense.source = "inventory"


@app.post("/api/expenses", response_model=ExpenseResponse)
def create_expense(data: ExpenseCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if data.batch_id:
        _get_batch_or_404(data.batch_id, db)
    if data.inventory_item_id:
        item = _item_or_404(data.inventory_item_id, db)
        expense = Expense(recorded_by_id=current_user.id, source="inventory")
        _apply_expense_fields(expense, data, db)
        expense.category = _inventory_ledger_category(item)
        db.add(expense)
        db.commit()
        db.refresh(expense)
        return expense

    expense = Expense(recorded_by_id=current_user.id)
    _apply_expense_fields(expense, data, db)
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@app.get("/api/expenses", response_model=List[ExpenseResponse])
def list_expenses(
    batch_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Expense)
    if batch_id:
        query = query.filter(Expense.batch_id == batch_id)
    if category:
        query = query.filter(Expense.category == category)
    if from_date:
        query = query.filter(Expense.date >= from_date)
    if to_date:
        query = query.filter(Expense.date <= to_date)
    return query.order_by(Expense.date.desc(), Expense.id.desc()).all()


@app.put("/api/expenses/{expense_id}", response_model=ExpenseResponse)
def update_expense(expense_id: int, data: ExpenseUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    payload = data.model_dump(exclude_unset=True)
    recompute_amount = "amount" not in payload and any(f in payload for f in ("quantity", "unit_price"))
    for field, value in payload.items():
        if field == "category" and value is not None:
            value = value.value if isinstance(value, ExpenseCategory) else value
        if value is not None:
            setattr(expense, field, value)
    if recompute_amount:
        expense.amount = round((expense.quantity if expense.quantity is not None else 1.0) * (expense.unit_price or 0.0), 2)
    db.commit()
    db.refresh(expense)
    return expense


@app.delete("/api/expenses/{expense_id}")
def delete_expense(expense_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    db.delete(expense)
    db.commit()
    return {"message": "Expense deleted"}


# ─── SALES ──────────────────────────────────────────────────────────

@app.post("/api/sales", response_model=SaleResponse)
def create_sale(data: SaleCreate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    batch = _get_batch_or_404(data.batch_id, db)
    _ensure_batch_open(batch)

    default_items_price = (
        data.items and sum((it.amount or 0.0) for it in data.items) > 0
    )
    if data.items and not default_items_price:
        for it in data.items:
            if it.mode == "per_head":
                it.amount = it.head_count * it.price_per_head
            else:
                it.amount = (it.live_weight_kg or 0.0) * it.price_per_kilo
        total_revenue = round(sum(it.amount for it in data.items), 2)
        heads_sold = sum(it.head_count for it in data.items)
        weight_kg = round(sum(it.live_weight_kg for it in data.items), 2)
    else:
        total_revenue = data.total_revenue or 0.0
        heads_sold = data.heads_sold
        weight_kg = data.weight_kg or 0.0
        if data.items:
            for it in data.items:
                it.amount = it.amount or 0.0
            total_revenue = round(sum(it.amount for it in data.items), 2) if total_revenue == 0.0 else total_revenue

    _deduct_heads(batch, heads_sold, cage_id=data.items[0].cage_id if data.items else None)

    sale = Sale(
        batch_id=batch.id,
        heads_sold=heads_sold,
        weight_kg=weight_kg,
        price_per_kilo=data.price_per_kilo or 0.0,
        total_revenue=total_revenue or round(weight_kg * (data.price_per_kilo or 0.0), 2),
        buyer_name=data.buyer_name or "",
        buyer_contact=data.buyer_contact or "",
        sale_date=data.sale_date,
        notes=data.notes or "",
    )
    db.add(sale)
    db.flush()
    if data.items:
        for it in data.items:
            db.add(SaleItem(
                sale_id=sale.id,
                cage_id=it.cage_id,
                tag_id=it.tag_id or "",
                head_count=it.head_count,
                mode=it.mode,
                live_weight_kg=it.live_weight_kg or 0.0,
                price_per_kilo=it.price_per_kilo or 0.0,
                price_per_head=it.price_per_head or 0.0,
                amount=it.amount,
            ))
    db.commit()
    db.refresh(sale)
    return sale


@app.get("/api/sales", response_model=List[SaleResponse])
def list_sales(batch_id: Optional[int] = Query(None), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Sale).options(selectinload(Sale.items))
    if batch_id:
        query = query.filter(Sale.batch_id == batch_id)
    return query.order_by(Sale.sale_date.desc(), Sale.id.desc()).all()


@app.put("/api/sales/{sale_id}", response_model=SaleResponse)
def update_sale(sale_id: int, data: SaleUpdate, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    sale = db.query(Sale).options(selectinload(Sale.items)).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    batch = _get_batch_or_404(sale.batch_id, db)
    _ensure_batch_open(batch)

    old_heads = sale.heads_sold
    payload = data.model_dump(exclude_unset=True)
    for field, value in payload.items():
        if field != "items" and value is not None:
            setattr(sale, field, value)
    diff = sale.heads_sold - old_heads
    if diff > 0:
        _deduct_heads(batch, diff)
    elif diff < 0:
        _restore_heads(batch, -diff)
    db.commit()
    db.refresh(batch)
    db.refresh(sale)
    return sale


@app.delete("/api/sales/{sale_id}")
def delete_sale(sale_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    sale = db.query(Sale).filter(Sale.id == sale_id).first()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    batch = _get_batch_or_404(sale.batch_id, db)
    _ensure_batch_open(batch)
    _restore_heads(batch, sale.heads_sold)
    db.delete(sale)
    db.commit()
    return {"message": "Sale deleted"}


# ─── MORTALITY ──────────────────────────────────────────────────────

@app.post("/api/mortalities", response_model=MortalityResponse)
def create_mortality(data: MortalityCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    batch = _get_batch_or_404(data.batch_id, db)
    _ensure_batch_open(batch)
    _deduct_heads(batch, data.head_count, cage_id=data.cage_id)
    mortality = Mortality(
        batch_id=batch.id,
        cage_id=data.cage_id,
        date=data.date,
        head_count=data.head_count,
        cause=data.cause or "",
        notes=data.notes or "",
        recorded_by_id=current_user.id,
    )
    db.add(mortality)
    db.commit()
    db.refresh(mortality)
    return mortality


@app.get("/api/mortalities", response_model=List[MortalityResponse])
def list_mortalities(batch_id: Optional[int] = Query(None), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Mortality)
    if batch_id:
        query = query.filter(Mortality.batch_id == batch_id)
    return query.order_by(Mortality.date.desc(), Mortality.id.desc()).all()


@app.put("/api/mortalities/{m_id}", response_model=MortalityResponse)
def update_mortality(m_id: int, data: MortalityUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    mortality = db.query(Mortality).filter(Mortality.id == m_id).first()
    if not mortality:
        raise HTTPException(status_code=404, detail="Mortality record not found")
    batch = _get_batch_or_404(mortality.batch_id, db)
    _ensure_batch_open(batch)
    old = mortality.head_count
    payload = data.model_dump(exclude_unset=True)
    for field, value in payload.items():
        if value is not None:
            setattr(mortality, field, value)
    diff = mortality.head_count - old
    if diff > 0:
        _deduct_heads(batch, diff)
    elif diff < 0:
        _restore_heads(batch, -diff)
    db.commit()
    db.refresh(mortality)
    return mortality


@app.delete("/api/mortalities/{m_id}")
def delete_mortality(m_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    mortality = db.query(Mortality).filter(Mortality.id == m_id).first()
    if not mortality:
        raise HTTPException(status_code=404, detail="Mortality record not found")
    batch = _get_batch_or_404(mortality.batch_id, db)
    _ensure_batch_open(batch)
    _restore_heads(batch, mortality.head_count)
    db.delete(mortality)
    db.commit()
    return {"message": "Mortality record deleted"}


# ─── INVENTORY ──────────────────────────────────────────────────────

def _serialize_inventory_item(item):
    item.is_low_stock = bool(item.threshold_qty and item.stock_qty <= item.threshold_qty) \
        if item.threshold_qty else bool(item.stock_qty <= 0)
    return item


def _inventory_ledger_category(item):
    """Map an inventory item's category to the expense ledger category."""
    mapping = {
        "feed": "feed",
        "medicine": "medicine",
        "vitamin": "medicine",
        "supplies": "inventory",
    }
    return mapping.get(item.category, "inventory")


def _link_inventory_expense(db, item, qty, unit_cost, batch_id, notes, action="restock"):
    unit_cost = unit_cost or item.unit_cost or 0.0
    expense = Expense(
        batch_id=batch_id,
        category=_inventory_ledger_category(item),
        description=f"{item.name} ({action} {qty:g} {item.unit})",
        quantity=qty,
        unit_price=unit_cost,
        amount=round(qty * unit_cost, 2),
        date=date.today(),
        source="inventory",
        inventory_item_id=item.id,
    )
    db.add(expense)
    db.flush()
    return expense


@app.post("/api/inventory", response_model=InventoryItemResponse)
def create_inventory_item(data: InventoryItemCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = InventoryItem(
        name=data.name.strip(),
        category=data.category.value if isinstance(data.category, InventoryCategory) else data.category,
        unit=data.unit,
        stock_qty=data.stock_qty or 0.0,
        threshold_qty=data.threshold_qty or 0.0,
        unit_cost=data.unit_cost or 0.0,
        supplier=data.supplier or "",
        notes=data.notes or "",
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return _serialize_inventory_item(item)


@app.get("/api/inventory", response_model=List[InventoryItemResponse])
def list_inventory(
    category: Optional[str] = Query(None),
    low: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(InventoryItem)
    if category:
        query = query.filter(InventoryItem.category == category)
    items = query.order_by(InventoryItem.name.asc()).all()
    if low:
        items = [i for i in items if (i.threshold_qty and i.stock_qty <= i.threshold_qty) or (not i.threshold_qty and i.stock_qty <= 0)]
    return [_serialize_inventory_item(i) for i in items]


@app.get("/api/inventory/alerts", response_model=List[InventoryItemResponse])
def low_stock_alerts(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    items = db.query(InventoryItem).all()
    low = [
        i for i in items
        if (i.threshold_qty and i.stock_qty <= i.threshold_qty) or (not i.threshold_qty and i.stock_qty <= 0)
    ]
    return [_serialize_inventory_item(i) for i in low]


@app.get("/api/inventory/{item_id}", response_model=InventoryItemResponse)
def get_inventory_item(item_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return _serialize_inventory_item(_item_or_404(item_id, db))


@app.put("/api/inventory/{item_id}", response_model=InventoryItemResponse)
def update_inventory_item(item_id: int, data: InventoryItemUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = _item_or_404(item_id, db)
    payload = data.model_dump(exclude_unset=True)
    for field, value in payload.items():
        if value is not None:
            if field == "category" and isinstance(value, InventoryCategory):
                value = value.value
            setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return _serialize_inventory_item(item)


@app.delete("/api/inventory/{item_id}")
def delete_inventory_item(item_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    item = _item_or_404(item_id, db)
    db.delete(item)
    db.commit()
    return {"message": "Inventory item deleted"}


@app.post("/api/inventory/{item_id}/restock", response_model=InventoryTransactionResponse)
def restock_item(item_id: int, data: RestockRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = _item_or_404(item_id, db)
    unit_cost = data.unit_cost or item.unit_cost or 0.0

    expense = None
    if data.create_expense:
        expense = _link_inventory_expense(db, item, data.qty, unit_cost, data.batch_id, data.notes)

    item.stock_qty += data.qty
    item.unit_cost = unit_cost
    item.last_restocked_at = datetime.utcnow()

    txn = InventoryTransaction(
        item_id=item.id,
        type=TransactionType.RESTOCK.value,
        qty=data.qty,
        unit_cost=unit_cost,
        batch_id=data.batch_id,
        notes=data.notes or "",
        creates_expense=data.create_expense,
        expense_id=expense.id if expense else None,
        recorded_by_id=current_user.id,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


@app.post("/api/inventory/{item_id}/issue", response_model=InventoryTransactionResponse)
def issue_item(item_id: int, data: IssueRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    item = _item_or_404(item_id, db)
    if data.qty > item.stock_qty:
        raise HTTPException(status_code=400, detail=f"Cannot issue {data.qty:g} {item.unit} — only {item.stock_qty:g} in stock.")

    expense = None
    if data.create_expense:
        expense = _link_inventory_expense(db, item, data.qty, item.unit_cost, data.batch_id, data.notes, action="issue")

    item.stock_qty -= data.qty
    txn = InventoryTransaction(
        item_id=item.id,
        type=TransactionType.ISSUE.value,
        qty=data.qty,
        unit_cost=item.unit_cost,
        batch_id=data.batch_id,
        notes=data.notes or "",
        creates_expense=bool(data.create_expense),
        expense_id=expense.id if expense else None,
        recorded_by_id=current_user.id,
    )
    db.add(txn)
    db.commit()
    db.refresh(txn)
    return txn


@app.get("/api/inventory/transactions", response_model=List[InventoryTransactionResponse])
def list_inventory_transactions(
    item_id: Optional[int] = Query(None),
    limit: Optional[int] = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(InventoryTransaction)
    if item_id:
        query = query.filter(InventoryTransaction.item_id == item_id)
    return query.order_by(InventoryTransaction.id.desc()).limit(limit).all()


# ─── VITAMINS / HEALTH SCHEDULE ─────────────────────────────────────

@app.get("/api/vitamins", response_model=List[VitaminLogResponse])
def list_vitamins(
    batch_id: Optional[int] = Query(None),
    from_date: Optional[date] = Query(None),
    to_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(VitaminLog)
    if batch_id:
        query = query.filter(VitaminLog.batch_id == batch_id)
    if from_date:
        query = query.filter(VitaminLog.date_administered >= from_date)
    if to_date:
        query = query.filter(VitaminLog.date_administered <= to_date)
    return query.order_by(VitaminLog.date_administered.desc(), VitaminLog.id.desc()).all()


@app.post("/api/vitamins", response_model=VitaminLogResponse)
def create_vitamin(data: VitaminLogCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if data.create_reminder and not data.next_due_date:
        raise HTTPException(status_code=400, detail="Provide a 'next dose due' date to create a schedule reminder.")
    if data.batch_id:
        _get_batch_or_404(data.batch_id, db)
    log = VitaminLog(
        batch_id=data.batch_id,
        cage_id=data.cage_id,
        vitamin_name=data.vitamin_name.strip(),
        dosage=data.dosage or 0.0,
        unit=data.unit,
        date_administered=data.date_administered,
        next_due_date=data.next_due_date,
        notes=data.notes or "",
        recorded_by_id=current_user.id,
    )
    db.add(log)
    db.flush()

    if data.create_reminder and data.next_due_date:
        db.add(Reminder(
            title=f"{data.vitamin_name.strip()} — next dose",
            description=log.notes or "Vitamin injection schedule",
            reminder_type="vitamin",
            batch_id=data.batch_id,
            due_date=data.next_due_date,
            recurring=True,
            created_by_id=current_user.id,
        ))
    db.commit()
    db.refresh(log)
    return log


@app.put("/api/vitamins/{vitamin_id}", response_model=VitaminLogResponse)
def update_vitamin(vitamin_id: int, data: VitaminLogUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    log = db.query(VitaminLog).filter(VitaminLog.id == vitamin_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Vitamin record not found")
    payload = data.model_dump(exclude_unset=True)
    for field, value in payload.items():
        if value is not None:
            setattr(log, field, value)
    db.commit()
    db.refresh(log)
    return log


@app.delete("/api/vitamins/{vitamin_id}")
def delete_vitamin(vitamin_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    log = db.query(VitaminLog).filter(VitaminLog.id == vitamin_id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Vitamin record not found")
    db.delete(log)
    db.commit()
    return {"message": "Vitamin record deleted"}


# ─── REMINDERS / SCHEDULE ───────────────────────────────────────────

@app.get("/api/reminders", response_model=List[ReminderResponse])
def list_reminders(
    status: Optional[str] = Query(None),
    due_before: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Reminder)
    if status:
        query = query.filter(Reminder.status == status)
    if due_before:
        query = query.filter(Reminder.due_date <= due_before)
    return query.order_by(Reminder.due_date.asc(), Reminder.id.desc()).all()


@app.post("/api/reminders", response_model=ReminderResponse)
def create_reminder(data: ReminderCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if data.batch_id:
        _get_batch_or_404(data.batch_id, db)
    reminder = Reminder(
        title=data.title.strip(),
        description=data.description or "",
        reminder_type=data.reminder_type,
        batch_id=data.batch_id,
        due_date=data.due_date,
        recurring=data.recurring or False,
        created_by_id=current_user.id,
    )
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder


@app.put("/api/reminders/{reminder_id}", response_model=ReminderResponse)
def update_reminder(reminder_id: int, data: ReminderUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    payload = data.model_dump(exclude_unset=True)
    for field, value in payload.items():
        if value is not None:
            setattr(reminder, field, value)
    db.commit()
    db.refresh(reminder)
    return reminder


@app.post("/api/reminders/{reminder_id}/done", response_model=ReminderResponse)
def complete_reminder(reminder_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    reminder.status = "done"
    db.commit()
    db.refresh(reminder)
    return reminder


@app.delete("/api/reminders/{reminder_id}")
def delete_reminder(reminder_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    reminder = db.query(Reminder).filter(Reminder.id == reminder_id).first()
    if not reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    db.delete(reminder)
    db.commit()
    return {"message": "Reminder deleted"}


# ─── CONTACT / SUPPORT ──────────────────────────────────────────────

@app.post("/api/contact", response_model=ContactResponse)
def send_contact(
    data: ContactCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    recipient = contact_recipient()  # never returned to the client
    user_label = ""
    if current_user:
        user_label = f"\n\n— From HogPros account: {current_user.email} ({current_user.full_name or 'unknown'})"
    body = f"Subject: {data.subject}\n\n{data.message}{user_label}"

    status, error = "sent", None
    try:
        send_email(recipient, f"[HogPros Support] {data.subject}", body)
    except Exception as exc:
        status, error = "failed", str(exc)

    message = ContactMessage(
        subject=data.subject,
        message=data.message,
        user_id=current_user.id if current_user else None,
        status=status,
        error=error,
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    if status == "failed":
        raise HTTPException(status_code=502, detail="Your message could not be sent right now. Please try again later.")
    return message


# ─── DASHBOARD ──────────────────────────────────────────────────────

@app.get("/api/dashboard", response_model=DashboardOverview)
def get_dashboard(
    batch_ids: Optional[List[int]] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    batches = db.query(Batch).options(selectinload(Batch.cages)).all()
    if batch_ids:
        batches = [b for b in batches if b.id in batch_ids]

    active = [b for b in batches if b.status == BatchStatus.ACTIVE.value]
    closed = [b for b in batches if b.status == BatchStatus.CLOSED.value]

    total_expenses, total_revenue = 0.0, 0.0
    summaries = []
    for batch in batches:
        fin = _batch_financials(db, batch)
        if batch.status == BatchStatus.ACTIVE.value:
            total_expenses += fin["total_expenses"]
            total_revenue += fin["total_revenue"]
        summaries.append(BatchSummary(
            batch=batch,
            total_expenses=fin["total_expenses"],
            feed_cost=fin["feed_cost"],
            other_expenses=fin["other_expenses"],
            total_revenue=fin["total_revenue"],
            net_profit=fin["net_profit"],
            roi_percentage=round(fin["roi"], 2),
            profit_margin_pct=round(fin["margin"], 2),
            cost_per_head=round(fin["cost_per_head"], 2),
            profit_per_head=round(fin["profit_per_head"], 2),
            avg_selling_price_kg=round(fin["avg_selling_price_kg"], 2),
            avg_live_weight_kg=round(fin["avg_live_weight_kg"], 2),
            total_weight_sold=fin["total_weight"],
            piglet_cost=fin["piglet_cost"],
            piglet_heads=fin["piglet_heads"],
            buy_price_per_head=round(fin["buy_price_per_head"], 2),
            sell_price_per_head=round(fin["sell_price_per_head"], 2),
            heads_sold=fin["heads_sold"],
            heads_remaining=fin["heads_remaining"],
            heads_lost=fin["heads_lost"],
            expense_breakdown=fin["breakdown"],
            growth=fin["growth"],
        ))

    total_current_heads = sum(b.current_head_count for b in active)
    projected_revenue = 0.0
    for b in active:
        fin = _batch_financials(db, b)
        est_weight = fin["avg_live_weight_kg"]
        est_price = fin["avg_selling_price_kg"]
        if est_weight > 0 and est_price > 0:
            projected_revenue += b.current_head_count * est_weight * est_price

    low_stock = [
        {
            "item": _serialize_inventory_item(i),
            "status": "critical" if i.stock_qty <= 0 else "low",
        }
        for i in db.query(InventoryItem).all()
        if (i.threshold_qty and i.stock_qty <= i.threshold_qty) or (not i.threshold_qty and i.stock_qty <= 0)
    ]

    pending_reminders = db.query(Reminder).filter(Reminder.status == "pending").order_by(Reminder.due_date.asc()).all()

    return DashboardOverview(
        active_batches=len(active),
        closed_batches=len(closed),
        total_current_heads=total_current_heads,
        projected_revenue=projected_revenue,
        total_expenses=total_expenses,
        total_revenue=total_revenue,
        total_profit=total_revenue - total_expenses,
        low_stock_alerts=low_stock,
        pending_reminders=[ReminderItem.model_validate(r) for r in pending_reminders],
        batches=summaries,
    )


# ─── REPORTS ────────────────────────────────────────────────────────

@app.get("/api/reports/expense-breakdown")
def expense_breakdown_report(batch_id: Optional[int] = Query(None), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    query = db.query(Expense)
    if batch_id:
        query = query.filter(Expense.batch_id == batch_id)
    expenses = query.all()
    breakdown = {}
    total = 0.0
    for e in expenses:
        breakdown[e.category] = round(breakdown.get(e.category, 0.0) + e.amount, 2)
        total += e.amount
    return {"breakdown": breakdown, "total": round(total, 2)}


@app.get("/api/reports/monthly")
def monthly_report(batch_id: Optional[int] = Query(None), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    sales_q = db.query(Sale)
    exp_q = db.query(Expense)
    if batch_id:
        sales_q = sales_q.filter(Sale.batch_id == batch_id)
        exp_q = exp_q.filter(Expense.batch_id == batch_id)
    sales = sales_q.all()
    expenses = exp_q.all()
    months = {}
    for s in sales:
        key = s.sale_date.strftime("%Y-%m")
        m = months.setdefault(key, {"month": key, "revenue": 0.0, "expenses": 0.0, "heads_sold": 0})
        m["revenue"] += s.total_revenue
        m["heads_sold"] += s.heads_sold
    for e in expenses:
        key = e.date.strftime("%Y-%m")
        m = months.setdefault(key, {"month": key, "revenue": 0.0, "expenses": 0.0, "heads_sold": 0})
        m["expenses"] += e.amount
    return {"months": [months[k] for k in sorted(months)]}


@app.get("/api/reports/cage-summary")
def cage_summary_report(batch_ids: Optional[List[int]] = Query(None), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    batches = db.query(Batch).options(selectinload(Batch.cages)).all()
    if batch_ids:
        batches = [b for b in batches if b.id in batch_ids]
    result = []
    for b in batches:
        for c in b.cages:
            result.append({"batch_id": b.id, "batch_name": b.name, "cage_id": c.id, "cage_name": c.name, "head_count": c.head_count})
    return result


@app.get("/")
def root():
    return {"service": "HogPros API", "version": "3.0.0", "database": "postgresql" if "postgres" in DATABASE_URL else "sqlite"}