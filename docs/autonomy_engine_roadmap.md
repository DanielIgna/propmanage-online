# 🤖 AI AUTONOMY ENGINE — Roadmap de Implementare

> **Scop**: Construirea unui sistem care măsoară, monitorizează și crește autonomia platformei PropManage spre target-ul de **90% operațional / 80% tehnic**, fără a sparge arhitectura existentă.

> **Regulă de aur**: Zero conflicte, rollback safety, MongoDB peste tot (no Postgres/Qdrant — am confirmat cu utilizatorul în 2 sesiuni consecutive pentru a evita crash-uri pe K8s și duplicare de date).

---

## 📐 Principii Arhitecturale (NEGOCIABILE)

| Principiu | De ce |
|---|---|
| **MongoDB only** | Evită overhead operațional (Postgres + Qdrant ar însemna 3 baze de date paralele). MongoDB are full-text search + vector search (Atlas) suficient pentru RAG. |
| **READ-ONLY agents** | Niciun agent nu execută modificări fără aprobare umană. Conform Deployment Safety Pipeline. |
| **Snapshots înainte de orice schimbare** | `app_settings_snapshots` deja există; extindem pattern-ul pentru orice modul nou. |
| **Provider-agnostic LLM** | `ai_core/provider.py` deja abstractizează Claude/OpenAI/Gemini/Ollama. Refolosim. |
| **Feature flags** | Fiecare modul nou intră cu un toggle în `app_settings`. Dacă crapă, îl dezactivăm fără deploy. |
| **Zero breaking change** | Toate API-urile noi sunt `/api/admin/autonomy/*` — nu atingem rute existente. |

---

## 🧮 Modelul Autonomy Score

### Sub-scoruri (0–100)

| Sub-scor | Pondere în General | Sursă date (existente) |
|---|---|---|
| **Operational** | 30% | `requests` (% auto-matched), `warranty_holds` (% auto-released), `preset_schedules` (% succes), `demo_reset` |
| **Technical** | 25% | `/api/admin/healthcheck` (% probe-uri OK), `/api/admin/smoketest` (pass rate 7 zile), snapshot freshness |
| **Security** | 20% | `auth_health` (% login success), `ai_security_findings` (open/resolved ratio), GDPR compliance |
| **Dev** | 10% | `weekly_release_gate` (pass rate), `dev_velocity` (PRs/săptămână), `ai_dev_team` findings resolved % |
| **AI** | 15% | `ai_effectiveness` (existent), `repair_effectiveness`, `qa_copilot` resolved findings |

### General Autonomy
```
general = 0.30*op + 0.25*tech + 0.20*sec + 0.10*dev + 0.15*ai
```

### Targets (vizibile în UI)
- 🔴 < 50: "Manual" — necesită intervenție umană constantă
- 🟡 50–75: "Assisted" — uman supervizează, AI sugerează
- 🟢 75–90: "Autonomous" — AI execută, uman doar aprobă
- 🟣 > 90: "Self-driving" — AI execută + monitorizează singur

---

## 🗂️ Schema MongoDB (Nouă)

### `autonomy_snapshots`
```json
{
  "_id": ObjectId,
  "snap_id": "uuid",
  "timestamp": "2026-02-15T03:00:00Z",
  "scores": {
    "general": 72.3,
    "operational": 85.0,
    "technical": 68.0,
    "security": 78.5,
    "dev": 60.0,
    "ai": 71.0
  },
  "breakdown": {
    "operational": {
      "auto_matched_requests_pct": 82,
      "auto_released_warranty_pct": 95,
      "preset_schedules_success_pct": 88,
      "weight_used": 0.30
    },
    "technical": { ... },
    ...
  },
  "recommendations": [
    { "area": "dev", "action": "Crește release gate pass rate (acum 60%)", "impact_pct": 8 }
  ]
}
```

### `autonomy_targets` (config-uri admin)
```json
{
  "_id": ObjectId,
  "target_general": 90,
  "target_operational": 95,
  "target_technical": 85,
  "weights": { "operational": 0.30, ... },
  "updated_at": "...",
  "updated_by": "admin_id"
}
```

---

## 🚀 Fazele de Implementare (Iterative & Safe)

### **FAZA A1: Compute Engine (Backend, izolat)** — 1 sprint
**Fișiere noi**:
- `/app/backend/autonomy/` (modul nou, complet izolat)
  - `__init__.py`
  - `engine.py` → `compute_autonomy_scores()` + sub-funcții per sub-scor
  - `recommendations.py` → generează sugestii pe baza gap-urilor

**API nou**:
- `GET /api/admin/autonomy/score` → calculează live (cu cache 5 min)
- `GET /api/admin/autonomy/breakdown` → detalii pe sub-scoruri
- `GET /api/admin/autonomy/history?days=30` → trend

**Test**:
- Unit test pe `compute_autonomy_scores()` cu fixtures MongoDB
- `curl` la endpoint → verifică structura JSON

**Rollback safety**: 
- Modul izolat în `/app/backend/autonomy/`. Dacă crapă, ștergem doar acest folder + 3 linii din `server.py`.
- Niciun model de date existent nu este atins.

---

### **FAZA A2: Frontend Dashboard** — 1 sprint
**Fișiere noi**:
- `/app/frontend/src/pages/admin/AutonomyEnginePage.jsx`
- `/app/frontend/src/components/AutonomyRing.jsx` (refolosim pattern din `AIHealthScore.jsx`)

**Rută nouă**: `/admin/autonomy`

**UI**:
- 1 inel mare central = General Autonomy
- 5 carduri sub-scoruri (cu progress bars)
- Sparkline 30 zile (trend)
- Listă recomandări prioritizate ("Crește X cu Y% → impact +Z autonomy points")

**Test**:
- Screenshot test
- Click pe sub-scor → drill-down (modal cu breakdown)

**Rollback safety**:
- Pagina e accesibilă doar la o rută nouă. Nu afectează niciun ecran existent.

---

### **FAZA A3: Daily Snapshot Job** — 0.5 sprint
- Adăugăm job APScheduler la 03:15 (după AI scan, înainte de morning briefing)
- Salvăm snapshot în `autonomy_snapshots`
- Histori 365 zile → ștergem snapshot-uri mai vechi (cron lunar)

**Rollback safety**: Job-ul are `replace_existing=True` + `misfire_grace_time=3600`. Dacă crapă, doar acest job pică, restul continuă.

---

### **FAZA A4: Recommendations + Auto-Tune (READ-ONLY)** — 1 sprint
- Engine generează sugestii: *"Activează auto-matching pentru jobs sub 500 RON pentru +5 puncte operational"*
- Admin vede butoane "Aplică sugestia" → opens modal cu preview
- **NU se aplică automat**. Always human-in-the-loop.

---

### **FAZA A5: Specialized Agents (cele care lipsesc)** — 2-3 sprints
Construim, în ordinea impactului pe scor:

#### A5.1 — **Financial Intelligence Agent** (+5pt op)
- Monitorizează cash flow, anomalii Stripe, fee disputes
- Sugerează ajustări de pricing pe baza istoricului

#### A5.2 — **Vendor Intelligence Agent** (+4pt op)
- Scor specialiști pe baza: timp răspuns, rating, completare, dispute
- Sugerează specialiști optimi pentru request

#### A5.3 — **Predictive Maintenance Agent** (+3pt op + 2pt tech)
- Citește Digital Twin + incident history
- Prezice failure points (boilere, AC, instalații)
- Generează tichete preventive

#### A5.4 — **AI Strategy Board** (+3pt dev + 2pt ai)
- Rapoarte săptămânale auto: ce a făcut AI, unde a fost blocat, ce să prioritizeze
- Email către admin lunea dimineața (refolosim `morning_briefing` infra)

#### A5.5 — **Autonomy Auditor** (+2pt sec)
- Verifică săptămânal că toți agenții respectă constrângerile (READ-ONLY, approval flows)
- Alertă dacă cineva încearcă să bypass-eze

---

## 📋 Checklist Pre-Implementare

- [ ] Backend: `/app/backend/autonomy/` folder creat
- [ ] Backend: route înregistrat în `server.py` (1 linie)
- [ ] Backend: APScheduler job adăugat (5 linii)
- [ ] Frontend: pagina + rută în `App.js`
- [ ] Frontend: link în sidebar Admin (sub "AI Control Center")
- [ ] Documentation: 1 capitol nou în `AdminDocumentation.jsx` (Manual 2.0)
- [ ] Smoke test: pagina se încarcă, API returnează JSON valid
- [ ] Testing agent: backend (3 endpoints) + frontend (page load)

---

## 🛡️ Riscuri și Mitigări

| Risc | Mitigare |
|---|---|
| Calculul devine lent (multe colecții) | Cache 5 min + index pe `timestamp` |
| Sub-scor lipsă (zero data) | Fallback 0 + flag "insufficient_data" în UI |
| User vrea să schimbe formula | `autonomy_targets` collection — ajustabil prin UI Admin |
| Spam recommendations | Limit max 5 per snapshot, doar cele cu impact > 2pt |
| Conflict cu `AIHealthScore` | Autonomy = strategic; HealthScore = operational. Le păstrăm separate, link între ele. |

---

## 📊 Definition of Done (Faza A)

✅ Admin poate accesa `/admin/autonomy`  
✅ Vede inelul General (cu număr 0-100) + 5 sub-scoruri  
✅ Sparkline 30 zile funcționează (după 30 zile de snapshots)  
✅ Min. 3 recomandări actionabile afișate  
✅ Daily snapshot rulează la 03:15 Europe/Bucharest  
✅ Testing agent: pass pe toate cele 3 endpoints  
✅ Documentația din Manual 2.0 are capitol "Cum funcționează Autonomy Engine"  

---

## ⏭️ Următorul Pas
**Începem Faza A1 + A2** (backend compute + frontend dashboard) în sprintul curent.  
**Faza A3** (daily snapshot) îl adăugăm imediat după.  
**Fazele A4-A5** (agents specialized) — sprinturi separate, fiecare cu confirmare user.
