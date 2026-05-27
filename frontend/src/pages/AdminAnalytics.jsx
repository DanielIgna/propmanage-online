// Admin Live Analytics dashboard with recharts
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { TrendingUp, Users, Coins, AlertTriangle, Award, RefreshCcw, Briefcase } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const COLORS = ["#d4ff3a", "#7aa3ff", "#ffb86b", "#5be8d4", "#c4a8e6", "#ff8fab", "#a0a0a8", "#888893"];

const STATUS_LABELS_RO = {
  open: "Deschis",
  assigned: "Asignat",
  in_progress: "În lucru",
  completed: "Finalizat",
  confirmed: "Confirmat",
};

const CATEGORY_LABELS_RO = {
  hvac: "HVAC",
  electric: "Electric",
  plumbing: "Sanitar",
  interior_design: "Design Interior",
  other: "Altele",
};

export const AdminAnalytics = () => {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(14);
  const [loading, setLoading] = useState(false);

  const load = async (d = days) => {
    setLoading(true);
    try {
      const { data: d2 } = await axios.get(`${API}/admin/analytics?days=${d}`);
      setData(d2);
    } catch (e) { /* noop */ }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  if (!data) return <div className="text-center text-stone-500 py-12" data-testid="analytics-loading">Se încarcă analytics...</div>;

  const series = data.series.map(s => ({
    ...s,
    Joburi: s.jobs_created,
    Confirmate: s.jobs_confirmed,
    Utilizatori: s.users,
    Dispute: s.disputes,
  }));

  const categories = data.by_category.map(c => ({ name: CATEGORY_LABELS_RO[c.name] || c.name, value: c.value }));
  const statuses = data.by_status.map(s => ({ name: STATUS_LABELS_RO[s.name] || s.name, value: s.value }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
              <h3 className="font-serif text-2xl">Analize Live</h3>
          <p className="text-xs text-stone-400">Date actualizate în timp real</p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 14, 30, 90].map(d => (
            <button key={d} onClick={() => { setDays(d); load(d); }}
              className={`px-3 py-1.5 rounded-full text-xs transition ${days === d ? "bg-[#d4ff3a] text-black font-medium" : "bg-white/5 hover:bg-white/10 text-stone-300"}`}
              data-testid={`range-${d}`}>
              {d}z
            </button>
          ))}
          <button onClick={() => load()} disabled={loading} className="p-2 bg-white/5 hover:bg-white/10 rounded-full" data-testid="refresh-analytics">
            <RefreshCcw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPI icon={Coins} label="GMV (Volum brut)" value={`${data.gmv.toFixed(0)} RON`} sub="Tranzacții confirmate" color="emerald" tid="kpi-gmv" />
        <KPI icon={TrendingUp} label="Venit platformă" value={`${data.platform_revenue.toFixed(0)} RON`} sub={`incl. ${data.lead_fees.toFixed(0)} lead fees`} color="lime" tid="kpi-revenue" />
        <KPI icon={Briefcase} label="Valoare job med." value={`${data.avg_job_value.toFixed(0)} RON`} sub="Per lucrare" color="amber" tid="kpi-avg" />
        <KPI icon={AlertTriangle} label="Dispute" value={data.disputes.total} sub={`${data.disputes.open} deschise · ${data.disputes.resolved} rez.`} color="red" tid="kpi-disputes" />
      </div>

      {/* Time series area chart */}
      <div className="glass-strong rounded-3xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-serif text-lg">Activitate platformă</h4>
          <span className="text-[10px] uppercase tracking-wider text-stone-500">Ultimele {days} zile</span>
        </div>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={series}>
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#d4ff3a" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#d4ff3a" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7aa3ff" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#7aa3ff" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="g3" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ffb86b" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#ffb86b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
            <XAxis dataKey="date" stroke="#666" style={{ fontSize: 10 }} />
            <YAxis stroke="#666" style={{ fontSize: 10 }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: "#0a0a0b", border: "1px solid #ffffff20", borderRadius: 12 }} labelStyle={{ color: "#fff" }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="Joburi" stroke="#d4ff3a" fill="url(#g1)" />
            <Area type="monotone" dataKey="Confirmate" stroke="#7aa3ff" fill="url(#g2)" />
            <Area type="monotone" dataKey="Utilizatori" stroke="#ffb86b" fill="url(#g3)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Category breakdown */}
        <div className="glass-strong rounded-3xl p-6">
          <h4 className="font-serif text-lg mb-4">Joburi pe categorie</h4>
          {categories.length === 0 ? (
            <div className="text-xs text-stone-500 text-center py-12">Fără date</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={categories} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {categories.map((entry, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "#0a0a0b", border: "1px solid #ffffff20", borderRadius: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Status breakdown */}
        <div className="glass-strong rounded-3xl p-6">
          <h4 className="font-serif text-lg mb-4">Stare lucrări (toate)</h4>
          {statuses.length === 0 ? (
            <div className="text-xs text-stone-500 text-center py-12">Fără date</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={statuses}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="name" stroke="#666" style={{ fontSize: 10 }} />
                <YAxis stroke="#666" style={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#0a0a0b", border: "1px solid #ffffff20", borderRadius: 12 }} />
                <Bar dataKey="value" fill="#d4ff3a" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Top specialists */}
      <div className="glass-strong rounded-3xl p-6">
        <h4 className="font-serif text-lg mb-4 flex items-center gap-2"><Award className="w-4 h-4 text-[#d4ff3a]" />Top specialiști (după venit)</h4>
        {data.top_specialists.length === 0 ? (
          <div className="text-xs text-stone-500 text-center py-8" data-testid="no-top-specs">Niciun specialist confirmat încă</div>
        ) : (
          <div className="space-y-2">
            {data.top_specialists.map((s, i) => (
              <div key={s.id} className="flex items-center justify-between gap-3 bg-white/5 rounded-xl p-4" data-testid={`top-spec-${i}`}>
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#d4ff3a] to-[#a8e028] flex items-center justify-center text-black text-xs font-bold flex-shrink-0">
                    {i + 1}
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium text-sm truncate">{s.name}</div>
                    <div className="text-[10px] text-stone-500">{CATEGORY_LABELS_RO[s.specialty] || s.specialty || "—"} · {s.rating ? `${s.rating}★` : "fără rating"}</div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="font-serif text-lg">{(s.revenue || 0).toFixed(0)} RON</div>
                  <div className="text-[10px] text-stone-500">{s.jobs} {s.jobs === 1 ? "job" : "joburi"}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const KPI = ({ icon: Ic, label, value, sub, color = "lime", tid }) => (
  <div className="glass-strong rounded-2xl p-5" data-testid={tid}>
    <div className="flex items-center justify-between mb-3">
      <div className={`w-9 h-9 rounded-xl bg-${color}-500/15 border border-${color}-500/30 flex items-center justify-center`}>
        <Ic className={`w-4 h-4 text-${color}-400`} />
      </div>
    </div>
    <div className="font-serif text-2xl mb-0.5">{value}</div>
    <div className="text-xs text-stone-400 leading-tight">{label}</div>
    {sub && <div className="text-[10px] text-stone-500 mt-1">{sub}</div>}
  </div>
);
