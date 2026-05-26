"""PropManage router: specialist_docs."""
import os
import asyncio
import json
import logging
from typing import Optional, List, Literal, Dict
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, Field

from db import db
from core_utils import serialize_doc, effective_role
from deps import get_current_user, require_role
from services import send_email, notify, send_web_push, log_event
from models import *
from email_service import (
    send_template, tpl_welcome, tpl_dispute_opened, tpl_dispute_resolved,
    tpl_design_phase_quote, tpl_specialist_verified, tpl_escrow_funded,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["specialist_docs"])

# ============= SPECIALIST DOCUMENTS (self-upload) =============
@router.get("/specialist/documents")
async def list_my_documents(user: dict = Depends(require_role("specialist"))):
    spec = await db.users.find_one({"_id": ObjectId(user["id"])})
    return spec.get("documents") or []

@router.post("/specialist/documents")
async def upload_document(data: DocumentIn, user: dict = Depends(require_role("specialist"))):
    # Cap document payload size to prevent BSON overflow (each doc ≤ 4MB; array stays well under 16MB)
    if len(data.url) > 5_500_000:  # ~4MB base64 encoded
        raise HTTPException(413, "Document depășește 4MB. Folosește un fișier mai mic.")
    spec = await db.users.find_one({"_id": ObjectId(user["id"])})
    if len(spec.get("documents") or []) >= 20:
        raise HTTPException(400, "Maximum 20 documente. Șterge documente vechi pentru a încărca altele noi.")
    doc = {
        "id": str(uuid.uuid4()),
        "type": data.type,
        "name": data.name,
        "url": data.url,
        "status": "pending",
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$push": {"documents": doc}}
    )
    return doc

@router.delete("/specialist/documents/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(require_role("specialist"))):
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$pull": {"documents": {"id": doc_id}}}
    )
    return {"ok": True}

