"""Follow-up automat pentru lead-uri warm (P2) — pregătit pentru Resend.

Scanare orară: lead-urile din `leads` cu segment configurat (default: warm),
încă în stage=new, mai vechi de delay_hours (default 48h) și fără follow-up trimis
primesc un email de recuperare. Config în settings namespace `leads_followup`
(enabled=False până la rezolvarea DNS Resend — se activează cu un switch).
"""
import logging
from datetime import datetime, timedelta, timezone

from db import db
from settings_store import get_settings, patch_settings

logger = logging.getLogger("propmanage.lead_followup")

DEFAULT_CONFIG = {
    "enabled": False,
    "delay_hours": 48,
    "segments": ["warm"],
    "max_attempts": 3,
    "batch_size": 25,
    "subject": "Am pregătit următorul pas pentru proiectul tău — PropManage",
    # Secvența 2 — nurture: ghid gratuit la 7 zile
    "nurture_enabled": False,
    "nurture_delay_hours": 168,
    "nurture_subject": "Ghid gratuit: 5 greșeli scumpe în renovări (și cum le eviți) — PropManage",
}

SERVICE_LABELS = {
    "interior_design": ("Interior Intelligence", "/design-interior"),
    "design_exterior": ("Exterior Design", "/design-exterior"),
    "arhitectura": ("Arhitectură", "/arhitectura"),
}


async def get_config() -> dict:
    saved = await get_settings("leads_followup")
    return {**DEFAULT_CONFIG, **(saved or {})}


async def update_config(updates: dict, who: str) -> dict:
    clean = {k: v for k, v in updates.items() if k in DEFAULT_CONFIG}
    if clean:
        await patch_settings("leads_followup", clean, who=who)
    return await get_config()


def _email_html(name: str, service_label: str, service_href: str) -> str:
    first = (name or "").split(" ")[0] or "bună"
    base = "https://propmanage.ro"
    return f"""
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#292524">
  <h2 style="color:#047857">Salut, {first}!</h2>
  <p>Ne-ai scris acum două zile despre un proiect <strong>{service_label}</strong> și nu vrem să rămâi blocat la faza de idee.</p>
  <p>Consultanța inițială e <strong>gratuită și fără nicio obligație</strong>: discutăm obiectivele, bugetul realist și pașii concreți — inclusiv ce poți face singur și unde merită un specialist.</p>
  <p style="margin:28px 0">
    <a href="{base}{service_href}#formular" style="background:#047857;color:#fff;padding:12px 26px;border-radius:999px;text-decoration:none;font-weight:bold">Programează consultanța gratuită</a>
  </p>
  <p>Dacă preferi, răspunde direct la acest email cu 2-3 rânduri despre proiect și revenim noi cu propuneri.</p>
  <p style="color:#78716c;font-size:13px">Echipa PropManage · specialiști verificați · plăți protejate prin escrow</p>
</div>"""


def _nurture_html(name: str, service_label: str, service_href: str) -> str:
    first = (name or "").split(" ")[0] or "bună"
    base = "https://propmanage.ro"
    return f"""
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;color:#292524">
  <h2 style="color:#047857">Salut, {first}! Un ghid care te scutește de bani pierduți</h2>
  <p>Indiferent când pornești proiectul <strong>{service_label}</strong>, acestea sunt cele 5 greșeli care costă cel mai mult:</p>
  <ol style="line-height:1.7">
    <li><strong>Proiectare fără audit tehnic</strong> — „surprizele" din spatele pereților explodează bugetul. Auditul costă puțin și le elimină.</li>
    <li><strong>Achiziții înainte de proiect</strong> — canapeaua care nu încape și gresia care se pătează. Întâi randările 3D, apoi comenzile.</li>
    <li><strong>Buget fără rezervă</strong> — planifică 10-15% tampon pe capitole, altfel șantierul se oprește la jumătate.</li>
    <li><strong>Echipe neverificate, plăți în avans</strong> — cere portofoliu și recenzii reale; plătește pe etape, ideal prin escrow.</li>
    <li><strong>Zero documentare</strong> — fără poze, planuri și garanții arhivate, orice intervenție viitoare pornește de la zero. Digital Twin rezolvă exact asta.</li>
  </ol>
  <p style="margin:28px 0">
    <a href="{base}{service_href}#formular" style="background:#047857;color:#fff;padding:12px 26px;border-radius:999px;text-decoration:none;font-weight:bold">Vreau o consultanță gratuită</a>
  </p>
  <p style="color:#78716c;font-size:13px">Echipa PropManage · specialiști verificați · plăți protejate prin escrow</p>
</div>"""


async def run_followup_scan(manual: bool = False, dry_run: bool = False) -> dict:
    """Secvența 1: recuperare lead-uri warm la 48h."""
    cfg = await get_config()
    if not cfg["enabled"] and not manual:
        return {"ran": False, "reason": "disabled"}
    return await _run_sequence(cfg, sequence="warm_48h", segments=cfg["segments"],
                               delay_hours=int(cfg["delay_hours"]), subject=cfg["subject"],
                               sent_field="followup.sent_at", attempts_field="followup.attempts",
                               template=_email_html, dry_run=dry_run)


async def run_nurture_scan(manual: bool = False, dry_run: bool = False) -> dict:
    """Secvența 2: ghid gratuit pentru lead-uri nurture la 7 zile."""
    cfg = await get_config()
    if not cfg["nurture_enabled"] and not manual:
        return {"ran": False, "reason": "disabled"}
    return await _run_sequence(cfg, sequence="nurture_7d", segments=["nurture"],
                               delay_hours=int(cfg["nurture_delay_hours"]), subject=cfg["nurture_subject"],
                               sent_field="followup.nurture_sent_at", attempts_field="followup.nurture_attempts",
                               template=_nurture_html, dry_run=dry_run)


async def _run_sequence(cfg: dict, sequence: str, segments: list, delay_hours: int, subject: str,
                        sent_field: str, attempts_field: str, template, dry_run: bool) -> dict:
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=delay_hours)).isoformat()
    q = {
        "segment": {"$in": segments},
        "stage": "new",
        "email": {"$nin": ["", None]},
        "created_at": {"$lt": cutoff},
        sent_field: {"$exists": False},
        "$or": [{attempts_field: {"$exists": False}},
                {attempts_field: {"$lt": int(cfg["max_attempts"])}}],
    }
    leads = await db.leads.find(q).sort("created_at", 1).to_list(int(cfg["batch_size"]))
    now = datetime.now(timezone.utc).isoformat()
    sent, failed = 0, 0
    for lead in leads:
        label, href = SERVICE_LABELS.get(lead.get("source"), ("PropManage", "/"))
        log = {"lead_id": lead.get("id"), "email": lead["email"], "source": lead.get("source"),
               "segment": lead.get("segment"), "tenant_id": lead.get("tenant_id", "main"),
               "sequence": sequence, "dry_run": dry_run, "at": now}
        if dry_run:
            log["status"] = "dry_run"
            await db.lead_followup_log.insert_one(dict(log))
            sent += 1
            continue
        try:
            from email_service import send_email
            result = await send_email(to=lead["email"], subject=subject,
                                      html=template(lead.get("name"), label, href))
            ok = bool(result and result.get("ok"))
            if ok:
                await db.leads.update_one({"_id": lead["_id"]}, {"$set": {sent_field: now, "updated_at": now}})
                log["status"] = "sent"
                sent += 1
            else:
                raise RuntimeError(str(result))
        except Exception as e:  # noqa: BLE001
            await db.leads.update_one({"_id": lead["_id"]},
                                      {"$inc": {attempts_field: 1},
                                       "$set": {"followup.last_error": str(e)[:300], "followup.last_attempt_at": now}})
            log["status"] = "failed"
            log["error"] = str(e)[:300]
            failed += 1
        await db.lead_followup_log.insert_one(dict(log))
    summary = {"ran": True, "sequence": sequence, "candidates": len(leads), "sent": sent,
               "failed": failed, "dry_run": dry_run, "at": now}
    if leads:
        logger.info(f"[lead_followup] {summary}")
    return summary
