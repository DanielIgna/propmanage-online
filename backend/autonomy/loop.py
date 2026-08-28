"""Operational Autonomy Loop — închide bucla end-to-end.

OBSERVE (Analytics) → DETECT → FINDING (admin_ai_findings) → DECIDE/POLICY/RISK
→ ACT (admin_todos SAFE · admin_approvals MEDIUM/HIGH) → VERIFY → RECORD
(autonomy_loop_runs) → LEARN.

Principii dure (cerute de Fondator):
- REUTILIZARE, zero sisteme paralele: findings = `admin_ai_findings` existent,
  task-uri = `admin_todos`, aprobări = `admin_approvals`. Singura colecție nouă =
  `autonomy_loop_runs` (strict ledger/audit-trail).
- Detectoare DETERMINISTE peste Analytics existent + funnel-ul comercial. Zero LLM,
  zero pattern-uri inventate. Separă strict: raw_observation → finding → hypothesis.
- IDEMPOTENT & BOUNDED & SAFE-ON-RERUN: aceeași observație NU creează task-uri/finding-uri
  duplicate; acțiunile nu se re-execută accidental; un eșec într-un pas NU lasă starea
  inconsistentă (creăm întâi artefactul, apoi marcăm finding-ul).
- Human-in-the-loop pentru MEDIUM/HIGH: doar propunere prin `admin_approvals` (gate uman).
"""
import logging
import uuid
from datetime import datetime, timezone, timedelta

from db import db

logger = logging.getLogger("propmanage.autonomy.loop")

# ── Praguri deterministe (constante — fără reglaj cosmetic) ───────────────────
BOUNCE_MIN_SESSIONS = 30          # trafic minim ca semnalul să conteze
BOUNCE_MED_SESSIONS = 120         # peste care severitatea urcă la medium
BOUNCE_MIN_PCT = 55.0             # bounce rate peste care e friction real
FUNNEL_MIN_STARTED = 5            # cereri începute minim ca abandonul să conteze
FUNNEL_MAX_CONVERSION_PCT = 40.0  # sub acest % început→creat = abandon ridicat
MAX_FINDINGS_PER_RUN = 6          # bound dur pe câte findings procesăm/rulare
DEDUP_WINDOW_HOURS = 24           # nu recrea același finding în fereastra asta
ANALYTICS_LOOKBACK_DAYS = 90
SOURCE = "analytics_loop"

# Rute pe care NU le tratăm (zgomot / non-comercial)
_IGNORED_ROUTES = {"", "/admin", "/logout", "/auth", "/auth/callback"}

# Politica de acțiune per tip de detector (risc → mod de execuție)
ACTION_POLICY = {
    "high_bounce_page": "SAFE",              # creează task de review (reversibil)
    "request_flow_abandonment": "MEDIUM",    # schimbare UX → aprobare umană
}

POLICY_DESCRIPTION = {
    "SAFE": "Auto-execuție: creează task de remediere în admin_todos (reversibil) + rezolvă finding-ul.",
    "REVERSIBLE": "Auto-execuție + audit + verificare (reversibil).",
    "MEDIUM": "Doar propunere: creează aprobare în admin_approvals (gate uman obligatoriu).",
    "HIGH": "Doar propunere: aprobare umană obligatorie (impact major / destructiv).",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _autonomy_actor() -> dict:
    return {"email": "autonomy@propmanage.ai", "name": "Operational Autonomy Loop", "role": "admin"}


# ═══════════════════════ 1. OBSERVE + DETECT ═══════════════════════
async def _detect_high_bounce_pages() -> list[dict]:
    """Detector determinist: pagini cu trafic mare și bounce ridicat (Analytics existent)."""
    d_from = (datetime.now(timezone.utc) - timedelta(days=ANALYTICS_LOOKBACK_DAYS)).date().isoformat()
    pipeline = [
        {"$match": {"day": {"$gte": d_from}}},
        {"$group": {
            "_id": "$entry_path",
            "sessions": {"$sum": 1},
            "bounces": {"$sum": {"$cond": [{"$lte": [{"$ifNull": ["$pageviews", 0]}, 1]}, 1, 0]}},
            "avg_dur_ms": {"$avg": {"$ifNull": ["$duration_ms", 0]}},
        }},
        {"$match": {"sessions": {"$gte": BOUNCE_MIN_SESSIONS}}},
        {"$sort": {"sessions": -1}},
        {"$limit": 25},
    ]
    out = []
    async for row in db.analytics_sessions.aggregate(pipeline):
        route = row.get("_id") or ""
        if route in _IGNORED_ROUTES or route.startswith("/admin"):
            continue
        sessions = int(row.get("sessions") or 0)
        bounces = int(row.get("bounces") or 0)
        bounce_pct = round(bounces / sessions * 100, 1) if sessions else 0.0
        if bounce_pct < BOUNCE_MIN_PCT:
            continue
        severity = "medium" if (sessions >= BOUNCE_MED_SESSIONS and bounce_pct >= 65) else "low"
        confidence = round(min(0.95, 0.5 + sessions / 500.0), 2)
        out.append({
            "detector": "high_bounce_page",
            "affected_route": route,
            "severity": severity,
            "confidence": confidence,
            "raw_observation": {"sessions": sessions, "bounces": bounces, "bounce_pct": bounce_pct,
                                 "avg_session_sec": round((row.get("avg_dur_ms") or 0) / 1000)},
            "finding": f"Pagina «{route}» are bounce {bounce_pct}% pe {sessions} sesiuni (90z) — peste pragul {BOUNCE_MIN_PCT}%.",
            "hypothesis": "Mesajul din primele secunde sau CTA-ul nu convinge; vizitatorii pleacă după o singură pagină.",
            "recommended_action": f"Revizuiește primele 3 secunde ale paginii «{route}»: un singur CTA dominant + clarificarea valorii.",
            "verification_criteria": f"bounce_pct pentru «{route}» scade sub {BOUNCE_MIN_PCT}% la următoarea observație (90z).",
        })
    return out


async def _detect_request_flow_abandonment() -> list[dict]:
    """Detector determinist peste funnel-ul comercial: mulți încep, puțini creează cerere."""
    try:
        from routes.analytics_growth import analytics_commercial_funnel
        data = await analytics_commercial_funnel("90d", "", "", _autonomy_actor())
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[loop] funnel observe failed: {e}")
        return []
    kpi = data.get("kpi") or {}
    started = int(kpi.get("started") or 0)
    created = int(kpi.get("created") or 0)
    conv = float(kpi.get("started_to_created_pct") or 0.0)
    if started < FUNNEL_MIN_STARTED or conv >= FUNNEL_MAX_CONVERSION_PCT:
        return []
    return [{
        "detector": "request_flow_abandonment",
        "affected_route": "/client",
        "severity": "medium",
        "confidence": round(min(0.9, 0.5 + started / 50.0), 2),
        "raw_observation": {"request_started": started, "request_created": created,
                            "started_to_created_pct": conv,
                            "requests_created_real": (data.get("backend_check") or {}).get("requests_created_real")},
        "finding": f"Din {started} clienți care încep o cerere, doar {conv}% o finalizează (sub pragul {FUNNEL_MAX_CONVERSION_PCT}%).",
        "hypothesis": "Wizardul de cerere are un pas de fricțiune (buget/descriere) care descurajează finalizarea.",
        "recommended_action": "Simplifică wizardul de cerere: mută hint-ul de preț mai devreme și fă câmpurile opționale mai clare.",
        "verification_criteria": f"started_to_created_pct urcă peste {FUNNEL_MAX_CONVERSION_PCT}% la următoarea observație.",
    }]


async def observe() -> list[dict]:
    """Rulează toate detectoarele deterministe. Bounded la MAX_FINDINGS_PER_RUN."""
    findings: list[dict] = []
    for detector in (_detect_high_bounce_pages, _detect_request_flow_abandonment):
        try:
            findings.extend(await detector())
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[loop] detector {detector.__name__} failed: {e}")
    # prioritizează medium înaintea low, apoi bound dur
    findings.sort(key=lambda f: (0 if f["severity"] == "medium" else 1, -float(f.get("confidence") or 0)))
    return findings[:MAX_FINDINGS_PER_RUN]


# ═══════════════════════ 2. FINDING (admin_ai_findings) ═══════════════════════
def _composite_key(obs: dict) -> str:
    return f"{SOURCE}:{obs['detector']}:{obs['affected_route']}"


async def get_or_create_finding(obs: dict) -> tuple[dict, bool]:
    """Idempotent: NU recreează un finding activ sau recent pentru aceeași observație."""
    key = _composite_key(obs)
    window = (datetime.now(timezone.utc) - timedelta(hours=DEDUP_WINDOW_HOURS)).isoformat()
    existing = await db.admin_ai_findings.find_one({"composite_key": key})
    if existing and (existing.get("status") in ("open", "triaged") or (existing.get("last_seen_at") or "") >= window):
        await db.admin_ai_findings.update_one(
            {"composite_key": key},
            {"$set": {"last_seen_at": _now(), "severity": obs["severity"], "confidence": obs["confidence"],
                      "evidence": obs["raw_observation"]}, "$inc": {"occurrences": 1}},
        )
        existing = await db.admin_ai_findings.find_one({"composite_key": key})
        return existing, False
    now = _now()
    doc = {
        "id": str(uuid.uuid4()),
        "composite_key": key,
        "source": SOURCE,
        "pattern": obs["detector"],
        "label": "Fricțiune comercială (Analytics)",
        "severity": obs["severity"],                 # doar low/medium (nu penalizează Security)
        "confidence": obs["confidence"],
        "description": obs["finding"],
        "raw_observation": obs["raw_observation"],
        "evidence": obs["raw_observation"],
        "hypothesis": obs["hypothesis"],
        "affected_route": obs["affected_route"],
        "affected_function": _fn_for_route(obs["affected_route"]),
        "recommended_action": obs["recommended_action"],
        "verification_criteria": obs["verification_criteria"],
        "action_class": ACTION_POLICY.get(obs["detector"], "MEDIUM"),
        "entity_type": "route",
        "entity_id": obs["affected_route"],
        "entity_label": obs["affected_route"],
        "status": "open",
        "first_seen_at": now,
        "last_seen_at": now,
        "created_at": now,
        "occurrences": 1,
        "scan_id": now,
    }
    await db.admin_ai_findings.insert_one(doc)
    doc.pop("_id", None)
    return doc, True


def _fn_for_route(route: str) -> str:
    if route.startswith("/client"):
        return "FN-009 Marketplace / Client flow"
    if route.startswith("/specialist"):
        return "FN-009 Marketplace / Specialist"
    return "FN-001 Analytics & Growth"


# ═══════════════════════ 3+4. DECIDE / POLICY / RISK + ACT ═══════════════════════
async def _governance() -> dict:
    """Sursa de adevăr pentru execuția autonomă = `self_driving_settings` (kill-switch EXISTENT,
    prin `self_driving.get_settings()`). NU există buget monetar separat în platformă; limitele
    per-rulare = `MAX_FINDINGS_PER_RUN` + fereastra de dedup. Loop-ul RESPECTĂ acest kill-switch:
    dacă `low_risk_autopilot` e OFF, NU auto-execută (fail-safe, motiv înregistrat în ledger)."""
    try:
        from autonomy.self_driving import get_settings
        s = await get_settings()
        return {"low_risk_autopilot": bool(s.get("low_risk_autopilot", True)), "source": "self_driving_settings.main"}
    except Exception:  # noqa: BLE001
        return {"low_risk_autopilot": True, "source": "default"}


async def _existing_todo_for(key: str) -> dict | None:
    return await db.admin_todos.find_one({"source": SOURCE, "finding_key": key, "done": False})


async def _existing_approval_for(key: str) -> dict | None:
    return await db.admin_approvals.find_one({"finding_key": key, "status": "pending"})


async def _create_todo(finding: dict) -> dict:
    key = finding["composite_key"]
    existing = await _existing_todo_for(key)
    if existing:
        return {"todo_id": existing["id"], "reused": True}
    todo = {
        "id": str(uuid.uuid4()),
        "text": f"[Autonomy·Analytics] {finding['recommended_action']}",
        "priority": "medium" if finding["severity"] == "medium" else "low",
        "done": False,
        "created_at": _now(),
        "created_by": "autonomy_loop",
        "source": SOURCE,
        "finding_key": key,
        "evidence": finding.get("evidence"),
    }
    await db.admin_todos.insert_one(todo)
    return {"todo_id": todo["id"], "reused": False}


async def _create_approval(finding: dict) -> dict:
    key = finding["composite_key"]
    existing = await _existing_approval_for(key)
    if existing:
        return {"approval_id": existing["id"], "reused": True}
    approval_id = str(uuid.uuid4())
    doc = {
        "id": approval_id,
        "action": "analytics_loop_remediation",
        "payload": {"finding_key": key, "recommended_action": finding["recommended_action"],
                    "affected_route": finding["affected_route"], "severity": finding["severity"]},
        "scope": "general",
        "finding_key": key,
        "requested_by": "autonomy_loop",
        "requested_by_email": "autonomy@propmanage.ai",
        "requested_by_seniority": "junior",   # rămâne pending → necesită aprobare senior/human
        "reason": finding["description"],
        "evidence": finding.get("evidence"),
        "status": "pending",
        "created_at": _now(),
    }
    await db.admin_approvals.insert_one(doc)
    try:
        from services import notify
        async for reviewer in db.users.find({"role": "admin", "admin_scope": "general", "is_active": {"$ne": False}}):
            await notify(str(reviewer.get("_id")), "⚠️ Propunere autonomie (aprobare)",
                         f"Loop-ul operațional propune: {finding['recommended_action']}",
                         type_="admin_approval", link="/admin/approvals")
    except Exception:  # noqa: BLE001
        pass
    return {"approval_id": approval_id, "reused": False}


async def decide_and_act(finding: dict, autoexec_allowed: bool = True) -> dict:
    """Clasifică riscul și acționează. SAFE → auto todo + rezolvă finding.
    MEDIUM/HIGH → propunere aprobare (gate uman), finding rămâne open.
    Respectă guvernanța: dacă `autoexec_allowed` e False (kill-switch OFF), SAFE NU se execută
    (fail-safe, finding rămâne open, motiv înregistrat). Safe-on-failure: creăm întâi artefactul."""
    action_class = finding.get("action_class") or ACTION_POLICY.get(finding.get("pattern"), "MEDIUM")
    key = finding["composite_key"]
    if action_class in ("SAFE", "REVERSIBLE"):
        if not autoexec_allowed:
            await db.admin_ai_findings.update_one(
                {"composite_key": key},
                {"$set": {"status": "open", "autonomy_action": {"type": "blocked_governance",
                          "class": action_class, "reason": "low_risk_autopilot OFF (self_driving_settings)"}}},
            )
            return {"action_class": action_class, "actor": "autonomous(blocat)",
                    "action": {"type": "blocked_governance", "reason": "low_risk_autopilot OFF (self_driving_settings)"},
                    "rollback": {"how": "n/a — nicio execuție"}, "human_gate": False, "blocked": True}
        res = await _create_todo(finding)
        # marcăm finding-ul rezolvat DOAR după ce task-ul de remediere există (safe)
        await db.admin_ai_findings.update_one(
            {"composite_key": key},
            {"$set": {"status": "resolved", "resolved_at": _now(), "resolved_by": "autonomy_loop",
                      "resolution_note": "autonomy_loop: acțiune SAFE — task de remediere creat în admin_todos.",
                      "autonomy_action": {"type": "todo", "todo_id": res["todo_id"], "class": action_class}}},
        )
        return {"action_class": action_class, "actor": "autonomous",
                "action": {"type": "todo", "todo_id": res["todo_id"], "reused": res["reused"]},
                "rollback": {"how": "close/delete todo", "todo_id": res["todo_id"]},
                "human_gate": False}
    # MEDIUM / HIGH → gate uman
    res = await _create_approval(finding)
    await db.admin_ai_findings.update_one(
        {"composite_key": key},
        {"$set": {"status": "open", "autonomy_action": {"type": "approval", "approval_id": res["approval_id"],
                  "class": action_class, "awaiting": "human_approval"}}},
    )
    return {"action_class": action_class, "actor": "autonomous→human",
            "action": {"type": "approval", "approval_id": res["approval_id"], "reused": res["reused"]},
            "rollback": {"how": "reject approval", "approval_id": res["approval_id"]},
            "human_gate": True}


# ═══════════════════════ 5. VERIFY ═══════════════════════
async def verify(finding: dict, act: dict) -> dict:
    checks = {}
    f = await db.admin_ai_findings.find_one({"composite_key": finding["composite_key"]}, {"_id": 0, "status": 1})
    checks["finding_recorded"] = bool(f)
    checks["finding_status"] = (f or {}).get("status")
    a = act.get("action") or {}
    if a.get("type") == "todo":
        checks["todo_exists"] = bool(await db.admin_todos.find_one({"id": a.get("todo_id")}, {"_id": 1}))
    elif a.get("type") == "approval":
        ap = await db.admin_approvals.find_one({"id": a.get("approval_id")}, {"_id": 0, "status": 1})
        checks["approval_exists"] = bool(ap)
        checks["approval_status"] = (ap or {}).get("status")
    checks["ok"] = bool(checks.get("finding_recorded") and (checks.get("todo_exists") or checks.get("approval_exists")))
    return checks


# ═══════════════════════ 7. LEARN ═══════════════════════
async def learn(current_keys: set[str]) -> dict:
    """Dacă un finding analytics_loop încă OPEN nu mai apare în observația curentă
    (semnalul a dispărut) → îl marcăm rezolvat (învățare). Bounded."""
    resolved = []
    cursor = db.admin_ai_findings.find({"source": SOURCE, "status": "open"}).limit(50)
    async for f in cursor:
        key = f.get("composite_key")
        if key and key not in current_keys:
            await db.admin_ai_findings.update_one(
                {"composite_key": key},
                {"$set": {"status": "resolved", "resolved_at": _now(), "resolved_by": "autonomy_loop",
                          "resolution_note": "autonomy_loop LEARN: semnalul a dispărut la re-observație (criteriu de verificare îndeplinit)."}},
            )
            resolved.append(key)
    return {"auto_resolved": len(resolved), "keys": resolved}


# ═══════════════════════ ORCHESTRATOR ═══════════════════════
async def _operational_score() -> float | None:
    try:
        from routes.autonomy import load_targets
        from autonomy.engine import compute_autonomy_scores
        cfg = await load_targets()
        report = await compute_autonomy_scores(weights=cfg["weights"], targets=cfg["targets"])
        return (report.get("breakdown_summary") or report.get("scores") or {}).get("operational")
    except Exception:  # noqa: BLE001
        return None


async def run_loop_tick(triggered_by: str = "manual") -> dict:
    """O rulare completă a buclei. Idempotent, bounded, safe-on-failure."""
    run_id = str(uuid.uuid4())
    started_at = _now()
    steps = []
    gov = await _governance()
    observations = await observe()
    current_keys = {_composite_key(o) for o in observations}
    findings_created = 0
    actions_taken = {"todo": 0, "approval": 0, "blocked_governance": 0}
    for obs in observations:
        try:
            finding, created = await get_or_create_finding(obs)
            if created:
                findings_created += 1
            # dacă finding-ul e deja handled real (todo/approval) → nu re-acționăm.
            # blocked_governance NU e „handled" → se reîncearcă când guvernanța permite.
            already = finding.get("autonomy_action")
            if not created and already and already.get("type") != "blocked_governance":
                steps.append({"detector": obs["detector"], "route": obs["affected_route"],
                              "finding_key": finding["composite_key"], "created": False,
                              "decision": "no_change (deja procesat)", "action": already, "verify": {"ok": True}})
                continue
            act = await decide_and_act(finding, autoexec_allowed=gov["low_risk_autopilot"])
            if act["action"]["type"] == "todo" and not act["action"].get("reused"):
                actions_taken["todo"] += 1
            elif act["action"]["type"] == "approval" and not act["action"].get("reused"):
                actions_taken["approval"] += 1
            elif act["action"]["type"] == "blocked_governance":
                actions_taken["blocked_governance"] += 1
            ver = await verify(finding, act)
            steps.append({
                "detector": obs["detector"], "route": obs["affected_route"],
                "severity": obs["severity"], "confidence": obs["confidence"],
                "finding_key": finding["composite_key"], "created": created,
                "raw_observation": obs["raw_observation"], "hypothesis": obs["hypothesis"],
                "decision": f"{act['action_class']} → {act['action']['type']}"
                            + (" (aprobare umană)" if act["human_gate"] else " (auto)"),
                "action": act["action"], "actor": act["actor"], "human_gate": act["human_gate"],
                "rollback": act["rollback"], "verify": ver,
            })
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[loop] step failed for {obs.get('detector')}: {e}")
            steps.append({"detector": obs.get("detector"), "route": obs.get("affected_route"),
                          "error": str(e)[:200], "verify": {"ok": False}})
    learned = await learn(current_keys)
    op_after = await _operational_score()
    run = {
        "id": run_id,
        "triggered_by": triggered_by,
        "started_at": started_at,
        "finished_at": _now(),
        "governance": gov,
        "observations": len(observations),
        "findings_created": findings_created,
        "actions_taken": actions_taken,
        "learned": learned,
        "operational_score_after": op_after,
        "steps": steps,
        "outcome": "applied" if (findings_created or actions_taken["todo"] or actions_taken["approval"] or learned["auto_resolved"]) else ("blocked_by_governance" if actions_taken["blocked_governance"] else "no_change"),
    }
    await db.autonomy_loop_runs.insert_one(dict(run))
    run.pop("_id", None)
    logger.info(f"[loop] tick {run['outcome']} — obs={run['observations']} findings={findings_created} "
                f"todos={actions_taken['todo']} approvals={actions_taken['approval']} learned={learned['auto_resolved']}")
    return run
