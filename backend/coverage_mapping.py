"""Coverage mapping — leagă zonele din profilul clientului (House Health) de
categoriile nZEB ale City Partners și de cererile din marketplace.

Strat pur de corelație: NU modifică taxonomia de servicii (CIP-A), design interior
sau structura contului client. Reutilizează câmpurile existente ale partenerilor
(`categories`, `county`, `status`, `linked_user_id`) și mecanismul de referral
existent (`user.referrer_id` → `/register?ref=<uid>`).
"""
from db import db

# Zonele de sănătate a locuinței, exact cum apar în profilul clientului
# (categoriile House Health: air/thermal/humidity/electric/radon/structural/docs).
CLIENT_ZONES = {
    "air": "Calitatea aerului & ventilație",
    "thermal": "Confort termic & eficiență energetică",
    "humidity": "Umiditate & izolații",
    "electric": "Instalații electrice & energie",
    "radon": "Radon & ventilație",
    "structural": "Structură & anvelopa clădirii",
    "docs": "Documentație & audit energetic",
}

# Zonă client → categoriile nZEB (City Partner) care o acoperă.
# Valorile trebuie să corespundă exact cu NZEB_CATEGORIES din routes/city_partners.py.
ZONE_TO_NZEB = {
    "air": ["Ventilație și recuperare de căldură", "HVAC și instalații"],
    "thermal": [
        "HVAC și instalații", "Pompe de căldură",
        "Izolații și renovări", "Audit și consultanță energetică",
    ],
    "humidity": ["Izolații și renovări", "Ventilație și recuperare de căldură"],
    "electric": ["HVAC și instalații", "Fotovoltaice și stocare"],
    "radon": ["Ventilație și recuperare de căldură"],
    "structural": ["Izolații și renovări", "Tâmplărie și anvelopa clădirii"],
    "docs": ["Audit și consultanță energetică"],
}

DEFAULT_COUNTY = "Cluj"


def nzeb_categories_for_zone(zone: str) -> list:
    return ZONE_TO_NZEB.get(zone, [])


def zones_list() -> list:
    """Zonele + eticheta + categoriile nZEB corelate (pentru UI/Admin)."""
    return [
        {"zone": z, "label": CLIENT_ZONES[z], "nzeb_categories": ZONE_TO_NZEB.get(z, [])}
        for z in CLIENT_ZONES
    ]


def _norm(s: str) -> str:
    return (s or "").strip().lower()


def _partner_referral_url(partner: dict) -> str | None:
    uid = partner.get("linked_user_id")
    return f"/register?ref={uid}" if uid else None


def partner_covers_zone(partner: dict, zone: str) -> bool:
    target = {_norm(c) for c in nzeb_categories_for_zone(zone)}
    if not target:
        return False
    cats = {_norm(c) for c in (partner.get("categories") or [])}
    return bool(cats & target)


async def match_partners_for_zone(zone: str, county: str = DEFAULT_COUNTY) -> list:
    """City Partners ACTIVI care acoperă o zonă în județul dat.
    Doar parteneri activi (nu prospecți) — nicio publicare automată a prospecților.
    """
    nzeb = nzeb_categories_for_zone(zone)
    if not nzeb:
        return []
    q = {"status": "active"}
    if county:
        q["county"] = county
    out = []
    async for p in db.city_partners.find(q):
        if partner_covers_zone(p, zone):
            matched = [c for c in (p.get("categories") or []) if _norm(c) in {_norm(x) for x in nzeb}]
            out.append({
                "partner_id": str(p.get("_id")),
                "company": p.get("company"),
                "county": p.get("county"),
                "coverage": p.get("coverage") or "city",
                "matched_categories": matched,
                "referral_url": _partner_referral_url(p),
            })
    return out


async def resolve_referring_partner(client_doc: dict) -> dict | None:
    """Dacă un client a venit prin linkul de recomandare al unui partener
    (`referrer_id` == `linked_user_id` al partenerului), întoarce partenerul.
    Reutilizează mecanismul de referral existent — nu creează tracking paralel.
    """
    ref = client_doc.get("referrer_id") if client_doc else None
    if not ref:
        return None
    p = await db.city_partners.find_one({"linked_user_id": str(ref)})
    if not p:
        return None
    return {"partner_id": str(p.get("_id")), "company": p.get("company")}
