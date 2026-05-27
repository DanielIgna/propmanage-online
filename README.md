# PropManage — Property Operating System

Full-stack platform (React + FastAPI + MongoDB) cu 4 zone (Client / Specialist / Operator / Admin), Digital Twin, plăți escrow, AI Concierge + AI Investigator, sistem complet de monitorizare AI Health Score.

> **Status**: Beta · pregătită pentru demo-uri live.

---

## 🚀 Quick start (deploy în 5 minute)

### 1. Backend
```bash
cd backend
cp .env.example .env
# Editează .env (vezi secțiunea "Variabile critice" mai jos)
pip install -r requirements.txt
# Lansare locală:
uvicorn server:app --host 0.0.0.0 --port 8001
```

### 2. Frontend
```bash
cd frontend
yarn install
yarn start   # dev pe :3000
yarn build   # build prod
```

Setează `frontend/.env` → `REACT_APP_BACKEND_URL` = URL-ul backend-ului.

---

## 🔑 Variabile critice pentru go-live

Doar **3 variabile** trebuie setate pentru ca platforma să fie 100% production-ready:

| Variabilă | Unde o obții | Ce activează |
|-----------|--------------|--------------|
| `CORS_ORIGINS` | scrii tu (`https://propmanage.io,https://www.propmanage.io`) | Blochează cereri de la alte domenii (security) |
| `RESEND_API_KEY` | https://resend.com (free 100/zi) | Trimite emailurile real (altfel doar logged) |
| `STRIPE_API_KEY` | https://dashboard.stripe.com (`sk_live_...`) | Plăți reale (în absență, demo mode) |

**Restul** au default-uri sigure în `.env.example`.

---

## 🩺 Health check

```bash
curl https://api.propmanage.io/api/health
```

Răspunde cu status DB, LLM key, email provider, Stripe mode. Folosește pentru uptime monitoring (UptimeRobot, Pingdom etc.).

---

## 👤 Conturi demo (auto-reset zilnic la 02:00 Bucharest)

| Email | Parolă | Rol |
|-------|--------|-----|
| `admin@propmanage.io` | `Admin123!` | Admin |
| `client@propmanage.io` | `Client123!` | Client (Wallet 800 RON, 4.9★) |
| `specialist@propmanage.io` | `Spec123!` | Specialist (Wallet 1250 RON, 4.7★) |
| `operator@propmanage.io` | `Op123!` | Operator validare twin |

Conturile demo se resetează automat în fiecare noapte → starea e mereu clean pentru noi prezentări.

---

## 🤖 Capabilități AI (powered by Claude Sonnet 4.5)

| Feature | Pentru cine | Status |
|---------|-------------|--------|
| AI Concierge (chat bubble) | Client / Specialist / Operator | ✅ Live |
| AI Investigator (admin chat) | Admin | ✅ Live |
| Repair Suggester (auto-propose fixes) | Admin (review only) | ✅ Live |
| Health Score Dashboard (3 sub-scoruri + trend) | Admin | ✅ Live |
| Behavioral Security Guard (bot/VPN/GEO/rate-limit) | Endpoint-uri concierge | ✅ Live |
| Repair Audit Log (heatmap + alertă email <prag%) | Admin | ✅ Live |
| Onboarding Tour (spotlight 7 pași) | Admin nou | ✅ Live |

---

## 📊 Cron jobs (toate Europe/Bucharest)

| Job | Frecvență | Ce face |
|-----|-----------|---------|
| AI daily auto-scan | 03:00 zilnic | Rulează scannerele deterministice |
| AI digest email | 08:00 zilnic | Trimite findings deschise la admin |
| Demo accounts reset | 02:00 zilnic | Resetează conturile demo la baseline |
| Spike alert | 08:00 lunea | Detectează spike-uri incidente |
| Warranty release | 06:00 zilnic | Eliberează escrow după 30 zile |
| AI effectiveness low alert | 09:00 lunea | Email dacă Repair AI <prag% |
| Preset schedules | Fiecare min | Preset-uri scheduled |

---

## 🏗 Arhitectură

```
/app
├── backend/                  # FastAPI + Motor (async MongoDB)
│   ├── server.py             # Entry point + APScheduler crons
│   ├── routes/
│   │   ├── admin_ai.py       # AI Investigator + Repair + Health Score
│   │   ├── concierge.py      # AI Concierge per rol
│   │   ├── security_guard.py # Behavioral guard middleware
│   │   ├── public.py         # Demo lead capture + /health
│   │   └── ... (auth, projects, payments, etc.)
│   ├── demo_reset.py         # Cron pentru reset conturi demo
│   └── tests/                # Pytest
└── frontend/                 # React + Tailwind + Shadcn UI
    └── src/pages/admin/      # Metronic-style admin panel
```

---

## 💸 Costuri estimate (per 1000 useri activi)

- **Claude Sonnet 4.5** via Emergent Universal Key: ~30-50 USD/lună
- **Resend**: gratuit până la 3000 emails/lună
- **Stripe**: % pe tranzacție
- **MongoDB Atlas**: free tier până 512MB → ~25 USD/lună după
- **Hosting**: $0-20/lună

Estimat **50-100 USD/lună la 1000 useri**, scaling liniar.

---

## 📞 Contact / Demo

Programează demonstrație live de pe site (buton "Programează demo") sau scrie la `admin@propmanage.io`.
