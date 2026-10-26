"""Strategic Partners Dashboard + Cross-Reference Engine.

Unifică City Partners + Marketplace Partners într-o singură vedere admin.
Cross-Reference Engine: dat fiind un lead al unui City Partner (de ex.
administrator de bloc), găsește marketplace partners relevanți din același oraș
și sugerează conexiuni comerciale folosind Claude Sonnet 4.5.

Endpoints (super-admin only):
  GET  /api/admin/strategic-partners/dashboard          ecosystem overview
  POST /api/admin/strategic-partners/cross-ref/{lead_id}  AI cross-program match
  GET  /api/admin/strategic-partners/opportunities      precomputed cross matches
"""
import logging
import os
import uuid as _uuid
from datetime import datetime, timezone, date
from typing import Optional, List

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from db import db
from deps import get_current_user
from sub_admin_deps import is_super_admin

logger = logging.getLogger("propmanage.strategic_partners")
router = APIRouter(prefix="/api/admin/strategic-partners", tags=["admin-strategic-partners"])


def _require_super(user: dict) -> None:
    if not is_super_admin(user):
        raise HTTPException(403, "Doar super admin.")


@router.get("/dashboard")
async def dashboard(user=Depends(get_current_user)):
    """Aggregate view: side-by-side health of City + Marketplace ecosystems."""
    _require_super(user)

    # CITY
    city_total = await db.city_partners.count_documents({})
    city_active = await db.city_partners.count_documents({"status": "active"})
    city_onboarding = await db.city_partners.count_documents({"status": "onboarding"})
    city_leads = await db.city_partner_leads.count_documents({})
    city_conv = await db.city_partner_leads.count_documents({"stage": "converted"})
    city_rev = 0
    async for r in db.city_partner_leads.aggregate([{"$group": {"_id": None, "t": {"$sum": "$revenue_generated"}}}]):
        city_rev = r.get("t") or 0

    # MARKETPLACE
    mkt_total = await db.marketplace_partners.count_documents({})
    mkt_active = await db.marketplace_partners.count_documents({"status": "active"})
    mkt_onboarding = await db.marketplace_partners.count_documents({"status": "onboarding"})
    mkt_leads = await db.marketplace_leads.count_documents({})
    mkt_conv = await db.marketplace_leads.count_documents({"stage": "converted"})
    mkt_rev = 0
    async for r in db.marketplace_leads.aggregate([{"$group": {"_id": None, "t": {"$sum": "$revenue_generated"}}}]):
        mkt_rev = r.get("t") or 0

    # City coverage by city
    city_geo = {}
    async for p in db.city_partners.find({"status": {"$ne": "terminated"}}):
        c = p.get("city") or "—"
        city_geo[c] = city_geo.get(c, 0) + 1
    # Marketplace coverage by city
    mkt_geo = {}
    async for p in db.marketplace_partners.find({"status": {"$ne": "terminated"}}):
        c = p.get("city") or "—"
        mkt_geo[c] = mkt_geo.get(c, 0) + 1
    coverage = []
    for c in set(list(city_geo.keys()) + list(mkt_geo.keys())):
        coverage.append({
            "city": c,
            "city_partners": city_geo.get(c, 0),
            "marketplace_partners": mkt_geo.get(c, 0),
            "covered": city_geo.get(c, 0) > 0 and mkt_geo.get(c, 0) > 0,
        })
    coverage.sort(key=lambda x: -(x["city_partners"] + x["marketplace_partners"]))

    # Pending cross-reference opportunities (count of unmatched city leads)
    unmatched = await db.city_partner_leads.count_documents({
        "stage": {"$in": ["introduced", "contacted"]},
        "cross_ref_done": {"$ne": True},
    })

    return {
        "city": {
            "total": city_total,
            "active": city_active,
            "onboarding": city_onboarding,
            "leads": city_leads,
            "converted": city_conv,
            "revenue": city_rev,
            "conversion_rate": round((city_conv / city_leads * 100), 1) if city_leads else 0,
        },
        "marketplace": {
            "total": mkt_total,
            "active": mkt_active,
            "onboarding": mkt_onboarding,
            "leads": mkt_leads,
            "converted": mkt_conv,
            "revenue": mkt_rev,
            "conversion_rate": round((mkt_conv / mkt_leads * 100), 1) if mkt_leads else 0,
        },
        "totals": {
            "partners": city_total + mkt_total,
            "leads": city_leads + mkt_leads,
            "converted": city_conv + mkt_conv,
            "revenue": city_rev + mkt_rev,
        },
        "coverage": coverage[:20],
        "cross_ref_unmatched": unmatched,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/cross-ref/{lead_id}")
async def cross_reference(lead_id: str, user=Depends(get_current_user)):
    """Given a city_partner lead, find relevant marketplace partners (same city)
    and rank top 3 with Claude Sonnet 4.5.
    """
    _require_super(user)
    try:
        oid = ObjectId(lead_id)
    except Exception:
        raise HTTPException(400, "lead_id invalid.")

    lead = await db.city_partner_leads.find_one({"_id": oid})
    if not lead:
        raise HTTPException(404, "Lead inexistent.")
    city_partner = await db.city_partners.find_one({"_id": lead.get("partner_id")})
    if not city_partner:
        raise HTTPException(404, "City partner inexistent pentru lead.")

    target_city = city_partner.get("city")
    # Fetch marketplace partners — same city first, fallback to all active
    candidates = []
    async for p in db.marketplace_partners.find({"status": "active", "city": target_city}):
        candidates.append(p)
    if not candidates:
        async for p in db.marketplace_partners.find({"status": "active"}).limit(20):
            candidates.append(p)
    if not candidates:
        raise HTTPException(404, "Niciun marketplace partner activ pentru cross-reference.")

    # Build context
    import json
    ctx = {
        "lead": {
            "name": lead.get("lead_name"),
            "email": lead.get("lead_email"),
            "stage": lead.get("stage"),
            "notes": lead.get("notes"),
            "source": lead.get("source"),
        },
        "city_partner": {
            "company": city_partner.get("company"),
            "city": city_partner.get("city"),
            "portfolio_type": city_partner.get("portfolio_type"),
            "units_managed": city_partner.get("units_managed"),
        },
        "marketplace_candidates": [{
            "id": str(p["_id"]),
            "company": p.get("company"),
            "tier": p.get("tier"),
            "categories": p.get("categories") or [],
            "city": p.get("city"),
        } for p in candidates[:15]],
    }

    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise HTTPException(503, "EMERGENT_LLM_KEY missing.")

    system = (
        "Ești un Ecosystem Connector pentru PropManage. Primești un LEAD adus de un "
        "City Partner (administrator de bloc / dezvoltator) și o listă de Marketplace "
        "Partners activi. Sarcina ta: identifici TOP 3 marketplace partners cei mai "
        "relevanți pentru acest lead, bazat pe context (administratorul administrează "
        "blocuri = nevoie probabilă de sanitare/instalații/vopsele/HVAC etc.). "
        "Răspunzi DOAR cu JSON valid în română: "
        "{matches: [{marketplace_partner_id, company, relevance_score(0-100), "
        "reason (max 200c, propunere concretă de colaborare)}], "
        "introduction_email_subject, introduction_email_body (max 600c, ton prietenos profesional)}."
    )
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(
        api_key=key,
        session_id=f"xref_{_uuid.uuid4().hex[:8]}",
        system_message=system,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")
    raw = await chat.send_message(UserMessage(text=json.dumps(ctx, ensure_ascii=False, indent=2)))
    text = (raw or "").strip()
    if text.startswith("```"):
        text = "\n".join(line for line in text.splitlines() if not line.startswith("```"))
    i, j = text.find("{"), text.rfind("}")
    if i == -1 or j <= i:
        raise HTTPException(502, "AI nu a returnat JSON valid.")
    report = json.loads(text[i:j + 1])

    out = {
        "lead_id": lead_id,
        "lead_name": lead.get("lead_name"),
        "city_partner_company": city_partner.get("company"),
        "city": target_city,
        "matches": [
            {
                "marketplace_partner_id": str(m.get("marketplace_partner_id") or "")[:30],
                "company": str(m.get("company") or "")[:120],
                "relevance_score": int(m.get("relevance_score") or 0),
                "reason": str(m.get("reason") or "")[:250],
            }
            for m in (report.get("matches") or [])[:3]
        ],
        "introduction_email_subject": str(report.get("introduction_email_subject") or "")[:200],
        "introduction_email_body": str(report.get("introduction_email_body") or "")[:800],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    # Mark lead as cross-ref done
    await db.city_partner_leads.update_one(
        {"_id": oid},
        {"$set": {"cross_ref_done": True, "cross_ref_at": out["generated_at"]}},
    )
    _synced = await db.city_partner_leads.find_one({"_id": oid})
    if _synced:
        from leads_store import sync_lead
        await sync_lead("city_partner", _synced)
    await db.strategic_cross_refs.insert_one({**out, "generated_by": user.get("email")})
    return out


@router.get("/opportunities")
async def opportunities(limit: int = 10, user=Depends(get_current_user)):
    """Returns the latest cross-reference results for the admin to review."""
    _require_super(user)
    cur = db.strategic_cross_refs.find({}).sort("generated_at", -1).limit(min(limit, 50))
    items = []
    async for d in cur:
        d["id"] = str(d.pop("_id"))
        items.append(d)
    return {"items": items, "count": len(items)}


@router.get("/unmatched-leads")
async def unmatched_leads(user=Depends(get_current_user)):
    """Returns city_partner leads not yet processed via cross-reference."""
    _require_super(user)
    cur = db.city_partner_leads.find({
        "stage": {"$in": ["introduced", "contacted"]},
        "cross_ref_done": {"$ne": True},
    }).sort("created_at", -1).limit(50)
    items = []
    async for l in cur:
        cp = await db.city_partners.find_one({"_id": l.get("partner_id")})
        items.append({
            "id": str(l["_id"]),
            "lead_name": l.get("lead_name"),
            "stage": l.get("stage"),
            "city_partner_company": cp.get("company") if cp else None,
            "city": cp.get("city") if cp else None,
            "created_at": l.get("created_at"),
        })
    return {"items": items, "count": len(items)}


# ═════════════════════════════════════════════════════════════════════════════
# P0-3 — PARTNER FUNNEL (real data): invited → activated accounts → leads → conversions
# Loop closure: lead.email ↔ users.email (passive match, no duplication).
# ═════════════════════════════════════════════════════════════════════════════
async def _activated_emails(emails: list) -> set:
    """Return the subset of lead emails that correspond to a real platform user."""
    emails = [e for e in {(x or "").lower() for x in emails} if e]
    if not emails:
        return set()
    found = set()
    async for u in db.users.find({"email": {"$in": emails}}, {"email": 1}):
        if u.get("email"):
            found.add(u["email"].lower())
    return found


async def _funnel_for(collection, partners_collection, source_label: str) -> dict:
    """Compute funnel per partner for a given leads/partners collection pair."""
    rows = []
    totals = {"invited": 0, "activated": 0, "leads": 0, "converted": 0}
    async for p in db[partners_collection].find({"status": {"$ne": "terminated"}}):
        pid = p["_id"]
        leads = await db[collection].find({"partner_id": pid}).to_list(1000)
        emails = [l.get("lead_email") for l in leads]
        activated = await _activated_emails(emails)
        n_leads = len(leads)
        n_converted = sum(1 for l in leads if l.get("stage") == "converted")
        n_activated = sum(1 for l in leads if (l.get("lead_email") or "").lower() in activated)
        rows.append({
            "partner_id": str(pid),
            "company": p.get("company"),
            "city": p.get("city"),
            "source": source_label,
            "invited": n_leads,
            "activated_accounts": n_activated,
            "leads": n_leads,
            "converted": n_converted,
            "conversion_rate": round((n_converted / n_leads * 100), 1) if n_leads else 0,
        })
        totals["invited"] += n_leads
        totals["activated"] += n_activated
        totals["leads"] += n_leads
        totals["converted"] += n_converted
    return {"rows": rows, "totals": totals}


@router.get("/funnel")
async def partner_funnel(user=Depends(get_current_user)):
    """Real commercial funnel across both partner programs. No simulated data."""
    _require_super(user)
    city = await _funnel_for("city_partner_leads", "city_partners", "city_partner")
    mkt = await _funnel_for("marketplace_leads", "marketplace_partners", "marketplace_partner")
    rows = sorted(city["rows"] + mkt["rows"], key=lambda r: -r["invited"])
    grand = {"invited": 0, "activated_accounts": 0, "leads": 0, "converted": 0}
    for part in (city["totals"], mkt["totals"]):
        grand["invited"] += part["invited"]
        grand["activated_accounts"] += part["activated"]
        grand["leads"] += part["leads"]
        grand["converted"] += part["converted"]
    grand["activation_rate"] = round((grand["activated_accounts"] / grand["invited"] * 100), 1) if grand["invited"] else 0
    grand["conversion_rate"] = round((grand["converted"] / grand["leads"] * 100), 1) if grand["leads"] else 0
    return {
        "rows": rows,
        "totals": grand,
        "by_program": {"city_partner": city["totals"], "marketplace_partner": mkt["totals"]},
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ═════════════════════════════════════════════════════════════════════════════
# P2-8 — Commercial taxonomy (nZEB without a parallel collection)
# ═════════════════════════════════════════════════════════════════════════════
MARKETPLACE_CATEGORIES = [
    "Gresie și faianță", "Uși interior/exterior", "Sanitare", "Mobilier",
    "Vopsele și lavabile", "Instalații termice", "Instalații electrice", "HVAC",
    "Smart home", "Tâmplărie", "Acoperișuri", "Mobilier personalizat",
    "Electrocasnice", "Sisteme fotovoltaice", "Pompe de căldură",
    "Sisteme de securitate", "Materiale construcții", "Showroom", "Distribuitor",
    "Producător", "Depozit", "Fabrică", "Furnizor servicii",
]
NZEB_CATEGORIES = [
    "Audit energetic", "Consultanță nZEB", "Tâmplărie performantă", "Izolații termice",
    "Instalații / HVAC", "Pompe de căldură", "Sisteme fotovoltaice", "Renovări energetice",
]
PARTNER_TYPES = ["studio", "city", "regional", "national", "supplier", "brand", "specialist"]
COVERAGE_LEVELS = ["city", "regional", "national"]


@router.get("/taxonomy")
async def taxonomy(user=Depends(get_current_user)):
    """Shared taxonomy for agreements & profiles. nZEB is a category group, not a new system."""
    _require_super(user)
    return {
        "categories": MARKETPLACE_CATEGORIES,
        "category_groups": {"nZEB": NZEB_CATEGORIES},
        "partner_types": PARTNER_TYPES,
        "coverage_levels": COVERAGE_LEVELS,
        "agreement_statuses": ["draft", "active", "paused", "terminated"],
        "segments": ["residential", "commercial", "mixed", "public", "industrial"],
    }


# ═════════════════════════════════════════════════════════════════════════════
# P1-4/5/6 — PARTNER AGREEMENTS (transversal registry) + conflict detection
# Collection: partner_agreements { kind, partner_id, partner_name, categories[],
#   territory_{cities,counties,regions}[], coverage, segment, period_{from,to},
#   exclusivity, commission_terms, status, notes }
# ═════════════════════════════════════════════════════════════════════════════
AGREEMENT_KINDS = {"city", "marketplace"}
AGREEMENT_STATUS = {"draft", "active", "paused", "terminated"}


class AgreementIn(BaseModel):
    kind: str
    partner_id: str
    categories: List[str] = []
    territory_cities: List[str] = []
    territory_counties: List[str] = []
    territory_regions: List[str] = []
    coverage: Optional[str] = None
    segment: Optional[str] = None
    period_from: Optional[str] = None
    period_to: Optional[str] = None
    exclusivity: bool = False
    commission_terms: Optional[str] = None
    status: str = "draft"
    notes: Optional[str] = None
    acknowledge_conflicts: bool = False


class AgreementPatch(BaseModel):
    categories: Optional[List[str]] = None
    territory_cities: Optional[List[str]] = None
    territory_counties: Optional[List[str]] = None
    territory_regions: Optional[List[str]] = None
    coverage: Optional[str] = None
    segment: Optional[str] = None
    period_from: Optional[str] = None
    period_to: Optional[str] = None
    exclusivity: Optional[bool] = None
    commission_terms: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    acknowledge_conflicts: bool = False


async def _partner_lookup(kind: str, partner_id: str) -> Optional[dict]:
    col = "city_partners" if kind == "city" else "marketplace_partners"
    try:
        oid = ObjectId(partner_id)
    except Exception:
        return None
    return await db[col].find_one({"_id": oid})


def _serialize_agreement(d: dict) -> dict:
    if not d:
        return d
    return {
        "id": str(d.get("_id")),
        "kind": d.get("kind"),
        "partner_id": str(d.get("partner_id")) if d.get("partner_id") else None,
        "partner_name": d.get("partner_name"),
        "categories": d.get("categories") or [],
        "territory_cities": d.get("territory_cities") or [],
        "territory_counties": d.get("territory_counties") or [],
        "territory_regions": d.get("territory_regions") or [],
        "coverage": d.get("coverage"),
        "segment": d.get("segment"),
        "period_from": d.get("period_from"),
        "period_to": d.get("period_to"),
        "exclusivity": bool(d.get("exclusivity")),
        "commission_terms": d.get("commission_terms"),
        "status": d.get("status") or "draft",
        "notes": d.get("notes"),
        "approved_by": d.get("approved_by"),
        "acknowledged_conflicts": d.get("acknowledged_conflicts") or [],
        "created_at": d.get("created_at"),
        "updated_at": d.get("updated_at"),
    }


def _parse_date(s) -> Optional[date]:
    if not s:
        return None
    try:
        return datetime.fromisoformat(str(s)[:10]).date()
    except Exception:
        return None


def _terr_tokens(a: dict) -> set:
    toks = set()
    for key in ("territory_cities", "territory_counties", "territory_regions"):
        for v in (a.get(key) or []):
            if v:
                toks.add(str(v).strip().lower())
    return toks


def _territory_overlap(a: dict, b: dict) -> bool:
    if (a.get("coverage") == "national") or (b.get("coverage") == "national"):
        return True
    ta, tb = _terr_tokens(a), _terr_tokens(b)
    if not ta or not tb:
        return True  # unspecified territory = cautious overlap (warn)
    return bool(ta & tb)


def _categories_overlap(a: dict, b: dict) -> bool:
    ca = {str(x).strip().lower() for x in (a.get("categories") or []) if x}
    cb = {str(x).strip().lower() for x in (b.get("categories") or []) if x}
    if not ca or not cb:
        return True  # unspecified categories = all
    return bool(ca & cb)


def _period_overlap(a: dict, b: dict) -> bool:
    af, at = _parse_date(a.get("period_from")), _parse_date(a.get("period_to"))
    bf, bt = _parse_date(b.get("period_from")), _parse_date(b.get("period_to"))
    # None = open-ended
    if at and bf and at < bf:
        return False
    if bt and af and bt < af:
        return False
    return True


async def _find_conflicts(candidate: dict, exclude_id: Optional[ObjectId] = None) -> list:
    """Return active agreements that conflict with the candidate.
    Conflict = at least one side exclusive AND categories∩ AND territory∩ AND period∩.
    """
    conflicts = []
    q = {"status": "active"}
    if exclude_id:
        q["_id"] = {"$ne": exclude_id}
    async for other in db.partner_agreements.find(q):
        if not (candidate.get("exclusivity") or other.get("exclusivity")):
            continue
        if not _categories_overlap(candidate, other):
            continue
        if not _territory_overlap(candidate, other):
            continue
        if not _period_overlap(candidate, other):
            continue
        reasons = []
        if candidate.get("exclusivity") and other.get("exclusivity"):
            reasons.append("ambele acorduri sunt exclusive")
        elif other.get("exclusivity"):
            reasons.append("acordul existent este exclusiv")
        else:
            reasons.append("acordul nou este exclusiv")
        reasons.append("categorii suprapuse")
        reasons.append("teritoriu suprapus")
        reasons.append("perioade suprapuse")
        conflicts.append({
            "agreement_id": str(other["_id"]),
            "partner_name": other.get("partner_name"),
            "kind": other.get("kind"),
            "categories": other.get("categories") or [],
            "period_from": other.get("period_from"),
            "period_to": other.get("period_to"),
            "reasons": reasons,
        })
    return conflicts


@router.get("/agreements")
async def list_agreements(kind: Optional[str] = None, partner_id: Optional[str] = None,
                          status: Optional[str] = None, user=Depends(get_current_user)):
    _require_super(user)
    q = {}
    if kind:
        q["kind"] = kind
    if status and status != "all":
        q["status"] = status
    if partner_id:
        try:
            q["partner_id"] = ObjectId(partner_id)
        except Exception:
            raise HTTPException(400, "partner_id invalid.")
    cur = db.partner_agreements.find(q).sort("created_at", -1)
    items = [_serialize_agreement(d) async for d in cur]
    return {"items": items, "count": len(items)}


@router.post("/agreements/check-conflicts")
async def check_conflicts(payload: AgreementIn, user=Depends(get_current_user)):
    """Dry-run conflict preview without persisting anything."""
    _require_super(user)
    cand = payload.dict()
    conflicts = await _find_conflicts(cand)
    return {"conflicts": conflicts, "has_conflicts": bool(conflicts)}


@router.post("/agreements")
async def create_agreement(payload: AgreementIn, user=Depends(get_current_user)):
    _require_super(user)
    if payload.kind not in AGREEMENT_KINDS:
        raise HTTPException(400, f"kind invalid; permis: {sorted(AGREEMENT_KINDS)}")
    if payload.status not in AGREEMENT_STATUS:
        raise HTTPException(400, f"status invalid; permis: {sorted(AGREEMENT_STATUS)}")
    partner = await _partner_lookup(payload.kind, payload.partner_id)
    if not partner:
        raise HTTPException(404, "Partener inexistent pentru acest acord.")
    cand = payload.dict()
    conflicts = await _find_conflicts(cand)
    # Explicit approval gate: only ACTIVE agreements enforce the exclusivity conflict block.
    if conflicts and payload.status == "active" and not payload.acknowledge_conflicts:
        raise HTTPException(status_code=409, detail={
            "message": "Conflict de exclusivitate detectat. Este nevoie de aprobare explicită.",
            "conflicts": conflicts,
        })
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "kind": payload.kind,
        "partner_id": ObjectId(payload.partner_id),
        "partner_name": partner.get("company"),
        "categories": payload.categories or [],
        "territory_cities": payload.territory_cities or [],
        "territory_counties": payload.territory_counties or [],
        "territory_regions": payload.territory_regions or [],
        "coverage": payload.coverage,
        "segment": payload.segment,
        "period_from": payload.period_from,
        "period_to": payload.period_to,
        "exclusivity": bool(payload.exclusivity),
        "commission_terms": payload.commission_terms,
        "status": payload.status,
        "notes": payload.notes,
        "approved_by": user.get("email") if (conflicts and payload.acknowledge_conflicts) else None,
        "acknowledged_conflicts": [c["agreement_id"] for c in conflicts] if payload.acknowledge_conflicts else [],
        "created_at": now,
        "updated_at": now,
        "created_by": user.get("email"),
    }
    res = await db.partner_agreements.insert_one(doc)
    doc["_id"] = res.inserted_id
    out = _serialize_agreement(doc)
    out["conflicts"] = conflicts  # warnings surfaced even when created
    return out


@router.get("/agreements/{agreement_id}")
async def get_agreement(agreement_id: str, user=Depends(get_current_user)):
    _require_super(user)
    try:
        oid = ObjectId(agreement_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    d = await db.partner_agreements.find_one({"_id": oid})
    if not d:
        raise HTTPException(404, "Acord inexistent.")
    return _serialize_agreement(d)


@router.patch("/agreements/{agreement_id}")
async def patch_agreement(agreement_id: str, payload: AgreementPatch, user=Depends(get_current_user)):
    _require_super(user)
    try:
        oid = ObjectId(agreement_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    current = await db.partner_agreements.find_one({"_id": oid})
    if not current:
        raise HTTPException(404, "Acord inexistent.")
    update = {k: v for k, v in payload.dict(exclude_unset=True).items()
              if k != "acknowledge_conflicts" and v is not None}
    if "status" in update and update["status"] not in AGREEMENT_STATUS:
        raise HTTPException(400, "status invalid")
    # Build the prospective agreement to re-check conflicts when it will be active.
    merged = {**current, **update}
    will_be_active = merged.get("status") == "active"
    conflicts = await _find_conflicts(merged, exclude_id=oid) if will_be_active else []
    if conflicts and not payload.acknowledge_conflicts:
        raise HTTPException(status_code=409, detail={
            "message": "Modificarea creează un conflict de exclusivitate. Aprobare explicită necesară.",
            "conflicts": conflicts,
        })
    if conflicts and payload.acknowledge_conflicts:
        update["approved_by"] = user.get("email")
        update["acknowledged_conflicts"] = [c["agreement_id"] for c in conflicts]
    update["updated_at"] = datetime.now(timezone.utc).isoformat()
    res = await db.partner_agreements.find_one_and_update({"_id": oid}, {"$set": update}, return_document=True)
    out = _serialize_agreement(res)
    out["conflicts"] = conflicts
    return out


@router.delete("/agreements/{agreement_id}")
async def archive_agreement(agreement_id: str, user=Depends(get_current_user)):
    _require_super(user)
    try:
        oid = ObjectId(agreement_id)
    except Exception:
        raise HTTPException(400, "ID invalid.")
    res = await db.partner_agreements.update_one(
        {"_id": oid},
        {"$set": {"status": "terminated", "updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    if res.matched_count == 0:
        raise HTTPException(404, "Acord inexistent.")
    return {"ok": True, "archived": True}


# ═════════════════════════════════════════════════════════════════════════════
# P1-7 — ELIGIBLE COMMISSIONS REPORT (marketplace rules; no payments, read-only)
# ═════════════════════════════════════════════════════════════════════════════
def _eligible_commission(commissions: dict, converted: int, revenue: float, total_leads: int) -> dict:
    """Compute eligible commission from a partner's configured rules. No money moves."""
    c = commissions or {}
    ctype = (c.get("type") or "").lower()
    out = {"type": ctype or None, "one_time": 0.0, "recurring_monthly": 0.0, "basis": None}
    if ctype == "percent" and c.get("percent"):
        out["one_time"] = round(revenue * float(c["percent"]) / 100, 2)
        out["basis"] = f"{c['percent']}% × venit {revenue}"
    elif ctype == "per_sale" and c.get("per_sale"):
        out["one_time"] = round(converted * float(c["per_sale"]), 2)
        out["basis"] = f"{converted} vânzări × {c['per_sale']}"
    elif ctype == "per_lead" and c.get("per_lead"):
        out["one_time"] = round(total_leads * float(c["per_lead"]), 2)
        out["basis"] = f"{total_leads} lead-uri × {c['per_lead']}"
    elif ctype == "fixed" and c.get("fixed_amount"):
        out["one_time"] = round(converted * float(c["fixed_amount"]), 2)
        out["basis"] = f"{converted} conversii × {c['fixed_amount']} fix"
    elif ctype == "subscription" and c.get("monthly_subscription"):
        out["recurring_monthly"] = round(float(c["monthly_subscription"]), 2)
        out["basis"] = f"abonament lunar {c['monthly_subscription']}"
    return out


@router.get("/commissions-report")
async def commissions_report(user=Depends(get_current_user)):
    """Eligible (not paid) commissions per marketplace partner using their configured rules."""
    _require_super(user)
    rows = []
    totals = {"converted": 0, "revenue": 0.0, "eligible_one_time": 0.0, "eligible_recurring_monthly": 0.0}
    async for p in db.marketplace_partners.find({"status": {"$ne": "terminated"}}):
        pid = p["_id"]
        leads = await db.marketplace_leads.find({"partner_id": pid}).to_list(1000)
        total_leads = len(leads)
        converted = sum(1 for l in leads if l.get("stage") == "converted")
        revenue = sum(float(l.get("revenue_generated") or 0) for l in leads)
        commissions = p.get("commissions") or {}
        calc = _eligible_commission(commissions, converted, revenue, total_leads)
        rows.append({
            "partner_id": str(pid),
            "company": p.get("company"),
            "tier": p.get("tier"),
            "has_rules": bool(commissions),
            "total_leads": total_leads,
            "converted": converted,
            "revenue": round(revenue, 2),
            "commission_type": calc["type"],
            "eligible_one_time": calc["one_time"],
            "eligible_recurring_monthly": calc["recurring_monthly"],
            "basis": calc["basis"],
        })
        totals["converted"] += converted
        totals["revenue"] += revenue
        totals["eligible_one_time"] += calc["one_time"]
        totals["eligible_recurring_monthly"] += calc["recurring_monthly"]
    rows.sort(key=lambda r: -r["eligible_one_time"])
    totals = {k: round(v, 2) if isinstance(v, float) else v for k, v in totals.items()}
    return {
        "rows": rows,
        "totals": totals,
        "disclaimer": "Comisioane ELIGIBILE (estimare din reguli configurate). Fără plăți automate.",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ═════════════════════════════════════════════════════════════════════════════
# P2-9 — REQUEST ROUTING to eligible partners (category + territory + capacity + agreements)
# Keeps initial attribution + recommendation history in partner_route_history.
# ═════════════════════════════════════════════════════════════════════════════
class RouteRequestIn(BaseModel):
    category: str = Field(min_length=2, max_length=120)
    city: Optional[str] = None
    county: Optional[str] = None
    region: Optional[str] = None
    segment: Optional[str] = None
    lead_id: Optional[str] = None
    notes: Optional[str] = None


def _loc_match(partner_terr_tokens: set, req_tokens: set, coverage: Optional[str]) -> bool:
    if coverage == "national":
        return True
    if not req_tokens:
        return True
    if not partner_terr_tokens:
        return False
    return bool(partner_terr_tokens & req_tokens)


@router.post("/route-request")
async def route_request(payload: RouteRequestIn, user=Depends(get_current_user)):
    """Rank eligible partners for a real client request. Suggestion only (no auto-assign)."""
    _require_super(user)
    cat = payload.category.strip().lower()
    req_tokens = {t.strip().lower() for t in [payload.city, payload.county, payload.region] if t}

    # Active agreements matching category — these give priority + exclusivity signal.
    agg_by_partner = {}
    async for a in db.partner_agreements.find({"status": "active"}):
        a_cats = {str(x).strip().lower() for x in (a.get("categories") or [])}
        if a_cats and cat not in a_cats:
            continue
        if not _loc_match(_terr_tokens(a), req_tokens, a.get("coverage")):
            continue
        key = (a.get("kind"), str(a.get("partner_id")))
        agg_by_partner[key] = {"exclusive": bool(a.get("exclusivity")), "agreement_id": str(a["_id"])}

    candidates = []

    async def _scan(kind, col):
        async for p in db[col].find({"status": {"$in": ["active", "onboarding"]}}):
            pid = str(p["_id"])
            p_cats = {str(x).strip().lower() for x in (p.get("categories") or [])}
            p_terr = set()
            for v in (p.get("zones") or []):
                if v:
                    p_terr.add(str(v).strip().lower())
            if p.get("city"):
                p_terr.add(str(p["city"]).strip().lower())
            if p.get("county"):
                p_terr.add(str(p["county"]).strip().lower())
            if p.get("region"):
                p_terr.add(str(p["region"]).strip().lower())
            agr = agg_by_partner.get((kind, pid))
            cat_ok = (cat in p_cats) if p_cats else False
            loc_ok = _loc_match(p_terr, req_tokens, p.get("coverage"))
            if not agr and not (cat_ok and loc_ok):
                continue  # no active agreement and profile does not match
            score = 0
            reasons = []
            if agr:
                score += 60
                reasons.append("acord activ pe categorie+teritoriu")
                if agr["exclusive"]:
                    score += 20
                    reasons.append("exclusivitate")
            if cat_ok:
                score += 10
                reasons.append("categorie în profil")
            if loc_ok and req_tokens:
                score += 10
                reasons.append("teritoriu acoperit")
            # capacity signal
            cap = p.get("units_managed") or 0
            tier = p.get("tier")
            if cap and cap >= 500:
                score += 5
            tier_bonus = {"exclusive": 8, "strategic": 6, "premium": 4, "verified": 2}.get(tier, 0)
            score += tier_bonus
            candidates.append({
                "kind": kind,
                "partner_id": pid,
                "company": p.get("company"),
                "city": p.get("city"),
                "coverage": p.get("coverage"),
                "capacity_units": cap,
                "tier": tier,
                "has_active_agreement": bool(agr),
                "agreement_id": agr["agreement_id"] if agr else None,
                "exclusive": agr["exclusive"] if agr else False,
                "score": min(score, 100),
                "reasons": reasons,
            })

    await _scan("city", "city_partners")
    await _scan("marketplace", "marketplace_partners")
    candidates.sort(key=lambda c: -c["score"])
    ranked = candidates[:10]

    now = datetime.now(timezone.utc).isoformat()
    history_doc = {
        "category": payload.category,
        "territory": {"city": payload.city, "county": payload.county, "region": payload.region},
        "segment": payload.segment,
        "lead_id": payload.lead_id,
        "notes": payload.notes,
        "ranked": ranked,
        "recommended_partner_id": ranked[0]["partner_id"] if ranked else None,
        "recommended_kind": ranked[0]["kind"] if ranked else None,
        "exclusive_conflict": any(c["exclusive"] for c in ranked),
        "created_at": now,
        "created_by": user.get("email"),
    }
    res = await db.partner_route_history.insert_one(history_doc)
    history_doc["id"] = str(res.inserted_id)
    history_doc.pop("_id", None)
    return history_doc


@router.get("/route-history")
async def route_history(limit: int = 20, user=Depends(get_current_user)):
    _require_super(user)
    cur = db.partner_route_history.find({}).sort("created_at", -1).limit(min(limit, 100))
    items = []
    async for d in cur:
        d["id"] = str(d.pop("_id"))
        items.append(d)
    return {"items": items, "count": len(items)}
