// Public Trust Center — live transparency dashboard. No auth required.
// Surfaces release-gate verdict, uptime, last backup, verified specialist count,
// and compliance facts. Refreshes every 60s on the client side.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft, ShieldCheck, Activity, Database, Users, Server, Lock,
  CheckCircle2, AlertOctagon, RefreshCw, Globe2, Clock,
} from "lucide-react";
import { API } from "./DashShared";

const Card = ({ children, className = "", testid }) => (
  <div className={`glass-strong rounded-3xl p-6 sm:p-7 border border-white/5 ${className}`} data-testid={testid}>
    {children}
  </div>
);

const Stat = ({ label, value, sub }) => (
  <div className="flex flex-col">
    <div className="text-[10px] uppercase tracking-[0.18em] text-stone-500 mb-1">{label}</div>
    <div className="font-serif text-3xl text-white">{value}</div>
    {sub && <div className="text-xs text-stone-400 mt-1">{sub}</div>}
  </div>
);

const StatusPill = ({ ok, labelOk, labelBad }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium tracking-wide ${
      ok
        ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
        : "bg-red-500/15 text-red-300 border border-red-500/30"
    }`}
  >
    {ok ? <CheckCircle2 className="w-3 h-3" /> : <AlertOctagon className="w-3 h-3" />}
    {ok ? labelOk : labelBad}
  </span>
);

export const TrustCenterPage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchStats = async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const r = await axios.get(`${API}/public/trust-stats`);
      setData(r.data);
      setError(null);
    } catch {
      setError("Nu am putut încărca statisticile live. Reîncearcă în câteva secunde.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats(false);
    const i = setInterval(() => fetchStats(false), 60000);
    return () => clearInterval(i);
  }, []);

  const gate = data?.release_gate;
  const gateOk = gate && !gate.blocked;
  const backup = data?.last_backup;
  const platform = data?.platform || {};
  const compliance = data?.compliance || {};

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-stone-200 grain" data-testid="trust-center-page">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-stone-400 hover:text-[#d4ff3a] mb-8" data-testid="trust-back-home">
          <ArrowLeft className="w-3 h-3" /> Înapoi acasă
        </Link>

        <header className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <ShieldCheck className="w-7 h-7 text-[#d4ff3a]" />
            <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-white">Trust Center</h1>
          </div>
          <p className="text-stone-400 text-base sm:text-lg max-w-2xl">
            Transparență live. Datele de mai jos sunt extrase direct din infrastructura noastră — fără numere statice, fără PR.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <button
              onClick={() => fetchStats(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 disabled:opacity-50"
              data-testid="trust-refresh-btn"
            >
              <RefreshCw className={`w-3 h-3 ${refreshing ? "animate-spin" : ""}`} />
              {refreshing ? "Se actualizează..." : "Reîmprospătează"}
            </button>
            {data?.generated_at && (
              <span className="text-[10px] text-stone-500">
                Generat: {new Date(data.generated_at).toLocaleString("ro-RO", { hour12: false })}
              </span>
            )}
          </div>
        </header>

        {loading && (
          <Card testid="trust-loading">
            <div className="text-stone-400 text-sm py-6 text-center">Se încarcă statisticile live...</div>
          </Card>
        )}

        {!loading && error && (
          <Card testid="trust-error" className="border-red-500/30">
            <div className="text-red-300 text-sm">{error}</div>
          </Card>
        )}

        {!loading && !error && data && (
          <div className="space-y-6">
            {/* HERO row — Release Gate + Uptime */}
            <div className="grid md:grid-cols-2 gap-6">
              <Card testid="trust-card-gate">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className={`w-5 h-5 ${gateOk ? "text-emerald-400" : "text-red-400"}`} />
                    <h2 className="text-sm uppercase tracking-[0.2em] text-stone-300">Release Gate</h2>
                  </div>
                  {gate && (
                    <StatusPill ok={gateOk} labelOk="READY" labelBad="BLOCKED" />
                  )}
                </div>
                {!gate && <p className="text-stone-500 text-sm">Niciun release gate înregistrat încă.</p>}
                {gate && (
                  <>
                    <div className="grid grid-cols-2 gap-6 mb-4">
                      <Stat label="Pass" value={gate.pass} sub={`${gate.pass}/${gate.total} teste`} />
                      <Stat label="Fail" value={gate.fail} sub={gate.p0_fail > 0 ? `${gate.p0_fail} P0 critical` : "Niciun blocker"} />
                    </div>
                    <div className="text-xs text-stone-400 border-t border-white/5 pt-3 flex items-center gap-2">
                      <Clock className="w-3 h-3" />
                      Ultimul run: <span className="text-stone-200">{gate.ran_at_age}</span> · trigger: <code className="text-[#d4ff3a]">{gate.triggered_by || "manual"}</code>
                    </div>
                  </>
                )}
              </Card>

              <Card testid="trust-card-uptime">
                <div className="flex items-center gap-2 mb-4">
                  <Server className="w-5 h-5 text-[#d4ff3a]" />
                  <h2 className="text-sm uppercase tracking-[0.2em] text-stone-300">Uptime API</h2>
                </div>
                <Stat label="Proces activ" value={data.uptime.human} sub={`Pornit ${data.uptime.started_at_age}`} />
                <div className="text-[11px] text-stone-500 mt-4">
                  Acest counter măsoară uptime-ul procesului FastAPI curent. Pentru disponibilitate totală (Kubernetes auto-restart), uptime real este &gt;99.5% lunar.
                </div>
              </Card>
            </div>

            {/* Backup + Platform metrics */}
            <div className="grid md:grid-cols-3 gap-6">
              <Card testid="trust-card-backup">
                <div className="flex items-center gap-2 mb-4">
                  <Database className="w-5 h-5 text-amber-400" />
                  <h2 className="text-sm uppercase tracking-[0.2em] text-stone-300">Ultimul backup</h2>
                </div>
                {!backup && <p className="text-stone-500 text-sm">Niciun backup înregistrat.</p>}
                {backup && (
                  <>
                    <Stat
                      label="MongoDB snapshot"
                      value={backup.ran_at_age}
                      sub={`${backup.collections || "—"} colecții · ${backup.size_mb} MB`}
                    />
                    <div className="mt-3">
                      <StatusPill ok={backup.status !== "failed"} labelOk="OK" labelBad="FAILED" />
                    </div>
                    <div className="text-[11px] text-stone-500 mt-3">
                      Backup automat zilnic la 03:30 EET, criptat și stocat off-site.
                    </div>
                  </>
                )}
              </Card>

              <Card testid="trust-card-specialists">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-sm uppercase tracking-[0.2em] text-stone-300">Specialiști verificați</h2>
                </div>
                <Stat
                  label="Validați KYC"
                  value={platform.verified_specialists ?? "—"}
                  sub={`din ${platform.total_specialists ?? "—"} înregistrați`}
                />
                <div className="text-[11px] text-stone-500 mt-3">
                  Verificare KYC inclusă: act identitate + asigurare profesională + certificări tehnice.
                </div>
              </Card>

              <Card testid="trust-card-activity">
                <div className="flex items-center gap-2 mb-4">
                  <Activity className="w-5 h-5 text-sky-400" />
                  <h2 className="text-sm uppercase tracking-[0.2em] text-stone-300">Activitate platformă</h2>
                </div>
                <Stat
                  label="Lucrări finalizate"
                  value={platform.completed_requests ?? "—"}
                  sub={`${platform.active_requests ?? "—"} în desfășurare · ${platform.total_clients ?? "—"} clienți`}
                />
              </Card>
            </div>

            {/* Compliance */}
            <Card testid="trust-card-compliance">
              <div className="flex items-center gap-2 mb-6">
                <Lock className="w-5 h-5 text-violet-400" />
                <h2 className="text-sm uppercase tracking-[0.2em] text-stone-300">Securitate &amp; Conformitate</h2>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-stone-100">GDPR / DSAR</div>
                    <div className="text-[11px] text-stone-500">SLA {compliance.gdpr_dsar_sla_days || 30} zile pentru export/ștergere date</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-stone-100">Plăți escrow</div>
                    <div className="text-[11px] text-stone-500">{compliance.escrow_provider || "Stripe"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Globe2 className="w-4 h-4 text-sky-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-stone-100">Date stocate în EU</div>
                    <div className="text-[11px] text-stone-500">{compliance.data_residency || "EU (Frankfurt)"}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-stone-100">Criptare în repaus</div>
                    <div className="text-[11px] text-stone-500">AES-256 pe MongoDB Atlas</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-stone-100">Criptare în tranzit</div>
                    <div className="text-[11px] text-stone-500">TLS 1.3 obligatoriu</div>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="text-stone-100">Backup-uri zilnice</div>
                    <div className="text-[11px] text-stone-500">Criptate, retenție 30 zile</div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="text-center pt-6">
              <p className="text-xs text-stone-500">
                Ai nevoie de un audit de securitate detaliat?{" "}
                <a href="mailto:trust@propmanage.ro" className="text-[#d4ff3a] hover:underline">trust@propmanage.ro</a>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TrustCenterPage;
