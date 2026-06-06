# PropManage — Manual de Operare Strategie & R&D

> **Pentru tine, fondatorul.** Acest manual îți arată EXACT cum să coordonezi platforma 100% din Admin Dashboard, fără să scrii cod și fără să strici nimic.
> Dacă termenii sunt confuzi, urmează doar pașii literali în ordinea în care apar. Fiecare modul are: **ce face**, **când îl folosești**, **pași concreți**, **ce afectează dacă greșești**, **cum repari**.

---

## 📌 Cuprins rapid

1. [Principii de siguranță (CITEȘTE PRIMUL)](#1-principii)
2. [Smart Pipeline — fluxul pentru orice idee nouă](#2-pipeline)
3. [AI Governance Center — observabilitatea ecosistemului AI](#3-governance)
4. [Architecture Review Board — anti-redundanță](#4-arch)
5. [AI Product Manager — idee → Epic/Features/Stories](#5-aipm)
6. [Deprecation Pulse — alarme retragere agenți](#6-pulse)
7. [Bug Memory Aggregator — vizibilitate findings](#7-bugmem)
8. [Autonomy Engine — recomandări automate (cum activezi zona DEV)](#8-autonomy)
9. [Founder Approval Gate — gardian acțiuni critice](#9-foundergate)
10. [Future Ideas Vault — backlog strategic](#10-futureideas)
11. [Stagii Progressive Disclosure (Junior → Verified → Pro)](#11-stages)
12. [Roadmap: ce mai e de făcut per modul](#12-roadmap)
13. [Cheat-sheet: scenarii frecvente](#13-cheatsheet)

---

<a id="1-principii"></a>
## 1. 🛡️ Principii de siguranță (CITEȘTE PRIMUL)

### Regula de aur
> **Nimic nu se șterge real fără confirmare.** Toate operațiunile distructive sunt fie soft-deletes (poți reveni), fie protejate de snapshots automate, fie blocate de Founder Gate.

### Cele 4 plase de siguranță

| Plasa | Ce face | Unde o găsești |
|-------|---------|----------------|
| **Settings Snapshots** | Salvează zilnic toate setările + restaurare cu 1 click | `/admin/snapshots` |
| **Founder Gate (FG-0)** | Definește 13 acțiuni critice care necesită confirmare în viitor | `/admin/founder-gate` |
| **Deprecation Plan** | Marchezi agenții ca depreciați fără să-i ștergi cod | `/admin/ai-governance` → tab Deprecation Plan |
| **Architecture Board** | Verifici dacă o idee se suprapune cu module existente | `/admin/architecture-board` |

### Reguli obligatorii înainte de orice schimbare majoră
1. **Verifică Settings Snapshots** — există unul în ultimele 24h? Dacă nu, forțează unul: `/admin/snapshots` → "Crează snapshot acum"
2. **Rulează Architecture Board** — orice idee mai mare de 1h de dezvoltare trebuie să treacă prin verdict
3. **Folosește `dry_run`** când e disponibil — vezi rezultatul fără să-l aplici
4. **Nu schimba `enable_founder_gate` în `true`** până nu activezi FG-1 (Twilio) — momentan e DEFERRED

### Cum repari dacă ai greșit ceva
- **Ai schimbat setări greșite** → `/admin/snapshots` → restore din ultimul snapshot bun
- **Un agent face spam** → marchează-l deprecated în Governance (nu-l șterge)
- **Un TODO greșit** → șterge-l din `/admin/todo` (nu afectează codul)
- **Un breakdown AI PM greșit** → șterge-l din `/admin/ai-pm` (nu afectează nimic altceva)
- **Un review Architecture greșit** → șterge-l din `/admin/architecture-board` (read-only, n-a generat cod)

---

<a id="2-pipeline"></a>
## 2. 🔀 Smart Pipeline — fluxul ÎN ORDINE pentru orice idee nouă

**Aceasta este "rețeta" pe care trebuie să o respecți de fiecare dată.**

```
   IDEEA TA
      ↓
  [1] Architecture Review Board   ← Verifică dacă există deja
      ↓ verdict ≠ reject_duplicate
  [2] Future Ideas Vault          ← Documentează ca propunere
      ↓ aprobat de tine
  [3] AI Product Manager          ← Descompune în Epic > Features > Stories
      ↓
  [4] Inject TODOs                ← Buton din AI PM
      ↓
  [5] Trimite agentului Emergent  ← (mie sau în chat) cu refință la TODO
      ↓
  [6] Verifică în preview         ← Tu testezi
      ↓
  [7] Deploy în producție         ← Butonul "Deploy" din Emergent
```

### Exemplu concret pas-cu-pas

> Vrei să adaugi: "Sistem de fidelizare clienți cu puncte și recompense"

**PAS 1** — Architecture Board
- Mergi la `/admin/architecture-board`
- Titlu: `Sistem fidelizare clienți`
- Descriere: `Clienții acumulează puncte la fiecare comandă completată, le pot folosi pentru reduceri la viitoarele cereri.`
- Scope: `1 backend route + 1 secțiune nouă în /client/dashboard`
- Apasă "Verifică suprapuneri"
- **Ce primești**: verdict `build_new` sau `extend_existing` (dacă marketplace_requests are deja sistem de tracking)
- **Decizie**: dacă `reject_duplicate` → oprește. Dacă `extend_existing` → notează care modul extinzi. Dacă `build_new` → continuă.

**PAS 2** — Future Ideas Vault (opțional pentru idei mici)
- Pentru idei mari (>3 zile dev) documentezi în `/admin/future-ideas`
- Pentru idei mici, sari peste

**PAS 3** — AI Product Manager
- Mergi la `/admin/ai-pm`
- Titlu + descriere identice cu PAS 1
- Context (opțional): `Avem 200 clienți activi, conversion baseline 12%, vrem fidelizare ca să crească RFM.`
- Apasă "Descompune ideea"
- **Ce primești**: Epic + 3 features prioritizate (P0/P1/P2/P3) + max 2 stories per feature + riscuri + out-of-scope

**PAS 4** — Injectează în TODO
- În același ecran, după ce vezi rezultatul, apasă "Injectează în TODO"
- **Ce se întâmplă**: features-urile devin task-uri în `/admin/todo` cu source `ai_pm:<id>`
- **Implicații**: TODO-urile sunt vizibile când îi ceri agentului Emergent să construiască — îi dai referința "construiește TODO-urile cu source ai_pm:XYZ"

**PAS 5** — Cere implementare
- În chat-ul Emergent: `Implementează TODO-urile cu source ai_pm:XYZ din /admin/todo. Folosește breakdown-ul existent.`
- Agentul (eu) îți va răspunde cu plan + îți cere confirmări dacă e nevoie

**PAS 6** — Testează în preview
- Verifică funcționalitatea în preview (URL-ul `*.preview.emergentagent.com`)
- Dacă ceva nu merge, raportează: "Pe preview, când fac X, văd Y"

**PAS 7** — Deploy
- Doar dacă e ok în preview, apasă butonul "Deploy" din interfața Emergent
- Schimbările ajung pe `https://propmanage.ro`

### Ce afectezi dacă SARI peste pași?
- **Sari peste Architecture Board** → risc construiești ceva deja existent (duplicat de cod, mai greu de întreținut)
- **Sari peste AI PM** → agentul Emergent nu are scope clar, întreabă mai mult sau face presupuneri
- **Sari peste preview test** → bug ajunge direct în producție pe propmanage.ro, clienții reali îl văd
- **Sari peste TODO injection** → agentul nu are istoric, contextul se pierde între sesiuni

---

<a id="3-governance"></a>
## 3. 🛡️ AI Governance Center (`/admin/ai-governance`)

### Ce face
Centru de observabilitate pentru toți cei 20+ agenți AI ai platformei. Vezi cine face ce, când, cât costă, și cine e sănătos.

### Cele 7 tab-uri și cum le folosești

#### Tab 1: **Agenți**
- Listă completă agenți grupați pe categorie
- Pe fiecare card vezi: nume, slug, lifecycle (active/legacy/deprecated/experimental), permission_level, activitate 24h/7d
- **Buton "Marchează ca depreciat"** pe fiecare → modal cu reason + replacement + target_retirement_date
- **Implicații marcare depreciat**: NU oprește agentul, doar îl etichetează ca "în retragere". Apare în Deprecation Plan + Pulse.

#### Tab 2: **Health** (NOU)
- 5 KPI: Overall, Healthy, Degraded, Silent, Deprecated
- Listă sortată: degraded/silent/error/healthy/deprecated
- Status derivat din activitate (zero activity 7d = silent; 7d active dar 24h zero = degraded)
- **Când acționezi**: dacă vezi un agent "silent" timp îndelungat → consideră deprecation

#### Tab 3: **Permissions** (NOU)
- Matrice 5 niveluri risc: read (0) → suggest (1) → execute-with-approval (2) → execute (3) → autonomous (4)
- **Risk hotspots**: agenți activi cu permisiuni înalte (execute/autonomous) — auditează lunar
- **Când acționezi**: orice nou agent cu permission `execute` sau `autonomous` trebuie să apară aici cu hotspot și să-l revizuiești

#### Tab 4: **Costuri**
- Estimare lunară EUR per agent (best-effort, bazat pe calls/săptămână + cost mediu per call)
- **Implicații**: dacă vezi costuri mari pe un agent legacy → candidat la deprecation
- Suma reală e în Profile → Universal Key → Billing

#### Tab 5: **Audit Trail**
- Eveniment unificat pe ultimele 50 acțiuni (chat sessions, dev team analyses, security alerts, etc.)
- **Când folosești**: pentru investigații post-incident

#### Tab 6: **Deprecation Plan**
- Timeline retragere agenți depreciati + impact snapshot (data sources, provider, activitate la decizie)
- Candidați propuși (legacy ne-tratați)
- Istoric restaurări
- **Buton "Restaurează"** pe fiecare deprecation → readuce agentul la lifecycle original

#### Tab 7: **Deprecation Pulse** (NOU)
- Schedule email săptămânal joi 09:30 cu 3 alerte: retrageri viitoare, overlap colecții, provider risk
- **CONFIGURARE OBLIGATORIE LA START**:
  1. Adaugă email-urile destinatare (al tău + backup): `founder@propmanage.ro, backup@gmail.com`
  2. Setează fereastra alertă: `30 zile` (default)
  3. Apasă "Activ"
  4. Apasă "Salvează config"
  5. (Opțional) Apasă "Trimite acum" — vezi cum arată

### Ce afectezi dacă greșești în Governance
- Marchezi greșit deprecated un agent → nimic critic, doar îl restaurezi din tab Deprecation Plan
- Activezi Pulse cu email greșit → primesc destinatarii greșiți emails. Editezi configul.
- **Nu există ștergere reală** în Governance — totul e overlay non-distructiv

---

<a id="4-arch"></a>
## 4. 🧭 Architecture Review Board (`/admin/architecture-board`)

### Ce face
Verifică dacă o idee se suprapune cu cele ~36 module existente. AI (Claude Haiku) îți dă verdict + sugestii.

### Cele 4 verdicts și ce să faci

| Verdict | Înseamnă | Acțiunea ta |
|---------|----------|-------------|
| `build_new` | Idee nouă, fără suprapunere semnificativă | Continuă spre AI PM |
| `extend_existing` | >50% overlap, ar trebui să extinzi modul existent | Cere agentului să EXTINDĂ acel modul, nu să creeze unul nou |
| `merge_proposal` | Suprapunere moderată, ar trebui să comasezi cu propunerea X | Documentează ca merge în Future Ideas |
| `reject_duplicate` | 95%+ overlap, este duplicat | NU construi. Folosește modulul existent. |

### Pași concreți
1. Mergi la `/admin/architecture-board`
2. Completează titlu (3-200 caractere), descriere (10-4000), scope (opțional)
3. Apasă "Verifică suprapuneri" (durează ~6-10s)
4. Citește: verdict, overlap_score, overlapping_modules, suggested_actions, rationale
5. **Decide**:
   - Dacă verdict îți place → continuă pipeline
   - Dacă nu ești de acord cu AI → revizuiește descrierea și reîncearcă

### Ce afectezi dacă greșești
- Trimiți review cu descriere proastă → AI dă verdict prost → tu construiești greșit. **Soluție**: refă review-ul cu descriere mai bună, șterge-l pe cel vechi.
- Reviews-uri NU triggerează cod. Sunt 100% diagnostic.

---

<a id="5-aipm"></a>
## 5. 🎯 AI Product Manager (`/admin/ai-pm`)

### Ce face
Transformă o idee într-o ierarhie clară: **Epic → Features → User Stories → Acceptance Criteria**.

### Pași concreți
1. Mergi la `/admin/ai-pm`
2. Titlu + descriere (obligatorii) + context business (opțional, dar îmbunătățește calitatea)
3. Apasă "Descompune ideea" (durează ~15-20s)
4. **Ce primești**:
   - **Epic**: titlu + goal + success_metric
   - **Features** (max 3): cu prioritate (P0/P1/P2/P3) + effort în zile + max 2 stories
   - **Stories**: format "Ca [user], vreau [X], ca să [Y]" + acceptance criteria + technical notes
   - **Riscuri** (max 3): titlu + mitigare + severitate
   - **Out of scope**: ce NU intră în versiunea curentă

### Cum injectezi în lucru
- După breakdown, apasă **"Injectează în TODO"**
- Toate features-urile devin task-uri în `/admin/todo` cu source `ai_pm:<id>`
- **Implicații**: agentul Emergent îi va vedea când îi ceri să construiască — îi dai context complet fără să fii nevoit să-l rescrii

### Ce afectezi dacă greșești
- Breakdown greșit → șterge-l, refă-l. NU se generează cod automat.
- Injectezi TODO-uri pe care nu le mai vrei → șterge-le din `/admin/todo`

---

<a id="6-pulse"></a>
## 6. 🔔 Deprecation Pulse (`/admin/ai-governance` → tab Deprecation Pulse)

### Ce face
Email săptămânal joi 09:30 (Europe/Bucharest) cu 3 alerte:
1. **Retrageri viitoare**: agenți deprecati cu target_retirement_date < 30 zile
2. **Overlap colecții**: agenți activi care folosesc data_sources marcate pentru retragere
3. **Provider risk**: agenți pe provideri flag-uiți (gpt_4o, claude_haiku — sunset risk)

### Configurare obligatorie (5 minute, o singură dată)
1. Tab "Deprecation Pulse"
2. Recipient: `founder@propmanage.ro` (sau email-ul tău principal)
3. Fereastră alertă: `30` (default)
4. Click "Activ" (toggle)
5. Click "Salvează config"
6. Click "Trimite acum" → verifică inbox

### Ce afectezi dacă greșești
- Email greșit → schimbi destinatarii și reactivezi
- Cantitate mare emails → mărește fereastra (>30 zile) sau dezactivează temporar

---

<a id="7-bugmem"></a>
## 7. 🐛 Bug Memory Aggregator (`/admin/bug-memory`)

### Ce face
Vedere unificată a TUTUROR findings de bugs din platformă:
- **QA Copilot findings** (din sesiuni manuale)
- **AI Investigator findings** (din analize automate)

### Când folosești
- Înainte de a începe un feature nou: caută bug-uri legate de același modul
- După un incident: caută cuvinte cheie din eroare ("timeout", "401", "undefined")
- Săptămânal: scan rapid Top 20 P0/P1

### Pași concreți
1. Mergi la `/admin/bug-memory`
2. Vezi stats: QA findings + AI findings + total
3. Filtre: severity (P0/P1/P2/P3), source (qa_copilot/ai_investigator)
4. Search box: caută text (>= 2 caractere)

### Ce afectezi
- 0% impact — read-only. Acțiunile pe findings rămân în modulele originale.

---

<a id="8-autonomy"></a>
## 8. 🤖 Autonomy Engine (`/admin/autonomy`)

### Ce face
Calculează zilnic scoruri de "autonomie" platformă pe 5 zone:

| Zonă | Greutate default | Ce măsoară |
|------|------------------|------------|
| **operational** | 30% | Auto-match, completed requests, scheduler health, incidente deschise |
| **technical** | 25% | Smoke tests pass rate, snapshot freshness |
| **security** | 20% | Threat scores, audit gaps |
| **dev** | 10% | Activitate AI Dev Team, QA Copilot, code coverage |
| **ai** | 15% | Cost AI per session, AI investigations resolved |

### Cum activezi zona "DEV" mai puternic
**Zona DEV este DEJA activă** (10% din scor general). Dacă vrei să o crești în prioritate:

1. Mergi la `/admin/autonomy` (sau direct: API config endpoint)
2. Caută secțiunea "Greutăți & Țintă" (dacă există UI) sau folosește endpoint:
   ```
   PUT /api/admin/autonomy/targets
   { "weights": { "operational": 0.25, "technical": 0.20, "security": 0.20, "dev": 0.25, "ai": 0.10 } }
   ```
3. **Implicații**: dev score va influența mai mult general score → recomandările dev vor apărea mai sus

### Cum materializezi recomandări ca TODO-uri
1. Pe pagina `/admin/autonomy`, în secțiunea "Recomandări prioritizate"
2. Apasă **"Materializează ca TODO-uri →"**
3. Apare modal de confirmare
4. Sunt create max 6 TODO-uri (cu dedupe — nu se duplică dacă există deja)
5. Le vezi în `/admin/todo` cu source `autonomy_v2:<area>`

### Ce afectezi dacă greșești greutățile
- Greutăți însumează 1.0 ideal, dar engine-ul nu va crăpa dacă nu
- Nu se șterge nimic real — doar prioritizarea recomandărilor se schimbă
- **Repair**: pune greutățile înapoi la default (30/25/20/10/15)

---

<a id="9-foundergate"></a>
## 9. 🚪 Founder Approval Gate (`/admin/founder-gate`)

### Ce face
Registry hardcoded cu 13 acțiuni critice care, în viitor, vor necesita aprobare dublă (email + SMS).

**Status actual**: `enable_founder_gate = false` (foundation only). FG-1 Twilio SMS este **DEFERRED** până validăm beta-ul.

### Acțiuni înregistrate (read-only deocamdată)
- Change Stripe destination account
- Bulk delete users / properties / requests
- Disable critical schedulers
- Change founder contact emails
- Promote agent to "autonomous" permission
- ... (vezi lista completă în `/admin/founder-gate`)

### Ce nu trebuie să faci
- ❌ NU activa `enable_founder_gate = true` până nu integrăm Twilio. Altfel acțiunile critice vor fi blocate fără mecanism de aprobare.

### Când vom activa FG-1
- După testare beta cu primii 10 clienți reali
- După ce decizi să integrăm Twilio (cont, număr RO, ~2-5€/lună)

---

<a id="10-futureideas"></a>
## 10. 💡 Future Ideas Vault (`/admin/future-ideas`)

### Ce face
Backlog strategic cu propuneri R&D. Fiecare propunere are: descriere, complexitate, risc, ROI estimat, decision log.

### Cum o folosești
1. Pentru idei MARI (>3 zile dev) → documentează aici ÎNTÂI
2. Pentru idei mici → sari direct la AI PM
3. Apasă "Aprobă" sau "Respinge" pe fiecare propunere → se salvează în decision_log

### Email săptămânal
- Lunea 09:15 primești digest cu propunerile noi/modificate

---

<a id="11-stages"></a>
## 11. 🎓 Stagii Progressive Disclosure (Junior → Verified → Pro)

### Conceptul tău
Vrei interfețe simple la început, apoi treptat să apară funcții noi pe măsură ce user-ul (client/specialist/operator) se familiarizează.

### Cum se implementează corect (recomandare)

**Schema sugerată** — adăugăm în user document un câmp `experience_tier`:

```
experience_tier: "junior" | "regular" | "verified" | "pro"
```

**Triggers automate de promovare** (cron job zilnic):
| Tier | Criteriu promovare automată |
|------|-----------------------------|
| junior → regular | 7 zile activ + 3 cereri/oferte completate |
| regular → verified | 30 zile activ + 10 cereri completate + rating >= 4.5 |
| verified → pro | 90 zile + 30 cereri completate + email verificat + KYC complet |

**Cum afectează UI**:
```javascript
// Exemplu — în ClientDashboard.jsx
{user.experience_tier === "junior" && <SimpleQuickActions />}
{["regular", "verified", "pro"].includes(user.experience_tier) && <AdvancedFilters />}
{user.experience_tier === "pro" && <BulkOperations />}
```

### Pași concreți pentru a-l implementa
1. **Mergi la Architecture Board** → submit titlu "Progressive Disclosure / Experience Tiers" → vezi verdictul
2. **Dacă build_new** → mergi la AI PM → descompune ideea
3. **Injectează TODO-urile** → cere-mi (în chat) să construiesc
4. **Eu construiesc**:
   - Câmp `experience_tier` în User model
   - Cron job zilnic care promovează automat
   - Endpoint admin pentru override manual (`/api/admin/users/{id}/promote-tier`)
   - UI feature flags în dashboards (Client + Specialist + Operator)
5. **Test în preview**: creez 4 conturi cu tier-uri diferite și verifici că UI-ul se schimbă
6. **Rollback safety**: dacă strică ceva, schimbi back tier-ul în "junior" → UI revine simplu

### Ce afectezi în RĂU dacă greșești
- Configurezi criteriile prea strict → niciun user nu promovează → UI simplu permanent (nu e dramatic)
- Configurezi prea relaxat → toți devin "pro" repede → UI complex pentru începători (frustration)
- **Soluție**: criterii ajustabile dintr-un settings page admin

---

<a id="12-roadmap"></a>
## 12. 🗺️ Ce mai e de făcut per modul (Roadmap detaliat)

### AI Governance Center — completitudine 75%
**Ce funcționează**:
- ✅ Agent registry (20 agenți indexați)
- ✅ Cost tracking (estimare)
- ✅ Audit trail unificat
- ✅ Health monitoring (NOU)
- ✅ Permissions matrix (NOU)
- ✅ Deprecation plan + Pulse (NOU)

**Ce MAI e de făcut**:
- 🟠 **Token-level cost tracking** — momentan estimăm prin calls × cost mediu. Pentru exact, ar trebui logged tokens per call.
- 🟠 **Real-time alerting** — momentan polling. Ideal websocket pentru alarme instant când un agent devine `error`.
- 🟢 **Performance benchmarks per agent** — timpi de răspuns 95th percentile, error rates.
- 🟢 **Cost forecasting** — predicție următoarea lună bazat pe trend.

### Founder Approval Gate — completitudine 25% (intentat, FG-1 DEFERRED)
**Ce funcționează**: FG-0 (foundation, registry 13 acțiuni)

**Ce MAI e de făcut**:
- ⏸️ **FG-1: Twilio SMS integration** — DEFERRED (după beta validation)
- ⏸️ **FG-2: TOTP fallback** (Google Authenticator) — DEFERRED
- ⏸️ **FG-3: Enforcement layer** — middleware care interceptează acțiunile critice și cere aprobare
- ⏸️ **FG-4: Audit log per acțiune protejată** — cine a aprobat, când, IP

### Architecture Review Board — completitudine 80%
**Ce funcționează**: catalog 36 module, AI overlap detection, verdict + suggested actions

**Ce MAI e de făcut**:
- 🟢 **Auto-update catalog** — momentan static în cod. Ideal scan auto al modulelor backend + admin pages.
- 🟢 **Link review → AI PM** — buton "Continuă în AI PM" direct din review result
- 🟢 **Export decision history** — PDF cu toate review-urile pentru audit

### AI Product Manager — completitudine 70%
**Ce funcționează**: breakdown Epic > Features > Stories + inject TODOs

**Ce MAI e de făcut**:
- 🟠 **Refinement mode** — buton "Refine" care ia un breakdown existent și-l rafinează cu feedback adițional
- 🟠 **Estimation re-calibration** — comparare effort estimat vs real (după ce TODOs sunt done)
- 🟢 **Multi-language** — momentan doar română, pentru clienți EN
- 🟢 **Templates per categorie** — preset-uri pentru "feature marketplace", "feature UX", etc.

### Bug Memory Aggregator — completitudine 90%
**Ce funcționează**: stats, search, filtre, unified feed

**Ce MAI e de făcut**:
- 🟢 **Auto-cluster bugs** — gruparea findings similare cu embeddings
- 🟢 **Resolved status sync** — când rezolvi un bug în QA Copilot, să se reflecte automat aici

### Autonomy Engine — completitudine 65% (acum cu V2 task generation)
**Ce funcționează**: 5 zone scoring, recomandări, snapshots zilnice, V2 task gen

**Ce MAI e de făcut**:
- 🟠 **Auto-execution mode** — pentru recomandări `low risk + high impact`, execute automat (cu Founder Gate)
- 🟢 **Custom KPI builder** — definești propriile signals dincolo de cele 5 zone default
- 🟢 **Tier promotion automation** — promovare auto user-tier (vezi cap 11)

### Smart Pipeline (idea → arch → pm → todos) — completitudine 30%
**Ce mai e de făcut**:
- 🟠 **Buton "Smart Pipeline"** unic care face toți 4 pașii dintr-un click
- 🟠 **Status tracking per idee** — vezi unde e fiecare idee în pipeline (arch_done / pm_done / todos_injected / built / deployed)
- 🟢 **Pipeline analytics** — câte idei aprobate vs respinse, timp mediu de la submit la deploy

---

<a id="13-cheatsheet"></a>
## 13. 🎯 Cheat-sheet: scenarii frecvente

### Scenariu 1: "Vreau să adaug o funcție nouă"
1. `/admin/architecture-board` → verifică suprapuneri
2. Dacă verdict ok → `/admin/ai-pm` → descompune
3. Inject TODOs → cere agentului să construiască
4. Test preview → deploy

### Scenariu 2: "Un agent face spam / nu mai funcționează"
1. `/admin/ai-governance` → tab Health → verifică status
2. Dacă "silent" sau "degraded" îndelung → tab Agenți → "Marchează ca depreciat"
3. Setezi target_retirement_date și replacement
4. NU se șterge cod, doar etichetare. Apare în Pulse-ul săptămânal.

### Scenariu 3: "Vreau să șterg date vechi în siguranță"
1. **NU șterge direct.** În schimb:
2. `/admin/snapshots` → "Crează snapshot acum" (ca plasă de siguranță)
3. Cere-mi (în chat): `Vreau să șterg cererile mai vechi de 1 an care sunt 'cancelled'. Fă-o cu dry_run primul.`
4. Eu îți arăt CE s-ar șterge (fără să-l fac)
5. Tu confirmi → execut

### Scenariu 4: "Pagina X nu mai merge în producție"
1. Verifică în PREVIEW dacă bug-ul există acolo
2. Dacă în preview merge → e problemă de deploy → contactează Emergent Support
3. Dacă în preview NU merge → spune-mi `Pe preview, când fac X, văd Y. Iată screenshot.`
4. Eu reproduc + fix + tu testezi în preview + redeploy

### Scenariu 5: "Vreau să rollback la o versiune anterioară"
1. **NU folosi git reset** (perde munca curentă)
2. În Emergent platform, folosește **butonul "Rollback"** (gratis, fără credite)
3. Selectezi checkpoint-ul anterior bun
4. Toată platforma revine la acel moment

### Scenariu 6: "Costul AI a crescut suspect"
1. `/admin/ai-governance` → tab Costuri
2. Sortează după "estimated_monthly_eur"
3. Top 3 agenți → verifică în tab Audit Trail dacă rulează prea des
4. Dacă unul e legacy + cost mare → marchează deprecated

### Scenariu 7: "Vreau să dau acces unui nou admin"
1. Creezi user-ul cu role `admin`
2. Cere-mi: `Adaugă admin@nume.com ca admin secundar. Vreau să poată vedea Governance dar NU să schimbe deprecations.`
3. Eu implementez fine-grained permissions (după FG-3 Enforcement layer e gata)

### Scenariu 8: "Cum testez UI-ul pentru clienți Junior?"
1. Creează un cont client test
2. (după implementare progressive disclosure) admin override: `POST /api/admin/users/{id}/set-tier {"tier": "junior"}`
3. Loghează-te cu acel cont → vezi UI simplu
4. Revino în admin → schimbă tier la "verified" → loghează-te din nou → vezi UI complet

---

## 📞 Când să-mi ceri ajutor

- **Înainte de orice schimbare majoră**: cere-mi review (nu coda fără să discutăm)
- **Când vezi un bug**: dă-mi screenshot + steps to reproduce
- **Când vrei o funcție nouă**: trece prin Architecture Board PRIMUL, apoi pipeline normal
- **Când nu înțelegi un mesaj de eroare**: copiază-l și întreabă

---

*Manual versiune 1.0 — Feb 12, 2026. Re-citește când platforma evoluează semnificativ.*
