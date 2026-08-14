# MASTER FUNCTION / CAPABILITY MAP — v1.0

**Artifact Type**: REGISTRY
**Owner**: Fondator (danieligna1@gmail.com)
**Status**: LIVE
**Version**: 1.0
**Last update**: 2026-02-06
**Purpose**: Source of truth pentru toate funcționalitățile PropManage. Alimentează pagina `/admin/function-map`.

## Regula fundamentală
**IMPLEMENTED ≠ VERIFIED**. Un feature poate fi implementat și în producție, dar dacă nu are E2E test recent și nu a fost verificat pe production data, statusul este `IMPLEMENTED` nu `VERIFIED`. Zero fabricație — dacă o relație nu este demonstrabilă din cod/DB/documentație existentă, se marchează `UNKNOWN`.

## Convenții
- **Category**: `BUSINESS` | `INFRA` | `SHARED`
- **Lifecycle**: `PLANNED` | `DRAFT` | `IMPLEMENTED` | `LIVE` | `DEPRECATED` | `BLOCKED` | `UNKNOWN`
- **Verification**: `VERIFIED` | `PARTIAL` | `UNVERIFIED` | `FAILED` | `UNKNOWN`
- **Health**: `GREEN` | `YELLOW` | `ORANGE` | `RED` | `GREY`
- **Risk**: `LOW` | `MEDIUM` | `HIGH` | `CRITICAL` | `UNKNOWN`
- **Autonomy**: `NONE` | `OBSERVE` | `RECOMMEND` | `EXECUTE_LOW_RISK` | `EXECUTE_WITH_APPROVAL`
- **Human decision**: `YES` (aprobare umană necesară) | `NO` | `PARTIAL`

---

## FUNCTIONS

### FN-001 · Analytics & Growth
- **Category**: BUSINESS
- **Subcategory**: Growth
- **Lifecycle**: LIVE
- **Description**: Dashboard trafic, sesiuni, conversii, campanii cu presete Azi→12L, YoY comparison, campaign markers, comparator side-by-side.
- **Frontend**: `/app/frontend/src/pages/admin/AnalyticsGrowthPage.jsx`
- **Backend**: `/app/backend/routes/analytics_growth.py`
- **API**: `/api/admin/analytics/overview`, `/pages`, `/insights`, `/campaign-markers`, `/growth/campaigns/compare`, `/export.csv`, `/export.pdf`
- **DB**: `analytics_sessions`, `analytics_events`, `growth_campaigns`, `users`, `properties`, `hh_subscriptions`
- **Engine**: In-house aggregation + AI insights (Emergent LLM Claude)
- **Automation**: None
- **AI Involvement**: RECOMMEND (AI Insights via LLM)
- **Human Decision**: NO (read-only dashboard)
- **Autonomy**: OBSERVE
- **Metric**: sessions, unique_visitors, accounts_created, conversion_pct
- **Enterprise Health domain**: Growth
- **KPI**: conversion_pct, retention_7d, bounce_rate
- **Verification**: VERIFIED
- **Test**: `/app/test_reports/iteration_180.json` (43/44 pass, testing_agent 2026-02-06)
- **Production verified**: YES (deployed 2026-02-06)
- **Health**: GREEN
- **Risk**: LOW
- **Owner**: Fondator
- **Knowledge Center**: `memory/PRD.md` (ANALYTICS-EXT-v1.0 changelog)
- **Next action**: None

### FN-002 · Autonomy Engine
- **Category**: SHARED
- **Subcategory**: AI / Governance
- **Lifecycle**: LIVE
- **Description**: Motor de scor autonomie L0-L5, recomandări operaționale, snapshot istoric, alerte proactive.
- **Frontend**: `/app/frontend/src/pages/admin/AutonomyPage.jsx`
- **Backend**: `/app/backend/routes/autonomy.py`, `/app/backend/autonomy/*.py`
- **API**: `/api/admin/autonomy/score`, `/history`, `/snapshot`, `/alerts/recent`, `/boost-dev`
- **DB**: `autonomy_snapshots`, `autonomy_alerts`, `autonomy_decisions`
- **Engine**: Autonomy scoring + Rules-based recommendation engine
- **Automation**: Snapshot scheduler (nightly)
- **AI Involvement**: RECOMMEND
- **Human Decision**: YES (execution requires Founder approval via `/boost-dev`)
- **Autonomy**: RECOMMEND
- **Metric**: autonomy_score, tier, dimensions_breakdown
- **Enterprise Health domain**: Automation
- **Verification**: PARTIAL (endpoint smoke pass, E2E full flow UNKNOWN)
- **Production verified**: YES (endpoints healthy)
- **Health**: GREEN
- **Risk**: LOW
- **Owner**: Fondator
- **Knowledge Center**: `memory/BOARD_DIRECTIVE_RESEARCH_DRIVEN_EVOLUTION.md`
- **Next action**: E2E verification pentru full recommendation → approval → execution loop

### FN-003 · Knowledge Center
- **Category**: SHARED
- **Subcategory**: Governance
- **Lifecycle**: LIVE
- **Description**: CMS Founder pentru documente, registre, prompts, board directives. Read-only cu artifact types + dependency map + review.
- **Frontend**: `/app/frontend/src/pages/admin/KnowledgeCenter.jsx`
- **Backend**: `/app/backend/routes/knowledge_center.py`
- **API**: `/api/founder/knowledge/tree`, `/doc`, `/search`, `/registry`, `/artifact-types`, `/review`, `/inspector/{widget_id}`, `/architecture`
- **DB**: None (filesystem-backed: `/app/memory/`, `/app/docs/`)
- **Engine**: Markdown parser + Artifact Type classifier
- **Automation**: None (manual updates)
- **AI Involvement**: NONE
- **Human Decision**: NO (read-only for viewer)
- **Autonomy**: OBSERVE
- **Metric**: total_docs, docs_by_status, quality_gate_pass_rate
- **Enterprise Health domain**: Knowledge
- **Verification**: VERIFIED
- **Test**: Endpoint smoke passing consistently
- **Production verified**: YES
- **Health**: GREEN
- **Risk**: LOW
- **Owner**: Fondator
- **Knowledge Center**: self (`memory/PRD.md`)
- **Next action**: Populate FUNCTION_MAP.md (in progress)

### FN-004 · Google OAuth Direct
- **Category**: INFRA
- **Subcategory**: Auth
- **Lifecycle**: LIVE
- **Description**: Autentificare directă Google OAuth (fără proxy Emergent), cu fallback Emergent activ.
- **Frontend**: `/app/frontend/src/pages/AuthCallback.jsx`
- **Backend**: `/app/backend/routes/auth.py`
- **API**: `POST /api/auth/google/callback`, `POST /api/auth/login`
- **DB**: `users`, `oauth_health`
- **Engine**: Google Auth Library
- **AI Involvement**: NONE
- **Human Decision**: NO
- **Autonomy**: NONE
- **Metric**: oauth_success_rate, oauth_failures_by_reason
- **Enterprise Health domain**: Security
- **Verification**: VERIFIED
- **Production verified**: YES
- **Health**: GREEN
- **Risk**: LOW
- **Owner**: Infra
- **Knowledge Center**: `memory/PRD.md`
- **Next action**: None

### FN-005 · Property Documents (Cloud Storage)
- **Category**: BUSINESS
- **Subcategory**: Product / Property
- **Lifecycle**: LIVE
- **Description**: Upload documente pentru proprietate, storage via GridFS + backends externe (Cloudflare R2, S3).
- **Frontend**: `/app/frontend/src/components/PropertyDocumentsPanel.jsx`
- **Backend**: `/app/backend/routes/property_documents.py`, `/app/backend/storage_service.py`
- **API**: `/api/properties/{id}/documents/*`
- **DB**: `property_documents`, `storage_configs`
- **Engine**: Storage router (auto-select backend by size/type)
- **Automation**: Compression pipeline (ffmpeg for video)
- **AI Involvement**: NONE
- **Human Decision**: NO
- **Autonomy**: NONE
- **Verification**: PARTIAL (upload flow tested, E2E cross-backend UNKNOWN)
- **Production verified**: UNKNOWN
- **Health**: YELLOW
- **Risk**: MEDIUM (P0 complexity in `upload_document` CC=42)
- **Owner**: Product
- **Next action**: Verify E2E on production + refactor CC (see Sprint T2)

### FN-006 · Digital Twin
- **Category**: BUSINESS
- **Subcategory**: Product / Property Intelligence
- **Lifecycle**: IMPLEMENTED
- **Description**: Reprezentare vie a proprietății (Maturity L0-L5), 3D upload, Property DNA v2.
- **Frontend**: `/app/frontend/src/pages/DigitalTwinPage.jsx`
- **Backend**: `/app/backend/routes/digital_twin.py`, `/app/backend/routes/twin.py`, `/app/backend/twin_schedule.py`
- **API**: `/api/twin/*`, `/api/admin/digital-twin/*`
- **DB**: `digital_twins`, `twin_snapshots`, `property_assets`
- **Engine**: Blender service + CloudConvert for .skp → glb
- **Automation**: Twin snapshot scheduler
- **AI Involvement**: OBSERVE
- **Human Decision**: PARTIAL (upload requires user action)
- **Autonomy**: OBSERVE
- **Metric**: twin_maturity_level, twins_active, snapshot_freshness
- **Enterprise Health domain**: Product
- **Verification**: PARTIAL (upload+viewer tested, full L5 flow UNKNOWN)
- **Production verified**: PARTIAL
- **Health**: YELLOW
- **Risk**: MEDIUM (P0 complexity `upload_model` CC=39)
- **Owner**: Product
- **Knowledge Center**: `memory/PROPERTY_DNA.md`, `memory/GI5P_PROPERTY_INTELLIGENCE.md`
- **Next action**: Complete E2E test L0→L5 full lifecycle

### FN-007 · User Registration + Onboarding
- **Category**: SHARED
- **Subcategory**: Growth / Auth
- **Lifecycle**: LIVE
- **Description**: Înregistrare cont (email/password + Google OAuth), onboarding email sequences.
- **Frontend**: `/app/frontend/src/pages/Register.jsx`
- **Backend**: `/app/backend/routes/register.py`, `/app/backend/onboarding_emails.py`
- **API**: `POST /api/auth/register`, `/onboarding/*`
- **DB**: `users`, `email_sequences`
- **Engine**: Bcrypt + JWT + Resend email
- **Automation**: Onboarding email drip (day 0, 1, 3, 7)
- **AI Involvement**: NONE
- **Human Decision**: NO
- **Autonomy**: NONE
- **Metric**: registrations_per_day, activation_rate, email_open_rate
- **Enterprise Health domain**: Growth
- **Verification**: PARTIAL (register endpoint verified, drip flow UNKNOWN)
- **Production verified**: YES (register works)
- **Health**: YELLOW
- **Risk**: HIGH (P0 complexity `register` CC=44, 170 imports)
- **Owner**: Growth
- **Next action**: Refactor `register.py` (see Sprint T2)

### FN-008 · Community Buildings & President Dashboard
- **Category**: BUSINESS
- **Subcategory**: Product / Association Module
- **Lifecycle**: IMPLEMENTED
- **Description**: Modul asociație de proprietari (buildings, campaigns, announcements, maintenance tasks, votes).
- **Frontend**: `/app/frontend/src/components/BuildingHub.jsx`, `/app/frontend/src/pages/president/*`
- **Backend**: `/app/backend/routes/community_buildings.py`, `/app/backend/routes/building_admin.py`
- **API**: `/api/buildings/*`, `/api/community/*`
- **DB**: `buildings`, `community_campaigns`, `maintenance_tasks`, `building_announcements`
- **Engine**: None (CRUD)
- **AI Involvement**: NONE
- **Human Decision**: YES (votes require quorum)
- **Autonomy**: NONE
- **Verification**: PARTIAL
- **Production verified**: PARTIAL (endpoint UP, real usage UNKNOWN)
- **Health**: YELLOW
- **Risk**: MEDIUM
- **Owner**: Product
- **Knowledge Center**: `memory/audits/PROPMANAGE_PRESIDENT_RESEARCH_COHORT_v1.0.md`
- **Next action**: Await AP-011+ research to validate feature-market fit

### FN-009 · Marketplace / Specialist Cockpit
- **Category**: BUSINESS
- **Subcategory**: Marketplace
- **Lifecycle**: IMPLEMENTED
- **Description**: Marketplace specialiști (înregistrare, cerere, ofertă, cotare, review).
- **Frontend**: `/app/frontend/src/pages/specialist/*`, `/app/frontend/src/pages/marketplace/*`
- **Backend**: `/app/backend/routes/specialist_cockpit.py`, `/app/backend/routes/marketplace_growth.py`
- **API**: `/api/specialist/*`, `/api/marketplace/*`
- **DB**: `specialists`, `requests`, `offers`, `reviews`
- **Engine**: Request-Offer matching
- **AI Involvement**: OBSERVE
- **Human Decision**: YES (specialists accept requests, clients accept offers)
- **Autonomy**: OBSERVE
- **Verification**: PARTIAL
- **Production verified**: UNKNOWN
- **Health**: YELLOW
- **Risk**: MEDIUM (P0 complexity `specialist_cockpit` CC=38)
- **Owner**: Product
- **Next action**: E2E test full marketplace flow

### FN-010 · PropBenefits Copilot
- **Category**: BUSINESS
- **Subcategory**: Product / Rewards
- **Lifecycle**: LIVE
- **Description**: AI copilot pentru sugestii beneficii + oportunități + deal negotiation.
- **Frontend**: `/app/frontend/src/pages/PropBenefitsPage.jsx`
- **Backend**: `/app/backend/propbenefits/copilot.py`, `/app/backend/propbenefits/opportunities.py`, `/app/backend/propbenefits/ai_agents.py`
- **API**: `/api/prop-benefits/*`
- **DB**: `prop_benefits`, `benefit_opportunities`, `benefit_deals`
- **Engine**: Emergent LLM (Claude) + cache via MD5 signature
- **Automation**: Opportunity queue builder
- **AI Involvement**: RECOMMEND
- **Human Decision**: YES (user accepts/rejects deals)
- **Autonomy**: RECOMMEND
- **Verification**: PARTIAL
- **Production verified**: UNKNOWN
- **Health**: YELLOW
- **Risk**: MEDIUM (P0 complexity `build_opportunity_queue` CC=40, `success_manager` CC=38)
- **Owner**: Product
- **Next action**: E2E test + refactor top complex funcs

### FN-011 · Stripe Payments
- **Category**: INFRA
- **Subcategory**: Payments
- **Lifecycle**: LIVE
- **Description**: Integrare Stripe pentru abonamente + checkouts + top-up wallet.
- **Frontend**: `/app/frontend/src/pages/CheckoutPage.jsx`, `/app/frontend/src/components/WalletPanel.jsx`
- **Backend**: `/app/backend/routes/stripe_billing.py`
- **API**: `/api/billing/checkout`, `/api/billing/webhook`
- **DB**: `stripe_events`, `hh_subscriptions`, `wallets`
- **Engine**: Stripe SDK
- **AI Involvement**: NONE
- **Human Decision**: YES (user confirms payment)
- **Autonomy**: NONE
- **Metric**: mrr, active_subscriptions, churn_rate
- **Enterprise Health domain**: Revenue
- **Verification**: PARTIAL (TEST mode verified, LIVE production check UNKNOWN)
- **Production verified**: PARTIAL
- **Health**: YELLOW
- **Risk**: HIGH (payment critical + LIVE claim pending)
- **Owner**: Fondator (LIVE keys pending)
- **Next action**: User to claim LIVE Stripe + purge demo data on prod

### FN-012 · Enterprise Health Dashboard
- **Category**: SHARED
- **Subcategory**: Operations
- **Lifecycle**: LIVE
- **Description**: 11-domain scoring (Growth, Revenue, Product, Knowledge, Operations, Marketplace, AI Learning, UX, Automation, Customer Trust, Technical Debt).
- **Frontend**: `/app/frontend/src/pages/admin/EnterpriseHealthPage.jsx`
- **Backend**: `/app/backend/routes/enterprise_health.py`
- **API**: `GET /api/admin/enterprise-health`, `/formulas`, `/formulas/{key}/explain`, `/formulas/{key}/audit`
- **DB**: agregă din multiple colecții
- **Engine**: Formula engine (11 domain formulas)
- **AI Involvement**: OBSERVE
- **Human Decision**: NO
- **Autonomy**: OBSERVE
- **Metric**: score per domain, overall_score
- **Enterprise Health domain**: self
- **Verification**: PARTIAL (endpoint verified, formula accuracy UNKNOWN)
- **Production verified**: PARTIAL
- **Health**: GREEN
- **Risk**: LOW
- **Owner**: Fondator
- **Next action**: Verify formula outputs vs. business reality

### FN-013 · Research Coverage Matrix (Founder)
- **Category**: SHARED
- **Subcategory**: Governance / Research
- **Lifecycle**: LIVE
- **Description**: Vizualizare bias și acoperire cercetare pentru cohorta AP-001..AP-010, dinamic din INTERVIEW_REGISTRY.
- **Frontend**: `/app/frontend/src/pages/admin/ResearchCoveragePage.jsx`
- **Backend**: `/app/backend/routes/knowledge_center.py` (reuse tree/doc endpoints)
- **API**: `/api/founder/knowledge/doc?path=memory%2Fregistries%2FINTERVIEW_REGISTRY.md`
- **DB**: None (markdown-backed)
- **Engine**: Markdown parser
- **AI Involvement**: NONE
- **Human Decision**: NO
- **Autonomy**: OBSERVE
- **Verification**: VERIFIED
- **Production verified**: YES
- **Health**: GREEN
- **Risk**: LOW
- **Owner**: Fondator
- **Knowledge Center**: `memory/registries/INTERVIEW_REGISTRY.md`, `memory/registries/PATTERN_REGISTRY.md`
- **Next action**: Continue with AP-011+ interviews

### FN-014 · CEO Briefing / CEO Dashboard
- **Category**: SHARED
- **Subcategory**: Executive
- **Lifecycle**: LIVE
- **Description**: Daily briefing generat automat + CEO dashboard consolidat.
- **Frontend**: `/app/frontend/src/pages/admin/CeoDashboardPage.jsx`
- **Backend**: `/app/backend/routes/ceo_briefing.py`, `/app/backend/routes/ceo_dashboard.py`
- **API**: `/api/admin/ceo/*`
- **DB**: agregă din multiple
- **Engine**: Multi-source aggregator + LLM briefing
- **Automation**: Daily briefing scheduler
- **AI Involvement**: RECOMMEND
- **Human Decision**: NO (read-only)
- **Autonomy**: OBSERVE
- **Verification**: PARTIAL
- **Production verified**: PARTIAL
- **Health**: YELLOW
- **Risk**: MEDIUM (P0 complexity `beta_overview` CC=68, `ceo_briefing` CC=50)
- **Owner**: Fondator
- **Next action**: Refactor top complex funcs (Sprint T2)

### FN-015 · AI Brain (Ledger + Decisions + Graph)
- **Category**: INFRA
- **Subcategory**: AI / Intelligence
- **Lifecycle**: IMPLEMENTED
- **Description**: AI Decision Ledger, decision graph, explain, certification, adaptive learning.
- **Frontend**: `/app/frontend/src/pages/admin/AIBrainPage.jsx`
- **Backend**: `/app/backend/ai_brain/*.py`, `/app/backend/routes/ai_brain.py`
- **API**: `/api/admin/ai-brain/status`, `/discover`, `/collaboration`, `/decision`, `/graph`, `/explain`, `/certification`, `/adaptive`
- **DB**: `ai_brain_decisions`, `ai_brain_notifications`, `ai_brain_learning`
- **Engine**: LLM + SHA1 dedup cache
- **AI Involvement**: RECOMMEND
- **Human Decision**: YES (via ledger approvals)
- **Autonomy**: RECOMMEND
- **Verification**: PARTIAL (status endpoint verified)
- **Production verified**: PARTIAL
- **Health**: YELLOW
- **Risk**: MEDIUM (P0 complexity `instance_collaboration` CC=41, `_run_ai_verification` CC=39)
- **Owner**: Infra
- **Next action**: E2E test decision → approval → outcome loop

### FN-016 · Operations Center
- **Category**: SHARED
- **Subcategory**: Operations
- **Lifecycle**: IMPLEMENTED
- **Description**: Consolidator ops: incidents, backups, autonomy alerts, data integrity.
- **Frontend**: `/app/frontend/src/pages/admin/OperationsCenter.jsx`
- **Backend**: `/app/backend/routes/admin.py`, `/app/backend/routes/admin_backups.py`, `/app/backend/routes/admin_data_integrity.py`
- **API**: `/api/admin/ops/*`, `/api/admin/backups/*`
- **DB**: `backups_metadata`, `data_integrity_reports`, `ops_incidents`
- **Engine**: Backup scheduler + integrity checker
- **Automation**: Nightly backups, integrity checks
- **AI Involvement**: OBSERVE
- **Human Decision**: YES (restore requires approval)
- **Autonomy**: OBSERVE
- **Verification**: UNKNOWN
- **Production verified**: UNKNOWN
- **Health**: GREY
- **Risk**: UNKNOWN
- **Owner**: Ops
- **Next action**: Verify backup restore E2E

### FN-017 · Voice Journal + Whisper Transcription
- **Category**: BUSINESS
- **Subcategory**: Product
- **Lifecycle**: IMPLEMENTED
- **Description**: Voice journaling cu Whisper STT.
- **Frontend**: `/app/frontend/src/components/VoiceJournal.jsx`
- **Backend**: `/app/backend/routes/voice_journal.py`
- **API**: `/api/voice/journal`, `/api/voice/transcribe`
- **DB**: `voice_journal_entries`
- **Engine**: OpenAI Whisper (via Emergent LLM key)
- **AI Involvement**: EXECUTE (auto-transcribe)
- **Human Decision**: NO
- **Autonomy**: EXECUTE_LOW_RISK
- **Verification**: UNKNOWN
- **Production verified**: UNKNOWN
- **Health**: GREY
- **Risk**: LOW
- **Owner**: Product
- **Next action**: Verify transcription accuracy + usage stats

### FN-018 · A/B Testing Framework
- **Category**: INFRA
- **Subcategory**: Experimentation
- **Lifecycle**: LIVE
- **Description**: Experimente A/B pe UI copy, CTA, layouts.
- **Frontend**: `/app/frontend/src/pages/admin/analytics/AbTestingTab.jsx`
- **Backend**: parte din `/app/backend/routes/analytics_growth.py`
- **API**: `/api/admin/ab-tests/*`
- **DB**: `ab_experiments`, `ab_assignments`
- **Engine**: Deterministic hash assignment
- **AI Involvement**: OBSERVE
- **Human Decision**: YES (create/end experiment)
- **Autonomy**: OBSERVE
- **Verification**: PARTIAL
- **Production verified**: UNKNOWN
- **Health**: YELLOW
- **Risk**: LOW
- **Owner**: Growth
- **Next action**: Verify statistical significance calculation

### FN-019 · Heatmap Analytics
- **Category**: INFRA
- **Subcategory**: UX Observability
- **Lifecycle**: LIVE
- **Description**: Heatmap click + scroll pe paginile publice.
- **Frontend**: `/app/frontend/src/pages/admin/analytics/HeatmapTab.jsx`, `/app/frontend/src/components/HeatmapTracker.jsx`
- **Backend**: parte din `/app/backend/routes/analytics_growth.py`
- **API**: `/api/analytics/heatmap/*`
- **DB**: `heatmap_events`
- **Engine**: Coordonate aggregation
- **AI Involvement**: NONE
- **Human Decision**: NO
- **Autonomy**: OBSERVE
- **Verification**: PARTIAL
- **Production verified**: UNKNOWN
- **Health**: YELLOW
- **Risk**: LOW
- **Owner**: UX
- **Next action**: Validate coordinate density on prod

### FN-020 · WhatsApp Growth Integration
- **Category**: BUSINESS
- **Subcategory**: Growth / Communication
- **Lifecycle**: LIVE
- **Description**: Campanii WhatsApp trackable prin token-based URLs cu funnel attribution.
- **Frontend**: `/app/frontend/src/pages/admin/analytics/WhatsAppTab.jsx`
- **Backend**: parte din `/app/backend/routes/analytics_growth.py`
- **API**: `/api/admin/growth/campaigns/*`
- **DB**: `growth_campaigns`, `analytics_sessions.campaign_code`
- **Engine**: Token generator + attribution
- **AI Involvement**: OBSERVE
- **Human Decision**: YES (Founder creates campaigns)
- **Autonomy**: OBSERVE
- **Verification**: VERIFIED (funcțional în producție cu 1 campanie live)
- **Production verified**: YES
- **Health**: GREEN
- **Risk**: LOW
- **Owner**: Growth
- **Next action**: Scale to 5+ campanii pentru statistical relevance

---

## MATRIX HIGH-LEVEL

**Legend cells**: `✓` connected · `~` partial · `?` unknown · `✗` broken

| Function | Engine | API | DB | Metric | Automation | Dashboard | Test | Human Decision |
|---|---|---|---|---|---|---|---|---|
| FN-001 Analytics&Growth | ✓ | ✓ | ✓ | ✓ | ~ | ✓ | ✓ | ✗ |
| FN-002 Autonomy | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | ✓ |
| FN-003 Knowledge Center | ✓ | ✓ | ✗ | ~ | ✗ | ✓ | ✓ | ✗ |
| FN-004 Google OAuth | ✓ | ✓ | ✓ | ~ | ✗ | ~ | ✓ | ✗ |
| FN-005 Property Docs | ✓ | ✓ | ✓ | ~ | ✓ | ✓ | ~ | ✗ |
| FN-006 Digital Twin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | ~ |
| FN-007 Registration | ✓ | ✓ | ✓ | ✓ | ✓ | ~ | ~ | ✗ |
| FN-008 Community Buildings | ✗ | ✓ | ✓ | ? | ✗ | ✓ | ~ | ✓ |
| FN-009 Marketplace | ✓ | ✓ | ✓ | ? | ✗ | ✓ | ~ | ✓ |
| FN-010 PropBenefits | ✓ | ✓ | ✓ | ~ | ✓ | ✓ | ~ | ✓ |
| FN-011 Stripe | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ~ | ✓ |
| FN-012 Enterprise Health | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ~ | ✗ |
| FN-013 Research Coverage | ✓ | ✓ | ✗ | ~ | ✗ | ✓ | ✓ | ✗ |
| FN-014 CEO Briefing | ✓ | ✓ | ✓ | ~ | ✓ | ✓ | ~ | ✗ |
| FN-015 AI Brain | ✓ | ✓ | ✓ | ~ | ✗ | ✓ | ~ | ✓ |
| FN-016 Operations Center | ✓ | ✓ | ✓ | ? | ✓ | ✓ | ? | ✓ |
| FN-017 Voice Journal | ✓ | ✓ | ✓ | ? | ✗ | ✓ | ? | ✗ |
| FN-018 A/B Testing | ✓ | ✓ | ✓ | ~ | ✗ | ✓ | ~ | ✓ |
| FN-019 Heatmap | ✓ | ✓ | ✓ | ~ | ✗ | ✓ | ~ | ✗ |
| FN-020 WhatsApp Growth | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ |

---

## COVERAGE SUMMARY

- **Total functions mapped**: 20
- **LIVE**: 12 · **IMPLEMENTED**: 7 · **PLANNED/BLOCKED**: 1
- **VERIFIED**: 5 · **PARTIAL**: 12 · **UNKNOWN**: 3
- **Health GREEN**: 6 · **YELLOW**: 11 · **GREY**: 2 · **RED**: 0
- **Risk HIGH**: 2 (FN-007, FN-011) · **MEDIUM**: 8 · **LOW**: 10 · **UNKNOWN**: 0

## KEY OBSERVATIONS

1. **IMPLEMENTED ≠ VERIFIED**: Din 20 funcții, doar 5 sunt fully VERIFIED. 12 sunt PARTIAL. Aceasta este realitatea onestă a stadiului actual.
2. **HIGH-risk**: Doar 2 (FN-007 Registration, FN-011 Stripe LIVE claim). Restul MEDIUM/LOW.
3. **Human Decision explicit**: 9 din 20 funcții au Human-in-the-Loop (marketplace, votes, payments, campaigns, restore, AI approvals).
4. **Autonomy distribution**: OBSERVE (12), RECOMMEND (4), NONE (3), EXECUTE_LOW_RISK (1). PropManage este predominant observațional + recomandativ — NU autonom.
5. **Production verification gap**: 8 funcții au `Production verified: UNKNOWN`. Necesită verificare live-data sistematică.
