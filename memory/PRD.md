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
- **Phase 47 (AI Concierge & Behavioral Security Monitor) — Feb 2026 — 17/17 backend tests ✅, frontend verified**:
  - **Backend**: New `routes/security_guard.py` (deterministic guard via FastAPI dep): bot UA regex, datacenter-IP heuristic (AWS/GCP/Azure/DigitalOcean), VPN UA hints, GEO via CF-IPCountry/X-Country headers, per-IP rate limit (Mongo sliding window, default 30/min), per-user concierge quotas (25/h, 200/day) anti-cost-scraping. Admin bypasses content checks. All blocks logged to `security_events` AND mirrored to `admin_ai_findings`. Admin endpoints: `GET/PUT /api/admin/security/config`, `GET /api/admin/security/events`.
  - Enhanced `routes/concierge.py`: role-specific prompts (Client/Specialist/Operator), prompt-injection regex, sensitive-data regex, escalation triggers, rate limit per user, security_guard dependency on `/chat`, PII redaction (emails/phones/IBAN/CNP) on LLM output. Admin endpoints: conversations browse + transcript modal, stats (escalation_rate, block_rate, top_abusers), settings (enabled_roles, escalation_triggers, support_email), block/unblock user.
  - Collections: `security_config`, `security_events`, `security_rate_buckets`, `concierge_conversations`, `concierge_messages`, `concierge_abuse_log`, `concierge_usage`, `concierge_settings`.
  - LLM: Claude Sonnet 4.5 via emergentintegrations + Emergent LLM Key.
  - **Frontend**: `components/AIConciergeBubble.jsx` (floating widget bottom-right, role-aware suggestions, support-mail CTA for escaladare, hidden for admin & disabled users), `pages/admin/AdminConciergePanel.jsx` (4 cards: SecurityConfig with toggles + rate-limit caps, live Events feed, Conversations browser with transcript modal, Concierge settings). Wired in AdminConsole as 'concierge' tab with NEW badge in sidebar.

- **Phase 47B (AI Repair Suggester + Production CORS + Resend wiring) — Feb 2026 — 18/19 backend tests ✅**:
  - **Faza B AI Repair Suggester**: `admin_ai.py` extended with REPAIR_SYSTEM_PROMPT (Claude generates JSON with `summary`, `risk_level`, `steps[]`, `rollback`, `verification`, `estimated_minutes`, `requires_db_write`, `requires_user_communication`). Endpoints: `POST/GET /api/admin/ai/findings/{id}/suggest-repair` (generate+cache, regenerate=true overwrites & increments regeneration_count), `POST /api/admin/ai/repair-suggestions/{id}/decide` (approve|reject + note), `POST /api/admin/ai/repair-suggestions/{id}/mark-applied` (only approved → applied; auto-resolves linked finding). `GET /api/admin/ai/repair-suggestions` returns list + counts {proposed,approved,rejected,applied}. **CRITICAL: NO auto-execution** — admin runs the fix manually then marks as applied.
  - **Frontend**: AdminAIConsole gets Wrench icon button per open finding → RepairSuggester modal with risk_level/requires_db_write badges, summary, numbered steps, amber rollback box, blue verification box, action bar (Regenerează / Respinge / Aprobă → Am aplicat fix-ul).
  - **CORS lockdown**: `server.py` reads `CORS_ORIGINS` env (defaults to `*` with allow_credentials=False per browser spec). Set comma-separated list (e.g. `https://propmanage.io,https://www.propmanage.io`) for production. Supports optional `CORS_ORIGIN_REGEX` env. Logs config at startup.
  - **Resend wiring**: `email_service.py` already auto-detects `RESEND_API_KEY` env (line 15-26). Added empty placeholder to `.env` + `SENDER_EMAIL` + `APP_PUBLIC_URL`. Console fallback active until user provides key (1 min on resend.com).
  - **Fixes during testing**: regeneration_count was stale in response (DB OK) — fixed by computing `existing.regeneration_count + 1` before serialize. UI approve→mark-applied button didn't appear — fixed `decideRepair` to mutate local state instead of re-fetching.
  - **Deferred (LOW priority, risky for current MVP)**: split `concierge.py` (563 lines) into chat/admin modules; pytest full-suite state leakage fix (13/336 fail when run sequentially, all pass individually). Both are cosmetic for now per user's "don't break what works" guidance.

- **Phase 47C (Repair Audit Log + Effectiveness Trend) — Feb 2026 — verified live**:
  - **Backend**: `GET /api/admin/ai/repair-suggestions/audit?days=N` aggregates per-pattern effectiveness via Mongo pipeline ($group on `finding_pattern`): total / proposed / approved / applied / rejected / approve_rate_pct / reject_rate_pct / apply_rate_pct / **effectiveness_pct** (applied / decided), avg_minutes, avg_regenerations, high_risk count. Also returns `totals` (global) + `best_pattern` + `worst_pattern` (only patterns with ≥3 decisions qualify). `GET /api/admin/ai/repair-suggestions/by-pattern/{pattern}?days=` for drill-down. `GET /api/admin/ai/repair-suggestions/trend?weeks=N` produces 7×N day-cells with effectiveness_pct + trend_delta_pct between first/second half of window.
  - **Frontend**: `pages/admin/RepairAuditLog.jsx` (mounted in AdminAIConsole between Findings and Chat). Sections: 5-stat global header, **EffectivenessTrend** sub-component (GitHub-style 7×N heatmap, 2/4/8/12 săpt selector, color buckets `<30%` red / `30-50%` amber / `50-80%` light-emerald / `≥80%` emerald-500 / pending grey / no-data slate, rolling stats + delta-pp vs first-half, hover detail row), Best/Worst pattern cards (green/red), per-pattern table with apply-rate progress bar + Trending icons + drill-down modal on row click.
  - Testids: `repair-audit-rows`, `repair-trend-chart`, `trend-grid`, `trend-cell-{date}`, `trend-weeks-{N}`, `audit-window-{N}`, `audit-row-{pattern}`, `audit-drill-modal`.

- **Phase 47D (Low Effectiveness Email Alert) — Feb 2026 — verified live**:
  - **Backend**: `routes/admin_ai.py` extended with rolling-effectiveness alert. Cron `ai_effectiveness_low_alert` runs every Monday 09:00 Europe/Bucharest. Config singleton `admin_ai_alert_config` (enabled, threshold_pct, window_days, min_decided anti-spam, recipients fallback to admin users, last_state, last_sent_week ISO dedupe). History collection `admin_ai_alert_history` per triggered alert. Endpoints: `GET/PUT /api/admin/ai/effectiveness-alert/config`, `POST .../test` (dry_run+force), `GET .../history`. Email template uses dark-theme card with eficacitate gigantă (red if below threshold), breakdown stats + actionable recommendations + CTA to /admin.
  - **Frontend**: `LowEffectivenessAlertConfig` în `RepairAuditLog.jsx` sub heatmap — toggle ON/OFF (Bell icon), slider prag 10-95% accent-amber, input zile fereastră, input min decizii, comma-separated recipients, butoane Simulare/Trimite-mi acum/Istoric. Banner inline rezultat ultimă verificare. Modal istoric cu toate alertele trimise.

- **Phase 48c (Demo Leads CRM + Legal + Status + WhatsApp) — Feb 2026 — verified live**:
  - **Backend**: `routes/public.py` extins cu admin_router `/api/admin/demo-leads` (GET list cu counts by status, PATCH update status/notes/follow_up, DELETE soft). Endpoint nou `/api/public/status` (sanitized — API/DB/AI/Stripe/Email cu uptime 90d când disponibil). Modal demo public acceptă acum câmp `whatsapp` (validat, build deep-link wa.me automat dacă ≥9 digits, emailul de notificare include link verde clickabil pentru admin).
  - **Frontend**:
    - `pages/admin/AdminDemoLeads.jsx`: 6 KPI cards, filter pills per status, listă leads expandabilă cu mesaj original, switch status inline, textarea notițe interne, butoane WhatsApp (deep link verde), email, delete. Tab nou "Demo Leads" în sidebar cu badge NEW.
    - `pages/LegalPages.jsx`: `PrivacyPage` + `TermsPage` — pagini publice GDPR-aware (RO), 8-12 secțiuni fiecare cu prose styling, link-uri reciproce, footer cu contact.
    - `pages/StatusPage.jsx`: pagină publică `/status` cu auto-refresh 60s, hero bar verde/amber/red după global status, listă per-componentă (API/DB/AI Concierge/Plăți/Email) cu badge color-coded, uptime 90d (când există date), bloc info despre incidente.
    - `pages/BookDemoModal.jsx`: nou câmp telefon/WhatsApp opțional cu border verde la focus.
    - Footer landing actualizat cu link-uri funcționale `/terms`, `/privacy`, `/status` (cu dot verde pulsing).
- **Phase 48b (Demo Payment Time Machine) — Feb 2026 — verified live**:
  - **Backend `routes/demo_time_machine.py`**: admin-only endpoints care fac bypass la role checks pentru a parcurge întreg ciclul plății virtual. Pentru cereri (1 escrow): `simulate-payment`, `simulate-specialist-accept`, `simulate-start`, `simulate-complete`, `simulate-confirm` (95/5 release real către wallet specialist), `simulate-dispute`, `simulate-refund` (refund wallet client), `reset`. Pentru proiecte multi-milestone (4×25%): `sim-fund`, `sim-release` (final → warranty_hold, intermediate → released cu credit 95% specialist), `sim-warranty-fast-forward` (skip 30 zile garanție), `sim-reset` (proiect întreg). Toate cu `demo_simulated:true` în audit log + notificări reale pentru flow realist.
  - **Frontend `pages/admin/AdminDemoTimeMachine.jsx`**: tab nou "Demo Tools" cu disclaimer amber + 2 carduri (Simulator cereri + Simulator proiecte). Butoane contextuale per status — apare doar acțiunea logică pentru starea curentă (ex: când e `open`, vezi "Plătește" + "Specialist acceptă"; când e `completed`, vezi "Client confirmă" + "Deschide dispută"). Reset disponibil oricând pentru replay. Wallet credit real pentru specialist la release (95%).
  - Testids: `admin-demo-time-machine`, `demo-tools-disclaimer`, `demo-tools-requests-list`, `demo-tools-projects-list`, `demo-req-{id}`, `demo-proj-{id}`, `sim-{action}-{id}`, `ms-{action}-{id}`.

- **Phase 48 (Production Readiness for Live Beta) — Feb 2026 — verified live**:
  - **Backend nou `routes/public.py`**: `POST /api/public/demo-request` (lead capture cu validare email, idempotent pe email+zi, notify admin via email service), `GET /api/health` (DB ping + LLM key + email provider + Stripe mode — fără auth, pentru uptime monitoring).
  - **Backend nou `demo_reset.py`**: Cron `demo_accounts_reset` rulează zilnic 02:00 Europe/Bucharest. Resetează wallet/rating/review_count + șterge concierge sessions + unset tutorial_seen pentru 3 conturi demo (`client@`, `specialist@`, `operator@`). Log în `demo_reset_log`. Idempotent.
  - **Frontend `BookDemoModal.jsx`**: modal cu 5 câmpuri (nume, email, companie, rol, mesaj), validare client-side, success state cu ✓. Eveniment custom `propmanage:book-demo` pentru triggering din alte componente.
  - **Frontend Landing**: nou banner **Demo Mode** sus (amber-stoned, `data-testid=demo-mode-banner`) cu inline CTA "Programează demo" + dismiss button. Floating button stânga-jos `Sparkles + "Programează o demonstrație"` cu shadow lime-500/30 — vizibil pe tot scroll-ul. Replace pentru `<title>` + meta tags complete (description, keywords, OG, Twitter card), `og-cover.svg` (1200×630, branded), `robots.txt` (allow /, disallow /admin /dashboard), `sitemap.xml` (/, /login, /marketplace).
- **Phase 47G (AI Admin Onboarding Tour) — Feb 2026 — verified live**:
  - **Backend**: `routes/auth.py` extended — `/auth/me` returns `ai_admin_tour_seen` flag. New endpoints `POST /api/auth/ai-admin-tour-seen` and `POST /api/auth/ai-admin-tour-reset` (admin-only, 403 otherwise).
  - **Frontend**: `pages/admin/AIAdminTour.jsx` — **real spotlight tour** with SVG mask cutout (not centered modal). 7 steps highlighting: Health Badge (header), AI Investigator menu item, Health Score Card, Repair Suggester button on findings, Audit Log trend chart, Alert config, Concierge menu. Each step has `target` (CSS selector), `placement` (top/bottom/left/right), optional `triggerNav` (auto-switches admin tab), optional `waitMs` (delays for late-mounted components). Uses `getBoundingClientRect` + scroll/resize listeners + 800ms poll for late mounts. Bubble auto-positions to viewport edges, pulsing #d4ff3a border ring around target.
  - **Triggers**: auto-shows on first admin login (flag false), or manual replay via `ReplayAIAdminTourButton` mounted in admin header. Reset endpoint for re-testing. Auto-navigates between admin tabs via existing `propmanage:nav-admin` event system.
  - Testids: `ai-tour-overlay`, `ai-tour-bubble`, `ai-tour-title`, `ai-tour-next`, `ai-tour-prev`, `ai-tour-skip`, `ai-tour-close`, `ai-tour-dot-N`, `ai-tour-replay-btn`.

- **Phase 47F (Admin Header Health Badge) — Feb 2026 — verified live**:
  - **Frontend**: `pages/admin/HealthScoreBadge.jsx` — compact widget montat în AdminLayoutMetronic header între GlobalSearch și theme-toggle. SVG ring 32×32 cu scor în centru + label "AI HEALTH" + grade (responsive: text ascuns pe mobile). Click dispatch event `propmanage:nav-admin` → AdminConsole tab `ai`. **Pulse roșu** (animate-pulse + ring red dot top-right) când scor &lt; 60. Auto-refresh la 60s. Tooltip cu scor exact + delta 7z. Reused color tokens (emerald/amber/red) cu data.color din endpoint.
  - Testid: `admin-header-health-badge`.

- **Phase 47E (AI Health Score Dashboard) — Feb 2026 — verified live**:
  - **Backend**: `GET /api/admin/ai/health-score?days=7` computes 3 weighted sub-scores: **findings** (40%, 100 - sum of severity weights {critical:25, high:10, warning/medium:3, info/low:1}), **effectiveness** (35%, = rolling applied/decided pct or neutral 70 if no decisions), **concierge** (25%, = 100 - 2×block_rate_pct floored at 30, or neutral 80 if no traffic). Returns overall 0-100 + grade (Excelent ≥90 / Bună ≥75 / Acceptabilă ≥60 / Atenție ≥40 / Critică <40) + color (emerald/amber/red) + delta_7d. Daily snapshot persisted to `admin_ai_health_history` (upsert idempotent per day). Trend = last 14 stored snapshots.
  - **Frontend**: `pages/admin/AIHealthScore.jsx` mounted as hero at top of AdminAIConsole. Gradient card, central SVG **ScoreRing** (radial 140×140 with stroke-dashoffset animation), 3 SubScore cards (icon + score/100 + colored progress bar + detail + weight label), 14-day **Sparkline** SVG. 7-day delta badge with TrendingUp/Down.
  - Testids: `ai-health-score`, `health-refresh`, `health-delta`, `health-sub-Findings`, `health-sub-Repair eficacitate`, `health-sub-Concierge`.
  - New `routes/security_guard.py` (270 lines): deterministic behavioral guard exposed as FastAPI dependency `security_guard`. Heuristics: bot User-Agent regex (curl/wget/requests/headless/scrapy/selenium/puppeteer/...), datacenter-IP heuristic (AWS/GCP/Azure/DigitalOcean prefixes), VPN UA hints (NordVPN/Proton/...), GEO-block via `CF-IPCountry`/`X-Country`/AWS CloudFront headers, per-IP rate limit (Mongo sliding window, default 30/min), per-user concierge quotas (25/h, 200/day) — anti-cost-scraping. Admin role bypasses content checks. Every block event is persisted in `security_events` AND mirrored to `admin_ai_findings` (composite_key=`security_{kind}::{ip}`) so the AI Investigator surfaces them. Admin endpoints: `GET/PUT /api/admin/security/config`, `GET /api/admin/security/events?limit&kind` with `by_kind_24h` aggregation.
  - Enhanced `routes/concierge.py`: existing role-specific prompts (Client/Specialist/Operator), prompt-injection regex pack, sensitive-data regex pack, escalation triggers (refund/legal/GDPR/...), rate limit per user (30/5min). NEW: chat endpoint now depends on `security_guard` (gives bot/VPN/GEO/IP-RL + concierge-quota cap). NEW: `_redact_pii()` strips emails/phones (≥9 digits)/IBAN/CNP from LLM output as final safety net (`pii_redacted` flag stored). Admin endpoints: `GET /api/admin/concierge/conversations` (filter escalated/blocked), `GET /api/admin/concierge/conversations/{id}`, `GET /api/admin/concierge/stats` (escalation_rate, block_rate, by_role, top_abusers), `PUT /api/admin/concierge/settings` (enabled_roles, escalation_triggers, support_email), `POST/DELETE /api/admin/concierge/block-user/{uid}`. Admins receive 400 on `/api/concierge/chat` (use AdminAIConsole).
  - **MongoDB collections**: `security_config` (singleton), `security_events`, `security_rate_buckets`, `concierge_conversations`, `concierge_messages`, `concierge_abuse_log`, `concierge_usage`, `concierge_settings`.
  - **LLM**: Claude Sonnet 4.5 (`anthropic/claude-sonnet-4-6`) via `emergentintegrations.LlmChat` + Emergent LLM Key (same pattern as Faza A AI Investigator). NO standard Anthropic SDK installed.

  **Frontend**:
  - New `components/AIConciergeBubble.jsx`: floating bottom-right widget mounted globally inside `BrowserRouter`. Auto-hidden for admins and for users where `enabled:false`. Role-aware suggestions (client/specialist/operator), Stripe-style chat panel, support-mail CTA for escalated messages, PII-safe rendering of blocked/escalated states (red/amber bubble), `sessionStorage`-persisted session id, reset/close buttons, mobile-first layout (inset-x-2 on small screens), respects `dual_role` active_view.
  - New `pages/admin/AdminConciergePanel.jsx`: 4 stacked cards — `SecurityConfigCard` (toggle bot/VPN/GEO + countries CSV input + 3 numeric rate-limit inputs + dirty-state save button), `SecurityEventsCard` (table with kind/IP/country/user/path/UA/time, filter pills, `by_kind_24h` summary), `ConciergeConversationsCard` (stats grid + filter pills + list with blocked/escalated badges + modal showing full transcript with block_reason/escalation_trigger), `ConciergeSettingsCard` (toggle 3 roles, support email, escalation triggers textarea).
  - Wired in `AdminConsole.jsx` as new tab `concierge`, exposed in `AdminLayoutMetronic.jsx` sidebar OVERVIEW section with "NEW" badge + ShieldCheck icon.
  - All interactive elements carry `data-testid` (concierge-bubble-launch, concierge-bubble-panel, concierge-send, concierge-suggestion-N, admin-nav-concierge, security-save, security-events-list, conversations-list, ...).




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

### Phase 46 — AI Admin Investigator (Faza A MVP) (Feb 2026)
**Backend (`/app/backend/routes/admin_ai.py`):**
- 8 scannere deterministe Python (NO LLM credits) pentru pattern-uri: `stale_project`, `specialist_low_rating`, `client_repeated_rejections`, `operator_unvalidated_twins`, `escrow_stuck`, `audit_spike`, `orphan_twins`, `duplicate_users`
- Colecție `admin_ai_findings` cu lifecycle (open/dismissed/resolved), occurrence tracking, composite key dedup
- Colecție `admin_ai_scans` cu istoric run-uri
- Endpoint `POST /api/admin/ai/scan/run` — trigger manual full-scan
- Endpoints `GET/POST` findings cu filter status/severity/pattern + KPIs
- Endpoints `dismiss/resolve` cu notă rezolvare
- **Chat AI**: `POST /chat/send` cu Claude Sonnet 4.5 via Emergent LLM Key (model `claude-sonnet-4-6`)
- System prompt branded "Investigator" în română cu constrângeri stricte: NU execută, NU inventează, doar sugerează
- Live context injection: findings snapshot inclus în system prompt la fiecare turn
- Colecții `admin_ai_sessions` + `admin_ai_messages` pentru memorie persistentă
- Endpoints CRUD pentru sesiuni (list / get messages / delete)

**Cron jobs (`server.py`):**
- `ai_daily_scan` — Zilnic 03:00 Europe/Bucharest (auto-scan)
- `ai_daily_digest_email` — Zilnic 08:00 Europe/Bucharest (email digest cu top 20 findings către admini)

**Frontend (`/app/frontend/src/pages/admin/AdminAIConsole.jsx`):**
- Card Findings cu severity color-coding (high/warning/low), filter pills, butoane ✓ rezolvă + × ignoră
- Card Chat cu sidebar sesiuni (titlu, count mesaje, delete), bubble UI conversațional, indicator "gândește..."
- Sugestii de întrebări în empty state
- Badge "Claude Sonnet 4.5"
- Banner explicit: read-only / 100% control admin

**Navigation:**
- Nou meniu "AI Investigator" în secțiunea OVERVIEW cu badge gradient "NEW"
- Tab `ai` în AdminConsole router

**Test live**: scanner-ul a detectat **31 orphan twins reale** în DB; Claude Sonnet 4.5 răspunde fluent în română cu structură pe priorități și sugestii grupate pe severitate.

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

### Phase 49 — GDPR Compliance Pack (Part A) — Feb 2026
- **Backend** `routes/gdpr.py` (854 lines, fully built earlier) — now **registered in `server.py`** (router + admin_router live).
  - Public endpoints: `GET /api/gdpr/documents/{ropa|sub-processors|cookies|dpia|breach-plan|company}` + PDF exports (`/pdf/ropa`, `/pdf/dpia`, `/pdf/notice/{role}`).
  - Admin endpoints (Parts B-E ready for activation when needed): DSAR queue, breach drills audit, ROPA/Cookies/Subs CRUD, gdpr_audit collection.
  - Defaults seeded: 10 ROPA activities, 5 sub-processors, 5 cookies, DPIA doc, 5-step breach plan.
- **Frontend** `pages/admin/AdminGDPR.jsx` — 5-tab DPO-ready panel inside Admin Console.

### Phase 49 — GDPR Compliance Pack (Parts B, C, D, E) — Feb 2026
- **Part B (Privacy Notices public page)** — New `pages/PrivacyNoticesPage.jsx` at route `/privacy/notices`:
  - 5 role cards (Client, Specialist, Operator, Visitor, B2B DPA) with summary + highlights + PDF download + read inline.
  - Bottom section linking to ROPA / Sub-processors JSON / Cookies / DPIA PDF.
  - Linked from `LegalPages.jsx` (PrivacyPage) via callout box.
- **Part C (DSAR self-service)** — Extended `PrivacyModal` in `SettingsPanel.jsx`:
  - JSON export now uses `/api/gdpr/me/export` (Art. 15 + Art. 20 with rights summary).
  - New "Consimțăminte granulare" section — toggles for `marketing_email`, `product_updates`, `research_participation` via `/api/gdpr/me/consents` GET/POST.
  - New "Cerere oficială ștergere via DPO (Art. 17)" — submits to admin queue with 30-day SLA via `/api/gdpr/me/erasure-request`. Idempotent + visible SLA confirmation.
  - Direct delete (legacy `/auth/account-delete`) preserved as fast path.
- **Part D (Admin GDPR Control Center)** — Extended `AdminGDPR.jsx` with 2 new tabs:
  - `DSAR Queue`: status filter pills (toate/noi/în analiză/finalizate/respinse) + table with SLA pills (overdue/<7d/normal) + modal to update status & admin notes (auto-audit-log).
  - `Drills & Audit`: form to log breach drill (scenario, 5 step toggles, duration, notes), history list, and read-only `gdpr_audit` log table.
- **Part E (DPO Bundle ZIP)** — New backend endpoint `GET /api/gdpr/pdf/bundle` (admin only) — packages ROPA PDF + DPIA PDF + 5 privacy notice PDFs + sub-processors/cookies/breach JSON + README into a single ZIP; logs each download to `gdpr_audit`. Wired as prominent button in AdminGDPR header.
- **Bug fix**: Syntax error in `gdpr.py` (smart-quote string termination line 766).
- **Test results**: All endpoints validated end-to-end (client login → erasure submit → admin sees request with SLA 30z; bundle ZIP returns 23KB application/zip; granular consents persisted). Notices page renders 5 cards. All 7 GDPR tabs render in admin.

### Phase 50 — Digital Twin Pro Module (Phases A-G) + A/B Extension — Feb 2026
- **Phase A (Backend infra + Subscription Gate)** — Isolated `routes/digital_twin.py` with collections `digital_twin_projects` / `_models` / `_pins` / `_comments` / `_plans`. Subscription gating via `user.digital_twin_pro` flag (admin/operator bypass). Admin grant endpoint `POST /api/admin/digital-twin/subscription/grant`.
- **Phase B (GLB Upload)** — `POST /api/digital-twin/projects/{id}/upload` streaming chunked PUT (1MB chunks, 200MB hard cap), .glb/.gltf only. Files stored at `/app/backend/uploads/digital_twin/{pid}/`. Auth-checked serve route `/files/{pid}/{filename}` returns `model/gltf-binary`.
- **Phase C (R3F Viewer MVP)** — `components/DigitalTwinViewer.jsx` with three.js + @react-three/fiber + @react-three/drei. 5 face styles, auto-detected layer toggle, OrbitControls with damping. Procedural demo house when no model uploaded. **CRITICAL**: `/app/scripts/patch_r3f.sh` patches @react-three/fiber RESERVED_PROPS to ignore Emergent's JSX injection (must re-run after `yarn install`).
- **Phase D (Tools)** — Tape Measure, Section Plane (X/Y/Z axis clipping with slider).
- **Phase E (3D Pins + Threaded Comments)** — Raycast pin drop, category + priority, threaded comments with status workflow (open/in_review/resolved/rejected) + delete.
- **Phase F (2D Plans PDF Viewer)** — `components/DigitalTwinPlans.jsx` using `pdfjs-dist@4.7.76` (worker at `/pdf.worker.min.mjs`). Upload PDF (50MB cap), 6 plan types, sidebar filter pills, canvas-based PDF render with page nav + zoom (40-300%).
- **Phase F+ (Split-screen 2D + 3D)** — View mode toggle (`dt-mode-2d` / `dt-mode-split` / `dt-mode-3d`) in plans header. Split mode mounts both PDF + embedded 3D viewer side-by-side. Added `embedded` + `compactSidebar` props to `DigitalTwinViewer` — switches outer container from `fixed inset-0 z-40` to `relative w-full h-full` and shrinks sidebar to `w-56` in split mode.
- **Phase G (Workflow Notifications inter-specialități)** — In-app notifications (via `services.notify()` to `db.notifications`) + email (via `tpl_dt_*` templates) dispatched on 5 events: pin created (extended), pin status changed (NEW), comment added (NEW), model uploaded (NEW), plan uploaded (NEW). Actor self-exclusion enforced. 3 new email templates: `tpl_dt_pin_status_changed`, `tpl_dt_model_uploaded`, `tpl_dt_plan_uploaded` with brand-styled dark layout + color-coded status pills + project CTA.
- **Test results**: iteration_19 (Phase D+E frontend 100%), iteration_20 (Phase F backend 15/15 + frontend 100%), iteration_21 (Phase F+ + Phase G backend 6/6 + frontend 100%). Test files: `/app/backend/tests/test_phase_f_plans.py` and `test_phase_g_notifications.py`.

### Phase 51 — A/B Testing Extension (hero.cta2 + cta.btn1) — Feb 2026
- Backend: 2 new experiments registered in `admin_console.py` KNOWN map: `hero_cta2` ("Hero CTA secundar (Flux Complet)") and `cta_btn1` ("CTA bottom — Creează cont"). 4 new CMS keys (`hero.cta2.variant_a/b`, `cta.btn1.variant_a/b`) seeded in DEFAULT_CMS.
- Frontend: Hero component now uses 2 `useABTest()` hooks (hero_cta1 + hero_cta2), CTA bottom uses `useABTest("cta_btn1")`. Each button has `data-ab-variant` attribute + `onClick` trackClick. i18n.js extended with variant fallbacks (RO + EN).
- AdminABTests page auto-shows the 2 new experiments in the dashboard (no UI change needed — KNOWN map drives the list).
- Verified live: variant b text correctly displayed on fresh browser ("Începe gratuit acum" + "Vezi cum funcționează în 2 min" + tracking impressions/clicks via `/api/ab/track`).



### Phase 52 — Digital Twin Phase H: 3D ↔ 2D Pin Sync — Feb 2026
- **Backend**: New `plan_anchors[]` field on `digital_twin_pins` with shape `{id, plan_id, plan_title, page, x_pct, y_pct, created_at, created_by, created_by_name}`. Endpoints `POST /api/digital-twin/pins/{pin_id}/anchors` (validates plan in same project, replaces existing anchor on same (plan_id,page)) and `DELETE /api/digital-twin/pins/{pin_id}/anchors/{anchor_id}` (permission: admin/operator/creator/pin author/project owner). 12/12 pytest pass (`/app/backend/tests/test_phase_h_anchors.py`).
- **Frontend**: PdfCanvas refactored to render absolute-positioned colored markers on top of the PDF canvas. Markers are category-color-coded (defect=red, plumbing=cyan, electrical=yellow, hvac=violet, finish=orange, structural=dark-red, general=emerald). Click a marker → highlights it (white ring) + auto-switches view to split-screen + highlights the matching 3D pin in the embedded `DigitalTwinViewer` (white halo ring + bigger sphere + ring-2 ring-white on HTML label). Anchor mode toggle (`plan-anchor-toggle`) → click PDF → `AnchorPinPicker` modal → pick pin → POST anchor → marker appears. In anchor mode, clicking an existing marker DELETES the anchor (with confirm). Critical PdfCanvas fix: changed `pdfDocRef` (useRef) → `pdfDoc` (useState) so the render `useEffect([pdfDoc,page,scale])` re-runs when PDF document finishes loading. Without this, markers were not visible because canvas viewport size stayed at 0.
- **Verified live**: Successfully placed 2 anchors via UI (UI Pin Defect red + UI Pin Plumbing cyan) on a fresh project + plan. Backend persists anchors, GET /pins returns them inline, frontend re-renders markers.



### Phase 53 — Code Refactors (DigitalTwinViewer + concierge) — Feb 2026
- **DigitalTwinViewer.jsx**: 928 → 409 lines orchestrator + 4 modules in `components/viewer/`: `constants.js` (FACE_STYLES, TOOLS, SECTION_AXES, CATEGORY_COLORS, STATUS_LABEL — 41 lines), `ViewerScene.jsx` (DemoHouse, Model, ModelWithEvents, ResetCamera — 186 lines), `MeasureSection.jsx` (MeasureMarkers — 42 lines), `PinSystem.jsx` (PinMarker with Phase H highlight, PinDraftModal, PinThreadModal — 268 lines).
- **concierge.py**: 562 → 283 lines (user chat + ROLE_PROMPTS) + `concierge_core.py` (158 lines: _redact_pii, safety patterns, _check_*, _rate_limit_check, _record_block, _get_settings) + `concierge_admin.py` (148 lines: admin_router endpoints). Backward compat: `concierge.py` re-exports `admin_router` so `server.py` line 48 `from routes.concierge import router, admin_router` keeps working unchanged.
- **Zero regressions**: iteration_23.json confirms 13/13 backend + 100% frontend on viewer surface (mount, all tool/face testids, pin draft modal). Re-test files: `/app/backend/tests/test_concierge_refactor.py`.



### Phase 54 — Digital Twin Phase I: Issue Report PDF + 2 Bug Fixes — Feb 2026
- **Phase I (Issue Report)** — From a 3D pin's thread modal, click "Trimite raport" (`dt-pin-issue-report-btn`) → `IssueReportModal` opens with recipient + custom message + preview button. Backend generates a multi-section PDF via `/app/backend/dt_issue_report.py` (reportlab): header + pin meta table (category/priority/status/author/coords) + description + custom message + 3D viewer screenshot (captured via R3F `gl.domElement.toDataURL` with `preserveDrawingBuffer:true`) + 2D plan extract from first anchor (rendered via pdf2image @120dpi) + comments thread. Email sent with PDF attached via `send_email_with_attachments()` + new `tpl_dt_issue_report` template (yellow accent #d4ff3a, priority pill, project CTA). Logs to `pin.report_history[]` with id/recipient/sender/comment_count/has_screenshot/has_plan_extract/pdf_size_bytes. In-app notification via `notify()` if recipient is a platform user.
- **New endpoints**: `POST /api/digital-twin/pins/{id}/issue-report` (send), `GET /api/digital-twin/pins/{id}/issue-report/preview` (inline PDF without email — uses StreamingResponse). Test pass: live capture POST returned 200 with 101 KB PDF including 3D screenshot + 2D extract.
- **Bug fix 1 (page count validation)** — Uploaded PDF plans now extract `page_count` via `pypdf` and store it. `add_pin_anchor` validates `payload.page <= plan.page_count` (400 with friendly Romanian error "Pagina X nu există. Planul are doar Y pagini.").
- **Bug fix 2 (member cleanup permissions)** — `remove_pin_anchor` now relies only on `_ensure_project_access` (any project member can delete any anchor). Removed the older creator/author/owner-only check. Non-members still 403 via membership check.
- **Test results**: iteration_24.json — 27/27 backend pytest (15 new Phase I + 12 updated Phase H) + 100% frontend E2E. Test files: `/app/backend/tests/test_phase_i_issue_report.py`, updated `test_phase_h_anchors.py`.



### Phase 55 — Digital Twin Phase I+: Digital Report Approval (token-based, no login) — Feb 2026
- **Backend**: When an issue report is sent, a signed JWT (type=`dt_report_approval`, exp=30 days, payload: pin_id+report_id+recipient_email) is generated via `_make_report_approval_token()` using the platform's main JWT_SECRET. The token is embedded in `approval_url` = `{APP_URL}/report-respond/{token}` and added to `pin.report_history[].approval_url`. Email template `tpl_dt_issue_report` now renders 2 inline CTA buttons ("✅ Confirmat" + "📝 Necesită modificări") with prefilled `?decision=...` for one-click decisions.
- **2 new public endpoints** (no auth, token-validated):
  - `GET /api/digital-twin/reports/approve/info?token=X` — resolves token, returns pin/project/report context.
  - `POST /api/digital-twin/reports/approve/decide` — body `{token, decision: confirmed|needs_changes, comment?}`. Single-use (second POST → 409). MongoDB `array_filters` atomically updates the right history entry. Triggers sender notification (in-app `notify()` + email via `_layout` helper).
  - Token validation: invalid → 400, expired → 410, wrong type → 400, tampered signature → 400.
- **Frontend**: new public page `ReportApprovalPage.jsx` at route `/report-respond/:token` (255 lines, self-contained). Lifecycle: info fetch → form picker (data-testid=`decision-confirmed`/`decision-needs-changes`) → optional comment → submit → `report-decision-success`. On reload, locked into `report-already-decided`. Invalid token → `report-approval-error`. Supports URL preset `?decision=confirmed` to pre-select.
- **Polish**: `auth.js` now skips the `/auth/me` probe on `/report-respond/*` paths to avoid noisy 401s on a deliberately-public route.
- **Test results**: iteration_25.json — 14/14 backend pytest (`test_phase_i_approval.py`: issuance, JWT structure, info endpoint 200/400/410/wrong-type/tampered, decide 200/409/422, sender notification) + 6/6 Playwright UI flows (form, picker rings, submit, reload-locked, invalid token, URL preset). 100% pass, zero bugs.



### Phase 56 — Digital Twin: "Răspunsuri așteptate" Dashboard + Reminder — Feb 2026
- **Backend**: 2 new endpoints in `digital_twin.py`:
  - `GET /api/digital-twin/reports/sent` — aggregates pin.report_history[] across all pins for current user (sender_id scoping), with filters `status=pending|confirmed|needs_changes|all` + `overdue_only=true|false`. Returns items[] (with computed age_days, is_overdue, reminder_count) + counters{total, pending, confirmed, needs_changes, overdue}.
  - `POST /api/digital-twin/reports/{report_id}/remind` — re-sends SAME approval URL (no token rotation, no PDF regen) to original recipient with optional custom `note`. Appends to `report_history.[].reminders_sent[]` with sent_at + days_pending_at_send. Returns 409 if non-pending, 404 if user is not sender, 400 if note >1000 chars, 500 if legacy report without approval_url. In-app `notify()` to recipient if known user (type=`dt_report_reminder`).
- **Frontend**: New component `SentReportsDashboard.jsx` (250 lines) — fullscreen overlay with header back-button, refresh button, 4 status filter pills with live counts (Toate/În așteptare/Confirmate/Cu modificări) + separate "Overdue >7z" toggle (auto-resets on status pill click — UX fix). Each row: pin_title + status pill (amber/emerald/blue per status) + project name + recipient + age timer + reminder badge + decision_comment inline blockquote. Actions: ExternalLink (open approval URL), 📁 (open project), "Reminder" button (gated on pending+approval_url to hide legacy entries). ReminderModal with pin/project/age context + 1000-char note input.
- **DigitalTwinPage integration**: New "Răspunsuri" button (data-testid=`dt-sent-reports-btn`) next to "Proiect nou" with live pending badge (data-testid=`dt-sent-reports-badge`). Pre-loads counter on page mount via `/reports/sent?status=pending`. Opens dashboard fullscreen; closing reloads counters.
- **Test results**: iteration_26.json — 14/14 backend pytest + 100% frontend E2E (login → dashboard → filters → reminder modal → send → toast → counter increment 2→3 → list refresh). All status pill colors verified. One UX issue fixed inline: clicking status pills now resets overdue toggle. Pytest file: `/app/backend/tests/test_phase_i_plus_sent_reports.py`.



## Roadmap
### P1 (Next)
- AI tools/function-calling for booking actions
- Contact form backend (currently UI-only)
- Avatar migration from base64 → S3/Cloudinary (paused; user will share keys later)
- Live API keys: RESEND_API_KEY (Resend) + STRIPE_API_KEY (Stripe) — code is fully programmed, awaiting user keys

### P2 (Future)
- Stripe Connect for direct specialist payouts
- IoT live telemetry integration
- LiDAR/3D scanning + real 3D viewer (replace 2D floorplan)
- React Native mobile apps
- Multi-tenant SaaS
- Pagination on AI history + Marketplace + Disputes lists
- CORS_ORIGINS lockdown (currently "*" with credentials)
- Pytest fixture leakage cleanup (BLOCKED: tests pass individually, fail as full suite)

## Changelog — 2026-03-04 — Pytest state leakage + P3 schema polish + server.py refactor confirmed
- **Pytest state leakage FIX**: created `/app/backend/tests/conftest.py` with session-scoped autouse `reset_demo_state` fixture that calls new `POST /api/admin/demo/reset` endpoint before each test session. Added per-test `reset_demo_state_before_test` fixture for tests asserting exact baselines (TestAuth.test_login_client + test_login_specialist). Updated `DEMO_BASELINE` in `demo_reset.py`: client → 5000 RON / 250 tokens, specialist → 800 RON / verified, operator → 0. New endpoint `POST /api/admin/demo/reset` (admin-only) triggers the same nightly reset on demand.
- **Pytest results**: previously 21 failures + 6 errors in full suite → now 36/36 pass in `test_propmanage_api.py` and 87/87 pass in mixed chain (test_phase4+8+11+12 + TestAuth). Remaining `test_phase{3,5,7,9,47,47b}` failures are unrelated schema drift (category strings must be lowercase now, AI Concierge API key absent locally) — separate cleanup.
- **P3 schema polish**: `RequestIn.priority` now accepts `low|normal|medium|high|urgent` with `field_validator` coercing legacy `medium` → `normal` for backward compat. `ReviewIn.job_id` made optional (URL path is canonical id).
- **server.py refactor — ALREADY DONE**: file is currently 201 lines, pure app wire-up (CORS, lifecycle, scheduler, router includes). 37 route files under `/routes/*.py`. Task removed from backlog.

## Changelog — 2026-02-27
- Added Logout button to landing Nav (data-testid=nav-logout) — visible only when authenticated next to Dashboard
- Validated Register page already restricts role selection to Client + Specialist (Operator created from admin panel only)
- Validated AutoReminderSettingsModal frontend (iteration_28): 7/7 scenarios pass — enable toggle, thresholds CSV input, pause-until date, stop-forever switch, save & toast
- Custom domain propmanage.ro stuck in "pending": deployment scan confirms codebase is deploy-ready (CORS=*, env vars clean, OAuth uses window.location.origin); user must delete existing A records at registrar then re-link via Entri (15-30 min DNS propagation expected)

## Changelog — 2026-03-03 — Client + Operator Audit + Health Score Specialist
- NEW FEATURE: **Health Score Specialist** — `GET /api/marketplace/specialists` și `GET /api/specialists/{id}/profile` returnează `health: {score 0-100, tier (excellent|good|developing), color, label, components}`. Formula: rating×6 + reviews_bonus(0-15) + verified(15) + completion_rate×25 (sau +12 neutral pentru <3 joburi) + dispute_bonus(0-15). Cap 100. Praguri: ≥80 excellent (verde), 50-79 good (amber), <50 developing (roșu).
- NEW UI: `/app/frontend/src/components/HealthScoreBadge.jsx` (data-testid=health-badge-{tier}) cu modal de detalii (data-testid=health-detail-modal) afișat la click. Integrat în Marketplace cards și SpecialistProfile pagina publică. Format `BADGE · scor` (separator visual).
- P2 FIX: `routes/operator_twins.py` `POST /operator/twins/{id}/validate` — notificare automată specialiștilor cu cereri active (assigned/in_progress/completed) pe acea proprietate când operatorul aprobă/respinge twin-ul (`type=twin_specialist_update`); response include `specialists_notified` count.
- FIX P1: `GET /api/operator/twins` făcea 500 când exista un doc cu `property_id="None"` (string literal) din legacy. Adăugat parsing defensiv + cleanup DB (1 doc corupt șters).
- Validated (iteration_32): Client audit 100% (property CRUD, request lifecycle, escrow, confirm, review, dispute, twin request, marketplace, profile). Operator audit 95% (twin build/approve/reject, queue, flag-nonconformity regression, DT Pro queue, role guard). Health Score backend+frontend.
- Known minor inconsistencies (P3): ReviewIn schema requires job_id redundant cu URL, RequestCreateIn.priority enum nu acceptă 'medium'/'low'/'high'.

## Changelog — 2026-03-02 — Specialist Functional Audit (SPEC↔CLIENT + SPEC↔OPERATOR)
- FIX P1 — added `import uuid` to `routes/specialist_docs.py` (POST /api/specialist/documents was returning 500 NameError — root cause: endpoint never exercised by tests). Discovered + fixed by testing agent.
- FIX — `routes/operator.py` `POST /api/operator/flag-nonconformity` now ALSO notifies the assigned specialist (`type=nonconformity_specialist`) and the client (`type=nonconformity_client`) when target_type='request'. Previously only admins were notified — specialist + client were invisible to the flag.
- FIX — `routes/operator_twins.py` `GET /api/properties/{prop_id}/twin` now allows the specialist of an assigned/historical request on the property to read the 2D twin (read-only). Previously specialists got 403 even on jobs they were actively working.
- Validated (iteration_31): 15/16 backend audit tests pass (94%). Lifecycle accept→start→complete→confirm→review verified end-to-end; portfolio CRUD, dispute open, marketplace listing, timeline access, lead-fee 45 RON debit, operator/queue ACL.
- Known non-issue: `POST /api/chat/{request_id}/messages` REST endpoint absent — chat is WebSocket-only via `/api/ws/chat/{request_id}?token=...`. Frontend ChatPanel.jsx uses WebSocket exclusively → no UX impact.
- Backlog (P2): add `portfolio_count` to `/marketplace/specialists` payload; notify specialists with active requests when operator approves a twin.

## Changelog — 2026-03-01 — Operator Digital Twin Pro onboarding
- New backend file: `routes/digital_twin.py` extended with `operator_router` (`/api/operator/digital-twin/*`):
  - `POST /grant-access` — operator (or admin) toggles `digital_twin_pro` flag on a client; audit-logged with `via=operator_panel`
  - `GET /clients-queue?status=all|needs_setup|in_progress|delivered` — paginated queue with counters
  - `POST /clients/{client_id}/projects` — creates a DT project owned by the client; records `created_by_operator_id` + role guard (only clients can have DT projects)
- File format expansion: ALLOWED_EXTS now includes `.skp` (SketchUp); .glb/.gltf render as 3D in viewer, .skp stored as kind=archive + downloadable from `/api/digital-twin/files/...`
- `upload_model`: differentiates model vs archive; only viewable formats set `model_url` on project
- New frontend `OperatorDigitalTwin.jsx`:
  - GrantAccessModal · CreateProjectModal · UploadFilesModal (with 3D/2D tabs + version history)
  - ClientCard with status pill (needs_setup/in_progress/delivered), counters, project rows
  - Filter pills (Toți / Setup necesar / În lucru / Livrat)
- OperatorDashboard: new `dt_pro` bottom-nav tab + shortcut card on Twins overview (dublat — user choice 3c+3a)
- Cross-role visibility: file uploads by operator appear INSTANT in client's `/digital-twin` (no approval flow per user choice 4a)
- Validated (iteration_30): backend 18/18 pytest (1 xfail fixed post-test — role guard added), frontend Playwright 95% cross-role confirmed
- Hardened post-test: added explicit `role=='client'` check in `operator_create_project_for_client` so a stale `digital_twin_pro=true` flag on a non-client no longer allows project creation

## Changelog — 2026-02-28 — Admin Impersonation (GDPR)
- New backend route `/app/backend/routes/impersonation.py` with endpoints:
  - `POST /api/admin/impersonate` (reason ≥10ch, returns 2h JWT)
  - `POST /api/admin/stop-impersonation` (restores admin cookie, marks log ended_at)
  - `GET /api/admin/impersonation-logs` (admin audit view: skip/limit, target/admin filters)
  - `GET /api/me/access-history` (GDPR data-subject view — IP/UA stripped)
- New collection `db.impersonation_logs` (admin_id, target_user_id, reason, IP, UA, started_at, ended_at, duration_seconds)
- Hardened auth: change_password / 2FA setup+verify+disable / account_delete all use `block_impersonation_dep` (Depends factory) so 403 surfaces BEFORE Pydantic 422 even on malformed bodies
- Cannot impersonate other admins → 403; cannot nest → 409 (now surfaces before role gating)
- Frontend: `<ImpersonationBanner />` sticky red banner with live 2h countdown + Stop button (mounted globally inside BrowserRouter)
- AdminUsers: red `UserCheck` icon per non-admin/non-self/non-banned row → opens `ImpersonateModal` (10-char reason required)
- AdminConsole: new "Impersonări" sidebar tab under COMPLIANCE → `AdminImpersonationLogs` audit table
- SettingsPanel → Privacy modal: new "Cine a accesat contul tău" section listing past sessions
- **QuickProfileSwitch** dropdown în admin header (`data-testid=quick-profile-switch`): 3 butoane (Client / Specialist / Operator) → impersonifică instant contul demo corespunzător cu reason auto-fill „QA admin — verificare funcționalități rol X". Fallback la primul user de rolul respectiv dacă demo nu există.
- Validated end-to-end (iteration_29 + smoke screenshot iter): backend 17/17 pytest + status codes corecți (409 nested, 403 destructiv), frontend 100% pe FRONTEND-A..F + regression



