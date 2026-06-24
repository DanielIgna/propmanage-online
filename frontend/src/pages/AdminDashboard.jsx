// PropManage - Admin Dashboard (Overview, Analytics, Specialists, Disputes)
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Users, Briefcase, Award, Gavel, AlertTriangle, Activity, TrendingUp,
  ShieldCheck, Scale, ArrowRight, Eye, Settings as SettingsIcon, Flag, Clock,
} from "lucide-react";
import { SpecialistDetailModal, DisputeResolveModal } from "./AdminModals";
import { AdminAnalytics } from "./AdminAnalytics";
import { API, DashLayout, Stat } from "./DashShared";
import { BottomNav } from "./BottomNav";
import { SettingsPanel } from "./SettingsPanel";
import { RequestTimelineModal } from "./ActivityTimeline";
import { AutopilotWidget } from "./AutopilotWidget";

export const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [nonconformities, setNonconformities] = useState([]);
  const [activity, setActivity] = useState([]);
  const [tab, setTab] = useState("overview");
  const [detailSpecId, setDetailSpecId] = useState(null);
  const [resolveDispute, setResolveDispute] = useState(null);
  const [resolveNC, setResolveNC] = useState(null);
  const [timelineRequestId, setTimelineRequestId] = useState(null);

  const loadAll = () => {
    axios.get(`${API}/admin/stats`).then(r => setStats(r.data)).catch(() => {});
    axios.get(`${API}/admin/specialists/pending`).then(r => setPending(r.data)).catch(() => {});
    axios.get(`${API}/admin/disputes`).then(r => setDisputes(r.data)).catch(() => {});
    axios.get(`${API}/admin/nonconformities`).then(r => setNonconformities(r.data)).catch(() => {});
    axios.get(`${API}/admin/activity-stream?limit=30`).then(r => setActivity(r.data)).catch(() => {});
  };
  useEffect(() => {
    loadAll();
    const interval = setInterval(() => {
      axios.get(`${API}/admin/activity-stream?limit=30`).then(r => setActivity(r.data)).catch(() => {});
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const openDisputes = disputes.filter(d => d.status === "open");
  const openNC = nonconformities.filter(n => n.status === "open");

  const tabs = [
    { id: "overview", label: "Sumar", icon: Activity, badge: 0 },
    { id: "specialists", label: "Specialiști", icon: ShieldCheck, badge: pending.length },
    { id: "disputes", label: "Dispute", icon: Scale, badge: openDisputes.length + openNC.length },
    { id: "settings", label: "Setări", icon: SettingsIcon, badge: 0 },
  ];

  const title = {
    overview: "Panou de Control",
    specialists: "Coadă verificare",
    disputes: "Dispute & Mediere",
    settings: "Setări",
  }[tab];

  return (
    <DashLayout role="admin" title={title} bottomNav={<BottomNav tabs={tabs} active={tab} onChange={setTab} dataPrefix="admin-tab" />}>
      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <Stat icon={Users} label="Utilizatori" value={stats?.users || 0} sub="Total" tid="admin-users" />
            <Stat icon={Briefcase} label="Joburi active" value={stats?.active_jobs || 0} sub="Live" color="amber" tid="admin-jobs" />
            <Stat icon={Award} label="Verificați" value={stats?.verified || 0} sub={`/ ${stats?.specialists || 0}`} color="emerald" tid="admin-verified" />
            <Stat icon={Gavel} label="În așteptare" value={stats?.pending_verification || 0} sub="Specialiști" color="cyan" tid="admin-pending" />
            <Stat icon={AlertTriangle} label="Dispute" value={openDisputes.length} sub="Deschise" color="red" tid="admin-disputes-stat" />
          </div>
          <AdminAnalytics />
          <AutopilotWidget />
          {/* Live Activity Stream */}
          <div className="glass-strong rounded-3xl p-6 mt-6" data-testid="activity-stream">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-serif text-xl flex items-center gap-2"><Activity className="w-4 h-4 text-[#d4ff3a]" />Flux Activitate</h3>
              <span className="text-[10px] uppercase tracking-wider text-stone-500">Live · ultimele 30 evenimente</span>
            </div>
            {activity.length === 0 ? (
              <div className="text-xs text-stone-500 text-center py-6">Niciun eveniment înregistrat încă</div>
            ) : (
              <div className="space-y-1.5 max-h-96 overflow-y-auto no-scrollbar">
                {activity.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => e.request_id && setTimelineRequestId(e.request_id)}
                    className="w-full text-left flex items-center gap-3 bg-white/5 hover:bg-white/10 rounded-xl p-3 transition group"
                    data-testid={`activity-${e.id}`}
                  >
                    <RoleBadge role={e.actor_role} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-stone-200">{e.actor_name}</span>
                        <span className="text-stone-500">→</span>
                        <span className="text-[#d4ff3a]">{e.event_type.replace(/[._]/g, " ")}</span>
                      </div>
                      <div className="text-[10px] text-stone-500 mt-0.5">{new Date(e.created_at).toLocaleString("ro-RO")}</div>
                    </div>
                    {e.request_id && <ArrowRight className="w-3.5 h-3.5 text-stone-600 group-hover:text-stone-300" />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="grid lg:grid-cols-2 gap-6 mt-6">
            <div className="glass-strong rounded-3xl p-6">
              <h3 className="font-serif text-xl mb-4">Activitate platformă</h3>
              <div className="space-y-3">
                <Row label="Joburi finalizate" value={stats?.completed_jobs || 0} />
                <Row label="Specialiști total" value={stats?.specialists || 0} />
                <Row label="Specialiști verificați" value={stats?.verified || 0} />
                <Row label="Dispute deschise" value={openDisputes.length} />
                <Row label="Dispute rezolvate" value={disputes.length - openDisputes.length} />
              </div>
            </div>
            <div className="glass-strong rounded-3xl p-6">
              <h3 className="font-serif text-xl mb-4">Acțiuni rapide</h3>
              <div className="space-y-2">
                <button onClick={() => setTab("specialists")} className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-xl p-4 text-left transition" data-testid="quick-verify">
                  <div>
                    <div className="text-sm font-medium">Verifică specialiști</div>
                    <div className="text-[11px] text-stone-400">{pending.length} în așteptare</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-stone-400" />
                </button>
                <button onClick={() => setTab("disputes")} className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 rounded-xl p-4 text-left transition" data-testid="quick-disputes">
                  <div>
                    <div className="text-sm font-medium">Mediere dispute</div>
                    <div className="text-[11px] text-stone-400">{openDisputes.length} de analizat</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-stone-400" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "specialists" && (
        <div className="glass-strong rounded-3xl p-6">
          <h3 className="font-serif text-xl mb-4">Coadă verificare specialiști</h3>
          {pending.length === 0 && <div className="text-xs text-stone-500 text-center py-8" data-testid="admin-empty">Niciun specialist în așteptare</div>}
          <div className="space-y-2">
            {pending.map(p => (
              <div key={p.id} className="flex items-center justify-between bg-white/5 rounded-xl p-4" data-testid={`pending-${p.id}`}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-stone-600 to-stone-800 flex items-center justify-center font-medium">{p.name?.[0]}</div>
                  <div>
                    <div className="font-medium text-sm">{p.name}</div>
                    <div className="text-[10px] text-stone-500">
                      {p.email} · {p.specialty || "Specialist"} · {(p.documents || []).length} docs
                    </div>
                  </div>
                </div>
                <button onClick={() => setDetailSpecId(p.id)} className="px-4 py-2 bg-white/10 hover:bg-white/15 rounded-full text-xs font-medium flex items-center gap-1" data-testid={`review-spec-${p.id}`}>
                  <Eye className="w-3 h-3" />Analizează
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "disputes" && (
        <div className="space-y-4">
          {/* Operator nonconformities — visible above disputes */}
          {openNC.length > 0 && (
            <div className="glass-strong rounded-3xl p-6">
              <h3 className="font-serif text-xl mb-4 flex items-center gap-2"><Flag className="w-4 h-4 text-orange-400" />Sesizări operator ({openNC.length})</h3>
              <div className="space-y-2">
                {openNC.map(n => (
                  <div key={n.id} className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-4" data-testid={`nc-${n.id}`}>
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            n.severity === "high" ? "bg-red-500/20 text-red-300" :
                            n.severity === "medium" ? "bg-amber-500/20 text-amber-300" :
                            "bg-stone-500/20 text-stone-300"
                          }`}>
                            {n.severity}
                          </span>
                          <span className="text-xs text-stone-300">{n.operator_name}</span>
                          <span className="text-[10px] text-stone-500">· {n.target_type}</span>
                        </div>
                        <div className="text-xs text-stone-300 italic">"{n.reason}"</div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {n.related_request_id && (
                        <button onClick={() => setTimelineRequestId(n.related_request_id)} className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 py-1.5 px-3 rounded-lg text-xs flex items-center gap-1" data-testid={`nc-timeline-${n.id}`}>
                          <Clock className="w-3 h-3" />Timeline
                        </button>
                      )}
                      <button onClick={() => setResolveNC(n)} className="flex-1 btn-accent py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1" data-testid={`nc-resolve-${n.id}`}>
                        <Scale className="w-3 h-3" />Rezolvă
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="glass-strong rounded-3xl p-6">
            <h3 className="font-serif text-xl mb-4 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-400" />Dispute deschise ({openDisputes.length})</h3>
            {openDisputes.length === 0 && <div className="text-xs text-stone-500 text-center py-8" data-testid="no-open-disputes">Nicio dispută deschisă</div>}
            <div className="space-y-2">
              {openDisputes.map(d => (
                <div key={d.id} className="bg-white/5 rounded-xl p-4" data-testid={`dispute-${d.id}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{d.request_title || "Lucrare necunoscută"}</div>
                      <div className="text-[10px] text-stone-500 mt-0.5">
                        Deschis de {d.opened_by_role} · Client: {d.client_name || "—"} · Specialist: {d.specialist_name || "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] text-stone-500">Escrow</div>
                      <div className="font-serif text-base text-amber-300">{(d.escrow_amount || 0).toFixed(0)} RON</div>
                    </div>
                  </div>
                  <div className="text-xs text-stone-300 italic mb-3 line-clamp-2">"{d.reason}"</div>
                  <div className="flex gap-2">
                    <button onClick={() => setTimelineRequestId(d.request_id)} className="bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 py-2 px-3 rounded-lg text-xs flex items-center gap-1" data-testid={`dispute-timeline-${d.id}`}>
                      <Clock className="w-3 h-3" />Timeline
                    </button>
                    <button onClick={() => setResolveDispute(d)} className="flex-1 btn-accent py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2" data-testid={`resolve-${d.id}`}>
                      <Scale className="w-3 h-3" />Mediere & Rezolvare
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {disputes.length - openDisputes.length > 0 && (
            <div className="glass-strong rounded-3xl p-6">
              <h3 className="font-serif text-xl mb-4">Istoric rezolvate ({disputes.length - openDisputes.length})</h3>
              <div className="space-y-2">
                {disputes.filter(d => d.status === "resolved").slice(0, 10).map(d => (
                  <div key={d.id} className="bg-white/5 rounded-xl p-3 text-xs flex items-center justify-between" data-testid={`resolved-${d.id}`}>
                    <div className="min-w-0">
                      <div className="font-medium text-sm truncate">{d.request_title}</div>
                      <div className="text-[10px] text-stone-500">{d.resolution} · Client: {(d.client_amount || 0).toFixed(0)} RON, Specialist: {(d.specialist_amount || 0).toFixed(0)} RON</div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-1 bg-emerald-500/15 text-emerald-400 rounded-full">Rezolvată</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "settings" && <SettingsPanel />}

      {detailSpecId && (
        <SpecialistDetailModal specialistId={detailSpecId} onClose={() => setDetailSpecId(null)} onChange={loadAll} />
      )}
      {resolveDispute && (
        <DisputeResolveModal dispute={resolveDispute} onClose={() => setResolveDispute(null)} onResolved={loadAll} />
      )}
      {resolveNC && <NCResolveModal nc={resolveNC} onClose={() => setResolveNC(null)} onResolved={loadAll} />}
      {timelineRequestId && <RequestTimelineModal requestId={timelineRequestId} onClose={() => setTimelineRequestId(null)} />}
    </DashLayout>
  );
};

// ============= NONCONFORMITY RESOLVE MODAL =============
const NCResolveModal = ({ nc, onClose, onResolved }) => {
  const [resolution, setResolution] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/admin/nonconformities/${nc.id}/resolve`, { resolution });
      onResolved?.();
      onClose();
    } catch (err) {
      alert(err.response?.data?.detail || "Eroare.");
    } finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="glass-strong rounded-3xl p-6 max-w-md w-full" data-testid="nc-resolve-modal">
        <h2 className="font-serif text-2xl mb-4">Rezolvă sesizare</h2>
        <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-3 mb-4 text-xs">
          <div className="text-orange-300 font-medium mb-1">{nc.operator_name} ({nc.severity}):</div>
          <div className="text-stone-300 italic">"{nc.reason}"</div>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label className="text-[10px] uppercase tracking-wider text-stone-500 block">Rezoluție</label>
          <textarea required minLength={3} rows={5} value={resolution} onChange={e => setResolution(e.target.value)}
            placeholder="Descrie acțiunea luată: ai contactat utilizatorii, ai cerut documente, ai suspendat contul etc."
            className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm resize-none"
            data-testid="nc-resolution" />
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-white/5 rounded-xl text-sm">Anulează</button>
            <button type="submit" disabled={loading} className="flex-1 btn-accent py-3 rounded-xl text-sm font-medium" data-testid="nc-resolve-submit">
              {loading ? "..." : "Marchează rezolvată"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ============= Role badge for activity stream =============
const RoleBadge = ({ role }) => {
  const map = {
    client: { c: "bg-cyan-500/20 text-cyan-300", l: "CL" },
    specialist: { c: "bg-amber-500/20 text-amber-300", l: "SP" },
    admin: { c: "bg-purple-500/20 text-purple-300", l: "AD" },
    operator: { c: "bg-fuchsia-500/20 text-fuchsia-300", l: "OP" },
    system: { c: "bg-stone-500/20 text-stone-300", l: "SY" },
  };
  const cfg = map[role] || map.system;
  return <span className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center font-mono text-[10px] font-bold ${cfg.c}`}>{cfg.l}</span>;
};

const Row = ({ label, value }) => (
  <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
    <span className="text-sm text-stone-400">{label}</span>
    <span className="font-serif text-lg">{value}</span>
  </div>
);
