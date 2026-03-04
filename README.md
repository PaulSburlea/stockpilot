# StockPilot 📦

> A full-stack inventory and sales management platform with AI-powered restocking suggestions, role-based access control, and real-time analytics.

---

## Table of Contents

- [Overview](#overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Running the Application](#running-the-application)
- [Database Setup](#database-setup)
- [Contributing](#contributing)
- [Team](#team)

---

## Overview

StockPilot is a full-stack inventory and sales management system designed for multi-location retail networks. It provides warehouse managers and stand operators with real-time stock visibility, AI-driven reorder suggestions, sales forecasting, and a complete audit trail — all through a clean, role-aware interface.

---

## Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 19.2.0 | UI framework |
| TypeScript | — | Static typing |
| Vite | 7.3 | Build tool |
| Tailwind CSS | 4.2 | Styling |
| React Router DOM | 7 | Client-side routing |
| TanStack Query | — | Server state management |
| Recharts | — | Interactive charts |
| Leaflet | — | Interactive maps |

### Backend
| Technology | Purpose |
|---|---|
| Node.js | JavaScript runtime |
| Express 5.2 | REST API framework |
| Supabase | PostgreSQL cloud database |
| JWT | Stateless authentication |
| bcrypt | Password hashing |

---

## Project Structure

```
stockpilot/
├── stockpilot-frontend/
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   ├── context/           # React contexts (Auth, Notifications)
│   │   ├── hooks/             # Custom hooks
│   │   ├── pages/             # Application pages
│   │   └── main.tsx           # Entry point
│   ├── .env.example
│   └── package.json
│
├── stockpilot-backend/
│   ├── src/
│   │   ├── config/            # Supabase and app configuration
│   │   ├── middleware/        # Authentication & authorization
│   │   ├── routes/            # API route handlers
│   │   ├── services/          # Business logic
│   │   └── index.js           # Server entry point
│   ├── .env.example
│   └── package.json
│
├── README.md
└── .gitignore
```

---

## Features

### All Roles
- 📊 **Dashboard** — Real-time overview of stock levels and sales performance
- 📦 **Stock Management** — Browse, filter, and monitor inventory across locations
- 🔄 **Stock Movements** — Full history of transfers, orders, and adjustments
- 💰 **Sales** — Sales history with interactive charts and filters
- 📍 **Locations** — Manage warehouse and stand locations
- 🗺️ **Network Map** — Geographic visualization of stock distribution
- 📤 **Export** — Export reports in multiple formats

### Admin & Warehouse Manager
- ➕ **Products** — Add and edit product catalog
- 💡 **AI Suggestions** — Intelligent restocking recommendations
- 📈 **Forecasting** — Demand predictions based on sales history
- ⚖️ **Cost Comparison** — Supplier and transport cost analysis
- ⚙️ **Settings** — Location and system configuration

### Admin Only
- 👥 **User Management** — Create and manage users and roles
- 📝 **Audit Log** — Complete history of all system actions

---

## Prerequisites

- **Node.js** v18.0 or higher
- **npm** v9.0 or higher
- **Git**
- A [Supabase](https://supabase.com) account with an active project

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/PaulSburlea/stockpilot
cd stockpilot
```

### 2. Set Up the Backend

```bash
cd stockpilot-backend
npm install
cp .env.example .env
```

Edit `.env` with your credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-secret-key
JWT_SECRET=your-jwt-secret
PORT=3000
```

### 3. Set Up the Frontend

```bash
cd ../stockpilot-frontend
npm install
cp .env.example .env
```

Edit `.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

---

## Running the Application

Open two separate terminal windows:

**Terminal 1 — Backend:**
```bash
cd stockpilot-backend
npm run dev
# Server running at http://localhost:3000
```

**Terminal 2 — Frontend:**
```bash
cd stockpilot-frontend
npm run dev
# App running at http://localhost:5173
```

Navigate to `http://localhost:5173` in your browser.

### Production Build

```bash
# Backend
cd stockpilot-backend && npm run build && npm start

# Frontend
cd stockpilot-frontend && npm run build && npm run preview
```

## Contributing

1. Make sure you have received the `.env` values from a team member — **never commit secrets to the repository**
2. Always pull the latest changes before starting work:
   ```bash
   git pull origin main
   ```
3. Create a feature branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. Commit with clear, descriptive messages:
   ```bash
   git commit -m "feat: add stock movement filter by date range"
   ```
5. Open a pull request when ready for review

### Common Issues

| Issue | Solution |
|---|---|
| `EADDRINUSE` on port 3000 | Change `PORT` in `.env` or kill the process using that port |
| `Connection refused` on API calls | Ensure the backend is running and `VITE_API_URL` is correct |
| Supabase errors | Double-check credentials in `.env` and verify your Supabase project is active |

---

## Team

- [Paul Sburlea](https://github.com/PaulSburlea)
- [Daniel Vișa](https://github.com/visa-daniel-30123)
