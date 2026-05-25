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

### Phase 10 — Email Service + Specialist Portfolio Gallery (15/15 tests ✅)
- **6 template-uri HTML brandate** (PropManage style, lime accent, serif, dark): `tpl_welcome`, `tpl_dispute_opened`, `tpl_dispute_resolved`, `tpl_design_phase_quote`, `tpl_specialist_verified`, `tpl_escrow_funded`
- **Fire-and-forget** via `asyncio.create_task` ca să nu blocheze API endpoint-urile
- **Emails wired** în: register (welcome), admin verify specialist, dispută deschisă/rezolvată, ofertă fază design, escrow alimentat
- **Specialist Portfolio Gallery**: specialiști încarcă proiecte (titlu, descriere, stil, categorie, locație, suprafață, cover_image + gallery până la 12 poze)
  - Public: `/specialists/{id}/portfolio` (no auth) afișat pe profilul public deasupra recenziilor
  - Privat: `/specialist/portfolio` CRUD complet — Add/Edit/Delete via PortfolioManagerModal cu PortfolioEditor (upload base64 + URL)
  - Lightbox cu navigare prev/next, info chips (locație, m², data finalizării)
  - Validări: max 30 items/specialist, 4MB cap pe imagine base64, ownership-scoped PUT/DELETE
  - Seed idempotent: 3 proiecte pre-populate (HVAC Pipera, baie industrială, bucătărie modernă)

### Phase 13 — Onboarding Cycle + Digital Twin Pipeline (23/23 tests ✅)
- **Empty-state CTA** "Începe cu prima ta proprietate" cu buton mare lime "Adaugă proprietate" — vizibil când clientul nu are imobile
- **Cycle Preview** (4 pași): Proprietate → Digital Twin → Servicii → Escrow & Tokens, cu indicator vizual de progres (done/current/pending/disabled)
- **Twin CTA inline** pe property card: "Activează Digital Twin gratuit" → "Solicită activare" buton; tranziție automată la "Twin în validare la operator" după click; "Retrimite spre validare" dacă status=needs_revision
- **Status pills** pentru twin: INACTIV / ⏳ ÎN VALIDARE / ⚠ NECESITĂ REVIZIE / LIVE 3D · ACTIVAT
- **Twin visualization** locked cu overlay "Twin neactivat" până la aprobare
- **Backend**: `GET /api/properties` enrich cu `twin_status` (join cu db.twins) — o singură query batched
- **E2E pipeline**: client → adaugă prop → cere twin → operator vede în Pending Tab → aprobă → notificare → client vede LIVE 3D + InteriorDesignCard devine activ

### Phase 12 — Referral Tracking + Web Push + Contact Form (14/14 tests ✅)
- **Referral tracking**: `?ref={userId}` în /register → `referrer_id` salvat pe user; la prima cerere confirmată → sponsor primește +500 tokeni + Digital Twin activat pe prima sa proprietate + tranzacție inregistrată; bonus single-use (`referral_bonus_paid`)
- **Endpoint nou**: `GET /api/auth/referral` (stats real: invitați + convertiți)
- **Web Push (VAPID)**: chei generate la setup, salvate în `.env`; endpoint-uri `GET /push/vapid-public-key`, `POST /push/subscribe`, `POST /push/unsubscribe`; service worker `/sw.js`; helper `/src/push.js`; integrare automată în `notify()` (fire-and-forget pe orice notificare nouă) + cleanup automatic 404/410 endpoints
- **Contact form backend**: `POST /api/support/contact` trimite email la admin + confirmare la user via Resend (cu fallback console)
- **UI**: Banner verde "Te-ai înregistrat prin invitație" pe register cu `?ref`; ReferralModal cu stats live; toggle Notificări push în Settings; ContactModal hits real endpoint
- **Dependențe noi**: pywebpush, py-vapid, http-ece

### Phase 11 — UX Zoning + Dual-Role Switcher + GDPR Settings (25/25 tests ✅)
- **4-Zone Bottom Navigation** per rol (mobile-first, inspirat HomeRun Pro):
  - Client: Solicită / Lucrările mele / Notificări / Setări
  - Specialist: Oportunități / Lucrările mele / Notificări / Setări (cu badge counts)
  - Admin: Sumar / Specialiști / Dispute / Setări
  - Operator: Digital Twins / Logs / Notificări / Setări
- **Dual-Role Switcher** (Specialist ↔ Client):
  - User doc primește `active_view` + `dual_role_enabled` (computed: specialist + verified)
  - `serialize_doc` auto-derivează flag-urile, `require_role` aware de dual-role
  - Endpoint `POST /api/auth/switch-view` (403 pentru non-specialist sau unverified)
  - `list_properties` + `list_requests` scope-uite prin `effective_role(user)` — în client view specialistul vede DOAR proprietățile/cererile sale
  - UI: card "Treci la profilul de client/profesionist" în Settings, badge "PROFIL ACTIV: CLIENT" în topbar când e activ
- **Settings Panel** unificat (shared între cele 4 roluri):
  - Profile edit (name, phone, zone, avatar base64) — `PATCH /api/auth/profile`
  - Change password (current + new + confirm) — `POST /api/auth/change-password`
  - Recomandă prietenilor (referral link copyable)
  - Centrul de suport (FAQ inline)
  - Contactează-ne (form trimitere)
  - **GDPR**: Export date JSON (`POST /api/auth/account-export` — Art. 20) + Delete account cu password + 'STERGE' confirmation (`POST /api/auth/account-delete` — Art. 17, anonymize)
- **Componente noi**: `BottomNav.jsx`, `SettingsPanel.jsx`; `DashLayout` acceptă prop `bottomNav` și se ocupă de route guard dual-role aware (redirect prin `active_view`).

## Test Results (Cumulative)
- Phase 2: 36/36 ✅
- Phase 3: 20/23 ✅
- Phase 4: 19/19 ✅
- Phase 5: 18/20 ✅
- Phase 6: 26/26 ✅
- Phase 7: 22/22 ✅
- Phase 8: 18/18 ✅
- Phase 9: 11/11 ✅
- Phase 10: 15/15 ✅
- Phase 11: 25/25 ✅ (Dual-Role + GDPR + 4-zone bottom nav)
- Phase 12: 14/14 ✅ (Referral + Web Push + Contact backend)
- Phase 13: 23/23 ✅ (Onboarding cycle + Twin pipeline)
- **TOTAL: 247/253 backend tests pass (97.6%)**

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
- `server.py` routers split: auth.py, admin.py, operator.py, payments.py, requests.py, marketplace.py, design.py, portfolio.py (monolith ~2870 lines, refactor postponed multiple times)
- Live API keys: RESEND_API_KEY (Resend) + STRIPE_API_KEY (Stripe) — code is fully programmed, awaiting user keys
- AI tools/function-calling for booking actions
- Contact form backend (currently UI-only)

### P2 (Future)
- Stripe Connect for direct specialist payouts
- IoT live telemetry integration
- LiDAR/3D scanning + real 3D viewer (replace 2D floorplan)
- React Native mobile apps
- Multi-tenant SaaS
- Pagination on AI history + Marketplace + Disputes lists
- CORS_ORIGINS lockdown (currently "*" with credentials)
