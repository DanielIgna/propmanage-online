// PropManage - Operator Dashboard (Digital Twin validation + maintenance logs)
// 4-zone bottom navigation: Twins | Logs | Notificări | Setări
import React, { useState, useEffect } from "react";
import axios from "axios";
import {
  Building, Clock, AlertTriangle, FileCheck, Wrench, ArrowRight,
  Bell, Settings as SettingsIcon,
} from "lucide-react";
import { TwinEditorModal, TWIN_STATUS_LABELS } from "./OperatorTwin";
import { API, DashLayout, Stat } from "./DashShared";
import { BottomNav } from "./BottomNav";
import { SettingsPanel } from "./SettingsPanel";

export const OperatorDashboard = () => {
  const [queue, setQueue] = useState([]);
  const [twins, setTwins] = useState([]);
  const [notifs, setNotifs] = useState([]);
  const [tab, setTab] = useState("twins");
  const [editingTwin, setEditingTwin] = useState(null);

  const load = () => {
    axios.get(`${API}/operator/queue`).then(r => setQueue(r.data)).catch(() => {});
    axios.get(`${API}/operator/twins`).then(r => setTwins(r.data)).catch(() => {});
  };
  const loadNotifs = () => axios.get(`${API}/notifications`).then(r => setNotifs(r.data)).catch(() => {});

  useEffect(() => {
    load();
    loadNotifs();
    const interval = setInterval(loadNotifs, 30000);
    return () => clearInterval(interval);
  }, []);

  const pendingTwins = twins.filter(t => t.status === "pending_validation");
  const approvedTwins = twins.filter(t => t.status === "approved");
  const revisionTwins = twins.filter(t => t.status === "needs_revision");
  const unreadNotifs = notifs.filter(n => !n.read).length;

  const tabs = [
    { id: "twins", label: "Digital Twins", icon: Building, badge: pendingTwins.length },
    { id: "logs", label: "Logs", icon: FileCheck, badge: queue.length },
    { id: "notifications", label: "Notificări", icon: Bell, badge: unreadNotifs },
    { id: "settings", label: "Setări", icon: SettingsIcon, badge: 0 },
  ];

  const title = {
    twins: "Validare Digital Twin",
    logs: "Logs Mentenanță",
    notifications: "Notificări",
    settings: "Setări",
  }[tab];

  return (
    <DashLayout role="operator" title={title} bottomNav={<BottomNav tabs={tabs} active={tab} onChange={setTab} dataPrefix="op-tab" />}>
      {tab === "twins" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Stat icon={Building} label="Twins activi" value={approvedTwins.length} sub="Aprobate" color="emerald" tid="op-approved" />
            <Stat icon={Clock} label="În validare" value={pendingTwins.length} sub="Acțiune" color="amber" tid="op-pending-twins" />
            <Stat icon={AlertTriangle} label="Revizie cerută" value={revisionTwins.length} sub="Așteptare client" color="red" tid="op-revision" />
            <Stat icon={FileCheck} label="Logs mentenanță" value={queue.length} sub="În coadă" tid="op-logs" />
          </div>
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
        </>
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

      {tab === "notifications" && (
        <div className="space-y-2 max-w-2xl mx-auto" data-testid="notifications-zone">
          {notifs.length === 0 && (
            <div className="text-center py-16">
              <Bell className="w-12 h-12 text-stone-700 mx-auto mb-3" />
              <div className="text-sm text-stone-400">Nicio notificare</div>
            </div>
          )}
          {notifs.map(n => (
            <button
              key={n.id}
              onClick={async () => { await axios.post(`${API}/notifications/${n.id}/read`).catch(() => {}); loadNotifs(); }}
              className={`w-full text-left bg-white/5 rounded-2xl p-4 hover:bg-white/[0.08] transition-colors ${!n.read ? "border border-[#d4ff3a]/30" : ""}`}
              data-testid={`notif-${n.id}`}
            >
              <div className="flex items-start gap-3">
                {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-[#d4ff3a] mt-2 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{n.title}</div>
                  <div className="text-xs text-stone-400 mt-1">{n.message}</div>
                  <div className="text-[10px] text-stone-600 mt-2">{new Date(n.created_at).toLocaleString("ro-RO")}</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {tab === "settings" && <SettingsPanel />}

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
