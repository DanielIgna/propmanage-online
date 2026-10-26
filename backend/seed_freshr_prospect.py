"""Idempotent seed: Fresh-r as an UNCONTACTED commercial prospect (City nZEB).
Safe to run multiple times — upserts on company+website. No account/login is created,
profile is NOT published as an active partner (status = prospect)."""
import asyncio
from datetime import datetime, timezone
from db import db

FRESHR = {
    "company": "Fresh-r",
    "website": "fresh-r.com",
    "contact_name": "Jelle van Kraaij",
    "contact_role": "Business Development & R&D",
    "contact_email": "jelle@fresh-r.eu",
    "contact_phone": "+31 85 226 15 20",
    "country": None,                       # de confirmat din surse comerciale
    "city": None,
    "county": None,
    "region": None,
    "categories": ["Ventilație și recuperare de căldură"],
    "applications": ["renovare", "modernizare", "construcții noi"],
    "services": ["Ventilație descentralizată cu recuperare de căldură"],
    "zones": [],                           # acoperire comercială în România neconfirmată
    "partner_type": "supplier",
    "coverage": "national",
    "status": "prospect",                  # Prospect / Necontactat
    "collaboration_agreed": False,         # Colaborare agreată: Nu
    "origin_confirmed": False,             # Origine: de confirmat (prefix telefonic +31)
    "coverage_confirmed": False,           # Acoperire comercială RO: neconfirmată
    "next_action": "Contact inițial + prezentare rețea City Partners",
    "info_source": "Date comerciale publice (site oficial fresh-r.com)",
    "notes": "Profil DEMO/PROSPECT. Furnizorul NU a fost contactat; colaborarea nu a fost agreată. "
             "Origine de confirmat (prefix telefonic +31). Acoperire comercială în România neconfirmată.",
}


async def main():
    now = datetime.now(timezone.utc).isoformat()
    existing = await db.city_partners.find_one({
        "company": {"$regex": "^Fresh-r$", "$options": "i"},
        "website": {"$regex": "^fresh-r.com$", "$options": "i"},
    })
    doc = {
        **FRESHR,
        "units_managed": 0,
        "growth_rate": None,
        "portfolio_type": None,
        "capacity_note": None,
        "target_client_type": None,
        "design_stages": [],
        "brands": [],
        "materials": [],
        "projects": [],
        "collaboration_metrics": {},
        "onboarding_step": 0,
        "onboarding_complete": False,
        "territory_protected": False,
        "linked_user_id": None,
        "updated_at": now,
    }
    if existing:
        await db.city_partners.update_one({"_id": existing["_id"]}, {"$set": doc})
        print(f"Fresh-r prospect updated (id={existing['_id']})")
    else:
        doc["created_at"] = now
        doc["created_by"] = "seed:city-nzeb"
        res = await db.city_partners.insert_one(doc)
        print(f"Fresh-r prospect created (id={res.inserted_id})")


if __name__ == "__main__":
    asyncio.run(main())
