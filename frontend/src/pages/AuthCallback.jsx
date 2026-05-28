// AuthCallback - handles Emergent Google OAuth session_id from URL fragment
// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../auth";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export const AuthCallback = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const processed = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (processed.current) return;
    processed.current = true;

    const hash = window.location.hash;
    const match = hash.match(/session_id=([^&]+)/);
    if (!match) {
      navigate("/login");
      return;
    }
    const sessionId = match[1];

    (async () => {
      try {
        const { data } = await axios.post(
          `${API}/auth/google/session`,
          {},
          { headers: { "X-Session-ID": sessionId }, withCredentials: true }
        );
        // Clear fragment from URL
        window.history.replaceState(null, "", window.location.pathname);
        // Re-fetch user from cookie-based session
        const me = await refreshUser();
        if (!me) {
          // Cookie was set but /auth/me failed — likely cross-site cookie blocked.
          // Show actionable error instead of redirecting to login (which would loop).
          setError("Autentificarea Google a reușit dar cookie-ul a fost blocat. Activează cookies pentru propmanage.ro și încearcă din nou.");
          return;
        }
        navigate(`/${data.role || "client"}`, { replace: true });
      } catch (e) {
        const detail = e?.response?.data?.detail || e.message || "Autentificare eșuată";
        setError(detail);
        // Log for debug
        console.error("[GoogleOAuth] Failed:", e?.response?.status, detail, e);
        setTimeout(() => navigate("/login"), 3500);
      }
    })();
  }, [navigate, refreshUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] text-stone-100">
      <div className="text-center">
        <div className="inline-block w-12 h-12 border-2 border-[#d4ff3a] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-stone-400">{error || "Se finalizează autentificarea..."}</p>
      </div>
    </div>
  );
};
