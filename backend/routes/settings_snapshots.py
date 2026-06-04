"""App Settings Snapshots + Restore.

Daily automatic snapshot of /app_settings doc into app_settings_snapshots.
Manual "Snapshot now" button. Restore any snapshot with one click.

Collection: app_settings_snapshots
  {id, ts, label, settings, created_by, kind: 'auto'|'manual'|'pre_restore'}
"""
import uuid
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional

from deps import require_role
from db import db

logger = logging.getLogger("propmanage.settings_snapshots")
router = APIRouter(prefix="/api/admin/app-settings/snapshots", tags=["admin-snapshots"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _take_snapshot(kind: str, label: str, created_by: Optional[str]) -> dict:
    current = await db.app_settings.find_one({"_id": "app_settings"})
    if not current:
        current = {"_id": "app_settings"}
    current_clean = {k: v for k, v in current.items() if k != "_id"}
    snap = {
        "id": uuid.uuid4().hex,
        "ts": _now(),
        "kind": kind,  # auto / manual / pre_restore
        "label": label[:200],
        "settings": current_clean,
        "created_by": created_by or "system",
    }
    await db.app_settings_snapshots.insert_one(snap)
    # Keep only most recent 50 (rolling buffer)
    cur = db.app_settings_snapshots.find({}, {"id": 1, "_id": 0}).sort("ts", -1).skip(50).limit(1000)
    old_ids = [s["id"] async for s in cur]
    if old_ids:
        await db.app_settings_snapshots.delete_many({"id": {"$in": old_ids}})
    snap.pop("_id", None)
    return snap


class SnapIn(BaseModel):
    label: str = Field(default="Snapshot manual", max_length=200)


@router.post("")
async def manual_snapshot(payload: SnapIn, admin=Depends(require_role("admin"))):
    return await _take_snapshot("manual", payload.label, admin.get("email"))


@router.get("")
async def list_snapshots(limit: int = 30, admin=Depends(require_role("admin"))):
    cur = db.app_settings_snapshots.find({}, {"settings": 0}).sort("ts", -1).limit(int(limit))
    items = []
    async for s in cur:
        s.pop("_id", None)
        items.append(s)
    return {"items": items, "total": len(items)}


@router.get("/{sid}")
async def get_snapshot(sid: str, admin=Depends(require_role("admin"))):
    s = await db.app_settings_snapshots.find_one({"id": sid})
    if not s:
        raise HTTPException(404, "Snapshot not found")
    s.pop("_id", None)
    return s


@router.post("/{sid}/restore")
async def restore_snapshot(sid: str, admin=Depends(require_role("admin"))):
    s = await db.app_settings_snapshots.find_one({"id": sid})
    if not s:
        raise HTTPException(404, "Snapshot not found")
    # 1. Snapshot current state BEFORE restore (safety net)
    await _take_snapshot("pre_restore", f"Înainte de restore '{s.get('label', '?')}'", admin.get("email"))
    # 2. Replace settings
    new_doc = {"_id": "app_settings", **(s.get("settings") or {})}
    await db.app_settings.replace_one({"_id": "app_settings"}, new_doc, upsert=True)
    return {"restored": True, "from_snapshot": sid, "from_label": s.get("label")}


# Helper called by the scheduler in server.py (registered there)
async def take_auto_snapshot():
    """Called daily by APScheduler."""
    try:
        await _take_snapshot("auto", f"Snapshot automat {_now()[:10]}", "scheduler")
        logger.info("[snapshots] daily auto-snapshot taken")
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[snapshots] auto snapshot failed: {e}")
