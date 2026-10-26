"""Idempotent seed — Bucin Mob SRL as a strategic prospect in city_partners.

Public info only (bucinmob.ro). NOT activated: no login, no portal access,
no messages, no collaboration agreed. Territories / capacity / exclusivity /
commissions are left UNCONFIRMED (to be negotiated).

Run:  python seed_bucinmob_prospect.py
"""
import asyncio
from datetime import datetime, timezone

from db import db

COMPANY = "Bucin Mob SRL"


async def main():
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.city_partners.find_one({"company": {"$regex": r"^bucin\s*mob", "$options": "i"}})

    profile = {
        "company": COMPANY,
        "website": "https://bucinmob.ro/",
        "city": "Reghin",
        "county": "Mureș",
        "country": "România",
        "partner_type": "supplier",
        "coverage": "regional",
        "categories": [
            "Mobilier din lemn masiv",
            "Uși",
            "Ferestre",
            "Tâmplărie din lemn stratificat",
            "Obloane",
            "Căsuțe de grădină",
        ],
        "zones": [],  # teritorii comerciale neconfirmate
        "status": "negotiation",  # prospect strategic / pregătit pentru negociere
        "collaboration_agreed": False,
        "portal_access_enabled": False,
        "origin_confirmed": True,  # sediul Reghin este informație publică
        "coverage_confirmed": False,  # teritoriile se negociază
        "info_source": "Informații publice — bucinmob.ro",
        "next_action": "Prezentare funcționalitate la întâlnirea comercială; activare manuală ulterioară.",
        "notes": (
            "Prospect strategic. Teritorii comerciale, capacitate, exclusivitate și "
            "comisioane NECONFIRMATE (de negociat). Fără colaborare activă, fără cont "
            "sau acces portal până la acțiunea explicită a administratorului."
        ),
        "updated_at": now,
    }

    if existing:
        await db.city_partners.update_one({"_id": existing["_id"]}, {"$set": profile})
        print(f"[bucinmob] updated existing profile id={existing['_id']} status={profile['status']}")
    else:
        profile["created_at"] = now
        profile["units_managed"] = 0
        profile["onboarding_step"] = 0
        res = await db.city_partners.insert_one(profile)
        print(f"[bucinmob] created profile id={res.inserted_id} status={profile['status']}")

    doc = await db.city_partners.find_one({"company": {"$regex": r"^bucin\s*mob", "$options": "i"}})
    print(
        f"[bucinmob] verify -> status={doc.get('status')} "
        f"collaboration_agreed={doc.get('collaboration_agreed')} "
        f"portal_access_enabled={doc.get('portal_access_enabled')} "
        f"linked_user_id={doc.get('linked_user_id')}"
    )


if __name__ == "__main__":
    asyncio.run(main())
