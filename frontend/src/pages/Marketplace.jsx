// Public Marketplace + 2FA Setup + Property Timeline
import React, { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { Building2, Star, CheckCircle2, Search, Filter, ArrowLeft, Shield, QrCode, Copy, Check, Calendar, Wrench, AlertTriangle, CreditCard } from "lucide-react";
import { useAuth, formatApiError } from "../auth";
import { HealthScoreBadge } from "../components/HealthScoreBadge";
import { useSEO } from "../hooks/useSEO";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ============= PUBLIC MARKETPLACE =============
export const PublicMarketplace = () => {
  const [specialists, setSpecialists] = useState([]);
  const [filters, setFilters] = useState({ category: "", verified_only: false, sort: "rating" });
  const [loading, setLoading] = useState(true);

  useSEO({
    title: filters.category
      ? `Specialiști ${filters.category} verificați · Marketplace PropManage`
      : "Marketplace specialiști verificați · PropManage",
    description: filters.category
      ? `Găsește cei mai buni specialiști ${filters.category} verificați pentru proprietatea ta. Recenzii reale, plăți escrow, garanție lucrare.`
      : "Descoperă peste 100 de specialiști verificați (instalatori, electricieni, designeri, zugravi) pentru proprietatea ta. Plăți escrow, recenzii reale, garanție lucrare.",
    canonical: filters.category
      ? `https://propmanage.ro/marketplace?category=${encodeURIComponent(filters.category)}`
      : "https://propmanage.ro/marketplace",
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      "name": "Marketplace Specialiști PropManage",
      "url": "https://propmanage.ro/marketplace",
      "description": "Listă de specialiști verificați pentru proprietăți rezidențiale în România.",
      "isPartOf": { "@type": "WebSite", "name": "PropManage", "url": "https://propmanage.ro" },
      "breadcrumb": {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "Acasă", "item": "https://propmanage.ro/" },
          { "@type": "ListItem", "position": 2, "name": "Marketplace", "item": "https://propmanage.ro/marketplace" },
        ],
      },
    },
  });

  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.category) params.set("category", filters.category);
    if (filters.verified_only) params.set("verified_only", "true");
    params.set("sort", filters.sort);
    setLoading(true);
    axios.get(`${API}/marketplace/specialists?${params}`)
      .then(r => setSpecialists(r.data))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-stone-100">
      <header className="border-b border-white/5 sticky top-0 z-30 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#d4ff3a] to-[#a8e028] flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
            </div>
            <span className="font-serif text-lg font-semibold">PropManage</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link to="/ghiduri" className="text-xs text-stone-400 hover:text-white hidden sm:inline">Ghiduri</Link>
            <Link to="/login" className="text-xs text-stone-400 hover:text-white">Conectare</Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <h1 className="font-serif text-4xl sm:text-6xl tracking-tight mb-3" data-testid="mkt-title">Marketplace specialiști</h1>
        <p className="text-stone-400 mb-8">Descoperă cei mai buni profesioniști verificați pentru proprietatea ta.</p>

        {/* Filters */}
        <div className="glass-strong rounded-2xl p-4 sm:p-5 mb-6 flex flex-wrap gap-3 items-center">
          <select value={filters.category} onChange={e => setFilters({...filters, category: e.target.value})} 
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm" data-testid="mkt-cat">
            <option value="">Toate categoriile</option>
            <option value="hvac">HVAC</option>
            <option value="electric">Electric</option>
            <option value="plumbing">Sanitar</option>
            <option value="other">Altele</option>
          </select>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input type="checkbox" checked={filters.verified_only} onChange={e => setFilters({...filters, verified_only: e.target.checked})} className="rounded" data-testid="mkt-verified" />
            <span>Doar verificați</span>
          </label>
          <select value={filters.sort} onChange={e => setFilters({...filters, sort: e.target.value})}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm ml-auto" data-testid="mkt-sort">
            <option value="rating">Cele mai bune ratinguri</option>
            <option value="reviews">Cele mai multe recenzii</option>
            <option value="recent">Cei mai noi</option>
          </select>
        </div>

        <div className="text-xs text-stone-500 mb-4">{loading ? "Se încarcă..." : `${specialists.length} specialiști`}</div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {specialists.map((s, i) => (
            <motion.div key={s.id} 
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="glass-strong rounded-2xl p-5 hover:bg-white/[0.06] transition" data-testid={`mkt-card-${s.id}`}>
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-stone-600 to-stone-800 flex items-center justify-center font-medium shrink-0">
                  {s.name?.[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <div className="font-medium truncate">{s.name}</div>
                    {s.verified && <CheckCircle2 className="w-3.5 h-3.5 text-[#d4ff3a] shrink-0" />}
                  </div>
                  <div className="text-[11px] text-stone-400 capitalize">{s.specialty || "Specialist"}</div>
                </div>
              </div>
              <div className="flex items-center gap-3 text-xs mb-2">
                <div className="flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  <span>{s.rating || "—"}</span>
                  <span className="text-stone-500">({s.reviews_count})</span>
                </div>
                {s.tier && <span className="text-[9px] bg-[#d4ff3a]/15 text-[#d4ff3a] px-2 py-0.5 rounded-full uppercase tracking-wider">{s.tier}</span>}
              </div>
              <div className="mb-4">
                <HealthScoreBadge health={s.health} size="sm" />
              </div>
              <Link to={`/specialists/${s.id}`} className="w-full text-center bg-white/5 hover:bg-white/10 py-2 rounded-xl text-xs font-medium block" data-testid={`mkt-view-${s.id}`}>
                Vezi profil
              </Link>
            </motion.div>
          ))}
        </div>

        {/* SEO internal-link block — surfaces all category/city landing pages */}
        <section className="mt-16 pt-10 border-t border-white/5" data-testid="mkt-seo-links">
          <h2 className="font-serif text-2xl mb-4">Caută după categorie și oraș</h2>
          <p className="text-stone-400 text-sm mb-6 max-w-2xl">
            Vezi specialiști verificați filtrați pe specialitate și oraș — pagini dedicate cu profile, recenzii și prețuri.
          </p>
          <div className="space-y-5">
            {[
              { cat: "electrician",            plural: "Electricieni" },
              { cat: "instalator",             plural: "Instalatori" },
              { cat: "hvac",                   plural: "Specialiști HVAC" },
              { cat: "design-interior",        plural: "Designeri interior" },
              { cat: "tamplar",                plural: "Tâmplari" },
              { cat: "zugrav",                 plural: "Zugravi" },
              { cat: "firma-curatenie",        plural: "Firme de curățenie" },
              { cat: "service-electrocasnice", plural: "Service electrocasnice" },
              { cat: "gradinar",               plural: "Grădinari" },
            ].map(({ cat, plural }) => (
              <div key={cat}>
                <Link to={`/marketplace/${cat}`} className="text-sm font-medium text-[#d4ff3a] hover:underline">
                  {plural} →
                </Link>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {[
                    ["bucuresti", "București"], ["cluj-napoca", "Cluj-Napoca"],
                    ["timisoara", "Timișoara"], ["iasi", "Iași"],
                    ["brasov", "Brașov"], ["constanta", "Constanța"],
                    ["sibiu", "Sibiu"], ["oradea", "Oradea"], ["craiova", "Craiova"], ["ploiesti", "Ploiești"],
                  ].map(([slug, name]) => (
                    <Link
                      key={slug}
                      to={`/marketplace/${cat}-${slug}`}
                      className="text-[11px] text-stone-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-full px-2.5 py-1 transition"
                    >
                      {name}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

// ============= 2FA SETUP MODAL =============
export const TwoFASetupModal = ({ onClose, currentlyEnabled }) => {
  const [step, setStep] = useState("intro"); // intro | setup | verify | disable
  const [qrData, setQrData] = useState(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const beginSetup = async () => {
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/auth/2fa/setup`);
      setQrData(data);
      setStep("setup");
    } catch (e) { alert(formatApiError(e)); }
    finally { setLoading(false); }
  };

  const verify = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/auth/2fa/verify`, { code });
      setStep("done");
    } catch (e) { alert(formatApiError(e)); }
    finally { setLoading(false); }
  };

  const disable = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/auth/2fa/disable`, { code });
      alert("2FA dezactivat");
      onClose(true);
    } catch (e) { alert(formatApiError(e)); }
    finally { setLoading(false); }
  };

  const copySecret = () => {
    navigator.clipboard.writeText(qrData.secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6" onClick={() => onClose(false)}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-strong rounded-3xl p-6 sm:p-8 max-w-md w-full max-h-[90vh] overflow-auto no-scrollbar" onClick={e => e.stopPropagation()} data-testid="2fa-modal">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-[#d4ff3a]/15 flex items-center justify-center">
            <Shield className="w-4 h-4 text-[#d4ff3a]" />
          </div>
          <h2 className="font-serif text-2xl">Autentificare în 2 pași</h2>
        </div>

        {step === "intro" && !currentlyEnabled && (
          <>
            <p className="text-sm text-stone-400 mb-6">Adaugă un strat suplimentar de securitate contului tău. Vei avea nevoie de o aplicație authenticator (Google Authenticator, Authy, 1Password).</p>
            <button onClick={beginSetup} disabled={loading} className="w-full btn-accent py-3 rounded-xl text-sm font-medium" data-testid="2fa-start">
              {loading ? "..." : "Activează 2FA"}
            </button>
          </>
        )}

        {currentlyEnabled && step === "intro" && (
          <>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-4 py-3 mb-4 text-sm text-emerald-300">
              ✓ 2FA este activ pe contul tău
            </div>
            <p className="text-sm text-stone-400 mb-4">Pentru a dezactiva 2FA, introdu codul curent din aplicația authenticator:</p>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="123456" maxLength={6}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center text-2xl tracking-widest font-mono mb-4"
              data-testid="2fa-disable-code" />
            <button onClick={disable} disabled={loading || code.length !== 6} className="w-full bg-red-500/20 border border-red-500/40 text-red-300 py-3 rounded-xl text-sm font-medium disabled:opacity-50" data-testid="2fa-disable-btn">
              {loading ? "..." : "Dezactivează 2FA"}
            </button>
          </>
        )}

        {step === "setup" && qrData && (
          <>
            <p className="text-sm text-stone-400 mb-4">1. Scanează codul QR cu aplicația ta authenticator:</p>
            <div className="bg-white rounded-2xl p-4 flex items-center justify-center mb-4">
              <img src={qrData.qr_code} alt="QR" className="w-48 h-48" data-testid="2fa-qr" />
            </div>
            <p className="text-sm text-stone-400 mb-2">Sau introdu manual codul:</p>
            <div className="flex gap-2 mb-4">
              <input value={qrData.secret} readOnly className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs font-mono" />
              <button onClick={copySecret} className="px-3 bg-white/10 rounded-xl flex items-center gap-1 text-xs" data-testid="2fa-copy">
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                {copied ? "Copiat!" : "Copy"}
              </button>
            </div>
            <p className="text-sm text-stone-400 mb-2">2. Introdu codul afișat în aplicație:</p>
            <input value={code} onChange={e => setCode(e.target.value)} placeholder="123456" maxLength={6}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center text-2xl tracking-widest font-mono mb-4"
              data-testid="2fa-code" />
            <button onClick={verify} disabled={loading || code.length !== 6} className="w-full btn-accent py-3 rounded-xl text-sm font-medium disabled:opacity-50" data-testid="2fa-verify">
              {loading ? "..." : "Verifică și activează"}
            </button>
          </>
        )}

        {step === "done" && (
          <div className="text-center py-6">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h3 className="font-serif text-2xl mb-2">2FA activat!</h3>
            <p className="text-sm text-stone-400 mb-6">Contul tău este acum mult mai sigur.</p>
            <button onClick={() => onClose(true)} className="w-full btn-accent py-3 rounded-xl text-sm font-medium" data-testid="2fa-done">Gata</button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

// ============= PROPERTY TIMELINE =============
const eventIcon = (type) => {
  switch (type) {
    case "request_created": return AlertTriangle;
    case "specialist_assigned": return Wrench;
    case "work_completed": return CheckCircle2;
    case "confirmed": return CreditCard;
    default: return Calendar;
  }
};
const eventColor = (type) => {
  switch (type) {
    case "request_created": return "amber";
    case "specialist_assigned": return "blue";
    case "work_completed": return "purple";
    case "confirmed": return "emerald";
    default: return "stone";
  }
};

export const PropertyTimelineModal = ({ propertyId, onClose }) => {
  const [data, setData] = useState(null);

  useEffect(() => {
    axios.get(`${API}/properties/${propertyId}/timeline`)
      .then(r => setData(r.data))
      .catch(() => setData({ events: [], property: null }));
  }, [propertyId]);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-strong rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-auto no-scrollbar" onClick={e => e.stopPropagation()} data-testid="timeline-modal">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-xs uppercase tracking-wider text-stone-400 mb-1">Timeline proprietate</div>
            <h2 className="font-serif text-2xl">{data?.property?.name || "Se încarcă..."}</h2>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white text-xl">×</button>
        </div>

        {!data && <div className="text-center py-8 text-stone-500">Se încarcă...</div>}
        {data && data.events.length === 0 && <div className="text-center py-12 text-stone-500 text-sm">Nicio activitate înregistrată încă</div>}

        <div className="relative pl-8">
          {/* Vertical line */}
          {data && data.events.length > 0 && <div className="absolute left-3 top-3 bottom-3 w-px bg-white/10" />}
          
          {data?.events.map((e, i) => {
            const Icon = eventIcon(e.type);
            const color = eventColor(e.type);
            return (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="relative mb-6" data-testid={`timeline-event-${i}`}>
                <div className={`absolute -left-8 top-0 w-6 h-6 rounded-full bg-${color}-500/20 border-2 border-${color}-500/40 flex items-center justify-center`}>
                  <Icon className={`w-3 h-3 text-${color}-400`} />
                </div>
                <div className="bg-white/5 rounded-xl p-4">
                  <div className="font-medium text-sm">{e.title}</div>
                  <div className="text-xs text-stone-400 mt-0.5">{e.description}</div>
                  <div className="text-[10px] text-stone-500 mt-2">
                    {new Date(e.timestamp).toLocaleString("ro-RO", { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};
