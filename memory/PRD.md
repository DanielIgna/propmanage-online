# PropManage — Product Requirements Document

## Original problem statement
PropManage is a full-stack property management platform with: Digital Twin 3D viewer, Multi-Role auth, QA Automation, marketplace for specialists, GDPR/Trust Center, AI Console, support inbox, auth-health dashboard.

## 🔁 Agent Convention — Auto-Backfill ToDo Board (since Feb 6 2026)

**REGULĂ STRICTĂ pentru orice agent care lucrează pe acest cod:**

La FIECARE `finish` tool call, dacă există muncă neîncheiată / parțială / sugerată user-ului dar care NU s-a executat, agentul TREBUIE să injecteze acele item-uri ca TODO custom în Board.

**Cum**: prin `POST /api/admin/todos/bulk` cu body `{items: [{text, priority, source, topic_title}]}`.

**Tipuri de leftovers care trebuie injectate**:
- Sugestii făcute user-ului (la sfârșit de finish) dar pe care nu le-a acceptat / amânate
- Task-uri parțial implementate (ex: backend OK dar UI lipsă)
- Bug-uri descoperite în testing dar fixate doar parțial
- Tasks din `Future/Backlog` mentions care nu sunt deja în TOPICS docs
- `Action Items` din test_reports cu `retest_needed=true`
- Promises (ex: "voi face X la următoarea iterație") trecute fără să fie executate

**Field-uri**:
- `source`: identificator scurt ("leftover_phase81", "suggestion_not_picked", "bug_partial_fix", etc.)
- `priority`: high/medium/low — folosește judecata: blocker pentru o feature live = high
- `topic_title`: modulul afectat (folosește titlu real din TOPICS dacă există)

**Anti-spam**: endpoint-ul de-duplichează după text (case-insensitive), deci poți chema sigur.

Această regulă a fost cerută explicit de user pentru a evita "drift"-ul în care lucruri amânate dispar din vedere.

## 💡 Strategic R&D — Future Ideas Vault (since Feb 6 2026)

A new admin section `/admin/future-ideas` (sidebar: **STRATEGIE & R&D**) hosts strategic proposals that need explicit business validation BEFORE any implementation. **This catalog is intentionally NOT synced with the ToDo Board** — moving a proposal to "Approved" here triggers no automatic dev work. Founder must explicitly schedule phases in the ToDo Board when ready.

**First proposal stored**: Experience Spaces V2 (Business Operating System) — full technical breakdown across 8 tabs (Overview, Phases, Backend Spec, Frontend Spec, DB Schema, Risks, AI Touchpoints, Cost vs Revenue). Status defaults to `pending_validation`.

**Backend**: `routes/future_ideas.py` — GET/PUT `/api/admin/future-ideas[/{id}]` — persists only status + notes + cost/revenue estimates per idea (content is static in `/app/frontend/src/data/futureIdeas.js`).

**Convention**: Any future strategic proposal goes here first. The ToDo Board is for execution, this vault is for evaluation.



---

## Recent additions (Feb 2026)
- **Phase 89 — Voucher Email + Quest Evaluation Fix** ✅ (Feb 12 2026)
  - **`_send_voucher_email()`** în `routes/feature_configurator.py` — email branded la fiecare voucher câștigat:
    - Design PropManage existent (layout cu logo, dark theme)
    - Cod voucher mare cu border dashed (vizibil, ușor de copiat)
    - Detalii: nume quest, procent, dată expirare formatată RO
    - CTA către dashboard pentru a vedea voucherele
    - Wrapped în try/except — nu blochează emisia voucher-ului dacă email-ul eșuează
  - **Bug-fix critical în `_count_event_for_user`**: query-ul filtra după `updated_at` care nu există în request-urile legacy. Schimbat în `$or: [updated_at >= since, created_at >= since]` — acum quest-urile detectează corect request-urile reale
  - **Validare live end-to-end**:
    - Run cron real → **9 vouchere emise** către useri reali din DB
    - `client@propmanage.io` câștigat 2 vouchere (30% + 50%) din quest-urile "Primii pași" și "Explorator activ"
    - 2 emails branded trimise prin Resend
    - 2 notificări in-app create
    - User-side `/api/me/quests` arată: Primii pași ✅, Explorator activ ✅, Power user 80% (4/5)
    - User-side `/api/me/vouchers` returnează ambele codes cu expirare 30 zile
  - **3 teste anterioare PASS**:
    - Matrice: schimb `client_advanced_filters` regular→verified detectat corect
    - Perechi: warning "tier mismatch" afișat la modificare, dispărut la restore (ok_matches=7)
    - Quest run real: 555 useri scanați, 9 emise (cu fix-ul)
- **Phase 88 — Feature Configurator + Quests + Vouchers (Gamification Layer)** ✅ (Feb 12 2026)
  - **Backend complet** (`routes/feature_configurator.py`) cu 3 sisteme interconectate:
    - **Feature Config**: matrice editabilă de 30 features (18 client + 12 specialist) cu tier configurabil per fiecare (junior/regular/verified/pro) + enable/disable
    - **Feature Pairs**: 7 perechi default Client↔Specialist cu validation warnings (non-bloc) când tier-urile sau enabled mismatch
    - **Quests**: 6 quest-uri default (Primii pași 30%, Explorator activ 50%, Power user 90% pentru client + similare pentru specialist) cu condiții configurabile (target_event, target_count, days_window, min_rating, reward_voucher_pct)
    - **Vouchers**: auto-issued la quest completion cu cod random `PM-XXXXXXXX`, 30 zile expirare, status (active/used/expired). Vouchere GENERICE — aplicare manuală
  - **Cron job nou**: zilnic 03:45 Europe/Bucharest (`quests_daily_evaluation`) — scanează userii, evaluează quest-urile active, issue vouchere automat
  - **Bootstrap inteligent**: collections se populează cu default-uri la primul GET
  - **API endpoints**:
    - Admin: GET/PUT config, PUT feature, POST reset-defaults, CRUD pairs, GET pairs/validate, CRUD quests, GET vouchers + stats, POST quests/run-now
    - User: GET /api/me/quests (progress per quest), GET /api/me/vouchers
  - **Frontend Admin** (`/admin/feature-configurator`) cu 4 tab-uri:
    - **Matrice**: tabel features × roluri × tier-uri cu radio buttons + ON/OFF toggle per celulă, filtru rol, grupare per categorie
    - **Perechi**: listă perechi cu badges (client/specialist), form add (dropdown features), warnings banner amber non-blocking
    - **Quest-uri**: list cu stats (completed/in_progress), toggle activ/oprit, Dry-run + Rulează acum
    - **Vouchere**: KPI cards (active/used/expired) + listă codes cu copy
  - **User-side: QuestPanel** (`/app/frontend/src/lib/QuestPanel.jsx`) mounted automat în ClientDashboard + SpecialistDashboard:
    - Vouchere active cu **copy-to-clipboard** + expirare
    - Quest-uri active cu **progress bar gradient amber→emerald**
    - Quest-uri completate (chips verzi)
    - Self-fetching, ascuns dacă user n-are nimic
  - **Sidebar**: link nou "Feature Configurator" cu badge **GAMIFY** în STRATEGIE & R&D
  - **Verificat live**: 30 features bootstrap, 7 perechi valide, 6 quests active, 555 useri scanați (0 vouchere emise — niciun user real n-are 3 requests completed în 30 zile, ceea ce e corect)
- **Phase 87 — TierGate aplicat: TierToolsPanel + Header Badge + Test Guide + Pre-Deploy Analysis** ✅ (Feb 12 2026)
  - **`<TierToolsPanel role>`** (`/app/frontend/src/lib/TierToolsPanel.jsx`): demonstrative panel cu:
    - **10 unelte pentru Client** (Filtre avansate, Căutări salvate, Comparare oferte, Operațiuni în masă, Export, Analytics, Notificări custom, Support prioritar, API access)
    - **9 unelte pentru Specialist** (Filtre oportunități, Matching prioritar, Aplicare în masă, Analytics business, Export raport, White-label reports, etc.)
    - Layout: secțiune "Deblocate" (verde, click → demo alert) + secțiuni per tier locked (blue/emerald/violet, cu lacăt)
    - Toate acțiunile sunt DEMO (alert info-only) — zero impact pe fluxuri existente
  - **TierBadgeMini** în header DashShared.jsx — afișează tier-ul lângă email-ul userului (badge mic colorat per tier)
  - Mount-uri:
    - `ClientDashboard.jsx` → `<TierToolsPanel role="client" />` în tab "Solicită serviciu"
    - `SpecialistDashboard.jsx` → `<TierToolsPanel role="specialist" />` în tab "Oportunități"
  - **Test Guide complet** (`/app/docs/TIER_TESTING_GUIDE.md`, 10 KB):
    - 8 scenarii test (4 tier-uri × 2 roluri) cu pași literali + ce-trebuie-să-vezi + ce-NU-trebuie-să-vezi
    - Test de siguranță (confirmare zero impact pe fluxuri existente)
    - Reset complet după testare (override back la junior)
    - **Pre-Deploy Analysis** (7 secțiuni A→G): modificări vizibile pentru useri, module noi admin, sisteme cron, date noi DB, checklist verificări, plan rollback, ce să NU faci la deploy
  - Test guide accesibil din admin: `/admin/operating-manual` → tab nou **"Ghid testare Tiers + Pre-Deploy"**
  - Backend endpoint nou: `/api/admin/operating-manual/tier-testing`
  - Bug-fixes colaterale: ClientDashboard `topup()` refactorizat pentru react-hooks/immutability (try-finally → promise chain), escape pe `"` în literale Romanian
- **Phase 86 — Tier Up Celebration (email + in-app banner)** ✅ (Feb 12 2026)
  - Hook automat în `_set_tier()` care declanșează 3 acțiuni la PROMOVARE (upward only — nu și pe downgrade/lateral):
    1. **Email branded** (via Resend, layout PropManage existent) cu lista funcțiilor noi deblocate, în română
    2. **Notificare in-app** inserată în `notifications` collection (type=`tier_promotion`, read=false)
    3. **Banner pe dashboard** la următoarea conectare (flag `tier_celebration_pending` pe user doc)
  - User-facing endpoints: `GET /api/me/tier-celebration` (returnează pending dacă există + traduceri RO ale features), `POST /api/me/tier-celebration/dismiss` (clear flag după ce-l vezi)
  - Nou component frontend `/app/frontend/src/lib/TierCelebrationBanner.jsx` cu:
    - Gradient theme per tier (regular=blue, verified=emerald, pro=violet)
    - Listă feature chips în RO (Filtre avansate, Operațiuni în masă etc.)
    - Buton "Am înțeles, mulțumesc!" + X dismiss icon
  - Mount automat în `ClientDashboard.jsx` + `SpecialistDashboard.jsx` la top, deasupra conținutului. Self-fetching, zero props necesare.
  - **Verificat live end-to-end**: admin promovează client (junior→regular) → email queued + notification creată + `pending` returnat corect cu 5 features în RO + dismiss curăță flag-ul + reset back la junior pentru clean state
- **Phase 85 — Progressive Disclosure (Experience Tiers) system** ✅ (Feb 12 2026)
  - New backend module `routes/experience_tiers.py` cu sistem complet de tier-uri (junior → regular → verified → pro)
  - **Tier auto-promotion criteria** (configurabile via `experience_tier_config`):
    - junior → regular: 7 zile activ + 3 acțiuni completate
    - regular → verified: 30 zile + 10 acțiuni + rating ≥ 4.5
    - verified → pro: 90 zile + 30 acțiuni + email verified + KYC complete
  - **Mongo collections**: `experience_tier_config` (singleton), `experience_tier_history` (audit log promovări)
  - **User fields adăugate**: `experience_tier`, `experience_tier_locked`, `experience_tier_set_at`
  - **Endpoints**:
    - Admin: `/config` (GET/PUT), `/users` (list cu progress), `/users/{id}` (detail), `/users/{id}/override` + `/unlock`, `/run-promotion-job` (manual trigger cu dry_run), `/stats`, `/history`
    - Self: `/api/me/experience-tier` (user-side: vede propriul tier + progres)
  - **Cron job**: zilnic 03:30 Europe/Bucharest (`experience_tier_daily_promotion`)
  - **`/auth/me` extins**: returnează `experience_tier` + `experience_tier_locked` în fiecare răspuns
  - **Frontend primitives** (`/app/frontend/src/lib/experienceTier.jsx`):
    - `useTier()` hook → returnează tier, tierLabel, meetsTier(min), hasFeature(key), features list
    - `<TierGate min="regular" fallback={...}>` → conditional rendering
    - `<TierBadge />` → badge inline cu sparkles
    - `<UpgradeHint requiredTier="..." />` → nudge prietenos pentru juniori
  - **Admin page `/admin/experience-tiers`** cu 4 tab-uri:
    - Overview: distribuție per tier × role, status cron, features per tier (collapsible)
    - Useri: căutare + filtre (role, tier), buton Override (modal cu lock toggle), buton Unlock pentru cei locked
    - Istoric: ultimele 30 promovări (cine, când, de la → la, motiv)
    - Configurare: toggle on/off cron, vizualizare criterii
  - **Sidebar**: link nou "Experience Tiers" în STRATEGIE & R&D
  - **Manual de Operare actualizat**: cap 11 rescris complet cu instrucțiuni pentru sistemul implementat (cum testezi cu conturi de test, exemple de cod TierGate pentru viitoare aplicări)
  - **Verificat live**: 555 useri scanați (338 clienți + 217 specialiști), 1 eligibil pentru promovare detectat corect (client@propmanage.io: 14 zile + 4 acțiuni ≥ thresholds), self-tier endpoint funcțional pentru user-side
- **Phase 84 — Operating Manual + In-app documentation** ✅ (Feb 12 2026)
  - New `/app/docs/OPERATING_MANUAL.md` (547 lines, 26 KB Romanian) — comprehensive how-to:
    - 13 secțiuni: principii siguranță, Smart Pipeline, fiecare modul nou (Governance/Arch/AI PM/Pulse/BugMem/Autonomy/FounderGate/FutureIdeas), Progressive Disclosure (Junior→Verified→Pro), Roadmap per modul, 8 scenarii frecvente cheat-sheet
    - Pentru fiecare modul: ce face / când îl folosești / pași concreți / ce afectezi dacă greșești / cum repari
    - Răspunde explicit la întrebările user-ului: coordonare agenți A→Z, evitare ștergeri (snapshots, dry_run), pipeline arch→pm→todos, activare zone DEV in Autonomy (weights override), Stagii Progressive Disclosure (experience_tier auto-promotion)
  - New backend route `/api/admin/operating-manual` (read-only markdown server)
  - New admin page `/admin/operating-manual` cu:
    - ReactMarkdown rendering custom-themed (h1/h2/h3 jerarhic, tabele, code blocks, blockquotes)
    - TOC sticky lateral + cuprins mobile collapsible
    - Search live în conținut (filtrare per secțiune ##)
    - Linkuri ancore per secțiune
  - Sidebar STRATEGIE & R&D: link "Manual de Operare" cu badge **START AICI** plasat primul (user-friendly entry point)
  - Yarn dep: `react-markdown` (added)
- **Phase 83 — Governance Ecosystem Foundation: Health + Permissions + Pulse + Architecture Board + AI PM** ✅ (Feb 12 2026)

  Major architecture push transforming PropManage from "multiple AI tools" into "a self-monitoring, self-governing platform" — pre-empts Marketplace V2 & Atlas in user's revised priority order.

  **P1 — AI Governance Center extensions**:
  - `GET /api/admin/ai-governance/health` — per-agent status (healthy/degraded/silent/error/deprecated) derived from data-source activity; overall KPI rollup
  - `GET /api/admin/ai-governance/permissions-matrix` — agents grouped by permission_level (read/suggest/execute-with-approval/execute/autonomous) + risk hotspots (active + high-permission)
  - Frontend tabs added: **Health** + **Permissions** (with risk hotspots banner)

  **P2 — Deprecation Pulse** (new module `routes/deprecation_pulse.py`):
  - Weekly email digest (Thursdays 09:30 Europe/Bucharest, APScheduler job `deprecation_pulse_weekly`)
  - 3 alert buckets: upcoming retirements (<window days), overlap alerts (active agent shares data_sources with deprecated), provider risk (gpt_4o, claude_haiku flagged)
  - Endpoints: `GET/PUT /config`, `POST /send-now`, `GET /preview`, `GET /history`
  - Frontend tab **Deprecation Pulse** in AI Governance (config form, KPIs, manual trigger, history)
  - Mongo: `deprecation_pulse_config`, `deprecation_pulse_history`

  **P3 — Architecture Review Board** (new module `routes/architecture_board.py`):
  - Anti-redundancy gate. Submit a feature idea → Claude (Haiku 4.5 for <10s response) checks overlap with 36 indexed modules
  - Returns: `verdict` (build_new / extend_existing / merge_proposal / reject_duplicate), `overlap_score` 0-100, overlapping_modules with weights, suggested_actions, risk_of_redundancy
  - Persisted in `architecture_reviews` collection. New admin page `/admin/architecture-board`
  - Verified: submitting "AI Code Reviewer" → correctly detected 95% overlap with `ai_dev_team` → verdict `reject_duplicate`

  **P4 — Autonomy Engine V2** (extension):
  - New endpoint `POST /api/admin/autonomy/generate-tasks` — materializes engine recommendations as TODOs in admin_todos board
  - Dedupe by text (case-insensitive), priority mapping (critical/high → high, etc.), source=`autonomy_v2:{area}`, meta with tier + general_score at creation
  - Frontend: button "Materializează ca TODO-uri" in Recomandări section of Autonomy page (with confirm)

  **P5 — AI Product Manager** (new module `routes/ai_pm.py`):
  - Idea → Epic → Features → User Stories breakdown via Claude Haiku 4.5 (~16s response)
  - Schema: epic (title/goal/success_metric), max 3 features (P0-P3 priority + effort days + max 2 stories with as_a/i_want/so_that + acceptance criteria), max 3 risks, max 3 out_of_scope
  - `POST /api/admin/ai-pm/breakdown` + history endpoints + `POST /breakdowns/{id}/inject-todos` (bulk inject features as TODOs)
  - Persisted in `ai_pm_breakdowns`. New admin page `/admin/ai-pm`

  **Sidebar Admin** (STRATEGIE & R&D section): added Architecture Review Board (Compass icon), AI Product Manager (Layers icon) — all marked NEW

  **Tested via curl**: all 5 endpoints respond correctly, Claude integration returns valid JSON in <20s for both Arch Board + AI PM. Frontend lint clean for all new/modified files.

  **Decision**: Founder-Gate FG-1 Twilio SMS remains DEFERRED. NO Twilio integration added.

- **Phase 82 — Bug Memory Aggregator UI + AI Governance Deprecation Plan** ✅ (Feb 12 2026)
  - **Bug Memory Aggregator** (closes Phase 1 of Enterprise Architecture Roadmap):
    - New admin page `/admin/bug-memory` (read-only) unifies QA Copilot findings + AI Investigator findings
    - Stats cards (QA / AI / total), search bar over `/api/admin/bug-memory/search`, recent unified feed via `/api/admin/bug-memory/recent`
    - Filters: severity (P0/P1/P2/P3), source (qa_copilot/ai_investigator), reset
    - Backend `routes/bug_memory_aggregator.py` already existed; only frontend was missing
  - **AI Governance — Deprecation Plan**:
    - New backend endpoints: `POST /api/admin/ai-governance/agents/{slug}/deprecate` + `/undeprecate`, `GET /deprecation-plan`
    - New Mongo collection `ai_agent_deprecations` (persists lifecycle override + reason + replacement + target_retirement_date + impact snapshot + history)
    - Live merging in `/agents` endpoint: deprecated entries surface with `lifecycle="deprecated"` + full deprecation metadata
    - Frontend new "Deprecation Plan" tab in `/admin/ai-governance` with: timeline view, KPI cards (active/restored/legacy candidates), suggested legacy candidates list (Concierge + Investigator), restore button, history of restorations
    - Modal "Marchează ca depreciat" on each agent card with reason/replacement/target-date fields
    - Impact snapshot captures data sources + provider + activity stats at decision time (audit-friendly)
  - **Founder-Gate FG-1 (Twilio SMS) marked DEFERRED**:
    - User decision (Feb 2026): NO Twilio integration now. Re-evaluation after beta validation + real clients
    - `futureIdeas.js` updated: FG-1 description prefixed `(⏸️ DEFERRED)`, deliverables tagged `[BLOCKED]`, open question answer changed to option (d) DEFERRED
    - NO Twilio account created, NO `twilio` dependency added, NO DNS changes
  - Sidebar Admin: added Bug Memory Aggregator under STRATEGIE & R&D (Bug icon, NEW badge)
  - Tested via curl: deprecate → lifecycle overlay → restore → history all pass end-to-end

- **Phase 81 — "Send to Emergent Chat" + Auto-Backfill ToDo Board** ✅ (Feb 6 2026)
  - **Buton "Trimite în chat"** în PromptModal: copiază prompt + `postMessage` la `window.parent` cu `type=emergent.chat.inject` (best-effort pentru IDE embedding) + banner verde cu instrucțiuni Ctrl+V
  - **Backend `POST /api/admin/todos/bulk`** pentru batch-creation cu de-duplicare după text
  - **16 leftover items injectate automat** din ultimele 20h: Faza A4 (Auto-Tune), A5.1-A5.5 (Financial/Vendor/Predictive/Strategy/Auditor), Marketplace M1+M5, Trust Page, Twilio SMS, Design unification, briefing schedule custom, Slack webhook, CSV export, DNS Rackhost
  - **Convenție agent permanentă** documentată în PRD (vezi secțiunea de sus): orice agent viitor TREBUIE să facă auto-backfill la finish

- **Phase 80 — Per-Task Emergent Prompt Generator** ✅ (Feb 6 2026)
  - **Backend**: `POST /api/admin/todos/generate-prompt` cu Pydantic `GeneratePromptIn`, Claude Sonnet 4.5 generează prompt structurat (Obiectiv/Fișiere suspecte/Pași concreți/Criterii de validare/Risc), fallback determinist
  - **Anti-spam**: cooldown 5s per-admin (răspunde 429 dacă click prea des)
  - **Frontend**: wand icon (🪄) pe fiecare TODO undone, click → modal cu spinner → prompt în font mono + buton "Copiază prompt"
  - **Done todos** nu mai au butonul (UX: nu generezi prompt pentru ce e gata)
  - **Workflow închis**: vezi TODO → 1 click → ai prompt → mi-l dai → execut
  - Testing iter 60: 14/14 backend pytest + frontend 100%

- **Phase 79 — AI Assistant Context-Aware + ToDo Board** ✅ (Feb 6 2026)
  - **AI Assistant inline_context**: extins `POST /api/ai-docs/ask` cu params `inline_context` (max 40000 chars) + `inline_context_label`. Când e prezent, bypassează RAG complet și răspunde STRICT din manualul injectat (cu mențiunea "Nu am găsit în manual" dacă lipsește). System prompt în română, concise (max 6 propoziții).
  - **Frontend integration**: `AdminDocumentation.askAssistant` trimite acum tot manualul (titlu + status + content per topic) ca inline_context — răspunsurile devin precise platformei, nu generice.
  - **ToDo Board centralizat** la `/admin/todo`:
    - Agregă TODO-urile read-only din `TOPICS` (30 task-uri din documentație) + custom todos persistate via `/api/admin/todos`
    - Stats: Total / Deschise / Finalizate / Din manual / Custom
    - Filtre Deschise/Finalizate/Toate + per-topic navigation jos
    - Custom todos: prioritate editabilă (Ridicat/Mediu/Scăzut), text editabil, delete
    - Documented todos: toggle done (persistat în `admin_todo_state.doc_done_ids`), fără delete
    - Linkat din Documentation header + sidebar Admin
  - **Backend** `routes/admin_todos.py`: 5 endpoints (GET, POST, PUT, DELETE, doc-done) + cleanup `done_at` la un-toggle
  - **Bug fix cosmetic**: "Nicio rezultat" → "Niciun rezultat" (Romanian grammar)
  - Testing iter 59: 18/18 backend pytest + frontend complete

- **Phase 78 — Weekly AI Briefing (Email Săptămânal)** ✅ (Feb 6 2026)
  - **Backend**: `routes/ai_weekly_briefing.py` cu 4 endpoints (`GET/PUT /config`, `POST /send-now`, `GET /history`) + helper `send_weekly_briefing()` + scheduler job
  - **APScheduler cron**: Luni 09:00 Europe/Bucharest (`weekly_ai_briefing`) — silent dacă `enabled=false` sau `recipients=[]`
  - **Conținut**: Claude Sonnet 4.5 sintetizează 7 zile de activitate AI (auto-match, findings, autonomy delta) într-un email HTML structurat cu 4 KPI cards + text natural în română + delta vs săptămâna trecută. Fallback determinist dacă LLM crapă.
  - **Email**: trimis via Resend (existing `email_service.send_email`)
  - **History**: `ai_weekly_briefing_history` (capped 50) cu summary text + stats + recipients + ok/error
  - **Frontend** `WeeklyBriefingControl` pe `/admin` (Overview, între AutoMatchPanel și AIActivityStream): toggle Activează/Dezactivează, listă destinatari cu × per email, input + Adaugă, buton "Trimite acum" (cu confirm), afișare ultima trimitere + preview text summary
  - **Email validation**: regex strict `^[^@\s]+@[^@\s]+\.[^@\s]+$`
  - Testing iter 58: 21/21 backend + frontend complete

- **Phase 77 — AI Activity Stream (Operations Center)** ✅ (Feb 6 2026)
  - **Backend** `GET /api/admin/ai-activity?hours&limit` (admin-only, READ-ONLY)
  - Agregă evenimente din **7 colecții**: `autonomy_snapshots`, `auto_match_runs`, `admin_ai_findings` (detected+resolved), `admin_ai_scans`, `smoke_test_runs`, `app_settings_snapshots`, `security_ai_runs`
  - Output normalizat cu kind/ts/title/summary/severity/icon/meta/source · severitate (info/success/warning/critical) mapată inteligent per sursă
  - **Robust**: dacă un collector crapă, restul continuă (warning log, nu 500)
  - **Frontend widget** `AIActivityStream` pe `/admin` (Overview) — timeline cu connector vertical, 4 contoare severitate, filtre per kind (pills), auto-refresh la 60s cu reset pe manual refresh, relative timestamps ("acum 3h"), max height 500px scrollable
  - Testing iter 57: 20/20 backend + frontend complete

- **Phase 76 — Auto-Match Schedule (Autonomous Mode)** ✅ (Feb 6 2026)
  - **APScheduler cron** la `:23` în fiecare oră (`auto_match_cron_tick`) → execută `execute_auto_match` doar când e `enabled=true` ȘI a trecut `interval_hours` de la ultima rulare
  - **Config endpoints**: `GET/PUT /api/admin/auto-match/schedule` cu validare 1≤interval≤24, persistat în `auto_match_schedule._id=config`
  - **Run history** `auto_match_runs` (capped 200) cu `triggered_by.kind = cron | admin_manual`
  - **UI panel** Mod autonom în AutoMatchPanel: status badge (Activ/Dezactivat), selector interval (1h/3h/6h/12h/zilnic), buton toggle Activează/Dezactivează, afișare "Ultima rulare cron"
  - **Refactor**: extras `execute_auto_match()` ca helper partajat între `/run` și cron tick (DRY)
  - Testing iter 56: 14/14 backend + frontend complete

- **Phase 75 — Admin Bulk Auto-Match** ✅ (Feb 6 2026)
  - **Backend** `/api/admin/auto-match/preview` + `/run` (admin-only, bypasses 45 RON lead fee, folosește `find_matching_specialists` din matching.py)
  - **Frontend** AutoMatchPanel pe `/admin` (Overview) — KPI 3-tile (neatribuite/cu match/fără match) + buton Simulează (dry_run) + Asignează (cu confirmare)
  - **Notificări** auto către client + specialist când rulează
  - **Quick Win impact**: 39 cereri asignate → `auto_matched_requests_pct: 50.7% → 100%`, Operational 44 → 61, **General 63 → 68**
  - Testing iter 55: 9/9 backend + frontend complete

- **Quick Win Sprint (Phase 74.5)** ✅ (Feb 6 2026)
  - 2 critical AI findings rezolvate (prompt injection + bot — deja auto-blocate)
  - 57 low-severity findings bulk-dismissed
  - Smoke test rulat 6/6 PASS
  - Settings snapshot proaspăt
  - Mini-fix engine: corectat field-urile reale `smoke_test_runs.ok` și `release_gates.summary.p0_fail/blocked`
  - **Rezultat**: Autonomy 27 → 63 (Manual → Assisted)

- **Phase 74 — AI Autonomy Engine (A1+A2)** ✅ (Feb 6 2026)
  - **Roadmap docs** create înainte de implementare (la cererea user-ului):
    - `/app/docs/autonomy_engine_roadmap.md` — 5 faze (A1 compute, A2 frontend, A3 snapshot job, A4 auto-tune READ-ONLY, A5 specialized agents)
    - `/app/docs/marketplace_ecosystem_roadmap.md` — 8 faze (M0 pre-req, M1 registry, M2 install flow, M3 sandbox via webhook, M4 dev portal/SDK, M5 Stripe Connect, M6 App Store Intern, M7 review, M8 ratings)
    - Reconfirmat MongoDB-only (no Postgres/Qdrant) cu user-ul
  - **Backend module nou izolat**: `/app/backend/autonomy/engine.py`
    - 5 sub-scoruri deterministice (no LLM): operational, technical, security, dev, ai
    - General autonomy = weighted average; ponderi configurabile via `autonomy_targets`
    - 4 tier-uri: manual (<50) / assisted (50-75) / autonomous (75-90) / self-driving (>=90)
    - Recomandări prioritizate cu impact estimat în puncte
  - **Backend rute**: `/app/backend/routes/autonomy.py`
    - `GET /api/admin/autonomy/score` (cached 5 min)
    - `GET /api/admin/autonomy/history?days=30`
    - `POST /api/admin/autonomy/snapshot` (force)
    - `GET/PUT /api/admin/autonomy/targets` cu validare strictă a celor 5 chei + normalizare weights la 1.0
  - **Frontend**: `/app/frontend/src/pages/admin/AutonomyEnginePage.jsx` la `/admin/autonomy`
    - Inel scor 0-100 cu țintă overlay (dashed), tier badge animat
    - 5 carduri sub-scor cu progress bars + gap-to-target
    - Drill-down modal pe click cu signal-uri + date brute
    - Sparkline 30 zile (din `autonomy_snapshots`)
    - Lista recomandări prioritizate cu prioritate critic/ridicat/mediu/scăzut
  - **Scheduler nou**: APScheduler job `autonomy_snapshot_daily` la 03:15 Europe/Bucharest
  - **Sidebar**: Entry "Autonomy Engine" sub AI section în AdminLayoutMetronic
  - **Mongo collections noi**: `autonomy_snapshots`, `autonomy_targets`
  - Testing iter 54: 100% pass (11/11 backend + frontend complete, fără regresii pe AI Control / Healthcheck)

- **Phase 73 — Admin Manual 2.0 + Snapshots Rollback + Service Contracts** ✅ (Feb 4 2026)
  - **Admin Documentation rescriere completă** at `/admin/documentation` — 14 module documentate (vs 9 anterior):
    - 🆕 **Ghid Buton-cu-Buton**: 20 butoane principale (Settings, AI Control, QA Copilot, AI Dev Team, AI Security, Verified Estate, Client/Specialist/Operator Dashboards, GDPR) explicate în limbaj simplu — rol + când folosești + când actualizezi.
    - 🆕 **Snapshots & Rollback Settings** — ghid utilizare.
    - 🆕 **Contract Servicii** — cum se generează, semnează, mediază.
    - 🆕 **Server Rackhost & Plan Migrare** — istoric + plan migrare către Cloudflare/Hetzner cu pași concreți și avertismente.
    - 🆕 **Adrese email .ro dedicate** — 3 opțiuni (Zoho Free RECOMANDAT, Google Workspace 6 EUR/u/lună, Migadu 9 EUR flat) cu pași DNS exacți.
    - **Status per topic**: `Creat` (verde) cu lista realizărilor + `TODO Îmbunătățiri` (galben) cu lista pentru perfecționare.
    - **Buton "Generează prompt pentru Emergent"** per topic — Claude scrie task structurat din TODO-uri, gata de copy-paste înapoi în chat.
    - **AI Manual Assistant modal**: chat care răspunde din manual folosind RAG (Document Intelligence pipeline din Phase 71).
    - Search bar peste tot conținutul.
  - **Snapshots & Rollback** — `routes/settings_snapshots.py`:
    - APScheduler job zilnic la 04:00 (Bucharest TZ) — `take_auto_snapshot()`.
    - Buton "Snapshot acum" + listă istoric ultimele 50 (rolling buffer auto-clean).
    - POST `/restore` face automat un `pre_restore` snapshot înainte de overwrite — rollback la rollback.
    - 3 tipuri: `auto` / `manual` / `pre_restore` cu UI cu coloare distinctă (albastru / lime / amber).
    - Integrat în AdminSettingsControl cu toggle pentru afișare panou.
  - **Service Contracts** — `routes/service_contracts.py`:
    - Template română generic (level "scrisoare de intenție comercială", nu act notarial) cu 9 clauze: părți, obiect, preț ESCROW Stripe, obligații client, obligații specialist, mediere prin Operator PropManage (obligatorie 5 zile lucrătoare înainte instanță), dispută, recepție 48h, clauze finale.
    - Editabil din `app_settings.contract_template` (HTML cu `{{placeholdere}}` simplu fără eval).
    - Endpoints: `/generate`, `/{cid}`, `/{cid}/sign`, `/{cid}/operator-resolve`, `/by-request/{request_id}`, `/list/my`.
    - Pagină `/contracts/{cid}` cu print-friendly white background, semnătură electronică modal, operator mediation form (când role=operator/admin).
    - **Bug critical găsit și fixat** (iter 52→53): request lookup folosea `id` string, dar Mongo stochează `_id: ObjectId`. Dual lookup + storage normalizat la string-form.
  - **Mongo collections**: `app_settings_snapshots`, `service_contracts`.
  - **Tested**: iteration_52 (8/8 snapshots + 8/8 contracts FAIL=>fix), iteration_53 (10/10 contracts PASS post-fix) = **18/18 backend + 100% frontend**.

- **Phase 72 — AI Dev Team + AI Security Center** ✅ (Feb 4 2026)
  - **AI Dev Team READ-ONLY** at `/admin/ai-dev-team` — 4 specialized Claude agents (frontend/backend/qa/security) analyze any indexed file → return JSON with summary, issues (P0-P3 severity), improvements, security_concerns, next_actions (copy-paste prompts for Emergent chat). Defense-in-depth path validation: blocks `..`, absolute paths, `.env/.git/secrets/node_modules`, plus enforces file must be in code_index. Max 12000 chars/file to keep within Cloudflare 60s timeout.
  - **AI Security Center** at `/admin/ai-security` — read-only threat dashboard:
    - Heuristic score 0-100 (100 base − penalties for severity/burst IPs)
    - Threat level: SCĂZUT (≥85) / MEDIU (≥65) / RIDICAT (≥40) / CRITIC (<40)
    - Stats: events_24h, failed_logins_24h, unique IPs, active incidents, burst IPs
    - AI-powered recommendations via Claude analyzing recent audit_log/security_events/incidents
    - Window selector: 1h / 6h / 24h / 3 days / 7 days
    - NEVER auto-blocks IPs — all actions are suggestions for admin
  - **Mongo collection**: `security_ai_runs` (history of AI security analyses).
  - **Tailwind safelist extended**: bg-{color}-500/20 + text-{color}-200 added for security level color cycling.
  - **Sidebar Admin**: 2 new entries with NEW badges (Code2 icon for Dev Team, Shield icon for Security).
  - **Phase 5 (Ollama/Qwen/DeepSeek live) skipped** — stub already exists from Phase 70; activate when user supplies keys.
  - Tested: iteration_51 → 16/16 backend pytest PASS + 100% frontend. Claude returned valid Romanian summary on backend file in ~12s; security analysis returns graceful "Niciun eveniment..." on clean DB.

- **Phase 71 — Urgency UX + QA Code-Aware + Twin Q&A + Document Intelligence** ✅ (Feb 4 2026)
  - **Marketplace urgency upgrades**: Specialist Dashboard now has `🔥 Urgent` filter toggle with live count badge + auto-sort (urgent first, then newest) + red pulse-soft ring animation on urgent cards. Client Dashboard "Cerere nouă" modal shows red helper note when Urgent selected. Backend `routes/requests.py` notify() prepends `[URGENT]` prefix to email subject + uses `type_=lead_urgent` so future channels can route differently.
  - **QA Copilot Code-Aware Mode**: New `ai_core/code_index.py` (file path indexer, 10min cache) injected into the Claude system prompt + post-validation of `suspected_files`. Cuts hallucinations to ~0 in tests. UI now shows "verificate vs cod real" label and warns about filtered invalid paths.
  - **Phase 2 — Digital Twin AI Q&A**: New `routes/digital_twin_qa.py` builds context from `digital_twin_projects/models/plans/pins/comments`, sends to Claude, persists to `digital_twin_qa_sessions` and `ai_memories` (scope=client_agent). React component `TwinAIQA.jsx` is a floating chat widget dropped into ClientTwinViewer. Supports session continuity + 4 suggested starter questions.
  - **Phase 3 — Document Intelligence**: New `routes/docs_ai.py` accepts PDF/DOCX/TXT/MD (max 10MB), extracts text via pypdf/python-docx, chunks ~800 chars, BM25-scored over `ai_doc_chunks` collection. RAG-style /ask returns answer + sources with chunk indices. Romanian diacritics + light stemmer (suffixes: ului/elor/ilor/lor/ele/ile/uri/lui/ul/ii/ea/ie/ia) for natural-language queries. New page `/ai-docs` with upload + list + ask UI.
  - **Tokenizer upgrade**: `ai_core/memory._tokenize` now strips Romanian diacritics + stems common suffixes — verified working: "Cat este suprafata livingului?" → "28 m²" with source citation.
  - Tested: iteration_50 → 14/14 backend pytest PASS, 100% frontend (urgent toggle, helper note, code-aware label, docs upload+ask+sources all confirmed live).
  - Open items (non-blocking): docs_ai upload reads full file before size check (fine at 10MB cap); chunks search becomes O(N) above 5k chunks/user (add Mongo text index then); KG email lookup carryover from Phase 70 (now fixed in this fork).

- **Phase 70 — AI Foundation (Ecosystem Phase 1)** ✅ (Feb 3 2026)
  - **Package `/app/backend/ai_core/`**: 4 modules — `provider.py` (multi-LLM abstraction: Claude/OpenAI/Gemini active via Emergent LLM Key, Ollama stub for Phase 5), `memory.py` (persistent cross-session memory with BM25-ish scoring, 5 scopes: concierge/qa_copilot/client_agent/admin_agent/tech_agent), `bug_memory.py` (unified search across qa_sessions.findings + admin_ai_findings), `knowledge_graph.py` (read-only entity graph for user → properties → requests → specialists → listings).
  - **Mongo collection**: `ai_memories` (id, user_id, scope, content, summary, tokens, source, created_at, expires_at). Default TTL 180 days.
  - **Feature flag**: `app_settings.ai_ecosystem.enabled` (default true) — kill-switch. When false, memory.remember/recall short-circuit; legacy modules (Concierge, AI Investigator, QA Copilot) continue working independently.
  - **AI Control Center** page at `/admin/ai-control` — unified UI with 4 stat cards (model, memories, bugs, agents), provider/model/temperature/max_tokens config + save, agents list (6 active: Concierge, AI Investigator, QA Copilot, Memory Engine, Bug Memory, Knowledge Graph), memory browser with user/scope filters + delete + reset, bug search across all sources, knowledge graph viewer per user.
  - **QA Copilot integration**: every finding now auto-persists a compact summary to `ai_memories` (scope=qa_copilot, source=qa_session:{id}) — fire-and-forget, doesn't block flow on failure.
  - **Knowledge Graph email lookup**: `for_user()` matches by `_id` ObjectId OR `id` field OR `email` field (fixed post-test).
  - **Tailwind safelist**: 30+ dynamic color classes safelisted.
  - **Security**: All endpoints require admin role; reset memories supports per-user or global wipe with confirm dialog in UI.
  - Tested: iteration_49 → 18/18 backend pytest, ~95% frontend (config save/toggle/agents/memory filter/bug search/sidebar all PASS).

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


## Update — 7 Feb 2026 · Resend Email Fix + Voucher Expiry Widget verified
- 🔴 **FIXED P0 — Resend Email Delivery**: `RESEND_API_KEY` was empty in `/app/backend/.env`, causing PROVIDER to fall back to `console` mode (fake success — emails were only logged, never sent). User-facing symptom: voucher emails not arriving at `danieligna1@gmail.com`. Fix: added the real Resend production key + switched `SENDER_EMAIL` to `PropManage <noreply@propmanage.ro>` (verified domain). Verified via direct send: 4 emails delivered with Resend IDs (test email + 3 vouchers at 30%/50%/90%).
- ✅ **Voucher Expiry Alert Widget verified**: Component `/app/frontend/src/lib/VoucherExpiryAlert.jsx` already existed and is wired into `DashShared.jsx` navbar. Renders pulsing red badge when active vouchers expire in < 7 days; dropdown lists urgent vouchers sorted by days left with click-to-copy code. E2E tested on `client@propmanage.io` with 4 urgent vouchers visible.
- Test endpoint `POST /api/admin/feature-configurator/vouchers/create-test` body schema: `{user_email, percent, expires_in_days, reason?}` (NOT `email`).

## Backlog (next pickup)
- P1: Marketplace Economics V2 (Dynamic Fee, Lead Gating, Max 5 offers, Sub-categories) — awaits user "Start MKT-V2" command.
- P2: Twin Orchestrator AI Agent & KG extensions.
- P2: Experience Spaces V2 (Isolated implementation).
- P3: Design System Unification (PropManage Atlas).
- DEFERRED: Founder-Gate FG-1 Twilio SMS — DO NOT IMPLEMENT until user explicit request.
