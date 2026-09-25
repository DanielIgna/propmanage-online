"""Design ecosystem — semantic relation layer (Faza 4A prep).

Maps the EXISTING 17-step Design Interior process to the entity roles that will,
in the future, be filled by REAL data (specialists, partners, brands, materials,
furniture, projects). This is a conceptual/relational scaffold only — it invents
NO partners, brands, materials or projects. It lets a stage be linked later to the
appropriate entity types without building a new engine.

Stage numbers/titles mirror service_content_design.DEFAULT_CONTENT["process_phases"].
Entity roles: service | specialist | studio | partner | supplier | brand | material |
furniture | platform (PropManage-native).
"""

# stage_n → {title, phase, roles[]}  (roles = entity types that can attach to the stage)
STAGE_ENTITY_MAP: list[dict] = [
    {"n": 1,  "title": "Consultanță inițială",        "phase": "Descoperire",   "roles": ["service", "studio", "specialist"]},
    {"n": 2,  "title": "Audit tehnic al locuinței",    "phase": "Descoperire",   "roles": ["service", "specialist"]},
    {"n": 3,  "title": "Ridicare măsurători",          "phase": "Descoperire",   "roles": ["service", "specialist"]},
    {"n": 4,  "title": "Scanare Digital Twin",         "phase": "Digitalizare",  "roles": ["platform", "studio", "specialist"]},
    {"n": 5,  "title": "Model 3D al proprietății",     "phase": "Digitalizare",  "roles": ["platform", "studio", "specialist"]},
    {"n": 6,  "title": "Planșe tehnice",               "phase": "Digitalizare",  "roles": ["service", "specialist"]},
    {"n": 7,  "title": "Arhitectură de interior",      "phase": "Proiectare",    "roles": ["studio", "specialist"]},
    {"n": 8,  "title": "Design interior",              "phase": "Proiectare",    "roles": ["studio", "specialist"]},
    {"n": 9,  "title": "Alegerea materialelor",        "phase": "Proiectare",    "roles": ["supplier", "brand", "material", "partner"]},
    {"n": 10, "title": "Soluții tehnice",              "phase": "Proiectare",    "roles": ["supplier", "specialist", "brand"]},
    {"n": 11, "title": "Bugetare",                     "phase": "Proiectare",    "roles": ["service", "platform"]},
    {"n": 12, "title": "Management implementare",      "phase": "Implementare",  "roles": ["platform", "partner"]},
    {"n": 13, "title": "Coordonare echipe",            "phase": "Implementare",  "roles": ["partner", "specialist"]},
    {"n": 14, "title": "Verificarea execuției",        "phase": "Implementare",  "roles": ["specialist", "platform"]},
    {"n": 15, "title": "Recepția lucrării",            "phase": "Implementare",  "roles": ["specialist", "platform"]},
    {"n": 16, "title": "Actualizarea Digital Twin",    "phase": "Viață lungă",   "roles": ["platform"]},
    {"n": 17, "title": "House Health",                 "phase": "Viață lungă",   "roles": ["platform"]},
]

# Design → Project semantic chain (prepared for future programmatic SEO / project pages).
# Order reflects how a real project connects entities. No entity is auto-INDEX.
PROJECT_RELATION_CHAIN: list[str] = [
    "city", "locality", "space_type", "style", "studio", "designer",
    "partner", "brand", "material", "furniture", "service", "cta",
]

# Where each entity type currently lives in the codebase (reuse map — no parallel systems).
ENTITY_SOURCES: dict[str, str] = {
    "service": "service_content_design.DEFAULT_CONTENT (design interior services)",
    "specialist": "marketplace / specialists (existing)",
    "studio": "design-interior studios (Irene's World — first node)",
    "partner": "city_partners (partner_type=city|regional|national)",
    "supplier": "city_partners (partner_type=supplier) — REUSED, no parallel registry",
    "brand": "city_partner_products.brand (existing catalog field) — no parallel brand registry",
    "material": "city_partner_products (existing catalog)",
    "furniture": "/servicii/mobilier + city_partner_products (tags)",
    "project": "PREPARED — no real projects stored yet (CANDIDATE)",
    "platform": "PropManage-native (Digital Twin, Audit, House Health, Escrow)",
}


def ecosystem_map() -> dict:
    """Read-only conceptual map — safe to expose to admin for observability."""
    return {
        "stages": STAGE_ENTITY_MAP,
        "stage_count": len(STAGE_ENTITY_MAP),
        "project_relation_chain": PROJECT_RELATION_CHAIN,
        "entity_sources": ENTITY_SOURCES,
        "note": "Scaffold conceptual. Nicio entitate nu devine automat INDEX; "
                "pagini publice se creează doar cu date reale + conținut original + intenție de căutare.",
    }
