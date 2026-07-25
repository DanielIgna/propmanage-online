// Auth Context for PropManage
import React, { createContext, useContext, useState, useEffect } from "react";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
axios.defaults.withCredentials = true;

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null); // null = checking, false = not auth, object = auth
  
  useEffect(() => {
    // CRITICAL: If returning from Emergent OAuth callback, skip the /me check.
    // AuthCallback will exchange the session_id and establish the session first.
    if (window.location.hash?.includes("session_id=")) {
      return;
    }
    // Skip auth probe on intentionally-public routes (avoids noisy 401s).
    const path = window.location.pathname;
    if (path.startsWith("/report-respond/")) {
      setUser(false);
      return;
    }
    axios.get(`${API}/auth/me`)
      .then(r => {
        setUser(r.data);
        import("@/lib/analytics").then(({ identify }) => identify(r.data?.id, r.data?.role)).catch(() => {});
      })
      .catch(() => setUser(false));
  }, []);
  
  const login = async (email, password, totp_code) => {
    const payload = { email, password };
    if (totp_code) payload.totp_code = totp_code;
    const { data } = await axios.post(`${API}/auth/login`, payload);
    setUser(data);
    try { const { identify } = await import("@/lib/analytics"); identify(data?.id, data?.role); } catch { /* noop */ }
    return data;
  };
  
  const register = async (payload) => {
    try { const { trackFunnel } = await import("@/lib/analytics"); trackFunnel("signup_started"); } catch { /* noop */ }
    const { data } = await axios.post(`${API}/auth/register`, payload);
    try {
      const { trackFunnel, identify } = await import("@/lib/analytics");
      trackFunnel("account_created");
      identify(data?.id, data?.role);
    } catch { /* noop */ }
    setUser(data);
    return data;
  };
  
  const logout = async () => {
    await axios.post(`${API}/auth/logout`);
    try { const { identify } = await import("@/lib/analytics"); identify(null); } catch { /* noop */ }
    setUser(false);
  };
  
  const refreshUser = async () => {
    const { data } = await axios.get(`${API}/auth/me`);
    setUser(data);
    return data;
  };
  
  return (
    <AuthContext.Provider value={{ user, login, register, logout, refreshUser, API }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};

export function formatApiError(err) {
  const detail = err?.response?.data?.detail;
  if (!detail) return err?.message || "Something went wrong";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(e => e.msg || JSON.stringify(e)).join(" ");
  return String(detail);
}
