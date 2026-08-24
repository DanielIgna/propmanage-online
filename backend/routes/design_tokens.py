"""PropManage · Design Tokens (Task 8 · P2).

Controlled configuration surface for global visual tokens (colors, radius,
typography) exposed to the frontend as CSS variables (--pm-*). Non-invasive
extension of the Configuration Layer: reuses `admin_audit_log`, `require_role`,
and stores state in the new `db.design_tokens` collection (single doc,
`_id="design_tokens"`).

Design boundaries:
- allowlist for every field (no arbitrary CSS)
- values are strictly type/regex validated (no `javascript:`, `url()`,
  `expression()`, HTML, or inline scripts)
- publish-through-admin only; public endpoint is read-only
- reset returns to canonical defaults and is fully audited
"""
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel

from db import db
from deps import require_role


logger = logging.getLogger("propmanage.design_tokens")

router = APIRouter(prefix="/api/admin/design-tokens", tags=["design-tokens"])
public_router = APIRouter(prefix="/api/public/design-tokens", tags=["design-tokens-public"])


# ------------------------------------------------------------------
# Defaults + validators
# ------------------------------------------------------------------
COLOR_KEYS = {
    "primary", "secondary", "accent", "background", "surface",
    "text", "muted_text", "border", "success", "warning", "danger",
}
RADIUS_KEYS = {"sm", "md", "lg", "xl", "button", "card"}
TYPO_KEYS = {"font_family", "heading_weight", "body_weight", "base_font_size", "h1_scale"}

# Hex color (3/6/8 hex) OR rgb/rgba() OR hsl/hsla() OR named-safe CSS colors.
_COLOR_RE = re.compile(
    r"^(?:#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})"
    r"|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)"
    r"|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0|1|0?\.\d+)\s*\)"
    r"|hsl\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*\)"
    r"|hsla\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*,\s*(?:0|1|0?\.\d+)\s*\)"
    r"|(?:black|white|transparent|currentColor))$"
)
_RADIUS_RE = re.compile(r"^(?:0|\d{1,3}(?:\.\d)?(?:px|rem|em)?|\d{1,2}%)$")
_FONT_FAMILY_RE = re.compile(r"^[a-zA-Z0-9 ,'\"\-]{1,120}$")
_WEIGHT_ALLOWED = {"300", "400", "500", "600", "700", "800", "900"}
_BASE_FONT_RE = re.compile(r"^\d{2}(?:\.\d)?(?:px|rem)$")
_H1_SCALE_RE = re.compile(r"^\d(?:\.\d{1,2})?$")

DEFAULT_TOKENS: Dict[str, Any] = {
    "colors": {
        "primary": "#d4ff3a",
        "secondary": "#0a0a0b",
        "accent": "#d4ff3a",
        "background": "#0a0a0b",
        "surface": "#111114",
        "text": "#e7e5e4",
        "muted_text": "#a8a29e",
        "border": "rgba(255,255,255,0.10)",
        "success": "#22c55e",
        "warning": "#f59e0b",
        "danger": "#ef4444",
    },
    "radius": {
        "sm": "6px",
        "md": "10px",
        "lg": "16px",
        "xl": "24px",
        "button": "12px",
        "card": "20px",
    },
    "typography": {
        "font_family": "Inter, system-ui, -apple-system, sans-serif",
        "heading_weight": "700",
        "body_weight": "400",
        "base_font_size": "16px",
        "h1_scale": "3.0",
    },
}


# ------------------------------------------------------------------
# Sanitizers
# ------------------------------------------------------------------
_DANGEROUS_SUBSTRINGS = ("javascript:", "url(", "expression(", "<script", "</script",
                        "onerror=", "onload=", "\\", "@import")


def _reject_dangerous(value: str) -> str:
    lower = value.lower()
    for token in _DANGEROUS_SUBSTRINGS:
        if token in lower:
            raise HTTPException(400, f"Value contains disallowed token: {token}")
    return value


def _sanitize_color(v: Any) -> str:
    if not isinstance(v, str):
        raise HTTPException(400, "Color must be a string")
    v = _reject_dangerous(v.strip())[:80]
    if not _COLOR_RE.match(v):
        raise HTTPException(400, f"Invalid color value: {v!r}")
    return v


def _sanitize_radius(v: Any) -> str:
    if not isinstance(v, str):
        raise HTTPException(400, "Radius must be a string")
    v = _reject_dangerous(v.strip())[:20]
    if not _RADIUS_RE.match(v):
        raise HTTPException(400, f"Invalid radius value: {v!r}")
    return v


def _sanitize_typography_field(field: str, v: Any) -> str:
    if not isinstance(v, str):
        raise HTTPException(400, f"Typography value for {field} must be a string")
    v = _reject_dangerous(v.strip())
    if field == "font_family":
        if not _FONT_FAMILY_RE.match(v):
            raise HTTPException(400, f"Invalid font_family: {v!r}")
        return v[:120]
    if field in ("heading_weight", "body_weight"):
        if v not in _WEIGHT_ALLOWED:
            raise HTTPException(400, f"Invalid {field}: {v!r} (allowed: {sorted(_WEIGHT_ALLOWED)})")
        return v
    if field == "base_font_size":
        if not _BASE_FONT_RE.match(v):
            raise HTTPException(400, f"Invalid base_font_size: {v!r}")
        return v
    if field == "h1_scale":
        if not _H1_SCALE_RE.match(v):
            raise HTTPException(400, f"Invalid h1_scale: {v!r}")
        return v
    raise HTTPException(400, f"Unknown typography field: {field}")


def _sanitize_full(patch: dict) -> dict:
    """Whitelist + validate every incoming section/key. Rejects unknown."""
    out: Dict[str, Dict[str, str]] = {"colors": {}, "radius": {}, "typography": {}}
    colors = patch.get("colors") or {}
    if not isinstance(colors, dict):
        raise HTTPException(400, "colors must be an object")
    for k, v in colors.items():
        if k not in COLOR_KEYS:
            raise HTTPException(400, f"Unknown color key: {k}")
        out["colors"][k] = _sanitize_color(v)

    radius = patch.get("radius") or {}
    if not isinstance(radius, dict):
        raise HTTPException(400, "radius must be an object")
    for k, v in radius.items():
        if k not in RADIUS_KEYS:
            raise HTTPException(400, f"Unknown radius key: {k}")
        out["radius"][k] = _sanitize_radius(v)

    typo = patch.get("typography") or {}
    if not isinstance(typo, dict):
        raise HTTPException(400, "typography must be an object")
    for k, v in typo.items():
        if k not in TYPO_KEYS:
            raise HTTPException(400, f"Unknown typography key: {k}")
        out["typography"][k] = _sanitize_typography_field(k, v)
    return out


# ------------------------------------------------------------------
# Persistence + audit
# ------------------------------------------------------------------
def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _get_or_init() -> dict:
    doc = await db.design_tokens.find_one({"_id": "design_tokens"})
    if doc:
        return doc
    seed = {
        "_id": "design_tokens",
        **DEFAULT_TOKENS,
        "updated_at": _now(),
        "updated_by": "bootstrap",
    }
    try:
        await db.design_tokens.insert_one(seed)
    except Exception:  # noqa: BLE001
        pass
    return seed


async def _audit_tokens(action: str, user: dict, before: Optional[dict], after: Optional[dict]):
    try:
        await db.admin_audit_log.insert_one({
            "action": action,
            "actor_id": str(user.get("id") or user.get("_id") or ""),
            "actor_name": user.get("name") or user.get("email") or "",
            "actor_email": user.get("email") or "",
            "target": {"type": "design_tokens", "id": "global", "label": "design_tokens"},
            "before": before,
            "after": after,
            "created_at": _now(),
        })
    except Exception as exc:  # noqa: BLE001
        logger.warning("[design_tokens] audit insert failed: %s", exc)


# ------------------------------------------------------------------
# Admin endpoints
# ------------------------------------------------------------------
class TokensPatch(BaseModel):
    colors: Optional[Dict[str, str]] = None
    radius: Optional[Dict[str, str]] = None
    typography: Optional[Dict[str, str]] = None


@router.get("")
async def get_tokens(_user: dict = Depends(require_role("admin", "operator"))):
    doc = await _get_or_init()
    doc.pop("_id", None)
    return doc


@router.put("")
async def save_tokens(patch: TokensPatch,
                      user: dict = Depends(require_role("admin"))):
    before = await _get_or_init()
    incoming = _sanitize_full(patch.model_dump(exclude_none=True))

    # Merge into current — never lose keys the caller did not touch.
    merged = {
        "colors": {**(before.get("colors") or {}), **incoming.get("colors", {})},
        "radius": {**(before.get("radius") or {}), **incoming.get("radius", {})},
        "typography": {**(before.get("typography") or {}), **incoming.get("typography", {})},
    }
    await db.design_tokens.update_one(
        {"_id": "design_tokens"},
        {"$set": {
            **merged,
            "updated_at": _now(),
            "updated_by": str(user.get("email") or user.get("id") or ""),
        }},
        upsert=True,
    )
    fresh = await _get_or_init()
    fresh_public = {k: v for k, v in fresh.items() if k != "_id"}
    await _audit_tokens("design_tokens.save", user,
                        before={k: v for k, v in before.items() if k != "_id"},
                        after=fresh_public)
    return {"ok": True, **fresh_public}


@router.post("/reset")
async def reset_tokens(user: dict = Depends(require_role("admin"))):
    before = await _get_or_init()
    await db.design_tokens.update_one(
        {"_id": "design_tokens"},
        {"$set": {
            **DEFAULT_TOKENS,
            "updated_at": _now(),
            "updated_by": str(user.get("email") or "reset"),
        }},
        upsert=True,
    )
    fresh = await _get_or_init()
    fresh_public = {k: v for k, v in fresh.items() if k != "_id"}
    await _audit_tokens("design_tokens.reset", user,
                        before={k: v for k, v in before.items() if k != "_id"},
                        after=fresh_public)
    return {"ok": True, **fresh_public}


# ------------------------------------------------------------------
# Public endpoint (read-only)
# ------------------------------------------------------------------
@public_router.get("")
async def public_tokens():
    doc = await _get_or_init()
    return {
        "colors": doc.get("colors") or {},
        "radius": doc.get("radius") or {},
        "typography": doc.get("typography") or {},
        "updated_at": doc.get("updated_at"),
    }
