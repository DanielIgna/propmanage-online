// PropManage - Admin Dashboard (Overview, Analytics, Specialists, Disputes)
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Users, Briefcase, Award, Gavel, AlertTriangle, Activity, TrendingUp,
  ShieldCheck, Scale, ArrowRight, Eye, Settings as SettingsIcon,
} from "lucide-react";
import { SpecialistDetailModal, DisputeResolveModal } from "./AdminModals";
import { AdminAnalytics } from "./AdminAnalytics";
import { API, DashLayout, Stat } from "./DashShared";
import { BottomNav } from "./BottomNav";
import { SettingsPanel } from "./SettingsPanel";

export const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [pending, setPending] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [tab, setTab] = useState("overview");
  const [detailSpecId, setDetailSpecId] = useState(null);
  const [resolveDispute, setResolveDispute] = useState(null);

  const loadAll = () => {
    axios.get(`${API}/admin/stats`).then(r => setStats(r.data)).catch(() => {});
    axios.get(`${API}/admin/specialists/pending`).then(r => setPending(r.data)).catch(() => {});
    axios.get(`${API}/admin/disputes`).then(r => setDisputes(r.data)).catch(() => {});
  };
  useEffect(() => { loadAll(); }, []);

  const openDisputes = disputes.filter(d => d.status === "open");

  const tabs = [
    { id: "overview", label: "Sumar", icon: Activity, badge: 0 },
    { id: "specialists", label: "Specialiști", icon: ShieldCheck, badge: pending.length },
    { id: "disputes", label: "Dispute", icon: Scale, badge: openDisputes.length },
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
                  <button onClick={() => setResolveDispute(d)} className="w-full btn-accent py-2 rounded-lg text-xs font-medium flex items-center justify-center gap-2" data-testid={`resolve-${d.id}`}>
                    <Scale className="w-3 h-3" />Mediere & Rezolvare
                  </button>
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
    </DashLayout>
  );
};

const Row = ({ label, value }) => (
  <div className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
    <span className="text-sm text-stone-400">{label}</span>
    <span className="font-serif text-lg">{value}</span>
  </div>
);
