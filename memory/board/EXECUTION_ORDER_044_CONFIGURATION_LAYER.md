# EXECUTION_ORDER_044 — Configuration Layer (Task 7 + 7.1)

> **Status**: COMPLETED în build/preview curent, securitate validată, **pending deploy production**.
> **Doctrine**: „Reuse existing infrastructure; do not create duplicate configuration engines."
> **Owner**: Founder + AI CPO.
> **Emitent**: 24 Feb 2026.

---

## Scop

Extinde Menu Manager într-un **Configuration Layer** platform-wide fără sisteme paralele. Admin trebuie să poată configura ~65–70% din stratul de conținut/UX/visibility fără cod, protejând core-ul (auth, entitlements, Digital Twin, payments, Client/Specialist Beta).

## Livrat P0

- Page Registry (colecție nouă `db.pages`) — 20 pagini seedate: home, pricing, whyus, estate, sell, marketplace, interior_design, design_exterior, arhitectura, digital_twin, community, demo, login, register, devino_specialist, devino_francizat, privacy, terms, cookies, trust.
- Câmpuri canonice per pagină: `menu_label`, `h1`, `subtitle`, `seo_title`, `seo_description`, `og_title`, `og_description`, `allowed_roles[]`, `allowed_tiers[]`, `desktop_visible`, `mobile_visible`, `feature_flag`, `status` (active/hidden/draft), `version`, `updated_at`, `updated_by`.
- `route` este identificator TEHNIC — read-only în UI, protejat by design în React Router (`App.js`).
- Menu ↔ Page linking prin `db.site_menu.items[].page_key` (câmp OPȚIONAL, backward-compatible).
- Admin UI complet la `/admin/page-registry` cu tabel filtrabil + modal editor 6 secțiuni + deep-link `?edit=<key>` + sidebar entry „Page Registry" (badge CFG).

## Livrat P1

- Draft / Live isolation: `db.pages.live` vs `db.pages.draft`. Save Draft **nu** atinge Live. Public API returnează **doar** Live.
- Publishing workflow: DRAFT → PUBLISH → LIVE, snapshot in `db.pages_versions` (append-only).
- Monotonic version numbering (nu se resetează la restore→publish).
- Restore version = creează NEW DRAFT (nu șterge istoric, nu supraîmpărtășește Live).
- Reset defaults + Discard draft — cu audit.
- Configuration History = VIEW peste `admin_audit_log` (zero al doilea sistem de audit).

## Livrat Task 7.1 (Security + Production Readiness)

**Security audit executat pe 6 fișiere în scop**. Rezultate:

| ID | Severity | Descriere | Fix aplicat |
|---|---|---|---|
| SEC-001 | MEDIUM | Operator putea folosi filtrul `actor` pentru a extrage tot `admin_audit_log` prin `/api/admin/config-history` | ✅ `target.type` restriction ALWAYS aplicat, indiferent de filtre |
| SEC-002 | MEDIUM | Pages cu `feature_flag` OFF erau expuse public (leak conținut + nume flag) | ✅ `_resolve_public` returnează `None` când flag OFF → endpoint returnează 404 |
| P3.1 | LOW | Concurrent publish putea duplica version numbers | ✅ Unique index `(page_key, version)` pe `db.pages_versions` |
| P3.2 | LOW | Public payload expunea `allowed_roles`, `allowed_tiers`, `feature_flag` (access rules leak) | ✅ Stripped din public payload — admin-only |
| P3.3 | INFO | Schema mismatch: legacy audit folosește `target_type` flat vs nou `target.type` nested | Documentat, funcțional (nu blocher) |

**Verdict security**: `PASS` post-fix. Zero CRITICAL/HIGH. Zero MEDIUM outstanding.

## Testing

- **Unit + integration**: 13 teste dedicate în `tests/test_pages_registry_iter188.py` (10 original + 3 security post-fix).
- **Regresie Tasks 1–6.1 + Task 7**: **56/56 PASS**.
- **Cross-cutting suite extinsă** (Entitlements + PTR v1/v2 + Task 7): **109/109 PASS**.

## Ce e configurabil ACUM din Admin fără cod

- Menu structure / labels / icons / visibility / auto-reorder
- Page menu_label / H1 / subtitle
- Page SEO title & description
- Page OG title & description
- Page role/tier/device visibility
- Page feature_flag ON/OFF
- Page status: active/hidden/draft
- Publishing workflow: draft → live + version history + restore
- CMS fragments (hero.badge, cta.*, footer.*, promo.*)
- App settings globale (social, contact, company, pricing display, SEO defaults)
- Feature matrix (role × tier × enabled) + quest-uri + vouchers
- Menu ↔ Page linking (`page_key` opțional pe menu items)
- Configuration history unificată

## Ce încă necesită cod (protected core)

- Route URLs (React Router) — protejate by design
- JSX component structure — Page Registry configurează CONȚINUTUL, nu structura
- Business logic core (payments, entitlements, escrow, Stripe)
- Digital Twin core
- Authentication + user schema
- Form fields (schema `db.forms_config` NU e implementată încă — P2)
- Workflow statuses (schema `db.workflows_config` NU e implementată — P2)
- Design tokens globale (CSS vars în cod — P2 UI editor absent)

## Protected — NU modificat de Task 7 / 7.1

- Stripe / subscriptions / entitlements / lifecycle
- Digital Twin / House Health / dashboards
- Authentication / roles / marketplace
- Client Beta / Specialist Beta / existing Demo accounts
- Existing routes (`/pricing`, `/marketplace`, `/imobile-verificate`, etc.)
- DB schema pentru users / properties / requests / hh_subscriptions / property_technical_record

## Deployment Status

| Layer | Status |
|---|---|
| Implementat în cod / build | ✅ COMPLET |
| Verificat în preview | ✅ COMPLET (smoke + pytest) |
| Verificat prin teste | ✅ 109/109 PASS |
| Deploy pe production | ⏳ **PENDING** — necesită deploy explicit al build-ului |

**Production readiness verdict**: **READY (security validated)**. Fondator poate autoriza deploy când decide.

## NEXT PHASE (NU IMPLEMENTAT — doar documentat)

P2 este strict `schema-only` conform constraint fondator „NU UI gigant":

1. `forms_config` — schema stub pregătită (form_key, fields[], validation, visibility). **NU** implementat.
2. `workflows_config` — schema stub (workflow_key, statuses[], transitions[]). **NU** implementat.
3. `design_tokens` — CSS vars centralized. **NU** implementat.
4. Config Import/Export (JSON backup + migrare între medii). **NU** implementat.
5. Real-time Preview Overlay (`?preview=<token>` render). **NU** implementat.
6. Deployment pe production. **PENDING** decizie founder.

`recommended next actions` **nu sunt** marcate ca livrate.

## Immediate Next Step

După Task 7.1 (COMPLETED), următoarea acțiune posibilă este **production deployment** (dacă fondatorul autorizează). **NU** începe P2 până când producția nu e sincronizată cu preview.

---

## Artefacte

- Backend: `/app/backend/routes/pages_registry.py` (nou), `/app/backend/routes/site_menu.py` (extins cu `page_key`), `/app/backend/routes/register.py` (înregistrare router)
- Frontend: `/app/frontend/src/pages/admin/PageRegistryPage.jsx` (nou), `/app/frontend/src/pages/admin/MenuManagerPage.jsx` (extins), `/app/frontend/src/pages/admin/AdminLayoutMetronic.jsx` (sidebar), `/app/frontend/src/App.js` (rută lazy), `/app/frontend/src/lib/useDynamicSEO.js` (rescris cu cascade)
- Tests: `/app/backend/tests/test_pages_registry_iter188.py` (13 teste)
- Docs: `/app/memory/PRD.md` (Task 7 + Task 7.1 entries), `/app/memory/board/EXECUTION_ORDER_044_CONFIGURATION_LAYER.md` (acest doc)
