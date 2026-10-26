// PartnerPortal — shared strategic partner portal.
// Route: /partners/portal  (real data for role=city_partner)
//        /partners/portal?demo=<partnerId>  (super-admin DEMO preview, synthetic data)
import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Building2, Users, TrendingUp, LogOut, Loader2, MapPin, CheckCircle2,
  AlertTriangle, Mail, Package, FileText, Handshake, BarChart3, LayoutDashboard,
  Globe, Coins, ArrowUpRight, FlaskConical,
} from "lucide-react";
import { useAuth } from "../../auth";

const API = process.env.REACT_APP_BACKEND_URL;
const ax = axios.create({
  baseURL: API,
  withCredentials: true,
  headers: { "X-PM-Client": "propmanage-app" },
});

const STAGE_LBL = { introduced: "Introdus", contacted: "Contactat", onboarded: "În lucru", converted: "Convertit", lost: "Pierdut" };
const STAGE_COLOR = {
  introduced: "bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300",
  contacted: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  onboarded: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  converted: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  lost: "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
};
const money = (v) => `${(v || 0).toLocaleString("ro-RO")} RON`;
const fmtDate = (s) => (s ? new Date(s).toLocaleDateString("ro-RO") : "—");

const TABS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "profil", label: "Profil & Catalog", icon: Package },
  { key: "clienti", label: "Clienți & Cereri", icon: Users },
  { key: "oferte", label: "Oferte & Conversii", icon: ArrowUpRight },
  { key: "acord", label: "Acord & Comisioane", icon: Handshake },
  { key: "rapoarte", label: "Rapoarte", icon: BarChart3 },
];

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-slate-200 dark:border-slate-800" data-testid={`stat-${label}`}>
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <Icon className={`w-4 h-4 ${color}`} />
    </div>
    <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
  </div>
);

const SectionCard = ({ title, icon: Icon, children, testid }) => (
  <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden" data-testid={testid}>
    <div className="flex items-center gap-1.5 p-4 border-b border-slate-100 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
      {Icon && <Icon className="w-3.5 h-3.5" />} {title}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const PartnerPortal = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const demoId = params.get("demo");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("dashboard");

  // Report filters
  const [rFrom, setRFrom] = useState("");
  const [rTo, setRTo] = useState("");
  const [rStage, setRStage] = useState("all");
  const [rCat, setRCat] = useState("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError("");
      try {
        const url = demoId
          ? `/api/partner/portal/demo?partner_id=${encodeURIComponent(demoId)}`
          : `/api/partner/portal`;
        const { data } = await ax.get(url);
        setData(data);
      } catch (e) {
        setError(e.response?.data?.detail || e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [demoId]);

  const doLogout = async () => { await logout(); navigate("/login"); };

  const p = data?.partner;
  const stats = data?.stats || {};
  const leads = data?.leads || [];
  const catalog = data?.catalog || [];
  const agreement = data?.agreement;
  const isDemo = !!data?.demo;

  const converted = useMemo(() => leads.filter((l) => l.stage === "converted"), [leads]);
  const reportCategories = useMemo(() => {
    const set = new Set([...(p?.categories || []), ...catalog.map((c) => c.category).filter(Boolean)]);
    return Array.from(set);
  }, [p, catalog]);
  const filteredCatalog = useMemo(
    () => (rCat === "all" ? catalog : catalog.filter((c) => c.category === rCat)),
    [catalog, rCat]
  );
  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (rStage !== "all" && l.stage !== rStage) return false;
      const d = l.introduced_at ? new Date(l.introduced_at) : null;
      if (rFrom && d && d < new Date(rFrom)) return false;
      if (rTo && d && d > new Date(rTo + "T23:59:59")) return false;
      return true;
    });
  }, [leads, rStage, rFrom, rTo]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8 gap-4 bg-slate-50 dark:bg-slate-950" data-testid="portal-error">
      <AlertTriangle className="w-10 h-10 text-rose-500" />
      <div className="text-rose-500 text-center max-w-md">{error}</div>
      {!demoId && <button onClick={doLogout} className="px-3 py-1.5 text-sm rounded-lg bg-slate-200 dark:bg-slate-800">Logout</button>}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950" data-testid="partner-portal">
      {/* DEMO banner */}
      {isDemo && (
        <div className="bg-amber-500 text-amber-950 text-sm font-semibold px-4 py-2 flex items-center justify-center gap-2" data-testid="demo-banner">
          <FlaskConical className="w-4 h-4" /> MOD DEMONSTRATIV — date sintetice, marcate „DEMO". Nicio colaborare reală nu este activată.
        </div>
      )}

      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 py-4 flex items-center gap-3 flex-wrap">
          <Building2 className="w-6 h-6 text-cyan-500" />
          <div>
            <h1 className="text-base lg:text-lg font-bold text-slate-900 dark:text-white" data-testid="portal-company">{p?.company}</h1>
            <div className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" />{[p?.city, p?.county, p?.country].filter(Boolean).join(", ") || "—"}</div>
          </div>
          <div className="flex-1" />
          <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-cyan-100 dark:bg-cyan-500/15 text-cyan-700 dark:text-cyan-400">Portal Partener</span>
          {!isDemo && (
            <>
              <Link to="/legal/sign" className="text-xs text-slate-600 hover:text-slate-900 dark:hover:text-white flex items-center gap-1"><Mail className="w-3 h-3" /> Contract</Link>
              <button onClick={doLogout} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Logout" data-testid="portal-logout"><LogOut className="w-4 h-4" /></button>
            </>
          )}
          {isDemo && <Link to="/admin/city-partners" className="text-xs text-slate-600 hover:text-slate-900 dark:hover:text-white">← Admin</Link>}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 lg:px-8 flex gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-3 py-3 text-sm font-medium flex items-center gap-1.5 border-b-2 whitespace-nowrap transition-colors ${tab === t.key ? "border-cyan-500 text-cyan-600 dark:text-cyan-400" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"}`}
                data-testid={`tab-${t.key}`}>
                <Icon className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 lg:p-8 space-y-6">
        {/* ── DASHBOARD ── */}
        {tab === "dashboard" && (
          <div className="space-y-6" data-testid="panel-dashboard">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard icon={Users} label="Clienți / cereri" value={stats.leads_total || 0} color="text-blue-500" />
              <StatCard icon={CheckCircle2} label="Convertite" value={stats.leads_by_stage?.converted || 0} color="text-emerald-500" />
              <StatCard icon={TrendingUp} label="Rată conversie" value={`${stats.conversion_rate || 0}%`} color="text-violet-500" />
              <StatCard icon={Coins} label="Rezultat comercial" value={money(stats.revenue_generated)} color="text-amber-500" />
            </div>
            <SectionCard title="Pâlnie comercială" icon={BarChart3} testid="funnel-card">
              <div className="space-y-2">
                {["introduced", "contacted", "onboarded", "converted", "lost"].map((st) => {
                  const n = stats.leads_by_stage?.[st] || 0;
                  const total = stats.leads_total || 1;
                  return (
                    <div key={st} className="flex items-center gap-3" data-testid={`funnel-${st}`}>
                      <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded w-24 text-center ${STAGE_COLOR[st]}`}>{STAGE_LBL[st]}</span>
                      <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full bg-cyan-500" style={{ width: `${Math.round((n / total) * 100)}%` }} />
                      </div>
                      <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 w-8 text-right">{n}</span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── PROFIL & CATALOG ── */}
        {tab === "profil" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" data-testid="panel-profil">
            <SectionCard title="Profil partener" icon={Building2} testid="profile-card">
              <div className="space-y-2 text-sm">
                {p?.website && <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400"><Globe className="w-4 h-4 text-slate-400" /><a href={p.website.startsWith("http") ? p.website : `https://${p.website}`} target="_blank" rel="noreferrer" className="hover:underline">{p.website}</a></div>}
                {p?.contact_name && <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><Users className="w-4 h-4 text-slate-400" />{p.contact_name}{p.contact_role ? ` · ${p.contact_role}` : ""}</div>}
                {p?.contact_email && <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><Mail className="w-4 h-4 text-slate-400" />{p.contact_email}</div>}
                <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><MapPin className="w-4 h-4 text-slate-400" />{[p?.city, p?.county, p?.country].filter(Boolean).join(", ") || "—"}</div>
              </div>
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs space-y-1.5">
                {p?.categories?.length > 0 && <div><span className="text-slate-400">Categorii autorizate: </span><span className="text-slate-700 dark:text-slate-200">{p.categories.join(", ")}</span></div>}
                {p?.zones?.length > 0
                  ? <div><span className="text-slate-400">Teritorii: </span><span className="text-slate-700 dark:text-slate-200">{p.zones.join(", ")}</span></div>
                  : <div className="text-slate-400">Teritorii comerciale: neconfirmate</div>}
              </div>
            </SectionCard>
            <div className="lg:col-span-2">
              <SectionCard title={`Catalog servicii / produse (${catalog.length})`} icon={Package} testid="catalog-card">
                {catalog.length === 0
                  ? <div className="text-sm text-slate-500 py-6 text-center">Niciun produs/serviciu în catalog încă.</div>
                  : <div className="divide-y divide-slate-100 dark:divide-slate-800 -m-4">
                    {catalog.map((c) => (
                      <div key={c.id} className="p-3 flex items-center gap-3" data-testid={`catalog-row-${c.id}`}>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{c.name}</div>
                          <div className="text-[11px] text-slate-500 truncate">{[c.category, c.brand].filter(Boolean).join(" · ") || "—"}</div>
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">
                          {c.price_min}{c.price_max && c.price_max !== c.price_min ? `–${c.price_max}` : ""} {c.currency}/{c.unit}
                        </span>
                      </div>
                    ))}
                  </div>}
              </SectionCard>
            </div>
          </div>
        )}

        {/* ── CLIENȚI & CERERI ── */}
        {tab === "clienti" && (
          <SectionCard title={`Clienți, recomandări și cereri (${leads.length})`} icon={Users} testid="panel-clienti">
            {leads.length === 0
              ? <div className="text-sm text-slate-500 py-8 text-center">Nicio recomandare sau cerere atribuită încă.</div>
              : <div className="divide-y divide-slate-100 dark:divide-slate-800 -m-4">
                {leads.map((l) => (
                  <div key={l.id} className="p-3 flex items-center gap-3" data-testid={`lead-row-${l.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{l.lead_name}</div>
                      <div className="text-[11px] text-slate-500 truncate">{l.lead_email || "—"} · {l.source || "—"} · {fmtDate(l.introduced_at)}</div>
                      {l.stage === "lost" && l.lost_reason && <div className="text-[11px] text-rose-500 mt-0.5">Pierdut: {l.lost_reason}</div>}
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${STAGE_COLOR[l.stage] || STAGE_COLOR.introduced}`}>{STAGE_LBL[l.stage] || l.stage}</span>
                  </div>
                ))}
              </div>}
          </SectionCard>
        )}

        {/* ── OFERTE & CONVERSII ── */}
        {tab === "oferte" && (
          <div className="space-y-6" data-testid="panel-oferte">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <StatCard icon={CheckCircle2} label="Proiecte convertite" value={converted.length} color="text-emerald-500" />
              <StatCard icon={Coins} label="Venit generat" value={money(stats.revenue_generated)} color="text-amber-500" />
              <StatCard icon={TrendingUp} label="Rată conversie" value={`${stats.conversion_rate || 0}%`} color="text-violet-500" />
            </div>
            <SectionCard title="Conversii & rezultate comerciale" icon={ArrowUpRight} testid="conversions-card">
              {converted.length === 0
                ? <div className="text-sm text-slate-500 py-6 text-center">Nicio conversie înregistrată încă.</div>
                : <div className="divide-y divide-slate-100 dark:divide-slate-800 -m-4">
                  {converted.map((l) => (
                    <div key={l.id} className="p-3 flex items-center gap-3" data-testid={`conversion-row-${l.id}`}>
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{l.lead_name}</div>
                        <div className="text-[11px] text-slate-500">Convertit: {fmtDate(l.conversion_date)}</div>
                      </div>
                      <span className="text-sm font-bold text-emerald-600">{money(l.revenue_generated)}</span>
                    </div>
                  ))}
                </div>}
            </SectionCard>
          </div>
        )}

        {/* ── ACORD & COMISIOANE ── */}
        {tab === "acord" && (
          <SectionCard title="Acord comercial & indicatori de comisionare" icon={Handshake} testid="panel-acord">
            {!agreement
              ? <div className="text-sm text-slate-500 py-8 text-center" data-testid="no-agreement">
                  Niciun acord comercial configurat încă. Indicatorii de comisionare apar aici după ce colaborarea este agreată din Admin.
                </div>
              : <div className="space-y-3 text-sm" data-testid="agreement-block">
                <div className="flex flex-wrap gap-2">
                  <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">status: {agreement.status}</span>
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${agreement.exclusivity ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"}`}>{agreement.exclusivity ? "exclusiv" : "neexclusiv"}</span>
                </div>
                {agreement.commission_terms && <div className="flex items-start gap-2"><Coins className="w-4 h-4 text-amber-500 mt-0.5" /><div><div className="text-slate-400 text-xs">Comision</div><div className="text-slate-800 dark:text-slate-100 font-medium">{agreement.commission_terms}</div></div></div>}
                {agreement.categories?.length > 0 && <div><span className="text-slate-400 text-xs">Categorii: </span>{agreement.categories.join(", ")}</div>}
                {[...(agreement.territory_cities || []), ...(agreement.territory_counties || []), ...(agreement.territory_regions || [])].length > 0 && (
                  <div><span className="text-slate-400 text-xs">Teritorii: </span>{[...(agreement.territory_cities || []), ...(agreement.territory_counties || []), ...(agreement.territory_regions || [])].join(", ")}</div>
                )}
                {(agreement.period_from || agreement.period_to) && <div><span className="text-slate-400 text-xs">Perioadă: </span>{agreement.period_from || "—"} → {agreement.period_to || "—"}</div>}
                {agreement.notes && <div className="text-xs text-slate-500 italic">„{agreement.notes}"</div>}
              </div>}
          </SectionCard>
        )}

        {/* ── RAPOARTE ── */}
        {tab === "rapoarte" && (
          <SectionCard title="Rapoarte filtrabile" icon={FileText} testid="panel-rapoarte">
            <div className="flex flex-wrap items-end gap-3 mb-4">
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">De la</label>
                <input type="date" value={rFrom} onChange={(e) => setRFrom(e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="report-from" />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Până la</label>
                <input type="date" value={rTo} onChange={(e) => setRTo(e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="report-to" />
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Status</label>
                <select value={rStage} onChange={(e) => setRStage(e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="report-stage">
                  <option value="all">Toate</option>
                  {Object.keys(STAGE_LBL).map((s) => <option key={s} value={s}>{STAGE_LBL[s]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Categorie (catalog)</label>
                <select value={rCat} onChange={(e) => setRCat(e.target.value)} className="px-2 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm" data-testid="report-category">
                  <option value="all">Toate</option>
                  {reportCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button onClick={() => { setRFrom(""); setRTo(""); setRStage("all"); setRCat("all"); }} className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-sm text-slate-600 dark:text-slate-300" data-testid="report-reset">Resetează</button>
            </div>
            <div className="text-xs text-slate-500 mb-2" data-testid="report-count">{filteredLeads.length} cereri/clienți · venit: {money(filteredLeads.reduce((s, l) => s + (l.revenue_generated || 0), 0))} · {filteredCatalog.length} produse în catalog</div>
            {filteredLeads.length === 0
              ? <div className="text-sm text-slate-500 py-6 text-center">Niciun rezultat pentru filtrele selectate.</div>
              : <div className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800">
                {filteredLeads.map((l) => (
                  <div key={l.id} className="py-2.5 flex items-center gap-3" data-testid={`report-row-${l.id}`}>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{l.lead_name}</div>
                      <div className="text-[11px] text-slate-500">{fmtDate(l.introduced_at)} · {l.source || "—"}</div>
                    </div>
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${STAGE_COLOR[l.stage] || STAGE_COLOR.introduced}`}>{STAGE_LBL[l.stage] || l.stage}</span>
                    {l.revenue_generated > 0 && <span className="text-xs font-bold text-emerald-600">{money(l.revenue_generated)}</span>}
                  </div>
                ))}
              </div>}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">Catalog filtrat după categorie ({filteredCatalog.length})</div>
              {filteredCatalog.length === 0
                ? <div className="text-sm text-slate-500">Niciun produs pentru categoria selectată.</div>
                : <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredCatalog.map((c) => (
                    <div key={c.id} className="py-2 flex items-center gap-3" data-testid={`report-catalog-${c.id}`}>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-slate-800 dark:text-slate-100 truncate">{c.name}</div>
                        <div className="text-[11px] text-slate-500">{c.category || "—"}</div>
                      </div>
                      <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 whitespace-nowrap">{c.price_min}{c.price_max && c.price_max !== c.price_min ? `–${c.price_max}` : ""} {c.currency}</span>
                    </div>
                  ))}
                </div>}
            </div>
          </SectionCard>
        )}

        <p className="text-[11px] text-center text-slate-400 italic pt-2">
          Vezi doar propriile date autorizate. Colaborarea este non-exclusivă; funcționalitățile se activează prin acte adiționale.
        </p>
      </div>
    </div>
  );
};

export default PartnerPortal;
export { PartnerPortal };
