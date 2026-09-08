# HogPros — Batch-Based Pig Farm Management & Profitability SaaS

A web application to digitize pig farm manual ledgers, tracking operations by batch
and cage with full P&L reporting, role-based access, and printable statements.

Each batch (≈50 heads) is tracked independently with strict isolation of expenses,
sales, feed logs, health events, and mortalities for accurate per-batch profitability.

## Features

- **Multi-batch + cage tracking**: Each batch contains optional cages (sub-groups).
  Sales and mortalities can be traced to specific cages with line-item detail.
- **Self-service sign-up**: First-time users sign up right on the login screen (Sign In /
  Sign Up tabs). There are no roles to pick — every account created is an administrator
  with full access to records and finances.
- **Per-head & per-cage sales**: Record sales as individual line items (Tag ID, cage,
  weight, price/kg). Default market rate ₱140/kg. Heads deducted per-cage automatically.
- **Feed log tracking**: Dedicated feed logs per cage (feed type, quantity, cost)
  separate from general expenses — drives feed cost per kg and FCR metrics.
- **Mortality logging**: Record deaths per cage with cause. Heads deducted from
  batch/cage automatically. Closing a batch requires `current_head_count == 0`.
- **Health & medication logs**: Vitamin, medication, vaccination, checkup, treatment
  records with optional cost — feeds the P&L health cost line.
- **Profit & Loss statement**: Printable report showing revenue, expenses
  (broken down by category + feed + health), net income, profit margin, cost/head,
  profit/head, and full sales detail. Uses `window.print()`.
- **Executive dashboard**: Active/Closed toggle, per-batch cost per head, profit
  margin %, feed cost vs selling price per kg, growth timeline (avg weight by month),
  projected revenue, and heads-on-hand metrics.
- **Batch locking**: Closing a batch makes all records immutable. Requires all
  heads to be gone (sold or lost) before closing.

## Tech Stack

| Layer     | Technology                                    |
|-----------|-----------------------------------------------|
| Backend   | Python FastAPI + SQLAlchemy + Pydantic v2     |
| Auth      | PBKDF2-HMAC-SHA256 + HS256 JWT (stdlib only) |
| Database  | SQLite (dev default) / PostgreSQL             |
| Frontend  | React 18 + Vite 5 + Tailwind CSS 3           |
| Charts    | Chart.js 4 + react-chartjs-2                 |
| Icons     | lucide-react                                  |

## Project Structure

```
piggery-dashboard/
├── backend/
│   ├── main.py          # FastAPI app + all route definitions
│   ├── models.py        # SQLAlchemy ORM models
│   ├── schemas.py       # Pydantic request/response schemas
│   ├── security.py      # JWT auth, password hashing, RBAC dependencies
│   ├── database.py      # DB engine/session setup
│   └── requirements.txt
└── frontend/
    └── src/
        ├── api.js                   # API client (sends Bearer token)
        ├── App.jsx                  # Routes + AuthProvider
        ├── auth/AuthContext.jsx     # React context for auth state
        ├── components/
        │   ├── Layout.jsx           # Sidebar nav + user menu
        │   ├── ProtectedRoute.jsx   # Auth guard (redirects to /login)
        │   ├── InsightCharts.jsx    # GroupedBarChart, MultiLineChart
        │   ├── ExpenseBreakdownChart.jsx
        │   ├── MonthlyTrendChart.jsx
        │   ├── BatchHistoryChart.jsx
        │   ├── BatchComparisonChart.jsx
        │   ├── StatCard.jsx
        │   └── StatusBadge.jsx
        └── pages/
            ├── Login.jsx            # Sign In / Sign Up screen
            ├── Dashboard.jsx        # Executive insights
            ├── Operations.jsx       # Batch list + create
            └── GroupDetail.jsx      # Tabs: Ledger/Overview/Cages/Expenses/
                                     #        Feed/Sales/Health/Mortalities + Report
```

## Database Schema

### users
| Column        | Type      | Notes                           |
|---------------|-----------|---------------------------------|
| id            | serial PK |                                 |
| username      | varchar   | unique, login credential        |
| password_hash | varchar   | PBKDF2-HMAC-SHA256              |
| full_name     | varchar   | optional display name           |
| role          | varchar   | always `admin` (no worker roles)          |
| created_at    | timestamp |                                 |

### batches
| Column              | Type      | Notes                                  |
|---------------------|-----------|----------------------------------------|
| id                  | serial PK |                                        |
| name                | varchar   | unique (editable)                      |
| initial_head_count  | integer   | starting heads                         |
| current_head_count  | integer   | updated by sales/mortalities           |
| market_price_per_kg | float     | default ₱140 — used as default price in sale forms |
| start_date          | date      | batch start                            |
| status              | string    | `active` \| `closed` (locked)          |
| notes               | text      |                                        |

### cages
| Column      | Type     | Notes                                  |
|-------------|----------|----------------------------------------|
| id          | serial PK|                                        |
| batch_id    | FK       | → batches.id (NOT NULL)                |
| name        | varchar  | e.g. "Cage 1"                          |
| head_count  | integer  | heads currently in this cage           |

Cage head counts drive the batch's live count: `current_head_count = Σ cage counts`
(via `_sync_head_counts` in `backend/main.py`). Sales and mortalities deduct heads
from specific cages when a cage_id is provided.

### expenses
| Column      | Type     | Notes                                  |
|-------------|----------|----------------------------------------|
| id          | serial PK|                                        |
| batch_id    | FK       | → batches.id (NOT NULL)                |
| category    | varchar  | medicine/veterinary/utilities/labor/maintenance/misc |
| description | varchar  |                                        |
| amount      | float    |                                        |
| date        | date     |                                        |

> Feed is tracked via `feed_logs` below — not in expenses.

### feed_logs
| Column      | Type     | Notes                                  |
|-------------|----------|----------------------------------------|
| id          | serial PK|                                        |
| batch_id    | FK       | → batches.id (NOT NULL)                |
| cage_id     | FK/null  | → cages.id (optional — "all cages")    |
| date        | date     |                                        |
| feed_type   | varchar  | starter/grower/finisher/supplement/other |
| quantity_kg | float    |                                        |
| cost        | float    | drives feed cost in P&L                |
| notes       | text     |                                        |

### sales
| Column        | Type     | Notes                                  |
|---------------|----------|----------------------------------------|
| id            | serial PK|                                        |
| batch_id      | FK       | → batches.id (NOT NULL)                |
| heads_sold    | integer  | validated ≤ current_head_count         |
| weight_kg     | float    |                                        |
| price_per_kilo| float    |                                        |
| total_revenue | float    |                                        |
| buyer_name    | varchar  |                                        |
| buyer_contact | varchar  |                                        |
| sale_date     | date     |                                        |
| notes         | text     |                                        |

### sale_items  *(line-item snapshot per head/tag sold)*
| Column        | Type     | Notes                                  |
|---------------|----------|----------------------------------------|
| id            | serial PK|                                        |
| sale_id       | FK       | → sales.id (NOT NULL)                  |
| cage_id       | FK/null  | source cage                            |
| tag_id        | varchar  | individual tag/lot ID                  |
| head_count    | integer  | heads in this line item                |
| live_weight_kg| float    | weight for this item                   |
| price_per_kilo| float    | price per kg for this item             |
| amount        | float    | = head_count × live_weight_kg × price_per_kilo |

### mortalities
| Column      | Type     | Notes                                  |
|-------------|----------|----------------------------------------|
| id          | serial PK|                                        |
| batch_id    | FK       | → batches.id (NOT NULL)                |
| cage_id     | FK/null  | → cages.id (optional)                  |
| date        | date     |                                        |
| head_count  | integer  | deducted from batch/cage               |
| cause       | varchar  |                                        |
| notes       | text     |                                        |

### health_logs
| Column      | Type     | Notes                                  |
|-------------|----------|----------------------------------------|
| id          | serial PK|                                        |
| batch_id    | FK       | → batches.id (NOT NULL)                |
| log_type    | varchar  | vitamin/medication/vaccination/checkup/treatment |
| description | varchar  |                                        |
| dosage      | varchar  |                                        |
| veterinarian| varchar  |                                        |
| cost        | float    | feeds P&L health cost line             |
| log_date    | date     |                                        |
| notes       | text     |                                        |

**Locking invariant**: When a batch `status = 'closed'`, all create/update/delete
operations on its sub-records are rejected by the API (HTTP 400).

## API Endpoints

### Authentication
| Method | Endpoint             | Description                             |
|--------|----------------------|-----------------------------------------|
| POST   | `/api/auth/login`    | Returns JWT + user info                 |
| POST   | `/api/auth/register` | Public self-signup — always creates an admin account |
| GET    | `/api/auth/me`       | Current user from Bearer token          |
| GET    | `/api/users`         | List all users                          |

### Batches
| Method | Endpoint                    | Description                    |
|--------|-----------------------------|--------------------------------|
| GET    | `/api/batches`              | List batches (`?status=` filter) |
| GET    | `/api/batches/{id}`         | Get batch (incl. cages)        |
| POST   | `/api/batches`              | Create batch (admin only)      |
| PUT    | `/api/batches/{id}`         | Rename/update (admin only)     |
| POST   | `/api/batches/{id}/close`   | Lock batch; requires heads=0   |
| DELETE | `/api/batches/{id}`         | Delete batch (admin only)      |
| GET    | `/api/batches/{id}/statement` | Admin P&L statement (JSON)   |

### Cages
| Method | Endpoint              | Description                            |
|--------|-----------------------|----------------------------------------|
| POST   | `/api/cages?batch_id=` | Add a cage (admin only)               |
| PUT    | `/api/cages/{id}`      | Update cage (admin only)              |
| DELETE | `/api/cages/{id}`      | Remove cage (admin only)              |

### Expenses
| Method | Endpoint                       | Description                    |
|--------|--------------------------------|--------------------------------|
| GET    | `/api/expenses?batch_id=`     | List expenses                  |
| POST   | `/api/expenses`                | Create expense                 |
| PUT    | `/api/expenses/{id}`           | Update expense (admin only)    |
| DELETE | `/api/expenses/{id}`           | Delete expense (admin only)    |

### Sales (admin only)
| Method | Endpoint            | Description                    |
|--------|---------------------|--------------------------------|
| GET    | `/api/sales?batch_id=` | List sales                  |
| POST   | `/api/sales`        | Create sale with optional line items |
| PUT    | `/api/sales/{id}`   | Update sale                   |
| DELETE | `/api/sales/{id}`   | Delete sale (restores heads)  |

### Feed Logs
| Method | Endpoint                     | Description                    |
|--------|------------------------------|--------------------------------|
| GET    | `/api/feed-logs?batch_id=`  | List feed logs                 |
| POST   | `/api/feed-logs`             | Create feed log                |
| DELETE | `/api/feed-logs/{id}`        | Delete feed log (admin only)   |

### Mortalities
| Method | Endpoint                       | Description                    |
|--------|--------------------------------|--------------------------------|
| GET    | `/api/mortalities?batch_id=`  | List mortality records         |
| POST   | `/api/mortalities`             | Create mortality (deducts heads) |
| DELETE | `/api/mortalities/{id}`        | Delete mortality (admin only)  |

### Health Logs
| Method | Endpoint                | Description                     |
|--------|-------------------------|---------------------------------|
| GET    | `/api/health-logs?batch_id=` | List health logs           |
| POST   | `/api/health-logs`      | Create health log              |
| PUT    | `/api/health-logs/{id}` | Update health log (admin only) |
| DELETE | `/api/health-logs/{id}` | Delete health log (admin only) |

### Insights & Reporting (admin only)
| Method | Endpoint                           | Description                     |
|--------|------------------------------------|---------------------------------|
| GET    | `/api/dashboard?batch_ids=`        | Executive metrics per batch     |
| GET    | `/api/reports/expense-breakdown?batch_id=` | Expense totals per category |
| GET    | `/api/reports/monthly?batch_id=`   | Monthly revenue/expense/profit  |

## Auth & Security

- Passwords hashed with PBKDF2-HMAC-SHA256 (100k iterations, `algo$salt$digest` format).
- JWTs signed with HS256 using HMAC-SHA256. Configurable via env var `PIGGERY_SECRET`.
- Default secret (dev only): `piggery-dev-secret-change-me-in-production`.
- Token TTL: 168 hours (7 days).
- No default account is seeded — the first visitor **signs up** (see below). Every
  self-created account is an administrator, so there are no worker roles to manage.

## Setup & Run

### Backend

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

API docs at http://localhost:8000/docs (Swagger UI).

> **Database:** By default uses SQLite (`piggery.db`) for easy local setup.
> Delete `piggery.db` to re-create tables from scratch (schema changes require this).
> To switch to PostgreSQL, edit `DATABASE_URL` in `backend/database.py`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

The app opens on **Sign In / Sign Up**. No accounts exist yet — use the **Sign Up** tab
to create one, then sign in. Every account is an admin with full access.

## Usage Workflow

1. **Sign up** on the login screen with a username and password, then **sign in**.
2. **Create a batch** (e.g. "Farrow 03") with start date and optional cages.
3. **Daily ops**:
   - Log feed deliveries (type, kg, cost, per-cage optional).
   - Log health events (vitamins, treatments, vet visits with cost).
   - Log mortalities (heads, cause, per-cage).
4. **Record sales**: Add line items per tag/cage with weight and ₱/kg (defaults to
   the batch market rate ₱140). Heads deducted per-cage.
5. **Review P&L**: Open the Ledger tab to see every transaction with running balance,
   or click **Print Report** for a professional statement.
6. **Executive insights**: Dashboard shows cost/head, profit margin %, feed cost vs
   selling price, growth timeline, projected revenue, and Active/Closed toggle with
   per-batch filtering.
7. **Close & lock** a batch once all heads are gone (sold + mortality = initial).
   Records become permanent read-only history visible in the Insights dashboard.
