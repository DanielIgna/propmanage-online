# PropManage — Ghid Testare Progressive Disclosure (Faza 86+)

> **Scop**: testezi în preview cele 4 niveluri de tier (Junior, Regular, Verified, Pro) pentru CLIENT și SPECIALIST. Vezi UI-ul diferit, banner-ul de promovare și uneltele care apar/dispar.

---

## 🎯 Înainte să începi

**Conturi de test** (vezi `/app/memory/test_credentials.md`):
- **Client**: `client@propmanage.io` / `Client123!`
- **Specialist**: `specialist@propmanage.io` / `Specialist123!`
- **Admin**: `admin@propmanage.io` / `Admin123!`

**Unde testezi**: în preview (`*.preview.emergentagent.com`), NU în producție.

---

## 📋 Test Plan — 8 scenarii

### TEST 1 — Junior: UI minimalist (Client)

**Pași**:
1. Login admin → `/admin/experience-tiers` → tab Useri
2. Găsește `client@propmanage.io` → click **Override** → tier=`junior` → check **Lock** → Submit
3. Logout admin → login `client@propmanage.io`
4. Du-te pe Dashboard (tab "Solicită serviciu")

**Ce trebuie să vezi**:
- ✅ Badge mic **JUNIOR** în header lângă email (gri stone)
- ✅ Panel "Unelte avansate" — **0 unelte deblocate**, secțiuni **Regular**, **Verified**, **Pro** cu lacăt
- ✅ Mesaj footer: "Promovarea la următorul nivel se face automat..."

**Ce NU trebuie să vezi**:
- ❌ Banner de promovare (n-ai fost promovat în această sesiune)

---

### TEST 2 — Regular: deblochezi 4 unelte (Client)

**Pași**:
1. Login admin → `/admin/experience-tiers` → tab Useri
2. `client@propmanage.io` → **Override** → tier=`regular` → **uncheck Lock** → Submit
3. Logout admin → login `client@propmanage.io`

**Ce trebuie să vezi**:
- ✅ **Banner color albastru** sus pe dashboard: "🎉 Felicitări! Ai fost promovat la Regular"
- ✅ Chips în banner: **Filtre avansate, Căutări salvate, Șabloane cereri, Vedere comparativă, Email sumar săptămânal**
- ✅ Badge **REGULAR** în header (albastru)
- ✅ Panel "Unelte avansate" — **4 unelte deblocate** (Filtre avansate, Căutări salvate, Șabloane cereri, Comparare oferte), secțiunile Verified/Pro încă blocate
- ✅ Email primit de `client@propmanage.io` cu subiectul "🎉 Ai fost promovat la Regular pe PropManage" (verifică inbox-ul Resend)

**Click pe orice unealtă deblocată**: apare alert demo "🎯 [nume] — În produsul final, această acțiune va deschide funcția..."

**Click pe X la banner** → banner dispare → reîncarci pagina → banner-ul NU revine (e dismissed permanent).

---

### TEST 3 — Verified: deblochezi 8 unelte (Client)

**Pași**:
1. Login admin → `/admin/experience-tiers` → tab Useri → `client@propmanage.io` → Override → tier=`verified` → Submit
2. Login client

**Ce trebuie să vezi**:
- ✅ **Banner verde-smarald** "Promovat la Verified" cu chips: **Operațiuni în masă, Analize avansate, Matching prioritar, Notificări personalizate, Export date**
- ✅ Badge **VERIFIED** în header (verde)
- ✅ Panel "Unelte avansate" — **8 unelte deblocate**, secțiunea Pro încă blocată
- ✅ Email nou primit cu subiect "Promovat la Verified"

---

### TEST 4 — Pro: toate uneltele deblocate (Client)

**Pași**:
1. Override → tier=`pro` → Submit
2. Login client

**Ce trebuie să vezi**:
- ✅ **Banner violet** "Promovat la Pro"
- ✅ Badge **PRO** în header (violet)
- ✅ Panel "Unelte avansate" — **TOATE 10 unelte deblocate**
- ✅ Mesaj final: "🎉 Felicitări — ai deblocat toate uneltele disponibile la nivelul Pro."

---

### TEST 5-8 — Repetă pentru SPECIALIST

Folosește contul `specialist@propmanage.io` cu pașii identici.

**Diferențe la UI specialist**:
- Uneltele sunt **business-focused** (nu client-focused): "Filtre avansate oportunități", "Aplicare în masă", "Analytics business", "Matching prioritar", "Export raport venituri", "Rapoarte white-label"
- Banner-ul apare deasupra "Cont neverificat" (dacă specialistul e neverificat)
- Tab-ul curent default e "Oportunități" — acolo apare TierToolsPanel

---

## 🛡️ Test de siguranță — confirmare zero impact

**Pași**:
1. Login `client@propmanage.io` la orice tier
2. Creează o cerere nouă (flux normal)
3. Vezi proprietățile, design-ul, twin viewer-ul

**Verifică**: tot funcționează exact ca înainte. TierToolsPanel e EXTRA, NU înlocuiește nimic.

---

## 🔄 Reset complet după testare

```
Login admin → /admin/experience-tiers → tab Useri
Pentru fiecare cont de test:
  → Override → tier="junior" → uncheck Lock → Submit
```

Sau prin curl:
```bash
curl -X POST $API_URL/api/admin/experience-tiers/users/{user_id}/override \
  -H "Content-Type: application/json" -b cookies.txt \
  -d '{"tier":"junior","reason":"reset","lock":false}'
```

---

## 📊 Analiză pre-deploy (checklist înainte de a apăsa "Deploy" în Emergent)

### A. Modificări vizibile pentru useri în producție

| Modificare | Cine vede | Impact |
|------------|-----------|--------|
| Badge tier în header dashboard | Toți userii (client + specialist) | Doar vizual, neclickabil |
| Panel "Unelte avansate" (Dashboard) | Toți userii (client tab "Solicită" + specialist tab "Oportunități") | Toate uneltele sunt **DEMO** (alert) — nu modifică nimic |
| Banner "Felicitări promovat" | Userii care SUNT promovați (Junior→Regular auto la 7 zile + 3 acțiuni) | Util, dismissible |
| Email tier-up | Userii promovați | Util, branded |
| Notificare in-app tier-up | Userii promovați | Util |

### B. Module noi pentru admin (toate la `/admin/*`)

- `/admin/operating-manual` — manual de operare
- `/admin/architecture-board` — review board pentru idei noi
- `/admin/ai-pm` — AI Product Manager
- `/admin/bug-memory` — Bug Memory Aggregator
- `/admin/experience-tiers` — management tier-uri
- AI Governance Center extins (Health, Permissions, Deprecation Plan, Pulse)

### C. Sisteme automate noi (cron-uri)

| Cron | Schedule | Ce face | Cum oprești |
|------|----------|---------|-------------|
| Deprecation Pulse | Joi 09:30 | Email digest agenți depreciati | Admin → AI Gov → Pulse → toggle Off |
| Experience Tier Promotion | Zilnic 03:30 | Auto-promovare useri eligibili | Admin → Experience Tiers → Configurare → toggle Off |

### D. Date noi în baza de date

| Câmp/Colecție nouă | Pe cine | Scop |
|-------------------|---------|------|
| `users.experience_tier` | Toți userii (client+specialist) | "junior" default pentru cei vechi |
| `users.experience_tier_locked` | Toți | false default — auto-promotion permise |
| `users.tier_celebration_pending` | Doar userii promovați | Banner pending |
| Collection `ai_agent_deprecations` | Doar admin acțiuni | Deprecation tracking |
| Collection `architecture_reviews` | Doar admin acțiuni | Review history |
| Collection `ai_pm_breakdowns` | Doar admin acțiuni | AI PM history |
| Collection `experience_tier_config` | Singleton "config" | Praguri promovare |
| Collection `experience_tier_history` | Toți userii (audit) | Cine, când, de la → la |
| Collection `deprecation_pulse_config` + `_history` | Singleton + logs | Pulse config + delivery log |

### E. Verificări înainte de Deploy

- [ ] **Test pas-cu-pas în preview** (cele 4 tier-uri Client + 4 Specialist conform planului de mai sus)
- [ ] **Verifică /admin/experience-tiers/config** — `enabled=true`, criterii implicite OK pentru tine
- [ ] **Configurează Deprecation Pulse** cu email-ul tău (Admin → AI Gov → Pulse → adaugă recipient + Activ + Salvează)
- [ ] **Testează un email pulse "Send now"** — verifică inbox
- [ ] **Verifică /admin/founder-gate** — `enable_founder_gate = false` (CORECT, NU activa)
- [ ] **Citește cap 1, 2, 13 din /admin/operating-manual** — principii siguranță + Smart Pipeline + cheat-sheet
- [ ] **Snapshot inainte de deploy**: `/admin/snapshots` → "Crează snapshot acum"

### F. Plan de rollback dacă ceva nu e ok în producție

| Problemă | Soluție |
|----------|---------|
| Banner tier celebration nu apare | Verifică `/api/me/tier-celebration` returnează pending. Dacă da, cache browser. Hard refresh. |
| User raportează "lipsesc butoane" | Verifică tier-ul lui în Admin. Dacă e junior, e normal — UI minimalist intenționat. Override la regular dacă necesar. |
| Cron promotion promovează prea agresiv | Admin → Experience Tiers → Configurare → Dezactivează. Criteriile actuale stau, cron oprește. |
| Email-uri spam | Admin → Experience Tiers → Configurare → Dezactivează cron-ul. Userii deja promovați nu mai primesc emails (acela e o singură dată per promovare). |
| Bug major neașteptat | Folosește butonul **"Rollback"** din Emergent platform (gratis, nu consumă credite) → selectează checkpoint anterior. |

### G. Ce să NU faci la deploy

- ❌ Nu activa `enable_founder_gate=true` (Twilio nu e integrat)
- ❌ Nu schimba praguri tier mai stricte fără să vezi impactul în dry-run
- ❌ Nu șterge nimic din `/admin/snapshots` (sunt plasă de siguranță)
- ❌ Nu modifica direct câmpuri în Mongo — folosește endpoint-urile admin

---

## ✅ Concluzie

**Sistemul Progressive Disclosure este READY** după ce confirmi pașii TEST 1-8 în preview.

Modificările sunt:
- **100% non-distructive** — nu se șterge cod existent, doar se adaugă
- **Reversibile** — orice override e undo-abil
- **Gradual** — cronu-ul promovează automat, nu există "big bang"
- **Auditabile** — fiecare promovare e logged în `experience_tier_history`

Pas final: când testele trec, apasă **"Deploy"** în Emergent.

---

*Ghid versiune 1.0 — Feb 12, 2026. Test plan generat după Phase 86.*
