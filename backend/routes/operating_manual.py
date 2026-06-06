"""PropManage — Operating Manual API

Serves the canonical `/app/docs/OPERATING_MANUAL.md` to the admin UI so the
founder can read the full how-to inside the dashboard, no terminal needed.

Read-only. Markdown is rendered client-side.
"""
import os
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException

from deps import require_role

logger = logging.getLogger("propmanage.operating_manual")
router = APIRouter(prefix="/api/admin/operating-manual", tags=["operating-manual"])

MANUAL_PATH = Path(__file__).resolve().parent.parent.parent / "docs" / "OPERATING_MANUAL.md"


@router.get("")
async def get_manual(user=Depends(require_role("admin"))):
    """Return the full markdown content of the operating manual."""
    if not MANUAL_PATH.exists():
        raise HTTPException(404, f"Manual file missing at {MANUAL_PATH}")
    try:
        content = MANUAL_PATH.read_text(encoding="utf-8")
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[operating_manual] read failed: {e}")
        raise HTTPException(500, "Could not read manual file.")
    stat = MANUAL_PATH.stat()
    return {
        "path": str(MANUAL_PATH),
        "content": content,
        "size_bytes": stat.st_size,
        "modified_at": stat.st_mtime,
        "line_count": content.count("\n") + 1,
    }
