"""PropManage router: AI Brain (AIB-001 — status, discovery, knowledge registry)."""
from fastapi import APIRouter, Depends, HTTPException

from deps import require_role
from ai_brain.core import ai_brain_status, run_discovery
from ai_brain import registry

router = APIRouter(prefix="/api/admin/ai-brain", tags=["ai-brain"])


@router.get("/status")
async def status(user=Depends(require_role("admin"))):
    return await ai_brain_status()


@router.post("/discover")
async def discover(user=Depends(require_role("admin"))):
    return await run_discovery(trigger=f"manual:{user.get('email')}")


@router.get("/registry/{kind}")
async def registry_get(kind: str, q: str = "", limit: int = 200, user=Depends(require_role("admin"))):
    if kind not in registry.KINDS:
        raise HTTPException(404, f"Kind necunoscut. Disponibile: {', '.join(registry.KINDS)}")
    return await registry.get(kind, q=q, limit=min(limit, 1000))
