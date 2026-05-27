"""
PropManage email service.
Auto-detects provider: Resend (preferred) → SendGrid → Console fallback.
HTML templates are brand-styled (lime accent #d4ff3a, serif headings, dark theme).
"""
import os
import asyncio
import logging
from typing import Optional, List
from datetime import datetime, timezone

logger = logging.getLogger("propmanage.email")

# Auto-detect available provider
RESEND_KEY = os.environ.get("RESEND_API_KEY", "").strip()
SENDGRID_KEY = os.environ.get("SENDGRID_API_KEY", "").strip()
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "PropManage <onboarding@resend.dev>")
ADMIN_EMAILS_RAW = os.environ.get("ADMIN_NOTIFICATION_EMAILS", "")
ADMIN_EMAILS = [e.strip() for e in ADMIN_EMAILS_RAW.split(",") if e.strip()]
APP_URL = os.environ.get("APP_PUBLIC_URL", "https://propmanage.io")

PROVIDER = "resend" if RESEND_KEY else ("sendgrid" if SENDGRID_KEY else "console")

if PROVIDER == "resend":
    import resend
    resend.api_key = RESEND_KEY
    logger.info("Email provider: Resend (active)")
elif PROVIDER == "sendgrid":
    try:
        from sendgrid import SendGridAPIClient
        from sendgrid.helpers.mail import Mail
        _sg_client = SendGridAPIClient(SENDGRID_KEY)
        logger.info("Email provider: SendGrid (active)")
    except ImportError:
        PROVIDER = "console"
        logger.warning("sendgrid not installed - falling back to console")
else:
    logger.info("Email provider: console (no API key set - emails will print to logs)")

# ===================== Brand-styled HTML wrapper =====================

def _layout(title: str, preheader: str, body_html: str, cta_url: Optional[str] = None, cta_label: Optional[str] = None) -> str:
    """Wrap content in branded HTML email template (inline CSS, table-based)."""
    cta_block = ""
    if cta_url and cta_label:
        cta_block = f"""
        <tr>
          <td align="center" style="padding: 32px 0 8px 0;">
            <table border="0" cellpadding="0" cellspacing="0">
              <tr>
                <td bgcolor="#d4ff3a" style="border-radius: 999px; padding: 14px 32px;">
                  <a href="{cta_url}" target="_blank" style="font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 14px; font-weight: 600; color: #0a0a0b; text-decoration: none; letter-spacing: 0.5px;">{cta_label}</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        """

    return f"""<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>{title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0b; font-family: 'Helvetica Neue', Arial, sans-serif;">
  <span style="display:none;visibility:hidden;opacity:0;color:transparent;height:0;width:0;">{preheader}</span>
  <table border="0" cellpadding="0" cellspacing="0" width="100%" bgcolor="#0a0a0b">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table border="0" cellpadding="0" cellspacing="0" width="600" style="max-width: 600px; background-color: #131316; border-radius: 24px; overflow: hidden; border: 1px solid #ffffff15;">

          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px 32px; border-bottom: 1px solid #ffffff10;">
              <table border="0" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="vertical-align: middle;">
                    <table border="0" cellpadding="0" cellspacing="0"><tr>
                      <td bgcolor="#d4ff3a" style="width: 32px; height: 32px; border-radius: 8px; text-align: center; vertical-align: middle; font-size: 18px; line-height: 32px; color: #0a0a0b; font-weight: bold;">P</td>
                      <td style="padding-left: 12px; font-size: 18px; font-weight: 600; color: #ffffff; letter-spacing: -0.3px;">PropManage</td>
                    </tr></table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 8px 0; font-family: Georgia, 'Times New Roman', serif; font-size: 28px; line-height: 1.2; color: #ffffff; font-weight: normal;">{title}</h1>
              <div style="height: 24px;"></div>
              <div style="font-size: 14px; line-height: 1.6; color: #c8c8cc;">
                {body_html}
              </div>
              {cta_block}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; border-top: 1px solid #ffffff10; background-color: #0e0e10;">
              <p style="margin: 0; font-size: 11px; color: #888893; line-height: 1.5;">
                © {datetime.now().year} PropManage · Property Operating System<br/>
                Acest email a fost trimis de PropManage. Pentru întrebări, răspunde direct sau scrie pe <a href="mailto:support@propmanage.io" style="color: #d4ff3a; text-decoration: none;">support@propmanage.io</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

# ===================== Send function =====================

async def send_email(to: str | List[str], subject: str, html: str, plain: Optional[str] = None, attachments: Optional[List[dict]] = None) -> dict:
    """Sends an email via active provider. Returns dict {ok, provider, id|error}.

    attachments: optional list of dicts. Resend format: [{filename, content (base64 str)}].
    For SendGrid we convert to its expected schema (filename, content, type, disposition).
    Console provider just logs that attachments would be sent.
    """
    recipients = [to] if isinstance(to, str) else to
    plain_text = plain or "View this email in HTML"

    if PROVIDER == "resend":
        try:
            params = {"from": SENDER_EMAIL, "to": recipients, "subject": subject, "html": html, "text": plain_text}
            if attachments:
                params["attachments"] = attachments
            result = await asyncio.to_thread(resend.Emails.send, params)
            return {"ok": True, "provider": "resend", "id": result.get("id")}
        except Exception as e:
            logger.error(f"Resend send failed: {e}")
            return {"ok": False, "provider": "resend", "error": str(e)}

    if PROVIDER == "sendgrid":
        try:
            msg = Mail(from_email=SENDER_EMAIL, to_emails=recipients, subject=subject, html_content=html, plain_text_content=plain_text)
            if attachments:
                from sendgrid.helpers.mail import Attachment, FileContent, FileName, FileType, Disposition
                for a in attachments:
                    att = Attachment(
                        FileContent(a.get("content")),
                        FileName(a.get("filename", "attachment.pdf")),
                        FileType(a.get("type", "application/pdf")),
                        Disposition("attachment"),
                    )
                    msg.add_attachment(att)
            result = await asyncio.to_thread(_sg_client.send, msg)
            return {"ok": True, "provider": "sendgrid", "status_code": result.status_code}
        except Exception as e:
            logger.error(f"SendGrid send failed: {e}")
            return {"ok": False, "provider": "sendgrid", "error": str(e)}

    # console fallback - print to logs for dev visibility
    att_info = f" | Attachments: {len(attachments)} ({', '.join(a.get('filename', '?') for a in attachments)})" if attachments else ""
    logger.info(f"[EMAIL/CONSOLE] To: {recipients} | Subject: {subject}{att_info}")
    logger.info(f"[EMAIL/CONSOLE] HTML preview (first 200 chars): {html[:200]}")
    return {"ok": True, "provider": "console", "demo": True}


# ===================== Template functions =====================

def tpl_welcome(name: str, role: str) -> dict:
    role_label = {"client": "Proprietar", "specialist": "Specialist", "admin": "Administrator", "operator": "Operator"}.get(role, role)
    body = f"""
      <p>Bună {name},</p>
      <p>Bine ai venit pe <strong style="color:#d4ff3a;">PropManage</strong> — sistemul de operare pentru proprietățile tale!</p>
      <p>Contul tău a fost creat cu rolul: <strong>{role_label}</strong>.</p>
      <p>Următorii pași recomandați:</p>
      <ul style="color:#c8c8cc; padding-left: 18px; margin: 16px 0;">
        {"<li style='margin-bottom:6px;'>Adaugă o proprietate și solicită activarea Digital Twin</li><li style='margin-bottom:6px;'>Activează 2FA pentru securitate</li><li style='margin-bottom:6px;'>Explorează marketplace-ul de specialiști verificați</li>" if role == "client" else ""}
        {"<li style='margin-bottom:6px;'>Încarcă documentele de verificare (CI, asigurare, certificare)</li><li style='margin-bottom:6px;'>Configurează zonele și categoriile de servicii</li><li style='margin-bottom:6px;'>Acceptă primul lead și începe să câștigi</li>" if role == "specialist" else ""}
      </ul>
    """
    return {"subject": f"Bine ai venit pe PropManage, {name}!", "html": _layout("Bine ai venit pe PropManage", f"Hi {name}, contul tău este gata!", body, f"{APP_URL}/{role}", "Mergi la dashboard")}


def tpl_dispute_opened(recipient_name: str, request_title: str, opened_by_role: str, reason: str, role_path: str) -> dict:
    body = f"""
      <p>Bună {recipient_name},</p>
      <p>O <strong style="color:#fbbf24;">dispută a fost deschisă</strong> pe lucrarea <em>"{request_title}"</em> de către {opened_by_role}.</p>
      <div style="background:#fbbf2415; border-left:3px solid #fbbf24; padding:14px 18px; border-radius:12px; margin:18px 0;">
        <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#fbbf24; margin-bottom:6px;">Motiv invocat</div>
        <div style="color:#e5e5e5; font-style:italic;">"{reason}"</div>
      </div>
      <p>Fondurile din escrow sunt înghețate până la rezolvarea cazului de către echipa noastră.</p>
      <p>Te poți pregăti adunând dovezi (poze, mesaje, facturi) și prezentând perspectiva ta pe chat-ul lucrării.</p>
    """
    return {"subject": f"Dispută deschisă: {request_title}", "html": _layout("Dispută în analiză", "Echipa va media cazul.", body, f"{APP_URL}/{role_path}", "Deschide lucrarea")}


def tpl_dispute_resolved(recipient_name: str, request_title: str, amount: float, role: str) -> dict:
    action = "rambursare" if role == "client" else "plată"
    body = f"""
      <p>Bună {recipient_name},</p>
      <p>Disputa pe lucrarea <em>"{request_title}"</em> a fost <strong style="color:#34d399;">rezolvată</strong> de echipa de mediere.</p>
      <div style="background:#34d39915; border-left:3px solid #34d399; padding:14px 18px; border-radius:12px; margin:18px 0;">
        <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#34d399; margin-bottom:6px;">Decizie</div>
        <div style="color:#e5e5e5;">{action.capitalize()} acordată: <strong>{amount:.2f} RON</strong></div>
      </div>
      <p>Suma a fost virată în portofelul tău PropManage și este disponibilă imediat.</p>
    """
    return {"subject": f"Dispută rezolvată: {request_title}", "html": _layout("Dispută rezolvată", "Decizia de mediere a fost finalizată.", body, f"{APP_URL}/{role}", "Vezi portofelul")}


def tpl_design_phase_quote(client_name: str, specialist_name: str, request_title: str, phase_name: str, price: float, days: int, description: str) -> dict:
    body = f"""
      <p>Bună {client_name},</p>
      <p><strong>{specialist_name}</strong> a propus o ofertă pentru următoarea fază a proiectului tău de design interior — <em>{request_title}</em>:</p>
      <table border="0" cellpadding="0" cellspacing="0" style="width:100%; background:#1a1a1f; border-radius:14px; padding:18px; margin:18px 0;">
        <tr>
          <td style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#a78bfa; padding-bottom:6px;">Fază propusă</td>
          <td style="text-align:right; font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#a78bfa; padding-bottom:6px;">Durata</td>
        </tr>
        <tr>
          <td style="font-size:18px; color:#ffffff; padding-bottom:14px;">{phase_name}</td>
          <td style="text-align:right; font-size:14px; color:#e5e5e5; padding-bottom:14px;">{days} {('zi' if days == 1 else 'zile')}</td>
        </tr>
        <tr>
          <td colspan="2" style="border-top:1px solid #ffffff10; padding-top:14px;">
            <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#888893; margin-bottom:6px;">Preț</div>
            <div style="font-family:Georgia,serif; font-size:24px; color:#a78bfa;">{price:.0f} RON</div>
          </td>
        </tr>
      </table>
      <p style="color:#a8a8b0; font-size:13px;">{description}</p>
      <p>Acceptând oferta, suma va fi păstrată în escrow și eliberată specialistului doar după ce confirmi finalizarea fazei.</p>
    """
    return {"subject": f"Ofertă fază nouă: {phase_name}", "html": _layout("Nouă ofertă de fază", f"{specialist_name} a trimis o ofertă.", body, f"{APP_URL}/client", "Vezi oferta")}


def tpl_specialist_verified(name: str) -> dict:
    body = f"""
      <p>Bună {name},</p>
      <p>Felicitări! 🎉 Contul tău de specialist a fost <strong style="color:#34d399;">VERIFICAT</strong> de echipa PropManage.</p>
      <p>Beneficiile noi pe care le ai acum:</p>
      <ul style="color:#c8c8cc; padding-left: 18px; margin: 16px 0;">
        <li style="margin-bottom:6px;">Badge "VERIFIED" pe profilul public</li>
        <li style="margin-bottom:6px;">Prioritate în marketplace-ul de leads</li>
        <li style="margin-bottom:6px;">Acces la cereri premium (Design Interior, lucrări complexe)</li>
        <li style="margin-bottom:6px;">Vizibilitate îmbunătățită în căutările clienților</li>
      </ul>
    """
    return {"subject": "🎉 Cont VERIFIED — Bine ai venit în comunitatea PropManage", "html": _layout("Cont verificat cu succes", "Acces complet la marketplace.", body, f"{APP_URL}/specialist", "Vezi dashboard")}


def tpl_escrow_funded(specialist_name: str, request_title: str, amount: float, client_name: str) -> dict:
    body = f"""
      <p>Bună {specialist_name},</p>
      <p>Clientul <strong>{client_name}</strong> a virat <strong style="color:#34d399;">{amount:.0f} RON</strong> în escrow pentru lucrarea <em>"{request_title}"</em>.</p>
      <p>Poți începe lucrarea în siguranță — fondurile sunt protejate și vor fi eliberate către portofelul tău (95% din suma totală) după ce clientul confirmă finalizarea.</p>
    """
    return {"subject": f"💰 Escrow alimentat: {amount:.0f} RON", "html": _layout("Plată în escrow primită", "Începe lucrarea în siguranță.", body, f"{APP_URL}/specialist", "Vezi lucrările")}


def tpl_dt_pin_created(recipient_name: str, project_name: str, pin_title: str, category: str, priority: str, author_name: str) -> dict:
    body = f"""
      <p>Bună {recipient_name},</p>
      <p><strong style="color:#10b981;">{author_name}</strong> a creat un pin nou în proiectul Digital Twin <em>"{project_name}"</em>.</p>
      <div style="background:#10b98115; border-left:3px solid #10b981; padding:14px 18px; border-radius:12px; margin:18px 0;">
        <div style="font-size:11px; text-transform:uppercase; letter-spacing:0.5px; color:#10b981; margin-bottom:6px;">Pin · {category} · {priority}</div>
        <div style="color:#e5e5e5; font-weight:600; font-size:15px;">{pin_title}</div>
      </div>
      <p>Deschide modelul 3D pentru a vedea poziția exactă și a comenta.</p>
    """
    return {"subject": f"📌 Pin nou pe Digital Twin: {pin_title}", "html": _layout("Pin colaborativ nou", f"Notă pe {project_name}", body, f"{APP_URL}/digital-twin", "Deschide proiectul")}


def tpl_dt_comment_added(recipient_name: str, project_name: str, pin_title: str, author_name: str, author_role: str, message: str) -> dict:
    short = (message[:200] + "…") if len(message) > 200 else message
    role_label = {"client": "Proprietar", "specialist": "Specialist", "admin": "Administrator", "operator": "Operator", "architect": "Arhitect"}.get(author_role, author_role or "Utilizator")
    body = f"""
      <p>Bună {recipient_name},</p>
      <p><strong style="color:#10b981;">{author_name}</strong> ({role_label}) a comentat pe pin-ul <em>"{pin_title}"</em> din proiectul <strong>{project_name}</strong>.</p>
      <div style="background:#0f172a; border-left:3px solid #60a5fa; padding:14px 18px; border-radius:12px; margin:18px 0;">
        <div style="color:#e5e5e5; font-style:italic; line-height:1.6;">"{short}"</div>
      </div>
    """
    return {"subject": f"💬 Comentariu nou: {pin_title}", "html": _layout("Comentariu Digital Twin", f"Pin: {pin_title}", body, f"{APP_URL}/digital-twin", "Deschide threadul")}




# ===================== High-level helper that's fire-and-forget =====================

async def send_template(template_fn, *args, to: Optional[str] = None, fire_and_forget: bool = True, **kwargs) -> Optional[dict]:
    """
    Send a templated email. If `to` is None or empty, do nothing.
    If fire_and_forget=True (default), schedule and return immediately so the API endpoint isn't blocked.
    """
    if not to:
        return None
    try:
        tpl = template_fn(*args, **kwargs)
    except Exception as e:
        logger.error(f"Template render failed: {e}")
        return {"ok": False, "error": str(e)}

    if fire_and_forget:
        asyncio.create_task(send_email(to, tpl["subject"], tpl["html"]))
        return {"ok": True, "scheduled": True}
    return await send_email(to, tpl["subject"], tpl["html"])
