// Specialist LOCAL recruitment SEO — /devino-specialist/[categorie]/[localitate]
// Intent = the tradesperson looking for clients ("sunt zugrav în Cluj").
// NOT a marketplace listing. No fake specialists / reviews / invented data.
// Content differs per (trade × locality): trade-specific work + locality demand
// context, composed with shared platform mechanics. INDEX (real content).

// ── Localities (recruitment demand angle, real facts) ───────────────────────
export const SL_LOCALITIES = {
  "cluj-napoca": {
    slug: "cluj-napoca",
    city: "Cluj-Napoca",
    county: "județul Cluj",
    zone: "Cluj-Napoca și cartierele Mănăștur, Mărăști, Gheorgheni, Grigorescu, Zorilor",
    demand: [
      "Cluj-Napoca are un volum mare și constant de lucrări: mii de apartamente în blocuri vechi din Mănăștur, Mărăști și Gheorgheni cer renovări și înlocuiri de instalații, în timp ce ansamblurile noi din Bună Ziua sau Sopor generează lucrări de finisare.",
      "În plus, multe apartamente sunt închiriate studenților și angajaților din IT, ceea ce înseamnă întreținere și reparații recurente. Cererea de specialiști verificați este ridicată tot anul.",
    ],
  },
  "floresti": {
    slug: "floresti",
    city: "Florești",
    county: "județul Cluj",
    zone: "Florești, cea mai mare comună din România, lipită de Cluj-Napoca",
    demand: [
      "Florești este cea mai mare comună din România, cu mii de apartamente noi predate la gri sau semifinisate. Asta înseamnă un volum uriaș de lucrări de finisare și amenajare într-o zonă concentrată.",
      "Populația e tânără și în continuă mișcare, iar proprietarii ocupați, care fac naveta la Cluj, caută specialiști verificați care execută corect de la prima încercare.",
    ],
  },
  "apahida": {
    slug: "apahida",
    city: "Apahida",
    county: "județul Cluj",
    zone: "Apahida, Dezmir, Sânnicoară și Corpadea, la est de Cluj-Napoca",
    demand: [
      "Apahida este o comună în expansiune la est de Cluj, cu case individuale și ansambluri rezidențiale noi. Casele cer lucrări proprii: acoperiș, instalații, izolație, sisteme de încălzire și amenajări în curte.",
      "Dezvoltarea rezidențială și construcțiile noi din Dezmir și Sânnicoară aduc constant lucrări pentru meseriași verificați care lucrează la case, nu doar la apartamente.",
    ],
  },
  "baciu": {
    slug: "baciu",
    city: "Baciu",
    county: "județul Cluj",
    zone: "Baciu, Suceagu, Rădaia, Mera și Corușu, la nord-vest de Cluj-Napoca",
    demand: [
      "Baciu este o comună suburbană alipită de cartierul Grigorescu, cu o dezvoltare constantă de case și mici ansambluri. Fondul locativ dominat de case individuale cere construcție, reabilitare și mentenanță.",
      "Familiile care se mută din Cluj în Baciu, Suceagu sau Rădaia caută meseriași verificați pentru lucrări la casă, de la structură și acoperiș, la instalații și finisaje.",
    ],
  },
};

// ── Trades (trade-specific, distinct per profesie) ──────────────────────────
export const SL_TRADES = {
  "zugrav": {
    slug: "zugrav",
    word: "zugrav",
    plural: "zugravi",
    h1Subject: "Zugrav",
    nationalPath: "/pentru-specialisti/zugrav",
    workTypes: [
      "Zugrăveli complete pentru apartamente și case",
      "Glet, amorsare și pregătirea suprafețelor",
      "Vopsele decorative și tehnici speciale",
      "Montaj tapet și fototapet",
      "Retușuri și refreshuri înainte de mutare sau vânzare",
    ],
    demandNote: "Zugrăveala e printre ultimele etape ale oricărei renovări și una dintre cele mai cerute lucrări la pregătirea unei locuințe pentru închiriere sau vânzare.",
    siblingTrades: ["montator-gresie-faianta", "finisaje-interioare"],
  },
  "finisaje-interioare": {
    slug: "finisaje-interioare",
    word: "specialist în finisaje interioare",
    plural: "specialiști în finisaje",
    h1Subject: "Faci finisaje interioare",
    nationalPath: "/pentru-specialisti",
    workTypes: [
      "Glet, rigips, tavane și pereți de gips-carton",
      "Șape, nivelări și pregătirea suprafețelor",
      "Zugrăveli, vopsele decorative și finisaje speciale",
      "Placări, profile decorative și elemente de finisaj",
      "Finisarea completă a apartamentelor predate la gri",
    ],
    demandNote: "Finisajele interioare acoperă tot ce transformă un spațiu la gri într-o locuință gata de mutare — o cerere uriașă în zonele cu apartamente noi.",
    siblingTrades: ["zugrav", "montator-gresie-faianta"],
  },
  "electrician": {
    slug: "electrician",
    word: "electrician",
    plural: "electricieni",
    h1Subject: "Electrician",
    nationalPath: "/pentru-specialisti/electrician",
    workTypes: [
      "Instalații electrice complete în renovări și apartamente noi",
      "Înlocuirea tabloului electric și a circuitelor vechi",
      "Prize, întrerupătoare, corpuri de iluminat",
      "Avarii și intervenții urgente",
      "Verificări de siguranță și punere la pământ",
    ],
    demandNote: "Multe apartamente din blocuri vechi au instalații depășite care trebuie înlocuite înainte de finisaje, iar renovările generează sistematic lucrări electrice.",
    siblingTrades: ["instalator", "hvac"],
  },
  "instalator": {
    slug: "instalator",
    word: "instalator",
    plural: "instalatori",
    h1Subject: "Instalator",
    nationalPath: "/pentru-specialisti/instalator",
    workTypes: [
      "Instalații sanitare complete în renovări de băi și bucătării",
      "Montaj și service centrale termice",
      "Repararea scurgerilor și a țevilor corodate",
      "Obiecte sanitare, baterii, sisteme de filtrare",
      "Avarii și intervenții urgente",
    ],
    demandNote: "Renovarea băilor și înlocuirea instalațiilor vechi sunt printre cele mai frecvente lucrări, iar avariile aduc cereri urgente pe tot parcursul anului.",
    siblingTrades: ["electrician", "hvac"],
  },
  "constructor": {
    slug: "constructor",
    word: "constructor",
    plural: "constructori",
    h1Subject: "Constructor",
    nationalPath: "/pentru-specialisti/constructor",
    workTypes: [
      "Renovări complete de apartamente și case",
      "Finisaje: gresie, faianță, parchet, zugrăveli, glet",
      "Recompartimentări (pereți nestructurali)",
      "Amenajări la cheie, coordonate cu proiectul de design",
      "Lucrări de reabilitare la imobile vechi și case",
    ],
    demandNote: "Cererile merg de la lucrări punctuale la renovări la cheie, multe venind cu un proiect de design deja făcut, deci specificații clare.",
    siblingTrades: ["montator-gresie-faianta", "tamplar"],
  },
  "montator-gresie-faianta": {
    slug: "montator-gresie-faianta",
    word: "montator de gresie și faianță",
    plural: "montatori de gresie și faianță",
    h1Subject: "Montator gresie-faianță",
    nationalPath: "/pentru-specialisti/montator-gresie-faianta",
    workTypes: [
      "Placare cu gresie și faianță în băi și bucătării",
      "Hidroizolații înainte de placare",
      "Șape și pregătirea suprafețelor",
      "Placări decorative și formate mari",
      "Reparații și înlocuiri punctuale",
    ],
    demandNote: "Renovarea băilor și a bucătăriilor e printre cele mai frecvente lucrări, iar o placare corectă cu hidroizolație bună e esențială.",
    siblingTrades: ["constructor", "zugrav"],
  },
  "tamplar": {
    slug: "tamplar",
    word: "tâmplar",
    plural: "tâmplari",
    h1Subject: "Tâmplar",
    nationalPath: "/pentru-specialisti/tamplar",
    workTypes: [
      "Mobilier de bucătărie pe comandă",
      "Dulapuri, dressinguri și biblioteci integrate",
      "Uși interioare și tâmplărie din lemn",
      "Mobilier pentru spații mici, croit pe dimensiuni",
      "Elemente de mobilier pentru proiecte de design",
    ],
    demandNote: "Multe cereri vin dintr-un proiect de design interior, cu dimensiuni exacte și materiale specificate, ceea ce face producția mai predictibilă.",
    siblingTrades: ["constructor", "finisaje-interioare"],
  },
  "hvac": {
    slug: "hvac",
    word: "specialist HVAC",
    plural: "specialiști HVAC",
    h1Subject: "Specialist HVAC",
    nationalPath: "/pentru-specialisti/hvac",
    workTypes: [
      "Montaj și service aer condiționat",
      "Sisteme de ventilație și recuperare de căldură",
      "Pompe de căldură pentru încălzire eficientă",
      "Întreținere periodică și igienizare",
      "Consultanță pentru soluții eficiente energetic",
    ],
    demandNote: "Verile tot mai calde și accentul pe eficiență energetică au făcut din climatizare și pompele de căldură investiții tot mai frecvente.",
    siblingTrades: ["instalator", "electrician"],
  },
};

export const SL_TRADE_SLUGS = Object.keys(SL_TRADES);
export const SL_LOC_SLUGS = Object.keys(SL_LOCALITIES);

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Compose a full page object for a (trade, locality) pair, or null if invalid.
export const getSpecialistLocal = (tradeSlug, locSlug) => {
  const trade = SL_TRADES[tradeSlug];
  const loc = SL_LOCALITIES[locSlug];
  if (!trade || !loc) return null;

  const path = `/devino-specialist/${trade.slug}/${loc.slug}`;
  const title = `Devino ${trade.word} în ${loc.city} | Găsește clienți prin PropManage`;
  const h1 = `${trade.h1Subject} în ${loc.city}? Găsește clienți prin PropManage`;
  const description = `Ești ${trade.word} în ${loc.city}? Înregistrează-te gratuit pe PropManage și primești cereri reale de la proprietari din ${loc.city}. Profil verificat, plată protejată prin escrow.`;
  const intro = `Ești ${trade.word} și lucrezi în ${loc.city}? Pe PropManage nu îți cauți clienții la rece — proprietarii din zonă postează cereri, iar tu primești lucrări relevante pentru meseria ta. ${trade.demandNote}`;

  // Internal links: national category -> pillar -> apply -> local hub -> sibling trades / localities -> marketplace hub (always indexable)
  const related = [];
  if (trade.nationalPath !== "/pentru-specialisti") {
    related.push({ to: trade.nationalPath, label: `${cap(trade.word)} pe PropManage (național)` });
  }
  related.push({ to: "/pentru-specialisti", label: "Toate meseriile pe PropManage" });
  related.push({ to: "/devino-specialist", label: "Înregistrează-te gratuit ca specialist" });
  related.push({ to: `/servicii-pentru-casa/${loc.slug}`, label: `Servicii pentru casă în ${loc.city}` });
  // sibling trades in same locality
  (trade.siblingTrades || []).forEach((st) => {
    const t = SL_TRADES[st];
    if (t) related.push({ to: `/devino-specialist/${t.slug}/${loc.slug}`, label: `${t.h1Subject} în ${loc.city}` });
  });
  // same trade in sibling localities
  SL_LOC_SLUGS.filter((l) => l !== loc.slug).slice(0, 2).forEach((l) => {
    related.push({ to: `/devino-specialist/${trade.slug}/${l}`, label: `${trade.h1Subject} în ${SL_LOCALITIES[l].city}` });
  });
  related.push({ to: "/marketplace", label: "Marketplace specialiști verificați" });

  const faq = [
    { q: `Cât costă să mă înregistrez ca ${trade.word} în ${loc.city}?`, a: "Înregistrarea este gratuită. Îți creezi profilul și începi să primești cereri fără costuri de start; plata lucrărilor e protejată prin escrow." },
    { q: `Ce fel de cereri primesc în ${loc.city}?`, a: `Cereri reale de la proprietari din ${loc.zone}. ${trade.demandNote}` },
    { q: "Cum îmi construiesc încrederea în fața proprietarilor?", a: "Prin profilul verificat, portofoliu și recenzii reale de la clienți. Un istoric bun te ajută să câștigi mai multe proiecte." },
    { q: "Cum sunt plătit?", a: "Prin escrow: banii sunt protejați și eliberați pe măsură ce etapele convenite ale lucrării sunt finalizate." },
  ];

  return { trade, loc, path, title, h1, description, intro, related, faq };
};

// All 32 recruitment paths (all INDEX — real content).
export const SPECIALIST_LOCAL_PATHS = SL_TRADE_SLUGS.flatMap((t) =>
  SL_LOC_SLUGS.map((l) => `/devino-specialist/${t}/${l}`)
);
