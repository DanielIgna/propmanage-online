# PropManage - Property Operating System (Full E2E)

## Original Problem Statement
Continuă: Google OAuth via Emergent, Stripe escrow real integration, Bilingual coverage extins pe landing, Real-time chat WebSocket între client și specialist.

## Architecture
- **Frontend**: React 19 + Tailwind + Framer Motion + react-router-dom + WebSocket native
- **Backend**: FastAPI + MongoDB (motor async) + JWT (httpOnly cookies) + bcrypt + Stripe + WebSocket + httpx (for Emergent OAuth)
- **4 user roles**: client, specialist, admin, operator
- **3 auth methods**: Email/password (JWT), Google OAuth (Emergent-managed), Demo quick-login

## What's Implemented

### Phase 1 (MVP)
- Landing page (10+ sections) with dark premium UI, Fraunces serif + Geist body, lime accent
- 10 product sections: Hero, Problem, Solution, User Journey, Specialist, Wallet, Digital Twin, Admin, Business, Value, Golden Path, CTA

### Phase 2 (Auth + Marketplace)
- JWT auth with 5 pre-seeded demo accounts
- 4 role-based dashboards: Client, Specialist, Admin, Operator
- Bilingual RO/EN toggle (persistent localStorage)
- Auto-play User Journey (3.5s/step with pause)
- Full marketplace flow: create request → accept (45 RON fee) → start → complete → confirm
- Escrow logic, token economy (+100/job, +20/review), property health scoring

### Phase 3 (Integrations + Real-time)
- ✅ **Google OAuth (Emergent-managed)**: Login button on /login, AuthCallback page at /auth/callback, backend session exchange endpoint
- ✅ **Stripe Escrow Checkout**: Real Stripe SDK integration with intelligent demo-mode fallback when STRIPE_API_KEY is placeholder
- ✅ **WebSocket real-time chat**: FastAPI WebSocket endpoint + ConnectionManager + persistent MongoDB storage + ACL by role/request assignment
- ✅ **Extended bilingual coverage**: Hero, Problem, Solution, CTA all translated RO/EN

## Files
- /app/backend/server.py (single file backend, ~700 lines)
- /app/backend/.env (JWT_SECRET, MONGO_URL, ADMIN credentials)
- /app/frontend/src/App.js (landing + router)
- /app/frontend/src/auth.js (AuthContext with OAuth callback skip)
- /app/frontend/src/i18n.js (RO/EN translations)
- /app/frontend/src/pages/Auth.jsx (Login + Register + Google button)
- /app/frontend/src/pages/AuthCallback.jsx (Emergent OAuth handler)
- /app/frontend/src/pages/Dashboards.jsx (4 role dashboards)
- /app/frontend/src/pages/ChatPanel.jsx (WebSocket chat modal)
- /app/memory/test_credentials.md (demo accounts)

## Test Results
- Phase 2 (Backend): 36/36 passed ✅
- Phase 3 (Backend): 20/23 passed ✅ (Stripe real-key test fails as expected with placeholder; WebSocket auth + chat persistence + Google OAuth + regression all pass)

## Demo Accounts
Same as test_credentials.md - 5 pre-seeded accounts (client, 2× specialist, admin, operator).

## How to Test Each Feature

### Bilingual
1. Visit `/`, click Languages button (top-right nav)
2. Verify Hero, Problem, Solution, CTA all switch RO↔EN
3. Login → dashboard nav stays in selected language

### Google OAuth
1. Visit `/login`, click "Continuă cu Google"
2. Redirected to Emergent OAuth
3. After consent, lands at /auth/callback with session_id in URL fragment
4. Frontend POSTs to /api/auth/google/session, backend creates/updates user, sets JWT cookies
5. Auto-redirects to /client (default role)

### Stripe Escrow (Demo Mode)
1. Login as client, find an assigned request
2. Click "Plătește" button
3. Demo mode: instantly returns success URL, marks request escrow=held
4. With real Stripe key (sk_test_xxx in .env), would redirect to actual Stripe Checkout

### WebSocket Chat
1. Login as client, click chat icon on an in-progress request
2. Type message, press Enter or Send
3. Modal shows "Conectat" indicator, system join message, own messages in lime bubbles
4. Open another browser as specialist@propmanage.io → see messages in real-time

## P1 / Next Phase
- Photo upload for request evidence (multipart)
- Push notifications
- Email notifications (SendGrid)
- Property listing CRUD for clients with multiple properties
- Specialist profile pages (public)
- Reviews UI flow

## P2 / Future
- Stripe Connect for direct payouts to specialist bank accounts
- IoT live telemetry integration
- LiDAR/3D scanning workflow
- Mobile native apps (React Native)
- AI matching algorithm for specialists
