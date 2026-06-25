// Metronic-style admin shell: light sidebar + topbar with search/notifications/theme toggle.
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  LayoutDashboard, Users, ShieldCheck, Scale, Wallet, FolderKanban,
  FileText, Mail, MapPin, Award, Settings, Search, Bell, Sun, Moon,
  LogOut, Menu, X, ChevronLeft, Building2, ChevronDown, ChevronRight, Sparkles, Bot, Zap, Inbox,
  UserCheck, Home, Wrench, Briefcase, Code2, Shield, Lightbulb, Bug, Compass, Layers, BookOpenCheck, GraduationCap, Gamepad2, Trophy, BarChart3, Eye, Heart,
  Star, Clock, Command
} from "lucide-react";
import { useAuth } from "../../auth";
import { API } from "../DashShared";
import { HealthScoreBadge } from "./HealthScoreBadge";
import { AutonomyTierBadge } from "./AutonomyTierBadge";
import { AIAdminTour, ReplayAIAdminTourButton } from "./AIAdminTour";
import { ThemeSwitcher } from "../../components/ThemeSwitcher";
import { AdminTourV2Wrapper } from "./AdminTourV2";
import { useAdminScope, filterNavSections, setPreviewScope, getPreviewScope } from "../../lib/useAdminScope";
import { PreviewAuditButton } from "./PreviewAuditButton";
import { CommandPalette } from "../../components/CommandPalette";

// Scope-color tones for the topbar badge
const SCOPE_TONES = {
  general:  { bg: "bg-violet-100  dark:bg-violet-500/15",  text: "text-violet-700  dark:text-violet-300",  label: "Super Admin" },
  testing:  { bg: "bg-cyan-100    dark:bg-cyan-500/15",    text: "text-cyan-700    dark:text-cyan-300",    label: "Testing" },
  frontend: { bg: "bg-pink-100    dark:bg-pink-500/15",    text: "text-pink-700    dark:text-pink-300",    label: "Frontend" },
  backend:  { bg: "bg-blue-100    dark:bg-blue-500/15",    text: "text-blue-700    dark:text-blue-300",    label: "Backend" },
  security: { bg: "bg-red-100     dark:bg-red-500/15",     text: "text-red-700     dark:text-red-300",     label: "Security" },
  ai:       { bg: "bg-amber-100   dark:bg-amber-500/15",   text: "text-amber-700   dark:text-amber-300",   label: "AI" },
  ops:      { bg: "bg-emerald-100 dark:bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300", label: "Ops" },
};

const ScopeBadgeTop = ({ scope }) => {
  if (!scope) return null;
  const s = (scope.admin_scope || "general").toLowerCase();
  const tone = SCOPE_TONES[s] || SCOPE_TONES.general;
  const seniority = scope.admin_seniority || "senior";
  const isPreview = !!scope._preview_active;

  const exitPreview = (e) => {
    e.stopPropagation();
    setPreviewScope(null);
    setTimeout(() => window.location.reload(), 100);
  };

  if (isPreview) {
    return (
      <div
        className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-amber-100 dark:bg-amber-500/15 text-amber-800 dark:text-amber-200 border-2 border-amber-400 dark:border-amber-500/50 animate-pulse"
        title={`Preview as: ${s} (real scope: ${scope._real_scope})`}
        data-testid="admin-scope-badge"
      >
        <Eye className="w-3 h-3" />
        <span className="font-bold uppercase">PREVIEW · {tone.label}</span>
        <button
          onClick={exitPreview}
          className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-600/40 hover:bg-amber-300 dark:hover:bg-amber-600/70"
          data-testid="exit-preview"
        >
          ✕ Ieși
        </button>
      </div>
    );
  }

  return (
    <div
      className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium ${tone.bg} ${tone.text}`}
      title={`Scope: ${s} · Seniority: ${seniority}`}
      data-testid="admin-scope-badge"
    >
      <ShieldCheck className="w-3 h-3" />
      <span>{tone.label}</span>
      <span className="text-[9px] font-bold uppercase opacity-70">· {seniority}</span>
    </div>
  );
};

// ============================================================================
// NAV_SECTIONS v2 (Feb 2026) — Mega-menu reorganization
// 9 logical sections, fully collapsible, NON-DESTRUCTIVE rewire.
// All original item IDs / hrefs are preserved (no route changes).
// `superAdminOnly` sections are hidden for scoped sub-admins (e.g. "AI Lab").
// ============================================================================
const NAV_SECTIONS = [
  {
    id: "dashboard",
    title: "Dashboard",
    icon: LayoutDashboard,
    items: [
      { id: "overview", label: "Dashboard Principal", icon: LayoutDashboard },
      { id: "activity", label: "Activitate Live", icon: Sparkles },
      { id: "demo", label: "Demo Tools", icon: Zap, badge: "NEW" },
      { id: "leads", label: "Demo Leads", icon: Inbox, badge: "NEW" },
    ],
  },
  {
    id: "operations",
    title: "Operațiuni Zilnice",
    icon: Briefcase,
    items: [
      { id: "projects", label: "Proiecte", icon: FolderKanban },
      { id: "disputes", label: "Dispute & NC", icon: Scale },
      { id: "finance", label: "Finanțe & Escrow", icon: Wallet },
      { id: "todo_board", label: "ToDo Board", icon: FileText, badge: "NEW", href: "/admin/todo" },
      { id: "manual_tester", label: "Tester Manual", icon: Bug, badge: "QA", href: "/admin/manual-tester" },
    ],
  },
  {
    id: "users",
    title: "Utilizatori",
    icon: Users,
    items: [
      { id: "users", label: "Toți userii", icon: Users },
      { id: "verification", label: "Verificare specialiști", icon: ShieldCheck },
      { id: "beta_testers", label: "Beta Testers", icon: Sparkles, badge: "NEW" },
      { id: "sub_admins", label: "Sub-Admini", icon: Users, badge: "NEW" },
      { id: "approvals", label: "Aprobări Admin", icon: ShieldCheck, badge: "NEW" },
      { id: "specialist_progression", label: "Progresie Specialiști", icon: Trophy, badge: "SPRINT A", href: "/admin/specialist-progression" },
      { id: "experience_tiers", label: "Experience Tiers", icon: GraduationCap, badge: "NEW", href: "/admin/experience-tiers" },
    ],
  },
  {
    id: "content",
    title: "Conținut",
    icon: FileText,
    items: [
      { id: "cms", label: "Texte (CMS)", icon: FileText },
      { id: "emails", label: "Template-uri Email", icon: Mail },
      { id: "zones", label: "Zone Acoperire", icon: MapPin },
      { id: "operating_manual", label: "Manual de Operare", icon: BookOpenCheck, badge: "START AICI", href: "/admin/operating-manual" },
      { id: "docs_train", label: "Documentație & Training", icon: FileText, badge: "NEW", href: "/admin/documentation" },
      { id: "docs", label: "Documentație internă", icon: FileText, badge: "NEW" },
      { id: "qa_playbook", label: "QA Playbook", icon: ShieldCheck, badge: "NEW" },
    ],
  },
  {
    id: "compliance",
    title: "Compliance",
    icon: ShieldCheck,
    items: [
      { id: "legal_audit", label: "Audit Juridic IT", icon: ShieldCheck, badge: "NEW", href: "/admin/legal-audit" },
      { id: "gdpr", label: "GDPR Pack", icon: ShieldCheck, badge: "NEW" },
      { id: "impersonation", label: "Impersonări", icon: ShieldCheck, badge: "NEW" },
      { id: "kyc", label: "KYC Identitate", icon: ShieldCheck, badge: "NEW" },
      { id: "trust", label: "Trust Score Weights", icon: Award },
      { id: "audit", label: "Audit Log", icon: FileText },
      { id: "settings", label: "Setări Platformă", icon: Settings },
      { id: "settings_control", label: "Control Administrare", icon: Settings, badge: "NEW", href: "/admin/settings-control" },
    ],
  },
  {
    id: "properties",
    title: "Imobile",
    icon: Building2,
    items: [
      { id: "ve_admin", label: "Imobile Verificate", icon: Award, badge: "NEW", href: "/admin/imobile-verificate" },
      { id: "house_health", label: "House Health", icon: Heart, badge: "NEW", href: "/admin/house-health" },
      { id: "experience_spaces", label: "Experience Spaces", icon: Sparkles, badge: "BETA", href: "/admin/experience-spaces" },
    ],
  },
  {
    id: "ai_lab",
    title: "AI & Engineering Lab",
    icon: Bot,
    superAdminOnly: true,
    items: [
      { id: "ai", label: "AI Investigator", icon: Bot, badge: "NEW" },
      { id: "concierge", label: "Concierge & Security", icon: ShieldCheck, badge: "NEW" },
      { id: "qa_copilot", label: "QA Copilot · AI Testing", icon: Sparkles, badge: "NEW", href: "/admin/qa-copilot" },
      { id: "ai_control", label: "AI Control Center", icon: Sparkles, badge: "NEW", href: "/admin/ai-control" },
      { id: "ai_docs", label: "Document Intelligence", icon: FileText, badge: "NEW", href: "/ai-docs" },
      { id: "ai_dev_team", label: "AI Development Team", icon: Code2, badge: "NEW", href: "/admin/ai-dev-team" },
      { id: "ai_security", label: "AI Security Center", icon: Shield, badge: "NEW", href: "/admin/ai-security" },
      { id: "ai_governance", label: "AI Governance Center", icon: Shield, badge: "NEW", href: "/admin/ai-governance" },
      { id: "ai_pm", label: "AI Product Manager", icon: Layers, badge: "NEW", href: "/admin/ai-pm" },
      { id: "autonomy", label: "Autonomy Engine", icon: Sparkles, badge: "NEW", href: "/admin/autonomy" },
      { id: "twin", label: "Twin Orchestrator", icon: Bot, badge: "AI", href: "/admin/twin" },
      { id: "architecture_board", label: "Architecture Review Board", icon: Compass, badge: "NEW", href: "/admin/architecture-board" },
      { id: "bug_memory", label: "Bug Memory Aggregator", icon: Bug, badge: "NEW", href: "/admin/bug-memory" },
      { id: "future_ideas", label: "Idei Dezvoltare Viitoare", icon: Lightbulb, badge: "REVIEW", href: "/admin/future-ideas" },
      { id: "feature_configurator", label: "Feature Configurator", icon: Gamepad2, badge: "GAMIFY", href: "/admin/feature-configurator" },
    ],
  },
  {
    id: "analytics",
    title: "Analytics",
    icon: BarChart3,
    items: [
      { id: "bi_moe", label: "Business Intelligence", icon: BarChart3, badge: "SPRINT F", href: "/admin/bi-moe" },
      { id: "abtests", label: "A/B Tests", icon: Sparkles },
    ],
  },
  {
    id: "city_partners",
    title: "Parteneri Strategici",
    icon: Building2,
    superAdminOnly: true,
    items: [
      { id: "city_partners_list", label: "City Partners", icon: Building2, badge: "NEW V1", href: "/admin/city-partners" },
    ],
  },
  {
    id: "it_hub",
    title: "IT Collaborators Hub",
    icon: Code2,
    superAdminOnly: true,
    items: [
      { id: "it_team", label: "Echipa IT", icon: Users, badge: "NEW", href: "/admin/it-collaborators" },
      { id: "it_copilot", label: "AI Performance Copilot", icon: Bot, badge: "AI", href: "/admin/it-collaborators/copilot" },
      { id: "it_legal", label: "Audit Juridic IT", icon: ShieldCheck, badge: "LEGAL", href: "/admin/legal-audit" },
      { id: "founder_gate", label: "Founder Approval Gate", icon: ShieldCheck, badge: "FG-0", href: "/admin/founder-gate" },
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

// ── Favorites & Recents (localStorage, per-browser) ─────────────────────────
const FAV_KEY = "pm_admin_fav_items_v1";
const RECENT_KEY = "pm_admin_recent_items_v1";

export const getFavoriteItems = () => {
  try { return JSON.parse(localStorage.getItem(FAV_KEY) || "[]"); } catch { return []; }
};
export const toggleFavoriteItem = (itemId) => {
  const cur = getFavoriteItems();
  const next = cur.includes(itemId) ? cur.filter(id => id !== itemId) : [...cur, itemId];
  localStorage.setItem(FAV_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("pm:favorites-changed"));
  return next;
};
export const getRecentItems = () => {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
};
export const pushRecentItem = (itemId) => {
  const cur = getRecentItems().filter(id => id !== itemId);
  const next = [itemId, ...cur].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent("pm:recents-changed"));
  return next;
};

// Expose NAV_SECTIONS for the CommandPalette
export { NAV_SECTIONS };

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
                  <div className={`p-4 text-xs text-center ${dark ? "text-slate-500" : "text-slate-400"}`}>Niciun rezultat pentru „{q}”</div>
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
  // Base demo accounts (existing)
  { role: "client", label: "Client (demo)", icon: Home, color: "blue", demoEmail: "client@propmanage.io", tier: "VERIFIED", group: "base" },
  { role: "specialist", label: "Specialist (demo)", icon: Wrench, color: "emerald", demoEmail: "specialist@propmanage.io", tier: "VERIFIED", group: "base" },
  { role: "operator", label: "Operator", icon: Briefcase, color: "amber", demoEmail: "operator@propmanage.io", tier: null, group: "base" },
  // Client tiers
  { role: "client", label: "Client JUNIOR", icon: Home, color: "slate", demoEmail: "client.junior@propmanage.io", tier: "JUNIOR", group: "client_tiers" },
  { role: "client", label: "Client VERIFIED", icon: Home, color: "blue", demoEmail: "client.verified@propmanage.io", tier: "VERIFIED", group: "client_tiers" },
  { role: "client", label: "Client PREMIUM", icon: Home, color: "fuchsia", demoEmail: "client.premium@propmanage.io", tier: "PREMIUM", group: "client_tiers" },
  // Specialist tiers
  { role: "specialist", label: "Specialist ENTRY", icon: Wrench, color: "slate", demoEmail: "spec.entry@propmanage.io", tier: "ENTRY", group: "spec_tiers" },
  { role: "specialist", label: "Specialist JUNIOR", icon: Wrench, color: "cyan", demoEmail: "spec.junior@propmanage.io", tier: "JUNIOR", group: "spec_tiers" },
  { role: "specialist", label: "Specialist VERIFIED", icon: Wrench, color: "emerald", demoEmail: "spec.verified@propmanage.io", tier: "VERIFIED", group: "spec_tiers" },
  { role: "specialist", label: "Specialist ADVANCED", icon: Wrench, color: "lime", demoEmail: "spec.advanced@propmanage.io", tier: "ADVANCED", group: "spec_tiers" },
  { role: "specialist", label: "Specialist PREMIUM", icon: Wrench, color: "fuchsia", demoEmail: "spec.premium@propmanage.io", tier: "PREMIUM", group: "spec_tiers" },
  { role: "specialist", label: "Specialist TOP", icon: Wrench, color: "yellow", demoEmail: "spec.top@propmanage.io", tier: "TOP", group: "spec_tiers" },
];

const QuickProfileSwitch = ({ dark }) => {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(null);

  const enterRole = async (profile) => {
    setBusy(profile.demoEmail || profile.role);
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
        reason: `QA admin — verificare funcționalități ${profile.label} (${target.email})`,
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
            className={`absolute right-0 top-full mt-2 w-80 max-h-[80vh] overflow-y-auto rounded-xl border shadow-2xl z-40 ${
              dark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"
            }`}
            data-testid="quick-profile-menu"
          >
            <div className={`sticky top-0 z-10 px-3 py-2.5 border-b ${dark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}>
              <div className={`text-[10px] uppercase tracking-wider font-bold ${dark ? "text-slate-400" : "text-slate-500"}`}>
                Intră rapid ca
              </div>
              <div className={`text-[10px] mt-0.5 ${dark ? "text-slate-500" : "text-slate-400"}`}>
                Sesiune impersonare jurnalizată GDPR · 2h
              </div>
            </div>

            {/* Base demo accounts */}
            <div className={`px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider font-bold ${dark ? "text-slate-500" : "text-slate-400"}`}>
              Conturi demo principale
            </div>
            {ROLE_PROFILES.filter(p => p.group === "base").map(p => (
              <button
                key={p.demoEmail}
                onClick={() => { setOpen(false); enterRole(p); }}
                disabled={busy === p.demoEmail}
                className={`w-full text-left px-3 py-2 flex items-center gap-3 text-sm transition-colors ${
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
                    {busy === p.demoEmail ? "Se inițializează..." : p.demoEmail}
                  </div>
                </div>
              </button>
            ))}

            {/* Client tier profiles */}
            <div className={`px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider font-bold border-t ${dark ? "text-blue-400 border-slate-800" : "text-blue-600 border-slate-100"}`}>
              Client · Tier-uri de progresie
            </div>
            {ROLE_PROFILES.filter(p => p.group === "client_tiers").map(p => (
              <button
                key={p.demoEmail}
                onClick={() => { setOpen(false); enterRole(p); }}
                disabled={busy === p.demoEmail}
                className={`w-full text-left px-3 py-2 flex items-center gap-3 text-sm transition-colors ${
                  dark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-50 text-slate-700"
                } disabled:opacity-60`}
                data-testid={`quick-profile-${p.tier?.toLowerCase()}-client`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${p.color}-500/15`}>
                  <p.icon className={`w-4 h-4 text-${p.color}-500`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium flex items-center gap-1.5">
                    {p.label}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-${p.color}-500/15 text-${p.color}-500 uppercase`}>{p.tier}</span>
                  </div>
                  <div className={`text-[11px] truncate ${dark ? "text-slate-500" : "text-slate-400"}`}>
                    {busy === p.demoEmail ? "Se inițializează..." : p.demoEmail}
                  </div>
                </div>
              </button>
            ))}

            {/* Specialist tier profiles */}
            <div className={`px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider font-bold border-t ${dark ? "text-emerald-400 border-slate-800" : "text-emerald-600 border-slate-100"}`}>
              Specialist · Tier-uri de progresie
            </div>
            {ROLE_PROFILES.filter(p => p.group === "spec_tiers").map(p => (
              <button
                key={p.demoEmail}
                onClick={() => { setOpen(false); enterRole(p); }}
                disabled={busy === p.demoEmail}
                className={`w-full text-left px-3 py-2 flex items-center gap-3 text-sm transition-colors ${
                  dark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-50 text-slate-700"
                } disabled:opacity-60`}
                data-testid={`quick-profile-${p.tier?.toLowerCase()}-specialist`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${p.color}-500/15`}>
                  <p.icon className={`w-4 h-4 text-${p.color}-500`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium flex items-center gap-1.5">
                    {p.label}
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-${p.color}-500/15 text-${p.color}-500 uppercase`}>{p.tier}</span>
                  </div>
                  <div className={`text-[11px] truncate ${dark ? "text-slate-500" : "text-slate-400"}`}>
                    {busy === p.demoEmail ? "Se inițializează..." : p.demoEmail}
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
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { scope: adminScope } = useAdminScope();

  const handleLogout = async () => { await logout(); navigate("/login"); };
  const dark = theme === "dark";

  // Filter nav sections based on current admin's scope (general sees all)
  let visibleSections = filterNavSections(NAV_SECTIONS, adminScope);
  // Hide `superAdminOnly` sections for scoped sub-admins
  const isSuperAdmin = !adminScope || (adminScope.admin_scope || "general").toLowerCase() === "general";
  if (!isSuperAdmin) {
    visibleSections = visibleSections.filter(s => !s.superAdminOnly);
  }

  // Collapsible-section state (persisted per browser)
  // Default behavior: ALL sections collapsed except the one containing the active item.
  // This gives the clean "mega-menu" look (9 rows visible, expand on click).
  const COLLAPSED_KEY = "pm_admin_nav_collapsed_v3";
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const saved = localStorage.getItem(COLLAPSED_KEY);
      if (saved) return JSON.parse(saved);
    } catch { /* noop */ }
    // first visit → start with everything collapsed
    const initial = {};
    NAV_SECTIONS.forEach(s => { initial[s.id] = true; });
    return initial;
  });
  // Auto-expand the section that contains the currently active item
  useEffect(() => {
    if (!active) return;
    const activeSection = NAV_SECTIONS.find(s => s.items.some(it => it.id === active));
    if (activeSection) {
      setCollapsed(prev => prev[activeSection.id] === false ? prev : { ...prev, [activeSection.id]: false });
    }
  }, [active]);
  const toggleSection = (sid) => {
    setCollapsed(prev => {
      const next = { ...prev, [sid]: !prev[sid] };
      localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
      return next;
    });
  };

  // Favorites — recomputed on storage changes
  const [favIds, setFavIds] = useState(() => getFavoriteItems());
  useEffect(() => {
    const onChange = () => setFavIds(getFavoriteItems());
    window.addEventListener("pm:favorites-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("pm:favorites-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  // Flat item index across all visible sections (used by Favorites + Cmd-K)
  const flatItems = visibleSections.flatMap(s => s.items.map(it => ({ ...it, _sectionId: s.id, _sectionTitle: s.title })));
  const favItems = favIds.map(id => flatItems.find(it => it.id === id)).filter(Boolean);

  // Global Ctrl/Cmd + K hotkey for the Command Palette
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(p => !p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleNavClick = (it) => {
    pushRecentItem(it.id);
    if (it.href) { navigate(it.href); setSidebarOpen(false); return; }
    onChange(it.id); setSidebarOpen(false);
  };

  const renderItem = (it, sectionId) => {
    const ActiveIcon = it.icon;
    const isActive = active === it.id;
    const isFav = favIds.includes(it.id);
    return (
      <div key={`${sectionId || "fav"}-${it.id}`} className="group/item relative">
        <button
          onClick={() => handleNavClick(it)}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
            isActive
              ? "bg-blue-50 text-blue-600 font-medium dark:bg-blue-500/10 dark:text-blue-400"
              : dark ? "text-slate-300 hover:bg-slate-800" : "text-slate-700 hover:bg-slate-50"
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
          <span className="truncate flex-1 text-left">{it.label}</span>
          {it.badge && (
            <span className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white">{it.badge}</span>
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavoriteItem(it.id); }}
          className={`absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded opacity-0 group-hover/item:opacity-100 transition-opacity ${
            isFav ? "opacity-100 text-amber-500" : dark ? "text-slate-500 hover:text-amber-400" : "text-slate-400 hover:text-amber-500"
          }`}
          title={isFav ? "Elimină din favorite" : "Adaugă la favorite"}
          data-testid={`fav-toggle-${it.id}`}
        >
          <Star className={`w-3.5 h-3.5 ${isFav ? "fill-amber-500" : ""}`} />
        </button>
      </div>
    );
  };

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

      {/* Cmd+K trigger + Collapse-all inside sidebar */}
      <div className="px-3 pt-3 flex items-center gap-2">
        <button
          onClick={() => setPaletteOpen(true)}
          className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
            dark ? "bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
          }`}
          data-testid="open-command-palette-sidebar"
        >
          <Command className="w-3.5 h-3.5" />
          <span className="flex-1 text-left">Caută rapid…</span>
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${dark ? "bg-slate-700 text-slate-300" : "bg-white border border-slate-200 text-slate-500"}`}>⌘K</span>
        </button>
        <button
          onClick={() => {
            const allCollapsed = visibleSections.every(s => collapsed[s.id]);
            const next = {};
            visibleSections.forEach(s => { next[s.id] = !allCollapsed; });
            setCollapsed(next);
            localStorage.setItem(COLLAPSED_KEY, JSON.stringify(next));
          }}
          className={`p-2 rounded-lg border text-xs transition-colors ${
            dark ? "bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-800" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
          }`}
          title="Restrânge / Extinde toate secțiunile"
          data-testid="collapse-all-sections"
        >
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {/* Favorites pseudo-section */}
        {favItems.length > 0 && (
          <div className="mb-6" data-testid="nav-section-favorites">
            <div className={`flex items-center gap-1.5 px-3 mb-2 text-[10px] font-bold uppercase tracking-wider ${dark ? "text-amber-400" : "text-amber-600"}`}>
              <Star className="w-3 h-3 fill-current" />
              Favorite
            </div>
            <div className="space-y-0.5">
              {favItems.map((it) => renderItem(it, "fav"))}
            </div>
          </div>
        )}

        {/* Mega-menu collapsable sections */}
        {visibleSections.map((section) => {
          const SectionIcon = section.icon || LayoutDashboard;
          const isCollapsed = !!collapsed[section.id];
          return (
            <div key={section.id} className="mb-3" data-testid={`nav-section-${section.id}`}>
              <button
                onClick={() => toggleSection(section.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-bold uppercase tracking-wider transition-colors ${
                  dark ? "text-slate-400 hover:bg-slate-800/50" : "text-slate-500 hover:bg-slate-100/70"
                }`}
                data-testid={`nav-section-toggle-${section.id}`}
              >
                <SectionIcon className="w-3.5 h-3.5" />
                <span className="flex-1 text-left">{section.title}</span>
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${dark ? "bg-slate-800 text-slate-400" : "bg-slate-100 text-slate-500"}`}>{section.items.length}</span>
                {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
              {!isCollapsed && (
                <div className="space-y-0.5 mt-1">
                  {section.items.map((it) => renderItem(it, section.id))}
                </div>
              )}
            </div>
          );
        })}
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
          <button
            onClick={() => setPaletteOpen(true)}
            className={`hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              dark ? "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700" : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
            }`}
            data-testid="open-command-palette-topbar"
            title="Command Palette (Ctrl/Cmd + K)"
          >
            <Command className="w-3.5 h-3.5" />
            <span>⌘K</span>
          </button>
          <HealthScoreBadge dark={dark} />
          <AutonomyTierBadge dark={dark} />
          <ScopeBadgeTop scope={adminScope} />
          <QuickProfileSwitch dark={dark} />
          <ReplayAIAdminTourButton />
          <ThemeSwitcher />
          <button onClick={toggleTheme} className={`p-2 rounded-lg ${dark ? "hover:bg-slate-800 text-slate-300" : "hover:bg-slate-100 text-slate-600"}`} data-testid="admin-theme-toggle" title="Schimbă tema Metronic admin (dark/light intern)">
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
      <AdminTourV2Wrapper />
      <PreviewAuditButton scope={getPreviewScope()} />
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        sections={visibleSections}
        favIds={favIds}
        onNavigate={(it) => { setPaletteOpen(false); handleNavClick(it); }}
        onToggleFavorite={(id) => toggleFavoriteItem(id)}
      />
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
