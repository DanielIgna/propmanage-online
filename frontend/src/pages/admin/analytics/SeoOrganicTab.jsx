import React, { useEffect, useState } from "react";
import axios from "axios";
import { Loader2, Search, MousePointerClick, TrendingUp, ExternalLink, RefreshCw } from "lucide-react";
import { API } from "../../DashShared";

const Stat = ({ label, value, sub, testid }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4" data-testid={testid}>
    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</div>
    <div className="mt-1 text-3xl font-black text-slate-900 dark:text-white">{value}</div>
    {sub != null && <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub}</div>}
  </div>
);

const Card = ({ title, children, testid, right }) => (
  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5" data-testid={testid}>
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
      {right}
    </div>
    {children}
  </div>
);

const pct = (n) => `${(Number(n || 0) * 100).toFixed(1)}%`;
const ron = (n) => `${Number(n || 0).toLocaleString("ro-RO")} RON`;
const AUD_LABEL = { owner: "Proprietari", specialist: "Specialiști", designer: "Designeri", unknown: "Neatribuit" };

export const SeoOrganicTab = () => {
  const [period, setPeriod] = useState("28");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = (p, refresh = 0) => {
    setLoading(true);
    axios.get(`${API}/admin/analytics/seo-organic?period=${p}${refresh ? "&refresh=1" : ""}`)
      .then((r) => setData(r.data)).catch(() => setData(null)).finally(() => setLoading(false));
  };
  useEffect(() => { load(period); /* eslint-disable-next-line */ }, [period]);

  if (loading && !data) return <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-slate-400" /></div>;
  if (!data) return <div className="text-sm text-slate-500 py-10 text-center" data-testid="ag-seo-empty">Nu am putut încărca datele SEO.</div>;

  const gsc = data.gsc || {};
  const t = data.totals || {};

  return (
    <div className="space-y-5" data-testid="ag-seo-organic-tab">
      {/* Period + refresh */}
      <div className="flex items-center gap-2">
        {["7", "28", "90"].map((p) => (
          <button key={p} onClick={() => setPeriod(p)} data-testid={`ag-seo-period-${p}`}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${period === p ? "bg-blue-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
            {p} zile
          </button>
        ))}
        <button onClick={() => load(period, 1)} className="ml-auto p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300" data-testid="ag-seo-refresh">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Organic KPIs (internal analytics — always real) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Sesiuni organice calificate" value={t.qualified_organic_sessions ?? t.organic_sessions ?? 0} sub={t.organic_system_excluded ? `${t.organic_system_excluded} excluse (login/app)` : "din căutare, fără login/app"} testid="ag-seo-kpi-sessions" />
        <Stat label="CTA organice" value={t.organic_cta ?? 0} testid="ag-seo-kpi-cta" />
        <Stat label="Conversii organice" value={t.organic_conversions ?? 0} testid="ag-seo-kpi-conv" />
        <Stat label="Rată conversie organică" value={`${t.organic_cvr ?? 0}%`} testid="ag-seo-kpi-cvr" />
      </div>

      {/* GSC block — honest not_connected */}
      <Card title="Google Search Console" testid="ag-seo-gsc"
        right={<span className={`text-[11px] px-2 py-0.5 rounded-full ${gsc.status === "connected" ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"}`}>{gsc.status === "connected" ? "CONECTAT" : "NECONECTAT"}</span>}>
        {gsc.status === "connected" ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="Clicks organice" value={gsc.overview?.clicks ?? 0} />
            <Stat label="Impresii" value={gsc.overview?.impressions ?? 0} />
            <Stat label="CTR" value={pct(gsc.overview?.ctr)} />
            <Stat label="Poziție medie" value={(gsc.overview?.position ?? 0).toFixed(1)} />
          </div>
        ) : (
          <div className="text-sm text-slate-500 dark:text-slate-400" data-testid="ag-seo-gsc-empty">
            Search Console nu este conectat pe acest mediu — clicks/impressions/CTR/poziție și query-urile reale vor apărea după conectare din <a href="/admin?tab=seo&subtab=gsc" className="text-blue-500 inline-flex items-center gap-1">Admin → SEO → GSC <ExternalLink className="w-3 h-3" /></a>. Nu afișăm date estimate.
          </div>
        )}
      </Card>

      {/* Traffic by source (organic vs ads vs social vs direct) */}
      <Card title="Trafic pe sursă (organic vs plătit vs social)" testid="ag-seo-traffic">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
              <th className="py-2 pr-3">Sursă</th><th className="py-2 pr-3">Sesiuni</th><th className="py-2 pr-3">CTA</th><th className="py-2 pr-3">Signups</th><th className="py-2 pr-3">Leads</th>
            </tr></thead>
            <tbody>
              {(data.traffic || []).map((r) => (
                <tr key={r.key} className="border-b border-slate-100 dark:border-slate-700/50" data-testid={`ag-seo-src-${r.key}`}>
                  <td className="py-2 pr-3 text-slate-800 dark:text-slate-200">{r.label}</td>
                  <td className="py-2 pr-3">{r.sessions}</td>
                  <td className="py-2 pr-3">{r.cta}</td>
                  <td className="py-2 pr-3 font-semibold text-emerald-500">{r.signups ?? 0}</td>
                  <td className="py-2 pr-3">{r.leads ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="text-xs text-slate-500 mt-3">
          Google Ads (cpc): {data.ads_connected ? "date prezente" : "no connected data"} · organic și plătit sunt separate.
        </div>
      </Card>

      {/* SEO → conversion funnel */}
      <Card title="Funnel SEO → conversie" testid="ag-seo-funnel">
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <Stat label="Impresii (GSC)" value={data.funnel?.impressions ?? "—"} />
          <Stat label="Clicks (GSC)" value={data.funnel?.clicks ?? "—"} />
          <Stat label="Sesiuni organice" value={data.funnel?.organic_sessions ?? 0} />
          <Stat label="CTA" value={data.funnel?.cta ?? 0} />
          <Stat label="Lead / signup" value={data.funnel?.conversions ?? 0} />
        </div>
        <div className="mt-3 text-xs text-slate-600 dark:text-slate-300 flex flex-wrap gap-3" data-testid="ag-seo-funnel-audience">
          <span>Proprietari: <b>{data.funnel?.by_audience?.owner ?? 0}</b></span>
          <span>Specialiști: <b>{data.funnel?.by_audience?.specialist ?? 0}</b></span>
          <span>Designeri: <b>{data.funnel?.by_audience?.designer ?? 0}</b></span>
          <span>Neatribuit: <b>{data.funnel?.by_audience?.unattributed ?? 0}</b></span>
        </div>
      </Card>

      {/* Signups by audience (source → audience → signup) */}
      <Card title="Signups pe audiență (sursă → audiență → cont)" testid="ag-seo-signups-audience">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {["owner", "specialist", "designer", "unknown"].map((a) => (
            <Stat key={a} label={AUD_LABEL[a]} value={data.signups_by_audience?.[a]?.total ?? 0}
              testid={`ag-seo-signup-aud-${a}`}
              sub={Object.entries(data.signups_by_audience?.[a]?.by_source || {}).map(([k, v]) => `${k}: ${v}`).join(" · ") || null} />
          ))}
        </div>
        <div className="text-xs mt-3" data-testid="ag-seo-signup-source-note">
          {data.signup_source_available ? (
            <span className="text-slate-500">Sursă per signup din atribuirea reală (marketing_attributions / conversii).</span>
          ) : (
            <span className="text-amber-500">Sursă indisponibilă pe Preview — <code>marketing_attributions</code> este gol. Audiența este reală (din rol); sursa apare pe Producție unde colecția e populată.</span>
          )}
          {" "}Total signups în perioadă: <b>{data.signups_total ?? 0}</b>.
        </div>
      </Card>

      {/* Search queries (GSC) */}      <Card title="Ce caută oamenii (GSC)" testid="ag-seo-queries">
        {gsc.status === "connected" && (gsc.queries || []).length ? (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-3">Query</th><th className="py-2 pr-3">Clicks</th><th className="py-2 pr-3">Impresii</th><th className="py-2 pr-3">CTR</th><th className="py-2 pr-3">Poziție</th>
              </tr></thead>
              <tbody>
                {gsc.queries.map((q, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50">
                    <td className="py-2 pr-3">{q.query}</td><td className="py-2 pr-3">{q.clicks}</td>
                    <td className="py-2 pr-3">{q.impressions}</td><td className="py-2 pr-3">{pct(q.ctr)}</td>
                    <td className="py-2 pr-3">{(q.position || 0).toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-slate-500 flex items-center gap-2"><Search className="w-4 h-4" /> Fără date GSC (neconectat). Query-urile reale apar după conectarea Search Console.</div>
        )}
      </Card>

      {/* Landing pages that bring organic traffic (internal) + SEO signals */}
      <Card title="Pagini care aduc trafic organic + semnale" testid="ag-seo-landing">
        {(data.signals || []).length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <th className="py-2 pr-3">Pagină</th><th className="py-2 pr-3">Impresii</th><th className="py-2 pr-3">Clicks</th>
                <th className="py-2 pr-3">Sesiuni org.</th><th className="py-2 pr-3">CTA</th><th className="py-2 pr-3">Conversii</th><th className="py-2 pr-3">Semnal</th>
              </tr></thead>
              <tbody>
                {data.signals.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50" data-testid={`ag-seo-signal-${i}`}>
                    <td className="py-2 pr-3 font-mono text-xs">{r.path}</td>
                    <td className="py-2 pr-3">{r.impressions}</td><td className="py-2 pr-3">{r.clicks}</td>
                    <td className="py-2 pr-3">{r.organic_sessions}</td><td className="py-2 pr-3">{r.cta}</td>
                    <td className="py-2 pr-3 font-semibold text-emerald-500">{r.conversions}</td>
                    <td className="py-2 pr-3 text-xs">{r.state}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-sm text-slate-500 flex items-center gap-2"><MousePointerClick className="w-4 h-4" /> Insufficient data — încă nu există sesiuni organice atribuite unei pagini în această perioadă.</div>
        )}
      </Card>

      {/* Bot / Specialist PROSPECTING — separate from human traffic */}
      {data.prospecting && (
        <Card title="Prospectare specialiști (bot — separat de traficul uman)" testid="ag-seo-prospecting">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <Stat label="Invitații trimise" value={data.prospecting.invitations_sent ?? 0} testid="ag-prosp-inv" />
            <Stat label="Invitații revendicate" value={data.prospecting.invitations_claimed ?? 0} sub="→ signup" testid="ag-prosp-claimed" />
            <Stat label="Parteneri prospectați" value={data.prospecting.partners_prospected ?? 0} testid="ag-prosp-partners" />
            <Stat label="Conturi create" value={data.prospecting.partners_signed ?? 0} testid="ag-prosp-signed" />
            <Stat label="Verificați" value={data.prospecting.partners_verified ?? 0} testid="ag-prosp-verified" />
            <Stat label="Lead-uri generate" value={data.prospecting.leads_generated ?? 0} testid="ag-prosp-leads" />
          </div>
          {(Object.keys(data.prospecting.by_trade || {}).length > 0 || Object.keys(data.prospecting.by_city || {}).length > 0) && (
            <div className="mt-3 grid sm:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-300">
              <div><span className="font-semibold">Pe meserie:</span> {Object.entries(data.prospecting.by_trade || {}).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"}</div>
              <div><span className="font-semibold">Pe oraș:</span> {Object.entries(data.prospecting.by_city || {}).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"}</div>
            </div>
          )}

          {/* Invitations by role + leads by source/stage */}
          <div className="mt-4 grid sm:grid-cols-3 gap-4 text-xs text-slate-600 dark:text-slate-300">
            <div data-testid="ag-prosp-inv-by-role"><span className="font-semibold">Invitații pe rol:</span> {Object.entries(data.prospecting.invitations_by_role || {}).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"}</div>
            <div data-testid="ag-prosp-leads-by-source"><span className="font-semibold">Leads pe sursă:</span> {Object.entries(data.prospecting.leads_by_source || {}).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"}</div>
            <div data-testid="ag-prosp-leads-by-stage"><span className="font-semibold">Leads pe etapă:</span> {Object.entries(data.prospecting.leads_by_stage || {}).map(([k, v]) => `${k}: ${v}`).join(" · ") || "—"}</div>
          </div>

          {/* Economics — pipeline (estimat) vs revenue (realizat) — separate */}
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat label="Pipeline (valoare estimată)" value={ron(data.prospecting.pipeline_estimated_value)} sub="A · estimat, nu venit" testid="ag-prosp-pipeline" />
            <Stat label="Venit efectiv generat" value={ron(data.prospecting.revenue_generated)} sub="B · realizat" testid="ag-prosp-revenue" />
            <Stat label="Cost per invitație" value="Indisponibil" sub={data.prospecting.cost_note} testid="ag-prosp-cost" />
          </div>

          {/* C. Configured revenue model per partner (NOT realized revenue) */}
          {(data.prospecting.revenue_model || []).length > 0 && (
            <div className="mt-4" data-testid="ag-prosp-revenue-model">
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">Model de venit configurat per partener <span className="font-normal text-slate-400">(C · valori din DB, nu venit realizat)</span></div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead><tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                    <th className="py-1.5 pr-3">Partener</th><th className="py-1.5 pr-3">Oraș</th><th className="py-1.5 pr-3">Pachet</th><th className="py-1.5 pr-3">Procent</th><th className="py-1.5 pr-3">Per lead</th><th className="py-1.5 pr-3">Abonament</th>
                  </tr></thead>
                  <tbody>
                    {data.prospecting.revenue_model.map((m, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50">
                        <td className="py-1.5 pr-3">{m.company}</td><td className="py-1.5 pr-3">{m.city}</td><td className="py-1.5 pr-3">{m.package}</td>
                        <td className="py-1.5 pr-3">{m.percent != null ? `${m.percent}%` : "—"}</td>
                        <td className="py-1.5 pr-3">{m.per_lead != null ? ron(m.per_lead) : "—"}</td>
                        <td className="py-1.5 pr-3">{m.monthly_subscription != null ? ron(m.monthly_subscription) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <div className="text-[11px] text-slate-400 mt-2">Boții NU sunt numărați ca trafic organic sau utilizatori umani. Sesiuni web marcate bot: {data.prospecting.web_sessions ?? 0}.</div>
        </Card>
      )}

      <div className="text-[11px] text-slate-400" data-testid="ag-seo-generated">
        Date reale · generat {new Date(data.generated_at).toLocaleString("ro-RO")} {data.cached ? "· din cache" : ""}
      </div>
    </div>
  );
};

export default SeoOrganicTab;
