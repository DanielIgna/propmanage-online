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

### Phase 16 — Daily Digest Emails @ 19:00 Europe/Bucharest (43/43 tests ✅)
- **APScheduler** cu `CronTrigger(hour=19, minute=0, tz=Europe/Bucharest)` (gestionează automat EET/EEST)
- **4 digest builders** personalizate per rol:
  - **Client**: lucrări active + cereri deschise + count notificări necitite/24h
  - **Specialist**: lead-uri noi 24h matching specialty + lucrări active + wallet/tier
  - **Admin**: dispute deschise + sesizări operator + specialiști pending + evenimente platformă 24h
  - **Operator**: twins pending_validation + needs_revision
- **Skip inteligent**: dacă nu există conținut relevant, NU se trimite email (counts.skipped++)
- **Opt-out per user** (`digest_disabled` flag) — toggle în Settings → "Rezumat zilnic: ACTIV/OFF"
- **Preview endpoint**: `POST /api/auth/digest/preview` — user vede ce ar primi astăzi
- **Admin manual trigger**: `POST /api/admin/digest/trigger` (testing/forced send)
- **HTML branded email**: dark theme cu accent #d4ff3a, card-uri secționate, CTA button, footer cu instrucțiuni unsubscribe
- **Integrare Web Push**: digest trimite + push notification (fire-and-forget)
- **Dependențe noi**: apscheduler, pytz, tzlocal

### Phase 15 — LastActionBanner pe request cards (30/30 tests ✅)
- **Status Banner** pe fiecare card cerere (Client + Specialist) — afișează ultima acțiune cu: dot colorat per rol, actor_name, label român, extras inline (programare/sumă), time-ago ("acum 11m")
- **Backend**: `GET /api/requests` enrich cu `last_event` (aggregation Mongo batched per request_id) — performanță O(1) query extra per listă
- Click pe banner → deschide RequestTimelineModal
- 12 event types mappate în ACTION_LABELS (română): "a creat solicitarea", "a acceptat", "a confirmat & eliberat plata" etc.
- Detectare automată payload: schedule_proposal → afișează (data start → end · ore); escrow.paid → afișează suma RON

### Phase 14 — Activity Timeline + Cross-Role Visibility (43/43 tests ✅)
- **Unified Activity Timeline** vizibil pe fiecare cerere — RBAC: client/specialist al cererii + admin + operator care a validat twin-ul
- **12 event types** instrumentate cu `log_event()`: request.created, request.accepted, work.started, work.completed, work.confirmed, escrow.paid, twin.requested, twin.validated, dispute.opened, dispute.resolved, operator.flagged_nonconformity, admin.resolved_nonconformity
- **Admin Activity Stream** live feed pe tab Sumar — auto-refresh 15s, badge-uri colorate per rol (CL/SP/AD/OP), click → deschide Timeline-ul cererii
- **Schedule Proposal Modal** — specialistul propune data start/end + ore estimate + mesaj la acceptarea unei oportunități (înlocuiește accept direct); payload-ul vizibil ca block special în timeline
- **Operator Non-Conformity Flag** — operator flag-uiește twin-uri/cereri/proprietăți (severity: low/medium/high); notifică automat toți admin-ii
- **Admin Nonconformity Resolution** — admin vede sesizările în tab Dispute, le rezolvă cu un mesaj; operatorul primește notificare back
- **Endpoint-uri noi**:
  - `GET /api/requests/{id}/timeline` (RBAC strictă)
  - `GET /api/admin/activity-stream?limit=&event_type=&actor_role=&since=`
  - `POST /api/operator/flag-nonconformity`
  - `GET /api/admin/nonconformities`
  - `POST /api/admin/nonconformities/{id}/resolve`
- **Modificat**: `POST /api/requests/{id}/accept` acceptă body opțional cu `proposed_start_date/end_date/estimated_hours/note` (backward compatible)

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
- Phase 14: 43/43 ✅ (Activity Timeline + Cross-role visibility + Nonconformity)
- Phase 15: 30/30 ✅ (LastActionBanner pe request cards)
- Phase 16: 43/43 ✅ (Daily digest emails @ 19:00 Europe/Bucharest)
- **TOTAL: 363/369 backend tests pass (98.4%)**
- Phase 17 (Hotfix): Mobile bottom-nav visibility fix — Emergent preview badge relocated from bottom-right to top-right via CSS override on screens ≤1023px, freeing tabs 3-4 (Notificări/Setări) to be visible AND clickable (26 Feb 2026)
- Phase 18 (Refactor — Phase A): server.py monolith reduced 3518 → 2758 lines (-22%). Extracted 7 modules: db.py (12 lines), core_utils.py (67), deps.py (44), services.py (139, email+push+notify+log), models.py (194, all Pydantic), seed.py (234), digest.py (189). Zero regressions on Phase 11+16 critical tests (38/38 pass). Server.py still hosts 96 endpoints — Phase B will split into per-role routers. (26 Feb 2026)
- Phase 19 (Refactor — Phase B): server.py reduced 2758 → **91 lines (-97% from original 3518)**. Extracted **22 modular routers** in `/app/backend/routes/`: auth (487), requests (414), design (252), payments (248), admin (243), operator_twins (181), disputes (172), chat (141 incl. WebSocket), portfolio (117), operator/nonconformity (115), ai (109), matching (97), properties (93), property_timeline (79), specialist_profile (72), services_avail (68), regions (65), marketplace (62), specialist_docs (60), wallet (46), notifications (42), root (28). server.py now contains ONLY app setup + CORS + scheduler + lifecycle hooks. Zero regressions on 48/48 Phase 11+15+16 critical tests. All 96 endpoints + WebSocket verified working via curl (root, login, properties, requests, admin/stats, admin/analytics, admin/activity-stream, operator/twins, AI history, marketplace). (26 Feb 2026)
- Phase 20 (Digital Twin + Designers connection): (a) Seed self-heals demo Twin to `status:approved` so client demo unlocks Interior Design flow + Twin Viewer; (b) Added `GET /api/properties/{id}/twin` for read-only owner access; (c) Marketplace `/api/marketplace/specialists?category=X` now matches both primary `specialty` AND `service_categories` (multi-spec); (d) Frontend: new `ClientTwinViewer.jsx` with `ClientTwinViewerModal` (SVG layout + rooms/assets list) and `DesignersBrowse` inline panel. Client dashboard now shows: header button `Deschide Twin 3D`, prominent gradient CTA `Digital Twin activ · Vezi modelul 3D`, and `Designerii noștri` section listing 2 verified interior designers (Mihai Ionescu HVAC+ID 4.9⭐, Mihai Test Update PLUMBING+ID 4.9⭐) with `Vezi profilul` link → opens Interior Design ordering modal. (26 Feb 2026)
- Phase 21 (Designer filters + Profile navigation): (a) New endpoint `GET /api/marketplace/filters?category=X` returns available zones + portfolio styles for filter dropdowns scoped by category; (b) `/api/marketplace/specialists` now accepts `zone` and `style` filters (style cross-references portfolio table); (c) Frontend `DesignersBrowse` redesigned: 2 buttons per card — `Vezi profil` (navigates to `/specialists/:id` with full profile + portfolio gallery) and `Solicită` (opens Interior Design modal); (d) Collapsible filter panel with zone chips (Bucuresti-Sector1/2) + style chips (scandinavian, etc.) + active filter badge `FILTRE · N` + `Resetează filtrele` action; (e) Verified live: zone filter, style filter, navigation to `/specialists/{id}` profile page with portfolio gallery, all working with zero regressions (38/38 critical tests pass). (26 Feb 2026)
- Phase 22 (Designer-as-PM + Project workspace ClickUp-style + Quick services): (a) **Backend** — 5 new interior specialties added (`parchet`, `zugravit`, `faianta`, `handyman`, `gips_carton`); new router `routes/projects.py` with full CRUD: `POST /api/projects` (designer creates), `GET /api/projects` (list by membership), `GET /api/projects/{id}` (detail + tasks_count), `PATCH /api/projects/{id}`, `POST /api/projects/{id}/members` (designer adds specialists/client), `DELETE /api/projects/{id}/members/{uid}`, `GET/POST /api/projects/{id}/tasks`, `PATCH /api/tasks/{id}` (assignee can change status, designer can edit all), `GET/POST /api/tasks/{id}/comments` (every member can comment); permissions enforced via `_load_project_or_403` helper. (b) **Frontend ClientDashboard** — new `QuickServicesGrid` with 6 category buttons (Design Interior + 5 interior finishing) with **Twin-gated** Design Interior showing inline message "Activează Digital Twin mai întâi" + CTA to request twin; NewRequestModal now accepts `initialCategory` and offers all new categories. (c) **Frontend ProjectWorkspace.jsx** (new) — full ClickUp-style page at `/projects/:id`: 3 tabs (Task-uri/Echipa/Activitate), Kanban board with 4 status columns (todo/in_progress/review/done), task detail modal with comments + status change actions, members list with avatar+specialty, NewTaskModal with assignee + priority + due_date, AddMemberModal with marketplace specialist picker filtered to non-members. (d) **Specialist Dashboard** — "Proiect nou coordonare" button (gradient purple, visible for designers only) + `ProjectListSection` showing coordinated projects. (e) **End-to-end verified live** via Playwright: designer created project → added specialist member → created task → specialist marked done → client viewed project list → opened workspace → opened task modal → saw client's comment. (f) `ProjectListSection` integrated in BOTH Client dashboard ("Proiectele tale de amenajare") and Specialist dashboard (designer view). Zero regressions: 38/38 critical pytest. (26 Feb 2026)
- Phase 23 (Milestone escrow 4×25% + Drag&drop + Attachments + Timeline): (a) **Backend** — Added 11 new endpoints to `routes/projects.py` (635 lines total): `POST /projects/{id}/milestones/init` (designer sets total_budget, auto-creates 4×25% tranches with default names "Avans la semnare", "Începere lucrare", "Lucrare 75% finalizată", "Finalizare + garanție"), `GET /projects/{id}/milestones`, `POST /projects/{id}/milestones/{mid}/fund` (client pays from wallet → escrow, sequential funding enforced), `POST /projects/{id}/milestones/{mid}/release` (designer splits to specialists equally; FINAL tranche enters `warranty_hold` for 30 days), `POST /projects/{id}/milestones/{mid}/warranty-claim` (client raises issue, freezes release), `POST /projects/{id}/milestones/{mid}/warranty-resolve` (designer/client closes claim → final release + project status="completed"), `POST/DELETE /tasks/{id}/attachments` (photo upload base64 max 2.5MB, only uploader or designer can delete). New cron job `auto_release_warranty_holds` runs daily @ 06:00 Europe/Bucharest. (b) **Frontend ProjectWorkspace.jsx** (1030 lines total): 2 new tabs `Plăți` and `Timeline`, **HTML5 drag&drop** on TasksBoard (move cards between status columns), **Task attachments** with file picker + thumbnail grid in TaskDetailModal, **Milestones cards** with state-aware UI (pending_funding/funded/released/warranty_hold/warranty_released), `Plătește XXXX RON` CTA for client, `Eliberează` for designer, `Raportează problemă` warranty claim modal, **30-day countdown** display "Eliberare automată în N zile (fără reclamații)", **Project progress bar** with 4 colored segments, **TimelineTab** with horizontal bar chart (start→due_date per task, color-coded by status, click → task detail). (c) **E2E verified live via curl + Playwright**: init milestones (12000 RON → 4×3000), fund T1, release T1 (specialist credited), fund T2, release T2, fund T3, release T3, fund T4, release T4 → warranty_hold (release_at = +30 zile), warranty-claim with reason → dispute_open=true, warranty-resolve → final release + project completed. UI screenshots: init modal with preview, payment cards per role, client sees "Plătește 3000 RON" CTA, designer sees "Eliberează" CTA, warranty timer + claim button. (d) Zero regressions: 38/38 critical pytest (Phase 11 + Phase 16). (26 Feb 2026)
- Phase 24 (Trust Score + Coverage Scope + Maps + RO zones): (a) **Backend** — New `routes/trust.py` with `GET /api/specialists/{id}/trust-score` (public, dynamic calculation from 4 factors: on-time delivery 40%, positive feedback 20%, progress photos 15%, warranty clean 25%; returns score 0-100 + level: exemplary/excellent/good/improving/new + detailed breakdown); `POST /api/specialists/coverage-scope` (specialist sets local/regional/national + zones + response_time_minutes 15-1440, capped at 'regional' for non-designers); `GET /api/regions/grouped` (returns regions grouped by city). New `romania_zones.py` constant with 184+ zones across 22 Romanian cities (București 27 sectoare+cartiere, Cluj 14, Timișoara 13, etc.). Seed auto-populates regions on boot. (b) **Frontend** — `TrustScoreCard` component in `SpecialistProfile.jsx` showing score + level badge + 4 factor cards (livrare la timp, recenzii, fotografii, lipsa reclamațiilor) with progress bars per factor; `NavigateButtons` component in `DashShared.jsx` rendering Google Maps + Waze deep links (compact + full variants), integrated on Client property card AND Specialist job cards (request.property_address now exposed by `/api/requests`); `CoverageModal` in SettingsPanel with: 3-button scope chooser (Local/Regional/Național — National locked for non-designers with Lock icon), response time slider 15-240 min with "(urgent)" label at 15min, cascading expandable city dropdown with all 22 cities + chip-based zone picker, search box across all zones, "Resetează" + count badge. New row `Aria de acoperire` visible only for `role=specialist` in Settings showing current state. (c) **E2E verified**: Mihai Ionescu trust score = 59/100 "În progres" with 33 tasks (41.7% on-time, 20/40 pts), rating 4.9 (19/20 pts), 0 photos (7.5/15 pts), zero disputes (12.5/25 pts); Coverage modal opens with all 22 cities visible (Arad 7 zone, Brașov 10, București 27 etc.), national button enabled for designer, NavigateButtons render on property card and job cards. Zero regressions: 38/38 pytest. (26 Feb 2026)
- **Phase 25 (Metronic-style Admin Console + CMS Lite + Platform Settings) — 24/24 tests ✅ (Feb 2026)**: Replaces old AdminDashboard entirely with a full Metronic-inspired admin panel. **Backend**: new `routes/admin_console.py` (640+ lines, prefix `/api/admin`) with 24 endpoints: CMS CRUD (`GET/PUT /cms`, `DELETE /cms/{key}`, public `/cms/public` no-auth), Email Templates CRUD (welcome, dispute_opened/resolved, escrow_funded, specialist_verified — editable subject + HTML with `{{name}}` placeholders), Zones management (add custom, toggle disable seed, delete custom, case-insensitive duplicate check), Trust Weights editor (validates sum=1.0), Platform Settings (Stripe LIVE flag, Resend LIVE flag, commission %, lead fee, primary color, logo text, support email, maintenance mode), Users unified management (paginated list + filter by role/q/verified/banned, PATCH edit, ban/unban with InvalidId→400), Global Search (across users/requests/projects), Finance Overview (total wallet, escrow held, top 10 wallets, tx-by-type 30d), Projects list, CSV exports (users.csv, transactions.csv, disputes.csv), Live Activity Feed. New MongoDB collections: `cms_content`, `email_templates`, `zones_custom`, `zones_disabled`, `platform_config`. **Frontend**: 8 modular files in `/app/frontend/src/pages/admin/` (~1200 lines). Light/dark theme persists in `pm_admin_theme` localStorage; sidebar collapsible on mobile. Old `AdminDashboard.jsx` (bottom-nav) **eliminated**.
- **Phase 26 (CMS Live on Landing + Promo Banner + A/B Testing) — Feb 2026**: (a) **CMS Live**: `I18nProvider` extins să încarce `/api/cms/public` (no-auth) la mount; `t()` returns CMS override > i18n RO > fallback. Backend `DEFAULT_CMS` aliniat cu i18n RO. Editări instant pe landing (verificat E2E). (b) **Promo Banner**: nouă cheie `landing.promo_banner` (default gol → ascuns); banner gradient lime în top, dismissable cu X (sessionStorage `pm_promo_dismissed`), auto-spacing `pt-9 sm:pt-10` când vizibil. (c) **A/B Testing**: experiment `hero_cta1` cu 2 variante editabile (`hero.cta1.variant_a` / `.variant_b`). Hook `useABTest()` în `/app/frontend/src/ab.js`: random 50/50 cu `localStorage` persistence + auto impression track + click track. Backend: `POST /api/ab/track` (public, dedup impressions per session), `GET /api/admin/ab/stats` (admin, returns CTR + winner detection ≥30 impressions), `DELETE /api/admin/ab/{exp}/reset`. Admin UI nouă `AdminABTests.jsx` cu inline editors + stats live + trophy badge câștigător.
- **Phase 27 (P1 Stripe Wallet Topup + P2 Milestone Renegotiation + P2 First-Login Tutorial) — Feb 2026 — 14/14 backend tests ✅**: **(a) P1 Stripe Checkout (hybrid mode)**: backend `routes/wallet.py` — `POST /api/wallet/topup-checkout-session` (creates Stripe Checkout session in production, demo redirect when `STRIPE_API_KEY=sk_test_emergent`) + `GET /api/wallet/topup-status/{session_id}` (polls status, idempotently credits wallet on first `paid`). Frontend explicit `origin` field în body (rezolvă bug ingress-rewrites). Frontend: `WalletTopupBar` în ClientDashboard cu presets [+100/+250/+500/+1000] + custom amount + via Stripe badge. Page nouă `/payment-success` cu polling. **(b) P2a Milestone Renegotiation**: backend `routes/projects.py` — `POST /api/projects/{id}/milestones/renegotiate` (propose new pct distribution for *unfunded* tranches only; validates sum=100, len matches unfunded), `GET .../renegotiate` (list proposals), `POST .../renegotiate/{prop_id}/respond` (accept/reject by counterparty; accept rewrites unfunded milestones preserving IDs and final-tranche warranty). Notification + event log on each action. Frontend: `RenegotiatePanel` în ProjectWorkspace > Plăți tab cu pending proposals + history details + modal pentru propunere nouă cu sliders %. **(c) P2b First-Login Tutorial**: backend `routes/auth.py` — `/auth/me` returnează acum `tutorial_seen` (bool), `POST /api/auth/tutorial-seen` + `/auth/tutorial-reset`. Frontend: `TutorialOverlay.jsx` global, montat în App.js, afișează 5-pași role-specific (client/specialist/operator/admin) cu progress dots, Înapoi/Mai departe/Skip; dismiss-ul setează flag persistent.




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

### Phase 36 — Audit Diff Compare + Shareable Links (Feb 2026)
- Checkbox-uri pe rândurile din Audit Log (max 2 selectate simultan, FIFO drop)
- Buton "🔬 Compară selectate (2)" în toolbar care deschide modal Diff Compare
- Modal afișează cronologic Mai vechi (stânga) / Mai nou (dreapta) cu header (acțiune, actor, timestamp)
- 2 moduri vizualizare (toggle): tabel câmpuri key-by-key + diff linie cu linie (LCS algorithm, GitHub-style)
- Shareable Diff Links — buton "🔗 Copiază link Diff" generează URL `?compare=ID1,ID2`
- Auto-deschide modalul când pagina e accesată cu `?compare=` (fetch fallback prin `GET /api/admin/audit-log/{id}`)
- Banner roșu "⚠️ Link invalid" dacă intrările au fost șterse; URL curățat la close

### Phase 45 — Multi-tier Severity + Banner Expiry + i18n EN + Pytest Fixes (Feb 2026)
**Multi-tier Severity:**
- Refactor `_get_spike_alert_settings()` cu shape nou: `tiers: [{name, label, color, threshold_pct, preset_id}]`
- Migrare automată din vechiul `preset_id + threshold_pct` la noul array de tier-uri (backward-compat)
- Helper `_classify_tier()` returnează **highest-severity tier matched** (only the highest with configured preset)
- Defaults: warning (≥50%, amber), high (≥150%, orange), critical (≥300%, red)
- Endpoint test extins cu `force_tier` pentru a testa orice tier individual
- Dedupe per `(last_sent_week + tier)` în cron — aceeași săptămână + același tier = skip
- Frontend: 3 rânduri color-coded cu border-left per tier severity, fiecare cu propriul preset selector, threshold input, buton "📨 Test"

**Banner Promo cu Expirare Automată:**
- `CMSEntryIn` extins cu `expires_at` (ISO datetime opțional)
- Public CMS endpoint filtrează override-uri expirate → revealează default-ul (sau gol pentru custom keys)
- Frontend AdminCMS: date picker `datetime-local` doar pentru `landing.promo_banner`, badge "Programat"/"Expirat"

**CMS i18n EN bilingv:**
- i18n.js extins: `cms[key]` = RO override, `cms[\`${key}:en\`]` = EN override
- Fallback chain: EN override → translations.en → translations.ro → key
- Frontend AdminCMS: toggle "🌍 Bilingv" → afișează textarea EN sub fiecare cheie RO, salvare independentă pe `:en` suffix
- Auto-skip listare a cheilor `:en` în main list (sunt editing companions)

**Pytest Fixes:**
- Fix `NameError: uuid` în `/app/backend/routes/payments.py` (lipsea `import uuid`)
- Fix `NameError: uuid` în `/app/backend/routes/design.py` (lipsea `import uuid`)
- Fix `test_twins_enriched_fields`: enrich fields always set (None fallback) chiar dacă property nu mai există
- Phase 8 + 9 → toate 29 teste pass

### Phase 44 — Spike Alert Auto-Email (Feb 2026)
- Backend helper `_compute_weekly_compare()` refactored din endpoint pentru reutilizare cron
- Endpoint `GET/PUT /api/admin/incident-spike-alert/config` — citește/actualizează `{enabled, preset_id, threshold_pct, last_sent_week, last_result}`
- Endpoint `POST /api/admin/incident-spike-alert/test` cu `{dry_run, force}` pentru testare manuală
- Funcție async `run_incident_spike_alert_check()` și `_send_spike_alert_email()` cu HTML branded incluzând mini-heatmap snapshot inline (Resend/SendGrid/console)
- **APScheduler job nou**: cron Luni 08:00 Europe/Bucharest cu dedupe automat per `last_sent_week`
- Audit log automat: `incident_spike_alert.sent`, `incident_spike_alert.config_update`, `incident_spike_alert.manual_test`
- Frontend: panel expandabil "🔔 Alertă automată email" sub WeeklyCompare cu 3 controls (enable/preset/threshold), informații ultimă trimitere, 2 butoane test (Preview + Trimite acum)

### Phase 43 — Weekly Compare + Early Warning Alert (Feb 2026)
- Endpoint `GET /api/admin/incident-cadence-weekly-compare?alert_threshold_pct=100` agregare current vs previous week (Mon→Sun) din `preset_send_history`
- Returnează 2 serii de 7 cells fiecare cu flag `is_future`, total_sends, total_recipients, `delta_pct` (null când previous=0 și current>0 = increment "infinit"), `alert` boolean
- Frontend: secțiune `WeeklyCompare` în card-ul Cadence cu 2 mini-heatmaps side-by-side, pill delta colorat (verde=scădere, amber=creștere sub prag, roșu=alertă), badge "⚠️ Alertă" cu pulse animation când peste prag
- Zilele viitoare afișate cu border dashed și fără click (cursor not-allowed)
- Banner explicativ jos când alert activ — sugestii de investigare
- Click pe celule active → navigate la audit log filtrat pe ziua respectivă

### Phase 42 — Recipient Cadence Heatmap (Feb 2026)
- Endpoint `GET /api/admin/incident-cadence-heatmap?days=91` agregare zilnică din `preset_send_history`
- Returnează: `cells[]` (date, count, recipients, weekday) cu zero-fill, `total_sends`, `active_days`, `peak`, `weekday_dist[7]`
- Backend audit-log endpoint extins cu `date_from` + `date_to` query params
- Frontend: componentă nouă `IncidentCadenceHeatmap.jsx` pe Admin Overview
- GitHub-style 7×13 grid cu 5 nuanțe de verde (Mai puțin → Mai mult), labels axe (FEB/MAR/.../MAI sus, L/Mi/V stânga)
- Click pe cell → custom event `propmanage:nav-admin` cu detail `{tab, date}` → AdminConsole switch active tab + AdminAuditLog citește `?audit_date=` URL param
- Pill portocaliu **"📅 YYYY-MM-DD ×"** în toolbar audit log pentru clear filter
- Hover: scale 125% + ring portocaliu + detalii la footer (data + count + destinatari)
- Stats top-right card: total trimiteri + zile active + peak

### Phase 41 — Stats per Preset (Feb 2026)
- Colecția `preset_send_history` cu `{preset_id, audit_entry_id, target_label, action, recipient_count, sent_by, sent_at, provider}`
- Înregistrare automată la fiecare email trimis cu `preset_id` în `email-report` endpoint
- Endpoint `GET /api/admin/recipient-presets/{id}/stats?days=180`: returnează `preset`, `recent_sends[10]`, `months[]` (full series cu zero-fill), `total_sends`, `first_send`, `last_send`
- Agregare lunară prin MongoDB pipeline: `$substr(sent_at, 0, 7)` → YYYY-MM, completare luni lipsă pe client side
- Cleanup automat: ștergerea unui preset șterge și istoricul aferent
- Frontend: buton 📊 vizibil pe hover pe fiecare chip → modal cu 3 KPI cards (Total / Prima / Ultima), grafic bar lunar CSS-only cu gradient amber, listă istoric recent (badge action, target, timestamp, autor, count, provider)
- Etichete lunare în română (Ian/Feb/.../Dec), tooltip pe bare cu count + total destinatari

### Phase 40 — Recipient Presets (Feb 2026)
- Colecția MongoDB `incident_recipient_presets` cu `{name, emails[], sent_count, created_by, created_at}`
- 4 endpoint-uri CRUD: `GET/POST/PATCH/DELETE /api/admin/recipient-presets[/{id}]`
- Sanitizare email: regex valid, lowercase, dedupe, max 25/preset, max 80 char nume
- Dedupe nume case-insensitive (409 Conflict pe duplicate)
- `POST /audit-log/{id}/email-report` extins cu `preset_id` opțional — increment automat `sent_count` + `last_used_at`
- List sortat by `sent_count DESC, created_at DESC` → cele mai folosite sus
- Audit log: `recipient_preset.create/update/delete` (toate trackable & rollback-able)
- Frontend: chip-uri quick-pick în Email modal (click adaugă emails cu dedupe), buton "+ Preset nou" deschide form inline (nume + emails comma-separated), buton X pe hover pentru ștergere
- Chip-urile afișează: nume, count emails, badge `{sent_count}↑` dacă > 0
- Tooltip cu lista completă emails pe hover

### Phase 39 — Email Incident Report (Feb 2026)
- Endpoint `POST /api/admin/audit-log/{id}/email-report` cu body `{recipients, note, base_url}`
- Reutilizează `_build_incident_pdf_bytes` helper (refactor din Phase 38) pentru attachment
- `send_email()` în `email_service.py` extins cu parametru `attachments` (suport Resend + SendGrid)
- Validare destinatari prin regex, max 10, separator virgulă, returnează `invalid_recipients` list
- Subject auto-format: `[INCIDENT] {action} — {target} — {date} — {pin_note[:60]}`
- Body HTML brand-styled cu tabel metadată, casetă pinned-note, casetă admin-note
- Auto-audit: fiecare email creează o intrare `incident.email_sent` în audit log (traceability)
- Frontend: buton "📧 Email raport" lângă "📄 Raport PDF" în detail-view pinned + modal cu prompt destinatari + textarea notă admin
- Console fallback graceful când `RESEND_API_KEY` lipsește: UI informează `"Email simulat (provider: console)"`

### Phase 38 — Incident Report PDF Export (Feb 2026)
- Endpoint `GET /api/admin/audit-log/{id}/incident-report.pdf?base_url=...` (admin only)
- PDF generat cu **ReportLab** + font **DejaVu Sans** (Unicode complet, diacritice românești Ț/Ș/Ă/Î/Â)
- QR code generat cu librăria `qrcode`, linkat la URL-ul shareable deep-link
- Layout profesional: header, tabel metadată (acțiune, țintă, actor, timestamp, ID, status pinned), casetă amber pentru nota incident, diff side-by-side înainte/după (roșu/verde), QR code + URL, footer cu generator + solicitant
- Buton "📄 Raport PDF" în expanded view-ul intrărilor pinned (deschide PDF în tab nou cu cookies admin)
- Util pentru: post-mortems, board meetings, atașamente Jira/Linear, audituri ISO/SOC2, rapoarte legale

### Phase 37 — Pin Audit Entry (Feb 2026)
- Buton 📌 pe fiecare rând din Audit Log pentru a marca intrări critice (anomalii, momente importante, modificări de investigat)
- Promptl pentru notă opțională (max 240 caractere) la pin, confirm la unpin
- Backend: `POST /api/admin/audit-log/{id}/pin` (toggle) + extindere list/single cu câmpurile `pinned`, `pinned_note`, `pinned_at`, `pinned_by`, `pinned_by_name`
- Filtru `?pinned=true` în list endpoint + sortare pinned-first
- Toggle "Doar Pinned" în toolbar cu badge counter (numărul total de pinned)
- Visual: border-left amber gros, badge `📌 PIN` lângă target, notă afișată inline sub titlu
- Detail-view: casetă amber "Marcat ca anomalie / moment important" cu nota completă, autor și timestamp
- Search-ul include și `pinned_note`
- Checkbox-uri pe rândurile din Audit Log (max 2 selectate simultan, FIFO drop)
- Buton "🔬 Compară selectate (2)" în toolbar care deschide modal Diff Compare
- Modal afișează cronologic Mai vechi (stânga) / Mai nou (dreapta) cu header (acțiune, actor, timestamp)
- **2 moduri vizualizare** (toggle):
  1. **Tabel câmpuri** — key-by-key comparison pentru obiecte, marker amber `●` pe câmpuri schimbate
  2. **Diff linie cu linie** — GitHub-style side-by-side cu numere de linie, LCS algorithm, fundal roșu/verde, prefixe `−`/`+`, statistici `+N −N linii modificate`
- Smart state pick: `cms.reset` → folosește `before`, alte acțiuni → `after`
- **Shareable Diff Links** — buton "🔗 Copiază link Diff" generează URL `?compare=ID1,ID2`
- Auto-deschide modalul când pagina e accesată cu `?compare=` (cu fetch fallback prin nou endpoint `GET /api/admin/audit-log/{entry_id}` dacă intrările nu sunt pe pagina curentă)
- Banner roșu "⚠️ Link de compare invalid" dacă una/ambele intrări au fost șterse
- URL e șters din browser history la închiderea modalului (no auto-reopen on refresh)

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
