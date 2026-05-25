// PropManage - Operator Dashboard (Digital Twin validation + maintenance logs)
import React, { useState, useEffect } from "react";
import axios from "axios";
import { Building, Clock, AlertTriangle, FileCheck, Wrench, ArrowRight } from "lucide-react";
import { TwinEditorModal, TWIN_STATUS_LABELS } from "./OperatorTwin";
import { API, DashLayout, Stat } from "./DashShared";

export const OperatorDashboard = () => {
  const [queue, setQueue] = useState([]);
  const [twins, setTwins] = useState([]);
  const [tab, setTab] = useState("twins");
  const [editingTwin, setEditingTwin] = useState(null);

  const load = () => {
    axios.get(`${API}/operator/queue`).then(r => setQueue(r.data)).catch(() => {});
    axios.get(`${API}/operator/twins`).then(r => setTwins(r.data)).catch(() => {});
  };
  useEffect(() => { load(); }, []);

  const pendingTwins = twins.filter(t => t.status === "pending_validation");
  const approvedTwins = twins.filter(t => t.status === "approved");
  const revisionTwins = twins.filter(t => t.status === "needs_revision");

  const TabBtn = ({ id, label, count, icon: Ic }) => (
    <button onClick={() => setTab(id)} className={`flex items-center gap-2 px-4 py-2.5 rounded-full text-sm transition ${tab === id ? "bg-[#d4ff3a] text-black font-medium" : "bg-white/5 hover:bg-white/10 text-stone-300"}`} data-testid={`op-tab-${id}`}>
      <Ic className="w-3.5 h-3.5" />{label}
      {count > 0 && <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${tab === id ? "bg-black/20 text-black" : "bg-[#d4ff3a]/20 text-[#d4ff3a]"}`}>{count}</span>}
    </button>
  );

  return (
    <DashLayout role="operator" title="Validare Digital Twin & Mentenanță">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Stat icon={Building} label="Twins activi" value={approvedTwins.length} sub="Aprobate" color="emerald" tid="op-approved" />
        <Stat icon={Clock} label="În validare" value={pendingTwins.length} sub="Acțiune" color="amber" tid="op-pending-twins" />
        <Stat icon={AlertTriangle} label="Revizie cerută" value={revisionTwins.length} sub="Așteptare client" color="red" tid="op-revision" />
        <Stat icon={FileCheck} label="Logs mentenanță" value={queue.length} sub="În coadă" tid="op-logs" />
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar">
        <TabBtn id="twins" label="Digital Twins" count={pendingTwins.length} icon={Building} />
        <TabBtn id="logs" label="Logs mentenanță" count={queue.length} icon={FileCheck} />
      </div>

      {tab === "twins" && (
        <div className="space-y-4">
          <div className="glass-strong rounded-3xl p-6">
            <h3 className="font-serif text-xl mb-4 flex items-center gap-2"><Clock className="w-4 h-4 text-amber-400" />Twins în validare ({pendingTwins.length})</h3>
            {pendingTwins.length === 0 && <div className="text-xs text-stone-500 text-center py-8" data-testid="no-pending-twins">Niciun twin în așteptare</div>}
            <div className="grid sm:grid-cols-2 gap-3">
              {pendingTwins.map(t => <TwinCard key={t.id} t={t} onOpen={() => setEditingTwin(t.property_id)} />)}
            </div>
          </div>

          {(approvedTwins.length > 0 || revisionTwins.length > 0) && (
            <div className="glass-strong rounded-3xl p-6">
              <h3 className="font-serif text-xl mb-4">Istoric ({approvedTwins.length + revisionTwins.length})</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                {[...approvedTwins, ...revisionTwins].slice(0, 10).map(t => <TwinCard key={t.id} t={t} onOpen={() => setEditingTwin(t.property_id)} />)}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "logs" && (
        <div className="glass-strong rounded-3xl p-8 text-center">
          <Wrench className="w-12 h-12 text-stone-600 mx-auto mb-4" />
          <h3 className="font-serif text-2xl mb-2">Coadă logs mentenanță</h3>
          <p className="text-sm text-stone-400 max-w-md mx-auto">
            {queue.length === 0
              ? "Toate log-urile de mentenanță au fost validate. Noile log-uri vor apărea aici când specialiștii completează lucrări."
              : `${queue.length} log-uri în așteptare.`}
          </p>
        </div>
      )}

      {editingTwin && <TwinEditorModal propertyId={editingTwin} onClose={() => setEditingTwin(null)} onSaved={load} />}
    </DashLayout>
  );
};

const TwinCard = ({ t, onOpen }) => {
  const statusInfo = TWIN_STATUS_LABELS[t.status] || TWIN_STATUS_LABELS.draft;
  return (
    <button onClick={onOpen} className="text-left bg-white/5 hover:bg-white/10 rounded-2xl p-4 transition border border-white/5" data-testid={`twin-card-${t.id || t.property_id}`}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{t.property_name || "Proprietate"}</div>
          <div className="text-[10px] text-stone-500 truncate">{t.property_address || "—"}</div>
        </div>
        <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full whitespace-nowrap ${statusInfo.color}`}>{statusInfo.label}</span>
      </div>
      <div className="text-[10px] text-stone-500 mb-3">
        Proprietar: {t.owner_name || "—"}
      </div>
      <div className="grid grid-cols-3 gap-2 text-xs">
        <Pill label="Camere" value={(t.rooms || []).length} />
        <Pill label="Asset-uri" value={(t.assets || []).length} />
        <Pill label="Suprafață" value={t.property_surface ? `${t.property_surface}m²` : "—"} />
      </div>
      <div className="mt-3 text-[11px] text-[#d4ff3a] flex items-center gap-1">
        Deschide editor <ArrowRight className="w-3 h-3" />
      </div>
    </button>
  );
};

const Pill = ({ label, value }) => (
  <div className="bg-black/30 rounded-lg p-2 text-center">
    <div className="text-[9px] uppercase tracking-wider text-stone-500">{label}</div>
    <div className="font-serif text-sm">{value}</div>
  </div>
);
