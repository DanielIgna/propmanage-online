"""PropManage — Feature Configurator + Quests + Vouchers (Gamification)

Three intertwined systems:

1. **Feature Config**: matrix of (feature_key × tier × role) — which features are
   visible to a user. Replaces hardcoded TIER_FEATURES with admin-editable JSON.

2. **Feature Pairs**: optional manual mapping that signals "this client feature
   corresponds to this specialist feature" — Admin sees warnings when a pair is
   unbalanced (e.g., client tier=regular but specialist tier=verified).

3. **Quests**: admin-defined objectives (e.g., "complete 5 requests in 30 days
   → 50% voucher"). Cron scans users daily, awards vouchers when complete.
   Vouchers are stored in user profile and shown on dashboard — they are
   **generic codes** (no automatic redemption yet — manual application later).

Collections:
  - feature_config (singleton "config"): { features: [{key, label_ro, category,
        client_tier, specialist_tier, enabled}], updated_at }
  - feature_pairs (list): { id, client_feature, specialist_feature, note,
        created_at }
  - quests (list): { id, code, title_ro, description_ro, target_event,
        target_count, days_window, reward_voucher_pct, max_completions_per_user,
        active, created_at }
  - user_quest_progress: { user_id, quest_id, started_at, count, completed_at? }
  - user_vouchers: { id, user_id, code, percent, source, reason, status (active|
        used|expired), issued_at, expires_at, used_at? }
"""
import logging
import uuid
import random
import string
from datetime import datetime, timezone, timedelta
from typing import Optional, List

from bson import ObjectId
from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field

from db import db
from deps import require_role, get_current_user
from email_service import send_email, _layout

logger = logging.getLogger("propmanage.feature_config")
router = APIRouter(prefix="/api/admin/feature-configurator", tags=["feature-configurator"])
self_router = APIRouter(prefix="/api/me", tags=["quests-vouchers"])

# ----------------------------------------------------------------------
# Default feature catalog (used when collection is empty — first-run bootstrap)
# ----------------------------------------------------------------------
TIER_ORDER = ["junior", "regular", "verified", "pro"]

DEFAULT_FEATURES = [
    # CLIENT-FACING
    {"key": "client_basic_dashboard",      "label_ro": "Dashboard de bază",        "category": "core",        "role": "client",     "tier": "junior"},
    {"key": "client_simple_request",       "label_ro": "Creare cerere simplă",     "category": "core",        "role": "client",     "tier": "junior"},
    {"key": "client_essential_messages",   "label_ro": "Mesaje esențiale",         "category": "core",        "role": "client",     "tier": "junior"},
    {"key": "client_advanced_filters",     "label_ro": "Filtre avansate",          "category": "discovery",   "role": "client",     "tier": "regular"},
    {"key": "client_saved_searches",       "label_ro": "Căutări salvate",          "category": "discovery",   "role": "client",     "tier": "regular"},
    {"key": "client_request_templates",    "label_ro": "Șabloane cereri",          "category": "productivity","role": "client",     "tier": "regular"},
    {"key": "client_comparison_view",      "label_ro": "Comparare oferte",         "category": "decision",    "role": "client",     "tier": "regular"},
    {"key": "client_weekly_summary",       "label_ro": "Email sumar săptămânal",   "category": "engagement",  "role": "client",     "tier": "regular"},
    {"key": "client_bulk_operations",      "label_ro": "Operațiuni în masă",       "category": "productivity","role": "client",     "tier": "verified"},
    {"key": "client_advanced_analytics",   "label_ro": "Analize avansate",         "category": "analytics",   "role": "client",     "tier": "verified"},
    {"key": "client_priority_matching",    "label_ro": "Matching prioritar",       "category": "discovery",   "role": "client",     "tier": "verified"},
    {"key": "client_custom_notifications", "label_ro": "Notificări personalizate", "category": "engagement",  "role": "client",     "tier": "verified"},
    {"key": "client_export_data",          "label_ro": "Export date",              "category": "analytics",   "role": "client",     "tier": "verified"},
    {"key": "client_api_access",           "label_ro": "Acces API",                "category": "integration", "role": "client",     "tier": "pro"},
    {"key": "client_white_label_reports",  "label_ro": "Rapoarte white-label",     "category": "analytics",   "role": "client",     "tier": "pro"},
    {"key": "client_priority_support",     "label_ro": "Support prioritar",        "category": "engagement",  "role": "client",     "tier": "pro"},
    {"key": "client_early_access",         "label_ro": "Acces early la features",  "category": "engagement",  "role": "client",     "tier": "pro"},
    {"key": "client_dedicated_manager",    "label_ro": "Account manager dedicat",  "category": "engagement",  "role": "client",     "tier": "pro"},

    # SPECIALIST-FACING
    {"key": "spec_basic_dashboard",        "label_ro": "Dashboard de bază",        "category": "core",        "role": "specialist", "tier": "junior"},
    {"key": "spec_simple_offer",           "label_ro": "Oferte simple",            "category": "core",        "role": "specialist", "tier": "junior"},
    {"key": "spec_essential_messages",     "label_ro": "Mesaje esențiale",         "category": "core",        "role": "specialist", "tier": "junior"},
    {"key": "spec_advanced_filters",       "label_ro": "Filtre avansate oport.",   "category": "discovery",   "role": "specialist", "tier": "regular"},
    {"key": "spec_saved_searches",         "label_ro": "Căutări salvate",          "category": "discovery",   "role": "specialist", "tier": "regular"},
    {"key": "spec_offer_templates",        "label_ro": "Șabloane oferte",          "category": "productivity","role": "specialist", "tier": "regular"},
    {"key": "spec_priority_matching",      "label_ro": "Matching prioritar",       "category": "discovery",   "role": "specialist", "tier": "verified"},
    {"key": "spec_bulk_operations",        "label_ro": "Aplicare în masă",         "category": "productivity","role": "specialist", "tier": "verified"},
    {"key": "spec_advanced_analytics",     "label_ro": "Analytics business",       "category": "analytics",   "role": "specialist", "tier": "verified"},
    {"key": "spec_export_revenue",         "label_ro": "Export raport venituri",   "category": "analytics",   "role": "specialist", "tier": "verified"},
    {"key": "spec_priority_support",       "label_ro": "Support prioritar",        "category": "engagement",  "role": "specialist", "tier": "pro"},
    {"key": "spec_white_label_reports",    "label_ro": "Rapoarte white-label",     "category": "analytics",   "role": "specialist", "tier": "pro"},
]

# Default pairs (client_feature_key, specialist_feature_key, note)
DEFAULT_PAIRS = [
    ("client_advanced_filters",     "spec_advanced_filters",     "Discovery dual: filtre avansate pentru ambele părți"),
    ("client_saved_searches",       "spec_saved_searches",       "Engagement parity — căutări salvate sincronizate"),
    ("client_priority_matching",    "spec_priority_matching",    "Matching prioritar pe ambele direcții"),
    ("client_bulk_operations",      "spec_bulk_operations",      "Operațiuni masă — utilizare paralelă"),
    ("client_advanced_analytics",   "spec_advanced_analytics",   "Analize avansate — vizibilitate echilibrată"),
    ("client_priority_support",     "spec_priority_support",     "Support prioritar — paritate completă"),
    ("client_white_label_reports",  "spec_white_label_reports",  "Rapoarte white-label — funcție Pro pentru ambele roluri"),
]

# Default quests
DEFAULT_QUESTS = [
    {
        "code": "first_steps_client", "title_ro": "Primii pași", "description_ro": "Creează prima ta cerere și descoperă platforma.",
        "target_event": "client_request_completed", "target_count": 1, "days_window": 14,
        "reward_voucher_pct": 30, "max_completions_per_user": 1, "applies_to_role": "client", "active": True,
    },
    {
        "code": "active_explorer_client", "title_ro": "Explorator activ", "description_ro": "Finalizează 3 cereri în 30 de zile.",
        "target_event": "client_request_completed", "target_count": 3, "days_window": 30,
        "reward_voucher_pct": 50, "max_completions_per_user": 1, "applies_to_role": "client", "active": True,
    },
    {
        "code": "power_user_client", "title_ro": "Power user", "description_ro": "5 cereri finalizate în 60 zile = recompensă mare.",
        "target_event": "client_request_completed", "target_count": 5, "days_window": 60,
        "reward_voucher_pct": 90, "max_completions_per_user": 1, "applies_to_role": "client", "active": True,
    },
    {
        "code": "first_steps_spec", "title_ro": "Primul lead acceptat", "description_ro": "Acceptă primul tău lead pe platformă.",
        "target_event": "spec_lead_accepted", "target_count": 1, "days_window": 14,
        "reward_voucher_pct": 30, "max_completions_per_user": 1, "applies_to_role": "specialist", "active": True,
    },
    {
        "code": "active_provider_spec", "title_ro": "Furnizor activ", "description_ro": "Finalizează 5 lucrări în 30 zile.",
        "target_event": "spec_request_completed", "target_count": 5, "days_window": 30,
        "reward_voucher_pct": 50, "max_completions_per_user": 1, "applies_to_role": "specialist", "active": True,
    },
    {
        "code": "elite_provider_spec", "title_ro": "Furnizor elite", "description_ro": "10 lucrări finalizate în 60 zile + rating ≥ 4.7.",
        "target_event": "spec_request_completed", "target_count": 10, "days_window": 60,
        "reward_voucher_pct": 90, "max_completions_per_user": 1, "applies_to_role": "specialist", "active": True,
        "min_rating": 4.7,
    },
]


# ----------------------------------------------------------------------
# Bootstrap (run on first call to GET /config)
# ----------------------------------------------------------------------
async def _bootstrap_if_empty():
    cfg = await db.feature_config.find_one({"_id": "config"})
    if not cfg:
        await db.feature_config.update_one(
            {"_id": "config"},
            {"$set": {"features": DEFAULT_FEATURES, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
    if await db.feature_pairs.count_documents({}) == 0:
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.feature_pairs.insert_many([
            {"id": str(uuid.uuid4()), "client_feature": c, "specialist_feature": s, "note": n, "created_at": now_iso}
            for c, s, n in DEFAULT_PAIRS
        ])
    if await db.quests.count_documents({}) == 0:
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.quests.insert_many([
            {**q, "id": str(uuid.uuid4()), "created_at": now_iso} for q in DEFAULT_QUESTS
        ])


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------
def _voucher_code() -> str:
    return "PM-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


def _tier_idx(tier: str) -> int:
    try:
        return TIER_ORDER.index(tier)
    except ValueError:
        return 0


async def get_user_visible_features(user_role: str, user_tier: str) -> List[dict]:
    """Return ordered list of features visible for a (role, tier) combo."""
    await _bootstrap_if_empty()
    cfg = await db.feature_config.find_one({"_id": "config"}) or {}
    out = []
    user_idx = _tier_idx(user_tier or "junior")
    for f in cfg.get("features", []):
        if f.get("role") != user_role:
            continue
        if f.get("enabled") is False:
            continue
        if _tier_idx(f.get("tier", "junior")) <= user_idx:
            out.append(f)
    return out


# ----------------------------------------------------------------------
# Admin: Feature Config
# ----------------------------------------------------------------------
class FeatureUpdate(BaseModel):
    key: str
    label_ro: Optional[str] = None
    category: Optional[str] = None
    role: Optional[str] = None
    tier: Optional[str] = None
    enabled: Optional[bool] = None


@router.get("/config")
async def get_feature_config(user=Depends(require_role("admin"))):
    await _bootstrap_if_empty()
    cfg = await db.feature_config.find_one({"_id": "config"}) or {}
    return {"features": cfg.get("features", []), "updated_at": cfg.get("updated_at")}


@router.put("/config/feature")
async def update_feature(patch: FeatureUpdate, user=Depends(require_role("admin"))):
    """Update or insert a single feature (by key)."""
    await _bootstrap_if_empty()
    cfg = await db.feature_config.find_one({"_id": "config"}) or {"features": []}
    features = cfg.get("features", [])
    existing = next((f for f in features if f["key"] == patch.key), None)
    if existing:
        for k, v in patch.model_dump(exclude_unset=True).items():
            if k != "key":
                existing[k] = v
    else:
        features.append({
            "key": patch.key,
            "label_ro": patch.label_ro or patch.key,
            "category": patch.category or "misc",
            "role": patch.role or "client",
            "tier": patch.tier or "junior",
            "enabled": patch.enabled if patch.enabled is not None else True,
        })
    await db.feature_config.update_one(
        {"_id": "config"},
        {"$set": {"features": features, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "features": features}


@router.post("/config/reset-defaults")
async def reset_to_defaults(user=Depends(require_role("admin"))):
    await db.feature_config.update_one(
        {"_id": "config"},
        {"$set": {"features": DEFAULT_FEATURES, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return {"ok": True, "count": len(DEFAULT_FEATURES)}


# ----------------------------------------------------------------------
# Admin: Feature Pairs + validation
# ----------------------------------------------------------------------
class PairIn(BaseModel):
    client_feature: str
    specialist_feature: str
    note: Optional[str] = ""


@router.get("/pairs")
async def list_pairs(user=Depends(require_role("admin"))):
    await _bootstrap_if_empty()
    cur = db.feature_pairs.find({}).sort("created_at", 1)
    items = []
    async for d in cur:
        d.pop("_id", None)
        items.append(d)
    return {"items": items, "count": len(items)}


@router.post("/pairs")
async def create_pair(payload: PairIn, user=Depends(require_role("admin"))):
    doc = {**payload.model_dump(), "id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.feature_pairs.insert_one({**doc})
    doc.pop("_id", None)
    return doc


@router.delete("/pairs/{pair_id}")
async def delete_pair(pair_id: str, user=Depends(require_role("admin"))):
    res = await db.feature_pairs.delete_one({"id": pair_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Pair not found")
    return {"ok": True}


@router.get("/pairs/validate")
async def validate_pairs(user=Depends(require_role("admin"))):
    """Return warnings for pairs where tiers don't match (non-blocking)."""
    await _bootstrap_if_empty()
    cfg = await db.feature_config.find_one({"_id": "config"}) or {}
    features = {f["key"]: f for f in cfg.get("features", [])}
    pairs_cur = db.feature_pairs.find({})
    warnings = []
    matches = 0
    async for p in pairs_cur:
        cf = features.get(p["client_feature"])
        sf = features.get(p["specialist_feature"])
        if not cf or not sf:
            warnings.append({
                "pair_id": p["id"], "severity": "error",
                "message": f"Pereche invalidă: feature lipsă ({p['client_feature']} / {p['specialist_feature']})",
            })
            continue
        if cf["tier"] != sf["tier"]:
            warnings.append({
                "pair_id": p["id"], "severity": "warning",
                "message": f"Tier mismatch: '{cf['label_ro']}' ({cf['tier']}) vs '{sf['label_ro']}' ({sf['tier']})",
                "client_feature": p["client_feature"], "client_tier": cf["tier"],
                "specialist_feature": p["specialist_feature"], "specialist_tier": sf["tier"],
            })
        elif cf.get("enabled", True) != sf.get("enabled", True):
            warnings.append({
                "pair_id": p["id"], "severity": "warning",
                "message": f"Enabled mismatch: '{cf['label_ro']}' și '{sf['label_ro']}' au stări on/off diferite",
            })
        else:
            matches += 1
    return {"warnings": warnings, "ok_matches": matches, "total_pairs": matches + len(warnings)}


# ----------------------------------------------------------------------
# Admin: Quests
# ----------------------------------------------------------------------
class QuestIn(BaseModel):
    code: str
    title_ro: str
    description_ro: str
    target_event: str = Field(default="client_request_completed")
    target_count: int = Field(default=1, ge=1, le=1000)
    days_window: int = Field(default=30, ge=1, le=365)
    reward_voucher_pct: int = Field(default=50, ge=1, le=100)
    max_completions_per_user: int = Field(default=1, ge=1, le=10)
    applies_to_role: str = Field(default="client")  # client | specialist | both
    min_rating: Optional[float] = None
    active: bool = True


@router.get("/quests")
async def list_quests(user=Depends(require_role("admin"))):
    await _bootstrap_if_empty()
    cur = db.quests.find({}).sort("created_at", 1)
    items = []
    async for d in cur:
        d.pop("_id", None)
        items.append(d)
    # Add completion stats per quest
    for q in items:
        completed = await db.user_quest_progress.count_documents({"quest_id": q["id"], "completed_at": {"$ne": None}})
        in_progress = await db.user_quest_progress.count_documents({"quest_id": q["id"], "completed_at": None})
        q["stats"] = {"completed": completed, "in_progress": in_progress}
    return {"items": items, "count": len(items)}


@router.post("/quests")
async def create_quest(payload: QuestIn, user=Depends(require_role("admin"))):
    doc = {**payload.model_dump(), "id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat()}
    await db.quests.insert_one({**doc})
    doc.pop("_id", None)
    return doc


@router.put("/quests/{quest_id}")
async def update_quest(quest_id: str, payload: dict = Body(...), user=Depends(require_role("admin"))):
    update = {k: v for k, v in payload.items() if k in {"title_ro", "description_ro", "target_count", "days_window", "reward_voucher_pct", "active", "min_rating", "applies_to_role"}}
    if not update:
        return {"ok": True, "no_changes": True}
    res = await db.quests.update_one({"id": quest_id}, {"$set": update})
    if res.matched_count == 0:
        raise HTTPException(404, "Quest not found")
    return {"ok": True}


@router.delete("/quests/{quest_id}")
async def delete_quest(quest_id: str, user=Depends(require_role("admin"))):
    res = await db.quests.delete_one({"id": quest_id})
    if res.deleted_count == 0:
        raise HTTPException(404, "Quest not found")
    return {"ok": True}


# ----------------------------------------------------------------------
# Admin: Vouchers (issued)
# ----------------------------------------------------------------------
@router.get("/vouchers")
async def list_vouchers(limit: int = 50, status: Optional[str] = None, user=Depends(require_role("admin"))):
    q: dict = {}
    if status:
        q["status"] = status
    cur = db.user_vouchers.find(q, {"_id": 0}).sort("issued_at", -1).limit(limit)
    items = []
    async for d in cur:
        items.append(d)
    # Add user email enrichment
    for v in items:
        try:
            u = await db.users.find_one({"_id": ObjectId(v["user_id"])}, {"email": 1})
            v["user_email"] = (u or {}).get("email")
        except Exception:  # noqa: BLE001
            v["user_email"] = None
    return {"items": items, "count": len(items)}


@router.get("/vouchers/stats")
async def voucher_stats(user=Depends(require_role("admin"))):
    pipeline = [{"$group": {"_id": "$status", "count": {"$sum": 1}}}]
    out = {"active": 0, "used": 0, "expired": 0}
    async for d in db.user_vouchers.aggregate(pipeline):
        out[d["_id"]] = d["count"]
    return out


# ----------------------------------------------------------------------
# Voucher email (used by quest evaluation cron)
# ----------------------------------------------------------------------
async def _send_voucher_email(email: str, quest_title: str, voucher_code: str, percent: int, expires_at: str):
    """Branded congratulation email when user earns a voucher via quest."""
    try:
        expires_date = datetime.fromisoformat(expires_at.replace("Z", "+00:00")).strftime("%d %B %Y")
    except Exception:  # noqa: BLE001
        expires_date = expires_at[:10]

    body = f"""
    <tr><td style="padding:32px;">
      <div style="font-size:11px;letter-spacing:.08em;color:#d4ff3a;text-transform:uppercase;margin-bottom:8px;">Quest completat</div>
      <h1 style="margin:0 0 12px 0;font-size:28px;color:#fff;line-height:1.2;">🎁 Ai câștigat un voucher!</h1>
      <p style="margin:0 0 14px 0;font-size:15px;color:#d4d4d8;line-height:1.6;">
        Felicitări — ai completat quest-ul <strong style="color:#fff;">"{quest_title}"</strong>.
        Ca recompensă, ai primit un voucher de <strong style="color:#d4ff3a;">{percent}% reducere</strong>.
      </p>
      <div style="background:#1a1a1d;border:2px dashed #d4ff3a55;border-radius:14px;padding:24px;margin:24px 0;text-align:center;">
        <div style="font-size:10px;letter-spacing:.12em;color:#a1a1aa;text-transform:uppercase;margin-bottom:6px;">Cod voucher</div>
        <div style="font-family:'Courier New',monospace;font-size:28px;font-weight:700;color:#d4ff3a;letter-spacing:.05em;">{voucher_code}</div>
        <div style="font-size:11px;color:#71717a;margin-top:10px;">Valabil până: <strong style="color:#a1a1aa;">{expires_date}</strong></div>
      </div>
      <p style="margin:0 0 14px 0;font-size:13px;color:#a1a1aa;line-height:1.5;">
        Codul tău e salvat automat în dashboard, sub secțiunea <strong style="color:#d4d4d8;">Quest-uri &amp; Recompense</strong>.
        Aplicarea efectivă pe următoarea ta comandă/lead se face manual deocamdată — păstrează codul pentru când vine timpul.
      </p>
      <p style="margin:0;font-size:12px;color:#71717a;font-style:italic;">
        Continuă să fii activ pe platformă — următoarele quest-uri îți pot aduce vouchere de până la 90% reducere!
      </p>
    </td></tr>
    """
    html = _layout(
        title="Voucher câștigat — PropManage",
        preheader=f"Ai un voucher {percent}% de la quest-ul {quest_title}",
        body_html=body,
        cta_url="https://propmanage.ro/dashboard",
        cta_label="Vezi voucherele mele",
    )
    await send_email(email, f"🎁 Voucher {percent}% — quest-ul '{quest_title}' completat!", html)


@router.post("/vouchers/test-email")
async def send_test_voucher_email(payload: dict = Body(...), user=Depends(require_role("admin"))):
    """Send a sample voucher email to a given address — for admin verification of branding/delivery.

    Body: { email: "user@example.com", percent?: int (default 50), quest_title?: str }
    Doesn't create a real voucher in DB — purely a delivery test.
    """
    email = (payload.get("email") or "").strip()
    if "@" not in email:
        raise HTTPException(400, "Invalid email")
    percent = int(payload.get("percent") or 50)
    quest_title = payload.get("quest_title") or "Test voucher delivery"
    code = _voucher_code()
    expires_at = (datetime.now(timezone.utc) + timedelta(days=30)).isoformat()
    try:
        await _send_voucher_email(
            email=email,
            quest_title=quest_title,
            voucher_code=code,
            percent=percent,
            expires_at=expires_at,
        )
        return {"ok": True, "email": email, "sample_code": code, "percent": percent}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(500, f"Email send failed: {str(e)[:200]}")


@router.post("/vouchers/create-test")
async def create_test_voucher(payload: dict = Body(...), user=Depends(require_role("admin"))):
    """Create a REAL test voucher with custom expiry for a target user.

    Useful to test VoucherExpiryAlert widget without waiting weeks.
    Body: { user_email: str, percent?: int (50), expires_in_days?: int (3) }
    """
    target_email = (payload.get("user_email") or "").strip()
    if "@" not in target_email:
        raise HTTPException(400, "Invalid user_email")
    target_user = await db.users.find_one({"email": target_email})
    if not target_user:
        raise HTTPException(404, f"User not found: {target_email}")
    percent = int(payload.get("percent") or 50)
    expires_in_days = int(payload.get("expires_in_days") or 3)
    now_iso = datetime.now(timezone.utc).isoformat()
    expires_at = (datetime.now(timezone.utc) + timedelta(days=expires_in_days)).isoformat()
    voucher_doc = {
        "id": str(uuid.uuid4()),
        "user_id": str(target_user["_id"]),
        "user_email": target_email,
        "code": _voucher_code(),
        "percent": percent,
        "source": "admin_test",
        "reason": f"TEST voucher creat manual de admin (expirare în {expires_in_days}z)",
        "status": "active",
        "issued_at": now_iso,
        "expires_at": expires_at,
    }
    await db.user_vouchers.insert_one({**voucher_doc})
    voucher_doc.pop("_id", None)
    return voucher_doc


# ----------------------------------------------------------------------
# Quest evaluation cron
# ----------------------------------------------------------------------
async def _count_event_for_user(user_id: str, event: str, since_iso: str) -> tuple:
    """Returns (count, current_rating). Maps event to specific Mongo queries.

    Uses $or on updated_at OR created_at because legacy requests don't have
    updated_at populated.
    """
    time_filter = {"$or": [
        {"updated_at": {"$gte": since_iso}},
        {"created_at": {"$gte": since_iso}},
    ]}
    if event == "client_request_completed":
        return await db.requests.count_documents({
            "$and": [
                {"client_id": user_id, "status": {"$in": ["completed", "confirmed"]}},
                time_filter,
            ],
        }), 0.0
    if event == "spec_lead_accepted":
        return await db.requests.count_documents({
            "$and": [
                {"assigned_specialist_id": user_id, "status": {"$in": ["accepted", "in_progress", "completed", "confirmed"]}},
                time_filter,
            ],
        }), 0.0
    if event == "spec_request_completed":
        count = await db.requests.count_documents({
            "$and": [
                {"assigned_specialist_id": user_id, "status": {"$in": ["completed", "confirmed"]}},
                time_filter,
            ],
        })
        try:
            u = await db.users.find_one({"_id": ObjectId(user_id)}, {"rating": 1})
            rating = float((u or {}).get("rating") or 0)
        except Exception:  # noqa: BLE001
            rating = 0.0
        return count, rating
    return 0, 0.0


async def evaluate_quests_job(dry_run: bool = False) -> dict:
    """Daily job: scan users + active quests, issue vouchers when objectives met."""
    await _bootstrap_if_empty()
    quests_cur = db.quests.find({"active": True})
    quests = []
    async for q in quests_cur:
        q.pop("_id", None)
        quests.append(q)
    if not quests:
        return {"scanned_users": 0, "vouchers_issued": 0, "ran_at": datetime.now(timezone.utc).isoformat()}

    issued = []
    scanned = 0
    users_cur = db.users.find({"role": {"$in": ["client", "specialist"]}})
    async for u in users_cur:
        scanned += 1
        user_id = str(u["_id"])
        role = u.get("role", "client")
        for q in quests:
            applies = q.get("applies_to_role", "client")
            if applies != "both" and applies != role:
                continue
            # Dedupe: skip if user already completed this quest up to max_completions
            completed_count = await db.user_quest_progress.count_documents({
                "user_id": user_id, "quest_id": q["id"], "completed_at": {"$ne": None},
            })
            if completed_count >= int(q.get("max_completions_per_user", 1)):
                continue
            # Compute window
            since = (datetime.now(timezone.utc) - timedelta(days=int(q.get("days_window", 30)))).isoformat()
            count, rating = await _count_event_for_user(user_id, q.get("target_event"), since)
            target = int(q.get("target_count", 1))
            min_rating = q.get("min_rating")
            satisfied = count >= target and (min_rating is None or rating >= float(min_rating))

            # Upsert progress
            await db.user_quest_progress.update_one(
                {"user_id": user_id, "quest_id": q["id"], "completed_at": None},
                {"$set": {"count": count, "rating_now": rating, "last_check_at": datetime.now(timezone.utc).isoformat()}},
                upsert=True,
            )

            if satisfied and not dry_run:
                # Mark progress complete + issue voucher
                now_iso = datetime.now(timezone.utc).isoformat()
                await db.user_quest_progress.update_one(
                    {"user_id": user_id, "quest_id": q["id"], "completed_at": None},
                    {"$set": {"completed_at": now_iso}},
                )
                voucher_doc = {
                    "id": str(uuid.uuid4()),
                    "user_id": user_id,
                    "user_email": u.get("email"),
                    "code": _voucher_code(),
                    "percent": int(q.get("reward_voucher_pct", 50)),
                    "source": "quest",
                    "reason": f"Quest completed: {q.get('code')}",
                    "quest_id": q["id"],
                    "quest_title": q.get("title_ro"),
                    "status": "active",
                    "issued_at": now_iso,
                    "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
                }
                await db.user_vouchers.insert_one({**voucher_doc})
                # Also create in-app notification
                try:
                    await db.notifications.insert_one({
                        "id": str(uuid.uuid4()),
                        "user_id": user_id,
                        "type": "voucher_issued",
                        "title": f"🎁 Recompensă: voucher {voucher_doc['percent']}%",
                        "message": f"Ai completat quest-ul '{q.get('title_ro')}'. Cod: {voucher_doc['code']}",
                        "data": {"voucher_code": voucher_doc["code"], "percent": voucher_doc["percent"]},
                        "read": False,
                        "created_at": now_iso,
                    })
                except Exception as e:  # noqa: BLE001
                    logger.warning(f"[quests] notification insert failed: {e}")
                voucher_doc.pop("_id", None)
                issued.append(voucher_doc)

    # Mark expired vouchers
    now_iso = datetime.now(timezone.utc).isoformat()
    if not dry_run:
        await db.user_vouchers.update_many(
            {"status": "active", "expires_at": {"$lt": now_iso}},
            {"$set": {"status": "expired"}},
        )

    return {
        "scanned_users": scanned,
        "vouchers_issued": len(issued),
        "issued_sample": issued[:10],
        "dry_run": dry_run,
        "ran_at": now_iso,
    }


@router.post("/quests/run-now")
async def trigger_quest_job(payload: dict = Body(default={}), user=Depends(require_role("admin"))):
    return await evaluate_quests_job(dry_run=bool(payload.get("dry_run", False)))


# ----------------------------------------------------------------------
# User-self endpoints
# ----------------------------------------------------------------------
@self_router.get("/quests")
async def my_quests(user=Depends(get_current_user)):
    """Active quests + my progress."""
    await _bootstrap_if_empty()
    role = user.get("role", "client")
    user_id = user["id"]
    quests_cur = db.quests.find({"active": True})
    out = []
    async for q in quests_cur:
        q.pop("_id", None)
        applies = q.get("applies_to_role", "client")
        if applies != "both" and applies != role:
            continue
        prog = await db.user_quest_progress.find_one({"user_id": user_id, "quest_id": q["id"]})
        completed = bool(prog and prog.get("completed_at"))
        current = int((prog or {}).get("count", 0))
        target = int(q.get("target_count", 1))
        pct = min(100, int(current * 100 / target)) if target else 0
        out.append({
            "id": q["id"], "code": q["code"], "title_ro": q["title_ro"], "description_ro": q["description_ro"],
            "target_count": target, "current_count": current, "progress_pct": pct,
            "days_window": q["days_window"], "reward_voucher_pct": q["reward_voucher_pct"],
            "completed": completed, "completed_at": (prog or {}).get("completed_at"),
        })
    return {"items": out, "count": len(out)}


@self_router.get("/vouchers")
async def my_vouchers(user=Depends(get_current_user)):
    user_id = user["id"]
    cur = db.user_vouchers.find({"user_id": user_id}, {"_id": 0}).sort("issued_at", -1)
    items = []
    async for d in cur:
        items.append(d)
    active = [v for v in items if v.get("status") == "active"]
    return {"items": items, "active_count": len(active), "total": len(items)}
