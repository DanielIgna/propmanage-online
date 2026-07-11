"""Financial Cockpit — complete money view from real DB data.

Streams: Stripe payments (paid), escrow (held/frozen/released amounts from
requests), House Health subscriptions (MRR/ARR). TVA estimate at 21% (RO 2026).
Cash flow = daily paid amounts over the last 30 days.
"""
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends

from db import db
from deps import require_role

router = APIRouter(prefix="/api/admin/financial-cockpit", tags=["financial-cockpit"])
logger = logging.getLogger("propmanage.financial_cockpit")

VAT_RATE = 0.21
EUR_RON = 4.98


@router.get("")
async def financial_cockpit(_admin=Depends(require_role("admin"))):
    now = datetime.now(timezone.utc)
    d30 = now - timedelta(days=30)
    d60 = now - timedelta(days=60)

    # ── Payments (Stripe) ────────────────────────────────────────────────────
    total_paid = 0.0
    rev_30 = 0.0
    rev_prev = 0.0
    daily: dict[str, float] = {}
    async for p in db.payment_transactions.find({"payment_status": "paid"}, {"amount": 1, "created_at": 1}):
        amt = float(p.get("amount") or 0)
        total_paid += amt
        ts = p.get("created_at") or ""
        if ts >= d30.isoformat():
            rev_30 += amt
            daily[ts[:10]] = daily.get(ts[:10], 0) + amt
        elif ts >= d60.isoformat():
            rev_prev += amt
    growth = round((rev_30 - rev_prev) / rev_prev * 100, 1) if rev_prev else None
    pending_amount = 0.0
    async for p in db.payment_transactions.find({"payment_status": {"$in": ["pending", "initiated"]}}, {"amount": 1}):
        pending_amount += float(p.get("amount") or 0)

    # ── Escrow (on requests) ─────────────────────────────────────────────────
    escrow: dict[str, dict[str, float]] = {s: {"count": 0, "amount": 0.0} for s in ("held", "frozen", "released")}
    async for r in db.requests.find({"escrow_status": {"$in": list(escrow)}}, {"escrow_status": 1, "escrow_amount": 1}):
        e = escrow[r["escrow_status"]]
        e["count"] += 1
        e["amount"] += float(r.get("escrow_amount") or 0)

    # ── Subscriptions (House Health) → MRR/ARR ───────────────────────────────
    plan_prices: dict[str, float] = {}
    async for pl in db.hh_plans.find({}, {"slug": 1, "price_eur": 1}):
        plan_prices[pl.get("slug")] = float(pl.get("price_eur") or 0)
    active_subs = 0
    mrr_eur = 0.0
    now_iso = now.isoformat()
    async for s in db.hh_subscriptions.find({"status": "active"}, {"plan": 1, "expires_at": 1}):
        if (s.get("expires_at") or "") >= now_iso:
            active_subs += 1
            mrr_eur += plan_prices.get(s.get("plan"), 0)
    mrr_ron = round(mrr_eur * EUR_RON, 2)

    # ── Cash flow series (30 days) ───────────────────────────────────────────
    series = []
    for i in range(29, -1, -1):
        day = (now - timedelta(days=i)).strftime("%Y-%m-%d")
        series.append({"date": day, "amount": round(daily.get(day, 0), 2)})

    # ── Commissions: lead fee estimate = 10% of released escrow (platform take) ──
    commission_est = round(escrow["released"]["amount"] * 0.10, 2)

    revenue_recognized = rev_30
    vat_est = round(revenue_recognized * VAT_RATE, 2)

    return {
        "generated_at": now_iso,
        "revenue": {
            "total_paid": round(total_paid, 2),
            "last_30d": round(rev_30, 2),
            "prev_30d": round(rev_prev, 2),
            "growth_pct": growth,
            "pending_amount": round(pending_amount, 2),
        },
        "escrow": {k: {"count": v["count"], "amount": round(v["amount"], 2)} for k, v in escrow.items()},
        "subscriptions": {
            "active": active_subs,
            "mrr_eur": round(mrr_eur, 2),
            "mrr_ron": mrr_ron,
            "arr_ron": round(mrr_ron * 12, 2),
        },
        "commissions": {"released_escrow_take_est": commission_est, "rate_note": "estimare 10% din escrow eliberat"},
        "vat": {"rate_pct": int(VAT_RATE * 100), "estimated_30d": vat_est},
        "cash_flow_30d": series,
        "cash_flow_total_30d": round(sum(s["amount"] for s in series), 2),
    }
