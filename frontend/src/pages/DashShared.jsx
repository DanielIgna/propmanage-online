// PropManage - Shared Dashboard utilities (Layout, Stats, Notifications)
import React, { useState, useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import axios from "axios";
import { Building2, Home, Wrench, ShieldCheck, Settings, LogOut, Languages, Bell } from "lucide-react";
import { useAuth } from "../auth";
import { useI18n } from "../i18n";
import { AIAssistant } from "./AIAssistant";

export const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// ============= NOTIFICATIONS BELL =============
export const NotificationsBell = () => {
  const [notifs, setNotifs] = useState([]);
  const [open, setOpen] = useState(false);

  const load = () => axios.get(`${API}/notifications`).then(r => setNotifs(r.data)).catch(() => {});
  useEffect(() => {
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);

  const unread = notifs.filter(n => !n.read).length;

  const markRead = async (id) => {
    await axios.post(`${API}/notifications/${id}/read`).catch(() => {});
    load();
  };

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 hover:bg-white/5 rounded-lg" data-testid="notif-bell">
        <Bell className="w-4 h-4 text-stone-400" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#d4ff3a] text-black text-[9px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 glass-strong rounded-2xl border border-white/10 z-40 max-h-[400px] overflow-auto no-scrollbar" data-testid="notif-panel">
            <div className="p-3 border-b border-white/5 sticky top-0 bg-[#0a0a0b]/80 backdrop-blur">
              <div className="text-xs uppercase tracking-wider text-stone-400">Notificări</div>
            </div>
            {notifs.length === 0 ? (
              <div className="p-6 text-center text-xs text-stone-500">Nicio notificare</div>
            ) : (
              <div className="divide-y divide-white/5">
                {notifs.slice(0, 10).map(n => (
                  <div key={n.id} onClick={() => markRead(n.id)}
                    className={`p-3 cursor-pointer hover:bg-white/5 ${!n.read ? "bg-[#d4ff3a]/5" : ""}`}
                    data-testid={`notif-${n.id}`}>
                    <div className="flex items-start gap-2">
                      {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-[#d4ff3a] mt-1.5 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{n.title}</div>
                        <div className="text-[11px] text-stone-400 mt-0.5">{n.message}</div>
                        <div className="text-[9px] text-stone-600 mt-1">
                          {new Date(n.created_at).toLocaleString("ro-RO")}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

// ============= LAYOUT =============
export const DashLayout = ({ children, role, title, bottomNav }) => {
  const { user, logout } = useAuth();
  const { lang, toggle, t } = useI18n();
  const navigate = useNavigate();

  const roleConfig = {
    client: { icon: Home, label: "Client", color: "lime" },
    specialist: { icon: Wrench, label: "Specialist", color: "amber" },
    admin: { icon: ShieldCheck, label: "Admin", color: "cyan" },
    operator: { icon: Settings, label: "Operator", color: "purple" },
  }[role];

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  if (!user) return <div className="min-h-screen flex items-center justify-center text-stone-400">{t("common.loading")}</div>;
  if (user === false) return <Navigate to="/login" replace />;

  // Dual-role: route guard accepts the user when their active_view matches the dashboard role
  const effectiveRole = user.active_view || user.role;
  if (effectiveRole !== role) return <Navigate to={`/${effectiveRole}`} replace />;

  const inClientView = user.role === "specialist" && user.active_view === "client";

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-stone-100">
      <header className="border-b border-white/5 sticky top-0 z-40 bg-[#0a0a0b]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-8 min-w-0">
            <Link to="/" className="flex items-center gap-2 shrink-0" data-testid="dash-logo">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#d4ff3a] to-[#a8e028] flex items-center justify-center">
                <Building2 className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
              </div>
              <span className="font-serif text-lg font-semibold">PropManage</span>
            </Link>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full">
              <roleConfig.icon className="w-3.5 h-3.5 text-[#d4ff3a]" />
              <span className="text-xs uppercase tracking-wider text-stone-300">{roleConfig.label}</span>
            </div>
            {inClientView && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30" data-testid="dual-role-badge">
                Profil activ: Client
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <NotificationsBell />
            <button onClick={toggle} className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 hover:bg-white/5 rounded-full text-xs uppercase tracking-wider" data-testid="dash-lang">
              <Languages className="w-3.5 h-3.5" />{lang.toUpperCase()}
            </button>
            <div className="hidden md:block text-right">
              <div className="text-sm font-medium truncate max-w-[160px]">{user.name}</div>
              <div className="text-[10px] text-stone-500 truncate max-w-[160px]">{user.email}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-stone-600 to-stone-800 flex items-center justify-center font-medium text-sm overflow-hidden">
              {user.avatar ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" /> : (user.name?.[0] || "U")}
            </div>
            <button onClick={handleLogout} className="hidden sm:block p-2 hover:bg-white/5 rounded-lg" data-testid="dash-logout">
              <LogOut className="w-4 h-4 text-stone-400" />
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24">
        {title && <h1 className="font-serif text-3xl sm:text-4xl mb-6 sm:mb-8" data-testid="dash-title">{title}</h1>}
        {children}
      </main>
      {bottomNav}
      <AIAssistant />
    </div>
  );
};

// ============= STAT CARD =============
export const Stat = ({ icon: Icon, label, value, sub, color = "lime", tid }) => (
  <div className="glass-strong rounded-2xl p-6" data-testid={tid}>
    <div className="flex items-center justify-between mb-4">
      <div className={`w-10 h-10 rounded-xl bg-${color}-500/15 border border-${color}-500/30 flex items-center justify-center`}>
        <Icon className={`w-4 h-4 text-${color}-400`} />
      </div>
      {sub && <span className="text-[10px] text-stone-500 uppercase tracking-wider">{sub}</span>}
    </div>
    <div className="font-serif text-3xl mb-1">{value}</div>
    <div className="text-xs text-stone-400">{label}</div>
  </div>
);

// ============= STATUS BADGE =============
export const StatusBadge = ({ status }) => {
  const cfg = {
    open: { c: "blue", l: "Deschis" },
    assigned: { c: "amber", l: "Asignat" },
    in_progress: { c: "yellow", l: "În lucru" },
    completed: { c: "purple", l: "Finalizat" },
    confirmed: { c: "emerald", l: "Confirmat" },
  }[status] || { c: "stone", l: status };
  return <span className={`text-[10px] uppercase tracking-wider px-2 py-1 rounded-full bg-${cfg.c}-500/15 text-${cfg.c}-400 border border-${cfg.c}-500/20`}>{cfg.l}</span>;
};
