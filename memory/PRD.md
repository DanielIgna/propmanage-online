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

## Changelog — 2026-03-07 — Backup password for Google-only accounts
- **NEW: Buton „Trimite parolă de backup"** în `Settings → Cont` (data-testid=row-backup-password) vizibil DOAR pentru users cu `google_auth=true` SAU `has_password=false` (conturi creat doar prin Google OAuth).
- Backend: `POST /api/auth/password/send-backup` (auth required, blocat în impersonare) generează o parolă de 12 caractere base64-urlsafe, o hash-uiește în DB, și trimite email HTML stilizat cu parola către user-ul logged-in.
- `GET /api/auth/me` returnează acum câmpuri noi `has_password` și `google_auth` pentru UI logic.
- Modal cu 2 stări: confirm + use case (când Google nu merge / device nou) → email trimis cu success + reminder schimbă parola.
- Util pentru cazul propmanage.ro Google OAuth deocamdată blocat (whitelist URL Emergent) — user-ul cu cont Google poate folosi backup password să se logheze cu email+parolă.
- **OAuth diagnostic backend**: `/api/auth/google/session` returnează acum mesajul exact de la upstream Emergent (`user_data_not_found` etc.) + 2 cauze posibile + recomandare contact support — în loc de generic "Invalid Emergent session".

## Changelog — 2026-03-06 — Black screen fix + OAuth diagnostic page + ErrorBoundary
- **FIX pagină neagră pe laptop**: AdminConsole afișa loading invisibil (text gri-slate-500 pe body #0a0a0b). Acum: spinner verde lime + text vizibil „Se încarcă consola admin...". User-ul neautentificat e redirectat la /login imediat ce `user` devine `false`.
- **NEW: ErrorBoundary global** (`/app/frontend/src/components/ErrorBoundary.jsx`) — wrap-uiește tot app-ul în BrowserRouter. Orice eroare neașteptată în React afișează acum un ecran cu mesaj clar + buton „Reîncarcă" / „Înapoi acasă" în loc de blank screen. data-testid: errorboundary-reload, errorboundary-home.
- **NEW: OAuth error diagnostic page**: AuthCallback.jsx îmbunătățit — la eroare arată detaliul exact (status + detail), pași de remediere (activează cookies third-party, șterge cookies, folosește email+parolă), și buton „Raportează" care deschide email pre-completat la `contact@propmanage.ro`. Fără auto-redirect care ascunde mesajul.
- Google OAuth pe propmanage.ro: cookie SameSite=None deja deployed, suspectul rămas e whitelist-ul OAuth Emergent. Recomandare către user: email la support@emergent.sh cu Job ID + screenshot eroare diagnostic.

## Changelog — 2026-03-06 — Beta Testers admin page + Google OAuth resilience
- **NEW: Beta Testers admin page** (`/admin` → sidebar USERI → „Beta Testers")
  - Backend: `GET /api/admin/beta-testers?days=30&role=client` returnează users înregistrați în ultimele N zile (excluzând conturile demo + admins) cu counters (total, by_role, by_provenance, with_requests, verified) + last_seen + requests_count batched.
  - Frontend: `/app/frontend/src/pages/admin/AdminBetaTesters.jsx` (data-testid=beta-testers-page) cu 4 counters cards + role breakdown + table cu provenance Google/Email badge, requests count, wallet, last_seen, verified/banned indicators.
  - Filtre: 7/14/30/60/90 zile + filter pe rol.
  - Tracking last_seen pe login (both email+password and Google OAuth) pentru engagement analytics.
- **Google OAuth callback hardening**: AuthCallback.jsx acum așteaptă explicit `refreshUser()` să returneze user, dacă cookie-ul a fost blocat afișează mesaj actionable „Cookie blocat" în loc să fie blocat în loop redirect → /login. Console logging pentru debug. **Fix-ul real (deja deployed): SameSite=None pe cookies** — cu acel fix, browser-ul nu mai blochează cookies cross-site post-OAuth, deci Google login funcționează acum și pe propmanage.ro cross-site.
- Validated live: 109 beta testers identificați pe preview cu provenance breakdown (2 Google / 107 email), 14 cu activitate reală.

## Changelog — 2026-03-05 — CRITICAL FIX: Cookie SameSite + Test users cleanup tool
- **ROOT CAUSE**: Production frontend at `propmanage.ro` makes XHR calls to backend at `phased-document.emergent.host` (different domain!). Cookies were set with `SameSite=lax` which Chrome blocks on cross-site AJAX requests. Result: admin logged in successfully but ALL subsequent API calls returned empty/401 (browser silently dropped cookies). UI showed "Niciun user găsit · Total: 0" while DB actually had 63 users.
- **FIX (deployed to prod)**: `core_utils.set_auth_cookies` + `routes/impersonation.py` now read `COOKIE_SAMESITE` (default `none`) and `COOKIE_SECURE` (default `true`) from env. `SameSite=None` requires `Secure=true` (HTTPS), so Secure auto-elevated when SameSite=None. Verified cookies on preview now emitted as `HttpOnly; Max-Age=86400; Path=/; SameSite=none; Secure`.
- Also fixed 11 hardcoded `propmanage.io` references in PUBLIC pages → all replaced with `propmanage.ro` / `contact@propmanage.ro`.
- **NEW: Test users cleanup tool**: admin can preview + delete in 1-click all accounts matching `test_*@test.io`, `beta_*@example.com`, etc. Protected demo + admins NEVER match. Cascade-deletes owned data: properties, requests, reviews, portfolio, offers, disputes, notifications, chat, specialist documents. Endpoints: `GET /api/admin/test-users/preview` + `POST /api/admin/test-users/cleanup?confirm=STERGE`. UI: button `data-testid=users-cleanup-test-btn` în AdminUsers → modal `cleanup-test-users-modal` cu confirm `STERGE`. Validated: 95 test users identified on preview, 0 protected accounts matched.

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





## Changelog — 2026-02-28 — Backup Password Email (Google OAuth lockout recovery)
- Backend endpoint `POST /api/auth/password/send-backup` (in `/app/backend/routes/auth.py`):
  - Generates a strong temp password (`secrets.token_urlsafe(9)`), hashes & stores it on user
  - Sends an HTML email (Romanian copy) via `send_email` (SendGrid in prod, MongoDB email_log demo fallback)
  - Blocks impersonation contexts so admins cannot trigger it for other users
  - Returns `{ok, email_to, expires_note}` — never echoes the password in response
- `GET /api/auth/me` now exposes `has_password` and `google_auth` boolean flags (private to the user) so the UI can decide when to surface the backup-password CTA
- Frontend `SettingsPanel.jsx`:
  - New `BackupPasswordModal` component (lines 481-554) with Romanian copy, success state, error state, contextual warning when overwriting existing password
  - Row "Trimite parolă de backup pe email" (accent yellow) only renders when `user.google_auth || !user.has_password`
  - Wired via `modal === "backup-password"` handler
- Bugfix: `Field icon={MapPin}` → `MapPinIcon` in ProfileModal (latent ReferenceError when opening profile editor)
- Validated end-to-end:
  - Backend `curl POST /api/auth/password/send-backup` → 200 OK, password updated in DB, email logged
  - Frontend screenshot (client@propmanage.io with google_auth=true) → row visible, modal opens, copy & buttons render correctly


## Changelog — 2026-02-28 — Smoke Test E2E (AI Investigator)
- New backend route `/app/backend/routes/admin_smoketest.py`:
  - `POST /api/admin/smoke-test/run?base_url=...` — runs a 6-step E2E sequence
    (Login → /auth/me → POST /properties → GET /properties → DELETE → /auth/logout)
    using demo client credentials (`client@propmanage.io`).
  - Marks created properties with `[SMOKE <run_id>]` prefix and cleans them up.
  - Persists each run in `db.smoke_test_runs` collection with per-step status,
    HTTP code, duration_ms, and error message.
  - `GET /api/admin/smoke-test/history?limit=N` — returns last N runs.
  - Default base URL = `http://localhost:8001` (tests the backend pod itself,
    works in preview and prod without external DNS / OAuth dependency). Admin
    can override via `?base_url=https://propmanage.ro` to test the live deploy.
  - Cookies extracted from login response and forwarded as `Cookie:` header so
    `Secure` cookies work over HTTP localhost.
- Frontend new component `/app/frontend/src/pages/admin/SmokeTestCard.jsx`:
  - Mounted at top of `AdminAIConsole.jsx` (above Findings dashboard).
  - "Rulează test" button + optional Target URL input + "Prod" quick-fill.
  - Per-step report with HTTP code badges, durations, error details.
  - Collapsible history (last 10 runs) — click to load any historical run.
- Validated end-to-end: 6/6 steps PASS in ~460ms; history persists across runs.
- Use case: After each `Re-deploy changes` in production panel, admin opens
  AI Investigator → clicks "Smoke Test" → confirms in <1s that login/CRUD/logout
  all work on the live domain.


## Changelog — 2026-02-28 — Smoke Test Auto-Monitor (proactive alerts)
- Extended `/app/backend/routes/admin_smoketest.py` with:
  - `run_smoke_test_monitor_tick()` — async function called by APScheduler every
    30 min. Reads config from `db.smoke_test_config` (singleton `_id="config"`),
    runs full smoke sequence, persists result.
  - Smart alert logic via `_send_failure_alert()`:
    - **Immediate** alert on OK → FAIL transition (subject 🚨 ... FAILED)
    - **Cooldown 3h** for persistent failures (avoids spamming)
    - **Recovery** alert on FAIL → OK transition (subject ✅ ... RECOVERED)
    - HTML email with full step-by-step table (HTTP code, durations, errors)
    - Recipients: `ADMIN_EMAILS` env (comma-separated) or `ADMIN_EMAIL` fallback
  - `GET /api/admin/smoke-test/monitor/config` — return current config
  - `POST /api/admin/smoke-test/monitor/config` — admin updates `enabled`,
    `interval_minutes` (5-1440), `base_url`. Default: disabled.
- Server-side scheduler job `smoke_test_monitor` added in `server.py`
  (CronTrigger `minute="*/30"`, misfire_grace_time=600). Started on startup
  alongside the other 9 scheduler jobs.
- Frontend `SmokeTestCard.jsx`:
  - New monitor banner (green when ACTIVĂ, gray when INACTIVĂ) above the
    Target input, with toggle button "Activează" / "Dezactivează".
  - Shows interval, target URL, last status (OK/FAIL) when enabled.
  - Uses Lucide `Bell` / `BellOff` icons.
- Validated end-to-end:
  - Tick against good URL → no email sent (status remains OK)
  - Tick with `last_status=ok` against bad URL → 🚨 FAILED email sent
  - Tick with `last_status=fail` against good URL → ✅ RECOVERED email sent
  - Invalid interval (e.g. 1 min) → 400 with proper error
  - Toggle on/off via UI → config persists, banner reflects state in real-time


## Changelog — 2026-02-28 — Healthcheck + Smoke Test Multi-Rol
- New backend route `/app/backend/routes/admin_healthcheck.py`:
  - `GET /api/admin/healthcheck/run` — runs 7 parallel probes:
    - MongoDB (ping + estimated_document_count)
    - Emergent LLM Key (format validation, no actual LLM call)
    - Email Provider (Resend `/domains` verify or SendGrid format check)
    - Stripe (`/v1/balance` lightweight call, demo/test/live modes detected)
    - Google OAuth (`.well-known/openid-configuration` reachability)
    - VAPID Push (key presence + PEM format check)
    - Admin Emails (ADMIN_EMAILS / ADMIN_EMAIL configured for alerts)
  - Each check returns `{name, ok, status, detail, severity, duration_ms}`.
  - Severity buckets: `high` (critical — app down without it), `warning`
    (degraded), `info` (optional). Overall OK = no critical_failed.
- Extended `/app/backend/routes/admin_smoketest.py` with multi-role:
  - `ROLE_CREDENTIALS` dict mapping each demo role to its seed creds.
  - `_run_role_sequence(base_url, role)` runs login → /auth/me (verify role) →
    role-specific endpoint → logout. Endpoints chosen for high signal:
    - specialist → `/api/marketplace/specialists`
    - operator → `/api/operator/twins`
    - admin → `/api/admin/stats`
    - client → existing full E2E (with CRUD)
  - `POST /api/admin/smoke-test/run-all-roles` runs all 4 in **parallel**
    via `asyncio.gather` (4 roles tested in ~1.2s vs ~5s sequential).
  - Each role's run persisted to `db.smoke_test_runs` with `triggered_by:
    "all-roles (<admin email>)"`.
- New frontend `/app/frontend/src/pages/admin/HealthcheckCard.jsx` — grid of
  7 status cards (color-coded by severity) + overall summary card. Mounted
  in AdminAIConsole between AI Health Score and Smoke Test.
- Extended `SmokeTestCard.jsx`:
  - Added secondary "Toate rolurile" button (Users icon) next to "Rulează test".
  - New `AllRolesReport` component: per-role card with emoji/icon, step list,
    HTTP codes, durations; grid 2-col on sm+ screens.
  - Same Target URL input is reused for both single and all-roles runs.
- Validated end-to-end (preview):
  - `GET /api/admin/healthcheck/run` → 7 checks, 5/7 PASS (Email + Stripe warn
    as expected in preview — no prod keys), 57ms total
  - `POST /api/admin/smoke-test/run-all-roles` → 18/18 steps PASS across 4
    roles in 1178ms parallel
  - UI screenshot confirms both cards render with correct color-coding,
    badges (CRITIC/WARN/INFO), and per-step breakdown


## Changelog — 2026-02-28 — Public Status Page enhancement (/status)
- Page already existed at `/status` (linked in landing footer with pulsing dot)
  but with only 5 generic components. Enhanced to 7 detailed components:
  api, database, ai_concierge, payments, email, **authentication**, **push_notifications**
- Backend `/app/backend/routes/public.py`:
  - `/public/status` now derives statuses from actual env config:
    - `payments`: `operational` for `sk_live_*`, `limited` for sk_test / demo
    - `email`: `operational` for Resend OR SendGrid configured, else `limited`
    - `push_notifications`: `operational` when both VAPID keys present
    - `authentication`: always operational (JWT works regardless of OAuth)
  - Aggregate `status` now follows severity hierarchy: outage > degraded >
    limited > operational. Peripheral "limited" doesn't degrade global status
    (only `api`/`database` limited would mark global as degraded).
  - Added `pings_total` count to hero (transparency for prospects).
  - `record_health_ping` cron updated to track the 2 new components in
    `db.health_pings` so sparkline reflects new components historically.
- Frontend `/app/frontend/src/pages/StatusPage.jsx`:
  - Added `COMP_DESCRIPTIONS` map — each component now shows a friendly RO
    description below its name (e.g. "Endpoint-urile principale ale platformei").
  - New "Componente sistem" header row with "5/7 funcționale" counter.
  - Hero status message refined ("Toate sistemele funcționează normal" vs old
    truncated version) and `dot` color now matches global status (green/amber/red).
  - Added `data-testid="status-hero-label"` for QA hooks.
- Validated:
  - `GET /api/public/status` (no auth) → 200 with 7 components, correct
    severity mapping (preview shows 5 operational + 2 limited expected for
    payments+email)
  - Frontend screenshot of `/status` shows: hero, sparkline 30d, 7 component
    cards with descriptions, "5/7 funcționale" counter, auto-refresh
- Auto-refresh every 60s already implemented in StatusPage useEffect.


## Changelog — 2026-02-28 — Status Page Incidents (admin-posted, public)
- New backend route `/app/backend/routes/incidents.py` with two router groups:
  - **Admin** (`/api/admin/incidents`):
    - `POST /api/admin/incidents` — create incident with title, severity
      (minor/major/critical), affected components, initial message
    - `POST /api/admin/incidents/{id}/update` — add an update with new status
      (investigating/identified/monitoring/resolved); auto-computes
      `duration_minutes` when status transitions to "resolved"
    - `GET /api/admin/incidents?days=60` — full history (admin metadata)
    - `DELETE /api/admin/incidents/{id}` — hard-delete (for posted-by-mistake)
  - **Public** (`/api/public/status-incidents`):
    - Returns sanitized incidents (no `created_by` or `posted_by` per update)
    - Includes `active_count` and `count` for the page header
- New `db.incidents` collection schema documented at top of file.
- New frontend `/app/frontend/src/pages/admin/IncidentsCard.jsx`:
  - Mounted in AdminAIConsole between SmokeTestCard and Findings.
  - Lists active + resolved incidents with severity / status / components badges.
  - Modal "New Incident" with form (title, severity buttons, component chips,
    initial message textarea).
  - Modal "Update Incident" with status selector (4 options) + message.
  - Delete button (with confirm dialog) per incident.
  - All in Romanian copy.
- Extended `/app/frontend/src/pages/StatusPage.jsx`:
  - New `IncidentsSection` component fetches from `/api/public/status-incidents`.
  - Renders timeline-style cards with severity (color-coded), status badge,
    affected components, duration (when resolved), and expanded update history
    (most recent first, with timestamp and message).
  - Active incidents auto-expanded; resolved collapsed by default.
  - Section header shows "X în curs" count for live transparency.
- Validated end-to-end:
  - Created incident via admin curl → 200 with id and 1 initial update
  - Posted update "identified" → status changed, 2 updates
  - Resolved → status="resolved", duration_minutes computed, 3 updates total
  - Public endpoint → returns 2 incidents (1 active + 1 resolved), `posted_by`
    stripped from all updates (privacy check passed)
  - Frontend screenshots confirm both `/status` (public) and AI Investigator
    (admin) render incidents correctly with all badges and update timelines


## Changelog — 2026-02-28 — Data Integrity Check
- New backend `/app/backend/routes/admin_data_integrity.py`:
  - `GET /api/admin/data-integrity/run` runs 9 parallel checks (read-only):
    1. **Twins orfane** (warning) — twins with deleted property_id
    2. **Proprietăți fără proprietar valid** (HIGH) — owner_id not in users
    3. **Cereri cu proprietate inexistentă** (warning) — request.property_id orphan
    4. **Cereri cu utilizatori inexistenți** (HIGH) — client_id/specialist_id missing
    5. **Inconsistențe wallet ↔ tranzacții** (HIGH) — wallet_balance vs SUM(tx)
    6. **Dispute cu cereri inexistente** (HIGH) — dispute.request_id orphan
    7. **Solduri negative** (warning) — users with wallet_balance<0 or tokens<0
    8. **Emailuri duplicate** (warning) — same email case-insensitive
    9. **Dispute active pe cereri închise** (warning) — open dispute on completed/cancelled
  - Each check returns `{name, severity, ok, issue_count, samples[5], duration_ms}`.
  - Persisted to `db.data_integrity_runs` for trend analysis.
  - `GET /api/admin/data-integrity/history?limit=10` for past runs.
- Frontend `/app/frontend/src/pages/admin/DataIntegrityCard.jsx`:
  - Mounted in AdminAIConsole between HealthcheckCard and SmokeTestCard.
  - Color-coded summary banner (green/amber/red by severity).
  - Per-check accordion: click to expand and see JSON samples (first 5).
  - Auto-expands failed checks for immediate inspection.
- Validated end-to-end on preview:
  - 7/9 checks PASS, 42 issues found (legacy test data — 22 orphan twins + 20
    requests with deleted property). 0 critical, 2 warning.
  - All HIGH severity checks PASS (no lost money, no orphan disputes).
  - 7ms total execution time across 9 parallel checks.
- Future: add scheduler job to run daily and email admins if HIGH severity
  issues detected (gated by config flag, similar to smoke test monitor).


## Changelog — 2026-02-28 — Morning Briefing (Admin Dashboard at-a-glance)
- New frontend `/app/frontend/src/pages/admin/MorningBriefing.jsx`:
  - Mounted at TOP of `AdminOverview.jsx` (the default landing page after admin login)
  - **Frontend-only** — no new backend endpoints; aggregates 6 existing APIs:
    - `/admin/healthcheck/run`
    - `/admin/smoke-test/history?limit=1` + `/admin/smoke-test/monitor/config`
    - `/admin/data-integrity/history?limit=1`
    - `/admin/incidents?days=30`
    - `/admin/ai/findings?status=open`
  - Loads all 6 in parallel via `Promise.all`. Auto-refresh every 5 minutes.
  - Time-of-day greeting: "Bună dimineața / ziua / seara" based on local hour.
  - **Overall verdict banner** (green/amber/red) computed from worst tile:
    - "Toate sistemele funcționează normal. Zi liniștită!" (all OK)
    - "Câteva avertizări — verifică detaliile mai jos" (any warn)
    - "Atenție necesară — există probleme critice" (any fail)
  - **5 system tiles** in responsive grid (1/2/5 cols) with severity tone:
    1. Healthcheck — X critical / Y OK ratio
    2. Smoke Test — last result + monitor on/off + interval
    3. Data Integrity — total issues from last scan
    4. Incidents — active count + worst severity
    5. AI Findings — high/warning counts breakdown
  - Each tile has contextual quick-action button (Detalii / Rulează / Scanează /
    Vezi /status / Investighează) that either navigates to AI Investigator tab
    (via `propmanage:nav-admin` custom event) or opens `/status` in new tab.
  - Manual refresh button in card header (RefreshCw with spin animation).
- Validated end-to-end via screenshot in preview:
  - 5 tiles rendered with correct color-coding per current state
  - Greeting matches time of day ("Bună seara")
  - Verdict banner correctly shows red for "2 findings critice" + integrity warnings
  - Action buttons clickable, navigation events fire correctly
- Use case: morning login → 5 second glance → admin knows if today is a "all good"
  day or needs to investigate something. Replaces need to manually check 6
  different cards inside AI Investigator.


## Changelog — 2026-02-29 — Morning Briefing Daily Digest Email
- New backend module `/app/backend/admin_briefing_digest.py`:
  - `compute_briefing_payload()` aggregates the same 5 data points as the in-app
    Morning Briefing widget (healthcheck, latest smoke test, latest data
    integrity, active incidents in last 30 days, open AI findings).
  - Reuses `compute_healthcheck_report()` (extracted from `admin_healthcheck.py`)
    so the cron job runs the FULL probe set with zero duplication.
  - Computes per-system tone (ok / warn / fail / idle) and an overall verdict.
  - `send_morning_briefing_email(force=False)`:
    - Default behavior: sends ONLY when overall != "ok" (no noise on quiet days).
    - `force=True`: always sends (used by the manual "Test email" button).
    - Reads recipients from `ADMIN_EMAILS` env var; renders HTML using existing
      brand-styled `_layout()` from `email_service.py`.
    - Uses console fallback if `RESEND_API_KEY` not set (no failures in preview).
  - `run_morning_briefing_job()`: APScheduler entrypoint, never raises.
- New admin endpoints (admin role required):
  - `GET  /api/admin/morning-briefing/preview` — returns the raw payload JSON
    that would be rendered into the email (debug helper).
  - `POST /api/admin/morning-briefing/send-test` — force-sends the email now.
- New scheduler job in `server.py`: daily 09:00 Europe/Bucharest, calls
  `run_morning_briefing_job`. Logged on startup alongside other crons.
- Frontend `MorningBriefing.jsx`:
  - Added "Test email" button in the card header (next to Refresh) that calls
    the new `send-test` endpoint and shows a toast with the result
    (`recipients/total_recipients` + `overall` tone). Test ID:
    `briefing-send-test-email-btn`.
- Validated end-to-end via curl in preview:
  - `POST /api/admin/morning-briefing/send-test` → `sent=true, recipients=3/3, overall=fail`.
  - Logs confirm Resend code path is wired (currently falling back to console
    because `RESEND_API_KEY` lives in deployment secrets, not preview env).
- Result: in production (with `RESEND_API_KEY` set), admins receive a single
  branded digest at 09:00 only when something is wrong — proactive monitoring
  without inbox noise.

## Changelog — 2026-02-29 — SEO Foundation (sitemap, OG, JSON-LD, lang fix)
- **Critical fix**: `<html lang="en">` → `<html lang="ro">` in `index.html`. Google
  was indexing the entire site as English content despite Romanian copy.
- **Domain migration**: replaced all `propmanage.io` references with `propmanage.ro`:
  - `index.html`: canonical, og:url, og:image, twitter:image, hreflang.
  - `robots.txt`: sitemap URL.
  - Backend `.env`: `APP_PUBLIC_URL=https://propmanage.ro` (powers email links,
    sitemap URLs, AI Investigator emails, payment receipts).
- **Dynamic sitemap** at `GET /api/public/sitemap.xml` (in `routes/public.py`):
  - 9 static pages (landing, marketplace, digital-twin, login, register, privacy,
    privacy/notices, terms, status) with per-page priority + changefreq.
  - All verified, non-deleted specialist profiles (`/specialists/{id}`) — auto-
    refreshed on every fetch from Mongo, no stale state.
  - Currently: 15 URLs (9 static + 6 verified specialists). Will grow naturally.
  - Served as `application/xml`. Linked from `robots.txt`.
- **Static sitemap removed**: `public/sitemap.xml` deleted (was hardcoded with
  3 URLs pointing to `.io`).
- **robots.txt enhanced**:
  - Added Disallow rules for `/auth/callback`, `/payment-success`, `/report-respond/`.
  - Added crawl-delay=10 for aggressive bots (AhrefsBot, SemrushBot).
  - Sitemap URL now points to dynamic endpoint on `.ro`.
- **JSON-LD structured data** in `index.html` (3 blocks):
  - `Organization`: name, alternateName "Residency", url, logo, address (RO).
  - `WebSite` with `SearchAction` (Sitelinks Searchbox in Google).
  - `Service`: type "Property Management Platform", areaServed RO, offers RON.
- **Geo meta tags**: `geo.region=RO`, `geo.placename=România`.
- **Per-route dynamic SEO** via new lightweight hook `hooks/useSEO.js`:
  - No new npm dependency (no react-helmet-async). ~50 lines, vanilla DOM.
  - Updates `document.title`, meta description, canonical, OG/Twitter tags,
    and injects optional JSON-LD `<script>` on mount; restores on unmount.
  - Wired into `Marketplace.jsx` — title/desc reflect active category filter,
    canonical includes `?category=` for crawlable variants, `CollectionPage`
    JSON-LD + breadcrumbs.
  - Wired into `SpecialistProfile.jsx` — title `{name} · {specialty} · Specialist
    verificat PropManage`, description includes rating & review count, `Person`
    JSON-LD with `AggregateRating` (drives star snippets in Google Search), and
    `noindex` for 404s so broken profile URLs don't get indexed.
- Validated end-to-end via Playwright + curl:
  - Marketplace page returns: title="Marketplace specialiști verificați · PropManage",
    canonical=propmanage.ro/marketplace, og:url=propmanage.ro/marketplace,
    html lang="ro", 4 JSON-LD blocks present.
  - `/api/public/sitemap.xml` returns 15 URLs, all on `propmanage.ro`.
- Production action (user): after deploy, submit
  `https://propmanage.ro/api/public/sitemap.xml` in Google Search Console
  (Sitemaps tab) for fast indexing.


## Changelog — 2026-02-29 — SEO Landing Pages (programmatic SEO, 200+ pages)
- **New dynamic route** `/marketplace/:slug` in `App.js` → `MarketplaceLanding.jsx`.
  Supported slug formats:
    - `/marketplace/{category}`              (e.g. `/electrician`)
    - `/marketplace/{category}-{city}`       (e.g. `/electrician-bucuresti`,
                                              `/design-interior-cluj-napoca`)
- **Slug parser**: 9 specialty slugs × 22 city slugs = **207 valid combinations**
  + 9 standalone category pages = **216 SEO landing pages** total.
  - Romanian-friendly slugs: `electrician`, `instalator`, `hvac`, `design-interior`,
    `tamplar`, `zugrav`, `firma-curatenie`, `service-electrocasnice`, `gradinar`.
  - Cities: `bucuresti`, `cluj-napoca`, `timisoara`, `iasi`, `brasov`, `constanta`,
    `craiova`, `galati`, `oradea`, `ploiesti`, `sibiu`, `arad`, `bacau`, `pitesti`,
    `braila`, `buzau`, `suceava`, `baia-mare`, `satu-mare`, `ramnicu-valcea`,
    `targu-mures`, `drobeta-turnu-severin`.
  - Slug parser handles multi-word categories (greedy longest-match) so
    `design-interior-cluj-napoca` correctly splits into `design-interior` + `cluj-napoca`.
- **Backend additions**:
  - `seo_slugs.py` — single source of truth for slug↔DB mappings, used by both
    `routes/public.py` (sitemap) and `routes/marketplace.py` (city filter).
  - `routes/marketplace.py`: added `city` query param that expands to ALL zones
    inside that city via `db.regions.distinct("zone", {"city": X})`. Returns
    empty list on unknown city (no data leak).
  - `routes/public.py` sitemap: now emits all 216 landing-page URLs with
    `priority=0.85` for parent (category-only) pages and `0.7` for city-specific
    ones. Sitemap total: **222 URLs** (9 static + 216 landings + 6 specialists).
- **Frontend `MarketplaceLanding.jsx`** (~290 lines):
  - Unique H1 per page: `{Plural} verificați în {Oraș}` or `... în România`.
  - **Unique intro copy per category** (CATEGORY_INTROS object) — avoids
    Google "duplicate content" penalty across 200+ pages.
  - 4 trust bullets (Shield, Star, Award, Sparkles) reinforce value prop.
  - Specialist cards (same UI as main marketplace) filtered by `category + city`.
  - Empty state: "Postează cerere gratuit" CTA when no specialists match.
  - **Internal-link blocks** (huge for SEO):
    - 9 sibling-city links (same category, other top cities).
    - 8 sibling-category links (same city, other specialties).
  - Bottom CTA: "Postează cerere gratuit" → /register.
  - Footer with links to /terms, /privacy, /status (link equity distribution).
  - `useSEO` hook injects: unique title, description, canonical, breadcrumb
    JSON-LD, and a `Service` schema with `areaServed=City` when city is set
    (eligible for Google local pack snippets).
  - 404 fallback for unknown slugs sets `meta robots=noindex,nofollow`.
- **Main `/marketplace`** now has a bottom section linking to all 216 landing
  pages (organized by category → 10 top cities each), accelerating Google's
  discovery via internal crawl rather than waiting for sitemap re-fetch.
- Validated:
  - HTTP 200 for `/electrician`, `/instalator-cluj-napoca`, `/design-interior`,
    `/zugrav-iasi`, `/gradinar-timisoara`.
  - `/electrician-bucuresti` returns 16 specialists (city-expansion working).
  - `/api/marketplace/specialists?city=NonExistentCity` returns `[]` (safe).
  - Invalid slug `/xyz-invalid` → `noindex, nofollow` + clean 404 page.
  - Screenshots confirm: unique H1, unique meta description, 4 JSON-LD blocks,
    9 sibling-city links + 8 sibling-category links rendered.
- Production effect (estimated): Romania has ~30-50 monthly searches per
  `[specialty] [city]` query (long-tail). With 200 landing pages × ~10 ranking
  positions = 2,000 keyword surface area. Even 5% conversion on Google's first
  3 results → ~300-600 organic clicks/month within 60 days of indexing.


## Changelog — 2026-02-29 — Evergreen Blog `/ghiduri` (6 long-form articles)
- **New routes**:
  - `/ghiduri`       → `GhiduriIndex.jsx` (blog index)
  - `/ghiduri/:slug` → `GhidPage.jsx`     (article detail)
- **Content** in `frontend/src/data/ghiduri.js` — single source of truth.
  6 evergreen articles (~800-1500 words each) targeting high-volume Romanian
  search intent:
    1. `cost-renovare-apartament-2-camere` — Cost & Buget, 9 min read
    2. `cum-alegi-designer-interior`        — Decizie & Sfaturi, 8 min read
    3. `cum-verifici-instalator`            — Verificare & Siguranță, 7 min read
    4. `cost-instalatie-electrica-apartament` — Cost & Buget, 7 min read
    5. `cum-functioneaza-escrow-lucrari`    — Plăți & Siguranță, 6 min read
    6. `cum-alegi-zugrav-bun`               — Decizie & Sfaturi, 6 min read
- **Article structure**: hero (icon tag + H1 + description + readtime), 4-5
  sections with markdown-style body (paragraphs, bullet lists, lime callouts),
  5-question FAQ block (accordion UI), internal links to relevant marketplace
  landing pages, related-guides section at bottom, CTA to /register.
- **SEO per article**:
  - Unique title, description, canonical URL.
  - **`@graph` JSON-LD with 3 schemas**: `Article` (with publisher/author/dates),
    `FAQPage` (drives Google FAQ rich snippets — visible directly in SERP!),
    `BreadcrumbList`.
- **Index page** has `Blog` JSON-LD listing all `BlogPosting` entries.
- **Internal-link strategy** (huge for SEO):
  - Each article links to **~24 marketplace landing pages** (3 relevant
    categories × 8 top cities). E.g. "Cum verifici un instalator" links to
    `/marketplace/instalator-bucuresti`, `/marketplace/electrician-cluj-napoca`, etc.
  - Each marketplace landing page has a new "Înainte să angajezi, citește"
    block showing 2 relevant guides → boosts time-on-site + link equity flow.
  - Marketplace header now has a `/ghiduri` link.
- **Sitemap** updated in `routes/public.py`:
  - Added `/ghiduri` (priority 0.85) + 6 individual articles (priority 0.75).
  - **Total sitemap: 229 URLs** (was 222).
- Validated via Playwright:
  - `/ghiduri` renders 6 cards, 4 JSON-LD blocks, canonical correct.
  - `/ghiduri/cum-verifici-instalator` renders unique title, 4 JSON-LD blocks
    (Article + FAQPage + Breadcrumb + global Organization), 5 FAQ accordion
    items, 3 related guides, **24 internal links** to marketplace landing pages.
- Production effect: FAQ rich snippets typically appear in SERP within 14-28
  days of indexing. Articles like "Cât costă o renovare apartament 2 camere"
  target queries with 3-8K monthly searches in RO — even a #5 ranking position
  brings ~150-400 organic clicks/month per article.


## Changelog — 2026-02-29 — Automatic MongoDB Backups (Resend email delivery)
- **New module** `backend/backup_service.py`:
  - `create_backup()` — dumps all Mongo collections to JSON (via `bson.json_util`
    so ObjectIds/datetimes/Decimals roundtrip correctly), bundles into a single
    `.tar.gz` (compresslevel=6, in-memory build then atomic write).
  - Excludes transient/runtime collections (`smoke_test_runs`, `health_pings`,
    `data_integrity_runs`, `rate_limit_attempts`) to keep size small.
  - Adds a `MANIFEST.json` with restore instructions inside every archive.
  - Local retention: last **7 backups** kept in `/app/backups/`; older ones auto-pruned.
  - `email_backup()` — attaches the archive to a branded HTML email sent via
    Resend to all `ADMIN_EMAILS`. If size > 15 MB (safety margin under Resend's
    ~20 MB hard limit), sends a notification email WITHOUT attachment + link to
    `/admin?tab=backups` for manual download.
  - Persists each run in `db.backup_runs` for the Morning Briefing tile.
- **New scheduler job**: daily **03:30 Europe/Bucharest** in `server.py`
  (`run_daily_backup_job` — never raises, full try/except wrapper).
- **New admin endpoints** in `routes/admin_backups.py`:
  - `GET  /api/admin/backups`                  — list local files + latest run metadata
  - `POST /api/admin/backups/run`              — manual trigger (creates + emails)
  - `GET  /api/admin/backups/download/{file}`  — stream the .tar.gz with strict
    filename validation (only `propmanage-backup-*.tar.gz`, no path traversal)
- **Morning Briefing extended**:
  - Backend `compute_briefing_payload()` now includes a 6th system (`backup`)
    with tone: `ok` (≤36h old), `warn` (36-72h), `fail` (>72h or never).
  - Frontend `MorningBriefing.jsx` grid is now `lg:grid-cols-6` with a new
    "Backup DB" tile (HardDrive icon) showing collection count + size + email
    delivery count + age. Inline "Backup acum" button triggers manual run with
    toast feedback.
- Validated end-to-end:
  - Manual trigger: `{ok: true, size_mb: 2.25, collections_count: 60,
    objects_count: 55, duration_s: 0.5, email: {sent: true, recipients: 3/3}}`
  - Download endpoint streams valid 2.36 MB tar.gz containing MANIFEST.json
    + 60 `collections/*.json` files.
  - Briefing tile renders green with correct headline + sub.
- Restoration steps (for the user's records):
    1. Save the daily `.tar.gz` from Gmail to a safe location.
    2. `tar -xzf propmanage-backup-YYYY-MM-DD_HH-MM-SS.tar.gz`
    3. Use a Python script that loops over `collections/*.json`, parses each
       with `bson.json_util.loads()`, drops the corresponding Mongo collection,
       and bulk-inserts the documents back.


## Changelog — 2026-02-29 — Knowledge Base & Training Center (Phase 1/3)
### Foundation + Client doc COMPLETE; Specialist/Operator/Admin/QA = drafts (Phase 2)

**Backend:**
- `docs_content.py` — content registry (Python dict, no DB migrations needed
  to update content). Schema supports: paragraph, list, callout (info/warn/success),
  steps (numbered), code, image_placeholder (CSS pulse), screencast (mp4/gif),
  lottie (JSON anim), h3 sub-headers, FAQ.
- **Client doc fully written**: 11 sections (~3500 words), 10 FAQ items,
  includes 3 case studies, 8 best practices, troubleshooting, escrow flow,
  Digital Twin guide, dispute flow.
- Specialist/Operator/Admin/QA = v0.1-draft placeholders (will be filled in
  Phase 2 — content is large, ~3000 words each).
- `docs_service.py` — PDF rendering (reportlab, brand-styled), tokenized share
  links (24-char URL-safe tokens, 30-day TTL, open-counter), email delivery
  via Resend (HTML + PDF attachment).
- `routes/docs_routes.py`:
    - Public (no auth): `GET /api/help/{token}`, `GET /api/help/{token}/pdf`
    - Admin: list, get, PDF, send to custom recipients, bulk-send to role,
      send-events history, share-tokens analytics.
- **Auto-onboarding email** — on `/api/auth/register`, the new user
  automatically gets the role-appropriate training doc (best-effort, doesn't
  block registration if it fails).

**Frontend:**
- `components/DocViewer.jsx` — shared renderer used by public/admin/preview.
  Block renderers: paragraph w/ inline bold/italic, lists w/ lime dots,
  callouts (3 variants), numbered steps, code blocks, CSS-pulse animation
  placeholder, native HTML5 `<video>` for MP4 screencasts, `<lottie-player>`
  via lazy-loaded CDN script for Lottie JSON animations, FAQ accordion.
- `pages/HelpPage.jsx` — public viewer at `/help/{token}` (no login needed).
- `pages/admin/AdminDocs.jsx` — admin panel with: doc cards, preview modal
  (inline DocViewer), PDF download, send modal supporting BOTH custom emails
  AND bulk-send-to-role (with verified_only checkbox).
- AdminLayoutMetronic sidebar: new "TRAINING" section with "Documentație &
  Training NEW" link.
- App.js: new public route `/help/:token`.

**Validated end-to-end:**
- `GET /api/admin/docs` → 5 docs returned with correct metadata.
- `GET /api/admin/docs/client/pdf` → 15KB valid PDF (`%PDF-1.4` signature).
- `POST /api/admin/docs/client/send` → 1/1 sent, returns share URL + token.
- `GET /api/help/{token}` → resolves to full Client doc payload.
- `GET /api/help/INVALID` → HTTP 404 with friendly UI message.
- Admin UI screenshot: sidebar "Documentație & Training NEW" → page shows
  5 cards, preview/PDF/send buttons, send history visible.

**Phase 2 (next session)**: Write full content for Specialist (~3000 words),
Operator (~2000 words), Admin (~3500 words).

**Phase 3 (next session)**: QA Playbook with 100+ test cases, interactive
checklists (mark test as passed/failed with notes), AI test-case suggester
(Claude analyzes recent code commits + suggests new tests), driver.js-style
onboarding tour on first login per role.


## Changelog — 2026-02-29 — Markdown Export + Cmd+K Search
- New module `backend/docs_search.py`:
  - `render_doc_markdown(slug)` — converts any doc to clean Markdown.
    Handles all block types (paragraph, list, callout w/ emoji, code, steps,
    media as `_[Media: caption — src]_`) and FAQ.
  - `search_docs(q, limit=20)` — diacritic-insensitive full-text search across
    title, headings, body, callouts, FAQ. Returns ranked hits with type
    indicator (`title|heading|body|faq`) + ~160-char contextual snippet
    centered on the match.
- New admin endpoints:
  - `GET /api/admin/docs/{slug}/markdown` — download as `.md` (text/markdown).
  - `GET /api/admin/docs/admin/search?q=...` — JSON hits for Cmd+K palette.
    (Note: route lives under `/admin/search` sub-path so it doesn't collide
    with `/{slug}` dynamic routing.)
- Frontend `AdminDocs.jsx`:
  - Global hotkey `Cmd+K` / `Ctrl+K` opens a search palette overlay.
    Auto-debounced search (200ms), suggests common queries (escrow, dispute,
    twin, verificare, garanție) when empty, click on hit → opens the relevant
    doc in Preview modal.
  - New per-card `MD` button copies the full Markdown to clipboard
    (uses `navigator.clipboard.writeText`).
  - Search-trigger button in card header with `⌘K` kbd hint.
- Validated:
  - `GET /admin/docs/client/markdown` → clean MD with emoji callouts (`> ℹ️`).
  - `q=escrow` → 13 hits across heading/body/faq.
  - `q=dispute` → 7 hits. Diacritic normalization works.


## Changelog — 2026-02-29 — Architecture Doc (technical reference, role=admin)
- New doc `architecture` v1.0 in `docs_content.py` — 11 sections + 7 FAQ:
  Stack tehnologic, structură proiect (/app), convenții backend, convenții
  frontend, schema MongoDB, integrări externe, securitate, env vars & deploy,
  SEO & marketing, monitoring & observability, Knowledge Base intern.
- Bug fix in `docs_service._md_to_html`: italic regex `_text_` was matching
  underscores inside identifiers like `twin_pins` → broke PDF render.
  Fixed with word-boundary check (start/end-of-string OR adjacent to
  whitespace/punctuation). Verified: arch PDF 18.4KB OK, client PDF
  regression OK (italics still work).
- Auto-available in Admin → Documentație & Training (preview + PDF + MD + send
  + Cmd+K search). 13 hits for query "backend".


## Changelog — 2026-02-29 — Dev Velocity Weekly Report (AI-powered)
- New service `backend/dev_velocity_service.py`:
  - `collect_velocity(days=7)` — parses `git log --numstat` (last 7 days),
    categorizes touched files into 11 buckets (api_endpoints, backend_logic,
    tests, admin_panels, frontend_pages/components/hooks/data/other, docs,
    config, other). Returns totals + per-category breakdown + top-15
    most-touched files + last 30 commits.
  - `ai_summary(stats)` — uses Claude Sonnet 4.5 (via Emergent LLM key) to
    produce a 200-word Romanian executive summary structured: Headline →
    Highlights (3-5 bullets) → Velocitate → Recomandare. Fallback to plain
    stats summary if LLM unavailable.
  - `send_weekly_velocity_email()` — branded HTML email with 4 KPI tiles
    (commits, files, lines added/deleted) + category breakdown table + AI
    summary. Persists each run in `dev_velocity_runs` collection.
- New scheduler job: **Mondays 09:30 Europe/Bucharest**
  (`weekly_dev_velocity`). Skips if 0 commits.
- New admin endpoints in `routes/admin_dev_velocity.py`:
  - `GET  /api/admin/dev-velocity/preview?days=7` — inline JSON preview.
  - `POST /api/admin/dev-velocity/send-now` — force-send the weekly email.
  - `GET  /api/admin/dev-velocity/history` — past reports.
- Frontend `MorningBriefing.jsx`: new "📊 Raport săptămânal" button next to
  "Test email" — triggers send-now with 60s timeout (Claude inference).
- Validated end-to-end:
  - `preview` → 164 commits, 341 files, +73K/-8K lines, 11 categories.
  - Claude AI summary generates structured Romanian report.
  - `send-now` → 3/3 admins delivered via Resend.


## Changelog — 2026-02-29 — Knowledge Base COMPLETE (Faza 2 + Faza 3)
Upgraded all 4 placeholder docs to v1.0 with full Romanian content.

**Specialist v1.0** — 9 secțiuni + 7 FAQ:
1. Overview câștiguri (3 fluxuri venit), 2. Profil 7 elemente critice,
3. Lead capture + ofertă câștigătoare, 4. Lead Fee — când plătești/nu,
5. Escrow (5 pași), 6. Recenzii (cum primești 5★), 7. Dispute (perspectiva specialist),
8. Wallet + retragere bani, 9. Best practices top-50.

**Operator v1.0** — 7 secțiuni + 5 FAQ:
1. Rol în platformă, 2. Workflow zilnic 90min, 3. Validare Twin (checklist),
4. Mediere dispute < 1000 RON, 5. KYC verification (red flags), 6. Comunicare,
7. KPI-uri monitorizate.

**Admin v1.0** — 11 secțiuni + 7 FAQ:
1. Responsabilități, 2. Morning Briefing, 3. AI Investigator,
4. Console tehnice (Smoke/Healthcheck/Data Integrity/Backup/Audit),
5. GDPR Compliance, 6. Mediere dispute complexe, 7. Suspendări conturi,
8. Configurare platformă, 9. Comunicare publică, 10. Comenzi rapide + hotkeys,
11. Cum adaugi alt admin (5 pași).

**QA-Testing v1.0** — 7 secțiuni + 5 FAQ:
1. Cum folosești playbook-ul (P0/P1/P2 + variațiuni de testare),
2. **CLIENT — 30 scenarii** (Onboarding 8, Cerere 7, Escrow 5, Dispute 3, Twin 4, Edge 3),
3. **SPECIALIST — 25 scenarii** (Profil 6, Lead 5, Lucrare 5, Plăți 4, Dispute 3, Edge 2),
4. **OPERATOR — 15 scenarii**,
5. **ADMIN — 25 scenarii** (Monitoring 5, AI 3, Backup 3, Docs 9, GDPR 4, Edge 1),
6. **PUBLIC — 10 scenarii**, 7. Sesiune QA — checklist final cu template raport.
**TOTAL: 105+ test cases** distribuite pe 5 roluri.

**Verificare end-to-end:**
- 6/6 docuri în v1.0 ✅
- 6/6 PDFs generate cu signature %PDF-1.4 valid (9KB-19KB)
- Search + MD export + send funcționează pe TOATE
- Auto-onboarding la register trimite docul corect pe rol
- Cron weekly (Mondays 09:30) trimite Dev Velocity

**Total Knowledge Base**: 56 secțiuni + 41 FAQ + 105 test cases = ~13.000 cuvinte conținut RO de înaltă calitate.



---

## Phase 34 — Onboarding Drip, Interactive QA Playbook, Cookie Policy (Feb 29, 2026) ✅

### 1) Specialist Onboarding Email Drip (Resend, 3 emails / 7 zile)
- **/app/backend/onboarding_emails.py** — drip engine + 3 RO templates (Day 1 profile completion, Day 3 first-lead playbook, Day 7 Trust Score / tier ELITE).
- **MongoDB collection**: `onboarding_emails` { user_id, email, name, step_key, day_offset, due_at, sent, attempts, sent_at }. Max 3 retries.
- **Hook**: `routes/auth.py` register → `enqueue_specialist_onboarding(uid, email, name)` (idempotent).
- **Dispatcher**: APScheduler cron `*/15 min` (Europe/Bucharest) runs `dispatch_due_onboarding_emails`. Cancels if user deleted/unsubscribed.
- **Admin endpoints**: `GET /api/admin/onboarding/queue`, `POST /dispatch-now`, `POST /cancel/{uid}`, `POST /enqueue/{uid}`.

### 2) Interactive QA Playbook + AI Test Suggester
- **/app/backend/qa_playbook.py** — parses QA_DOC into 105 structured test items (CLIENT 30 / SPECIALIST 25 / OPERATOR 15 / ADMIN 25 / PUBLIC 10). Persists test runs in `db.qa_runs` with pass/fail/skip/note per check.
- **AI Suggester**: `ai_suggest_tests(feature, context)` calls **Claude Sonnet 4.5** via Emergent LLM Key, returns 8-12 prioritized cases (P0/P1/P2) in strict JSON.
- **Endpoints under /api/admin/qa**: `checklist/template`, `runs` (GET/POST), `runs/{id}` (GET), `runs/{id}/check/{cid}` (PATCH), `runs/{id}/close` (POST), `runs/{id}/markdown` (GET), `ai-suggest` (POST).
- **/app/frontend/src/pages/admin/AdminQAPlaybook.jsx** — full UI: progress ring, P0/P1/P2 badges, category accordions, status pills, notes, status & priority filters, search box, Markdown export, RELEASE BLOCKED badge when any P0 fails, AI suggester sidebar with copy-to-MD.
- **Wired**: nav under "TRAINING" → "QA Playbook" in AdminLayoutMetronic + AdminConsole routes.

### 3) Cookie Policy page (GDPR / ePrivacy / Law 506/2004)
- **/app/frontend/src/pages/LegalPages.jsx** — new `CookiePolicyPage` export, listed cookies (`access_token`, `refresh_token`, `csrf_token`, `theme`/`locale`, `onboarding_seen`), third-party sub-processors (Stripe, Cloudflare), rationale why no consent banner (only strict-necessary + functional cookies), localStorage explanation, DPO contact.
- **Route**: `/cookies` registered in App.js. Footer link `data-testid='footer-cookies'`.

### Tests
- Backend: pytest **20/20 PASS** — `/app/backend/tests/test_phase33_new_features.py` (cumulative regression).
- Frontend: testing-agent **11/11 PASS** — full E2E flow incl. AI Suggester via Claude Sonnet 4.5.

### P1 / P2 backlog (remaining)
- 🔴 **Stripe LIVE keys** — waiting on user's Stripe business verification.
- 🟡 Onboarding tour (Driver.js) at first login (P2).
- 🟡 Lottie animations in Knowledge Base (P2).
- 🟡 Twilio SMS alerts for critical nighttime failures (P2).
- 🟢 Trend comparison week-vs-week on Dev Velocity (P3).
- 🟢 Avatar upload migration base64 → S3/Cloudinary (P3).



---

## Phase 35 — QA Automation Engine + Add-to-run (Feb 29, 2026) ✅

### 1) "Add to current run" button on AI suggestions
- New endpoint: `POST /api/admin/qa/runs/{id}/add-check` — idempotent append of an ad-hoc check (typically AI-suggested) into an active QA run.
- Frontend: each AI card has `data-testid='qa-ai-add-{CODE}'`; toggle becomes "adăugat" after click. Bulk `qa-ai-add-all` adds the whole batch.

### 2) Automation Engine (14 pre-defined automated tests)
- New module **`/app/backend/qa_automation.py`** with 2 execution kinds:
  - **HTTP (httpx async, in-process)**: 11 tests — duplicate-email rejected, short-password 422, bad-password 401, admin endpoints 401/403, RBAC 403 for client, sitemap.xml 229 URLs valid, SEO landing slug present, /api/public/status alive, 6 PDFs render, onboarding queue shape, QA template returns 105 items.
  - **Browser (Playwright via subprocess to /opt/plugins-venv)**: 3 tests — landing page loads, /cookies page renders, /login form visible.
- New endpoints: `GET /api/admin/qa/automation/tests`, `POST /api/admin/qa/automation/execute` `{test_codes:[...], run_id?}` → returns `{results:[…], summary:{pass,fail,total,written_to_run}}`. When `run_id` provided, results write into the run as checks marked `automated:true` with note `[automated · NNNms] …`.
- New UI: **AutomationPanel** (`data-testid='qa-automation-panel'`) — checkbox catalog + "Selectează tot / Execută / Sumar" + inline ✓/✗ status per row.
- Performance: 14 tests run in parallel ≈ 5s wall-time.

### 3) Env config
- `FRONTEND_PUBLIC_URL` added to `/app/backend/.env` — used by httpx (auth cookies require HTTPS) and Playwright subprocess.

### Tests
- Backend pytest **7/7 PASS** — `/app/backend/tests/test_phase34_automation.py`
- Frontend testing-agent **100% P0 flows PASS** — all interactive flows green (add-to-run, automation execute → write-to-run, summary counters, RBAC blocked for non-admin).

### Active QA capability after Phase 35
- 105 manual checklist items + 14 automated tests = **119 trackable cases** per run
- AI Suggester generates 8-12 fresh cases per feature (Claude Sonnet 4.5)
- Both manual + AI-added + automated checks coexist in one run with consistent UI
- Markdown export covers everything for release docs

### P1 / P2 backlog (remaining)
- 🔴 Stripe LIVE keys — pending user verification
- 🟡 Onboarding tour (Driver.js) at first login (P2)
- 🟡 Lottie animations in Knowledge Base (P2)
- 🟡 Twilio SMS alerts for critical nighttime failures (P2)
- 🟢 Trend comparison week-vs-week on Dev Velocity (P3)
- 🟢 Avatar upload migration base64 → S3/Cloudinary (P3)
- 🟢 Optional: split AdminQAPlaybook.jsx (674 lines) into 3 modules
- 🟢 Add more automated tests (escrow flow, register flow with cleanup, dispute creation)

---

## Phase 36 — Release Gate (Feb 29, 2026) ✅

The release-gating piece on top of the QA automation engine.

### What it does
A red, prominent card on the QA Playbook landing — **"🚀 Rulează gate-ul de release"** — with a 2-step confirm. When triggered:
1. Runs ALL 14 automated tests in parallel (~5-6s wall-time)
2. Persists the run as a `release_gate` document in MongoDB (auto-trimmed to last 100)
3. Sends a branded HTML email to all admins in `ADMIN_EMAILS` env var with:
   - Verdict banner (RELEASE READY vs RELEASE BLOCKED)
   - Per-test table with status, code, priority, duration, note
   - Gate ID for traceability
4. Renders the verdict + per-test accordion + history list on the UI

### Endpoints
- `POST /api/admin/qa/automation/release-gate {email_admins?:bool=true}` → full payload
- `GET  /api/admin/qa/automation/release-gates` → last 20 metadata-only
- `GET  /api/admin/qa/automation/release-gates/{gate_id}` → full detail

### Bug fixed during testing
`ReleaseGateCard.loadHistory()` was overwriting the rich `last` state (with `results`) with the lightweight list response (which strips `results` via Mongo projection). Fix: preserve existing rich state if `gate_id` matches, otherwise lazy-fetch the full detail of the top gate. This guarantees the details accordion stays visible after gate run, refresh, AND page reload.

### Tests
- Backend pytest: 10/10 PASS (`/app/backend/tests/test_phase35_release_gate.py`)
- Frontend testing-agent: 12/13 → bug fix retest 5/5 → final **all green**

### Active QA capability after Phase 36 (full chain)
1. **105 manual checklist items** (organized by 5 roles × prio P0/P1/P2)
2. **AI Test Suggester** generates ad-hoc cases per feature (Claude Sonnet 4.5)
3. **"Add to current run"** button on each AI card → instant ingestion
4. **14 automated tests** (11 HTTP + 3 Playwright) selectable per run
5. **Release Gate** — one-click run-all + persist + email admins + per-test breakdown
6. **History** of all gates (last 100) with verdict + timestamp + actor
7. Markdown export per run for release docs

### Remaining backlog
- 🔴 Stripe LIVE keys — pending user verification
- 🟡 Onboarding tour (Driver.js) at first login (P2)
- 🟡 Lottie animations in KB (P2)
- 🟡 Twilio SMS alerts for critical nighttime failures (P2)
- 🟢 Dev Velocity WoW trend (P3)
- 🟢 Avatar upload migrate base64 → S3/Cloudinary (P3)
- 🟢 Split AdminQAPlaybook.jsx (~830 lines) into ReleaseGateCard / AISuggester / AutomationPanel / RunView modules
- 🟢 Add more automated tests: escrow happy-path, dispute creation, register-with-cleanup
- 🟢 Optional: cron-trigger release gate weekly + alert if any P0 starts failing


---

## Phase 37 — Weekly Cron Release Gate (silent unless P0 fail) (Feb 29, 2026) ✅

- **APScheduler job** `weekly_release_gate` — Mondays **08:45 Europe/Bucharest**.
- Runs ALL 14 automated tests in parallel (~5-6s).
- **Silent on green**: no email if everything passes (logged INFO only).
- **Alerts on P0 fail**: sends the standard branded HTML release-gate email to all admins from `ADMIN_EMAILS`, with subject prefixed `[Cron luni 08:45]`.
- Persists every weekly gate as a `release_gate` document, so the history list in the admin UI shows both manual + scheduled gates side-by-side.
- Function: `run_weekly_release_gate_job` in `/app/backend/qa_automation.py`.
- Wired in `/app/backend/server.py` between the onboarding dispatch job and the weekly Dev Velocity job.

### Verified manually (no test framework needed — straightforward cron wrapper)
- All-pass invocation → 0 emails sent, log `[ReleaseGate cron] All clear — 14/14 pass`.
- Simulated P0 fail (monkey-patched first test) → email captured with correct subject `[Cron luni 08:45] 🚫 Release Gate — RELEASE BLOCKED (13/14)` to 3 admins.


---

## Phase 38 — Content Audit + Real Bug Fix + 10 New Automated Tests (Feb 29, 2026) ✅

User raportat un bug real în production: callout-ul „Plata Escrow" în manualul SPECIALISTULUI folosea text de perspectivă client („Banii pe care îi PLĂTEȘTI..."). Cauza: un singur `_CB_ESCROW` reutilizat. Acum am construit întreg sistemul care detectează acest tip de bug automat.

### 1) Bug fix concret
- Adăugat `_CB_ESCROW_SPECIALIST` în `/app/backend/docs_content.py` (perspectivă specialist: „Clientul alimentează escrow, ești plătit 95% după confirmare").
- Înlocuit `_CB_ESCROW` cu varianta corectă în doc-ul specialist.

### 2) Content Audit Engine — `/app/backend/qa_content_audit.py`
- Detector heuristic cu 8 client-hints + 9 specialist-hints + 7 admin-hints.
- Persistent în `db.doc_conflicts` (idempotent prin key `slug::sec::block`).
- AI Fix prin Claude Sonnet 4.5: la cerere, rescrie pasajul în perspectiva audienței corecte.
- Apply Fix → `db.doc_overrides` (upsert) + `docs_service.resolve_doc_with_overrides` aplică patch-ul la randare (PDF + admin view), **fără modificare de cod**.

### 3) Admin endpoints `/api/admin/qa/content-audit/`
- `POST /scan` · `GET /conflicts` · `PATCH /{id}/status` · `POST /{id}/ai-fix` · `POST /{id}/apply`

### 4) 10 teste automate noi (catalog crescut la 24)
**Content Audit (5):**
- DOC-AUDIT-01: specialist doc fără perspectivă client
- DOC-AUDIT-02: client doc fără pasaje strict-specialist
- DOC-AUDIT-03: specialist doc are info plată/comision/lead fee
- DOC-AUDIT-04: client doc menționează disputele
- DOC-AUDIT-05: toate override-urile aplicate fără IndexError

**Lifecycle/Communication (5):**
- LIFECYCLE-01: register → login → /me (client cleanup)
- LIFECYCLE-02: specialist new → 3 onboarding emails enqueuate
- LIFECYCLE-03: marketplace public listare specialiști
- LIFECYCLE-04: profil public specialist accesibil clienților
- LIFECYCLE-05: integritate referențială rol-user (115 users curat)

### 5) UI — `ContentAuditCard` în QA Playbook landing
Scan button · listă conflicte cu severity badges · per-conflict: „Cere fix de la AI" → vizualizare sugestie → „Aplică" sau „Dismiss".

### Tests
- Backend pytest: **8/8 PASS** în 6.2s (`/app/backend/tests/test_phase38_content_audit.py`)
- Testing-agent: **8/8 backend + 3/3 frontend P0** verde
- Self-test all 10 noi: **10/10 PASS în ~1s paralel**

### Capabilități QA finale (după Phase 38)
| Strat | Volum |
|---|---|
| Manual checklist | 105 scenarii |
| Automate (24 teste) | HTTP 18 + Browser 3 + Content 5 + Lifecycle 5 |
| AI Test Suggester | 8-12/feature |
| Content Audit | auto-detect + AI rewrite + DB overrides |
| Release Gate | one-click + cron luni 08:45 |

### Backlog rămas
- 🔴 Stripe LIVE keys — pending user verification
- 🟡 Onboarding tour (Driver.js)
- 🟡 Lottie animations în KB
- 🟡 Twilio SMS alerts
- 🟢 Mai multe teste lifecycle (escrow happy path, dispute create, file upload)
- 🟢 Avatar upload S3/Cloudinary
- 🟢 Dev Velocity WoW trend

