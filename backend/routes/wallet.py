"""PropManage router: wallet."""
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
router = APIRouter(prefix="/api", tags=["wallet"])

# ============= TRANSACTIONS / WALLET =============
@router.get("/transactions")
async def list_transactions(user: dict = Depends(get_current_user)):
    docs = await db.transactions.find({"user_id": user["id"]}).sort("created_at", -1).to_list(50)
    return [serialize_doc(d) for d in docs]

@router.post("/wallet/topup")
async def topup_wallet(amount: float, user: dict = Depends(get_current_user)):
    if amount <= 0 or amount > 10000:
        raise HTTPException(400, "Invalid amount")
    await db.users.update_one(
        {"_id": ObjectId(user["id"])},
        {"$inc": {"wallet_balance": amount}}
    )
    await db.transactions.insert_one({
        "user_id": user["id"],
        "type": "topup",
        "amount": amount,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    return {"ok": True, "added": amount}

