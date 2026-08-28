# PropManage — CHANGELOG (Knowledge Sync · Digital Twin)

Rol: jurnal cronologic al schimbărilor semnificative + sincronizărilor de cunoștințe. Documentele canonice (sursa de adevăr) rămân: `audits/PROPERTY_TWIN_CANONICAL_v1.0.md` (Digital Twin) și `audits/MASTER_PLATFORM_STATE.md` (stare platformă). Separă mereu: LIVE/DEPLOYED · PREVIEW/BUILT · PLANNED/NEXT · IDEA/FUTURE.

---

## 2026-06 · OPERATIONAL AUTONOMY LOOP (FN-021) — bucla închisă Analytics→Acțiune (PREVIEW, necesită redeploy)
- Construită veriga LIPSĂ a autonomiei: **Analytics → Finding → Decizie(policy risc) → Acțiune → Verify → Learn**. Zero sisteme paralele: findings=`admin_ai_findings`, task-uri=`admin_todos`, aprobări=`admin_approvals`, singura colecție nouă=`autonomy_loop_runs` (ledger). Modul `backend/autonomy/loop.py` + endpoints `/api/admin/autonomy/loop/{run,runs,policy}` + panou UI în `/admin/autonomy` (`OperationalLoopPanel.jsx`) + job scheduler la 3h.
- Detectoare DETERMINISTE peste Analytics existent + funnel comercial: `high_bounce_page` (SAFE→auto todo) și `request_flow_abandonment` (MEDIUM→aprobare umană). Politică risc: SAFE/REVERSIBLE→auto-execuție; MEDIUM/HIGH→gate uman obligatoriu (admin_approvals). Idempotent, bounded, safe-on-rerun.
- E2E controlat PASS (`tests/test_autonomy_loop_e2e.py`): SAFE→todo+finding resolved, MEDIUM→approval+finding open, aprobare umană→remediere, idempotență (fără duplicate la re-run), LEARN (auto-resolve când semnalul dispare). UI 100% (iter214). Function Map: **FN-021 adăugat (VERIFIED)** + **FN-002 PARTIAL→VERIFIED** (dovada = E2E loop, exact „next action" de la FN-002).


## 2026-06 · COMMERCIAL FLOW — Funnel comercial instrumentat + vizibil (PREVIEW, necesită redeploy)
- Instrumentat fluxul comercial REAL existent (VISITOR→CLIENT→PROPRIETATE→CERERE→SPECIALIST→CONTINUARE) cu 7 evenimente, prin trackerul first-party EXISTENT (`analytics.js` `trackIntent` → `POST /api/track`, flag `intent_{signal}` pe `analytics_sessions`). ZERO sistem nou de analytics. Evenimente: `client_flow_opened`, `client_property_selected`, `request_started` (exista), `request_created`, `specialist_flow_opened`, `specialist_action_taken`, `flow_completed`.
- Backend NOU (read-only): `GET /api/admin/analytics/commercial-funnel` (analytics_growth.py) — agregă etapele per vizitator unic + verificare ÎNCRUCIȘATĂ cu `db.requests` real (SSOT): `requests_created_real`, `requests_confirmed_real`, `created_delta`. Răspunde direct la „din cei care intră pe /client, câți încep și câți creează o cerere reală".
- Frontend: tab NOU „Funnel comercial" în `AnalyticsGrowthPage.jsx` (KPI + bar chart 7 etape + card cross-check db.requests). Instrumentare în `ClientDashboardV2.jsx`, `RequestWizard.jsx`, `SpecialistDashboard.jsx`.
- Verificat E2E (iter213, 100% frontend): client creează cerere reală (POST /api/requests → db.requests) → specialist vede/acceptă (POST /accept) → funnel admin reflectă activitatea; cross-check real=1/semnal=1/diff=0. Zero regresii Client/Specialist Beta. NU s-a atins Orphan Twins / entitlements / abonament 9€ / Digital Twin CTA.


## 2026-06 · DATA INTEGRITY — Safe repair pentru Twins orfane (PREVIEW, necesită redeploy)
- Extins scannerul read-only `admin_data_integrity.py` cu remediere sigură pentru „Twins orfane": `GET /api/admin/data-integrity/orphan-twins` (listă+clasificare) și `POST .../orphan-twins/resolve` (arhivează în `twins_orphan_archive` + șterge din `db.twins` + audit în `data_integrity_actions` + re-scan). Re-atașarea deterministă e imposibilă (twins fără `owner_id`/legătură) → acțiune sigură = DELETE arhivat (recuperabil). UI: buton „Șterge toate Twin-urile orfane" + confirmare cu mesaj de protecție în `DataIntegrityCard.jsx`.
- Verificat E2E: 28 orfane reale → arhivate+șterse, orphan=0; protecție confirmată (properties/users/requests/disputes/transactions neatinse); audit 28 SUCCESS; idempotent; confirm=false→400; UI E2E 100% (iter212). Reality Check (read-only) livrat separat.

## 2026-06 · KNOWLEDGE SYNC — Digital Twin Next Stage I/II/III consolidat în docs canonice

**Ce a fost actualizat**
- `audits/PROPERTY_TWIN_CANONICAL_v1.0.md` → adăugat §9 (Next Stage I/II/III delivered in preview): inventar 18 funcționalități, reguli de integritate, decizia City Partner Products, fluxul strategic, known issue `.skp`/Trimble, stare testare, next roadmap, conflict marcat.
- `audits/MASTER_PLATFORM_STATE.md` → secțiunea Property Twin extinsă cu rezumatul Next Stage I/II/III (PREVIEW) + known issue `.skp` + next roadmap; păstrată distincția P0/P1/P0.1 = PRODUCTION-LIVE.
- `INDEX.md` → intrarea canonică Property Twin actualizată; referință CHANGELOG + BUGS #005.
- `BUGS.md` → adăugat BUG #005 (`.skp` nu e vizualizabil 3D; validare URL Trimble Connect).
- `CHANGELOG.md` → creat (acest fișier).
- `PRD.md` → deja conținea secțiunile Next Stage II/III (actualizat la build).

**Funcționalități LIVRATE (BUILT & DELIVERED IN PREVIEW — necesită redeploy Fondator; NU LIVE)**
- Stage I: upload 3D multi-format · AI-3D `inferred` · Q&A grounded · ancorare istorică (zero auto-assign) · mobile.
- Stage II: AI Design Concepts · validare profesională (`inferred→în validare→verified`) · Q&A suggestions · ancorare în masă (același owner) · `ViewerErrorBoundary` · Comparație concepte · Ofertă din concept `verified` (`db.requests`) · Notificare validare (in-app+email) · Materiale reale + preț orientativ. Teste iter207(95%)→iter208(100%).
- Stage III: Catalog Materiale admin (`/admin/city-partner-products`, gol implicit) · Alegere câștigătoare (single-winner server-side) · Concept în Pașaport (opt-in OFF, doar `verified`, OFF→404) · Ofertă cu Poze (render atașat cererii). Teste iter209(F1/2/3=100%)+iter210(F4=100%). Regresie intactă. Date de test curățate.

**PRODUCTION-LIVE (neschimbat)**: P0/P1/P0.1 Property Anchor (22/22 live pe `propmanage.ro`, 28 Aug 2026).

**Decizii de business făcute canonice**
- AI `inferred` ≠ `verified`; doar profesionistul validează; AI nu setează `verified` automat.
- ZERO produse/prețuri/specialiști/oferte inventate; fără date reale → „preț orientativ indisponibil".
- ZERO auto-assignment; o proprietate = un owner; ancorare în masă doar între proiectele aceluiași owner.
- Ofertă din concept doar pentru `verified`; acțiunile reale cer confirmare explicită.
- Publicare concept în Pașaport = opt-in (implicit OFF), doar `verified`.
- City Partner Products: catalog super-admin, produse reale, poate fi gol; rezolvare preț: partener → piață → „indisponibil".

**Known issues**
- `.skp` NU e vizualizabil 3D (upload OK, doar descărcabil); Trimble Connect cere URL valid (link Google Drive respins corect). NU marca `.skp` „fully supported". → BUG #005.

**Next roadmap (NU implementat)**: Import CSV/Excel catalog · Materiale structurate în ofertă · Insignă „Amenajare planificată" Pașaport · Comparație partajabilă · (nuanță) ofertă zero-tap.

**Conflict marcat pentru Fondator**: lista de „next action items neimplementate" din directivă includea itemi deja livrați (comparație-câștigător, concept-în-pașaport, notificare validare, materiale parteneri, parțial ofertă-un-tap). Consemnat starea reală pe baza codului; de confirmat reducerea listei de roadmap.
