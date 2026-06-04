// Overview: KPI cards + analytics chart
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Users, Briefcase, DollarSign, Scale, TrendingUp, Activity } from "lucide-react";
import { AdminCard } from "./AdminLayoutMetronic";
import { API } from "../DashShared";
import { IncidentCadenceHeatmap } from "./IncidentCadenceHeatmap";
import { MorningBriefing } from "./MorningBriefing";
import { AutoMatchPanel } from "./AutoMatchPanel";
import { AIActivityStream } from "./AIActivityStream";
import { WeeklyBriefingControl } from "./WeeklyBriefingControl";

const KpiCard = ({ icon: Icon, label, value, sub, tone = "blue", testid }) => {
  const tones = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400",
    green: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400",
    red: "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400",
  };
  return (
    <AdminCard testid={testid}>
      <div className="flex items-center justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tones[tone]}`}>
          <Icon className="w-5 h-5" />
        </div>
        {sub && <span className="text-xs text-slate-500 dark:text-slate-400">{sub}</span>}
      </div>
      <div className="text-3xl font-bold tracking-tight">{value}</div>
      <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">{label}</div>
    </AdminCard>
  );
};

export const AdminOverview = () => {
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [finance, setFinance] = useState(null);

  useEffect(() => {
    axios.get(`${API}/admin/stats`).then(r => setStats(r.data)).catch(() => {});
    axios.get(`${API}/admin/analytics?days=14`).then(r => setAnalytics(r.data)).catch(() => {});
    axios.get(`${API}/admin/finance/overview`).then(r => setFinance(r.data)).catch(() => {});
  }, []);

  const maxJobs = analytics?.series?.reduce((m, s) => Math.max(m, s.jobs_created, s.jobs_confirmed), 1) || 1;

  return (
    <div className="space-y-6">
      <MorningBriefing />
      <AutoMatchPanel />
      <WeeklyBriefingControl />
      <AIActivityStream />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Useri Total" value={stats?.users ?? "—"} tone="blue" testid="kpi-users" />
        <KpiCard icon={Briefcase} label="Joburi Active" value={stats?.active_jobs ?? "—"} sub={`${stats?.completed_jobs || 0} finalizate`} tone="amber" testid="kpi-jobs" />
        <KpiCard icon={DollarSign} label="GMV (14z)" value={analytics ? `${analytics.gmv.toLocaleString("ro")} RON` : "—"} sub={`Revenue: ${(analytics?.platform_revenue || 0).toLocaleString("ro")} RON`} tone="green" testid="kpi-gmv" />
        <KpiCard icon={Scale} label="Dispute" value={analytics?.disputes?.total ?? 0} sub={`${analytics?.disputes?.open || 0} deschise`} tone="red" testid="kpi-disputes" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <AdminCard className="lg:col-span-2" title="Activitate ultimele 14 zile" testid="chart-activity">
          <div className="h-64 flex items-end gap-1.5">
            {(analytics?.series || []).map((s, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="w-full flex flex-col gap-0.5 items-stretch" style={{ height: "200px", justifyContent: "flex-end" }}>
                  <div
                    className="bg-blue-500 dark:bg-blue-400 rounded-t transition-all hover:opacity-80"
                    style={{ height: `${(s.jobs_created / maxJobs) * 100}%`, minHeight: "2px" }}
                    title={`${s.jobs_created} cereri`}
                  />
                  <div
                    className="bg-emerald-500 dark:bg-emerald-400 rounded-t opacity-70"
                    style={{ height: `${(s.jobs_confirmed / maxJobs) * 100}%`, minHeight: "2px" }}
                    title={`${s.jobs_confirmed} confirmate`}
                  />
                </div>
                <div className="text-[9px] text-slate-500 dark:text-slate-500 -rotate-45 origin-top-left whitespace-nowrap mt-1">{s.date}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-4 text-xs text-slate-600 dark:text-slate-400">
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-blue-500" /> Cereri create</div>
            <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-500" /> Confirmate</div>
          </div>
        </AdminCard>

        <AdminCard title="Top Specialiști" testid="top-specialists">
          <div className="space-y-3">
            {(analytics?.top_specialists || []).slice(0, 5).map((s, i) => (
              <div key={s.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center text-white text-sm font-bold">{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{s.name}</div>
                  <div className="text-[11px] text-slate-500">{s.jobs} joburi · {Number(s.revenue).toLocaleString("ro")} RON</div>
                </div>
              </div>
            ))}
            {!analytics?.top_specialists?.length && <div className="text-sm text-slate-500">Date insuficiente</div>}
          </div>
        </AdminCard>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <AdminCard title="Finanțe — Sold global" testid="finance-overview-card">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Total în wallets</div>
              <div className="text-2xl font-bold mt-1">{(finance?.total_wallet || 0).toLocaleString("ro")} RON</div>
            </div>
            <div>
              <div className="text-xs text-slate-500 uppercase tracking-wider">Escrow Held</div>
              <div className="text-2xl font-bold mt-1">{(finance?.escrow_held || 0).toLocaleString("ro")} RON</div>
            </div>
          </div>
          <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
            <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Tranzacții 30z (per tip)</div>
            <div className="space-y-1.5">
              {(finance?.tx_by_type || []).map(t => (
                <div key={t.type} className="flex justify-between text-sm">
                  <span className="capitalize">{t.type}</span>
                  <span className="font-medium">{t.count}× · {Number(t.total).toLocaleString("ro")} RON</span>
                </div>
              ))}
            </div>
          </div>
        </AdminCard>

        <AdminCard title="Distribuție categorii" testid="category-distribution">
          <div className="space-y-2">
            {(analytics?.by_category || []).map(c => {
              const total = analytics.by_category.reduce((s, x) => s + x.value, 0) || 1;
              const pct = (c.value / total) * 100;
              return (
                <div key={c.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="capitalize">{c.name}</span>
                    <span className="text-slate-500">{c.value} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-violet-500" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {!analytics?.by_category?.length && <div className="text-sm text-slate-500">Niciun dată</div>}
          </div>
        </AdminCard>
      </div>

      <IncidentCadenceHeatmap />
    </div>
  );
};
