<div align="center">

<img src="https://img.shields.io/badge/StockPilot-📦-6d28d9?style=for-the-badge" alt="StockPilot" />

# StockPilot

**Multi-location inventory management with AI-powered restocking suggestions**

[![React](https://img.shields.io/badge/React_19-20232A?style=flat-square&logo=react&logoColor=61DAFB)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org)
[![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express_5-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=flat-square&logo=supabase&logoColor=white)](https://supabase.com)
[![TailwindCSS](https://img.shields.io/badge/Tailwind_CSS_4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)
[![Vite](https://img.shields.io/badge/Vite_7-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)

[Features](#-features) · [Architecture](#-architecture) · [Algorithm](#-restocking-algorithm) · [Getting Started](#-getting-started) · [API](#-api-reference) · [Team](#-team)

</div>

---

## 📖 Overview

StockPilot is a full-stack inventory and sales management platform built for **multi-location retail networks** — warehouses and field stands. It gives warehouse managers and stand operators real-time stock visibility, intelligent restocking recommendations, and a complete audit trail through a clean, role-aware interface.

The core of the system is a **weighted-sales-rate algorithm** that continuously analyzes stock levels, sales velocity, and transport costs across all locations to generate actionable, economically-sound transfer and reorder suggestions.

---

## ✨ Features

### 🔁 Stock Movement Workflow
Full lifecycle management for every inventory movement:

```
pending → awaiting_pickup → in_transit → completed
                                       ↘ cancelled
```

- **Warehouse-initiated transfers** — direct dispatch from warehouse stock
- **Stand-to-stand redistribution** — surplus stands fulfill deficit stands
- **Supplier orders** — escalated automatically when network stock is insufficient
- **Manual movements** — warehouse managers can create transfers and orders directly
- Role-gated actions: warehouse managers approve, stand managers confirm pickup/delivery

### 💡 AI Restocking Suggestions
The algorithm runs on-demand and generates a fresh, deduplicated suggestion set:

| Flow | Trigger | Action |
|---|---|---|
| **Deficit** | Stock will run out before next resupply | Transfer from best source or escalate to supplier |
| **Stale redistribution** | Product stagnant > threshold, another stand has demand | Redistribute to active stand |
| **No traction** | Product never sold at this stand | Return to warehouse |
| **Surplus** | Stock covers > 100 days of demand | Source for deficit stands |

Every suggestion includes urgency tagging (`[CRITIC]` / `[URGENT]` / `[NORMAL]`), transport cost ratio, savings vs. warehouse reference cost, and full decision context stored as structured JSON.

### 📊 Analytics & Visibility
- Real-time dashboards per role (admin, warehouse manager, stand manager)
- Sales charts with date range filters
- Stale stock detection with configurable thresholds
- Cost comparison between supplier and internal transfer options
- Network map (Leaflet) showing stock distribution geographically
- Suggestion history with decision-time context preserved

### 🔐 Role-Based Access Control
| Feature | Admin | Warehouse Manager | Stand Manager |
|---|:---:|:---:|:---:|
| User management | ✅ | — | — |
| Audit log | ✅ | — | — |
| AI suggestions | ✅ | ✅ | — |
| Approve movements | ✅ | ✅ | — |
| Confirm pickup/delivery | — | — | ✅ |
| View own stock/sales | ✅ | ✅ | ✅ |

---

## 🏗 Architecture

```
stockpilot/
├── stockpilot-frontend/
│   └── src/
│       ├── components/        # Reusable UI (Header, layout)
│       ├── context/           # AuthContext, NotificationsContext
│       ├── pages/             # Suggestions, Movements, Settings, ...
│       └── services/
│           └── api.ts         # Typed API client (all endpoints)
│
└── stockpilot-backend/
    └── src/
        ├── config/            # Supabase client
        ├── middleware/        # authenticate, authorize (JWT + roles)
        ├── routes/            # suggestions, movements, stock, users, ...
        └── services/
            ├── algorithm.js   # Restocking suggestion engine
            └── audit.js       # Audit log helper
```

### Database Schema (key tables)

```sql
locations        — warehouses and stands (lat/lng, city)
products         — catalog (SKU, unit_price, weight_kg)
stock            — current qty + safety_stock per location × product
sales            — historical sales events
stock_movements  — full movement lifecycle with status transitions
reorder_suggestions — algorithm output with structured reason JSON
location_settings — per-location algorithm tuning
transport_costs  — fixed_cost + cost_per_kg + lead_time per route
audit_logs       — immutable action history
```

---

## 🧠 Restocking Algorithm

The suggestion engine (`services/algorithm.js`) runs in several steps:

1. **Weighted sales rate** — 3-window weighted average (30/60/90 days, weights 0.5/0.3/0.2) gives more importance to recent demand without ignoring seasonal patterns
2. **Classify each stand** — deficit, surplus, stale, or no-traction per product
3. **Flow A (deficit)** — finds best source: surplus stand → stale stand → warehouse → supplier. Filters by ROI: transport cost must be ≤ `max_transport_cost_ratio` (default 25%) of merchandise value. CRITIC urgency (< 2 days stock) bypasses ROI check.
4. **Flow B (stale redistribution)** — moves stagnant stock to stands with proven demand
5. **Flow C (no traction)** — returns never-sold stock to warehouse
6. **Deduplication** — one suggestion per `product × source × destination` key; skips if an identical active movement already exists
7. **Full replacement** — on each run, all previous `pending` suggestions become `superseded` and the fresh set is inserted, ensuring the list always reflects current reality

**Configurable per location:**
`lead_time_days` · `safety_stock_multiplier` · `reorder_threshold_days` · `surplus_threshold_days` · `min_transfer_qty` · `max_transfer_qty` · `max_transport_cost_ratio` · `stale_days_threshold` · `storage_capacity`

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** ≥ 18.0
- **npm** ≥ 9.0
- A [Supabase](https://supabase.com) project with the schema applied

### 1. Clone

```bash
git clone https://github.com/PaulSburlea/stockpilot
cd stockpilot
```

### 2. Backend

```bash
cd stockpilot-backend
npm install
cp .env.example .env
```

```env
# .env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-service-role-key
JWT_SECRET=your-jwt-secret
PORT=3000
```

### 3. Frontend

```bash
cd ../stockpilot-frontend
npm install
cp .env.example .env
```

```env
# .env
VITE_API_URL=http://localhost:3000/api
```

### 4. Run

```bash
# Terminal 1
cd stockpilot-backend && npm run dev

# Terminal 2
cd stockpilot-frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### Database migrations

Before first run, apply the required column additions:

```sql
ALTER TABLE public.location_settings
  ADD COLUMN IF NOT EXISTS min_transfer_qty integer NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS max_transport_cost_ratio numeric(4,2) NOT NULL DEFAULT 0.25;
```

---

## 📡 API Reference

All endpoints require `Authorization: Bearer <token>` unless noted.

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | — | Login, returns JWT |
| `GET` | `/api/suggestions` | ✅ | List pending suggestions |
| `POST` | `/api/suggestions/run` | warehouse+ | Run restocking algorithm |
| `PATCH` | `/api/suggestions/:id` | warehouse+ | Approve or reject suggestion |
| `GET` | `/api/suggestions/history` | ✅ | Approved/rejected history |
| `GET` | `/api/movements` | ✅ | List movements (filtered by role) |
| `POST` | `/api/movements` | warehouse+ | Create manual movement |
| `PATCH` | `/api/movements/:id/accept` | warehouse+ | Accept → in_transit or awaiting_pickup |
| `PATCH` | `/api/movements/:id/pickup` | stand | Confirm dispatch from source stand |
| `PATCH` | `/api/movements/:id/receive` | stand/warehouse | Confirm receipt, update stock |
| `PATCH` | `/api/movements/:id/cancel` | role-gated | Cancel pending/awaiting movement |
| `GET` | `/api/stock` | ✅ | Stock levels across locations |
| `GET` | `/api/settings/:locationId` | ✅ | Location algorithm settings |
| `PUT` | `/api/settings/:locationId` | warehouse+ | Update location settings |
| `GET` | `/api/audit` | admin | Full audit log |
| `GET` | `/api/users` | admin | User list |

---

## 🤝 Contributing

1. Get `.env` values from a team member — **never commit secrets**
2. Pull latest before starting:
   ```bash
   git pull origin main
   ```
3. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. Commit with conventional format:
   ```bash
   git commit -m "feat: add stock movement filter by date range"
   git commit -m "fix: algorithm skips suggestions covered by active movements"
   git commit -m "chore: update location_settings defaults"
   ```
5. Open a pull request for review before merging to `main`

### Troubleshooting

| Issue | Solution |
|---|---|
| `EADDRINUSE` port 3000 | Change `PORT` in `.env` or kill the existing process |
| API calls return `401` | Token expired — log in again |
| `Connection refused` on API | Ensure backend is running and `VITE_API_URL` is correct |
| Supabase `permission denied` | Use the **service role** key in backend, not the anon key |
| Suggestions not appearing | Run the algorithm from the Suggestions page first |

---

## 👥 Team

<table>
  <tr>
    <td align="center">
      <a href="https://github.com/PaulSburlea">
        <img src="https://github.com/PaulSburlea.png" width="80" style="border-radius:50%" /><br />
        <sub><b>Paul Sburlea</b></sub>
      </a>
    </td>
    <td align="center">
      <a href="https://github.com/visa-daniel-30123">
        <img src="https://github.com/visa-daniel-30123.png" width="80" style="border-radius:50%" /><br />
        <sub><b>Daniel Vișa</b></sub>
      </a>
    </td>
  </tr>
</table>

---

<div align="center">
  <sub>Built with ☕ and way too many git conflicts</sub>
</div>