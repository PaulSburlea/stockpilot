# StockPilot 📦

## 🧠 About the Project

StockPilot is a full-stack inventory and sales management system built as a collaborative technical project. The application demonstrates modern frontend and backend architecture, cloud database integration, and role-based access control.
---

## 📋 Cuprins

- [Tehnologii](#tehnologii)
- [Structura Proiectului](#structura-proiectului)
- [Funcționalități](#funcționalități)
- [Cerințe Sistem](#cerințe-sistem)
- [Instalare și Configurare](#instalare-și-configurare)
- [Pornirea Aplicației](#pornirea-aplicației)
- [Configurare Bază de Date](#configurare-bază-de-date)
- [Instrucțiuni pentru Coleg](#instrucțiuni-pentru-coleg)

---

## 🚀 Tehnologii

### Frontend
- **React 19.2.0** - Framework UI
- **TypeScript** - Tipizare statică
- **Vite 7.3** - Build tool rapid
- **Tailwind CSS 4.2** - Styling
- **React Router DOM 7** - Routing
- **TanStack Query** - Server state management
- **Recharts** - Grafice interactive
- **Leaflet** - Hărți interactive

### Backend
- **Node.js** - Runtime JavaScript
- **Express 5.2** - Framework API
- **Supabase** - Bază de date PostgreSQL
- **JWT** - Autentificare securizată
- **bcrypt** - Criptare parole

---

## 📁 Structura Proiectului

```
stockpilot/
├── stockpilot-frontend/          # Aplicația React
│   ├── src/
│   │   ├── components/          # Componente reutilizabile
│   │   ├── context/            # Contexte React (Auth, Notifications)
│   │   ├── hooks/              # Custom hooks
│   │   ├── pages/              # Pagini aplicație
│   │   └── main.tsx            # Entry point
│   ├── .env                    # Variabile environment frontend
│   └── package.json
│
└── stockpilot-backend/           # API Express
    ├── src/
    │   ├── config/             # Configurări (Supabase)
    │   ├── middleware/         # Middleware (autentificare)
    │   ├── routes/             # Endpoint-uri API
    │   ├── services/           # Logică de business
    │   └── index.js            # Entry point server
    ├── .env                    # Variabile environment backend
    └── package.json
```

---

## ✨ Funcționalități

### Toți Utilizatorii
- 📊 **Dashboard** - Vedere de ansamblu asupra stocurilor și vânzărilor
- 📦 **Gestionare Stoc** - Vizualizare și filtrare produse
- 🔄 **Mișcări Stoc** - Istoric complet al intrărilor/ieșirilor
- 💰 **Vânzări** - Istoric vânzări cu grafice
- 📍 **Locații** - Management locații depozit
- 🗺️ **Harta Stocului** - Vizualizare geografică
- 📤 **Export** - Export date în diverse formate

### Admin & Warehouse Manager
- ➕ **Produse** - Adăugare/editare produse
- 💡 **Sugestii** - Recomandări inteligente de aprovizionare
- 📈 **Prognoze** - Predicții bazate pe istoric
- ⚖️ **Comparație Costuri** - Analiză furnizori
- ⚙️ **Setări** - Configurare aplicație

### Doar Admin
- 👥 **Utilizatori** - Management utilizatori și roluri
- 📝 **Audit Log** - Istoric complet al acțiunilor

---

## 💻 Cerințe Sistem

### Necesar
- **Node.js** - v18.0 sau mai nou
- **npm** - v9.0 sau mai nou (vine cu Node.js)
- **Git** - Pentru clonarea proiectului

### Cont Supabase
- Crează un cont gratuit pe [supabase.com](https://supabase.com)
- Creează un nou proiect
- Notează `Project URL`, `Publishable key/Secret key` din Settings → API

---

## 🔧 Instalare și Configurare

### 1. Clonează Proiectul

```bash
git clone <URL-REPO-ULUI> stockpilot
cd stockpilot
```

### 2. Instalare Backend

```bash
cd stockpilot-backend
npm install
```

### 3. Configurare Backend

Creează fișierul `.env` în `stockpilot-backend/`:

```env
# Supabase Configuration
SUPABASE_URL=https://tmtwmbunjxqvewdoozwo.supabase.co
SUPABASE_SECRET_KEY=cheia-ta-secretă-de-la-supabase

# Server Configuration
PORT=3000

# JWT Secret
JWT_SECRET=secret-key-pentru-jwt
```

> **Notă:** Fișierul `.env.example` conține un template. Copiază-l și redenumește-l în `.env`, apoi completează valorile.

### 4. Instalare Frontend

```bash
cd ../stockpilot-frontend
npm install
```

### 5. Configurare Frontend

Creează fișierul `.env` în `stockpilot-frontend/`:

```env
VITE_API_URL=http://localhost:3000/api
```

---

## ▶️ Pornirea Aplicației

### Mod Dezvoltare

Deschide **două terminale separate**:

**Terminal 1 - Backend:**
```bash
cd stockpilot-backend
npm run dev
```
Serverul va porni pe `http://localhost:3000`

**Terminal 2 - Frontend:**
```bash
cd stockpilot-frontend
npm run dev
```
Frontendul va porni pe `http://localhost:5173`

Accesează `http://localhost:5173` în browser.

### Mod Producție

**Backend:**
```bash
cd stockpilot-backend
npm run build
npm start
```

**Frontend:**
```bash
cd stockpilot-frontend
npm run build
npm run preview
```

---

## 👥 Instrucțiuni pentru Coleg

### Pasul 1: Clonează Proiectul

```bash
git clone <URL-UL-GIT-REPO> stockpilot
cd stockpilot
```

### Pasul 2: Instalare Dependențe

```bash
# Backend
cd stockpilot-backend
npm install

# Frontend
cd ../stockpilot-frontend
npm install
```

### Pasul 3: Configurare Environment

1. Copiază `.env.example` → `.env` în ambele foldere
2. Completează valorile necesare:
   - **Backend**: URL și cheie Supabase
   - **Frontend**: URL către backend (de obicei `http://localhost:3000/api`)

### Pasul 4: Rulează Aplicația

```bash
# Terminal 1
cd stockpilot-backend
npm run dev

# Terminal 2
cd stockpilot-frontend
npm run dev
```

### Troubleshooting Comun

| Problemă | Soluție |
|----------|---------|
| `EADDRINUSE` pe port 3000 | Schimbă `PORT` în `.env` sau oprește procesul care folosește portul |
| `Connection refused` | Verifică că backend-ul rulează și URL-ul în `.env` este corect |
| `Supabase error` | Verifică credențialele în `.env` și că proiectul Supabase este activ |

---

## 👨‍💻 Team

- Paul Sburlea
- Daniel Vișa