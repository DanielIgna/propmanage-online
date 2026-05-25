# PropManage - Property Operating System (Full E2E)

## Original Problem Statement
Build a comprehensive Property Operating System "PropManage" - a Romanian-first SaaS connecting property owners (Clients) with verified Specialists, with Admin oversight, Operator-validated Digital Twins, escrow payments, tokenomics, real-time chat, and AI assistance.

## Architecture
- **Frontend**: React 19 + Tailwind + Framer Motion + react-router-dom + WebSocket + Lucide icons + Recharts
- **Backend**: FastAPI + MongoDB + JWT cookies + bcrypt + Stripe (via emergentintegrations) + WebSocket + httpx + emergentintegrations (Claude) + pyotp + qrcode
- **4 user roles**: client, specialist, admin, operator
- **Auth**: Email/password (JWT), Google OAuth (Emergent), Demo quick-login + 2FA TOTP + rate limiting

## Implementation Phases

### Phase 1-4 (recap)
- Landing 10-section premium UI bilingual RO/EN with auto-play User Journey
- JWT auth + 6 demo accounts + 4 role dashboards
- Marketplace flow: lead fee 45 RON, escrow 95/5 split, tokens economy
- Google OAuth (Emergent) + Stripe Checkout + WebSocket chat
- Photo upload, Reviews UI, SendGrid (fallback), Specialist profiles, Property CRUD, Notifications bell

### Phase 5
- AI Assistant (Claude Haiku 4.5 via Emergent LLM key), 2FA TOTP, Public Marketplace, Search/Filters, Property Timeline, Mobile responsive

### Phase 6 — Admin Workflow + Operator Digital Twin (26/26 tests ✅)
- Admin Dashboard with tabs (Sumar / Specialiști / Dispute)
- Specialist Document Validation (upload, review per-doc, approve/reject specialist)
- Full Dispute Workflow with 3 resolution modes (refund_client / pay_specialist / split with slider)
- Operator Digital Twin 2D floorplan editor (rooms + assets drag&drop, validate/revise)

### Phase 7 — Analytics + Specialty Registration + Real Stripe + Rate Limit (22/22 tests ✅)
- **Admin Live Analytics** tab with recharts (Area/Pie/Bar) + KPIs (GMV, platform revenue, avg job value, disputes) + Top specialists leaderboard
- **Specialist registration with multi-specialty + multi-zone**: 10 specialty buttons (HVAC, Electric, Sanitar, Design Interior, Tâmplărie, Zugrăveli, Curățenie, Reparații electrocasnice, Grădinărit, Alte servicii) + 13 zones
- **Stripe Checkout via emergentintegrations**: db.payment_transactions, /api/webhook/stripe handler, polling via /payments/status; demo mode active while STRIPE_API_KEY=sk_test_emergent
- **Rate limiting** on /auth/login: 8 attempts per 60s, IP-based, Romanian message

### Phase 8 — Refactor + N+1 Optimization (18/18 tests ✅)
- **Refactored monolithic Dashboards.jsx** (921 lines) → 5 focused files:
  - `DashShared.jsx` (166 lines) - API constant, DashLayout, Stat, StatusBadge, NotificationsBell
  - `ClientDashboard.jsx` (337 lines)
  - `SpecialistDashboard.jsx` (132 lines)
  - `AdminDashboard.jsx` (177 lines)
  - `OperatorDashboard.jsx` (114 lines)
  - `Dashboards.jsx` (5-line re-export barrel for backward compat)
- **N+1 optimization** with asyncio.gather + batch lookups + single aggregation pipelines:
  - `/admin/analytics` now < 200ms (was ~1-2s)
  - `/admin/disputes`: batched req + user lookups
  - `/operator/twins`: batched property + owner lookups
- **Lead fees windowed** by date range
- **service_categories validation** against ALLOWED_SPECIALTIES set + non-empty required for specialists
- **Rate limiter** only counts failed attempts (successful logins don't deplete the budget)

## Files (Final Structure)
**Backend** (`/app/backend/`):
- `server.py` (~2475 lines — refactor candidate for Phase 9)
- `.env` (JWT_SECRET, MONGO_URL, EMERGENT_LLM_KEY, STRIPE_API_KEY)
- `tests/` (test_phase5.py, test_phase6.py, test_phase7.py, test_phase8.py)

**Frontend** (`/app/frontend/src/pages/`):
- `Auth.jsx` (369 lines, w/ specialty + zone selection)
- `AuthCallback.jsx`, `Premium.jsx`, `Marketplace.jsx`, `SpecialistProfile.jsx`
- `Components.jsx` (PhotoUploader, ReviewModal, PropertyManagerModal)
- `ChatPanel.jsx`, `AIAssistant.jsx`
- **Dashboards** (new structure):
  - `Dashboards.jsx` (barrel)
  - `DashShared.jsx` (Layout + Stat + StatusBadge + NotificationsBell)
  - `ClientDashboard.jsx`, `SpecialistDashboard.jsx`, `AdminDashboard.jsx`, `OperatorDashboard.jsx`
- **Modals**: `AdminModals.jsx` (547 lines - SpecialistDetailModal, DisputeResolveModal, OpenDisputeModal, SpecialistDocumentsModal)
- **Specialized features**: `OperatorTwin.jsx` (427 lines - 2D floorplan editor), `AdminAnalytics.jsx` (201 lines - recharts dashboard)

### Phase 9 — Interior Design Premium Service (11/11 tests ✅)
- **Eligibility-gated**: doar clienții cu proprietate `twin_unlocked=true` + twin `status=approved` au acces
- **Pricing model server-enforced**: 2200 RON / cameră (1 zi lucrătoare = 8h), valabil pe orice tip de cameră
- **Token discount slider**: 1 token = 1 RON, max 50% din preț (cap server-side ca nu se poate eluda)
- **Workflow**:
  1. Client deschide modal → vede camerele din twin → selectează → alege stil (8 opțiuni) → slider tokeni → plasează cerere
  2. Cererea apare pentru specialiști cu `service_categories` conținând `interior_design`
  3. Specialist acceptă lead (45 RON) → flow normal accept/start/complete
  4. După concept livrat, specialist propune faze ulterioare (phase-quote) cu nume, descriere, preț, zile
  5. Client acceptă oferta → deducere din wallet (escrow logic), apoi complete → 95% către specialist, 5% platformă
- **Endpoints noi**: `/design/eligibility`, `/design/concept-request`, `/design/phase-quote`, `/design/phase-accept`, `/design/phase-complete`
- **Frontend**: `InteriorDesign.jsx` cu `InteriorDesignCard` (gated CTA pe dashboard client), `InteriorDesignModal` (ordering), `DesignPhasesPanel` (vizualizare faze), `ProposePhaseModal` (specialist)
- **Cleanup**: vechile endpoints `/services/interior-design/*` și `Premium.jsx` dead code → șterse

## Test Results (Cumulative)
- Phase 2: 36/36 ✅
- Phase 3: 20/23 ✅
- Phase 4: 19/19 ✅
- Phase 5: 18/20 ✅
- Phase 6: 26/26 ✅
- Phase 7: 22/22 ✅
- Phase 8: 18/18 ✅
- Phase 9: 11/11 ✅
- **TOTAL: 170/175 backend tests pass (97%)**

## API Endpoints (60+)
**Auth**: POST /api/auth/{login, register, logout, google/session}, GET /api/auth/{me, ws-token}
**2FA**: POST /api/auth/2fa/{setup, verify, disable}, GET /api/auth/2fa/status
**Properties**: GET/POST /api/properties, GET/PUT/DELETE /api/properties/{id}, GET /api/properties/{id}/timeline, POST /api/properties/{id}/twin/request
**Requests**: GET/POST /api/requests, POST /api/requests/{id}/{accept,start,complete,confirm,escrow,review,dispute}, GET /api/requests/{id}/dispute
**Marketplace**: GET /api/marketplace/specialists, GET /api/specialists/{id}/profile
**Payments**: POST /api/payments/checkout-session, GET /api/payments/status/{id}, POST /api/webhook/stripe (Stripe via emergentintegrations, DEMO mode while sk_test_emergent)
**AI**: POST /api/ai/chat, GET /api/ai/history (Claude Haiku 4.5)
**Admin**: GET /api/admin/{stats, analytics, specialists/pending, disputes, specialists/{id}}, POST /api/admin/specialists/{id}/{verify,reject}, POST /api/admin/specialists/{id}/documents/{doc_id}/review, POST /api/admin/disputes/{id}/resolve
**Specialist Docs**: GET/POST/DELETE /api/specialist/documents
**Operator**: GET /api/operator/{queue,twins}, GET /api/operator/twins/{prop_id}, POST /api/operator/twins/{prop_id}, POST /api/operator/twins/{prop_id}/validate, POST /api/operator/logs/{id}/validate
**Chat**: GET /api/chat/{request_id}/messages, WS /api/ws/chat/{request_id}
**Notifications**: GET /api/notifications, POST /api/notifications/{id}/read
**Wallet**: GET /api/transactions, POST /api/wallet/topup

## Demo Accounts (idempotent seed)
| Role | Email | Password |
|------|-------|----------|
| Client | client@propmanage.io | Client123! |
| Specialist (HVAC, verified) | specialist@propmanage.io | Spec123! |
| Specialist (Plumbing, verified) | specialist2@propmanage.io | Spec123! |
| Specialist (Electric, PENDING + docs) | pending@propmanage.io | Spec123! |
| Admin | admin@propmanage.io | Admin123! |
| Operator | operator@propmanage.io | Op123! |

## Mocked / Awaiting Real Keys
- **Stripe Checkout** — emergentintegrations integrated. DEMO mode active while `STRIPE_API_KEY=sk_test_emergent` placeholder. Swap to real `sk_test_*` or `sk_live_*` to enable real Stripe + webhook signature verification.
- **SendGrid** — emails print to console. Needs `SENDGRID_API_KEY` for production dispatch.

## Roadmap
### P1 (Next)
- SendGrid real email dispatch (needs API key)
- server.py routers split: auth.py, admin.py, operator.py, payments.py, requests.py, marketplace.py
- HTML email templates with branding
- AI tools/function-calling for booking actions

### P2 (Future)
- Stripe Connect for direct specialist payouts
- IoT live telemetry integration
- LiDAR/3D scanning + real 3D viewer (replace 2D floorplan)
- React Native mobile apps
- Multi-tenant SaaS
- Pagination on AI history + Marketplace + Disputes lists
- CORS_ORIGINS lockdown (currently "*" with credentials)
