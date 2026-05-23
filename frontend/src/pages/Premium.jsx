// Interior Design Premium Service + Smart Match UI + Availability Toggle
import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { motion } from "framer-motion";
import { Sparkles, Lock, Coins, ArrowRight, Palette, MapPin, Clock, CheckCircle2, AlertTriangle, X, Star, Wind, Zap, Droplet } from "lucide-react";
import { formatApiError } from "../auth";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ============= INTERIOR DESIGN GATED CTA + MODAL =============
export const InteriorDesignCard = ({ user, onOpen }) => {
  const [eligibility, setEligibility] = useState(null);
  
  useEffect(() => {
    axios.get(`${API}/services/interior-design/eligibility`)
      .then(r => setEligibility(r.data)).catch(() => {});
  }, [user]);
  
  if (!eligibility) return null;
  
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      className="relative glass-strong rounded-3xl p-6 overflow-hidden" data-testid="interior-card">
      <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-purple-500 opacity-15 blur-3xl" />
      <div className="relative">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-purple-500/15 text-purple-300 border border-purple-500/30 rounded-full">PREMIUM</span>
          <span className="text-[10px] uppercase tracking-wider text-stone-500">Exclusiv</span>
        </div>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500/30 to-pink-500/20 border border-purple-500/30 flex items-center justify-center shrink-0">
            <Palette className="w-5 h-5 text-purple-300" />
          </div>
          <div>
            <h3 className="font-serif text-xl">Design Interior</h3>
            <p className="text-xs text-stone-400 mt-0.5">Reduce costul cu tokenurile tale</p>
          </div>
        </div>
        
        {eligibility.eligible ? (
          <>
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl px-3 py-2 text-xs text-emerald-300 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-3.5 h-3.5" />Eligibil · {eligibility.current_tokens} tokens disponibili
            </div>
            <button onClick={onOpen} className="w-full btn-accent py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2" data-testid="interior-open">
              <Sparkles className="w-4 h-4" />Solicită Design Interior
            </button>
          </>
        ) : (
          <>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 text-xs text-amber-300 mb-3 flex items-start gap-2">
              <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="font-medium mb-1">Disponibil doar pentru utilizatori premium</div>
                <ul className="space-y-0.5 opacity-90">
                  {eligibility.reasons.map((r, i) => <li key={i}>• {r}</li>)}
                </ul>
              </div>
            </div>
            <button disabled className="w-full bg-white/5 py-3 rounded-xl text-sm font-medium text-stone-500 flex items-center justify-center gap-2 cursor-not-allowed" data-testid="interior-locked">
              <Lock className="w-4 h-4" />Activează Digital Twin & Wallet
            </button>
          </>
        )}
        <div className="text-[10px] text-stone-500 mt-3 text-center">Folosește tokenurile pentru a reduce costul designului · Beneficiu exclusiv pentru utilizatorii premium</div>
      </div>
    </motion.div>
  );
};

export const InteriorDesignModal = ({ property, onClose, onCreated }) => {
  const [form, setForm] = useState({ rooms_to_design: ["living"], style: "Modern", budget_total: 1500 });
  const [tokensToApply, setTokensToApply] = useState(3000);
  const [calc, setCalc] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const recalc = async () => {
    if (form.budget_total <= 0) return;
    try {
      const { data } = await axios.post(`${API}/services/interior-design/calculate?budget_total=${form.budget_total}&tokens_to_apply=${tokensToApply}`);
      setCalc(data);
    } catch {}
  };
  useEffect(() => { recalc(); }, [form.budget_total, tokensToApply]);
  
  const submit = async () => {
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/services/interior-design/request`, {
        property_id: property.id, rooms_to_design: form.rooms_to_design,
        style: form.style, budget_total: form.budget_total, tokens_to_apply: tokensToApply,
      });
      onCreated?.(data);
      onClose();
    } catch (e) { alert(formatApiError(e)); }
    finally { setLoading(false); }
  };
  
  const toggleRoom = (room) => {
    setForm(f => ({
      ...f,
      rooms_to_design: f.rooms_to_design.includes(room) 
        ? f.rooms_to_design.filter(r => r !== room)
        : [...f.rooms_to_design, room]
    }));
  };
  
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6" onClick={onClose}>
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="glass-strong rounded-3xl p-6 sm:p-8 max-w-2xl w-full max-h-[90vh] overflow-auto no-scrollbar" onClick={e => e.stopPropagation()} data-testid="interior-modal">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center">
              <Palette className="w-4 h-4 text-purple-300" />
            </div>
            <div>
              <h2 className="font-serif text-2xl">Design Interior</h2>
              <div className="text-xs text-stone-400">Configurator premium</div>
            </div>
          </div>
          <button onClick={onClose} className="text-stone-400 hover:text-white"><X className="w-4 h-4" /></button>
        </div>
        
        <div className="space-y-5">
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-400 mb-2 block">Proprietate</label>
            <div className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm">{property?.name} · {property?.surface}m²</div>
          </div>
          
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-400 mb-2 block">Camere de proiectat</label>
            <div className="flex flex-wrap gap-2">
              {["living", "dormitor", "bucătărie", "baie", "hol"].map(r => (
                <button key={r} type="button" onClick={() => toggleRoom(r)}
                  className={`px-4 py-2 rounded-full text-xs capitalize ${form.rooms_to_design.includes(r) ? "bg-[#d4ff3a] text-black" : "bg-white/5 text-stone-300"}`}
                  data-testid={`room-${r}`}>
                  {r}
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-400 mb-2 block">Stil</label>
            <select value={form.style} onChange={e => setForm({...form, style: e.target.value})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm" data-testid="style-select">
              <option>Modern</option><option>Scandinav</option><option>Industrial</option>
              <option>Minimalist</option><option>Clasic</option><option>Boho</option>
            </select>
          </div>
          
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-400 mb-2 block">Buget total (€)</label>
            <input type="number" value={form.budget_total} onChange={e => setForm({...form, budget_total: parseFloat(e.target.value) || 0})}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm" data-testid="budget-input" />
          </div>
          
          <div>
            <label className="text-xs uppercase tracking-wider text-stone-400 mb-2 flex items-center gap-2 justify-between">
              <span>Aplică tokens</span>
              <span className="text-[#d4ff3a]">{tokensToApply.toLocaleString()} tokens</span>
            </label>
            <input type="range" min={0} max={calc?.tokens_available || 5000} step={100} value={tokensToApply}
              onChange={e => setTokensToApply(parseInt(e.target.value))}
              className="w-full accent-[#d4ff3a]" data-testid="tokens-slider" />
            <div className="flex justify-between text-[10px] text-stone-500 mt-1">
              <span>0</span><span>{(calc?.tokens_available || 0).toLocaleString()}</span>
            </div>
          </div>
          
          {/* Cost breakdown */}
          {calc && (
            <div className="glass rounded-2xl p-5 space-y-2.5" data-testid="cost-breakdown">
              <div className="flex justify-between text-sm">
                <span className="text-stone-400">Cost total</span>
                <span className="font-medium">{calc.budget_total.toFixed(2)} €</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-400">Discount tokens ({calc.discount_pct}%)</span>
                <span className="text-[#d4ff3a]">-{calc.discount_applied.toFixed(2)} €</span>
              </div>
              <div className="h-px bg-white/10 my-2" />
              <div className="flex justify-between text-lg">
                <span className="font-medium">De plătit</span>
                <span className="font-serif font-medium text-emerald-400">{calc.final_payable.toFixed(2)} €</span>
              </div>
              <div className="text-[10px] text-stone-500 pt-2">Tokens acoperă între {calc.min_discount_pct}%-{calc.max_discount_pct}% din cost. Restul se plătește din wallet.</div>
            </div>
          )}
          
          <button onClick={submit} disabled={loading || !calc} className="w-full btn-accent py-3 rounded-xl text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2" data-testid="interior-submit">
            <Sparkles className="w-4 h-4" />{loading ? "..." : `Confirmă · Plătește ${calc?.final_payable.toFixed(2) || 0}€`}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ============= SPECIALIST AVAILABILITY TOGGLE =============
export const AvailabilityToggle = ({ user, onChange }) => {
  const [status, setStatus] = useState(user?.availability_status || "available");
  const [loading, setLoading] = useState(false);
  
  const update = async (newStatus) => {
    setLoading(true);
    try {
      await axios.put(`${API}/specialists/me/availability`, { status: newStatus });
      setStatus(newStatus);
      onChange?.(newStatus);
    } catch (e) { alert(formatApiError(e)); }
    finally { setLoading(false); }
  };
  
  const config = {
    available: { color: "emerald", label: "Disponibil", dot: "bg-emerald-400" },
    busy: { color: "amber", label: "Ocupat", dot: "bg-amber-400" },
    offline: { color: "stone", label: "Offline", dot: "bg-stone-500" },
  };
  
  return (
    <div className="glass-strong rounded-2xl p-4" data-testid="availability-toggle">
      <div className="text-xs uppercase tracking-wider text-stone-400 mb-3">Status disponibilitate</div>
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(config).map(([key, c]) => (
          <button key={key} onClick={() => update(key)} disabled={loading || status === key}
            className={`py-2.5 rounded-xl text-xs font-medium flex items-center justify-center gap-2 transition ${
              status === key ? `bg-${c.color}-500/15 border border-${c.color}-500/40 text-${c.color}-300` : "bg-white/5 text-stone-400 hover:bg-white/10"
            }`}
            data-testid={`avail-${key}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${c.dot} ${status === key ? "pulse-dot" : ""}`} />
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
};

// ============= SMART MATCH PREVIEW =============
const catIcon = (cat) => {
  switch (cat) {
    case "hvac": return Wind;
    case "electric": return Zap;
    case "plumbing": return Droplet;
    default: return Sparkles;
  }
};

export const SmartMatchPreview = ({ category, zone }) => {
  const [data, setData] = useState(null);
  
  useEffect(() => {
    if (!category) return;
    const params = new URLSearchParams({ category });
    if (zone) params.set("zone", zone);
    axios.get(`${API}/match?${params}`)
      .then(r => setData(r.data)).catch(() => setData({ matches: [], total: 0 }));
  }, [category, zone]);
  
  if (!data) return null;
  const Icon = catIcon(category);
  
  return (
    <div className="glass rounded-2xl p-4" data-testid="match-preview">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#d4ff3a]" />
          <span className="text-xs uppercase tracking-wider">Smart Match</span>
        </div>
        <div className="text-[10px] text-stone-500 flex items-center gap-1">
          <MapPin className="w-3 h-3" />{data.zone}
        </div>
      </div>
      
      {data.matches.length === 0 ? (
        <div className="text-xs text-stone-500 text-center py-4 flex items-center justify-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          Niciun specialist potrivit. Vom extinde căutarea automat.
        </div>
      ) : (
        <>
          <div className="text-[10px] text-stone-500 mb-2">
            {data.in_zone_count} în zonă · {data.total - data.in_zone_count} din zone apropiate
          </div>
          <div className="space-y-2">
            {data.matches.slice(0, 3).map(m => (
              <div key={m.id} className="bg-white/5 rounded-xl p-3" data-testid={`match-${m.id}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm truncate">{m.name}</span>
                    {m.verified && <CheckCircle2 className="w-3 h-3 text-[#d4ff3a] shrink-0" />}
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-stone-400 shrink-0">
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />{m.rating}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mb-1">
                  {m.match_reasons.map((r, i) => (
                    <span key={i} className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                      r.includes("zonă") || r.includes("Zonă") ? "bg-amber-500/15 text-amber-300" : "bg-emerald-500/15 text-emerald-300"
                    }`}>{r}</span>
                  ))}
                </div>
                {m.lead_fee > 0 && <div className="text-[10px] text-amber-400">Lead fee: {m.lead_fee} RON (fallback zone)</div>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
