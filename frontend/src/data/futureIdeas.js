// FUTURE_IDEAS — static catalog of strategic dev proposals.
//
// Each entry is a self-contained proposal with full technical breakdown.
// Status (pending/approved/rejected) is persisted server-side; content here
// is version-controlled and reviewable via PR.
//
// METRICI DUALE:
// - timelineDays / estCostEur = referință teoretică freelance (200€/zi mid-level)
// - emergentComplexity / emergentEffort / emergentCreditsEstimate = realitatea Emergent
// - risk (X/10) = probabilitate apariție bug-uri/regresii, NU "doar X din 10 funcționează"
import { Sparkles, Palette, Coins, ShieldCheck } from "lucide-react";

export const FUTURE_IDEAS = [
  // ==========================================================================
  // PROPUNERE 0 — FOUNDER APPROVAL GATE (cea mai critică, prioritate top)
  // ==========================================================================
  {
    id: "founder_approval_gate",
    code: "FOUNDER-GATE",
    title: "Founder Approval Gate — Dublă verificare email + SMS pentru modificări critice",
    icon: ShieldCheck,
    risk: 6,
    riskExplanation: "Risc 6/10 = atinge zonele critice (cod, date, admin permissions, modificări business logic). Probabilitate ~60% de bug-uri în primele 2-3 săptămâni (false-positive la detection, lockout potențial dacă SMS Twilio eșuează). Mitigările: bypass tip 'glass-break' (cod recovery offline) + audit log imutabil + opțiune SMS-fallback prin email TOTP. Funcțional 100%, doar trebuie testat extensiv.",
    timelineDays: 12,
    estCostEur: 2400,
    estOpexMonthly: 25,
    estRevenueMonthly: 0,
    estRevenueRange: "Indirect: previne pierderi catastrofale",
    emergentComplexity: "Medie-Ridicată",
    emergentEffort: "4-6 task-uri agent (Twilio integration + workflow + UI + audit log + recovery)",
    emergentCreditsEstimate: "50-90 credite estimate",
    businessImpact: "PROTECȚIE CRITICĂ. Previne ca un admin secundar sau un agent AI să facă modificări irreversibile fără aprobarea founder-ului (ex: ștergere date, transfer ownership, schimbare comisioane, export GDPR masiv, modificări cod cu impact business logic). O singură eroare prevenită = recuperare cost x10. Esențial când scalezi cu mai mulți admini sau cu agent AI agentic.",
    summary: "Sistem 2-Factor de aprobare pentru orice acțiune ADMIN cu impact critic (modificări cod backend deployed, ștergere/export date, transfer ownership, schimbare comisioane/pricing, modificare permissions, agent AI ce vrea să rescrie business logic). Workflow: acțiunea e blocată → email instant la founder cu detalii + buton Approve/Reject + cod SMS 6 cifre via Twilio → founder confirmă pe ambele canale → acțiunea se execută. Toate aprobările audit-logged imutabil. Include 'glass-break' recovery (cod offline pentru cazuri Twilio down).",
    problemAndOpportunity: "PROBLEMA: PropManage are deja 3 conturi admin + agent AI cu autonomie crescândă (Tier 'Assisted' acum, target 90%+). Orice admin secundar sau agent AI poate ACUM, în teorie, să: (a) modifice comisionul de la 2.5% la 50% și să bate platforma; (b) șterge accidental colecții întregi; (c) exporte tot baza de clienți la o terță parte; (d) schimbe destinația plăților Stripe; (e) accepte agent AI o sugestie de cod care rupe logica. RISC: o eroare costă 10-100x mai mult decât investiția în această protecție. OPORTUNITATEA: implementarea unui gate dublu (email + SMS la founder) face IMPOSIBILE aceste modificări fără confirmarea ta personală — chiar dacă cineva îți fură credențialele admin.",
    principles: [
      "Identifică SET STRICT de acțiuni critice (lista hardcodată, nu permisivă): ștergere bulk date, modificare comision, transfer ownership, export GDPR >100 rânduri, modificare cod backend deployment, agent AI cu schimbare business logic",
      "Toate acțiunile critice intercepted de middleware → puse în queue `pending_founder_approval` → email instant + SMS 6 cifre",
      "Founder primește email cu: ce acțiune, cine a inițiat, datele afectate (count), preview JSON, buton Approve / Reject + cod SMS 6 cifre separat",
      "Verificare dublă: trebuie să dai click pe link DIN email + să introduci cod SMS în pagina admin (același cod expiră în 10 min)",
      "Recovery 'glass-break': 5 coduri offline (printabile / păstrate în safe) pentru cazul când Twilio e down + email comprimat",
      "Toate aprobările/respingerile audit-logged imutabil în `founder_decisions` (collection separată, nu accept overwrites)",
      "Bypass strict imposibil: chiar și root admin nu poate dezactiva gate-ul pentru sine (doar founder cu cod recovery)",
      "SMS via Twilio (RO +40 fully supported) cu rate limit 5 SMS/oră + alert email dacă rate exceeded",
      "Toate acțiunile critice expiră automat din queue după 24h dacă nu sunt aprobate (auto-reject + email notification)",
      "Frontend admin afișează banner permanent pentru pending approvals (founder vede cât a stat in queue)",
    ],
    antiPatterns: [
      "NU permite extinderea listei de acțiuni critice fără un alt gate (recursive lock)",
      "NU loga codurile SMS în plain (audit log doar 'sent', niciodată conținutul)",
      "NU permite recovery code reutilizat — fiecare folosit o singură dată",
      "NU permite override din DB direct — middleware verifică flag la fiecare request, nu cache",
      "NU permite founder să dezactiveze gate-ul fără cod SMS (chiar și pentru sine)",
      "NU bypass-a gate-ul pentru agentul AI nici măcar 'pentru viteză' — dacă AI vrea să facă ceva critic, întreabă founder mereu",
      "NU permite mai mulți founders (single source of truth)",
    ],
    phases: [
      {
        code: "FG-0", title: "Foundation: Founder Contact + Critical Action Registry", days: 1,
        description: "Definire model + registry hardcoded al acțiunilor critice + storage pentru founder contact (deja salvat în app_settings.founder_contact).",
        deliverables: [
          "Model `FounderContact` în app_settings (email, phone, country, is_primary_owner) — DEJA EXISTĂ",
          "Collection `critical_actions_registry` cu lista hardcoded acțiuni (slug, label, severity, requires_sms)",
          "Helper `is_critical_action(slug)` reutilizabil",
          "Seed inițial cu 8-10 acțiuni critice (delete_collection, change_commission, transfer_ownership, etc.)",
        ],
      },
      {
        code: "FG-1", title: "Twilio Integration + SMS Service", days: 2,
        description: "Integrare Twilio pentru SMS verification + rate limiting.",
        deliverables: [
          "Cont Twilio (free trial sau plătit) + RO sender number",
          "Helper `send_verification_sms(phone, code)` cu retry 3x",
          "Rate limit 5 SMS/oră/founder (Redis sau MongoDB TTL)",
          "Alert email când rate exceeded sau Twilio fails",
          "Fallback: email TOTP (Authenticator app) dacă SMS eșuează",
        ],
      },
      {
        code: "FG-2", title: "Approval Queue + Backend Middleware", days: 3,
        description: "Middleware care intercepted toate acțiunile critice și le pune în queue.",
        deliverables: [
          "Collection `pending_founder_approvals` cu TTL 24h",
          "Decorator `@requires_founder_approval(action_slug, severity)` pentru endpoint-uri critice",
          "Endpoint POST `/api/founder-gate/approve/{token}` (link din email)",
          "Endpoint POST `/api/founder-gate/verify-sms` cu cod 6 cifre",
          "State machine: pending → email_clicked → sms_verified → executed | rejected | expired",
          "Auto-reject după 24h + email notification",
          "Audit log imutabil în `founder_decisions`",
        ],
      },
      {
        code: "FG-3", title: "Email Templates + Approval UI", days: 2,
        description: "Email HTML profesional + landing page pentru aprobare.",
        deliverables: [
          "Email template HTML cu: acțiune, actor, payload preview, buton Approve (mov), buton Reject (roșu)",
          "Landing page `/founder-gate/{token}` (mobile-optimized, no auth needed — token e suficient)",
          "UI pentru introducere cod SMS (6 cifre, paste-friendly)",
          "Confirmation page după approve/reject",
          "Notificare email finală: 'acțiunea X a fost executată/respinsă'",
        ],
      },
      {
        code: "FG-4", title: "Glass-Break Recovery + Admin Dashboard", days: 2,
        description: "Recovery offline + dashboard pentru founder.",
        deliverables: [
          "Generare 5 coduri recovery one-time (printabile, păstrate offline)",
          "Endpoint POST `/api/founder-gate/recovery-bypass/{code}` (single-use)",
          "Dashboard `/admin/founder-gate`: pending approvals + history + recovery codes status",
          "Banner permanent admin: 'X cereri pending la founder' cu age (cât a stat)",
          "Export audit log CSV (pentru compliance/legal)",
        ],
      },
      {
        code: "FG-5", title: "Testing + Documentation", days: 2,
        description: "Test suite + docs pentru founder + admin secundari.",
        deliverables: [
          "Test suite cu 30+ scenarii (happy path, expirat, SMS down, recovery, bypass attempts)",
          "Penetration test: încearcă să bypass gate-ul prin DB direct, JWT manipulation, race condition",
          "Documentație în Admin → Docs: cum funcționează, ce e protejat, ce să faci dacă pierzi telefonul",
          "Test cu primul 'șoc' real (modificare comision de test) — verificare end-to-end pe inbox personal",
        ],
      },
    ],
    backend: {
      structure: `/app/backend/
├── founder_gate/
│   ├── __init__.py
│   ├── registry.py        # critical_actions_registry hardcoded list
│   ├── middleware.py      # @requires_founder_approval decorator
│   ├── queue.py           # pending_founder_approvals CRUD
│   ├── twilio_sms.py      # SMS sender + rate limit
│   ├── email_templates.py # approval email HTML
│   └── recovery.py        # glass-break codes
├── routes/
│   └── founder_gate.py    # approve/reject/verify-sms/recovery endpoints
└── models/
    ├── founder_approval.py
    └── founder_decision.py`,
      endpoints: [
        { method: "GET",  path: "/api/admin/founder-gate/pending",                  note: "Lista pending approvals (admin view)" },
        { method: "GET",  path: "/api/admin/founder-gate/history",                  note: "Audit log decizii founder" },
        { method: "GET",  path: "/api/admin/founder-gate/recovery-codes",           note: "Status (folosite/disponibile)" },
        { method: "POST", path: "/api/admin/founder-gate/recovery-codes/regenerate", note: "Regenerare (necesită SMS founder)" },
        { method: "POST", path: "/api/founder-gate/approve/{token}",                note: "Link din email (public, token-based)" },
        { method: "POST", path: "/api/founder-gate/reject/{token}",                 note: "Reject din email" },
        { method: "POST", path: "/api/founder-gate/verify-sms",                     note: "Submit cod 6 cifre" },
        { method: "POST", path: "/api/founder-gate/recovery-bypass/{code}",         note: "Glass-break single-use" },
        { method: "GET",  path: "/api/admin/founder-gate/critical-actions",         note: "Lista acțiuni protejate (read-only)" },
      ],
      security: [
        "Token JWT semnat cu secret separat (FOUNDER_GATE_SECRET în .env)",
        "SMS codes hashed cu bcrypt înainte de stocare (nu plain text)",
        "Rate limit strict: 5 SMS/oră/founder, 10 approve attempts/oră",
        "IP whitelist optional pentru landing page (RO + țări specifice)",
        "Audit log append-only, fără DELETE permis",
        "Recovery codes hashed individual, single-use enforced atomic",
        "TTL automat 10 min pentru SMS codes, 24h pentru pending approvals",
        "Constant-time comparison pentru cod SMS (anti timing attack)",
      ],
      dependencies: [
        "twilio>=8.5.0          # SMS provider RO support",
        "pyotp>=2.9             # TOTP fallback dacă vrei Authenticator app în plus",
        "# Stocare: existing MongoDB, no Redis needed",
      ],
    },
    frontend: {
      structure: `/app/frontend/src/
├── pages/
│   ├── founder-gate/
│   │   ├── ApprovalLanding.jsx     # /founder-gate/{token}
│   │   ├── ApproveSuccess.jsx
│   │   └── RejectSuccess.jsx
│   └── admin/founder-gate/
│       ├── FounderGateDashboard.jsx  # /admin/founder-gate
│       ├── PendingApprovals.jsx
│       ├── DecisionHistory.jsx
│       └── RecoveryCodes.jsx
└── components/
    ├── FounderGateBanner.jsx       # banner permanent admin
    └── SmsCodeInput.jsx            # 6-digit paste-friendly input`,
      routes: [
        { scope: "public", path: "/founder-gate/{token}",            note: "Landing page din email (token auth)" },
        { scope: "public", path: "/founder-gate/{token}/success",    note: "Confirmation după aprobare" },
        { scope: "admin",  path: "/admin/founder-gate",              note: "Dashboard founder" },
        { scope: "admin",  path: "/admin/founder-gate/pending",      note: "Cereri în așteptare" },
        { scope: "admin",  path: "/admin/founder-gate/history",      note: "Istoric decizii" },
        { scope: "admin",  path: "/admin/founder-gate/recovery",     note: "Glass-break codes management" },
      ],
      designReuse: [
        "Folosește componentele Atlas (dacă DS-ATLAS aprobat) — modal verde/roșu pentru approve/reject",
        "Email template profesional cu logo + branding consistent",
        "SmsCodeInput: 6 inputuri separate cu autofocus next + paste detection",
        "Banner admin: portocaliu cu pulse animation pentru pending",
      ],
      dependencies: [
        "# ZERO dependențe noi frontend — totul cu shadcn + react existent",
      ],
    },
    db: {
      isolationRule: "3 colecții noi cu prefix `founder_*` + extindere `app_settings.founder_contact` (deja existent). Toate modulele existente NEATINSE. Rollback: dacă oprești gate-ul, colecțiile rămân ca audit doar, nu blochează nimic.",
      collections: [
        {
          name: "pending_founder_approvals", purpose: "Queue acțiuni critice care așteaptă founder",
          schema: `{
  _id, id, token: "uuid",  // pentru link email
  action_slug: "change_commission_pct",
  action_label: "Modificare comision platformă",
  severity: "critical|high",
  initiated_by: "admin_user_id",
  initiated_by_email: "admin@...",
  payload: { old_value, new_value, target_collection, target_id, preview },
  state: "pending_email|pending_sms|approved|rejected|expired",
  email_clicked_at: ISO?,
  sms_code_hash: "bcrypt", sms_sent_at: ISO?, sms_attempts: 0,
  created_at, expires_at: ISO  // 24h
}`,
          indexes: [
            "{token:1} unique",
            "{state:1, expires_at:1}",
            "TTL on expires_at",
          ],
        },
        {
          name: "founder_decisions", purpose: "Audit log IMUTABIL al deciziilor founder",
          schema: `{
  _id, id, approval_id,
  action_slug, action_label, severity,
  initiator_user_id, initiator_email,
  decision: "approved|rejected|expired_auto_reject|recovery_bypass",
  decided_at, decided_by_method: "email_link+sms|recovery_code",
  payload_snapshot: {},  // copie payload la momentul deciziei
  execution_result: "success|failed|skipped",
  execution_error?: "string",
  ip_address?, user_agent?,
}`,
          indexes: [
            "{action_slug:1, decided_at:-1}",
            "{decision:1, decided_at:-1}",
            "NO delete permission — append only",
          ],
        },
        {
          name: "founder_recovery_codes", purpose: "5 coduri glass-break offline (single-use)",
          schema: `{
  _id, id, code_hash: "bcrypt",
  generated_at, generated_by: "founder",
  used: false, used_at: ISO?, used_reason: "string?",
}`,
          indexes: ["{used:1}"],
        },
      ],
    },
    risks: [
      { id: "FG-R1", severity: "CRITICAL", title: "Founder pierde telefonul + acces email simultan → lockout total",
        mitigation: "Recovery codes offline (5 single-use printabile, păstrate în safe fizic). Backup: poate fi adăugat un al doilea founder/co-founder cu același nivel." },
      { id: "FG-R2", severity: "HIGH", title: "Twilio down → niciun SMS nu se trimite",
        mitigation: "Fallback automat: email TOTP via Google Authenticator + alert urgent founder. Monitoring Twilio uptime cu alert dacă <99%." },
      { id: "FG-R3", severity: "HIGH", title: "Admin secundar bypass via DB direct (modifică MongoDB cu mongocli)",
        mitigation: "Middleware verifică flag la fiecare request (nu cache). Audit cron orar care detectează modificări critice fără founder_decision corespunzător → alert email instant founder." },
      { id: "FG-R4", severity: "MEDIUM", title: "Token din email leak (founder forwardează din greșeală)",
        mitigation: "Token single-use + expiry 24h. Plus cod SMS care e canal separat — leak email singur nu permite execuție." },
      { id: "FG-R5", severity: "MEDIUM", title: "Lista acțiuni critice prea agresivă → fricționare admin daily ops",
        mitigation: "Lista minimă inițial (10 acțiuni). Adaugă doar după feedback. Niciodată acțiuni rutinăer (login, view, etc.)." },
      { id: "FG-R6", severity: "MEDIUM", title: "Agent AI 'inteligent' care încearcă să modifice gate-ul însuși",
        mitigation: "Modificarea registry-ului `critical_actions_registry` E EA O ACȚIUNE CRITICĂ — necesită aprobare founder. Recursive lock garantat." },
      { id: "FG-R7", severity: "LOW", title: "SMS costuri lunare cresc nesustenabil",
        mitigation: "Twilio Romania: ~0.04€/SMS. La 50 cereri/lună = 2€. La 500/lună (foarte agresiv) = 20€. Plafonat la 25€/lună budget în opex." },
      { id: "FG-R8", severity: "LOW", title: "Founder approves rapid fără să citească payload (clic reflex)",
        mitigation: "UI cere scroll obligatoriu pe payload preview + 3 sec delay înainte de buton activ. Email include preview clar al impactului." },
      { id: "FG-R9", severity: "CRITICAL", title: "Bug în middleware permite acțiunea fără verificare",
        mitigation: "Test suite 30+ scenarii + penetration test obligatoriu pre-deploy. Feature flag pentru rollback instant dacă apar false-positives." },
      { id: "FG-R10", severity: "LOW", title: "Founder deviane (vrea să acționeze rapid noaptea)",
        mitigation: "Recovery codes pentru emergencies. Plus 'pre-authorized actions' care permit acțiuni rutinăer fără aprobare (whitelist controlled de founder)." },
    ],
    ai: {
      philosophy: "AI NU primește excepție de la gate. Dacă AI vrea să modifice comision, șterge date, sau transfer ownership → INTRĂ ÎN QUEUE EXACT CA UN UMAN. Filozofie: 'cu cât AI e mai autonom, cu atât mai mult acest gate e necesar'.",
      touchpoints: [
        { title: "AI Action Risk Scorer", description: "AI scoring zilnic al acțiunilor admin recente — detectează pattern-uri suspecte care ar trebui adăugate în critical_actions_registry",
          reuse: "ai_core/provider.py + Claude Sonnet", phase: "Post FG-5" },
        { title: "Auto-draft approval emails", description: "Pentru acțiuni complexe, AI generează preview-ul în limbaj uman ('Această acțiune va șterge 1.234 înregistrări client din 2023')",
          reuse: "Same AI provider", phase: "FG-3" },
        { title: "Suspicious activity detector", description: "Detectează admin care încearcă să bypass gate-ul (multiple rejects, requests în afara orelor de lucru, IP-uri ciudate)",
          reuse: "Daily cron + email founder dacă scor > threshold", phase: "Post FG-5" },
      ],
    },
    revenueScenarios: [
      { name: "Prevenirea unei pierderi catastrofale", estimatedRevenue: "10.000 – 100.000€ (one-time)",
        description: "Un singur incident prevenit (ștergere accidentală 5000 clienți, schimbare comision la 50% de un admin compromis, transfer ownership fraudulos) acoperă investiția de zeci de ori." },
      { name: "Trust signal pentru investitori/parteneri", estimatedRevenue: "Indirect: +30% credibilitate",
        description: "Atunci când vorbești cu un investitor sau parteneri B2B, faptul că ai 2FA pe acțiunile critice e un signal de maturitate operațională. Util în due diligence." },
      { name: "Compliance pregătire (GDPR, ISO27001)", estimatedRevenue: "Habilitator certificări",
        description: "ISO 27001 cere control strict pe modificări critice. GDPR cere audit log imutabil. Acest gate îți dă ambele aproape gratuit." },
      { name: "Reducere costuri asigurare cyber",  estimatedRevenue: "10-20% reducere primă",
        description: "Asigurătorii cyber oferă discount pentru 2FA pe acțiuni critice + audit log. Pentru o companie cu cifră de afaceri >100k€, reducere 20% poate fi 500-2.000€/an." },
    ],
    breakEven: "Pe Emergent: 50-90 credite estimate. Comparativ freelance: 2.400€ teoretic (12 zile × 200€/zi). Opex lunar: 25€ (Twilio SMS + email). Break-even: nu se măsoară în venit direct (e protecție, nu monetizare), ci în RISK MITIGATION. Echivalent ROI: prevenirea unui singur incident major (ștergere accidentală, fraudă admin compromis, AI scăpat de sub control) acoperă investiția x100. Esențial dacă: (a) ai >2 admini, (b) folosești agent AI autonom, (c) scalezi spre platformă serioasă.",
    recommendation: "Recomandare: **PRIORITATE TOP**. Acest gate ar trebui implementat ÎNAINTEA oricărei alte propuneri majore (DS-ATLAS, MKT-V2, EXP-V2) pentru că orice viitoare modificare va beneficia de protecția lui. START cu FG-0 + FG-1 + FG-2 (6 zile, ~25-45 credite) — minimum viabil care îți dă deja 80% din protecție. Pentru întrebarea ta despre 'modificări care pot schimba major funcționalitatea aplicației': lista inițială pe care o propun: (1) modificare comision/pricing, (2) ștergere bulk colecții, (3) transfer ownership cont, (4) export GDPR >100 rânduri, (5) modificare admin roles, (6) deploy production cod cu impact business logic, (7) agent AI sugerează schimbare structurală, (8) modificare destinație Stripe, (9) dezactivare gate însuși. Tu poți edita lista oricând.",
  },

  // ==========================================================================
  // PROPUNERE 1 — EXPERIENCE SPACES V2 (existent)
  // ==========================================================================
  {
    id: "experience_spaces_v2",
    code: "EXP-V2",
    title: "Experience Spaces — Business Operating System",
    icon: Sparkles,
    risk: 5,
    riskExplanation: "Probabilitate ~50% de bug-uri minore (timezone DST, race conditions booking) ce se rezolvă în 1-2 task-uri. Funcțional 100%, NU înseamnă că doar 5/10 va merge.",
    timelineDays: 35,
    estCostEur: 7000,
    estOpexMonthly: 80,
    estRevenueMonthly: 3500,
    estRevenueRange: "1.500€ – 8.000€",
    emergentComplexity: "Ridicată",
    emergentEffort: "8-12 task-uri agent mari (foundation + spaces + bookings + payments + AI)",
    emergentCreditsEstimate: "150-250 credite estimate (full roadmap)",
    businessImpact: "Nou flux venit complet — primul spațiu pilot poate genera 1.500€/lună după 30 zile de la lansare",
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

  // ==========================================================================
  // PROPUNERE 2 — DESIGN SYSTEM UNIFICATION
  // ==========================================================================
  {
    id: "design_system_atlas",
    code: "DS-ATLAS",
    title: "Design System Unification — PropManage Atlas",
    icon: Palette,
    risk: 4,
    riskExplanation: "Surface area mare (~30+ pagini de re-stilizat) dar arhitectural izolabil prin feature flag CSS. Risc 4/10 = probabilitate ~40% de bug-uri vizuale minore (un buton offset, contrast text într-un edge case) ce se rezolvă în 1-2 task-uri Emergent. Backend INTACT, doar layer vizual.",
    timelineDays: 25,
    estCostEur: 5000,
    estOpexMonthly: 0,
    estRevenueMonthly: 0,
    estRevenueRange: "Indirect: +15% retenție",
    emergentComplexity: "Medie-Ridicată",
    emergentEffort: "5-8 task-uri agent mari (tokens + components shared + migrare per dashboard)",
    emergentCreditsEstimate: "80-140 credite estimate (full rebrand)",
    businessImpact: "Percepție profesionalism crescută → conversie home page +10-20%, retenție specialist +15% (UI consistent reduce frustrarea cross-dashboard)",
    summary: "Unificare design vizual pe TOATE dashboard-urile (Public/Home, Client, Specialist, Operator, Admin) folosind paletă mov-violet pe dark theme, tipografie consistentă, component library reutilizabilă. Backend ZERO impact — schimbare strict vizuală cu feature flag pentru rollback. Inspirat din PropManage.net (HomeRun Pro-style) cu 15+ pattern-uri identificate.",
    problemAndOpportunity: "Acum PropManage are 3 stiluri vizuale diferite: Client (light, vechi Tailwind), Specialist (semi-dark improvizat), Admin (Metronic light + AdminLayout dark amestecate). Inconsistența reduce percepția de calitate și forțează userii să re-învețe layout-ul la fiecare dashboard. Unificarea aduce: (1) UX coerent → retenție mai mare; (2) Mobile-first proper → 70%+ trafic vine de pe telefon; (3) Componentă reutilizabilă → orice feature nou se face de 3-5x mai rapid în viitor.",
    principles: [
      "ZERO modificări la business logic / backend — strict UI layer",
      "Feature flag `enable_design_v2` în `app_settings` pentru toggle instant rollback",
      "CSS variables shim — temele vechi + noi coexistă în paralel via `data-theme` attribute pe root",
      "Migrare pe etape: pagină cu pagină, fiecare validată independent",
      "Tokens centralizate în `tokens.css` — orice modificare ulterioară de culoare = 1 schimbare",
      "Component library în `/components/atlas/` (Button, Card, StatCard, Modal, Pipeline, etc.) — reutilizabile peste tot",
      "Mobile-first: layout-uri optimizate pentru 375-768px întâi, desktop e secundar",
      "Accessibility (WCAG AA): contraste verificate, focus rings vizibile, keyboard nav funcțional",
      "Storybook intern (Admin Design Lab) pentru preview componente fără atingerea producției",
    ],
    antiPatterns: [
      "NU rescrie business logic în paralel — schimbi DOAR JSX + CSS",
      "NU șterge clase Tailwind vechi imediat — coexistă cu cele noi prin flag până validare",
      "NU forța migrarea într-un singur sprint — risc maxim de regresii",
      "NU schimba structura DB / API pentru cosmetice (ex: rating display) — folosește date existente",
      "NU adăuga librării grele (Material UI, Chakra) — staying lean cu shadcn/ui existente",
    ],
    phases: [
      {
        code: "DS-0", title: "Foundation: Tokens + Theme Toggle", days: 2,
        description: "Setup paletă completă în CSS variables + feature flag + theme switcher în Admin.",
        deliverables: [
          "tokens.css cu paletă completă (40+ variabile)",
          "Feature flag `enable_design_v2` în `app_settings`",
          "Hook `useDesignTheme()` pentru detect + switch",
          "Admin toggle în Settings → Design Lab",
          "data-theme attribute pe root cu fallback la tema veche",
        ],
      },
      {
        code: "DS-1", title: "Component Library Core", days: 4,
        description: "Construire 15 componente reutilizabile în `/components/atlas/`.",
        deliverables: [
          "Button (primary mov solid, secondary outline, ghost)",
          "Card (default + colored variants per category)",
          "StatCard cu icon + counter mare + label",
          "Modal/Dialog cu border purple focus",
          "Tab pills + Filter dropdown",
          "Pipeline column (Kanban-style)",
          "Status badge color-coded",
          "Empty state friendly",
          "Notification rule card",
          "Section header cu icon decorativ",
          "Form inputs (Text, Select, Textarea, DatePicker)",
          "ProgressBar multi-stage (Friendly Reminder → Formal Demand → Legal)",
          "Avatar + Streak badge",
          "Greeting card hero",
          "List item interactive",
        ],
      },
      {
        code: "DS-2", title: "Public/Home Migration", days: 3,
        description: "Refacere landing page + pagini publice (servicii, specialiști).",
        deliverables: [
          "Home page redesign cu hero mov + CTA",
          "Pagina /servicii (listare sub-categorii)",
          "Pagina /servicii/{slug} (SEO-ready)",
          "Pagina profil public specialist",
          "Pagina recenzii publice",
          "Footer + Navbar unificat",
        ],
      },
      {
        code: "DS-3", title: "Client Dashboard Migration", days: 4,
        description: "Refacere completă dashboard client (postare cerere, oferte primite, chat).",
        deliverables: [
          "Hero greeting card",
          "StatCards: cereri active, oferte primite, finalizate",
          "Lista oferte primite cu cards uniforme",
          "Pagina detalii ofertă",
          "Form postare cerere multi-step",
          "Chat UI cu mesaje + atașamente",
        ],
      },
      {
        code: "DS-4", title: "Specialist Dashboard Migration", days: 5,
        description: "Refacere completă dashboard specialist (oportunități, oferte trimise, lucrări câștigate, profil).",
        deliverables: [
          "Hero greeting cu streak + rating",
          "StatCards specialist (oportunități noi, oferte active, câștigate, fee cheltuit)",
          "Lista oportunități cu cards (gated/unlocked states)",
          "Detail page oportunitate (2 stări vizuale)",
          "Form trimite ofertă cu preț propriu",
          "Tab Pipeline (Kanban: Oportunități → Ofertate → Câștigate)",
          "Tab Recenzii cu filtre",
          "Profil specialist editabil cu sub-categorii servicii",
          "Bottom nav mobile (Oportunități / Oferte / Câștigate / Setări)",
        ],
      },
      {
        code: "DS-5", title: "Operator Dashboard Migration", days: 3,
        description: "Refacere dashboard operator (jobs, twins, NC).",
        deliverables: [
          "Lista jobs operator unificată",
          "Detail job cu acțiuni (start/pause/finalize)",
          "Digital Twin viewer page",
          "Non-conformity report form",
        ],
      },
      {
        code: "DS-6", title: "Admin Dashboard Polish", days: 3,
        description: "Admin Metronic deja are stil propriu — aliniere doar la tokens noi + spacing.",
        deliverables: [
          "Sidebar Admin aliniat la noile tokens",
          "Cards Admin refăcute cu StatCard nou",
          "Tables Admin cu coloane consistente",
          "Modals Admin uniformizate",
        ],
      },
      {
        code: "DS-7", title: "Polish + A11y + Mobile Testing", days: 2,
        description: "Final pass — accessibility audit, mobile device testing, dark/light mode coerent.",
        deliverables: [
          "WCAG AA audit per pagină",
          "Test pe iPhone SE / iPhone 14 / Pixel / Android Galaxy",
          "Light mode opțional (pentru cei care preferă)",
          "Reduced motion fallback",
          "Print stylesheet pentru facturi",
        ],
      },
      {
        code: "DS-8", title: "Documentație + Storybook", days: 1,
        description: "Catalog complet componente în Admin → Design Lab pentru viitoare extensii.",
        deliverables: [
          "Pagină Admin /admin/design-lab cu toate componentele live",
          "Documentație props + variants per componentă",
          "Cheat-sheet design tokens (markdown export)",
        ],
      },
    ],
    backend: {
      structure: `/app/backend/  → ZERO modificări la business logic.
└── app_settings: adăugat câmp \`enable_design_v2: boolean\` (default false)
└── routes/app_settings.py: extins PUT endpoint să accepte flag-ul nou
└── NIMIC alt impact backend — design e PUR frontend`,
      endpoints: [
        { method: "GET",  path: "/api/app-settings",                     note: "Citește flag enable_design_v2" },
        { method: "PUT",  path: "/api/app-settings",                     note: "Admin toggle flag" },
      ],
      security: [
        "Flag-ul `enable_design_v2` e citit doar de frontend pentru theme switch",
        "Nu impactează permisiuni sau autentificare",
        "Rollback prin flag OFF → frontend re-randează cu tema veche în <1s",
      ],
      dependencies: [
        "# ZERO dependențe noi backend",
      ],
    },
    frontend: {
      structure: `/app/frontend/src/
├── styles/
│   ├── tokens.css           # Paletă + spacing + typography variables
│   ├── theme-legacy.css     # Stilurile vechi (păstrate până la validare)
│   └── theme-atlas.css      # Tema nouă Atlas
├── components/
│   ├── atlas/               # NEW component library
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── StatCard.jsx
│   │   ├── Modal.jsx
│   │   ├── Pipeline.jsx
│   │   ├── StatusBadge.jsx
│   │   ├── EmptyState.jsx
│   │   ├── GreetingHero.jsx
│   │   ├── StreakBadge.jsx
│   │   ├── BottomNav.jsx
│   │   └── ... (15 total)
│   └── ui/                  # shadcn existing — păstrate
├── hooks/
│   └── useDesignTheme.js   # Citește flag + aplică data-theme
└── pages/
    ├── HomeAtlas.jsx        # Versiune nouă, paralel cu Home.jsx existent
    ├── ClientDashboardAtlas.jsx
    ├── SpecialistDashboardAtlas.jsx
    └── ...
    (Atunci când flag e ON, App.js routează la versiunile *Atlas.jsx)`,
      routes: [
        { scope: "public", path: "/  (Atlas când flag ON)",            note: "Landing page rebrandat" },
        { scope: "public", path: "/servicii",                          note: "Listare sub-categorii SEO" },
        { scope: "public", path: "/specialisti/{slug}",                note: "Profil public specialist" },
        { scope: "auth",   path: "/client  (Atlas când flag ON)",      note: "Dashboard client nou" },
        { scope: "auth",   path: "/specialist  (Atlas când flag ON)",  note: "Dashboard specialist nou" },
        { scope: "auth",   path: "/operator  (Atlas când flag ON)",    note: "Dashboard operator nou" },
        { scope: "admin",  path: "/admin/design-lab",                  note: "Storybook intern componente" },
      ],
      designReuse: [
        "Paletă: Dark `#0a0a0b` background + Purple `#8b5cf6` primary + tints semantice",
        "Tipografie: Inter pentru body (deja existent), serif (existent) păstrat pentru hero-uri",
        "Spacing scale: 4px base (4, 8, 12, 16, 20, 24, 32, 48, 64)",
        "Border radius: 8px (small), 12px (default), 16px (large), 24px (xl pills)",
        "Shadows: subtle (0 1px 2px rgba(0,0,0,0.1)) + glow purple pentru focus",
        "Animations: 150ms ease pentru micro-interactions, 300ms pentru page transitions",
        "Icons: lucide-react existent (zero dependențe noi)",
      ],
      dependencies: [
        "# Zero dependențe noi — folosim shadcn + tailwind existente",
        "# Opțional: motion (deja instalat) pentru animații complexe",
      ],
    },
    db: {
      isolationRule: "ZERO modificări la database. Singura schimbare e UN SINGUR field nou în colecția existentă `app_settings`: `enable_design_v2: boolean` default false. NIMIC altceva atins.",
      collections: [
        {
          name: "app_settings (existing — extended)", purpose: "Adăugat 1 câmp boolean pentru flag rollback",
          schema: `{
  // Toate câmpurile existente NEATINSE...
  enable_design_v2: false,        // NEW — default OFF
  design_v2_pilot_users: [],      // NEW optional — gradual rollout
  design_v2_force_legacy: []      // NEW optional — userii care opt-out
}`,
          indexes: ["existing _id='config' unique (deja există)"],
        },
      ],
    },
    risks: [
      { id: "DS-R1", severity: "MEDIUM", title: "Regresie vizuală pe pagini neacoperite de testing",
        mitigation: "Screenshot regression tests pe rute principale înainte/după per fază. Feature flag instant OFF dacă apare bug critic." },
      { id: "DS-R2", severity: "LOW", title: "Performance hit din CSS extra (legacy + atlas în paralel)",
        mitigation: "CSS atlas e lazy-loaded doar când flag ON. Bundle size analyzer rulează la fiecare fază." },
      { id: "DS-R3", severity: "MEDIUM", title: "Mobile breakpoints nu sincronizate cu legacy",
        mitigation: "Mobile-first design impune breakpoint-uri unificate (375/640/768/1024). Test pe device real, nu doar DevTools." },
      { id: "DS-R4", severity: "LOW", title: "Tema veche/nouă switch causes flash of unstyled content",
        mitigation: "data-theme aplicat pre-hydration via inline <script> în <head>." },
      { id: "DS-R5", severity: "LOW", title: "Useri obișnuiți cu UI vechi se pierd",
        mitigation: "Rollout gradual: opt-in pilot users → 25% → 50% → 100%. Feedback widget per pagină în primele 14 zile." },
      { id: "DS-R6", severity: "MEDIUM", title: "Admin Metronic complex — risc rupere navigare",
        mitigation: "Admin migrate ULTIMUL (DS-6) doar după validare client+specialist+operator OK." },
      { id: "DS-R7", severity: "LOW", title: "Accessibility regressions (contraste, focus states)",
        mitigation: "WCAG AA audit automat (axe-core) în CI + pass manual pe screen reader." },
    ],
    ai: {
      philosophy: "Design System nu folosește AI direct — dar oferă o fundație componentă pentru viitoare AI widgets (chat bot, insight cards, smart filters) ce vor fi consistente vizual.",
      touchpoints: [
        { title: "AI Chat Widget (cross-dashboard)", description: "Floating action button cu chat overlay folosind tema unificată — același UI peste tot",
          reuse: "ai_core/provider.py existent", phase: "Post DS-8 (when AI features matter)" },
        { title: "Insight Cards animated", description: "Carduri cu insights AI prezentate uniform în toate dashboard-urile",
          reuse: "Atlas Card component", phase: "Post DS-8" },
      ],
    },
    revenueScenarios: [
      { name: "Conversie home page", estimatedRevenue: "+10-20% lead-uri postate",
        description: "Landing rebrandat → percepție mai profesională → mai mulți clienți postează cereri (de la 100 la ~115/lună la trafic constant)." },
      { name: "Retenție specialist", estimatedRevenue: "+15% LTV specialist",
        description: "UI consistent + mobile-first reduce frustrarea → specialiștii rămân activi mai mult, ofertează mai mult." },
      { name: "Time-to-feature 3-5x mai rapid", estimatedRevenue: "Indirect: -60% timp dev features noi",
        description: "Component library reutilizabilă → orice feature nou costă 3-5x mai puțin în task-uri Emergent." },
      { name: "Pregătire pentru white-label", estimatedRevenue: "Habilitator viitor (Experience Spaces ES-8)",
        description: "Cu design tokens centralizate, white-label per org devine trivial — schimbi 5 variabile CSS și ai brandul clientului." },
    ],
    breakEven: "Pe Emergent: 80-140 credite total estimate. Comparativ cu freelance: 5.000€ teoretic (25 zile × 200€/zi). Break-even NU se măsoară direct în €/lună (e investiție în calitate + viteză viitoare), ci în: (a) reducere churn specialist de la X% la Y%, (b) creștere conversie home cu 10-20%, (c) viitor: orice feature costă 3-5x mai puțin de dezvoltat în task-uri Emergent.",
    recommendation: "Recomandare: START cu DS-0 + DS-1 (6 zile, foundation + component library) — fără să atingi paginile existente. Apoi validare cu 1 pagină pilot (DS-2 Home) și măsurare impact ÎNAINTE de a continua cu Client/Specialist. Dacă DS-2 nu generează feedback pozitiv în 14 zile → STOP fără pierdere. Continuă DS-3 → DS-8 doar după validare pilot. Admin (DS-6) e ULTIMUL pentru că e cel mai stabil deja.",
  },

  // ==========================================================================
  // PROPUNERE 3 — MARKETPLACE ECONOMICS V2
  // ==========================================================================
  {
    id: "marketplace_economics_v2",
    code: "MKT-V2",
    title: "Marketplace Economics V2 — Fee Dinamic + Lead Gating",
    icon: Coins,
    risk: 5,
    riskExplanation: "Atinge gating informații client (telefon, adresă) + payment flow. Risc 5/10 = probabilitate 50% de bug-uri minore în primele 2 săptămâni (ex: un specialist vede telefon înainte de plată dacă URL-ul e ghicit). TOATE mitigările sunt server-side enforcement → bug-uri fixabile în 1 task. Funcțional 100%, doar trebuie testat riguros.",
    timelineDays: 15,
    estCostEur: 3000,
    estOpexMonthly: 5,
    estRevenueMonthly: 800,
    estRevenueRange: "300€ – 2.000€",
    emergentComplexity: "Medie",
    emergentEffort: "4-6 task-uri agent mari (DB + backend gating + frontend states + admin config)",
    emergentCreditsEstimate: "60-100 credite estimate",
    businessImpact: "Restartarea fluxului de venit marketplace care a stagnat în 2026 din cauza fee-urilor prea mari. Validat cu istoric real: în 2025 cu fee 5-50 RON ai cheltuit 2.500 RON și ai încasat 48.000 RON (ROI 19x). Cu fee dinamic 5-99 RON ne întoarcem la modelul care a funcționat.",
    summary: "Corectarea modelului economic marketplace: (1) Fee dinamic per lead 5-99 RON configurabil din Admin (acum confuzul \"Estimat 11000 RON\" + fix 45 RON); (2) Gating informații client — specialistul vede DOAR oraș + prenume + descriere până plătește fee-ul, după care primește telefon + nume complet + adresă + chat; (3) Limită 5 ofertanți/cerere pentru calitate; (4) Sub-categorii servicii pentru SEO indexabil; (5) Pipeline vizual (Oportunități → Ofertate → Câștigate). Bazat pe modelul validat HomeRun Pro și pe istoricul tău real de 1+ an pe acea platformă.",
    problemAndOpportunity: "PROBLEMA: PropManage actual are 3 confuzii majore: (a) UI specialist arată \"Estimat 11000 RON\" și \"Acceptă (45 RON)\" — utilizatorii nu înțeleg cine plătește ce; (b) Fee fix 45 RON pentru toate lead-urile descurajează ofertare la lead-uri mici; (c) Nu există gating — specialistul vede tot din primul moment, nu are motivație să plătească. OPORTUNITATEA: Modelul HomeRun Pro (fee dinamic 5-99 RON + gating strict) e validat de 1+ an de utilizatorul nostru pilot — în 2025 a generat ROI 19x. Replicarea modelului în PropManage cu adaptările necesare = retenție specialist + venit constant marketplace.",
    principles: [
      "Server-side enforcement strict — toate datele sensibile (telefon, adresă, nume complet) sunt FILTRATE din API până nu există un `lead_unlock` valid",
      "Fee dinamic configurabil din Admin Panel — reguli per categorie × oraș × buget client",
      "Limită max 5 ofertanți / cerere — protejează calitatea și concurența sănătoasă",
      "Wallet opțional pentru specialist (pre-paid credits) — alternativă la plata per lead Stripe",
      "Sub-categorii servicii cu slug-uri unice (`/servicii/design-interior-baie-cluj`) pentru SEO long-tail",
      "Eliminare totală a câmpului \"Estimat XXX RON\" din UI specialist (e formulă internă admin, nu relevant pentru flow)",
      "Notificare clientului când un specialist a plătit accesul (transparency + trust)",
      "Buton call-to-action clar: \"Trimite oferta (XX RON)\" în loc de \"Acceptă (45 RON)\" — denotă intenția",
    ],
    antiPatterns: [
      "NU expune nicio informație sensibilă în răspunsul API înainte de unlock — chiar dacă frontend-ul o filtrează",
      "NU permite acces la chat / telefon prin URL guessing — toate endpoint-urile verifică unlock",
      "NU permite refund automat fee dacă clientul nu răspunde — politica trebuie clarificată în T&C",
      "NU adăuga taxe ascunse — fee-ul afișat e fee-ul plătit, fără surprize",
      "NU permite re-deblocare gratuită dacă specialistul a plătit deja o dată (per lead) — un fee = un acces permanent",
    ],
    phases: [
      {
        code: "MKT-0", title: "Foundation: DB + Config", days: 2,
        description: "Scheme DB noi + admin config feature flag.",
        deliverables: [
          "Collection `lead_unlocks` cu unique index pe (specialist_id, request_id)",
          "Collection `lead_pricing_rules` cu reguli admin",
          "Field `max_offers` pe request (default 5)",
          "Feature flag `enable_marketplace_v2` în `app_settings`",
          "Admin UI pentru configurare fee dinamic (sliders min/max + reguli)",
        ],
      },
      {
        code: "MKT-1", title: "Backend Gating", days: 3,
        description: "API security — toate datele sensibile filtrate până la unlock.",
        deliverables: [
          "Helper `is_unlocked(specialist_id, request_id)` reutilizabil",
          "Modify GET /api/requests/{id} → ascunde telefon, adresă, nume complet dacă !unlocked",
          "Modify GET /api/requests/list specialist view → arată DOAR oraș + prenume + descriere scurtă",
          "Endpoint POST /api/leads/{id}/unlock → consume fee, crează unlock record",
          "Endpoint blocking pe chat/call → 403 dacă !unlocked",
          "Endpoint GET /api/leads/{id}/offer-count → returnează count (pentru limită 5)",
        ],
      },
      {
        code: "MKT-2", title: "Fee Dinamic Engine", days: 2,
        description: "Algoritm calcul fee per lead + admin tools.",
        deliverables: [
          "Funcție `compute_lead_fee(request)` ce aplică reguli + categorii + oraș",
          "Admin UI: tabel reguli cu categorie/oraș/buget → fee min-max",
          "Preview live în Admin: \"Pentru această cerere fee-ul ar fi 23 RON\"",
          "Activity log pentru orice schimbare reguli (audit)",
        ],
      },
      {
        code: "MKT-3", title: "Frontend Specialist — Lead States", days: 3,
        description: "UI specialist cu 2 stări vizuale (gated vs unlocked).",
        deliverables: [
          "Lista oportunități: card minimal (oraș + prenume + tag-uri + fee dinamic)",
          "Detail page state \"gated\": briefing scurt + CTA \"Trimite oferta (XX RON)\"",
          "Detail page state \"unlocked\": nume complet, telefon clickable, adresă, chat link",
          "Form ofertare cu preț propriu (NU estimat sistem)",
          "Eliminare totală \"Estimat XXX RON\" din UI specialist",
          "Indicator \"3/5 specialiști au ofertat deja\" pentru urgență",
        ],
      },
      {
        code: "MKT-4", title: "Sub-categorii Servicii + SEO", days: 3,
        description: "Granular services + indexare publică Google.",
        deliverables: [
          "Collection `specialist_services` ierarhică (parent + child slug)",
          "Admin UI pentru gestionare sub-categorii globale",
          "Pagini publice `/servicii/{slug}` + `/servicii/{slug}/{oras}`",
          "Schema.org JSON-LD markup (Service, LocalBusiness, AggregateRating)",
          "Sitemap.xml dinamic generat din servicii × orașe active",
          "Meta tags Open Graph + Twitter cards per pagină",
        ],
      },
      {
        code: "MKT-5", title: "Pipeline + Tab Câștigate", days: 2,
        description: "Vizualizare Kanban pentru specialist + tab oferte câștigate.",
        deliverables: [
          "Tab Oportunități: lista activă",
          "Tab Ofertate: oferte trimise (cu fee plătit) — așteptând răspuns client",
          "Tab Câștigate: lucrări unde clientul a acceptat (nume + telefon + mesaj original)",
          "Tab Setări: profil + sub-categorii + tarife",
          "Bottom nav mobile (cu icoane + badge count)",
        ],
      },
    ],
    backend: {
      structure: `/app/backend/
├── routes/
│   ├── leads_v2.py            # NEW: gating + unlock + pricing
│   ├── lead_pricing_rules.py  # NEW: admin config fee dinamic
│   └── (existing requests.py NEATINS — doar query updates)
├── helpers/
│   ├── lead_gating.py         # NEW: is_unlocked() + filter_sensitive_fields()
│   └── fee_calculator.py      # NEW: compute_lead_fee()
└── models/
    ├── lead_unlock.py         # NEW model
    └── lead_pricing_rule.py   # NEW model`,
      endpoints: [
        { method: "GET",  path: "/api/leads",                              note: "Lista oportunități (gated)" },
        { method: "GET",  path: "/api/leads/{id}",                         note: "Detail lead (filtered if !unlocked)" },
        { method: "POST", path: "/api/leads/{id}/unlock",                  note: "Plătește fee + deblochează" },
        { method: "POST", path: "/api/leads/{id}/offer",                   note: "Trimite oferta (consumă unlock dacă nu există)" },
        { method: "GET",  path: "/api/leads/{id}/offer-count",             note: "Returnează count ofertanți pentru limită 5" },
        { method: "GET",  path: "/api/admin/lead-pricing-rules",           note: "Lista reguli fee dinamic" },
        { method: "POST", path: "/api/admin/lead-pricing-rules",           note: "Creează regulă" },
        { method: "PUT",  path: "/api/admin/lead-pricing-rules/{id}",      note: "Update regulă" },
        { method: "POST", path: "/api/admin/lead-pricing-rules/preview",   note: "Preview fee pentru request mock" },
        { method: "GET",  path: "/api/specialist-services",                note: "Listă sub-categorii ierarhice" },
        { method: "GET",  path: "/api/public/services/{slug}",             note: "Pagină publică SEO" },
        { method: "GET",  path: "/sitemap.xml",                            note: "Sitemap dinamic" },
      ],
      security: [
        "Helper `filter_sensitive_fields()` aplicat în TOATE răspunsurile API care includ lead data",
        "Unlock record imutabil — nu se șterge niciodată (audit trail)",
        "Rate limit 10 unlock/oră/specialist pentru a preveni abuz",
        "Stripe webhook → la succes payment, crează unlock atomic",
        "Verificare offer_count < max_offers înainte de a permite ofertare nouă",
      ],
      dependencies: [
        "# ZERO dependențe noi — reuse stripe, motor, pydantic",
      ],
    },
    frontend: {
      structure: `/app/frontend/src/
├── pages/
│   ├── specialist/
│   │   ├── OpportunitiesList.jsx     # gated cards
│   │   ├── OpportunityDetail.jsx     # 2 states (gated/unlocked)
│   │   ├── OffersSubmitted.jsx       # tab oferte trimise
│   │   ├── OffersWon.jsx             # tab câștigate
│   │   └── SpecialistProfile.jsx     # sub-categorii editor
│   ├── public/
│   │   ├── ServicesIndex.jsx         # /servicii
│   │   ├── ServiceDetail.jsx         # /servicii/{slug}
│   │   └── ServiceByCity.jsx         # /servicii/{slug}/{oras}
│   └── admin/
│       ├── LeadPricingRules.jsx      # config fee dinamic
│       └── SpecialistServicesAdmin.jsx
└── components/
    ├── LeadCardGated.jsx
    ├── LeadCardUnlocked.jsx
    ├── OfferForm.jsx
    └── PipelineTabs.jsx`,
      routes: [
        { scope: "auth",   path: "/specialist/oportunitati",            note: "Lista gated" },
        { scope: "auth",   path: "/specialist/oportunitati/{id}",       note: "Detail (gated/unlocked)" },
        { scope: "auth",   path: "/specialist/ofertate",                note: "Tab oferte trimise" },
        { scope: "auth",   path: "/specialist/castigate",               note: "Tab câștigate" },
        { scope: "public", path: "/servicii",                           note: "SEO index" },
        { scope: "public", path: "/servicii/{slug}",                    note: "SEO categorie" },
        { scope: "public", path: "/servicii/{slug}/{oras}",             note: "SEO long-tail" },
        { scope: "admin",  path: "/admin/lead-pricing",                 note: "Config fee dinamic" },
      ],
      designReuse: [
        "Toate componentele folosesc Atlas (Propunerea DS-ATLAS) — dacă DS-ATLAS nu e aprobat, fallback la shadcn existent",
        "Status badges color-coded (verde unlock plătit, galben pending, roșu expirat)",
        "Kanban pipeline reuse din Atlas Pipeline component",
        "Empty state friendly pentru tab-uri goale",
      ],
      dependencies: [
        "# Zero dependențe noi",
      ],
    },
    db: {
      isolationRule: "2 colecții noi (`lead_unlocks`, `lead_pricing_rules`, `specialist_services`) + 1 câmp nou pe `requests` (`max_offers`). Modulele existente intacte. Rollback prin feature flag → nicio operație nouă pe colecțiile noi.",
      collections: [
        {
          name: "lead_unlocks", purpose: "Tracking deblocări fee plătit per specialist × lead",
          schema: `{
  _id: ObjectId, id: "uuid",
  specialist_id: "uuid",
  request_id: "uuid",
  amount_paid: 23.50,           // RON
  currency: "RON",
  payment_method: "stripe|wallet|free_credit",
  stripe_payment_intent_id: "string?",
  unlocked_at: ISO,
  expires_at: null,             // unlock permanent
  status: "active|refunded"
}`,
          indexes: [
            "{specialist_id:1, request_id:1} unique",
            "{request_id:1} pentru offer_count queries",
          ],
        },
        {
          name: "lead_pricing_rules", purpose: "Reguli admin pentru fee dinamic",
          schema: `{
  _id, id, name: "Design Interior Cluj high-tier",
  active: true,
  match: {
    category_slug: "design-interior",
    sub_category_slug: "design-interior-baie",
    city: "Cluj-Napoca",
    budget_min_ron: 5000,
    budget_max_ron: null
  },
  fee_min_ron: 25, fee_max_ron: 45,
  fee_strategy: "demand_based|fixed|tier_based",
  priority: 100,                // higher = applied first
  created_at, updated_at
}`,
          indexes: ["{active:1, priority:-1}"],
        },
        {
          name: "specialist_services", purpose: "Sub-categorii servicii ierarhice (SEO)",
          schema: `{
  _id, id, parent_id: "uuid?",  // null = root
  name: "Design Interior Baie",
  slug: "design-interior-baie",
  full_slug: "design-interior/design-interior-baie",
  description_md, icon,
  meta_title, meta_description,
  active: true, sort_order: 0,
  created_at, updated_at
}`,
          indexes: ["{slug:1} unique", "{parent_id:1, sort_order:1}"],
        },
      ],
    },
    risks: [
      { id: "MKT-R1", severity: "CRITICAL", title: "Data leak — specialist vede telefon înainte de plată",
        mitigation: "Server-side `filter_sensitive_fields()` în TOATE endpoint-urile + integration tests cu 20+ scenarii de bypass. Audit penetration test." },
      { id: "MKT-R2", severity: "HIGH", title: "Specialist exploit — plătește fee, primește refund automat, păstrează accesul",
        mitigation: "Refund manual doar admin (nu automat). Unlock record imutabil. Stripe webhook idempotent." },
      { id: "MKT-R3", severity: "MEDIUM", title: "Limita 5 ofertanți creează race condition (6 plătesc simultan)",
        mitigation: "MongoDB transaction atomic — check_count + insert într-o singură operație. Test cu 50+ POST concurent." },
      { id: "MKT-R4", severity: "MEDIUM", title: "Fee dinamic prea agresiv → specialiști pleacă",
        mitigation: "A/B test cu 50% useri pe fee dinamic vs fix. Dashboard admin cu metrici: cheltuit/încasat per specialist, churn rate." },
      { id: "MKT-R5", severity: "LOW", title: "Sub-categorii prea granulare → trafic SEO diluat",
        mitigation: "Start cu 10-15 sub-categorii bazate pe analytics existente. Add gradual based pe search volume." },
      { id: "MKT-R6", severity: "MEDIUM", title: "Clientul nu răspunde după ce specialistul a plătit → frustrare",
        mitigation: "Notificare email/SMS automat clientului când primește prima ofertă. Politică: dacă clientul nu răspunde în 7 zile, refund credit." },
      { id: "MKT-R7", severity: "LOW", title: "Buton ambiguu \"Trimite oferta (XX RON)\" — userii cred că trimit XX RON la client",
        mitigation: "Tooltip explicativ + modal confirmare cu breakdown: \"Plătești XX RON acces. Clientul plătește separat pentru serviciul tău.\"" },
    ],
    ai: {
      philosophy: "AI ajută la calibrare fee dinamic (suggest pricing optim) și la detectare abuz. Nu execută acțiuni singur, doar recomandări pentru admin.",
      touchpoints: [
        { title: "Fee Calibration AI", description: "Zilnic AI analizează: leads ofertate/leads disponibile per categorie/oraș, sugerează ajustări fee min-max",
          reuse: "ai_core/provider.py + Claude Sonnet", phase: "Post MKT-3" },
        { title: "Abuse Detection", description: "Detectează pattern-uri suspecte (specialist unlock-uri masive fără ofertare, refund spam)",
          reuse: "Same ai_core, daily cron", phase: "Post MKT-2" },
        { title: "Smart Lead Matching", description: "Pentru un specialist nou, AI sugerează primele 5 lead-uri cu fit maxim",
          reuse: "Reuse existing matching engine", phase: "Optional MKT-6" },
      ],
    },
    revenueScenarios: [
      { name: "Restart marketplace activ", estimatedRevenue: "300€ – 800€/lună din fee-uri specialist",
        description: "Cu fee dinamic 5-99 RON, estimate 100-300 unlock-uri/lună × 10-25 RON mediu = 1.500-7.500 RON ≈ 300-1.500€." },
      { name: "Retenție specialiști existenți", estimatedRevenue: "+25% LTV per specialist",
        description: "Specialiștii care au cheltuit 2.500 RON/an în 2025 (ROI 19x) vor reveni dacă fee-ul scade înapoi la nivel sustenabil." },
      { name: "Trafic SEO long-tail", estimatedRevenue: "+500-2.000€/lună indirect prin lead-uri organice",
        description: "Pagini /servicii/design-interior-baie-cluj captează căutări Google specifice. La 50 lead-uri organice/lună × 30 RON fee = 1.500 RON/lună." },
      { name: "Conversie crescută (transparency)", estimatedRevenue: "+15% rate specialist→ofertare",
        description: "Specialiștii înțeleg clar ce plătesc și ce primesc → mai puțin abandon, mai multă ofertare." },
    ],
    breakEven: "Pe Emergent: 60-100 credite total estimate. Comparativ freelance: 3.000€ teoretic (15 zile × 200€/zi). Break-even la primele ~50 unlock-uri (estimate 2-4 săptămâni după lansare dacă marketing-ul către specialiști vechi funcționează). Payback complet: 2-3 luni. ROI compus pe termen lung prin SEO + retenție.",
    recommendation: "Recomandare: START cu MKT-0 + MKT-1 + MKT-2 (7 zile, foundation + gating + fee dinamic) — minimul viabil pentru a corecta confuzia actuală. Validare cu 5-10 specialiști vechi (care au activ în 2025) că vor să revină cu noul model. Doar după feedback pozitiv, continui MKT-3 → MKT-5 (UI + pipeline + SEO). MKT-4 (SEO sub-categorii) poate fi paralelizat cu DS-ATLAS dacă acea propunere e aprobată.",
  },
];

