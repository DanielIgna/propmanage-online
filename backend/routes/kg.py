"""KG-0 REST API (admin) — registrul entity_links (Blueprint §12, etapa KG-0)."""
from fastapi import APIRouter, Depends, HTTPException

from deps import require_role
from kg.links import backfill_entity_links, kg_stats, links_of

router = APIRouter(prefix="/api/admin/kg", tags=["knowledge-graph"])

NODE_TYPES = {"property", "user", "request", "dispute", "transaction", "phase", "conversation", "notification"}


@router.get("/stats")
async def get_kg_stats(user=Depends(require_role("admin"))):
    return await kg_stats()


@router.get("/entity/{entity_type}/{entity_id}")
async def get_entity_links(entity_type: str, entity_id: str, rel: str = None, user=Depends(require_role("admin"))):
    if entity_type not in NODE_TYPES:
        raise HTTPException(400, f"Tip de nod necunoscut: {entity_type}")
    return await links_of(entity_type, entity_id, rel)


@router.post("/backfill")
async def run_backfill(user=Depends(require_role("admin"))):
    return await backfill_entity_links()
