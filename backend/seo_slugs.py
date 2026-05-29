"""SEO landing page slug mappings — single source of truth.

Used by:
  - Backend sitemap generator (routes/public.py) to emit all valid landing-page URLs.
  - Backend /api/marketplace/specialists endpoint (when ?city=slug is passed,
    we expand to all zones inside that city).
  - Frontend MarketplaceLanding.jsx (parses slug → category + city).

Slugs are lowercase ASCII, hyphenated, no diacritics. They become URL segments
like `/marketplace/electrician-bucuresti`.
"""
from __future__ import annotations

# slug → (DB specialty value, RO display label, plural label for SEO copy)
SEO_CATEGORY_MAP: dict[str, tuple[str, str, str]] = {
    "electrician":            ("electric",          "Electrician",          "Electricieni"),
    "instalator":             ("plumbing",          "Instalator",           "Instalatori"),
    "hvac":                   ("hvac",              "Specialist HVAC",      "Specialiști HVAC"),
    "design-interior":        ("interior_design",   "Designer interior",    "Designeri interior"),
    "tamplar":                ("carpentry",         "Tâmplar",              "Tâmplari"),
    "zugrav":                 ("painting",          "Zugrav",               "Zugravi"),
    "firma-curatenie":        ("cleaning",          "Firmă de curățenie",   "Firme de curățenie"),
    "service-electrocasnice": ("appliance_repair",  "Service electrocasnice", "Service-uri electrocasnice"),
    "gradinar":               ("gardening",         "Grădinar",             "Grădinari"),
}

# slug → DB city name (matches romania_zones.py)
SEO_CITY_MAP: dict[str, str] = {
    "bucuresti":              "București",
    "cluj-napoca":            "Cluj-Napoca",
    "cluj":                   "Cluj-Napoca",    # alias for friendlier URLs
    "timisoara":              "Timișoara",
    "iasi":                   "Iași",
    "brasov":                 "Brașov",
    "constanta":              "Constanța",
    "craiova":                "Craiova",
    "galati":                 "Galați",
    "oradea":                 "Oradea",
    "ploiesti":               "Ploiești",
    "sibiu":                  "Sibiu",
    "arad":                   "Arad",
    "bacau":                  "Bacău",
    "pitesti":                "Pitești",
    "braila":                 "Brăila",
    "buzau":                  "Buzău",
    "suceava":                "Suceava",
    "baia-mare":              "Baia Mare",
    "satu-mare":              "Satu Mare",
    "ramnicu-valcea":         "Râmnicu Vâlcea",
    "targu-mures":            "Târgu Mureș",
    "drobeta-turnu-severin":  "Drobeta-Turnu Severin",
}

# Inverse — city DB name → slug (canonical / preferred form, e.g. cluj-napoca not cluj)
CITY_DB_TO_SLUG: dict[str, str] = {}
for slug, db_name in SEO_CITY_MAP.items():
    # Prefer the LONGER slug as canonical (cluj-napoca over cluj)
    existing = CITY_DB_TO_SLUG.get(db_name)
    if existing is None or len(slug) > len(existing):
        CITY_DB_TO_SLUG[db_name] = slug


def parse_landing_slug(slug: str) -> dict | None:
    """Parse a slug like 'electrician-bucuresti' into structured filters.

    Returns dict with keys:
      - category_slug, category_db, category_label, category_plural
      - city_slug (None if no city), city_db (None if no city)
    Returns None if slug doesn't match any known category.
    """
    if not slug:
        return None
    slug = slug.lower().strip()

    # Try the longest category prefix that matches (e.g. "design-interior-bucuresti")
    best_cat = None
    for cat_slug in sorted(SEO_CATEGORY_MAP, key=len, reverse=True):
        if slug == cat_slug or slug.startswith(f"{cat_slug}-"):
            best_cat = cat_slug
            break
    if best_cat is None:
        return None

    cat_db, cat_label, cat_plural = SEO_CATEGORY_MAP[best_cat]
    rest = slug[len(best_cat):].lstrip("-")

    city_slug = None
    city_db = None
    if rest:
        # Try the longest city slug that matches the remainder
        for c_slug in sorted(SEO_CITY_MAP, key=len, reverse=True):
            if rest == c_slug:
                city_slug = c_slug
                city_db = SEO_CITY_MAP[c_slug]
                break
        if city_db is None:
            # Unknown remainder → invalid slug
            return None

    return {
        "category_slug": best_cat,
        "category_db": cat_db,
        "category_label": cat_label,
        "category_plural": cat_plural,
        "city_slug": city_slug,
        "city_db": city_db,
    }


def all_landing_slugs() -> list[str]:
    """Generate every valid landing page slug for the sitemap."""
    slugs: list[str] = []
    for cat_slug in SEO_CATEGORY_MAP:
        slugs.append(cat_slug)  # /marketplace/electrician
        for city_db, city_slug in CITY_DB_TO_SLUG.items():
            slugs.append(f"{cat_slug}-{city_slug}")  # /marketplace/electrician-bucuresti
    return slugs
