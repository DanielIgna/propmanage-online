"""Digital Twin — Phase I: build issue report PDF (screenshot 3D + 2D extract + thread)."""
import io
import base64
from datetime import datetime
from typing import Optional, List

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
from reportlab.lib.enums import TA_LEFT


CATEGORY_LABELS = {
    "general": "General", "structural": "Structural", "plumbing": "Instalații sanitare",
    "electrical": "Electric", "hvac": "HVAC", "finish": "Finisaje", "defect": "Defect",
}
PRIORITY_LABELS = {"low": "Scăzută", "normal": "Normală", "high": "Ridicată", "urgent": "Urgentă"}
PRIORITY_COLORS = {"low": "#94a3b8", "normal": "#60a5fa", "high": "#f59e0b", "urgent": "#ef4444"}
STATUS_LABELS = {"open": "Deschis", "in_review": "În analiză", "resolved": "Rezolvat", "rejected": "Respins"}


def _build_styles():
    styles = getSampleStyleSheet()
    return {
        "h1": ParagraphStyle("H1", parent=styles["Heading1"], fontSize=22, textColor=colors.HexColor("#0a0a0b"), spaceAfter=10),
        "h2": ParagraphStyle("H2", parent=styles["Heading2"], fontSize=14, textColor=colors.HexColor("#0a0a0b"), spaceBefore=14, spaceAfter=8),
        "body": ParagraphStyle("Body", parent=styles["BodyText"], fontSize=10, leading=14, textColor=colors.HexColor("#1f1f23")),
        "small": ParagraphStyle("Small", parent=styles["BodyText"], fontSize=8.5, leading=11, textColor=colors.HexColor("#666"), alignment=TA_LEFT),
        "label": ParagraphStyle("Label", parent=styles["BodyText"], fontSize=8, textColor=colors.HexColor("#888"), spaceAfter=2),
        "comment": ParagraphStyle("Comment", parent=styles["BodyText"], fontSize=9.5, leading=13, textColor=colors.HexColor("#2a2a2f"), leftIndent=10),
    }


def _decode_screenshot(b64: Optional[str]) -> Optional[io.BytesIO]:
    if not b64:
        return None
    try:
        # Strip data URI prefix if present
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        raw = base64.b64decode(b64)
        return io.BytesIO(raw)
    except Exception:  # noqa: BLE001
        return None


def _render_plan_extract(plan_file_path: Optional[str], page: int = 1) -> Optional[io.BytesIO]:
    """Render a single page from the plan PDF to PNG via pdf2image (if poppler installed)."""
    if not plan_file_path:
        return None
    try:
        from pdf2image import convert_from_path  # type: ignore
        pages = convert_from_path(plan_file_path, dpi=120, first_page=page, last_page=page)
        if not pages:
            return None
        buf = io.BytesIO()
        pages[0].save(buf, format="PNG")
        buf.seek(0)
        return buf
    except Exception:  # noqa: BLE001
        return None


def build_issue_report_pdf(
    project: dict,
    pin: dict,
    comments: List[dict],
    sender: dict,
    custom_message: Optional[str] = None,
    screenshot_3d_b64: Optional[str] = None,
    plan_file_path: Optional[str] = None,
    plan_page: int = 1,
    plan_title: Optional[str] = None,
) -> io.BytesIO:
    """Compose a multi-section PDF: header → pin meta → 3D screenshot → 2D extract → comments."""
    styles = _build_styles()
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=1.5 * cm, rightMargin=1.5 * cm,
        topMargin=1.5 * cm, bottomMargin=1.5 * cm,
        title=f"Raport problemă — {pin.get('title', 'Pin')}",
    )
    story = []

    # ============ HEADER ============
    story.append(Paragraph(f"Raport problemă · {project.get('name', 'Proiect')}", styles["h1"]))
    story.append(Paragraph(
        f"Generat: <b>{datetime.now().strftime('%d.%m.%Y %H:%M')}</b> · "
        f"Expeditor: <b>{sender.get('name', sender.get('email', '—'))}</b> ({sender.get('role', '—')})",
        styles["small"],
    ))
    story.append(Spacer(1, 0.4 * cm))

    # ============ PIN META TABLE ============
    cat = CATEGORY_LABELS.get(pin.get("category", "general"), pin.get("category", "—"))
    prio = PRIORITY_LABELS.get(pin.get("priority", "normal"), pin.get("priority", "—"))
    prio_color = PRIORITY_COLORS.get(pin.get("priority", "normal"), "#60a5fa")
    status = STATUS_LABELS.get(pin.get("status", "open"), pin.get("status", "—"))

    rows = [
        ["Titlu pin", pin.get("title", "—")],
        ["Categorie", cat],
        ["Prioritate", prio],
        ["Status", status],
        ["Autor", f"{pin.get('author_name', '—')} ({pin.get('author_role', '—')})"],
        ["Creat", _fmt_date(pin.get("created_at"))],
    ]
    pos = pin.get("position") or {}
    if pos:
        rows.append(["Poziție 3D", f"x={pos.get('x')} y={pos.get('y')} z={pos.get('z')} m"])

    t = Table([[Paragraph(f"<b>{k}</b>", styles["body"]), Paragraph(str(v), styles["body"])] for k, v in rows],
              colWidths=[4 * cm, 13 * cm])
    t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#e5e5e5")),
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f8f8f9")),
        ("INNERPADDING", (0, 0), (-1, -1), 5),
        ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#dddde0")),
    ]))
    # Priority pill highlight
    t.setStyle(TableStyle([("TEXTCOLOR", (1, 2), (1, 2), colors.HexColor(prio_color))]))
    story.append(t)
    story.append(Spacer(1, 0.5 * cm))

    if pin.get("description"):
        story.append(Paragraph("<b>Descriere</b>", styles["h2"]))
        story.append(Paragraph(pin["description"].replace("\n", "<br/>"), styles["body"]))
        story.append(Spacer(1, 0.4 * cm))

    if custom_message:
        story.append(Paragraph("<b>Mesaj expeditor</b>", styles["h2"]))
        story.append(Paragraph(custom_message.replace("\n", "<br/>"), styles["body"]))
        story.append(Spacer(1, 0.4 * cm))

    # ============ 3D SCREENSHOT ============
    shot = _decode_screenshot(screenshot_3d_b64)
    if shot:
        story.append(Paragraph("<b>Captură viewer 3D</b>", styles["h2"]))
        try:
            img = Image(shot, width=17 * cm, height=10 * cm, kind="proportional")
            story.append(img)
        except Exception:  # noqa: BLE001
            story.append(Paragraph("(captură 3D indisponibilă)", styles["small"]))
        story.append(Spacer(1, 0.4 * cm))

    # ============ 2D PLAN EXTRACT ============
    plan_img = _render_plan_extract(plan_file_path, page=plan_page)
    if plan_img:
        story.append(PageBreak())
        title = plan_title or "Plan 2D ancorat"
        story.append(Paragraph(f"<b>{title} · pagina {plan_page}</b>", styles["h2"]))
        try:
            img = Image(plan_img, width=17 * cm, height=22 * cm, kind="proportional")
            story.append(img)
        except Exception:  # noqa: BLE001
            story.append(Paragraph("(extract plan indisponibil)", styles["small"]))
        story.append(Spacer(1, 0.4 * cm))

    # ============ COMMENTS THREAD ============
    if comments:
        story.append(PageBreak())
        story.append(Paragraph(f"<b>Fir comentarii ({len(comments)})</b>", styles["h2"]))
        for c in comments:
            who = f"<b>{c.get('author_name', '—')}</b> · {c.get('author_role', '—')} · {_fmt_date(c.get('created_at'))}"
            story.append(Paragraph(who, styles["label"]))
            msg = (c.get("message") or "").replace("\n", "<br/>")
            story.append(Paragraph(msg, styles["comment"]))
            story.append(Spacer(1, 0.25 * cm))

    # ============ FOOTER ============
    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph(
        f"Document generat automat de PropManage Digital Twin · {datetime.now().strftime('%d.%m.%Y %H:%M')} UTC",
        styles["small"],
    ))

    doc.build(story)
    buf.seek(0)
    return buf


def _fmt_date(s: Optional[str]) -> str:
    if not s:
        return "—"
    try:
        # Accept ISO date with timezone
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.strftime("%d.%m.%Y %H:%M")
    except Exception:  # noqa: BLE001
        return s[:16]
