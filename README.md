# HogPros — Pig Farm Management & Profitability

A desktop-first web app that digitizes pig farm ledgers: track production batches and
cages, inventory, feeding, health, sales, mortalities, and expenses, and turn them into
clean, printable profit & loss statements.

## Tech Stack

- **Frontend:** React 18, Vite 5, Tailwind CSS 3, Chart.js 4, lucide-react, React Router 6
- **Backend:** Python FastAPI, SQLAlchemy 2, Pydantic v2, JWT auth (HS256)
- **Database:** PostgreSQL 16 (via docker-compose); plug in any Postgres with `DATABASE_URL`
- **Deployment:** Netlify (frontend + `/api` proxy) · Render (backend)

## How to Run

### 1. Backend — http://localhost:8000

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows; on macOS/Linux: source venv/bin/activate
pip install -r requirements.txt
docker compose up -d           # Postgres 16 + pgAdmin (skip if using SQLite)
uvicorn main:app --reload --port 8000
```

Tables are created automatically on startup. API docs: http://localhost:8000/docs
Database defaults to the docker-compose instance on `127.0.0.1:5433`; override it
anytime via the `DATABASE_URL` environment variable.

### 2. Frontend — http://localhost:5173

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to the backend on `127.0.0.1:8000` — no extra config.
For production builds: `npm run build` (outputs to `dist/`).

First time in? Use the **Sign Up** tab on the login screen — every account is created as
an administrator with full access to records and finances.

## Core Features & Usage

- **Groups & cages:** Create a batch (name, start date, head count, optional cages). Every
  feed, health, sales, and mortality record is attached to a batch and traceable to a cage.
- **Inventory:** Add feeds, medicines, vitamins, and supplies with stock and reorder levels.
  Restocking against a batch books an expense in the ledger automatically; issuing stock
  only deducts quantity. Reorder alerts appear in the bell in the top bar.
- **Expenses ledger:** Read-only and auto-populated from restocks and batch piglet costs.
  To reverse an expense, cancel the restock that created it or delete the group — then
  filter the ledger by category or batch to audit spend.
- **Sales:** Record line items per tag/cage with live weight and ₱/kg (defaults to the
  batch market rate). Heads are deducted per-cage automatically.
- **Health & reminders:** Log vitamin/dewormer doses, set due-date reminders, and mark them
  done; overdue and due-soon items also surface in the notifications bell.
- **Mortalities:** Log deaths with cause; heads are deducted from the batch/cage.
- **Insights & reports:** Executive dashboard with cost/head, profit margin, feed cost vs
  selling price, growth timeline, and projected revenue. Print a professional P&L statement
  from any batch — closed batches become locked, read-only history.
- **Interface:** Desktop-first with a fixed sidebar, spacious multi-column forms, and full
  data tables. On phones the sidebar collapses into a slide-out menu and tables scroll
  horizontally, so the whole app stays usable on smaller screens.