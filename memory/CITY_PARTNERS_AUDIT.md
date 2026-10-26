# AUDIT — City Partners + Strategic Partnership (iunie 2026)

> Audit read-only. Fără deploy, fără migrări, fără activare exclusivități reale.
> Scop: extindere controlată spre sistem comercial unificat (parteneri, acorduri,
> recomandări, teritorii, rezultate) + pregătire categorie City nZEB, REUTILIZÂND
> entitățile existente (fără sisteme paralele).

## 1. INVENTAR — ce există (fișiere + endpoint-uri + colecții)

### Backend
- `routes/city_partners.py` (882 linii) — 3 routere:
  - `/api/admin/city-partners` (super-admin): list, create, GET/PATCH/DELETE(soft→terminated),
    `/stats`, `/ecosystem-map`, `/{id}/onboarding-step` (7 pași), `/{id}/create-login`
    (creează user role=`city_partner`), `/{id}/leads` GET/POST, `/leads/{lead_id}` PATCH.
  - `/api/partner` (role=city_partner, self-service): `/me`, `/leads` GET/POST, `/stats`,
    `/copilot/nudges` (Claude Sonnet 4.5).
  - `/api/admin/city-partner-products` (super-admin): catalog materiale (CRUD).
  - Colecții: `city_partners`, `city_partner_leads`, `city_partner_products`.
  - Câmpuri partener (backend): company, contact_*, city, county, units_managed, growth_rate,
    portfolio_type, status (lead|onboarding|active|paused|terminated), onboarding_step 0-7,
    territory_protected (bool), linked_user_id, + **additive (Faza 4A)**: partner_type
    {studio,city,regional,national,supplier,brand,specialist}, coverage {city,regional,national},
    region, services[], design_stages[], brands[], materials[], projects[].
- `routes/marketplace_partners.py` (700 linii) — `/api/admin/marketplace-partners` +
  `/api/marketplace-partner` portal. Câmpuri: categories[], zones[], tier, status, package,
  **commissions** (percent/fixed/per_lead/per_sale/subscription/onboarding/promotion/admin_fee),
  **policies** (client_discount, specialist_discount, promotions, campaigns, coupons, bonuses).
  Endpoints: CRUD, `/stats`, `/{id}/commissions`, `/{id}/policies`, `/{id}/create-login`,
  leads GET/POST + PATCH, `/copilot/analyze`, `/{id}/presentation`.
  Colecții: `marketplace_partners`, `marketplace_leads`.
- `routes/strategic_partners.py` (264 linii) — `/api/admin/strategic-partners`:
  `/dashboard` (vedere unificată City+Marketplace: totaluri, revenue, coverage pe oraș,
  cross_ref_unmatched), `/cross-ref/{lead_id}` (AI: city lead → top 3 marketplace partners +
  email intro, Claude), `/opportunities`, `/unmatched-leads`. Colecție: `strategic_cross_refs`.
- `leads_store.py` (145 linii) — colecția unică `leads` (strangler pattern, dual-write idempotent
  pe (source, legacy_id)), triage AI score/segment. Surse: city_partner, marketplace_partner,
  interior_design, franchise, client_junior, specialist_entry, lead_magnet etc.

### Frontend (wired în App.js)
- `/admin/city-partners` → `CityPartnersPage.jsx` (listă, filtre status, stats, form create/edit)
- `/admin/city-partners/:id` → `CityPartnerDetailPage.jsx` (onboarding wizard, leads, create-login)
- `/admin/city-partner-products` → `CityPartnerProductsPage.jsx`
- `/admin/marketplace-partners` → `MarketplacePartnersPage.jsx`
- `/admin/strategic-partners` → `StrategicPartnersDashboard.jsx` (cross-ref modal, coverage, opportunities)
- `/partner/dashboard` → `PartnerDashboard.jsx` (portal city partner: me/stats/leads/nudges)
- `/partner/marketplace` → `MarketplacePartnerPortal.jsx`

### Permisiuni
- `is_super_admin(user)` = role=="admin" && scope=="general" (`sub_admin_deps.py`).
- Portal partener gated pe role=="city_partner" + `partner_id` legat + status != terminated.
- CSRF guard pe toate mutațiile `/api/admin` (Origin + header X-PM-Client) în `server.py`.

### Date reale în DB (iunie 2026)
city_partners=12 · city_partner_leads=11 · marketplace_partners=7 · marketplace_leads=8 ·
city_partner_products=0 · strategic_cross_refs=10 · leads(unificat)=72.
NOTĂ: partenerii legacy NU au câmpurile partner_type/coverage/services/... (adăugate doar la create nou).

## 2. MATRICE EXISTĂ / PARȚIAL / LIPSEȘTE / DEFECT

| # | Capabilitate cerută | Stare | Dovadă / gap |
|---|---|---|---|
| A | Profil partener: status, capacitate (units_managed) | EXISTĂ | city_partners CRUD + UI form |
| B | Profil: categorii/servicii/teritorii/partner_type/coverage | DEFECT | câmpuri în backend, **neexpuse în UI** (PartnerForm nu le are); date legacy fără ele |
| C | Onboarding partener (7 pași, auto-promote active) | EXISTĂ | onboarding-step + wizard |
| D | Cont login partener (role=city_partner) | EXISTĂ | create-login + portal |
| E | Registru acorduri comerciale (categorie/teritoriu/segment/perioadă/exclusivitate) | LIPSEȘTE | nu există entitate „agreement"; doar `territory_protected` bool + commissions/policies pe marketplace partner |
| F | Detectare suprapuneri / conflicte între acorduri | LIPSEȘTE | niciun engine; nici măcar validare teritoriu duplicat |
| G | Atribuire recomandări/cereri către parteneri relevanți | PARȚIAL | AI cross-ref manual (admin, 1 lead→3 marketplace). NU există rutare automată a cererilor reale din Marketplace către parteneri |
| H | Etape comerciale + rezultate | PARȚIAL | stages există (introduced→converted/lost); **lipsă câmp „motiv pierdere"** |
| I | Raport: clienți invitați → conturi activate → cereri → conversii | PARȚIAL | stats au leads/conversii/revenue; **nu există legătură lead → user real activat → cerere reală** (loop deschis) |
| J | Comisioane eligibile (calcul + raport) | PARȚIAL | marketplace are config comisioane; **nu există calcul/raport de comisioane eligibile**; city partners n-au deloc comisioane |
| K | Separare drepturi Admin / partener / user | EXISTĂ | is_super_admin + role gating + CSRF |
| L | Protecție date între parteneri | EXISTĂ | portalul filtrează strict pe partner_id-ul propriu |
| M | Categorie nZEB fără duplicare | LIPSEȘTE | fără taxonomie nZEB; se poate mapa pe partner_type/categories/services |
| N | Dashboard ecosistem unificat (City+Marketplace) | EXISTĂ | strategic-partners/dashboard + coverage |

## 3. FLUX COMERCIAL + RELAȚII ENTITĂȚI (actual)

```
ADMIN ──creează──> city_partner ──onboarding(7)──> active ──create-login──> user(role=city_partner)
  │                     │                                                        │
  │                     └──leads(city_partner_leads)──stage──> converted/lost    └─ portal: /partner/dashboard
  │                                │ dual-write                                      (vede DOAR lead-urile proprii)
  │                                ▼
  │                          leads (unificat) ◄── marketplace_leads ◄── marketplace_partner
  │                                                                          │ commissions/policies
  └── strategic-partners/dashboard (agregat) + cross-ref AI (city lead → marketplace partner)
                                                   │
                                                   ▼ strategic_cross_refs (sugestii + email intro)
```
GAP de închis: lead → **client real pe platformă** → **cerere reală (requests)** → **conversie/comision**.
Azi lead-urile sunt înregistrări manuale; nu se leagă de users/requests reale.

## 4. RISCURI

### Securitate
- R-S1: `create-login` generează parolă temporară cu `verified_email=True` și o întoarce în răspuns
  (o singură dată). OK, dar lipsește forțarea schimbării parolei la prima logare.
- R-S2: cross-ref trimite date partener (companie, oraș, categorii) către LLM extern — doar admin;
  fără PII de client sensibil, dar de documentat în DPA.
- R-S3: fără mecanism de audit „cine a văzut ce lead" (doar demo activity middleware generic).

### Duplicare (CRITIC pentru cerință „fără sisteme paralele")
- R-D1: Există **DEJA două sisteme de parteneri** (city_partners vs marketplace_partners) cu CRUD,
  leads, create-login, stats, copilot proprii. Orice extensie (acorduri/teritorii/comisioane)
  TREBUIE să fie un strat transversal peste ambele, NU al treilea sistem.
- R-D2: Comisioane există doar pe marketplace_partners. A le copia pe city_partners = duplicare.
  Recomandat: entitate `partner_agreements` neutră, referențiind orice partener prin (kind, partner_id).

### Regresie
- R-R1: Adăugarea de validări teritoriu/exclusivitate pe create/patch poate bloca partenerii legacy
  (fără câmpuri). Orice validare = opt-in / non-blocking pentru date vechi.
- R-R2: `leads_store.sync_lead` e fire-safe; schimbarea schemei lead-urilor nu trebuie să rupă dual-write.
- R-R3: Expunerea în UI a câmpurilor partner_type/services nu trebuie să schimbe default-urile existente.

## 5. PLAN MINIMAL DE IMPLEMENTARE (P0/P1/P2)

### P0 — fundație, zero risc, reutilizare maximă (de implementat PRIMUL, la decizie)
- P0-1: Expune în UI (CityPartnersPage form + Detail) câmpurile existente deja în backend:
  partner_type, coverage, region, services[], design_stages[], categories. (DEFECT B → fixat, 0 backend nou)
- P0-2: Adaugă câmp `lost_reason` pe leads (city + marketplace) + în PATCH + în UI. (gap H)
- P0-3: Raport „funnel partener" read-only: invitați(leads) → contactați → convertiți, cu rate,
  derivat din datele existente. (gap I parțial, fără schema nouă)

### P1 — registru acorduri + detectare conflicte (nucleul comercial)
- P1-1: Colecție nouă `partner_agreements` { kind(city|marketplace), partner_id, category,
  territory{city/county/region}, segment, period{from,to}, exclusivity(bool), terms, status } —
  strat transversal, NU sistem paralel. Endpoints sub `/api/admin/strategic-partners/agreements`.
- P1-2: Engine detectare suprapuneri: la create/validate, semnalează conflict dacă există alt acord
  activ cu (category ∩ territory ∩ period) suprapuse și exclusivity=true. Non-blocking: WARN + listă conflicte.
- P1-3: Calcul comisioane eligibile din leads convertite × config comisioane partener → raport read-only.

### P2 — automatizare + nZEB
- P2-1: Rutare semi-automată: cererile reale din Marketplace (`requests`/`leads` open) → sugestie partener
  relevant pe (category, territory), reutilizând logica cross-ref existentă (acum manuală).
- P2-2: Categorie nZEB ca `category`/`service` în taxonomia existentă + filtru dedicat în dashboard;
  FĂRĂ colecție nouă. Un acord nZEB = `partner_agreements` cu category="nZEB".
- P2-3: Loop închis invitat→cont activat: leagă lead.email de users.email la signup (match pasiv),
  marchează „cont activat" în raport. Fără migrare forțată.

## 6. TESTE + CRITERII DE ACCEPTANȚĂ (de rulat DUPĂ aprobarea implementării)
- P0-1: create/patch partener cu services/partner_type → persistă și se reafișează; partenerii legacy rămân valizi.
- P0-2: PATCH lead stage=lost fără motiv → acceptat; cu motiv → salvat și afișat.
- P1-1/2: două acorduri exclusive, aceeași categorie+teritoriu+perioadă → al doilea semnalează CONFLICT;
  perioade disjuncte → fără conflict; teritorii diferite → fără conflict.
- P1-3: 1 lead convertit cu revenue + comision percent=10% → raport afișează comision eligibil corect.
- K/L (regresie): partener logat vede DOAR lead-urile proprii; non-super primește 403 pe /api/admin/*.

## 7. RECOMANDARE EXPLICITĂ
- IMPLEMENTEAZĂ ACUM (risc minim, valoare imediată, fără schema nouă): **P0-1, P0-2, P0-3**.
- URMĂTOR (nucleul comercial, necesită colecție nouă neutrală): **P1** — construit ca strat
  transversal `partner_agreements`, reutilizând city + marketplace, NU un al treilea sistem.
- AMÂNĂ până la decizie de business: **P2** (automatizare rutare, nZEB, loop invitat→cont) —
  necesită reguli comerciale clare și consimțământ pentru partajare date către parteneri.
- NU activa exclusivități reale și NU transmite date către parteneri până la decizia explicită.
