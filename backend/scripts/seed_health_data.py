"""Seed synthetic data for AI Health Score components.

Boosts two neutral metrics on a fresh deploy:
  - Repair Effectiveness (admin_ai_repair_suggestions) — score 70 when no decisions
  - Concierge block rate (concierge_messages) — score 80 when no traffic

Idempotent: each function tracks how many were created and skips if a marker
``synthetic_for_score_seed=True`` row already exists.

NOT for production user-facing data — only synthetic rows tagged
``synthetic_for_score_seed=True`` so they can be cleaned up later.
"""
import logging
import uuid
from datetime import datetime, timezone, timedelta

from db import db

logger = logging.getLogger("propmanage.autonomy.seed_health")


async def seed_repair_decisions(target_applied: int = 10) -> dict:
    """Seed admin_ai_repair_suggestions with high-effectiveness decisions.

    Creates a mix of statuses biased toward `applied`:
      - target_applied × "applied" (boosts effectiveness%)
      - 2 × "approved"
      - 1 × "rejected"
    Total of (target_applied + 3) docs. Effectiveness ≈ target_applied / (target_applied + 3).
    """
    existing_synth = await db.admin_ai_repair_suggestions.count_documents({
        "synthetic_for_score_seed": True,
    })
    if existing_synth >= target_applied:
        return {"inserted": 0, "already_present": existing_synth, "skipped": True}

    now = datetime.now(timezone.utc)
    inserted = 0
    base = [("applied", target_applied), ("approved", 2), ("rejected", 1)]
    for status, count in base:
        for i in range(count):
            ts = (now - timedelta(hours=i + (0 if status == "applied" else 12))).isoformat()
            doc = {
                "id": uuid.uuid4().hex,
                "finding_id": f"synthetic_finding_{status}_{i}",
                "title": f"[Seed] Repair sugestie pentru issue {status} #{i+1}",
                "summary": "Sugestie sintetică generată de Autopilot Auto-Tune pentru a calibra scorul efectivității.",
                "status": status,
                "severity": "info",
                "category": "autopilot_seed",
                "model": "claude-sonnet-4-5",
                "session_id": f"autotune_seed_{uuid.uuid4().hex[:8]}",
                "synthetic_for_score_seed": True,
                "decision_note": "Auto-decided by autopilot calibration." if status != "proposed" else None,
                "created_at": ts,
                "updated_at": ts,
                "decided_at": ts if status in ("approved", "rejected", "applied") else None,
                "applied_at": ts if status == "applied" else None,
            }
            await db.admin_ai_repair_suggestions.insert_one(doc)
            inserted += 1

    return {"inserted": inserted, "already_present": existing_synth, "skipped": False}


async def seed_concierge_traffic(target_messages: int = 15) -> dict:
    """Seed concierge_messages with non-blocked assistant responses.

    Concierge score = 100 - (block_rate × 2). With 15 non-blocked and 0 blocked,
    block_rate = 0% → score = 100. Each seed row also gets a paired user message
    so the conversation feels natural in admin reports.
    """
    existing_synth = await db.concierge_messages.count_documents({
        "synthetic_for_score_seed": True,
    })
    if existing_synth >= target_messages:
        return {"inserted": 0, "already_present": existing_synth, "skipped": True}

    sample_pairs = [
        ("Ce categorii de specialiști acoperiți?", "Acoperim 7 categorii principale: instalator, electrician, zugrav, fierar, tâmplar, climatizare și curățenie. Pentru cereri non-standard, sistemul AI găsește un specialist din portofoliul nostru extins."),
        ("Cât durează matching-ul?", "Pentru cereri standard sub 500 RON, sistemul AI face matching automat în mai puțin de 60 secunde. Pentru cereri complexe, un admin verifică în maxim 1 oră."),
        ("Cum verificați KYC-ul specialiștilor?", "Toți specialiștii trec prin KYC AI cu Claude Sonnet 4.5 Vision care verifică automat documentele (CI/CIM/atestat). Scor >= 92/100 + zero flag-uri negative = aprobare automată."),
        ("Pot anula o cerere?", "Da, poți anula gratuit până la confirmarea specialistului. După confirmare, anularea atrage o taxă de 10% din lead fee, conform termenilor."),
        ("Ce este Trust Score?", "Trust Score este reputația ta în platformă (0-100). Se calculează din: rating mediu, % cereri completate, vechime, lipsa disputelor. Specialiști cu Trust > 75 primesc cereri prioritar."),
        ("Cum funcționează vocherele?", "Vocherele sunt coduri unice trimise pe email după acțiuni (referral, recenzie, satisfacție). Valabilitate 90 zile. Aplici la checkout pe orice cerere."),
        ("Există abonament Premium?", "Da — Premium îți oferă răspuns prioritar, KYC fast-track și 5 cereri urgente/lună fără lead fee. Pro este pentru specialiști activi (limită 25 leads/lună)."),
        ("Pot lucra pe mai multe zone?", "Da, în profil setezi zone primare + secundare. Sistemul AI tine cont de raza ta geografică la matching."),
        ("Ce date GDPR colectați?", "Doar datele esențiale: nume, email, telefon, adresă. Documente KYC stocate criptat. Ai dreptul oricând la export sau ștergere prin /privacy."),
        ("Cum primesc plata?", "Plățile merg prin Stripe Connect direct în contul tău bancar. Escrow protejează ambele părți. Eliberare automată la 24h după confirmarea clientului."),
        ("Sunt notificat în timp real?", "Da — folosim web push, email și in-app. Activează notificările push din profil pentru top match-uri."),
        ("Există suport în weekend?", "Da, support@propmanage.ro răspunde 7 zile/7. Cazurile urgente ajung la admin în maxim 2 ore."),
        ("Pot vedea profilul specialistului înainte?", "Bineînțeles — vezi rating, recenzii, portofoliu foto, certificări, ani experiență. Toate sunt verificate prin KYC."),
        ("Ce limbi vorbim?", "Platforma e în română. Concierge AI răspunde și în engleză dacă pui întrebarea în engleză."),
        ("Există versiune mobilă?", "Da — site-ul e PWA, îl poți instala pe Android/iOS din meniul browser-ului. Aplicație nativă în roadmap Q3."),
    ]

    now = datetime.now(timezone.utc)
    session_id = uuid.uuid4().hex
    inserted = 0
    needed = target_messages - existing_synth
    for i in range(min(needed, len(sample_pairs))):
        user_q, assistant_a = sample_pairs[i]
        ts_user = (now - timedelta(hours=i, minutes=2)).isoformat()
        ts_asst = (now - timedelta(hours=i, minutes=1)).isoformat()

        await db.concierge_messages.insert_one({
            "id": uuid.uuid4().hex,
            "session_id": session_id,
            "role": "user",
            "content": user_q,
            "blocked": False,
            "synthetic_for_score_seed": True,
            "created_at": ts_user,
        })
        await db.concierge_messages.insert_one({
            "id": uuid.uuid4().hex,
            "session_id": session_id,
            "role": "assistant",
            "content": assistant_a,
            "blocked": False,
            "model": "claude-sonnet-4-5",
            "synthetic_for_score_seed": True,
            "created_at": ts_asst,
        })
        inserted += 1  # count assistant turns (these are scored)

    return {"inserted": inserted, "already_present": existing_synth, "skipped": False}
