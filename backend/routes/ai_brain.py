"""PropManage router: AI Brain (AIB-001 discovery + AIB-002 context awareness)."""
from fastapi import APIRouter, Depends, HTTPException, Body

from deps import require_role, get_current_user
from db import db
from ai_brain.core import ai_brain_status, run_discovery
from ai_brain import registry, context as ctx

router = APIRouter(prefix="/api/admin/ai-brain", tags=["ai-brain"])
user_router = APIRouter(prefix="/api/ai-brain", tags=["ai-brain-context"])


def _uid(user: dict) -> str:
    return user.get("id") or str(user.get("_id", ""))


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


# ============================================================================
# AIB-002 · Context Awareness — endpoint-uri utilizator autentificat
# ============================================================================
@user_router.get("/context")
async def my_context(path: str = "", entity_id: str = None, action: str = None,
                     user=Depends(get_current_user)):
    return await ctx.resolve_context(user, path=path, entity_id=entity_id, action=action)


@user_router.post("/navigation")
async def record_navigation(payload: dict = Body(...), user=Depends(get_current_user)):
    path = (payload.get("path") or "").strip()
    if not path.startswith("/"):
        raise HTTPException(400, "path invalid")
    return await ctx.record_navigation(_uid(user), path)


@user_router.get("/navigation")
async def my_navigation(limit: int = 20, user=Depends(get_current_user)):
    return await ctx.navigation_history(_uid(user), limit=min(limit, 100))


@user_router.post("/conversation")
async def conversation_append(payload: dict = Body(...), user=Depends(get_current_user)):
    session_id = (payload.get("session_id") or "").strip()
    content = (payload.get("content") or "").strip()
    if not session_id or not content:
        raise HTTPException(400, "session_id și content sunt obligatorii")
    return await ctx.conversation_append(
        _uid(user), session_id, payload.get("role") or "user", content,
        entities=payload.get("entities"), topic=payload.get("topic"))


@user_router.get("/conversation/{session_id}")
async def conversation_get(session_id: str, user=Depends(get_current_user)):
    doc = await ctx.conversation_get(_uid(user), session_id)
    if not doc:
        raise HTTPException(404, "Conversație inexistentă")
    return doc


@user_router.get("/conversations")
async def conversation_list(user=Depends(get_current_user)):
    return {"items": await ctx.conversation_list(_uid(user))}


# ============================================================================
# AIB-003 · Explainability Engine — Context First, grounding real, cache per rol
# ============================================================================
@user_router.post("/explain/page")
async def explain_page(payload: dict = Body(...), user=Depends(get_current_user)):
    from ai_brain import explain
    path = (payload.get("path") or "").strip()
    if not path.startswith("/"):
        raise HTTPException(400, "path invalid")
    return await explain.explain_page(user, path)


@user_router.post("/explain/component")
async def explain_component(payload: dict = Body(...), user=Depends(get_current_user)):
    from ai_brain import explain
    path = (payload.get("path") or "").strip()
    ref = (payload.get("component") or "").strip()
    if not path.startswith("/") or not ref:
        raise HTTPException(400, "path și component sunt obligatorii")
    return await explain.explain_component(user, path, ref)


@user_router.post("/explain/process")
async def explain_process(payload: dict = Body(...), user=Depends(get_current_user)):
    from ai_brain import explain
    path = (payload.get("path") or "").strip()
    if not path.startswith("/"):
        raise HTTPException(400, "path invalid")
    return await explain.explain_process(user, path)


# ============================================================================
# AIB-004 · AI Mentor — copilot contextual per rol
# ============================================================================
@user_router.get("/mentor")
async def mentor(path: str, replay: bool = False, include_guide: bool = False,
                 user=Depends(get_current_user)):
    from ai_brain import mentor as mentor_svc
    if not path.startswith("/"):
        raise HTTPException(400, "path invalid")
    return await mentor_svc.mentor_advise(user, path, replay=replay, include_guide=include_guide)


@user_router.post("/mentor/empty-state")
async def mentor_empty_state(payload: dict = Body(...), user=Depends(get_current_user)):
    from ai_brain import mentor as mentor_svc
    path = (payload.get("path") or "").strip()
    resource = (payload.get("resource") or "").strip()
    if not path.startswith("/") or not resource:
        raise HTTPException(400, "path și resource sunt obligatorii")
    return await mentor_svc.empty_state(user, path, resource)


# ============================================================================
# AIB-002 · Context Inspector — admin analizează contextul oricărui utilizator
# ============================================================================
@router.get("/context/inspect")
async def context_inspect(email: str, path: str = "", entity_id: str = None,
                          user=Depends(require_role("admin"))):
    target = await db.users.find_one({"email": email.strip().lower()})
    if not target:
        raise HTTPException(404, f"Utilizator inexistent: {email}")
    target["id"] = target.get("id") or str(target["_id"])
    return {
        "context": await ctx.resolve_context(target, path=path, entity_id=entity_id),
        "navigation": await ctx.navigation_history(target["id"], limit=15),
        "conversations": await ctx.conversation_list(target["id"], limit=5),
    }
