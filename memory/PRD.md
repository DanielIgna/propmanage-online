# PropManage — Product Requirements Document

## Original problem statement
PropManage is a full-stack property management platform with: Digital Twin 3D viewer, Multi-Role auth, QA Automation, marketplace for specialists, GDPR/Trust Center, AI Console, support inbox, auth-health dashboard.

## Recent additions (Feb 2026)
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
