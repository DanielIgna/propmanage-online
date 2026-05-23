# PropManage - Property Operating System

## Original Problem Statement
Construire aplicație completă end-to-end (backend + auth + marketplace funcțional), Auto-play pentru User Journey, Pagini dedicate per rol (Client / Specialist / Admin / Operator), Toggle bilingv RO/EN.

## Architecture
- **Frontend**: React 19 + Tailwind + Framer Motion + react-router-dom + i18n context
- **Backend**: FastAPI + MongoDB (motor async) + JWT (httpOnly cookies) + bcrypt
- **4 user roles**: client, specialist, admin, operator
- **Marketplace mechanics**: lead fees, escrow, tokens, property health scoring

## What's Implemented (2026-01)

### Backend - 100% functional (36/36 tests passed)
- ✅ JWT auth with httpOnly cookies (access 24h + refresh 7 days)
- ✅ bcrypt password hashing + role-based access control
- ✅ 5 pre-seeded demo accounts (idempotent on startup)
- ✅ Full marketplace flow: create request → accept (45 RON fee) → start → complete → confirm
- ✅ Escrow logic: client funds held, 95% released to specialist on confirmation
- ✅ Token economy: +100 per confirmed job, +20 per review
- ✅ Property health scoring: +5 health per confirmed intervention
- ✅ Specialist tier system: auto-upgrade to VERIFIED at 10+ reviews & 4.8+ rating
- ✅ Admin verification queue for specialists

### Frontend - All routes working
- ✅ `/` - Landing page (10 sections, auto-play User Journey)
- ✅ `/login` - Login with demo account quick-buttons
- ✅ `/register` - Sign up with role selection (client/specialist)
- ✅ `/client` - Client dashboard (property, requests, Digital Twin 3D)
- ✅ `/specialist` - Specialist dashboard (leads + my jobs)
- ✅ `/admin` - Admin control panel (stats, verification queue)
- ✅ `/operator` - Operator dashboard (validation queue)
- ✅ **Bilingual RO/EN toggle** (persistent in localStorage)
- ✅ **Auto-play User Journey** (3.5s per step, pause/resume button)

### Files
- /app/backend/server.py - Complete backend (auth, marketplace, admin, operator)
- /app/backend/.env - JWT_SECRET, MONGO_URL, ADMIN credentials
- /app/frontend/src/App.js - Landing + router
- /app/frontend/src/auth.js - AuthContext (login, register, logout, refreshUser)
- /app/frontend/src/i18n.js - Translation context (RO/EN)
- /app/frontend/src/pages/Auth.jsx - Login + Register pages
- /app/frontend/src/pages/Dashboards.jsx - All 4 role dashboards
- /app/memory/test_credentials.md - Demo account credentials

## Demo Accounts (Pre-seeded)
- Client: client@propmanage.io / Client123! (5000 RON wallet, 250 tokens, 1 property "Skyline Loft A4", 3 sample requests)
- Specialist (HVAC): specialist@propmanage.io / Spec123! (VERIFIED, 800 RON balance, rating 4.9)
- Specialist (Plumbing): specialist2@propmanage.io / Spec123! (VERIFIED)
- Admin: admin@propmanage.io / Admin123!
- Operator: operator@propmanage.io / Op123!

## API Endpoints
- POST /api/auth/{register,login,logout} | GET /api/auth/me
- GET/POST /api/properties | GET /api/properties/{id}
- GET/POST /api/requests | GET /api/requests/{id}
- POST /api/requests/{id}/{accept,start,complete,confirm,escrow,review}
- GET /api/specialists?category=
- GET /api/transactions | POST /api/wallet/topup
- GET /api/admin/{stats,specialists/pending,disputes} | POST /api/admin/specialists/{id}/verify
- GET /api/operator/queue | POST /api/operator/logs/{id}/validate

## Backlog / Next Phase (P1)
- Stripe escrow integration (real payments)
- Google OAuth via Emergent Auth (currently JWT only - user requested both)
- Real-time chat between client + specialist (WebSocket)
- Photo uploads for request evidence
- Full bilingual coverage on landing page (currently only nav)
- Mobile-responsive testing & fixes
- Property health degradation over time (cron job)

## P2 / Future
- IoT integration for live telemetry (HVAC, electric, plumbing)
- 3D model upload + LiDAR scanning workflow
- Sage Certified Audit external integration
- Dispute mediation system (admin)
- Maintenance log AR validation
- Mobile native apps (React Native)
