import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  BarChart3, Users, MousePointerClick, UserPlus, Building2, Wallet, RefreshCw,
  Download, Plus, QrCode, Copy, Trash2, Link2, Megaphone, Settings2, CheckCircle2, Loader2,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, LabelList,
} from "recharts";
import { AdminLayoutMetronic } from "./AdminLayoutMetronic";
import { API } from "../DashShared";
import { toast } from "sonner";

const SOURCE_COLORS = { whatsapp: "#25D366", facebook: "#1877F2", google: "#EA4335", direct: "#64748b", qr: "#8b5cf6", admin: "#f59e0b", other: "#0ea5e9" };
const PERIODS = [["day", "Azi"], ["week", "7 zile"], ["month", "30 zile"]];

const Kpi = ({ icon: Icon, label, value, accent }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4" data-testid={`kpi-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
    <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs font-semibold uppercase tracking-wide">
      <Icon className={`w-4 h-4 ${accent}`} /> {label}
    </div>
    <div className="mt-2 text-3xl font-black text-slate-900 dark:text-white">{value}</div>
  </div>
);

export default function AnalyticsGrowthPage() {
  const [tab, setTab] = useState("overview");
  const [period, setPeriod] = useState("week");
  const [overview, setOverview] = useState(null);
  const [pages, setPages] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [integrations, setIntegrations] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", administrator: "", association: "", apartments_count: 0, channel: "whatsapp", recipients_count: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const [o, p, c, i] = await Promise.all([
        axios.get(`${API}/admin/analytics/overview?period=${period}`),
        axios.get(`${API}/admin/analytics/pages?period=${period}`),
        axios.get(`${API}/admin/growth/campaigns`),
        axios.get(`${API}/admin/analytics/integrations`),
      ]);
      setOverview(o.data); setPages(p.data.items); setCampaigns(c.data.items); setIntegrations(i.data);
    } catch (e) { toast.error("Eroare la încărcarea datelor analytics"); }
    setLoading(false);
  };
  useEffect(() => { load(); }, [period]); // eslint-disable-line react-hooks/exhaustive-deps

  const exportCsv = (report) => window.open(`${API}/admin/analytics/export.csv?report=${report}&period=${period}`, "_blank");

  const createCampaign = async () => {
    if (!form.name.trim()) return toast.error("Numele campaniei e obligatoriu");
    try {
      await axios.post(`${API}/admin/growth/campaigns`, form);
      toast.success("Campanie creată — link + QR generate");
      setShowCreate(false);
      setForm({ name: "", administrator: "", association: "", apartments_count: 0, channel: "whatsapp", recipients_count: 0 });
      load();
    } catch (e) { toast.error(e?.response?.data?.detail || "Eroare la creare"); }
  };

  const deleteCampaign = async (id) => {
    if (!window.confirm("Ștergi campania? Statisticile asociate rămân în istoric.")) return;
    await axios.delete(`${API}/admin/growth/campaigns/${id}`);
    load();
  };

  const saveIntegrations = async () => {
    try {
      const { data } = await axios.put(`${API}/admin/analytics/integrations`, {
        clarity_id: integrations.clarity_id || "", ga4_id: integrations.ga4_id || "",
        meta_pixel_id: integrations.meta_pixel_id || "", tracker_enabled: integrations.tracker_enabled !== false,
      });
      setIntegrations(data); toast.success("Integrări salvate — scripturile se injectează automat la vizitatori");
    } catch (e) { toast.error("Eroare la salvare"); }
  };

  const sourceData = useMemo(() => (overview?.sources || []).map(s => ({ ...s, fill: SOURCE_COLORS[s.source] || "#0ea5e9" })), [overview]);
  const k = overview?.kpi || {};

  return (
    <AdminLayoutMetronic active="growth_analytics" title="Analytics & Growth" subtitle="Decizii pe bază de date — trafic, conversii, campanii">
      <div className="space-y-5" data-testid="analytics-growth-page">
        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {[["overview", "Dashboard KPI", BarChart3], ["pages", "Pagini", MousePointerClick], ["campaigns", "Campanii", Megaphone], ["integrations", "Integrări", Settings2]].map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} data-testid={`ag-tab-${id}`}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-colors ${tab === id ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"}`}>
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-1.5">
            {PERIODS.map(([id, label]) => (
              <button key={id} onClick={() => setPeriod(id)} data-testid={`ag-period-${id}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${period === id ? "bg-blue-600 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700"}`}>
                {label}
              </button>
            ))}
            <button onClick={load} className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" data-testid="ag-refresh">
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {loading && !overview ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>
        ) : tab === "overview" && overview ? (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Kpi icon={Users} label="Vizitatori unici" value={k.unique_visitors ?? 0} accent="text-blue-500" />
              <Kpi icon={MousePointerClick} label="Sesiuni" value={k.sessions ?? 0} accent="text-cyan-500" />
              <Kpi icon={UserPlus} label="Conturi create" value={k.accounts_created ?? 0} accent="text-emerald-500" />
              <Kpi icon={Users} label="Specialiști înscriși" value={k.specialists_signed ?? 0} accent="text-violet-500" />
              <Kpi icon={Building2} label="Proprietăți adăugate" value={k.properties_added ?? 0} accent="text-amber-500" />
              <Kpi icon={Wallet} label="Bounce rate" value={`${k.bounce_rate_pct ?? 0}%`} accent="text-rose-500" />
            </div>
            <div className="grid lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-slate-800 dark:text-slate-100">Trafic zilnic</h3>
                  <button onClick={() => exportCsv("overview")} className="flex items-center gap-1 text-xs font-bold text-blue-600" data-testid="ag-export-overview"><Download className="w-3.5 h-3.5" /> CSV</button>
                </div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={overview.series}>
                    <defs><linearGradient id="gv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} /><stop offset="100%" stopColor="#3b82f6" stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
                    <XAxis dataKey="day" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Area type="monotone" dataKey="visitors" name="Vizitatori" stroke="#3b82f6" fill="url(#gv)" strokeWidth={2} />
                    <Area type="monotone" dataKey="sessions" name="Sesiuni" stroke="#8b5cf6" fill="none" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-2">Surse trafic</h3>
                {sourceData.length === 0 ? <p className="text-sm text-slate-400 py-8 text-center">Fără trafic în perioadă</p> : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={sourceData} dataKey="sessions" nameKey="source" innerRadius={45} outerRadius={80} paddingAngle={2}>
                        {sourceData.map((s, i) => <Cell key={i} fill={s.fill} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
                <div className="flex flex-wrap gap-2 mt-1">
                  {sourceData.map(s => (
                    <span key={s.source} className="flex items-center gap-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                      <span className="w-2 h-2 rounded-full" style={{ background: s.fill }} /> {s.source} ({s.sessions})
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
              <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-2">Funnel conversie</h3>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={overview.funnel} layout="vertical" margin={{ left: 40 }}>
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="step" width={150} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 8, 8, 0]} barSize={22}>
                    <LabelList dataKey="count" position="right" style={{ fontSize: 12, fontWeight: 700 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : tab === "pages" ? (
          <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-x-auto">
            <div className="flex items-center justify-between p-4 pb-0">
              <h3 className="font-bold text-slate-800 dark:text-slate-100">Performanța paginilor</h3>
              <button onClick={() => exportCsv("pages")} className="flex items-center gap-1 text-xs font-bold text-blue-600" data-testid="ag-export-pages"><Download className="w-3.5 h-3.5" /> CSV</button>
            </div>
            <table className="w-full text-sm mt-2">
              <thead><tr className="text-left text-[11px] uppercase text-slate-400 border-b border-slate-100 dark:border-slate-700">
                <th className="px-4 py-2">Pagină</th><th className="px-4 py-2">Vizualizări</th><th className="px-4 py-2">Timp mediu</th><th className="px-4 py-2">Bounce</th>
              </tr></thead>
              <tbody data-testid="ag-pages-table">
                {pages.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">Fără date încă — trackerul colectează de la primii vizitatori</td></tr>}
                {pages.map(p => (
                  <tr key={p.path} className="border-b border-slate-50 dark:border-slate-700/50">
                    <td className="px-4 py-2 font-mono text-xs">{p.path}</td>
                    <td className="px-4 py-2 font-bold">{p.views}</td>
                    <td className="px-4 py-2">{p.avg_time_sec}s</td>
                    <td className="px-4 py-2">{p.bounce_rate_pct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : tab === "campaigns" ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">Indicatori per campanie: primit → deschis → 30s+ → înregistrare → cont → revenit 7z</p>
              <div className="flex gap-2">
                <button onClick={() => exportCsv("campaigns")} className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700" data-testid="ag-export-campaigns"><Download className="w-3.5 h-3.5" /> CSV</button>
                <button onClick={() => setShowCreate(true)} className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white" data-testid="ag-new-campaign"><Plus className="w-4 h-4" /> Campanie nouă</button>
              </div>
            </div>
            {showCreate && (
              <div className="rounded-2xl border-2 border-blue-200 dark:border-blue-500/30 bg-white dark:bg-slate-800 p-4 grid md:grid-cols-3 gap-3" data-testid="ag-create-form">
                {[["name", "Nume campanie *"], ["administrator", "Administrator"], ["association", "Asociație"]].map(([kk, label]) => (
                  <label key={kk} className="text-xs font-bold text-slate-500">{label}
                    <input value={form[kk]} onChange={e => setForm(f => ({ ...f, [kk]: e.target.value }))} data-testid={`ag-form-${kk}`}
                      className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent text-sm font-normal" />
                  </label>
                ))}
                <label className="text-xs font-bold text-slate-500">Nr. apartamente
                  <input type="number" value={form.apartments_count} onChange={e => setForm(f => ({ ...f, apartments_count: +e.target.value || 0 }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent text-sm font-normal" />
                </label>
                <label className="text-xs font-bold text-slate-500">Persoane care au primit mesajul
                  <input type="number" value={form.recipients_count} onChange={e => setForm(f => ({ ...f, recipients_count: +e.target.value || 0 }))} data-testid="ag-form-recipients"
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent text-sm font-normal" />
                </label>
                <label className="text-xs font-bold text-slate-500">Canal
                  <select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
                    className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm font-normal">
                    {["whatsapp", "facebook", "google", "qr", "admin", "other"].map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </label>
                <div className="md:col-span-3 flex gap-2 justify-end">
                  <button onClick={() => setShowCreate(false)} className="px-3 py-2 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-600">Anulează</button>
                  <button onClick={createCampaign} className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white" data-testid="ag-form-submit">Creează + generează link & QR</button>
                </div>
              </div>
            )}
            <div className="grid gap-3" data-testid="ag-campaigns-list">
              {campaigns.length === 0 && !showCreate && <p className="text-center text-slate-400 py-10 text-sm">Nicio campanie încă. Creează prima campanie și primești automat link personalizat + QR.</p>}
              {campaigns.map(c => (
                <div key={c.id} className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-black text-slate-900 dark:text-white">{c.name}</span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">{c.channel}</span>
                    <span className="text-xs text-slate-400">{c.administrator}{c.association ? ` · ${c.association}` : ""}{c.apartments_count ? ` · ${c.apartments_count} ap.` : ""} · trimis {String(c.sent_at || "").slice(0, 10)}</span>
                    <div className="ml-auto flex items-center gap-1.5">
                      <button onClick={() => { navigator.clipboard.writeText(c.url); toast.success("Link copiat"); }} title={c.url}
                        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-bold bg-blue-50 dark:bg-blue-500/15 text-blue-600 dark:text-blue-300" data-testid={`ag-copy-${c.code}`}>
                        <Link2 className="w-3.5 h-3.5" /> {c.code}
                      </button>
                      <a href={`${API}/admin/growth/campaigns/${c.id}/qr`} className="p-1.5 rounded-lg bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-300" title="Descarcă QR" data-testid={`ag-qr-${c.code}`}>
                        <QrCode className="w-4 h-4" />
                      </a>
                      <button onClick={() => deleteCampaign(c.id)} className="p-1.5 rounded-lg bg-rose-50 dark:bg-rose-500/15 text-rose-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 text-center">
                    {[["Primit", c.stats?.recipients], ["Deschis", c.stats?.opened], ["Vizitatori", c.stats?.unique_visitors], ["30s+", c.stats?.over_30s],
                      ["Început înreg.", c.stats?.signup_started], ["Conturi", c.stats?.accounts_created], ["Abonamente", c.stats?.subscriptions],
                      ["Revenit 7z", c.stats?.returned_7d], ["Conversie", `${c.stats?.conversion_pct ?? 0}%`]].map(([label, val]) => (
                      <div key={label} className="rounded-xl bg-slate-50 dark:bg-slate-700/40 py-2">
                        <div className="text-lg font-black text-slate-900 dark:text-white">{val ?? 0}</div>
                        <div className="text-[9px] uppercase font-bold text-slate-400">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : tab === "integrations" && integrations ? (
          <div className="max-w-xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 space-y-4" data-testid="ag-integrations">
            <h3 className="font-bold text-slate-800 dark:text-slate-100">Integrări externe (modulare)</h3>
            <p className="text-xs text-slate-500">Lipești ID-ul → scriptul se injectează automat pentru vizitatori. Fără modificări de cod.</p>
            {[["clarity_id", "Microsoft Clarity Project ID", "ex: xj5fspkgjj — recording sesiuni + heatmaps"],
              ["ga4_id", "Google Analytics 4 Measurement ID", "ex: G-XXXXXXXXXX"],
              ["meta_pixel_id", "Meta Pixel ID", "ex: 1234567890"]].map(([kk, label, hint]) => (
              <label key={kk} className="block text-xs font-bold text-slate-500">{label}
                <input value={integrations[kk] || ""} onChange={e => setIntegrations(s => ({ ...s, [kk]: e.target.value.trim() }))} data-testid={`ag-int-${kk}`}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-transparent text-sm font-mono font-normal" placeholder={hint} />
              </label>
            ))}
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={integrations.tracker_enabled !== false} onChange={e => setIntegrations(s => ({ ...s, tracker_enabled: e.target.checked }))} />
              Tracker first-party activ (vizitatori, sesiuni, funnel)
            </label>
            <button onClick={saveIntegrations} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold bg-blue-600 text-white" data-testid="ag-int-save">
              <CheckCircle2 className="w-4 h-4" /> Salvează integrările
            </button>
          </div>
        ) : null}
      </div>
    </AdminLayoutMetronic>
  );
}
