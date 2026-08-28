# PropManage — CHANGELOG (Knowledge Sync · Digital Twin)

Rol: jurnal cronologic al schimbărilor semnificative + sincronizărilor de cunoștințe. Documentele canonice (sursa de adevăr) rămân: `audits/PROPERTY_TWIN_CANONICAL_v1.0.md` (Digital Twin) și `audits/MASTER_PLATFORM_STATE.md` (stare platformă). Separă mereu: LIVE/DEPLOYED · PREVIEW/BUILT · PLANNED/NEXT · IDEA/FUTURE.

---

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
