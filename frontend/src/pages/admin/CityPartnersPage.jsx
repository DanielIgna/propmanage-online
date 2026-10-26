// City Partners — Admin list + detail + create modal.
// Route: /admin/city-partners
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate } from "react-router-dom";
import {
  Building2, Plus, Users, MapPin, TrendingUp, Loader2, ChevronLeft, X,
  Save, Edit3, Eye, KeyRound, Mail, Phone, AlertTriangle, Trash2,
  Layers, ChevronDown, Link2,
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const ax = axios.create({ baseURL: API, withCredentials: true });

const STATUS_META = {
  prospect: { label: "Prospect / Necontactat", color: "bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300" },
  contacted: { label: "Contactat", color: "bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300" },
  discussion: { label: "Discuție inițiată", color: "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300" },
  negotiation: { label: "Negociere", color: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  agreed: { label: "Partener agreat", color: "bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300" },
  active: { label: "Activ", color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  paused: { label: "Pauzat", color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  rejected: { label: "Respins", color: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
  lead: { label: "Lead", color: "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300" },
  onboarding: { label: "Onboarding", color: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  terminated: { label: "Încetat", color: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" },
};

const STATUS_OPTIONS = [
  "prospect", "contacted", "discussion", "negotiation", "agreed", "active", "paused", "rejected",
  "lead", "onboarding", "terminated",
];

const NZEB_CATEGORIES = [
  "Ventilație și recuperare de căldură",
  "Audit și consultanță energetică",
  "Tâmplărie și anvelopa clădirii",
  "Izolații și renovări",
  "HVAC și instalații",
  "Pompe de căldură",
  "Fotovoltaice și stocare",
  "Alte soluții pentru eficiență energetică",
];

const PartnerForm = ({ initial, onSave, onClose, saving }) => {
  const [f, setF] = useState(() => ({
    company: initial?.company || "",
    contact_name: initial?.contact_name || "",
    contact_role: initial?.contact_role || "",
    contact_email: initial?.contact_email || "",
    contact_phone: initial?.contact_phone || "",
    website: initial?.website || "",
    country: initial?.country || "",
    city: initial?.city || "",
    county: initial?.county || "",
    units_managed: initial?.units_managed || 0,
    growth_rate: initial?.growth_rate || "",
    portfolio_type: initial?.portfolio_type || "",
    capacity_note: initial?.capacity_note || "",
    target_client_type: initial?.target_client_type || "",
    started_at: initial?.started_at?.slice(0, 10) || "",
    status: initial?.status || "prospect",
    partner_type: initial?.partner_type || "supplier",
    coverage: initial?.coverage || "regional",
    categories: (initial?.categories || []).join(", "),
    zones: (initial?.zones || []).join(", "),
    services: (initial?.services || []).join(", "),
    applications: (initial?.applications || []).join(", "),
    next_action: initial?.next_action || "",
    info_source: initial?.info_source || "",
    collaboration_agreed: !!initial?.collaboration_agreed,
    origin_confirmed: !!initial?.origin_confirmed,
    coverage_confirmed: !!initial?.coverage_confirmed,
    notes: initial?.notes || "",
  }));
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const toArr = (s) => (s || "").split(",").map(x => x.trim()).filter(Boolean);
  const submit = (e) => {
    e.preventDefault();
    const payload = {
      ...f,
      units_managed: Number(f.units_managed) || 0,
      categories: toArr(f.categories),
      zones: toArr(f.zones),
      services: toArr(f.services),
      applications: toArr(f.applications),
    };
    // Optional email: never send an empty string (fails EmailStr validation).
    if (!payload.contact_email) delete payload.contact_email;
    onSave(payload);
  };
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" data-testid="partner-form-modal">
      <form onSubmit={submit}
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{initial ? "Editează profil" : "Adaugă furnizor / prospect"}</h2>
          <button type="button" onClick={onClose} className="text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto">
          {[
            ["Companie *", "company", "text", true],
            ["Website", "website", "text", false, "ex: fresh-r.com"],
            ["Persoană contact", "contact_name", "text", false],
            ["Funcție", "contact_role", "text", false, "ex: Business Development"],
            ["Email contact", "contact_email", "email", false],
            ["Telefon", "contact_phone", "tel", false, "ex: +31 85 226 15 20"],
            ["Țară (origine)", "country", "text", false, "ex: Olanda"],
            ["Oraș / Localitate", "city", "text", false],
            ["Județ / Regiune", "county", "text", false],
            ["Apartamente administrate", "units_managed", "number", false],
            ["Ritm creștere", "growth_rate", "text", false, "ex: +8%/lună"],
            ["Tip portofoliu", "portfolio_type", "text", false, "ex: Condominii rezidențiale"],
            ["Capacitate", "capacity_note", "text", false, "ex: producție proprie"],
            ["Tip client vizat", "target_client_type", "text", false, "ex: rezidențial, administratori"],
            ["Început colaborare", "started_at", "date", false],
          ].map(([lbl, key, type, req, ph]) => (
            <div key={key}>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">{lbl}</label>
              <input type={type} required={req} placeholder={ph || ""} value={f[key]} onChange={e => set(key, e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm"
                data-testid={`partner-field-${key}`} />
            </div>
          ))}
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Status comercial</label>
            <select value={f.status} onChange={e => set("status", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="partner-field-status">
              {STATUS_OPTIONS.map(k => <option key={k} value={k}>{STATUS_META[k]?.label || k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Tip partener</label>
            <select value={f.partner_type} onChange={e => set("partner_type", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="partner-field-partner_type">
              {["studio", "city", "regional", "national", "supplier", "brand", "specialist"].map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Acoperire</label>
            <select value={f.coverage} onChange={e => set("coverage", e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="partner-field-coverage">
              {["city", "regional", "national"].map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Categorii City nZEB <span className="text-slate-400 font-normal">(virgulă, opțional)</span></label>
            <input list="nzeb-cats" value={f.categories} onChange={e => set("categories", e.target.value)} placeholder="ex: Ventilație și recuperare de căldură"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="partner-field-categories" />
            <datalist id="nzeb-cats">{NZEB_CATEGORIES.map(c => <option key={c} value={c} />)}</datalist>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Zonă comercială / teritoriu <span className="text-slate-400 font-normal">(virgulă, opțional)</span></label>
            <input value={f.zones} onChange={e => set("zones", e.target.value)} placeholder="ex: București, Ilfov, Cluj"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="partner-field-zones" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Servicii <span className="text-slate-400 font-normal">(virgulă, opțional)</span></label>
            <input value={f.services} onChange={e => set("services", e.target.value)} placeholder="ex: Audit energetic, Consultanță, Montaj"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="partner-field-services" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Aplicații prezentate <span className="text-slate-400 font-normal">(virgulă, opțional)</span></label>
            <input value={f.applications} onChange={e => set("applications", e.target.value)} placeholder="ex: renovare, modernizare, construcții noi"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="partner-field-applications" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Următoarea acțiune</label>
            <input value={f.next_action} onChange={e => set("next_action", e.target.value)} placeholder="ex: trimite prezentare rețea"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="partner-field-next_action" />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Sursa informației</label>
            <input value={f.info_source} onChange={e => set("info_source", e.target.value)} placeholder="ex: site oficial, târg, recomandare"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="partner-field-info_source" />
          </div>
          <div className="sm:col-span-2 flex flex-wrap gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={f.collaboration_agreed} onChange={e => set("collaboration_agreed", e.target.checked)} data-testid="partner-field-collaboration_agreed" />
              Colaborare agreată
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={f.origin_confirmed} onChange={e => set("origin_confirmed", e.target.checked)} data-testid="partner-field-origin_confirmed" />
              Origine confirmată
            </label>
            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={f.coverage_confirmed} onChange={e => set("coverage_confirmed", e.target.checked)} data-testid="partner-field-coverage_confirmed" />
              Acoperire comercială confirmată
            </label>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Note interne</label>
            <textarea value={f.notes} onChange={e => set("notes", e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="partner-field-notes" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800">Anulează</button>
          <button type="submit" disabled={saving} className="px-4 py-1.5 text-sm font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 flex items-center gap-1.5" data-testid="partner-save">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{initial ? "Salvează" : "Adaugă"}
          </button>
        </div>
      </form>
    </div>
  );
};

// Read-only: client House Health zones ↔ active City Partners that cover them (derived, additive).
const CoveragePanel = () => {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = async () => {
    if (data) return;
    setLoading(true); setErr("");
    try {
      const { data: d } = await ax.get("/api/admin/city-partners/coverage-overview", { params: { county: "Cluj" } });
      setData(d);
    } catch (e) { setErr(e.response?.data?.detail || e.message); }
    finally { setLoading(false); }
  };

  const toggle = () => { const n = !open; setOpen(n); if (n) load(); };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 mb-4 overflow-hidden" data-testid="coverage-panel">
      <button onClick={toggle} className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50" data-testid="coverage-panel-toggle">
        <Layers className="w-4 h-4 text-cyan-500" />
        <span className="text-sm font-semibold text-slate-900 dark:text-white">Acoperire zone client (Cluj)</span>
        <span className="text-[11px] text-slate-500">— parteneri activi corelați cu zonele din profilul clientului</span>
        <div className="flex-1" />
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="border-t border-slate-100 dark:border-slate-800 p-4">
          {loading && <div className="py-6 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-slate-400" /></div>}
          {err && <div className="text-rose-500 text-xs flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> {err}</div>}
          {data && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {(data.zones || []).map(z => (
                <div key={z.zone} className="rounded-xl border border-slate-200 dark:border-slate-800 p-3" data-testid={`coverage-zone-${z.zone}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium text-slate-900 dark:text-white">{z.label}</span>
                    <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${z.partner_count > 0 ? "bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-500"}`} data-testid={`coverage-count-${z.zone}`}>
                      {z.partner_count} parteneri
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mb-2">{(z.nzeb_categories || []).join(" · ")}</div>
                  {z.partner_count === 0
                    ? <div className="text-[11px] text-amber-600 dark:text-amber-500">Nicio acoperire activă — recomandă recrutarea unui partener nZEB pentru această zonă.</div>
                    : <div className="space-y-1">
                        {(z.partners || []).map(p => (
                          <div key={p.partner_id} className="flex items-center gap-1.5 text-[12px] text-slate-700 dark:text-slate-300">
                            <Building2 className="w-3 h-3 text-slate-400" />
                            <span>{p.company}</span>
                            {p.referral_url && <span className="inline-flex items-center gap-0.5 text-cyan-600 dark:text-cyan-400"><Link2 className="w-3 h-3" /> link</span>}
                          </div>
                        ))}
                      </div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CityPartnersPage = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterCountry, setFilterCountry] = useState("");
  const [filterZone, setFilterZone] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (filterStatus !== "all") params.status = filterStatus;
      if (filterCategory) params.category = filterCategory;
      if (filterCountry.trim()) params.country = filterCountry.trim();
      if (filterZone.trim()) params.zone = filterZone.trim();
      const [a, b] = await Promise.all([
        ax.get("/api/admin/city-partners", { params }),
        ax.get("/api/admin/city-partners/stats"),
      ]);
      setItems(a.data?.items || []);
      setStats(b.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [filterStatus, filterCategory, filterCountry, filterZone]);

  const save = async (payload) => {
    setSaving(true);
    try {
      if (editing) {
        const { data } = await ax.patch(`/api/admin/city-partners/${editing.id}`, payload);
        setItems(arr => arr.map(x => x.id === data.id ? data : x));
      } else {
        const { data } = await ax.post("/api/admin/city-partners", payload);
        setItems(arr => [data, ...arr]);
      }
      setFormOpen(false); setEditing(null);
    } catch (e) { alert(e.response?.data?.detail || e.message); }
    finally { setSaving(false); }
  };

  const archive = async (p) => {
    if (!window.confirm(`Marchează ${p.company} ca încetat?`)) return;
    try {
      await ax.delete(`/api/admin/city-partners/${p.id}`);
      setItems(arr => arr.map(x => x.id === p.id ? { ...x, status: "terminated" } : x));
    } catch (e) { alert(e.response?.data?.detail || e.message); }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 p-4 lg:p-8" data-testid="city-partners-page">
      <div className="mb-6 flex items-center gap-3">
        <Link to="/admin" className="text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center gap-1 text-sm"><ChevronLeft className="w-4 h-4" /> Admin</Link>
        <span className="text-slate-300">·</span>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-cyan-500" />
          <h1 className="text-xl lg:text-2xl font-bold text-slate-900 dark:text-white">Strategic City Partnership</h1>
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-400">V1 · Pilot</span>
        </div>
      </div>

      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard icon={Users} label="Profiluri total" value={stats.total_partners} color="text-blue-500" />
          <StatCard icon={MapPin} label="Prospecte" value={["prospect", "contacted", "discussion", "negotiation", "agreed"].reduce((s, k) => s + (stats.by_status?.[k] || 0), 0)} color="text-amber-500" />
          <StatCard icon={TrendingUp} label="Activi" value={stats.by_status?.active || 0} color="text-emerald-500" />
          <StatCard icon={Building2} label="Lead-uri / Conversii" value={`${stats.total_leads} / ${stats.leads_by_stage?.converted || 0}`} color="text-violet-500" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 flex-wrap">
          {[["all", "Toți"], ["prospects", "Prospecte"], ["prospect", "Necontactat"], ["contacted", "Contactat"], ["discussion", "Discuție"], ["negotiation", "Negociere"], ["agreed", "Agreat"], ["active", "Activ"], ["paused", "Pauzat"], ["rejected", "Respins"]].map(([k, lbl]) => (
            <button key={k} onClick={() => setFilterStatus(k)} className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${filterStatus === k ? "bg-blue-600 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"}`} data-testid={`filter-${k}`}>
              {lbl}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button onClick={() => { setEditing(null); setFormOpen(true); }} className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5" data-testid="add-partner">
          <Plus className="w-3.5 h-3.5" /> Adaugă furnizor
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200" data-testid="filter-category">
          <option value="">Toate categoriile nZEB</option>
          {NZEB_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input value={filterCountry} onChange={e => setFilterCountry(e.target.value)} placeholder="Filtru origine (țară)" className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 w-44" data-testid="filter-country" />
        <input value={filterZone} onChange={e => setFilterZone(e.target.value)} placeholder="Filtru teritoriu comercial" className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 w-48" data-testid="filter-zone" />
        {(filterCategory || filterCountry || filterZone) && (
          <button onClick={() => { setFilterCategory(""); setFilterCountry(""); setFilterZone(""); }} className="px-2.5 py-1.5 text-xs rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" data-testid="filter-clear">Resetează</button>
        )}
      </div>

      <CoveragePanel />

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading && <div className="p-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-slate-400" /></div>}
        {error && <div className="p-6 text-rose-500 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {error}</div>}
        {!loading && items.length === 0 && !error && <div className="p-10 text-center text-sm text-slate-500">Niciun furnizor. Apasă „Adaugă furnizor” pentru a începe.</div>}
        {!loading && items.length > 0 && (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {items.map(p => {
              const st = STATUS_META[p.status] || STATUS_META.lead;
              return (
                <div key={p.id} className="p-4 flex flex-wrap items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-800/50" data-testid={`partner-row-${p.id}`}>
                  <div className="flex-1 min-w-[220px]">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{p.company}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${st.color}`}>{st.label}</span>
                      {!p.public_visible && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 dark:bg-slate-700/40 dark:text-slate-400" title="Nu este afișat public ca partener activ">nepublic</span>}
                      {p.website && <a href={p.website.startsWith("http") ? p.website : `https://${p.website}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] text-blue-500 hover:underline" data-testid={`website-${p.id}`}>{p.website}</a>}
                      <span className="text-[10px] text-slate-400">{[p.city, p.county].filter(Boolean).join(", ") || "—"}</span>
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-3 flex-wrap">
                      {p.contact_name && <span className="flex items-center gap-1"><Users className="w-3 h-3" />{p.contact_name}{p.contact_role ? ` · ${p.contact_role}` : ""}</span>}
                      {p.contact_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{p.contact_email}</span>}
                      {p.contact_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{p.contact_phone}</span>}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
                      {p.country
                        ? <span>Origine: {p.country}{!p.origin_confirmed && <em className="text-amber-500 not-italic"> (neconfirmat)</em>}</span>
                        : <span className="text-amber-500">origine neconfirmată</span>}
                      {p.categories?.length > 0 && <span className="text-cyan-600 dark:text-cyan-400">{p.categories.join(" · ")}</span>}
                      {!p.coverage_confirmed && (p.status === "prospect" || p.status === "contacted") && <span className="text-amber-500">acoperire neconfirmată</span>}
                    </div>
                  </div>
                  <div className="text-center text-xs">
                    <div className="text-slate-900 dark:text-white font-bold">{p.onboarding_step}/7</div>
                    <div className="text-[10px] text-slate-400">onboarding</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => navigate(`/admin/city-partners/${p.id}`)} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Detalii" data-testid={`view-${p.id}`}><Eye className="w-4 h-4" /></button>
                    <button onClick={() => { setEditing(p); setFormOpen(true); }} className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" title="Editează" data-testid={`edit-${p.id}`}><Edit3 className="w-4 h-4" /></button>
                    {p.status !== "terminated" && (
                      <button onClick={() => archive(p)} className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10" title="Încetează" data-testid={`archive-${p.id}`}><Trash2 className="w-4 h-4" /></button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {stats?.top_partners?.length > 0 && (
        <div className="mt-6 bg-white dark:bg-slate-900 rounded-2xl p-5 border border-slate-200 dark:border-slate-800">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Top parteneri (după lead-uri)
          </div>
          <div className="space-y-2">
            {stats.top_partners.map((t, i) => (
              <div key={t.partner_id} className="flex items-center justify-between text-sm">
                <span className="font-semibold text-slate-900 dark:text-white">{i + 1}. {t.company}</span>
                <span className="text-xs text-slate-500">{t.city} · {t.lead_count} lead-uri · {t.revenue || 0} RON</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {formOpen && <PartnerForm initial={editing} saving={saving} onClose={() => { setFormOpen(false); setEditing(null); }} onSave={save} />}
    </div>
  );
};

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800">
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <Icon className={`w-4 h-4 ${color}`} />
    </div>
    <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
  </div>
);

export default CityPartnersPage;
export { CityPartnersPage };
