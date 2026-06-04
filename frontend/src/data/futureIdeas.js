// FUTURE_IDEAS — static catalog of strategic dev proposals.
//
// Each entry is a self-contained proposal with full technical breakdown.
// Status (pending/approved/rejected) is persisted server-side; content here
// is version-controlled and reviewable via PR.
import { Sparkles } from "lucide-react";

export const FUTURE_IDEAS = [
  {
    id: "experience_spaces_v2",
    code: "EXP-V2",
    title: "Experience Spaces — Business Operating System",
    icon: Sparkles,
    risk: 5,
    timelineDays: 35,
    estCostEur: 7000,
    estOpexMonthly: 80,
    estRevenueMonthly: 3500,
    estRevenueRange: "1.500€ – 8.000€",
    summary: "Modul complet izolat care transformă PropManage din Property Management în Business Operating System pentru monetizarea spațiilor fizice (centru educațional kids, evenimente, ateliere, studio foto). Include calendar atomic, plăți Stripe, ecosistem furnizori, Digital Twin 3D și AI Business Manager — totul guard-uit de feature flag și 100% rollback-able.",
    problemAndOpportunity: "PropManage gestionează în prezent imobile și chiriași. Founder-ul deține/operează spații monetizabile (centru educațional kids ~25 locuri) care necesită calendar rezervări, pachete personalizate (aniversări, ateliere, photo sessions), gestiune furnizori (fotograf, decor, catering), plăți online și raportare financiară. Construirea acestui modul pe PropManage permite reutilizarea infrastructurii (auth, email, Stripe, AI) FĂRĂ a atinge modulele existente — generând un al doilea flux de venit fără risc de regresie.",
    principles: [
      "MongoDB exclusiv — toate colecțiile noi cu prefix `es_*` (zero overlap cu existentele)",
      "Toate rutele sub `/api/experience-spaces/*` — niciun endpoint existent atins",
      "Feature flag `enable_experience_spaces` stocat în `app_settings` (default OFF)",
      "Multi-tenant ready de la zi 1: `organization_id` pe fiecare document",
      "Server-side time enforcement: buffer + overlap detection NICIODATĂ în frontend",
      "Atomic booking creation: `findOneAndUpdate` cu condition check anti-race",
      "AI READ-ONLY by default — generează recomandări, niciodată execută singur",
      "Stripe reused — doar metadata nouă, fără duplicarea integrării",
      "Email reused — folosește `email_service.send_email` cu template-uri noi separate",
      "Rollback în <1 min: feature flag OFF → toate endpoint-urile returnează 403",
    ],
    antiPatterns: [
      "NU modifica colecțiile existente (Property, Request, User, Invoice)",
      "NU adăuga referințe la `experience_spaces` în rutele/modelele existente",
      "NU partaja business logic între module — copy-paste preferat (izolare > DRY aici)",
      "NU activa AI Manager înainte de stabilizarea flow-urilor manuale",
      "NU sări peste activity log — fiecare schimbare de stare trebuie auditabilă",
      "NU permite booking-uri fără overlap check atomic în backend",
      "NU stoca prețuri/comisioane în frontend — toate calculele server-side",
    ],
    phases: [
      {
        code: "ES-0", title: "Foundation", days: 3,
        description: "Scaffolding complet (feature flag, middleware, folder structure) — zero modificări la cod existent. Verificare cu git diff că nimic legacy nu s-a atins.",
        deliverables: [
          "Feature flag în `app_settings` cu UI toggle în Admin Settings",
          "Backend folder `/app/backend/experience_spaces/` (engine, models, helpers)",
          "Routes folder `/app/backend/routes/experience_spaces/` (sub-routere)",
          "Frontend folder `/app/frontend/src/pages/experience-spaces/` + `/admin/experience-spaces/`",
          "Migration helper idempotent (creează indecși pe `es_*` collections)",
          "Middleware `require_es_enabled` + RBAC `require_es_role`",
          "Smoke test: flag OFF → 403 pe toate `/api/experience-spaces/*`",
        ],
      },
      {
        code: "ES-1", title: "Spaces + Calendar", days: 5,
        description: "CRUD spații, calendar engine cu buffer + DST handling, listare publică `/spaces`.",
        deliverables: [
          "CRUD spaces (admin)",
          "Public listing `/spaces` + detail `/spaces/{slug}`",
          "Availability rules CRUD (admin)",
          "Calendar engine: slots = availability − bookings − buffer",
          "Public calendar endpoint cu caching 5 min",
          "Admin master calendar UI",
          "Activity log integration",
          "50+ unit tests pentru calendar logic (overlap, buffer, DST)",
        ],
      },
      {
        code: "ES-2", title: "Bookings + Packages", days: 5,
        description: "Rezervări atomice cu overlap check, pachete pre-configurate, calcul preț + revenue split.",
        deliverables: [
          "Package CRUD (admin)",
          "Quote endpoint (preț + TVA + revenue split)",
          "Booking creation cu atomic overlap check",
          "Booking confirmation/cancel/check-in flows",
          "Customer dashboard `/my/bookings`",
          "Admin booking table cu filtre",
          "Race condition test (concurrent POST)",
        ],
      },
      {
        code: "ES-3", title: "Payments", days: 4,
        description: "Integrare Stripe (reuse existing key), refund, webhooks idempotente.",
        deliverables: [
          "Stripe payment intent integration",
          "Stripe webhook handler (idempotent via `stripe_event_id` dedup)",
          "Refund flow (full + partial)",
          "Revenue split tracking în `es_booking_payments`",
          "Manual payment methods (transfer, cash) admin entry",
        ],
      },
      {
        code: "ES-4", title: "Digital Twin", days: 3,
        description: "3D viewer per spațiu (Matterport/Sketchfab whitelist), asset registry, maintenance history.",
        deliverables: [
          "Twin CRUD per spațiu",
          "Public embedded viewer (whitelist iframe sources)",
          "Asset registry UI",
          "Maintenance history UI",
          "Integrare în booking flow",
        ],
      },
      {
        code: "ES-5", title: "Service Providers", days: 4,
        description: "Marketplace furnizori (fotograf, decor, catering) cu aprobare admin și payout tracking.",
        deliverables: [
          "Provider signup + admin approval",
          "Provider directory (public)",
          "Adăugare servicii la booking",
          "Provider dashboard",
          "Booking-services link + status tracking",
        ],
      },
      {
        code: "ES-6", title: "AI Business Manager", days: 5,
        description: "Insights zilnice (cron Claude Sonnet) + widget conversațional pentru admin.",
        deliverables: [
          "Daily insights cron (folosește `ai_core/provider`)",
          "Insights UI în admin",
          "Conversational widget embedded în admin dashboard",
          "Integrare cu `/api/admin/ai-activity`",
        ],
      },
      {
        code: "ES-7", title: "Analytics + Reports", days: 3,
        description: "Rapoarte ocupare, venit, pachete, furnizori, export CSV/PDF, digest săptămânal email.",
        deliverables: [
          "Occupancy report",
          "Revenue report",
          "Package performance",
          "Provider performance",
          "CSV/PDF export",
          "Email digest schedule (weekly)",
        ],
      },
      {
        code: "ES-8", title: "Multi-Tenant + White Label (opțional)", days: 7,
        description: "Onboarding alte organizații, subdomain routing, per-org branding, Stripe Connect pentru payout furnizori.",
        deliverables: [
          "`es_organizations` collection + onboarding flow",
          "Subdomain routing (`*.propmanage.ro`)",
          "Per-org branding (logo, colors, custom domain)",
          "Per-org billing (Stripe subscription)",
          "Stripe Connect pentru vendor payouts",
        ],
      },
    ],
    backend: {
      structure: `/app/backend/
├── experience_spaces/
│   ├── __init__.py
│   ├── config.py            # feature flag reader + settings cache
│   ├── middleware.py        # require_es_enabled + RBAC checks
│   ├── calendar_engine.py   # slot computation + buffer + DST
│   ├── booking_atomicity.py # findOneAndUpdate anti-race
│   ├── pricing.py           # quote + tax + revenue split
│   └── helpers.py
├── routes/
│   └── experience_spaces/
│       ├── spaces.py        # CRUD + availability
│       ├── bookings.py      # quote + create + confirm + cancel
│       ├── payments.py      # Stripe intents + webhooks
│       ├── providers.py     # marketplace furnizori
│       ├── packages.py
│       ├── digital_twins.py
│       ├── analytics.py
│       ├── ai_manager.py    # insights cron + chat
│       └── bootstrap.py     # admin config + indexes`,
      endpoints: [
        { method: "GET",  path: "/api/experience-spaces/spaces",                       note: "Public list (active spaces)" },
        { method: "POST", path: "/api/experience-spaces/spaces",                       note: "Admin create" },
        { method: "GET",  path: "/api/experience-spaces/spaces/{slug}",                note: "Public detail page" },
        { method: "PUT",  path: "/api/experience-spaces/spaces/{id}",                  note: "Admin update" },
        { method: "DELETE",path:"/api/experience-spaces/spaces/{id}",                  note: "Admin archive (soft delete)" },
        { method: "GET",  path: "/api/experience-spaces/spaces/{id}/availability",     note: "Get availability rules" },
        { method: "PUT",  path: "/api/experience-spaces/spaces/{id}/availability",     note: "Update availability (admin)" },
        { method: "GET",  path: "/api/experience-spaces/spaces/{id}/calendar",         note: "Computed slots (?from=..&to=..)" },
        { method: "POST", path: "/api/experience-spaces/bookings/quote",               note: "Price calculation (public)" },
        { method: "POST", path: "/api/experience-spaces/bookings",                     note: "Create booking (auth or guest)" },
        { method: "GET",  path: "/api/experience-spaces/bookings",                     note: "List own/all (auth)" },
        { method: "GET",  path: "/api/experience-spaces/bookings/{id}",                note: "Detail (owner or admin)" },
        { method: "PUT",  path: "/api/experience-spaces/bookings/{id}/confirm",        note: "Confirm draft" },
        { method: "PUT",  path: "/api/experience-spaces/bookings/{id}/cancel",         note: "Cancel + refund trigger" },
        { method: "POST", path: "/api/experience-spaces/bookings/{id}/check-in",       note: "Customer arrives" },
        { method: "POST", path: "/api/experience-spaces/bookings/{id}/pay",            note: "Initiate Stripe intent" },
        { method: "POST", path: "/api/experience-spaces/webhooks/stripe",              note: "Stripe webhook (idempotent)" },
        { method: "GET",  path: "/api/experience-spaces/packages",                     note: "List packages per space" },
        { method: "POST", path: "/api/experience-spaces/packages",                     note: "Admin create" },
        { method: "PUT",  path: "/api/experience-spaces/packages/{id}",                note: "Admin update" },
        { method: "GET",  path: "/api/experience-spaces/providers",                    note: "Public directory + admin all" },
        { method: "POST", path: "/api/experience-spaces/providers",                    note: "Provider signup" },
        { method: "PUT",  path: "/api/experience-spaces/providers/{id}/approve",       note: "Admin approval gate" },
        { method: "GET",  path: "/api/experience-spaces/digital-twins/{space_id}",     note: "Public twin viewer data" },
        { method: "PUT",  path: "/api/experience-spaces/digital-twins/{space_id}",     note: "Admin update" },
        { method: "GET",  path: "/api/experience-spaces/analytics/occupancy",          note: "Admin report" },
        { method: "GET",  path: "/api/experience-spaces/analytics/revenue",            note: "Admin report" },
        { method: "GET",  path: "/api/experience-spaces/analytics/dashboard",          note: "Aggregate KPIs (admin)" },
        { method: "GET",  path: "/api/experience-spaces/ai-manager/insights",          note: "Active insights list" },
        { method: "POST", path: "/api/experience-spaces/ai-manager/regenerate",        note: "Force re-run analysis" },
        { method: "PUT",  path: "/api/experience-spaces/ai-manager/insights/{id}/action", note: "Mark actioned/dismissed" },
        { method: "POST", path: "/api/experience-spaces/commissions/payout-batch",     note: "Monthly payout calc" },
        { method: "GET",  path: "/api/experience-spaces/_config",                      note: "Feature flag + org config bootstrap" },
      ],
      security: [
        "Middleware `require_es_enabled` rulează ÎNAINTEA logicii rutei (returnează 403 dacă flag OFF)",
        "Granular control per sub-modul în `app_settings.es_modules_enabled` (spaces/bookings/payments/providers/ai_manager/digital_twin/analytics)",
        "RBAC matrix: anon (R active), customer (CRUD own bookings), service_provider (R own jobs), org_admin (CRUD own org), platform_admin (CRUD all)",
        "Multi-tenant enforcement: TOATE query-urile includ filtru `organization_id` — verificat la code review + audit cron săptămânal",
        "Stripe webhook idempotency: collection `es_stripe_events_processed` cu unique index pe `stripe_event_id`",
        "Digital Twin iframe XSS prevention: whitelist domenii (matterport.com, sketchfab.com, self-hosted)",
        "AI cost cap: max 1 insight job/zi/org + cache 6h",
        "Email throttling: max 1 confirmation/booking_id (idempotent via `notification_sent_at`)",
      ],
      dependencies: [
        "icalendar==6.x          # .ics generation pentru booking confirmations",
        "python-dateutil==2.x    # DST handling (deja instalat)",
        "# Niciun heavy dependency nou — reuse: FastAPI, motor, pydantic, stripe, apscheduler",
      ],
    },
    frontend: {
      structure: `/app/frontend/src/
├── pages/
│   ├── experience-spaces/         # Public-facing (no auth)
│   │   ├── SpacesListPage.jsx
│   │   ├── SpaceDetailPage.jsx
│   │   ├── BookingWizard.jsx
│   │   ├── DigitalTwinViewer.jsx
│   │   └── BookingConfirmation.jsx
│   ├── customer-bookings/         # Auth customer
│   │   ├── MyBookingsPage.jsx
│   │   └── BookingDetail.jsx
│   ├── admin/experience-spaces/   # Admin module
│   │   ├── ESHomePage.jsx
│   │   ├── ESSpacesCRUD.jsx
│   │   ├── ESCalendar.jsx
│   │   ├── ESBookingsTable.jsx
│   │   ├── ESPackages.jsx
│   │   ├── ESProviders.jsx
│   │   ├── ESAIManager.jsx
│   │   ├── ESAnalytics.jsx
│   │   └── ESSettings.jsx
│   └── provider/                  # Service provider dashboard
│       ├── ProviderJobs.jsx
│       ├── ProviderProfile.jsx
│       └── ProviderEarnings.jsx
├── components/experience-spaces/
│   ├── SlotPicker.jsx
│   ├── PackageCard.jsx
│   ├── PricingBreakdown.jsx
│   └── BookingTimeline.jsx`,
      routes: [
        { scope: "public", path: "/spaces",                          note: "Listă spații active (per org)" },
        { scope: "public", path: "/spaces/{slug}",                   note: "Detail + Digital Twin + widget rezervare" },
        { scope: "public", path: "/spaces/{slug}/book",              note: "Booking wizard 5 pași" },
        { scope: "public", path: "/spaces/{slug}/digital-twin",      note: "3D viewer full-screen" },
        { scope: "public", path: "/booking/confirmation/{id}",       note: "Post-payment" },
        { scope: "auth",   path: "/my/bookings",                     note: "Istoric customer" },
        { scope: "auth",   path: "/my/bookings/{id}",                note: "Detalii + factură + cancel" },
        { scope: "admin",  path: "/admin/experience-spaces",         note: "Module home (KPIs)" },
        { scope: "admin",  path: "/admin/experience-spaces/spaces",  note: "CRUD spații" },
        { scope: "admin",  path: "/admin/experience-spaces/calendar",note: "Master calendar (all spaces)" },
        { scope: "admin",  path: "/admin/experience-spaces/bookings",note: "Bookings table + filtre" },
        { scope: "admin",  path: "/admin/experience-spaces/packages",note: "Pachete per spațiu" },
        { scope: "admin",  path: "/admin/experience-spaces/providers",note:"Director furnizori + aprobare" },
        { scope: "admin",  path: "/admin/experience-spaces/ai-manager",note:"AI insights" },
        { scope: "admin",  path: "/admin/experience-spaces/analytics",note:"Rapoarte" },
        { scope: "admin",  path: "/admin/experience-spaces/settings",note: "Feature flag + comision + revenue model" },
        { scope: "auth",   path: "/provider/jobs",                   note: "Job-uri assignate (rol service_provider)" },
        { scope: "auth",   path: "/provider/profile",                note: "Profil furnizor + servicii" },
        { scope: "auth",   path: "/provider/earnings",               note: "Istoric payout" },
      ],
      designReuse: [
        "Tokens existente PropManage: lime accent `#d4ff3a`, serif headers, dark admin / light public",
        "Iconography lucide-react existentă (Calendar, Sparkles, Camera, Cake, Briefcase)",
        "Componente shadcn/ui existente (Button, Card, Dialog, Tabs, Calendar)",
        "Layout admin reused via `AdminLayoutMetronic`",
        "Public pages: imagini din librăria existentă (centru kids / evenimente)",
      ],
      dependencies: [
        "@fullcalendar/react      # Master calendar admin (sau react-big-calendar)",
        "react-datepicker         # Booking date selector",
        "# 3D viewer: Matterport/Sketchfab iframe embed — fără library",
      ],
    },
    db: {
      isolationRule: "Toate colecțiile noi prefixate `es_*` (es = experience spaces) pentru izolare vizuală + de-conflict garantat. Zero modificări la colecțiile existente (properties, requests, users, invoices etc.). Rollback nuclear: `db.es_*.drop()` fără impact pe restul.",
      collections: [
        {
          name: "es_spaces", purpose: "Catalog spații monetizabile",
          schema: `{
  _id: ObjectId, id: "uuid",
  organization_id: "uuid",
  name: "string", slug: "string-kebab",
  description: "markdown",
  capacity: 25, hourly_rate: 150, currency: "RON",
  minimum_booking_hours: 2, buffer_time_minutes: 60,
  location: { address, city, lat, lng, google_maps_url },
  timezone: "Europe/Bucharest",
  status: "draft" | "active" | "paused" | "archived",
  digital_twin_id: "uuid?",
  gallery_image_urls: [...], cover_image_url, tags: [...],
  created_at, updated_at
}`,
          indexes: ["{organization_id:1, slug:1} unique", "{status:1}"],
        },
        {
          name: "es_space_availability", purpose: "Reguli disponibilitate per zi/spațiu",
          schema: `{
  _id, id, space_id,
  day_of_week: 0-6,        // ISO 8601, 0=Monday
  start_time: "HH:MM",     // local space timezone
  end_time: "HH:MM",
  blocked: false, blocked_reason: "string?",
  created_at
}`,
          indexes: ["{space_id:1, day_of_week:1}"],
        },
        {
          name: "es_bookings", purpose: "Rezervări (heart of module)",
          schema: `{
  _id, id, booking_number: "ES-2026-000123",
  organization_id, space_id, customer_id?,
  customer_snapshot: { name, email, phone, guest_count },
  booking_type: "birthday|photo_session|workshop|corporate|...",
  start_datetime: ISO_UTC, end_datetime: ISO_UTC,
  buffer_end_datetime: ISO_UTC,
  package_id?, selected_services: [...],
  pricing: { subtotal, services_total, tax_pct, tax_amount, total, currency },
  revenue_split: { model, commission_pct, commission_amount, owner_amount },
  payment_status: "pending|paid|partially_refunded|refunded|failed",
  payment_method: "stripe|transfer|cash|platform_wallet",
  booking_status: "draft|confirmed|checked_in|completed|cancelled|no_show",
  notes_customer?, notes_internal?,
  created_at, confirmed_at?, cancelled_at?, cancellation_reason?
}`,
          indexes: [
            "{organization_id:1, space_id:1, start_datetime:1}",
            "{organization_id:1, customer_id:1}",
            "{booking_number:1} unique",
            "TTL pe draft bookings (30 min expiry)",
          ],
        },
        {
          name: "es_booking_payments", purpose: "Plăți + refund tracking",
          schema: `{
  _id, id, booking_id,
  amount, currency,
  payment_method: "stripe|transfer|cash",
  transaction_reference, stripe_payment_intent_id?,
  status: "pending|succeeded|failed|refunded",
  refund_amount: 0, refund_reason?,
  metadata: {},
  created_at
}`,
          indexes: ["{booking_id:1}", "{stripe_payment_intent_id:1}"],
        },
        {
          name: "es_service_providers", purpose: "Marketplace furnizori (fotograf, decor, catering, etc.)",
          schema: `{
  _id, id, organization_id, user_id?,
  company_name, category: "photographer|videographer|decorator|cleaner|catering|...",
  services_offered: [{name, duration_hours, price, currency}],
  description, contact: {email, phone},
  rating_avg, rating_count,
  status: "pending_review|active|suspended",
  verified: true, created_at
}`,
          indexes: ["{organization_id:1, status:1}", "{category:1}"],
        },
        {
          name: "es_booking_services", purpose: "Join booking ↔ serviciu folosit + status payout furnizor",
          schema: `{
  _id, id, booking_id, provider_id,
  service_name, price,
  status: "scheduled|completed|cancelled",
  provider_payout_status: "pending|paid",
  created_at
}`,
          indexes: ["{booking_id:1}", "{provider_id:1, provider_payout_status:1}"],
        },
        {
          name: "es_event_packages", purpose: "Pachete pre-configurate (Aniversare Bronze/Silver/Gold)",
          schema: `{
  _id, id, space_id, organization_id,
  name, slug, description,
  duration_hours, price, currency,
  includes: [...], included_service_ids: [...],
  max_guests, image_url?,
  active: true, sort_order: 0,
  created_at
}`,
          indexes: ["{space_id:1, active:1}"],
        },
        {
          name: "es_digital_twins", purpose: "3D viewer + asset registry + maintenance",
          schema: `{
  _id, id, space_id,
  viewer_url, model_3d_url?, floorplan_url?,
  asset_registry: [{name, qty, category, purchase_date}],
  maintenance_history: [{date, type, vendor_id, notes}],
  technical_docs_urls: [...],
  status: "draft|published",
  created_at, updated_at
}`,
          indexes: ["{space_id:1} unique"],
        },
        {
          name: "es_ai_insights", purpose: "Output AI Manager (revenue forecast, pricing recommendations, etc.)",
          schema: `{
  _id, id, organization_id, space_id?,
  kind: "revenue_forecast|occupancy_optimization|pricing_recommendation|maintenance_alert|upsell|risk_detection|vendor_performance",
  title, summary_md,
  data_snapshot: {}, impact_estimate_eur,
  priority: "critical|high|medium|low",
  status: "open|actioned|dismissed",
  actionable: true,
  suggested_actions: [{label, type, params}],
  generated_at, actioned_at?, actioned_by?
}`,
          indexes: ["{organization_id:1, status:1, priority:1}"],
        },
        {
          name: "es_activity_log", purpose: "Audit trail + integrare cu Activity Stream existent",
          schema: `{
  _id, id, organization_id,
  actor_id?, actor_kind: "user|system|ai",
  action: "booking.created|booking.confirmed|space.published|ai.insight_generated|...",
  subject_type: "booking|space|payment|provider",
  subject_id, payload: {},
  created_at
}`,
          indexes: ["{organization_id:1, created_at:-1}", "{subject_type:1, subject_id:1}"],
        },
        {
          name: "es_organizations", purpose: "Multi-tenant root (opțional Phase ES-8)",
          schema: `{
  _id, id, name, subdomain,
  logo_url?, primary_color,
  billing_plan: "free|starter|pro|white_label",
  stripe_connect_account_id?,
  settings: { default_commission_pct, revenue_model, currency, timezone },
  owner_user_id, created_at
}`,
          indexes: ["{subdomain:1} unique"],
        },
      ],
    },
    risks: [
      { id: "R1", severity: "HIGH",     title: "Concurrent booking race (2 clienți, același slot, aceeași secundă)",
        mitigation: "Atomic `findOneAndUpdate` cu overlap predicate. MongoDB transactions pentru booking + payment. Test suite cu 100+ concurrent POST." },
      { id: "R2", severity: "HIGH",     title: "Timezone bugs (booking la DST boundary creează buffer incorect)",
        mitigation: "Toate timpurile în UTC. Conversie la prezentare. `pytz` consistent. Test cases dedicat DST (martie + octombrie)." },
      { id: "R3", severity: "CRITICAL", title: "Multi-tenant data leak (org A vede booking-uri org B)",
        mitigation: "Middleware obligatoriu inject `organization_id`. Code review checklist. Cron săptămânal audit cross-org references." },
      { id: "R4", severity: "MEDIUM",   title: "Stripe webhook duplication",
        mitigation: "Collection `es_stripe_events_processed` cu unique index pe `stripe_event_id`. Idempotency check înainte de procesare." },
      { id: "R5", severity: "MEDIUM",   title: "Service provider abuse (fake jobs pentru rating inflation)",
        mitigation: "Manual approval gate Phase 1. Rate limit + audit log. Min 30 zile pentru rating eligibility." },
      { id: "R6", severity: "HIGH",     title: "Revenue split refund bug (returnezi 100% dar comision rămâne reținut)",
        mitigation: "Refund logic computes inverse split. Test suite comprehensive. Stripe webhook pentru refund-uri." },
      { id: "R7", severity: "MEDIUM",   title: "Digital Twin URL injection (3rd-party iframe XSS)",
        mitigation: "Whitelist hardcoded: matterport.com, sketchfab.com, self-hosted CDN. Sandbox iframe + CSP header." },
      { id: "R8", severity: "LOW",      title: "AI cost explosion (insights generate prea des)",
        mitigation: "Daily cap 1 job/org. Cache 6h. Alert pe consum peste threshold." },
      { id: "R9", severity: "LOW",      title: "Frontend bundle size growth",
        mitigation: "Lazy-load `/admin/experience-spaces/*` routes. Code splitting Webpack." },
      { id: "R10", severity: "LOW",     title: "Feature flag bypass (cineva lovește API direct cu flag OFF)",
        mitigation: "Middleware verifică ÎNAINTEA logicii rutei. Returnează 403 rapid. Test smoke flag-off pe toate endpoint-urile." },
      { id: "R11", severity: "MEDIUM",  title: "Notification spam (booking confirm trimite 5 emailuri)",
        mitigation: "Email throttling per booking_id. Batch unde e posibil. Flag `notification_sent_at`." },
      { id: "R12", severity: "LOW",     title: "Calendar query performance la 10k+ bookings/lună",
        mitigation: "Indexes pe `{org_id, space_id, start_datetime}` + cache 5 min pe `/calendar` endpoint." },
    ],
    ai: {
      philosophy: "AI READ-ONLY by default. Generează insights și recomandări, dar NU execută acțiuni singur. Admin aprobă orice schimbare. Reutilizăm complet infrastructura existentă (`ai_core/provider.py` cu Claude Sonnet via Emergent LLM Key) — fără duplicări de cod.",
      touchpoints: [
        { title: "Daily Insights Generator", description: "Cron 02:00 zilnic populează `es_ai_insights` cu 5-10 recomandări actionable (revenue forecast, pricing, maintenance, upsell)",
          reuse: "ai_core/provider.py + APScheduler existing", phase: "ES-6" },
        { title: "Pricing Recommender", description: "Pe baza pattern-urilor de cerere, sugerează ajustări de rate (admin aprobă)",
          reuse: "Same LLM provider, nou prompt template", phase: "ES-6" },
        { title: "Maintenance Scheduler", description: "Trackează asset registry din Digital Twin + prezice service due dates",
          reuse: "ai_core + es_digital_twins.asset_registry", phase: "ES-6" },
        { title: "Vendor Performance Scorer", description: "Combină ratings + completion rate + response time în scor unificat",
          reuse: "Same LLM, nou prompt + data din es_booking_services", phase: "ES-6" },
        { title: "AI Concierge Widget (Conversational)", description: "Customer întreabă pe pagina spațiului, AI răspunde din FAQ + space data",
          reuse: "ai_core conversational mode + space metadata", phase: "ES-6" },
        { title: "Customer Retention Agent", description: "Detectează clienți 'pierduți' (>90 zile fără rezervare), draftează emailuri re-engagement",
          reuse: "ai_core + email_service.send_email", phase: "ES-6+" },
        { title: "Upsell Agent", description: "La crearea booking-ului, sugerează pachete + servicii cu copy conversion-optimized",
          reuse: "ai_core inline call în bookings flow", phase: "ES-6+" },
        { title: "Integration cu AI Activity Stream", description: "Toate insight-urile generate apar în `/admin/ai-activity` timeline (cross-module)",
          reuse: "routes/ai_activity.py collector pattern", phase: "ES-6" },
      ],
    },
    revenueScenarios: [
      { name: "Centru educațional kids (pilot)", estimatedRevenue: "1.500€ – 3.500€/lună",
        description: "Aniversări (3-5/lună × 350€), ateliere săptămânale (4 × 200€), workshop-uri lunare (2 × 500€). Marja: 60-70% după costuri operare." },
      { name: "Marketplace furnizori (comision 15%)", estimatedRevenue: "300€ – 800€/lună",
        description: "10-20 furnizori activi × 5-10 booking-uri × comision mediu 50€. Scale la 50+ furnizori = 2.000€+/lună." },
      { name: "Studio foto/video (extensie)", estimatedRevenue: "800€ – 2.500€/lună",
        description: "Booking-uri ore-bază (8h/zi × 70€ × 50% ocupare). Familii + brand sessions + portrait. Marja: 80%+ (cost minim)." },
      { name: "Evenimente corporate (premium)", estimatedRevenue: "1.500€ – 5.000€/lună",
        description: "2-4 evenimente/lună × 750-1.500€ (catering + decor inclus). Ticket mediu ridicat, conversie mai mică." },
      { name: "White-label SaaS (Phase ES-8)", estimatedRevenue: "500€ – 2.000€/lună pe org client",
        description: "Vinzi platforma altor operatori spații (centre, studio-uri). 3-5 clienți la 200€/lună starter + 500€/lună pro." },
    ],
    breakEven: "Cost dev one-time: ~7.000€ (35 zile × 200€/zi rată internă). Opex lunar: ~80€ (AI calls + Stripe fees + email). Break-even la ~3-5 luni dacă centrul pilot generează minim 1.500€/lună NET. Payback complet în 6-8 luni la scenariu mediu. ROI pozitiv compus prin marketplace + white-label.",
    recommendation: "Recomandare: START cu Phase ES-0 + ES-1 (8 zile, ~1.600€ investiție) DOAR DACĂ există un spațiu pilot real pregătit să se ducă live în 30 zile. Dacă pilot-ul nu e gata sau nu validăm cu 3-5 booking-uri reale în prima lună → STOP la ES-1 fără pierdere de date (rollback instant). Decizia ES-2 (booking-uri + plăți reale) se ia DOAR după validarea cererii pe ES-1. AI Manager (ES-6) și White Label (ES-8) sunt strict opționale — adăugare doar dacă MVP-ul atinge 1.500€/lună stabil 3 luni consecutive.",
  },
];
