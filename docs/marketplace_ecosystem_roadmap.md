# 🛒 AI MARKETPLACE & ECOSYSTEM — Roadmap de Implementare

> **Scop**: Transformarea PropManage într-o platformă deschisă unde dezvoltatori terți pot publica agenți AI, plugin-uri, workflow-uri și aplicații, cu monetizare prin revenue sharing.

> **Regulă de aur**: NU începem marketplace-ul înainte ca Autonomy Engine (Faza A) să fie LIVE. Marketplace fără autonomie reală = vitrină goală.

---

## 📐 Principii Arhitecturale

| Principiu | De ce |
|---|---|
| **Sandbox isolation** | Orice plugin terț rulează izolat (Docker-in-Docker sau JS Worker). Nu accesează MongoDB direct. |
| **Permission scopes** | Plugin-urile declară scopuri ("read:requests", "write:notifications"). Admin aprobă fiecare. |
| **MongoDB only (no extra DB)** | Plugin-urile primesc API REST către PropManage; nu instalează DB-uri proprii. |
| **Revenue share via Stripe Connect** | Plățile rămân în Stripe (deja integrat). |
| **READ-ONLY by default** | Plugin-uri write necesită aprobare manuală + review code. |
| **Versioning semantic** | Fiecare plugin: `version: "1.2.3"`. Schimbări breaking = bump major + migration guide. |

---

## 🗂️ Schema MongoDB (Nouă)

### `marketplace_plugins`
```json
{
  "_id": ObjectId,
  "plugin_id": "uuid",
  "slug": "smart-contract-generator",
  "name": "Smart Contract Generator",
  "developer_id": "user_id",
  "version": "1.0.0",
  "category": "agent" | "workflow" | "ui-extension" | "integration",
  "description_md": "...",
  "icon_url": "...",
  "manifest": {
    "permissions": ["read:contracts", "write:contracts"],
    "endpoints": ["/api/plugin/abc/generate"],
    "ui_mount": "admin/contracts",
    "llm_models": ["claude-sonnet-4.5"]
  },
  "pricing": {
    "model": "free" | "one-time" | "subscription" | "per-call",
    "amount_eur": 9.99,
    "interval": "monthly"
  },
  "status": "draft" | "review" | "approved" | "suspended",
  "installs_count": 142,
  "rating_avg": 4.6,
  "created_at": "...",
  "approved_by": "admin_id",
  "approved_at": "..."
}
```

### `plugin_installations`
```json
{
  "_id": ObjectId,
  "install_id": "uuid",
  "plugin_id": "...",
  "tenant_id": "client_or_admin_id",
  "installed_at": "...",
  "permissions_granted": ["read:requests"],
  "config": { "api_key_field": "..." },
  "active": true
}
```

### `plugin_revenue_ledger`
```json
{
  "_id": ObjectId,
  "txn_id": "uuid",
  "plugin_id": "...",
  "developer_id": "...",
  "install_id": "...",
  "gross_eur": 9.99,
  "platform_cut_eur": 3.00,   // 30% PropManage
  "developer_cut_eur": 6.99,  // 70% dev
  "stripe_payment_id": "...",
  "settled": false,
  "created_at": "..."
}
```

### `plugin_api_keys` (per-install, scoped)
```json
{
  "_id": ObjectId,
  "key_id": "uuid",
  "install_id": "...",
  "hashed_key": "bcrypt(...)",
  "scopes": ["read:requests"],
  "rate_limit_per_min": 60,
  "active": true
}
```

---

## 🚀 Fazele de Implementare (Iterative & Safe)

### **FAZA M0: Pre-requisites (BLOCKER)** 
> ⚠️ Nu trecem la M1 până nu sunt LIVE:
- ✅ Autonomy Engine Faza A1-A3 (din `autonomy_engine_roadmap.md`)
- ✅ Stripe Connect activat în cont (necesită KYC dev)
- ✅ Sandbox isolation decis (recomandare: **JS Worker în VM2 + REST API**, NU Docker-in-Docker pe K8s)

---

### **FAZA M1: Plugin Registry (Backend, read-only)** — 1 sprint
**Fișiere noi**:
- `/app/backend/marketplace_core/`
  - `models.py` (Pydantic)
  - `registry.py` (CRUD plugins, filters)
  - `manifest_validator.py` (validează manifest JSON la upload)
- `/app/backend/routes/marketplace_plugins.py`

**API**:
- `GET /api/marketplace/plugins?category=&pricing=&q=` (public catalog)
- `GET /api/marketplace/plugins/{slug}` (detalii)
- `POST /api/admin/marketplace/plugins` (dev publishing — review)
- `POST /api/admin/marketplace/plugins/{id}/approve` (admin)

**Rollback safety**: Modul nou. Niciun endpoint existent nu este modificat.

---

### **FAZA M2: Plugin Installation Flow** — 1 sprint
**API**:
- `POST /api/marketplace/installs` (client/admin instalează)
- `POST /api/marketplace/installs/{id}/grant-permissions`
- `DELETE /api/marketplace/installs/{id}` (uninstall)

**Permission UI**:
- Modal: "Acest plugin cere acces la: ☑ Requests (read), ☑ Notifications (write). Aprobi?"
- Per-permission toggle (granular)

**Test**: Mock plugin instalat → verifică `plugin_installations` doc creat → uninstall → verifică șters.

---

### **FAZA M3: Plugin Runtime Sandbox** — 2 sprinturi (CRITIC pe securitate)
**Decizie tehnică**: 
- **NU rulăm cod terț în procesul backend FastAPI** (risk: crash, secrets leak).
- **Soluție**: Plugin-urile sunt **API-uri externe** (developer hostuieste). PropManage trimite webhook-uri scoped.
- **Pattern**: Plugin = API endpoint extern + manifest. Plugin primește JWT scoped (15 min TTL) pentru a chema PropManage API back.

**Avantaj**: Nu trebuie sandbox local. Plugin moare → doar plugin-ul, restul platformei OK.

**Fișiere noi**:
- `/app/backend/marketplace_core/dispatcher.py` (trimite event → plugin webhook)
- `/app/backend/marketplace_core/plugin_jwt.py` (generează token scoped)
- `/app/backend/routes/plugin_callbacks.py` (primește răspunsuri de la plugin)

**Rate limiting**: Per-install, 60 calls/min default. Suspend la abuz.

---

### **FAZA M4: Developer Portal (SDK + Docs)** — 2 sprinturi
**Frontend**:
- `/dev` portal nou (cont developer separat de cont admin)
- Dashboard: plugin-urile mele, installs, revenue, erori
- "New Plugin" wizard: upload manifest, test webhook, submit pentru review

**SDK**:
- `/app/sdk/javascript/propmanage-sdk` (Node.js npm package)
- `/app/sdk/python/propmanage-sdk` (Python pip package)
- Funcții helper: `authenticate()`, `fetchRequests()`, `createNotification()`

**Docs auto-generate**: Swagger pentru toate endpoint-urile scoped + exemple curl.

---

### **FAZA M5: Revenue Sharing (Stripe Connect)** — 2 sprinturi
**Stripe Connect Express**:
- Developer face KYC light direct prin Stripe
- PropManage devine "Platform"
- Plățile pe plugin → split 70/30 (dev/platform) automat

**Cron lunar**:
- Calculează plățile datorate per dev
- Generează raport email
- Stripe transferă automat

**Fișiere noi**:
- `/app/backend/marketplace_core/revenue.py`
- `/app/backend/routes/marketplace_payouts.py`

**Risc**: Stripe Connect Express necesită aprobare Stripe pe contul nostru. Aplicăm devreme.

---

### **FAZA M6: App Store Intern (AI-curated)** — 1 sprint
**Idee**: Un "Intern AI" care:
- Citește toate request-urile platformei (anonimizat)
- Detectează nevoi recurente (ex: "10 clienți cer integrare cu Smart Bill")
- Generează "Plugin Ideas" pentru developeri (un fel de market intelligence)
- Sugerează users plugins pe baza profilului lor

**Fișier nou**: `/app/backend/marketplace_core/intern_ai.py`

**Rulează săptămânal**: Lunea, după morning briefing.

---

### **FAZA M7: Plugin Review Workflow** — 1 sprint
**Admin Review UI**:
- Listă plugins în "pending review"
- Diff de manifest vs versiune anterioară
- AI Security Guardian scanează permission scopes (alertă dacă plugin cere "write:users")
- Buton "Approve" / "Request Changes" / "Reject"

**SLA**: Review max 7 zile lucrătoare (afișat dev).

---

### **FAZA M8: Rating & Reviews** — 0.5 sprint
- Client/admin care a instalat un plugin poate vota 1-5 + review text
- Anti-spam: doar useri cu install > 7 zile pot review
- Developer poate răspunde public la reviews

---

## 📋 Checklist Pre-Implementare

- [ ] Autonomy Engine Faza A1-A3 LIVE
- [ ] Stripe Connect Express activat
- [ ] Decizie sandbox: webhook external (recomandat) confirmată
- [ ] Folder `/app/backend/marketplace_core/` creat
- [ ] Rută înregistrată în `server.py`
- [ ] Developer portal scaffold (`/dev` route)
- [ ] SDK npm + pip publicate (privat la început)
- [ ] Documentație în Admin Manual 2.0 (capitol "Marketplace")
- [ ] Testing agent: full e2e (publish → install → call webhook → uninstall)

---

## 🛡️ Riscuri și Mitigări

| Risc | Mitigare |
|---|---|
| Plugin terț face spam → MongoDB plin | Rate limit + storage quota per plugin (10 MB free, plătit peste) |
| Plugin scapă date sensitive | JWT scoped 15 min + audit log per call + AI Security scan |
| Dispute revenue | Stripe Connect = source of truth. Ledger nostru e cache. |
| Plugin face acțiuni distructive | Toate write-urile necesită aprobare per-acțiune sau scope explicit |
| Marketplace gol la lansare | M6 (Intern AI) sugerează prima generație de plugins; build 5 "official" plugins ca exemplu |
| Stripe Connect respins | Backup: payments manual via factură (dev → PropManage → wire transfer) |

---

## 💰 Pricing Model (Sugerat)

| Tier | Free | Pro Dev | Enterprise |
|---|---|---|---|
| Plugins publicate | 1 | 10 | nelimitat |
| Installs/lună | 100 | 10k | nelimitat |
| Revenue share | 70/30 | 80/20 | 85/15 |
| Suport | community | email | dedicated |
| Preț | 0€ | 29€/lună | custom |

---

## 📊 Definition of Done (Marketplace MVP)

✅ Catalog public la `/marketplace`  
✅ Min. 5 plugin-uri "official" PropManage  
✅ Min. 3 plugin-uri externe aprobate  
✅ Developer poate publica + primi venituri  
✅ Admin poate suspenda plugin în < 5 min  
✅ Intern AI livrează 1 raport/săptămână  
✅ Stripe Connect funcțional (test mode → live)  

---

## ⏭️ Următorul Pas
**NU începem marketplace** până nu validăm:
1. Autonomy Engine Faza A LIVE
2. User confirm: "Da, vrem marketplace, alocam buget Stripe Connect KYC"
3. Decizie sandbox confirmată (webhook external recomandat)

**Timeline estimat**: 8-10 sprinturi (2-2.5 luni cu un singur dev focusat) pentru MVP marketplace funcțional.
