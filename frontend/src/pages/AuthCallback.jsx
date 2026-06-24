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
        const status = e?.response?.status;
        const hasDetail = !!e?.response?.data?.detail;
        let detail = e?.response?.data?.detail || e.message || "Autentificare eșuată";
        // Gateway-style empty-body 5xx (502 Bad Gateway / 504 Gateway Timeout /
        // 520-524 Cloudflare) → no JSON detail, axios shows the bare status code.
        const isGatewayErr = status && !hasDetail && (status === 502 || status === 504 || (status >= 520 && status <= 524));
        if (isGatewayErr) {
          detail = `Serverul Emergent OAuth (upstream) e momentan inaccesibil sau prea lent (HTTP ${status} — ${status === 502 ? "Bad Gateway" : status === 504 ? "Gateway Timeout" : "Cloudflare origin empty"}). ` +
            "Încearcă din nou peste 30s-1min, sau folosește email + parolă mai jos.";
          // Ping a beacon so /admin/auth-health can track ingress-level failures
          // that didn't reach the backend retry loop. Fire-and-forget.
          axios.post(`${API}/auth/health-beacon`, {
            status_code: status,
            where: "auth_callback",
            note: (e.message || "").slice(0, 200),
          }).catch(() => {});
        } else if (status === 503 && hasDetail) {
          detail = e.response.data.detail;
        }
        setError(`[${status || "network"}] ${detail}`);
        console.error("[GoogleOAuth] Failed:", status, detail, e);
      }
    })();
  }, [navigate, refreshUser]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0b] text-stone-100 px-6">
      <div className="max-w-md w-full text-center space-y-4">
        {!error ? (
          <>
            <div className="inline-block w-12 h-12 border-2 border-[#d4ff3a] border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-sm text-stone-400">Se finalizează autentificarea...</p>
          </>
        ) : (
          <>
            <div className="text-5xl">🔐</div>
            <h1 className="text-2xl font-serif">Autentificare Google eșuată</h1>
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-left text-xs text-red-300 font-mono break-words" data-testid="oauth-error-detail">
              {error}
            </div>
            <div className="text-xs text-stone-400 space-y-2 text-left bg-white/[0.03] rounded-lg p-3">
              <p className="font-semibold text-stone-300">Ce poți încerca:</p>
              <ol className="list-decimal pl-5 space-y-1">
                <li>Activează cookies third-party pentru <code>emergent.host</code> în setările browser-ului</li>
                <li>Șterge cookies pentru <strong>propmanage.ro</strong> + <strong>emergent.host</strong> și încearcă din nou</li>
                <li>Folosește email + parolă în loc de Google (mai sigur cross-site)</li>
              </ol>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => navigate("/login")}
                className="flex-1 px-4 py-2 rounded-lg bg-[#d4ff3a] text-stone-950 text-sm font-semibold"
                data-testid="oauth-error-back"
              >
                Înapoi la login
              </button>
              <button
                onClick={() => window.location.href = "mailto:contact@propmanage.ro?subject=Problema Google OAuth pe propmanage.ro&body=" + encodeURIComponent("Eroare: " + error)}
                className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-stone-300 text-xs"
              >
                Raportează
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
