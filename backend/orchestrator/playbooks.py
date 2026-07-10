"""Autonomy Orchestrator — Sprint 1 playbooks.

1. smoke_fail            → auto-create QA Copilot session with findings
2. autonomy_score_drop   → corrective autopilot sweep + recovery check
3. webhook_fail          → retry queue (email) / repeated-failure monitor (stripe)
"""
import logging
import uuid
from datetime import datetime, timezone, timedelta

from db import db

logger = logging.getLogger("propmanage.orchestrator.playbooks")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


# ============================================================================
# 1. SMOKE-FAIL → AUTO QA SESSION
# ============================================================================
async def handle_smoke_fail(payload: dict) -> dict:
    from orchestrator.engine import notify_admins
    steps_log = []
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0).isoformat()

    failed_steps = payload.get("steps") or []
    lines = [
        f"- {s.get('name')}: {s.get('error') or ('HTTP ' + str(s.get('status_code')))}"
        for s in failed_steps
    ]
    finding_text = (
        f"Smoke test FAILED {payload.get('failed')}/{payload.get('total')} pe {payload.get('base_url')}:\n"
        + "\n".join(lines)
    )[:4000]
    finding = {
        "id": uuid.uuid4().hex,
        "text": finding_text,
        "status": "open",
        "severity": "high",
        "source": "orchestrator",
        "ts": _now(),
        "created_at": _now(),
        "ai_analysis": None,
    }

    existing = await db.qa_sessions.find_one({
        "auto_source": "orchestrator_smoke_fail",
        "status": "active",
        "created_at": {"$gte": today_start},
    })
    if existing:
        await db.qa_sessions.update_one(
            {"id": existing["id"]},
            {"$push": {"findings": finding}, "$set": {"updated_at": _now()}},
        )
        steps_log.append({
            "action": "append_finding_existing_session", "ok": True,
            "detail": f"Finding adăugat la sesiunea QA auto existentă '{existing.get('title')}'",
        })
    else:
        sid = uuid.uuid4().hex
        doc = {
            "id": sid,
            "title": f"AUTO · Smoke Test FAILED · {now.date().isoformat()}",
            "goal": "Sesiune creată automat de Autonomy Orchestrator la eșuarea smoke test-ului. Investighează pașii eșuați din findings.",
            "role_being_tested": "client",
            "area": "smoke-test",
            "status": "active",
            "findings": [finding],
            "generated_prompt": None,
            "owner_email": "orchestrator@propmanage.ai",
            "auto_source": "orchestrator_smoke_fail",
            "created_at": _now(),
            "updated_at": _now(),
        }
        await db.qa_sessions.insert_one(doc)
        steps_log.append({
            "action": "create_qa_session", "ok": True,
            "detail": f"Sesiune QA creată automat: '{doc['title']}' cu {len(failed_steps)} pași eșuați ca finding",
        })

    n = await notify_admins(
        "🤖 Orchestrator: sesiune QA auto-creată (smoke fail)",
        f"Smoke test a eșuat ({payload.get('failed')}/{payload.get('total')}). Finding-urile au fost înregistrate automat în QA Copilot.",
        link="/admin/qa-copilot",
    )
    steps_log.append({"action": "notify_admins_inapp", "ok": True, "detail": f"{n} admini notificați in-app"})
    return {"steps": steps_log, "outcome": "auto_resolved", "minutes_saved": 20, "escalate": False}


# ============================================================================
# 2. AUTONOMY REFLEX (score drop → corrective sweep)
# ============================================================================
async def handle_autonomy_score_drop(payload: dict) -> dict:
    steps_log = []
    drops = payload.get("drops") or {}
    drop_txt = ", ".join(f"{k} −{v}pp" for k, v in drops.items()) or "necunoscut"

    if payload.get("test"):
        steps_log.append({
            "action": "corrective_sweep", "ok": True,
            "detail": f"SIMULARE — drop detectat ({drop_txt}); sweep-ul corectiv nu a fost rulat pe date reale",
        })
        steps_log.append({"action": "verify_recovery", "ok": True, "detail": "SIMULARE — recuperare confirmată"})
        return {"steps": steps_log, "outcome": "auto_resolved", "minutes_saved": 15, "escalate": False}

    from autonomy.autopilot import daily_autopilot_sweep
    sweep = await daily_autopilot_sweep()
    steps_log.append({
        "action": "corrective_sweep", "ok": True,
        "detail": (
            f"Drop detectat ({drop_txt}) → sweep corectiv rulat: "
            f"{sweep.get('qa_findings_resolved', 0)} QA findings rezolvate, "
            f"{sweep.get('ai_findings_dismissed', 0)} AI findings închise"
        ),
    })

    new_general = ((sweep.get("snapshot") or {}).get("general")) or 0
    prev_general = payload.get("prev_general") or 0
    recovered = new_general >= prev_general - 2
    steps_log.append({
        "action": "verify_recovery", "ok": recovered,
        "detail": f"Scor general după sweep: {new_general} (înainte de drop: {prev_general})",
    })

    if recovered:
        return {"steps": steps_log, "outcome": "auto_resolved", "minutes_saved": 15, "escalate": False}
    return {
        "steps": steps_log,
        "outcome": "escalated",
        "minutes_saved": 10,
        "escalate": True,
        "escalation_title": f"⚠ Autonomy score drop nerecuperat ({drop_txt})",
        "escalation_body": (
            f"Sweep-ul corectiv automat nu a readus scorul (acum {new_general}, anterior {prev_general}). "
            f"Verifică recomandările în Autonomy Engine."
        ),
        "escalation_link": "/admin/autonomy",
    }


# ============================================================================
# 3. WEBHOOK RETRY GUARDIAN
# ============================================================================
async def handle_webhook_fail(payload: dict) -> dict:
    source = payload.get("source") or "unknown"
    steps_log = []

    if source == "resend_email" and payload.get("to"):
        await db.orchestrator_retry_queue.insert_one({
            "id": uuid.uuid4().hex,
            "kind": "email",
            "payload": {"to": payload.get("to"), "subject": payload.get("subject"), "html": payload.get("html")},
            "attempts": 0,
            "max_attempts": 3,
            "status": "pending",
            "next_retry_at": (datetime.now(timezone.utc) + timedelta(minutes=2)).isoformat(),
            "created_at": _now(),
            "test": bool(payload.get("test")),
        })
        steps_log.append({
            "action": "enqueue_email_retry", "ok": True,
            "detail": (
                f"Email '{(payload.get('subject') or '')[:60]}' pus în coada de retry "
                f"(max 3 încercări, backoff exponențial, primul retry în ~2 min)"
            ),
        })
        return {"steps": steps_log, "outcome": "retry_scheduled", "minutes_saved": 0, "escalate": False}

    if source == "stripe":
        cutoff = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
        fails = await db.orchestrator_signals.count_documents({
            "kind": "webhook_fail",
            "payload.source": "stripe",
            "ts": {"$gte": cutoff},
        })
        steps_log.append({
            "action": "count_recent_stripe_failures", "ok": True,
            "detail": f"{fails} eșuări webhook Stripe în ultima oră (Stripe re-trimite automat evenimentul)",
        })
        if fails >= 3:
            return {
                "steps": steps_log,
                "outcome": "escalated",
                "minutes_saved": 5,
                "escalate": True,
                "escalation_title": "🚨 Webhook Stripe eșuează repetat",
                "escalation_body": f"{fails} eșuări de procesare webhook Stripe în ultima oră. Verifică cheile Stripe și logurile backend.",
            }
        return {"steps": steps_log, "outcome": "monitored", "minutes_saved": 5, "escalate": False}

    steps_log.append({"action": "classify_source", "ok": False, "detail": f"Sursă necunoscută: {source}"})
    return {"steps": steps_log, "outcome": "monitored", "minutes_saved": 0, "escalate": False}


# ============================================================================
# REGISTRY — signal kind → playbook
# ============================================================================
PLAYBOOKS = {
    "smoke_fail": {
        "id": "smoke_fail_to_qa",
        "name": "Smoke-Fail → Auto QA Session",
        "description": "La eșuarea smoke test-ului: creează automat sesiune QA Copilot cu pașii eșuați ca findings + notifică adminii in-app. Elimină triajul manual (~20 min/incident).",
        "handler": handle_smoke_fail,
    },
    "autonomy_score_drop": {
        "id": "autonomy_reflex",
        "name": "Autonomy Reflex",
        "description": "La scădere >5pp a scorului de autonomie (general sau pe axă): rulează sweep corectiv + verifică recuperarea. Escaladează doar dacă scorul nu revine (~15 min/incident).",
        "handler": handle_autonomy_score_drop,
    },
    "webhook_fail": {
        "id": "webhook_retry_guardian",
        "name": "Webhook Retry Guardian",
        "description": "Email Resend eșuat → retry automat cu backoff (max 3). Webhook Stripe eșuat → monitorizare; alertă doar la ≥3 eșuări/oră (~10 min/incident).",
        "handler": handle_webhook_fail,
    },
}
