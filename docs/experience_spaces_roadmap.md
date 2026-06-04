# 🏢 EXPERIENCE SPACES — Architecture Review & Implementation Roadmap

> **Status**: PRE-CODE — Analiză completă livrată ÎNAINTE de orice scriere de cod.  
> **Decizie cerută**: Validare arhitectură + aprobare faze înainte de scaffolding.  
> **Risk Score**: **5/10** (medium — surface area mare dar arhitectural separabil)

---

## 🎯 EXECUTIVE SUMMARY

Experience Spaces este un modul **complet izolat** care transformă PropManage din *Property Management* în *Business Operating System*. Modulul:

- ✅ Folosește **MongoDB exclusiv** (consistent cu regula confirmată — no Postgres/Qdrant)
- ✅ Are colecții MongoDB **complet separate** (zero overlap cu colecțiile existente)
- ✅ Toate rutele sub `/api/experience-spaces/*` (niciodată atinge `/api/requests/`, `/api/properties/`, etc.)
- ✅ Activabil/dezactivabil printr-un **feature flag** stocat în `app_settings`
- ✅ Reutilizează componente AI (ai_core/provider) + email_service + Stripe — fără duplicare
- ✅ Arhitectură **multi-tenant ready** (organization_id pe fiecare document)
- ✅ Rollback prin DOAR două acțiuni: feature flag OFF + drop colecții noi

---

## 📐 PRINCIPII ARHITECTURALE (NEGOCIABILE)

| # | Principiu | Justificare |
|---|---|---|
| 1 | **MongoDB only** (no Postgres) | Confirmat cu user-ul în 3 sesiuni consecutive. Evităm complexitate operațională. |
| 2 | **Colecții complet noi** | Prefix `es_*` (es = experience spaces). Zero modificări pe colecții existente. |
| 3 | **Routes sub `/api/experience-spaces/*`** | Niciun endpoint existent atins. Modul = sub-aplicație montată. |
| 4 | **Feature flag `enable_experience_spaces`** | Default `false`. Citit din `app_settings._id="config"` la fiecare request via middleware. |
| 5 | **organization_id pe fiecare doc** | Multi-tenant ready de la zi 1. Default: organization curentă a admin-ului. |
| 6 | **Server-side time enforcement** | Buffer + overlap detection NICIODATĂ în frontend. Toate validările în backend. |
| 7 | **Atomic booking creation** | `findOneAndUpdate` cu condition check pentru a preveni race conditions la 2 clienți simultani. |
| 8 | **AI READ-ONLY by default** | AI Manager generează doar recomandări, niciodată execută rezervări singur. |
| 9 | **Stripe reused** | Adăugăm doar `payment_intent_metadata.es_booking_id` — nu duplicăm integrarea. |
| 10 | **Email reused** | Folosim `email_service.send_email` existent + template-uri noi separate. |

---

## 🗂️ DATABASE SCHEMA (MongoDB Collections)

> Toate colecțiile noi prefixate `es_` pentru izolare vizuală + de-conflict garantat.

### `es_spaces`
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "organization_id": "uuid",
  "name": "string",
  "slug": "string-kebab",            // URL-friendly, unique per org
  "description": "string (markdown)",
  "capacity": 25,
  "location": {
    "address": "string",
    "city": "string",
    "lat": 44.4, "lng": 26.1,
    "google_maps_url": "string?"
  },
  "hourly_rate": 150,                // RON
  "currency": "RON",
  "minimum_booking_hours": 2,
  "buffer_time_minutes": 60,
  "status": "draft" | "active" | "paused" | "archived",
  "digital_twin_id": "uuid?",        // FK -> es_digital_twins
  "gallery_image_urls": ["..."],
  "cover_image_url": "string?",
  "tags": ["birthday", "kids", "educational"],
  "created_at": ISO,
  "updated_at": ISO
}
```

### `es_space_availability`
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "space_id": "uuid",
  "day_of_week": 0-6,                // 0=Monday in ISO 8601
  "start_time": "10:00",             // HH:MM (24h) — local space timezone
  "end_time": "20:00",
  "blocked": false,
  "blocked_reason": "string?",        // ex: "national holiday"
  "created_at": ISO
}
```
**Note**: All times stored in space's local timezone (added as `es_spaces.timezone` field). Server normalizes to UTC for calendar queries.

### `es_bookings`
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "booking_number": "ES-2026-000123",  // human-readable
  "organization_id": "uuid",
  "space_id": "uuid",
  "customer_id": "uuid?",              // existing users collection FK (optional)
  "customer_snapshot": {                // for guest bookings
    "name": "string",
    "email": "string",
    "phone": "string?",
    "guest_count": 12
  },
  "booking_type": "birthday" | "photo_session" | "workshop" | "corporate" | "private" | "educational" | "custom",
  "start_datetime": ISO,               // UTC
  "end_datetime": ISO,                 // UTC
  "buffer_end_datetime": ISO,          // start_datetime + duration + buffer (computed at creation)
  "package_id": "uuid?",                // FK -> es_event_packages
  "selected_services": [
    {"provider_id": "uuid", "service_name": "string", "price": 200}
  ],
  "pricing": {
    "subtotal": 600,
    "services_total": 200,
    "tax_pct": 19,
    "tax_amount": 152,
    "total": 952,
    "currency": "RON"
  },
  "revenue_split": {
    "model": "marketplace" | "direct" | "subscription_reduced" | "white_label",
    "commission_pct": 15,
    "commission_amount": 142.80,
    "owner_amount": 809.20
  },
  "payment_status": "pending" | "paid" | "partially_refunded" | "refunded" | "failed",
  "payment_method": "stripe" | "transfer" | "cash" | "platform_wallet",
  "booking_status": "draft" | "confirmed" | "checked_in" | "completed" | "cancelled" | "no_show",
  "notes_customer": "string?",
  "notes_internal": "string?",
  "created_at": ISO,
  "confirmed_at": ISO?,
  "cancelled_at": ISO?,
  "cancellation_reason": "string?"
}
```
**Indexes needed**:
- `{organization_id: 1, space_id: 1, start_datetime: 1}` — calendar queries
- `{organization_id: 1, customer_id: 1}` — customer history
- `{booking_number: 1}` unique
- TTL index on `created_at` for "draft" bookings (30 min expiry — abandons)

### `es_booking_payments`
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "booking_id": "uuid",
  "amount": 952.00,
  "currency": "RON",
  "payment_method": "stripe" | "transfer" | "cash",
  "transaction_reference": "pi_xxx" | "ref_xxx",
  "status": "pending" | "succeeded" | "failed" | "refunded",
  "stripe_payment_intent_id": "string?",
  "refund_amount": 0,
  "refund_reason": "string?",
  "metadata": {},
  "created_at": ISO
}
```

### `es_service_providers`
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "organization_id": "uuid",
  "user_id": "uuid?",                  // FK to existing users (if has account)
  "company_name": "string",
  "category": "photographer" | "videographer" | "decorator" | "cleaner" | "catering" | "entertainer" | "maintenance" | "security" | "custom",
  "services_offered": [
    {"name": "Family Photo Session", "duration_hours": 2, "price": 350, "currency": "RON"}
  ],
  "description": "string (markdown)",
  "contact": {"email": "...", "phone": "..."},
  "rating_avg": 4.8,
  "rating_count": 42,
  "status": "pending_review" | "active" | "suspended",
  "verified": true,
  "created_at": ISO
}
```

### `es_booking_services` (join: booking ↔ service used)
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "booking_id": "uuid",
  "provider_id": "uuid",
  "service_name": "string",
  "price": 200,
  "status": "scheduled" | "completed" | "cancelled",
  "provider_payout_status": "pending" | "paid",
  "created_at": ISO
}
```

### `es_event_packages`
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "space_id": "uuid",
  "organization_id": "uuid",
  "name": "Pachet Aniversare Bronze",
  "slug": "string-kebab",
  "description": "string (markdown)",
  "duration_hours": 3,
  "price": 600,
  "currency": "RON",
  "includes": ["3h spațiu", "Buffer 1h curățenie", "Coordinator eveniment", "Setup mese"],
  "included_service_ids": ["uuid"],     // pre-selected providers
  "max_guests": 25,
  "image_url": "string?",
  "active": true,
  "sort_order": 0,
  "created_at": ISO
}
```

### `es_digital_twins`
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "space_id": "uuid",
  "viewer_url": "string",              // embedded iframe URL (Matterport, Sketchfab, custom)
  "model_3d_url": "string?",            // .glb/.gltf for self-hosted viewer
  "floorplan_url": "string?",
  "virtual_tour_url": "string?",
  "asset_registry": [
    {"name": "Proiector Epson", "qty": 1, "category": "av", "purchase_date": "2025-01-15"}
  ],
  "maintenance_history": [
    {"date": "2025-11-20", "type": "deep_clean", "vendor_id": "uuid", "notes": "..."}
  ],
  "technical_docs_urls": ["..."],
  "status": "draft" | "published",
  "created_at": ISO,
  "updated_at": ISO
}
```

### `es_ai_insights` (AI Manager output log)
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "organization_id": "uuid",
  "space_id": "uuid?",                  // null = org-wide
  "kind": "revenue_forecast" | "occupancy_optimization" | "pricing_recommendation" | "maintenance_alert" | "upsell" | "risk_detection" | "vendor_performance",
  "title": "string",
  "summary_md": "string (markdown)",
  "data_snapshot": {},                  // raw numbers behind the insight
  "impact_estimate_eur": 230,
  "priority": "critical" | "high" | "medium" | "low",
  "status": "open" | "actioned" | "dismissed",
  "actionable": true,
  "suggested_actions": [
    {"label": "Reduce pricing weekday 9-17 by 10%", "type": "pricing_change", "params": {...}}
  ],
  "generated_at": ISO,
  "actioned_at": ISO?,
  "actioned_by": "user_id?"
}
```

### `es_activity_log` (audit + activity stream integration)
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "organization_id": "uuid",
  "actor_id": "user_id?",
  "actor_kind": "user" | "system" | "ai",
  "action": "booking.created" | "booking.confirmed" | "booking.cancelled" | "space.published" | "ai.insight_generated" | ...,
  "subject_type": "booking" | "space" | "payment" | "provider",
  "subject_id": "uuid",
  "payload": {},
  "created_at": ISO
}
```

### `es_organizations` (multi-tenant root — optional Phase 4)
```json
{
  "_id": ObjectId,
  "id": "uuid",
  "name": "PropManage RO",
  "subdomain": "propmanage",            // future: kids-center.propmanage.ro
  "logo_url": "string?",
  "primary_color": "#d4ff3a",
  "billing_plan": "free" | "starter" | "pro" | "white_label",
  "stripe_connect_account_id": "string?",
  "settings": {
    "default_commission_pct": 15,
    "revenue_model": "marketplace",
    "currency": "RON",
    "timezone": "Europe/Bucharest"
  },
  "owner_user_id": "uuid",
  "created_at": ISO
}
```

---

## 🔌 API ARCHITECTURE

All endpoints under `/api/experience-spaces/*`. Each guarded by feature flag check + RBAC.

```
GET    /api/experience-spaces/spaces                       List active spaces (public + admin)
POST   /api/experience-spaces/spaces                       Create space (admin)
GET    /api/experience-spaces/spaces/{slug}                Public detail page
PUT    /api/experience-spaces/spaces/{id}                  Update (admin)
DELETE /api/experience-spaces/spaces/{id}                  Archive (admin)

GET    /api/experience-spaces/spaces/{id}/availability     Get availability calendar (public)
PUT    /api/experience-spaces/spaces/{id}/availability     Update availability rules (admin)

GET    /api/experience-spaces/spaces/{id}/calendar         Get computed slots for date range (public)
                                                            ?from=2026-06-01&to=2026-06-30

POST   /api/experience-spaces/bookings/quote               Compute price for prospective booking (public)
POST   /api/experience-spaces/bookings                     Create booking (auth or guest)
GET    /api/experience-spaces/bookings                     List own/all bookings (auth)
GET    /api/experience-spaces/bookings/{id}                Booking detail (auth: owner or admin)
PUT    /api/experience-spaces/bookings/{id}/confirm        Confirm draft (admin or auto on payment)
PUT    /api/experience-spaces/bookings/{id}/cancel         Cancel + trigger refund logic
POST   /api/experience-spaces/bookings/{id}/check-in       Customer arrives (admin)

POST   /api/experience-spaces/bookings/{id}/pay            Initiate Stripe payment intent
POST   /api/experience-spaces/webhooks/stripe              Stripe webhook (idempotent)

GET    /api/experience-spaces/packages?space_id=...        List packages
POST   /api/experience-spaces/packages                     Create (admin)
PUT    /api/experience-spaces/packages/{id}                Update (admin)

GET    /api/experience-spaces/providers                    List providers (public + admin)
POST   /api/experience-spaces/providers                    Provider signup
PUT    /api/experience-spaces/providers/{id}/approve       Admin approval

GET    /api/experience-spaces/digital-twins/{space_id}     Public twin viewer data
PUT    /api/experience-spaces/digital-twins/{space_id}     Update (admin)

GET    /api/experience-spaces/analytics/occupancy          Occupancy report (admin)
GET    /api/experience-spaces/analytics/revenue            Revenue report (admin)
GET    /api/experience-spaces/analytics/dashboard          Aggregate KPIs (admin)

GET    /api/experience-spaces/ai-manager/insights          List active insights (admin)
POST   /api/experience-spaces/ai-manager/regenerate        Force re-run analysis (admin)
PUT    /api/experience-spaces/ai-manager/insights/{id}/action  Mark as actioned/dismissed

POST   /api/experience-spaces/commissions/payout-batch     Trigger monthly payout calc (admin)

GET    /api/experience-spaces/_config                      Feature flag + org config (used by frontend bootstrap)
```

---

## 🎨 UI ARCHITECTURE

### Public-facing (no auth required)
```
/spaces                              List of available spaces (per organization)
/spaces/{slug}                       Space detail + Digital Twin + booking widget
/spaces/{slug}/book                  Booking wizard (5 steps)
/spaces/{slug}/digital-twin          Full-screen 3D viewer
/booking/confirmation/{id}           Post-payment confirmation
```

### Customer dashboard (logged in)
```
/my/bookings                         History
/my/bookings/{id}                    Details + invoice download + cancel
```

### Admin dashboard (under existing /admin)
```
/admin/experience-spaces             Module home (KPIs, recent bookings, AI insights)
/admin/experience-spaces/spaces      CRUD spaces
/admin/experience-spaces/calendar    Master calendar (all spaces)
/admin/experience-spaces/bookings    Bookings table + filters
/admin/experience-spaces/packages    Manage packages per space
/admin/experience-spaces/providers   Provider directory + approval
/admin/experience-spaces/ai-manager  AI insights dashboard
/admin/experience-spaces/analytics   Revenue + occupancy reports
/admin/experience-spaces/settings    Module settings (commission, models, feature flag)
```

### Provider dashboard (new role: `service_provider`)
```
/provider/jobs                       Upcoming bookings I'm assigned to
/provider/profile                    Edit my profile + services
/provider/earnings                   Payout history
```

### Design system
- Reuse existing PropManage tokens (lime accent `#d4ff3a`, serif headers, dark mode default for admin, light for public)
- New iconography: `Calendar`, `Sparkles`, `Camera`, `Cake`, `Briefcase` (lucide-react — already installed)
- Public booking pages: warmer feel — use illustrations from existing image library

---

## 🤖 AI INTEGRATION OPPORTUNITIES

### Phase 1 (MVP — Read-only)
- **Daily insights generator** (cron 02:00) → populates `es_ai_insights`
  - Uses Claude Sonnet via existing `ai_core/provider.py`
  - Inputs: bookings last 30/90 days, occupancy, revenue, vendor activity
  - Outputs: 5-10 actionable insights/day with impact estimates
- **Pricing recommender**: based on demand patterns, suggests rate adjustments
- **Maintenance scheduler**: tracks digital twin asset registry + predicts service due dates
- **Vendor performance scorer**: ratings + completion rate + response time

### Phase 2 (Conversational)
- **AI Concierge widget** for booking pages: customer asks questions, AI answers from space data + FAQs
- **Customer retention agent**: detects "lost" customers (no booking in 90+ days), drafts re-engagement emails
- **Upsell agent**: when booking is created, suggests packages + services with conversion-optimized copy

### Phase 3 (Agentic — opt-in only)
- **Auto-pricing**: AI adjusts hourly rates within admin-defined bounds (±15%) based on demand
- **Auto-vendor-assign**: AI proposes vendor for booking, admin approves with 1 click

### Reuse existing infrastructure
| Existing component | How it's reused |
|---|---|
| `ai_core/provider.py` | All LLM calls (Claude Sonnet via Emergent LLM Key) |
| `routes/ai_activity.py` | New collector for `es_*` events (timeline integration) |
| `email_service.send_email` | Booking confirmations + AI insight digests |
| `Stripe integration` | Payments + refunds + Connect for vendor payouts (Phase 4) |
| `APScheduler` (existing scheduler) | Daily AI insights job + monthly payout calc |

---

## 🛡️ SECURITY MODEL

### RBAC matrix
| Role | spaces | bookings (own) | bookings (all) | calendar | providers | ai_manager | analytics |
|---|---|---|---|---|---|---|---|
| `anon` | R (active only) | – | – | R (slot availability only) | R (active only) | – | – |
| `customer` | R | CRUD | – | R | R | – | – |
| `service_provider` | R | – | R (assigned only) | – | RU (self) | – | R (self) |
| `org_admin` | CRUD | – | CRUD | CRUD | CRUD | RUD | R |
| `platform_admin` | CRUD (all orgs) | – | CRUD (all orgs) | CRUD | CRUD | RUD | R |

### Multi-tenant enforcement
- **Every query MUST include `organization_id` filter** — enforced via dependency injection at route level
- No "raw" Mongo queries allowed without organization_id check
- Audit: weekly cron checks for cross-org data leaks (e.g., booking on space_id from different org)

### Audit & Activity Logs
- Every state change → `es_activity_log` doc
- Stripe webhook events → idempotent (check `stripe_event_id` exists before processing)
- AI decisions → `es_ai_insights` + linked to `es_activity_log` with `actor_kind="ai"`

---

## 🔁 FEATURE FLAG IMPLEMENTATION

Singleton document `app_settings._id="config"` (existing pattern):
```json
{
  "enable_experience_spaces": false,        // master kill switch
  "es_modules_enabled": {                   // granular control
    "spaces": true,
    "bookings": true,
    "payments": false,                       // start without Stripe in Phase 2
    "providers": false,
    "ai_manager": false,
    "digital_twin": true,
    "analytics": true
  },
  "es_pilot_organization_ids": ["uuid"],    // Phase 3: only specific orgs see it
  "es_beta_user_emails": []                  // gradual rollout
}
```

**Middleware** (`backend/experience_spaces/middleware.py`):
```python
async def require_es_enabled(user, request):
    settings = await get_app_settings()
    if not settings.get("enable_experience_spaces"):
        raise HTTPException(403, "Experience Spaces module is disabled")
    # Granular check by route path
    module = extract_module_from_path(request.url.path)
    if not settings["es_modules_enabled"].get(module, True):
        raise HTTPException(403, f"Sub-module {module} is disabled")
    # Pilot check
    pilot_orgs = settings.get("es_pilot_organization_ids", [])
    if pilot_orgs and user.get("organization_id") not in pilot_orgs:
        raise HTTPException(403, "Not in pilot")
```

---

## ⚠️ RISKS & MITIGATIONS

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| R1 | **Concurrent booking race** (2 customers book same slot in same second) | HIGH | Atomic `findOneAndUpdate` with overlap predicate. Use Mongo transactions for booking + payment. |
| R2 | **Timezone bugs** (booking at "DST boundary" creates incorrect buffer) | HIGH | Store all times in UTC. Convert at presentation layer. Use `pytz` consistently. Test cases for DST. |
| R3 | **Multi-tenant data leak** | CRITICAL | Mandatory `organization_id` middleware. Weekly cron audit. Code review checklist. |
| R4 | **Stripe webhook duplication** | MEDIUM | Idempotency via `stripe_event_id` deduplication collection. |
| R5 | **Service provider abuse** (creates fake jobs to inflate ratings) | MEDIUM | Manual approval gate in Phase 1. Rate limit + audit log. |
| R6 | **Revenue split refund bug** | HIGH | Refund logic computes inverse split. Comprehensive test suite. Stripe webhook for refunds. |
| R7 | **Digital Twin URL injection** (3rd-party iframe XSS) | MEDIUM | Whitelist of allowed embed domains (Matterport, Sketchfab, self-hosted). |
| R8 | **AI cost explosion** (insights generated too often) | LOW | Daily cap on AI calls per org. Cache insights 6h. |
| R9 | **Frontend bundle size growth** | LOW | Lazy-load `/admin/experience-spaces/*` routes. Code split. |
| R10 | **Feature flag bypass** (someone hits API directly with flag off) | LOW | Middleware checks before ANY route logic. Returns 403 fast. |
| R11 | **Notification spam** (booking confirms send 5 emails) | MEDIUM | Email throttling per booking_id. Batch where possible. |
| R12 | **Calendar query performance** at 10k+ bookings/month | LOW | Indexes on `{org_id, space_id, start_datetime}` + cache 5 min on `/calendar`. |

### **Composite Risk Score: 5/10**
- Surface area: large (~30 endpoints, ~20 UI pages)
- Architectural isolation: excellent (separable in 1 commit revert)
- Critical risks all have known mitigations
- Main concerns: timezones, race conditions, multi-tenant leaks — all solvable with discipline

---

## 📅 IMPLEMENTATION ROADMAP

### **PHASE ES-0: Foundation (1 sprint, ~3 days)**
**Deliverables**:
- [ ] Feature flag scaffolding in `app_settings` + UI toggle in Admin Settings
- [ ] Backend folder `/app/backend/experience_spaces/` (engine, models, helpers)
- [ ] Routes folder `/app/backend/routes/experience_spaces/` (sub-routers)
- [ ] Frontend folder `/app/frontend/src/pages/experience-spaces/` + `/admin/experience-spaces/`
- [ ] Migration helper (idempotent — creates indexes on `es_*` collections)
- [ ] Middleware `require_es_enabled` + RBAC `require_es_role`
- [ ] Smoke test: feature flag OFF returns 403 on all `/api/experience-spaces/*`

**Definition of Done**: All endpoints return 403 when flag is OFF. Zero modifications to existing code (verified by `git diff`).

---

### **PHASE ES-1: Spaces + Calendar (2 sprints, ~5 days)**
**Deliverables**:
- [ ] CRUD spaces (admin)
- [ ] Public listing `/spaces` + detail `/spaces/{slug}`
- [ ] Availability rules CRUD (admin)
- [ ] Calendar engine: computes slots given availability + bookings + buffer
- [ ] Public calendar endpoint with caching
- [ ] Admin master calendar UI (drag-drop later)
- [ ] Activity log integration

**Tests**: 
- 50+ unit tests for calendar logic (overlap detection, buffer, DST edge cases)
- 10 e2e tests for admin CRUD + public listing

---

### **PHASE ES-2: Bookings + Packages (2 sprints, ~5 days)**
**Deliverables**:
- [ ] Package CRUD (admin)
- [ ] Quote endpoint (price calculation incl. tax + revenue split)
- [ ] Booking creation with atomic overlap check
- [ ] Booking confirmation/cancel/check-in flows
- [ ] Customer dashboard `/my/bookings`
- [ ] Admin booking table with filters

**Tests**: Race condition test (concurrent POST /bookings) + revenue split correctness

---

### **PHASE ES-3: Payments (1.5 sprints, ~4 days)**
**Deliverables**:
- [ ] Stripe payment intent integration (reuse existing key)
- [ ] Stripe webhook handler (idempotent)
- [ ] Refund flow (full + partial)
- [ ] Revenue split tracking in `es_booking_payments`
- [ ] Manual payment methods (transfer, cash) admin entry

**Tests**: Stripe test mode webhooks, refund logic, idempotency

---

### **PHASE ES-4: Digital Twin (1 sprint, ~3 days)**
**Deliverables**:
- [ ] Twin CRUD per space
- [ ] Public embedded viewer (whitelist iframe sources)
- [ ] Asset registry UI
- [ ] Maintenance history UI
- [ ] Integration in booking flow ("Vezi spațiul în 3D")

---

### **PHASE ES-5: Service Providers (1.5 sprints, ~4 days)**
**Deliverables**:
- [ ] Provider signup + admin approval
- [ ] Provider directory (public)
- [ ] Add services to booking
- [ ] Provider dashboard
- [ ] Booking-services link + status tracking

---

### **PHASE ES-6: AI Manager (2 sprints, ~5 days)**
**Deliverables**:
- [ ] Daily insights cron (uses ai_core/provider)
- [ ] Insights UI in admin
- [ ] Conversational widget (Claude Sonnet) embedded in admin dashboard
- [ ] Integration with `/api/admin/ai-activity` (cross-module timeline)

---

### **PHASE ES-7: Analytics + Reports (1 sprint, ~3 days)**
**Deliverables**:
- [ ] Occupancy report
- [ ] Revenue report
- [ ] Package performance
- [ ] Provider performance
- [ ] CSV/PDF export
- [ ] Email digest schedule (weekly)

---

### **PHASE ES-8: Multi-Tenant + White Label (3 sprints, ~7 days)** [optional]
**Deliverables**:
- [ ] `es_organizations` collection + onboarding flow
- [ ] Subdomain routing (`kids-center.propmanage.ro`)
- [ ] Per-org branding (logo, colors, custom domain)
- [ ] Per-org billing (Stripe subscription)
- [ ] Stripe Connect for vendor payouts

---

**Total: ~35 days dev time** for full roadmap. MVP (Phases ES-0 to ES-3) = ~17 days.

---

## 🚀 DEPLOYMENT STRATEGY

### Phase A — Internal Testing (Phases ES-0 → ES-3)
- Flag OFF in production
- Flag ON in preview env
- Internal admin testing
- Smoke tests via testing_agent_v3_fork after each phase

### Phase B — Pilot (1 org, ES-4 → ES-5)
- Whitelist `es_pilot_organization_ids: ["our-test-org-uuid"]`
- Real bookings start being created
- Monitor `es_activity_log` daily

### Phase C — Beta (multi-org, ES-6 → ES-7)
- Flag OFF by default
- Org admins opt-in via Settings → Experience Spaces
- AI insights start running

### Phase D — GA (ES-8 + beyond)
- Flag ON by default for new orgs
- Marketing push
- White-label tier launch

---

## 🔙 ROLLBACK STRATEGY

### Hot rollback (< 1 min)
```
PUT /api/admin/app-settings/config
{ "enable_experience_spaces": false }
```
All `/api/experience-spaces/*` endpoints return 403 instantly. UI pages show "Module disabled" message.

### Full rollback (< 5 min)
1. Set feature flag OFF (above)
2. Hide UI entries via `AdminLayoutMetronic` conditional rendering (already checks flag)
3. (Optional) Drop indexes on `es_*` collections to free resources
4. (Nuclear option, only if catastrophic) `db.es_*.drop()` — data lost but zero impact on existing modules

### Verification post-rollback
- Test all existing flows: login, properties, requests, payments, dashboards
- All should pass with **zero behavioral change**
- Existing collections never touched, so impossible to corrupt

---

## 📦 DEPENDENCIES (NEW)

### Backend (Python — to add via `pip install` then update requirements.txt)
- `icalendar==6.x` — generate `.ics` calendar files for bookings
- `python-dateutil==2.x` — DST handling, already installed
- (No new heavy deps — reuse existing FastAPI, motor, pydantic, stripe, apscheduler)

### Frontend (Yarn)
- `react-big-calendar` OR `@fullcalendar/react` — admin master calendar
- `react-datepicker` — booking date selector
- (3D viewer: embed Matterport/Sketchfab iframe — no library needed initially)

**Total new deps: ~3 packages** — minimal footprint.

---

## 🎁 FUTURE MARKETPLACE OPPORTUNITIES

Once Experience Spaces is stable, the module unlocks:

1. **Inter-org space marketplace** — orgs can list spaces to each other (commission to platform)
2. **Vendor marketplace cross-org** — photographers/decorators visible to multiple orgs
3. **AI Manager-as-a-Service** — sell the AI insights engine to other SaaS products via API
4. **Booking widget embed** — generate `<script>` snippet for orgs to embed on their own sites
5. **Affiliate program** — referral commission for orgs onboarding others
6. **Digital Twin Studio** — separate SaaS for creating twins (rendering pipeline)

---

## ✅ FINAL RECOMMENDATIONS

### Do this BEFORE writing code:
1. ✅ User approves this roadmap document (THIS IS WHERE WE ARE NOW)
2. ✅ Decide MVP scope: ES-0 → ES-3 (foundation + spaces + bookings + payments) is the recommended minimum
3. ✅ Confirm timezone for first space (Europe/Bucharest assumed)
4. ✅ Confirm currency (RON default)
5. ✅ Confirm pilot organization (single-tenant first → multi-tenant in ES-8)
6. ✅ Confirm AI usage budget (estimated 30-50€/month for daily insights at full scale)

### Implementation order (highest impact first):
1. **PHASE ES-0 + ES-1**: Scaffold + first space visible publicly (no booking yet) — proves architecture works
2. **PHASE ES-2 + ES-3**: First real revenue (bookings + payments) — proves business model
3. **PHASE ES-5 + ES-6**: AI + Providers — differentiation
4. **PHASE ES-4 + ES-7**: Polish (Digital Twin + Analytics)
5. **PHASE ES-8**: Multi-tenant — only when validated with 1 real org

### Anti-patterns to avoid:
- ❌ Don't modify existing collections (Property, Request, User schema)
- ❌ Don't add `experience_spaces` references in existing routes
- ❌ Don't share business logic between modules (no "shared lib" — copy-paste preferred)
- ❌ Don't enable AI Manager before manual flows are stable (AI builds on data)
- ❌ Don't skip activity log entries — every state change must be auditable

---

## ⏭️ NEXT STEP

**Aprobă acest roadmap** (sau cere ajustări) pentru a începe **PHASE ES-0** (foundation + feature flag).

După aprobare:
1. Scaffolding-ul rulează în ~30 minute fără să atingă codul existent
2. Test cu testing_agent_v3_fork pe primul phase
3. Aprobă să continuăm cu ES-1 (Spaces public listing)

**Niciun cod nu va fi scris până la confirmarea ta.**
