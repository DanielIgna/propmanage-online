# PropManage - Property Operating System (Full E2E)

## Original Problem Statement
Build a comprehensive Property Operating System "PropManage" - a Romanian-first SaaS connecting property owners (Clients) with verified Specialists, with Admin oversight, Operator-validated Digital Twins, escrow payments, tokenomics, real-time chat, and AI assistance.

## Architecture
- **Frontend**: React 19 + Tailwind + Framer Motion + react-router-dom + WebSocket + Lucide icons
- **Backend**: FastAPI + MongoDB + JWT cookies + bcrypt + Stripe (mocked) + WebSocket + httpx + emergentintegrations (Claude) + pyotp + qrcode
- **4 user roles**: client, specialist, admin, operator
- **3 auth methods**: Email/password (JWT), Google OAuth (Emergent), Demo quick-login + optional **2FA TOTP**

## What's Implemented

### Phase 1-4 (recap)
1. Landing 10-section premium UI bilingual RO/EN with auto-play User Journey
2. JWT auth + 6 demo accounts + 4 role dashboards
3. Full marketplace flow: lead fee 45 RON, escrow 95/5 split, tokens economy
4. Google OAuth (Emergent) + Stripe Checkout (with demo-mode) + WebSocket chat
5. Photo upload (base64), Reviews UI, SendGrid (fallback), Specialist profiles public, Property CRUD multi-property, Notifications bell

### Phase 5
1. ✅ **AI Assistant** (Claude Haiku 4.5 via Emergent LLM key) — floating chatbot, role-aware
2. ✅ **2FA TOTP** — full lifecycle with QR codes
3. ✅ **Public Marketplace** at `/marketplace`
4. ✅ **Search & Filters** on requests
5. ✅ **Property Timeline**
6. ✅ **Mobile responsive polish**

### Phase 6 (NEW - Feb 2026) — 26/26 backend tests ✅
1. ✅ **Admin Dashboard with tabs (Sumar / Specialiști / Dispute)** with stat pills and quick-action cards
2. ✅ **Specialist Document Validation Workflow**
   - Specialist uploads documents (id_card, certification, insurance, company_cui, other) up to 4MB each, max 20 per user
   - Admin reviews via `SpecialistDetailModal`: per-document approve/reject with reason; specialist verify/reject as a whole
   - Pending demo account `pending@propmanage.io` seeded with 3 sample docs
3. ✅ **Full Dispute Workflow (Mediation)**
   - Client OR assigned specialist opens dispute on `assigned/in_progress/completed` jobs (escrow frozen automatically)
   - Evidence photos (up to 5 base64 images) attached
   - Admin resolves with 3 modes: `refund_client`, `pay_specialist` (−5% platform fee), `split` (slider 0-100% with live preview)
   - Wallet credits + transaction records + auto-confirm request + notifications to both parties
   - Race protection: cannot open dispute on `released` escrow; cannot resolve twice
4. ✅ **Operator Digital Twin Workflow**
   - 2D floorplan editor in `TwinEditorModal` with grid background
   - Drag-and-drop rooms (9 types: living/bedroom/kitchen/bathroom/hallway/balcony/office/storage/other) and assets (9 types: hvac/boiler/electric_panel/water_meter/gas_meter/appliance/lighting/plumbing/other)
   - Live sidebar: select item → edit name/type/area/dimensions/condition
   - Operator tabs: Digital Twins (pending + history) + Logs mentenanță
   - Footer actions: `Aprobă twin` (sets property.twin_unlocked=true, structure_health=95) or `Cere revizie` with notes
   - Seeded demo: Skyline Loft A4 has pending_validation twin with 5 rooms + 3 assets
5. ✅ **Client/Specialist Dispute Button** on active job cards (+ "Dispută în analiză" badge when frozen)
6. ✅ **Specialist Verify Banner** on dashboard when not yet verified — CTA "Încarcă documente" opens upload modal

## Files (Final Structure)
**Backend**:
- /app/backend/server.py (~2255 lines — monolithic, refactor candidate)
- /app/backend/.env (JWT_SECRET, MONGO_URL, EMERGENT_LLM_KEY, STRIPE_API_KEY)
- /app/backend/tests/ (test_phase5.py, test_phase6.py)

**Frontend**:
- /app/frontend/src/App.js (Landing + Router)
- /app/frontend/src/auth.js, i18n.js
- /app/frontend/src/pages/
  - Auth.jsx, AuthCallback.jsx
  - Dashboards.jsx (~860 lines — 4 dashboards, refactor candidate)
  - Components.jsx (PhotoUploader, ReviewModal, PropertyManagerModal)
  - ChatPanel.jsx, SpecialistProfile.jsx, Marketplace.jsx, AIAssistant.jsx
  - **AdminModals.jsx** (NEW) — SpecialistDetailModal, DisputeResolveModal, OpenDisputeModal, SpecialistDocumentsModal
  - **OperatorTwin.jsx** (NEW) — TwinEditorModal with 2D floorplan editor

## Test Results
- Phase 2: 36/36 ✅
- Phase 3: 20/23 ✅
- Phase 4: 19/19 ✅
- Phase 5: 18/20 ✅
- Phase 6: 26/26 ✅ (iteration_4.json) — Admin workflow + Operator Digital Twin all green
- **TOTAL: 119/124 backend tests pass (96%)**

## API Endpoints (Complete - 50+)
**Auth**: POST /api/auth/{login, register, logout, google/session}, GET /api/auth/{me, ws-token}
**2FA**: POST /api/auth/2fa/{setup, verify, disable}, GET /api/auth/2fa/status
**Properties**: GET/POST /api/properties, GET/PUT/DELETE /api/properties/{id}, GET /api/properties/{id}/timeline, POST /api/properties/{id}/twin/request
**Requests**: GET/POST /api/requests, POST /api/requests/{id}/{accept,start,complete,confirm,escrow,review,dispute}, GET /api/requests/{id}/dispute
**Marketplace**: GET /api/marketplace/specialists, GET /api/specialists/{id}/profile
**Payments**: POST /api/payments/checkout-session, GET /api/payments/status/{id} (Stripe MOCKED)
**AI**: POST /api/ai/chat, GET /api/ai/history (Claude Haiku 4.5)
**Admin**: GET /api/admin/{stats, specialists/pending, disputes, specialists/{id}}, POST /api/admin/specialists/{id}/{verify,reject}, POST /api/admin/specialists/{id}/documents/{doc_id}/review, POST /api/admin/disputes/{id}/resolve
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
| Specialist (Electric, PENDING) | pending@propmanage.io | Spec123! |
| Admin | admin@propmanage.io | Admin123! |
| Operator | operator@propmanage.io | Op123! |

## Mocked / Awaiting Keys
- **Stripe Escrow** — currently mocked via fallback URL. Needs real `STRIPE_API_KEY` in env to switch to live mode.
- **SendGrid** — emails print to console. Needs `SENDGRID_API_KEY` for production dispatch.

## P1 / Next Phase
- Replace Stripe mock with real integration (when key available)
- Replace SendGrid mock with real email dispatch
- Refactor `server.py` (2255 lines) into feature routers: `auth.py`, `admin.py`, `operator.py`, `payments.py`, etc.
- Refactor `Dashboards.jsx` (~860 lines) into per-role files: `ClientDashboard.jsx`, `SpecialistDashboard.jsx`, etc.
- Rate limiting on `/auth/login` (brute force)
- N+1 query optimization on `/admin/disputes` and `/operator/twins` (batch user lookup)

## P2 / Future
- Stripe Connect for direct specialist payouts
- IoT live telemetry integration
- LiDAR/3D scanning + real 3D viewer (replace 2D floorplan)
- React Native mobile apps
- Multi-tenant SaaS
- HTML email templates with branding
- AI tools/function-calling for booking actions
- Pagination on AI history + Marketplace + Disputes lists
- CORS_ORIGINS lockdown (currently "*" with credentials)
