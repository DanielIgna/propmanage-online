# PropManage — Product Requirements Document

## Original problem statement
PropManage is a full-stack property management platform with: Digital Twin 3D viewer, Multi-Role auth, QA Automation, marketplace for specialists, GDPR/Trust Center, AI Console, support inbox, auth-health dashboard.

## Recent additions (Feb 2026)
- **Phase 69 — AI QA Copilot + Specialist badges + Launch Playbook** ✅ (Feb 3 2026)
  - **AI QA Copilot** (`/admin/qa-copilot`): New module that turns manual exploratory testing into structured bug reports via Claude Sonnet 4.5. User creates sessions (role + area + goal), describes findings in natural language, AI returns category (UI_UX/DATA/LOGIC_BUG/MISSING_FEATURE/INTEGRATION/PERFORMANCE/SECURITY), severity (P0-P3), suspected files, follow-up tests, and cross-references prior findings from other sessions (regression memory). One-click "Generează prompt pentru Emergent" compiles all findings into a Markdown prompt ready to paste into chat with the dev agent.
  - **Backend**: `qa_copilot_engine.py` (Claude integration, JSON-mode), `routes/qa_copilot.py` (CRUD on sessions + findings + prompt generation). Collection: `qa_sessions`.
  - **Specialist badges**: `requests.py` accept_request now writes `specialist_specialty`, `specialist_city`, `specialist_verified` on assignment. ClientDashboard displays them next to specialist name with VERIFIED checkmark.
  - **AdminDocumentation**: 2 new topics — "QA Copilot · Testare AI-asistată" (how to use the new module) and "Playbook Lansare · Primii 7 pași" (concrete Day 1-7 actions: LinkedIn post, Facebook carousel, Instagram Reel, YouTube case study, newsletter pilot, retrospective).
  - **Tailwind safelist**: 28 dynamic category color classes safelisted to prevent JIT purge in production build.
  - Tested: iteration_48 → 11/11 backend pytest, frontend QA Copilot full flow PASS (modal create → AI analysis in ~6s → prompt generation 1324 chars Romanian Markdown). Visual badge re-test pending seed of assigned request.

- **Phase 68b — Dynamic SEO + Admin Documentation + CTA refactor** ✅ (Feb 3 2026)
  - **`useDynamicSEO(pageKey)`** hook (`/app/frontend/src/lib/useDynamicSEO.js`) reads `app_settings.seo` and applies `<title>`, meta description, OG title/description/image. Module-level cache with `invalidateSEOCache()` exposed; admin save/reset auto-invalidates.
  - Hooked on: home (App.js), `/imobile-verificate` (estate), `/de-ce-noi` (whyus), `/imobile-verificate/sell` (sell).
  - **AdminSettingsControl**: SEO section added with per-page title+description fields (home, estate, whyus, sell, client, specialist) + OG image URL. Reset-to-defaults button with confirm dialog → POST `/api/admin/app-settings/reset`. Documentation shortcut button next to Reset.
  - **AdminDocumentation** page at `/admin/documentation` — 7 expandable topics (verified-estate, admin-kanban, control-admin, seo, social-campaigns, analytics, emails). Linked in admin sidebar (AdminLayoutMetronic) with NEW badge.
  - **CTA refactor**: 4 buttons in ClientDashboard + 4 buttons in SpecialistDashboard migrated from `btn-accent` to `pm-btn pm-btn-primary` (unified token system from Phase 64 ETAPA 3).
  - Tested: iteration_47 → 8/8 backend pytest + frontend save+persist+reset, all 7 docs topics expand, refactored CTAs render correctly.

- **Phase 68 — Admin Settings Control Panel + Dynamic Footer + LinkedIn** ✅
  - New API `routes/app_settings.py`: single doc `app_settings` (social/pricing/contact/company sections), GET/PUT/RESET endpoints
  - Public subset endpoint `/api/app-settings/public` for Footer
  - Frontend page `/admin/settings-control` cu 4 secțiuni configurabile fără cod
  - **LinkedIn** added with SVG icon + URL field
  - **Footer DYNAMIC**: fetch settings → render social links live. Linkuri goale = placeholder "(în curând)".
  - **VE pricing & checkout** citesc din settings (env fallback). Edit price în Admin → reflectă instant pe Sell + `/de-ce-noi` calculator.
  - Admin sidebar: 2 noi entry-uri "Control Administrare" + "Imobile Verificate" cu badge NEW.
  - Tested: PUT 400/1000 → pricing endpoint reflectă instant. LinkedIn salvat.

- **Phase 67 — Brand softening + Social media + Analytics + Email sequences** ✅
  - **`/de-ce-noi` refactored** to discrete tone: removed ALL "Imobiliare.ro" mentions, replaced with "Platforme clasice" / "altă platformă". Hero now reads "Facem lucrurile *altfel*" (subtle, non-confrontational).
  - **Footer Social Section** with 5 SVG-icon links: Facebook PropManage (active: https://www.facebook.com/share/1GEh9j9wDF/), + 4 placeholders styled with "(în curând)" badges (Facebook Imobile Verificate, Instagram x2, YouTube). Easy to activate when user provides URLs.
  - **Google Analytics 4 (GA4)** via `lib/analytics.js` — set `REACT_APP_GA4_MEASUREMENT_ID=G-XXXXXXX` in `.env`. Auto-tracks page views on every route change via `AnalyticsRouteTracker`. Anonymize IP enabled. No-op if env var missing.
  - **Email Lifecycle Sequences** via `backend/email_sequences.py`:
    - **Drip Reminder** — every 6h scans `verified_estate_orders` for paid orders >48h with no follow-up, sends admin reminder (idempotent via `drip_reminded_at` flag).
    - **Weekly Newsletter** — Mondays 09:00 EU/Bucharest, sends digest of top 5 newest published listings to all subscribers (`digest_disabled != true`).
    - Admin manual triggers: `POST /api/verified-estate/admin/run-newsletter-now` and `POST /api/verified-estate/admin/run-drip-now`.
  - Registered in APScheduler at server startup. Logs confirm: `[email_sequences] Registered drip + newsletter jobs`.

- **Phase 66 — SEO Landing "De ce noi?"** ✅
  - Pagină marketing premium la `/de-ce-noi` (PropManage vs Imobiliare.ro)
  - 7 secțiuni: Hero, 3 Pilon-cards, Comparison Table (10 criterii), Savings Calculator interactiv (slider RON 50K-2M), 3 Testimoniale, 5 FAQ, Final CTA
  - SEO complet: meta tags + Open Graph + Schema.org Service JSON-LD
  - Calculator real-time: la X RON preț → afișează comision PropManage 2.5% vs piață 5.5% + savings
  - Link în nav: "De ce noi?" alături de "Imobile Verificate"
  - Folosește sistemul unificat `.pm-btn-*` și `.gradient-text`

- **Phase 65 — Verified Estate Incremental (Real Sell Flow + Emails + Map)** ✅
  - **Auto-draft listing from paid order**: After successful demo Stripe checkout, backend auto-creates a `draft` listing in admin Kanban with: title="Imobil în pregătire · <address>", owner_email/name/phone from order, pending_services flags ({audit, twin} based on package), source_order_id for traceability. Gates all start as failing — agent populates them later.
  - **Email notifications via Resend**: 3 hooks added — admin email on inquiry (`[Imobile Verificate] <intent> · <name>`), admin email on external audit request, admin email on paid order + buyer confirmation email. All fire-and-forget through `asyncio.create_task` so checkout/inquiry latency isn't impacted. Uses `ADMIN_NOTIFY_EMAIL` env or falls back to `SUPPORT_CONTACT_EMAIL`.
  - **Leaflet Map View**: `/imobile-verificate` now has Grid ↔ Hartă toggle. Dark CartoDB tiles, custom lime SVG markers, popups with title/city/price + "Vezi detalii →" link. Listings need `lat`/`lng` (now seeded for the 2 demos: Aviatorilor 44.4632/26.0894 + Pipera 44.5215/26.1278). Auto-fit bounds when 2+ markers.
  - **Tested**: 100% backend (27/27 — 6 new + 21 regression), 100% frontend (view-toggle, markers, popups, draft auto-create end-to-end).

- **Phase 64 — Verified Estate ETAPA 1+2+3+4 COMPLET** ✅
  - **ETAPA 1**: Modul izolat `routes/verified_estate.py` + 3 pagini frontend (`/imobile-verificate`, detail, sell landing). 4 quality gates strict. Feature flag `FEATURE_VERIFIED_ESTATE=true`. 2 listings demo seeded.
  - **ETAPA 2**: Stripe checkout (audit 350 / twin 950 / bundle 1300 RON) cu fallback DEMO mode. 4-step wizard în Sell page. Admin Kanban moderation panel (`/admin/imobile-verificate`) cu 4 coloane (Draft/Pending/Published/Archived), 6 stat cards, 4 tabs (Kanban/Inquiries/External/Orders). Gates strict-enforced la publish.
  - **ETAPA 3**: Sistem unificat CSS tokens `.pm-btn-*` (primary/secondary/ghost/danger/success + size variants), `.pm-stat-card`, `.pm-trust-badge` (A+/A/B/C) aplicat în toate paginile verified-estate.
  - **ETAPA 4**: Sale/Rent toggle în filters + transaction_type badges pe cards. Trust Score badge (A+/A/B/C) cu reguli: A+ requires 100%+twin+audit, A requires 95%+twin+audit, B requires 90%+twin+audit, C otherwise.
  - **Fixes post-testing** (iteration_45 RCA):
    - Origin redirect now prefers `FRONTEND_PUBLIC_URL` env var (prevents cluster-internal URLs in Stripe redirect)
    - Trust Score B now requires audit (consistency with "audit + twin mandatory")
    - Inquiry creation `$inc inquiry_count` on listing doc
  - **Tested 21/21 backend pytest + frontend Step 1-4 wizard end-to-end** ✅

## Endpoints Verified Estate
```
PUBLIC:
  GET  /api/verified-estate/listings                       (browse + filters)
  GET  /api/verified-estate/listings/{id}                  (detail)
  GET  /api/verified-estate/pricing                        (audit/twin/bundle prices)
  POST /api/verified-estate/inquiries                      (interested in property)
  POST /api/verified-estate/external-audit-request         (audit for external listing)
  POST /api/verified-estate/checkout                       (Stripe demo)
  GET  /api/verified-estate/checkout/status/{session_id}   (poll payment)

ADMIN (require_role admin/operator):
  GET  /api/verified-estate/admin/stats
  GET  /api/verified-estate/admin/listings
  POST /api/verified-estate/admin/listings
  PATCH /api/verified-estate/admin/listings/{id}
  POST /api/verified-estate/admin/listings/{id}/publish
  POST /api/verified-estate/admin/listings/{id}/archive
  GET  /api/verified-estate/admin/inquiries
  GET  /api/verified-estate/admin/external-requests
  GET  /api/verified-estate/admin/orders
```

## Earlier phases
  - Trimble Connect SKP iframe viewer
  - Blender 3.4 headless DAE/OBJ/FBX → GLB conversion
  - Google OAuth resilience (K8s ingress timeout fix)
  - `/admin/auth-health` dashboard with sparklines + email alerts
  - Support contact form + `/admin/support-inbox`
  - Public `/demo` 3D showcase
  - Postinstall `patch-visual-edits.js` for R3F crash fix

## Tech stack
- Backend: FastAPI + MongoDB (motor) + APScheduler
- Frontend: React 19 + react-router 7 + framer-motion + Tailwind + lucide-react
- 3D: Three.js (@react-three/fiber) + Trimble Connect iframe + Blender subprocess
- Integrations: Resend (email), Stripe (payments), Claude Sonnet 4.5 (LLM), Google OAuth

## Verified Estate — architectural decisions
- Single tab in main PropManage app (NOT a separate site)
- All routes prefixed `/api/verified-estate/*`
- New collections (zero impact on existing): `verified_estate_listings`, `verified_estate_inquiries`, `verified_estate_external_requests`
- Feature flag controls entire module (rollback in 5 sec)
- 4 Gates enforced in API code, cannot be bypassed:
  1. Audit report required
  2. Digital Twin required
  3. ≥90% recommendations accepted
  4. Admin manual approval (status=published)

## Roadmap (next phases)
- **ETAPA 2 — Seller flow & Admin moderation**
  - Stripe checkout for audit + Twin (configurable price)
  - SellMyProperty wizard with gate enforcement
  - Admin Kanban moderation panel: Draft → Pending Review → Published
  - Email notifications on inquiry/external-audit creation
- **ETAPA 3 — Trust & Polish**
  - Unified button system (CSS tokens) across all pages
  - Map view with Leaflet pins
  - Trust Score A+/A/B/C calculator
- **ETAPA 4 — Scale**
  - Sale ↔ Rent toggle
  - Recommendations engine
- **Other backlog**
  - Aspose.3D Cloud SKP→GLB direct integration
  - Twilio SMS critical-night alerts
  - Lottie animations for KB
  - Avatar migration from base64 to S3/Cloudinary

## Test credentials
Admin: `admin@propmanage.io` / `Admin123!`

## Known infrastructure issues (outside codebase)
- `propmanage.ro` DNS Zone Editor in Rackhost cPanel showing "DNS Zone Failed to Load" — user contacting Rackhost support; DNS A records currently missing for root domain (visible in dns.google query as empty Answer). Deployment to Emergent.host works fine.

## Key files
- `/app/backend/routes/verified_estate.py` (NEW — ETAPA 1)
- `/app/frontend/src/pages/verified-estate/EstateBrowse.jsx` (NEW)
- `/app/frontend/src/pages/verified-estate/EstateDetail.jsx` (NEW)
- `/app/frontend/src/pages/verified-estate/SellMyProperty.jsx` (NEW — landing placeholder)
- `/app/backend/server.py` (registered router + seed hook)
- `/app/frontend/src/App.js` (3 new routes + nav link)
