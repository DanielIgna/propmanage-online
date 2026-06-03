// Metronic-style admin shell: light sidebar + topbar with search/notifications/theme toggle.
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  LayoutDashboard, Users, ShieldCheck, Scale, Wallet, FolderKanban,
  FileText, Mail, MapPin, Award, Settings, Search, Bell, Sun, Moon,
  LogOut, Menu, X, ChevronLeft, Building2, ChevronDown, Sparkles, Bot, Zap, Inbox,
  UserCheck, Home, Wrench, Briefcase, Code2, Shield
} from "lucide-react";
import { useAuth } from "../../auth";
import { API } from "../DashShared";
import { HealthScoreBadge } from "./HealthScoreBadge";
import { AIAdminTour, ReplayAIAdminTourButton } from "./AIAdminTour";

const NAV_SECTIONS = [
  {
    title: "OVERVIEW",
    items: [
      { id: "overview", label: "Dashboard", icon: LayoutDashboard },
      { id: "ai", label: "AI Investigator", icon: Bot, badge: "NEW" },
      { id: "concierge", label: "Concierge & Security", icon: ShieldCheck, badge: "NEW" },
      { id: "demo", label: "Demo Tools", icon: Zap, badge: "NEW" },
      { id: "leads", label: "Demo Leads", icon: Inbox, badge: "NEW" },
      { id: "activity", label: "Activitate Live", icon: Sparkles },
    ],
  },
  {
    title: "USERI",
    items: [
      { id: "users", label: "Toți userii", icon: Users },
      { id: "verification", label: "Verificare specialiști", icon: ShieldCheck },
      { id: "beta_testers", label: "Beta Testers", icon: Sparkles, badge: "NEW" },
    ],
  },
  {
    title: "OPERATIONS",
    items: [
      { id: "projects", label: "Proiecte", icon: FolderKanban },
      { id: "disputes", label: "Dispute & NC", icon: Scale },
      { id: "finance", label: "Finanțe & Escrow", icon: Wallet },
    ],
  },
  {
    title: "CONȚINUT",
    items: [
      { id: "cms", label: "Texte (CMS)", icon: FileText },
      { id: "emails", label: "Template-uri Email", icon: Mail },
      { id: "zones", label: "Zone Acoperire", icon: MapPin },
    ],
  },
  {
    title: "CONFIGURARE",
    items: [
      { id: "abtests", label: "A/B Tests", icon: Sparkles },
      { id: "trust", label: "Trust Score Weights", icon: Award },
      { id: "audit", label: "Audit Log", icon: FileText },
      { id: "settings", label: "Setări Platformă", icon: Settings },
      { id: "settings_control", label: "Control Administrare", icon: Settings, badge: "NEW", href: "/admin/settings-control" },
      { id: "ve_admin", label: "Imobile Verificate", icon: Award, badge: "NEW", href: "/admin/imobile-verificate" },
      { id: "docs_train", label: "Documentație & Training", icon: FileText, badge: "NEW", href: "/admin/documentation" },
      { id: "qa_copilot", label: "QA Copilot · AI Testing", icon: Sparkles, badge: "NEW", href: "/admin/qa-copilot" },
      { id: "ai_control", label: "AI Control Center", icon: Sparkles, badge: "NEW", href: "/admin/ai-control" },
      { id: "ai_docs", label: "Document Intelligence", icon: FileText, badge: "NEW", href: "/ai-docs" },
      { id: "ai_dev_team", label: "AI Development Team", icon: Code2, badge: "NEW", href: "/admin/ai-dev-team" },
      { id: "ai_security", label: "AI Security Center", icon: Shield, badge: "NEW", href: "/admin/ai-security" },
    ],
  },
  {
    title: "COMPLIANCE",
    items: [
      { id: "gdpr", label: "GDPR Pack", icon: ShieldCheck, badge: "NEW" },
      { id: "impersonation", label: "Impersonări", icon: ShieldCheck, badge: "NEW" },
    ],
  },
  {
    title: "TRAINING",
    items: [
      { id: "docs", label: "Documentație & Training", icon: FileText, badge: "NEW" },
      { id: "qa_playbook", label: "QA Playbook", icon: ShieldCheck, badge: "NEW" },
    ],
  },
];

export const useAdminTheme = () => {
  const [theme, setTheme] = useState(() => localStorage.getItem("pm_admin_theme") || "light");
  useEffect(() => {
    document.documentElement.setAttribute("data-admin-theme", theme);
    localStorage.setItem("pm_admin_theme", theme);
  }, [theme]);
  return [theme, () => setTheme(t => t === "light" ? "dark" : "light")];
};

const GlobalSearch = ({ theme }) => {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef(null);

  useEffect(() => {
    if (!q || q.length < 2) {
      setResults(null);
      return;
    }
    setLoading(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      axios.get(`${API}/admin/search`, { params: { q } })
        .then(r => setResults(r.data))
        .catch(() => setResults({ users: [], requests: [], projects: [] }))
        .finally(() => setLoading(false));
    }, 250);
    return () => timer.current && clearTimeout(timer.current);
  }, [q]);

  const dark = theme === "dark";
  return (
    <div className="relative flex-1 max-w-md">
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${dark ? "bg-slate-800 border-slate-700" : "bg-slate-50 border-slate-200"}`}>
        <Search className={`w-4 h-4 ${dark ? "text-slate-400" : "text-slate-500"}`} />
        <input
          type="text"
          value={q}
          onChange={e => setQ(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Caută user, cerere, proiect..."
          className={`flex-1 bg-transparent text-sm outline-none ${dark ? "text-slate-100 placeholder:text-slate-500" : "text-slate-900 placeholder:text-slate-400"}`}
          data-testid="admin-global-search"
        />
        {q && (
          <button onClick={() => { setQ(""); setOpen(false); }}>
            <X className={`w-4 h-4 ${dark ? "text-slate-400" : "text-slate-500"}`} />
          </button>
        )}
      </div>
      {open && results && q.length >= 2 && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className={`absolute top-full left-0 right-0 mt-2 rounded-xl border shadow-xl z-40 max-h-[500px] overflow-y-auto ${dark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`} data-testid="admin-search-results">
            {loading && <div className={`p-4 text-xs ${dark ? "text-slate-400" : "text-slate-500"}`}>Caut...</div>}
            {!loading && (
              <>
                {results.users.length > 0 && <div className={`px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider ${dark ? "text-slate-500" : "text-slate-400"}`}>Useri ({results.users.length})</div>}
                {results.users.map(u => (
                  <div key={u.id} className={`px-3 py-2 text-sm cursor-pointer ${dark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-50 text-slate-700"}`} data-testid={`search-user-${u.id}`}>
                    <div className="flex justify-between"><span className="font-medium">{u.name}</span><span className={`text-[10px] uppercase ${dark ? "text-slate-500" : "text-slate-400"}`}>{u.role}</span></div>
                    <div className={`text-[11px] ${dark ? "text-slate-500" : "text-slate-400"}`}>{u.email}</div>
                  </div>
                ))}
                {results.requests.length > 0 && <div className={`px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider ${dark ? "text-slate-500" : "text-slate-400"}`}>Cereri</div>}
                {results.requests.map(r => (
                  <div key={r.id} className={`px-3 py-2 text-sm ${dark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-50 text-slate-700"}`}>
                    <div className="flex justify-between"><span>{r.title}</span><span className={`text-[10px] uppercase ${dark ? "text-slate-500" : "text-slate-400"}`}>{r.status}</span></div>
                  </div>
                ))}
                {results.projects.length > 0 && <div className={`px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider ${dark ? "text-slate-500" : "text-slate-400"}`}>Proiecte</div>}
                {results.projects.map(p => (
                  <div key={p.id} className={`px-3 py-2 text-sm ${dark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-50 text-slate-700"}`}>
                    <div className="flex justify-between"><span>{p.name}</span><span className={`text-[10px] uppercase ${dark ? "text-slate-500" : "text-slate-400"}`}>{p.status}</span></div>
                  </div>
                ))}
                {!results.users.length && !results.requests.length && !results.projects.length && (
                  <div className={`p-4 text-xs text-center ${dark ? "text-slate-500" : "text-slate-400"}`}>Niciun rezultat pentru "{q}"</div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
};

const LiveActivityRail = ({ theme }) => {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    const load = () => axios.get(`${API}/admin/activity-feed-live?limit=12`).then(r => setEvents(r.data)).catch(() => {});
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, []);
  const dark = theme === "dark";
  return (
    <div className={`mt-6 mx-4 p-3 rounded-xl border ${dark ? "bg-slate-800/50 border-slate-700" : "bg-slate-50 border-slate-200"}`} data-testid="admin-activity-rail">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <div className={`text-[10px] font-bold uppercase tracking-wider ${dark ? "text-slate-400" : "text-slate-500"}`}>Activitate Live</div>
      </div>
      <div className="space-y-1.5 max-h-[280px] overflow-y-auto no-scrollbar">
        {events.length === 0 && <div className={`text-[11px] ${dark ? "text-slate-500" : "text-slate-400"}`}>Niciun eveniment recent</div>}
        {events.map(e => (
          <div key={e.id} className={`text-[11px] ${dark ? "text-slate-300" : "text-slate-600"}`}>
            <div className="font-medium truncate">{e.message || e.type}</div>
            <div className={`text-[10px] ${dark ? "text-slate-500" : "text-slate-400"}`}>
              {e.actor_name || "Sistem"} · {e.created_at ? new Date(e.created_at).toLocaleTimeString("ro-RO", { hour: "2-digit", minute: "2-digit" }) : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ROLE_PROFILES = [
  { role: "client", label: "Client", icon: Home, color: "blue", demoEmail: "client@propmanage.io" },
  { role: "specialist", label: "Specialist", icon: Wrench, color: "emerald", demoEmail: "specialist@propmanage.io" },
  { role: "operator", label: "Operator", icon: Briefcase, color: "amber", demoEmail: "operator@propmanage.io" },
];

const QuickProfileSwitch = ({ dark }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);

  const enterRole = async (profile) => {
    setBusy(profile.role);
    try {
      // Try demo account first (fast path, predictable)
      let target = null;
      try {
        const { data } = await axios.get(`${API}/admin/users`, { params: { q: profile.demoEmail, limit: 1 } });
        if (data.items && data.items[0]?.role === profile.role) target = data.items[0];
      } catch (_) { /* fall through */ }

      // Fallback: first user of that role
      if (!target) {
        const { data } = await axios.get(`${API}/admin/users`, { params: { role: profile.role, limit: 1 } });
        target = data.items?.[0];
      }
      if (!target) {
        alert(`Nu am găsit niciun utilizator cu rolul ${profile.label}.`);
        return;
      }

      const { data } = await axios.post(`${API}/admin/impersonate`, {
        user_id: target.id,
        reason: `QA admin — verificare funcționalități rol ${profile.label} (${target.email})`,
      });
      window.location.href = data?.redirect_to || `/${profile.role}`;
    } catch (e) {
      alert(e?.response?.data?.detail || e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${
          dark
            ? "bg-red-500/15 border-red-500/30 text-red-300 hover:bg-red-500/25"
            : "bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
        }`}
        data-testid="quick-profile-switch"
        title="Intră rapid într-un profil (jurnalizat GDPR · 2h)"
      >
        <UserCheck className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Schimbă profilul</span>
        <span className="sm:hidden">Profil</span>
        <ChevronDown className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div
            className={`absolute right-0 top-full mt-2 w-64 rounded-xl border shadow-2xl z-40 overflow-hidden ${
              dark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
            }`}
            data-testid="quick-profile-menu"
          >
            <div className={`px-3 py-2.5 border-b ${dark ? "border-slate-700" : "border-slate-200"}`}>
              <div className={`text-[10px] uppercase tracking-wider font-bold ${dark ? "text-slate-400" : "text-slate-500"}`}>
                Intră rapid ca
              </div>
              <div className={`text-[10px] mt-0.5 ${dark ? "text-slate-500" : "text-slate-400"}`}>
                Sesiune impersonare jurnalizată GDPR · 2h
              </div>
            </div>
            {ROLE_PROFILES.map(p => (
              <button
                key={p.role}
                onClick={() => { setOpen(false); enterRole(p); }}
                disabled={busy === p.role}
                className={`w-full text-left px-3 py-2.5 flex items-center gap-3 text-sm transition-colors ${
                  dark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-50 text-slate-700"
                } disabled:opacity-60`}
                data-testid={`quick-profile-${p.role}`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${p.color}-500/15`}>
                  <p.icon className={`w-4 h-4 text-${p.color}-500`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{p.label}</div>
                  <div className={`text-[11px] truncate ${dark ? "text-slate-500" : "text-slate-400"}`}>
                    {busy === p.role ? "Se inițializează..." : p.demoEmail}
                  </div>
                </div>
              </button>
            ))}
            <div className={`px-3 py-2 border-t text-[10px] ${dark ? "border-slate-800 text-slate-500" : "border-slate-100 text-slate-400"}`}>
              Pentru utilizatori reali → tab <strong>Toți userii</strong>.
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export const AdminLayoutMetronic = ({ active, onChange, children, title, subtitle }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [theme, toggleTheme] = useAdminTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = async () => { await logout(); navigate("/login"); };
  const dark = theme === "dark";

  const sidebar = (
    <aside
      className={`${dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} border-r flex flex-col h-screen w-72 fixed lg:sticky top-0 left-0 z-50 transition-transform duration-300 ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      data-testid="admin-sidebar"
    >
      <div className={`flex items-center justify-between px-6 h-16 border-b ${dark ? "border-slate-800" : "border-slate-200"}`}>
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#d4ff3a] to-[#a8e028] flex items-center justify-center">
            <Building2 className="w-4 h-4 text-black" strokeWidth={2.5} />
          </div>
          <span className={`font-serif text-lg font-bold tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>PropManage</span>
        </Link>
        <button onClick={() => setSidebarOpen(false)} className="lg:hidden">
          <X className={dark ? "text-slate-400" : "text-slate-500"} />
        </button>
      </div>
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-6">
            <div className={`px-3 mb-2 text-[10px] font-bold uppercase tracking-wider ${dark ? "text-slate-500" : "text-slate-400"}`}>{section.title}</div>
            <div className="space-y-0.5">
              {section.items.map((it) => {
                const ActiveIcon = it.icon;
                const isActive = active === it.id;
                return (
                  <button
                    key={it.id}
                    onClick={() => {
                      if (it.href) { navigate(it.href); setSidebarOpen(false); return; }
                      onChange(it.id); setSidebarOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-blue-50 text-blue-600 font-medium dark:bg-blue-500/10 dark:text-blue-400"
                        : dark
                          ? "text-slate-300 hover:bg-slate-800"
                          : "text-slate-700 hover:bg-slate-50"
                    }`}
                    style={isActive ? { backgroundColor: dark ? "rgba(59,130,246,0.1)" : "#eff6ff", color: dark ? "#60a5fa" : "#2563eb" } : {}}
                    data-testid={`admin-nav-${it.id}`}
                    data-tour={
                      it.id === "ai" ? "admin-ai-health"
                      : it.id === "qa_playbook" ? "admin-qa-playbook"
                      : it.id === "overview" ? "admin-analytics"
                      : it.id === "cms" ? "admin-content-tools"
                      : undefined
                    }
                  >
                    <ActiveIcon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{it.label}</span>
                    {it.badge && (
                      <span className="ml-auto text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white">{it.badge}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        <LiveActivityRail theme={theme} />
      </nav>
      <div className={`p-4 border-t flex items-center gap-3 ${dark ? "border-slate-800" : "border-slate-200"}`}>
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center text-white text-sm font-medium">
          {user?.name?.[0] || "A"}
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium truncate ${dark ? "text-slate-200" : "text-slate-900"}`}>{user?.name}</div>
          <div className={`text-[11px] truncate ${dark ? "text-slate-500" : "text-slate-400"}`}>{user?.email}</div>
        </div>
        <button onClick={handleLogout} className={`p-2 rounded-lg ${dark ? "hover:bg-slate-800 text-slate-400" : "hover:bg-slate-100 text-slate-500"}`} data-testid="admin-logout">
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );

  return (
    <div className={`min-h-screen flex ${dark ? "bg-slate-950" : "bg-slate-50"}`} data-testid="admin-console-root">
      {sidebar}
      {sidebarOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className={`sticky top-0 z-30 h-16 px-4 lg:px-8 flex items-center gap-4 border-b ${dark ? "bg-slate-900/80 border-slate-800 backdrop-blur-lg" : "bg-white/80 border-slate-200 backdrop-blur-lg"}`}>
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden">
            <Menu className={dark ? "text-slate-300" : "text-slate-700"} />
          </button>
          <GlobalSearch theme={theme} />
          <HealthScoreBadge dark={dark} />
          <QuickProfileSwitch dark={dark} />
          <ReplayAIAdminTourButton />
          <button onClick={toggleTheme} className={`p-2 rounded-lg ${dark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-600"}`} data-testid="admin-theme-toggle">
            {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
          <Link to="/" className={`hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg ${dark ? "text-slate-300 hover:bg-slate-800" : "text-slate-600 hover:bg-slate-100"}`}>
            <ChevronLeft className="w-3.5 h-3.5" />
            Site public
          </Link>
        </header>
        <main className={`flex-1 p-4 lg:p-8 ${dark ? "text-slate-100" : "text-slate-900"}`}>
          {title && (
            <div className="mb-6">
              <h1 className={`text-2xl lg:text-3xl font-bold tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>{title}</h1>
              {subtitle && <p className={`mt-1 text-sm ${dark ? "text-slate-400" : "text-slate-500"}`}>{subtitle}</p>}
            </div>
          )}
          {children}
        </main>
      </div>
      <AIAdminTour />
    </div>
  );
};

// Helper: card wrapper
export const AdminCard = ({ children, className = "", title, action, testid }) => {
  const theme = document.documentElement.getAttribute("data-admin-theme") || "light";
  const dark = theme === "dark";
  return (
    <div className={`rounded-2xl border ${dark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"} ${className}`} data-testid={testid}>
      {(title || action) && (
        <div className={`flex items-center justify-between px-5 py-4 border-b ${dark ? "border-slate-800" : "border-slate-100"}`}>
          {title && <h3 className={`font-semibold ${dark ? "text-slate-100" : "text-slate-900"}`}>{title}</h3>}
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  );
};

export const AdminBtn = ({ children, variant = "primary", className = "", ...props }) => {
  const variants = {
    primary: "bg-blue-600 hover:bg-blue-700 text-white",
    secondary: "bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200",
    danger: "bg-red-600 hover:bg-red-700 text-white",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white",
    ghost: "hover:bg-slate-100 text-slate-700 dark:hover:bg-slate-800 dark:text-slate-300",
  };
  return (
    <button
      className={`px-3 py-1.5 text-sm rounded-lg transition-colors font-medium ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};
