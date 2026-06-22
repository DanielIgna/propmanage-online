// Hook + helpers for admin-scope aware UI (Milestone 2)
import { useEffect, useState } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Visibility map: which nav items each scope can see (besides "general" who sees all).
// Keep in sync with backend middleware_scope.SCOPE_RULES so UI matches reality.
export const SCOPE_VISIBILITY = {
  general: "ALL",
  testing: new Set([
    "overview", "ai", "activity", "demo", "leads",
    "qa_copilot", "qa_playbook", "audit", "docs", "docs_train",
    "todo_board", "approvals",
  ]),
  frontend: new Set([
    "overview", "activity", "cms", "emails", "zones",
    "feature_configurator", "audit", "docs", "docs_train",
    "todo_board", "approvals",
  ]),
  backend: new Set([
    "overview", "activity", "settings", "settings_control", "architecture_board",
    "audit", "docs", "docs_train", "todo_board", "approvals",
    "bug_memory",
  ]),
  security: new Set([
    "overview", "activity", "ai_security", "gdpr", "impersonation",
    "audit", "docs", "docs_train", "todo_board", "approvals",
    "trust", "ai_governance",
  ]),
  ai: new Set([
    "overview", "ai", "activity", "concierge", "ai_control",
    "ai_dev_team", "ai_docs", "ai_governance", "ai_pm",
    "audit", "docs", "docs_train", "todo_board", "approvals",
  ]),
  ops: new Set([
    "overview", "activity", "autonomy", "exec_briefing",
    "audit", "docs", "docs_train", "todo_board", "approvals",
    "verification", "disputes", "finance",
  ]),
};

export function useAdminScope() {
  const [scope, setScope] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    axios
      .get(`${API}/admin/sub-admins/me/scope`)
      .then((r) => {
        if (!cancelled) setScope(r.data);
      })
      .catch(() => {
        if (!cancelled) setScope(null);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);
  return { scope, loading };
}

export function canSeeNavItem(scopeData, itemId) {
  if (!scopeData) return true; // unknown → show (fail-open until /me/scope loads)
  const s = (scopeData.admin_scope || "general").toLowerCase();
  if (s === "general") return true;
  const allowed = SCOPE_VISIBILITY[s];
  if (!allowed || allowed === "ALL") return true;
  return allowed.has(itemId);
}

export function filterNavSections(sections, scopeData) {
  if (!scopeData) return sections;
  const s = (scopeData.admin_scope || "general").toLowerCase();
  if (s === "general") return sections;
  return sections
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((it) => canSeeNavItem(scopeData, it.id)),
    }))
    .filter((sec) => sec.items.length > 0);
}
