// SEO landing page slug mappings — MIRROR of backend/seo_slugs.py
// Single source of truth on the frontend for /marketplace/:slug routing.

// slug → { dbCategory, label, plural }
export const SEO_CATEGORY_MAP = {
  "electrician":            { db: "electric",         label: "Electrician",           plural: "Electricieni" },
  "instalator":             { db: "plumbing",         label: "Instalator",            plural: "Instalatori" },
  "hvac":                   { db: "hvac",             label: "Specialist HVAC",       plural: "Specialiști HVAC" },
  "design-interior":        { db: "interior_design",  label: "Designer interior",     plural: "Designeri interior" },
  "tamplar":                { db: "carpentry",        label: "Tâmplar",               plural: "Tâmplari" },
  "zugrav":                 { db: "painting",         label: "Zugrav",                plural: "Zugravi" },
  "firma-curatenie":        { db: "cleaning",         label: "Firmă de curățenie",    plural: "Firme de curățenie" },
  "service-electrocasnice": { db: "appliance_repair", label: "Service electrocasnice",plural: "Service-uri electrocasnice" },
  "gradinar":               { db: "gardening",        label: "Grădinar",              plural: "Grădinari" },
};

// slug → city display name (matches backend regions collection)
export const SEO_CITY_MAP = {
  "bucuresti":              "București",
  "cluj-napoca":            "Cluj-Napoca",
  "cluj":                   "Cluj-Napoca",
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
};

/**
 * Parse a slug like "electrician-bucuresti" into structured filters.
 * Returns null if the slug doesn't match any known category.
 */
export const parseLandingSlug = (slug) => {
  if (!slug) return null;
  const s = slug.toLowerCase().trim();

  // Find the longest category prefix
  const catKeys = Object.keys(SEO_CATEGORY_MAP).sort((a, b) => b.length - a.length);
  const matched = catKeys.find(k => s === k || s.startsWith(`${k}-`));
  if (!matched) return null;

  const cat = SEO_CATEGORY_MAP[matched];
  const rest = s.slice(matched.length).replace(/^-+/, "");

  let citySlug = null;
  let cityLabel = null;
  if (rest) {
    const cityKeys = Object.keys(SEO_CITY_MAP).sort((a, b) => b.length - a.length);
    const cityMatch = cityKeys.find(k => rest === k);
    if (!cityMatch) return null;  // unknown city → 404
    citySlug = cityMatch;
    cityLabel = SEO_CITY_MAP[cityMatch];
  }

  return {
    categorySlug: matched,
    categoryDb: cat.db,
    categoryLabel: cat.label,
    categoryPlural: cat.plural,
    citySlug,
    cityLabel,
  };
};

// Top cities used for internal-linking suggestions on landing pages
export const TOP_CITIES_FOR_LINKING = [
  "bucuresti", "cluj-napoca", "timisoara", "iasi", "brasov",
  "constanta", "craiova", "sibiu", "oradea", "ploiesti",
];
