// PropManage — GDPR Cookie Consent. Strip fix SUS (nu mai acoperă nav/CTA-uri jos).
// Stores prefs in localStorage + (if logged in) syncs to /api/cookies/consent.
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Cookie, SlidersHorizontal, X } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const STORAGE_KEY = "pm_cookie_consent_v1";

export const CookieBanner = () => {
  const [open, setOpen] = useState(false);
  const [customize, setCustomize] = useState(false);
  const [prefs, setPrefs] = useState({
    functional: true,   // always true — cannot be disabled (auth, sessions)
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setOpen(true);
      } else {
        const saved = JSON.parse(raw);
        setPrefs({ functional: true, analytics: !!saved.analytics, marketing: !!saved.marketing });
      }
    } catch {
      setOpen(true);
    }
  }, []);

  const persist = async (choice) => {
    const final = { functional: true, ...choice };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...final, ts: new Date().toISOString() }));
    setPrefs(final);
    setOpen(false);
    setCustomize(false);
    try {
      await axios.post(`${API}/api/cookies/consent`, {
        functional_cookies_accepted: true,
        analytics_cookies_accepted: !!final.analytics,
        marketing_cookies_accepted: !!final.marketing,
      }, { withCredentials: true });
    } catch (e) {
      console.warn("[CookieBanner] sync failed:", e?.message);
    }
  };

  const acceptAll = () => persist({ analytics: true, marketing: true });
  const rejectOptional = () => persist({ analytics: false, marketing: false });
  const saveCustom = () => persist({ analytics: prefs.analytics, marketing: prefs.marketing });

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setCustomize(true); }}
        className="fixed bottom-4 left-4 z-40 w-9 h-9 rounded-full bg-[#0f0f0f] border border-white/10 hover:border-[#ccff00]/40 flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
        title="Schimbă preferințele cookie"
        data-testid="cookie-banner-reopen"
      >
        <Cookie className="w-4 h-4 text-stone-300" />
      </button>
    );
  }

  return (
    <div className="fixed top-0 inset-x-0 z-[80]" data-testid="cookie-banner">
      <div className="bg-[#0a0a0a]/95 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <Cookie className="w-4 h-4 text-[#ccff00] shrink-0" />
            <p className="text-[11px] leading-snug hidden sm:block" style={{ color: "#d6d3d1" }}>
              <span className="font-semibold" style={{ color: "#fafafa" }}>Cookie-uri:</span> funcționale obligatorii · statistice &amp; marketing opționale.
            </p>
            <p className="text-[11px] font-semibold sm:hidden" style={{ color: "#fafafa" }}>Cookie-uri</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-auto">
            <button onClick={acceptAll} className="px-3.5 py-1.5 rounded-full text-[11px] font-bold bg-[#ccff00] text-black hover:bg-[#b3e600] transition-colors" data-testid="cookie-accept-all">
              Accept toate
            </button>
            <button onClick={rejectOptional} className="px-3.5 py-1.5 rounded-full text-[11px] font-semibold bg-white/5 border border-white/15 hover:bg-white/10 transition-colors" style={{ color: "#d6d3d1" }} data-testid="cookie-reject-optional">
              Refuz
            </button>
            {!customize ? (
              <button onClick={() => setCustomize(true)} className="p-1.5 rounded-full hover:bg-white/10 transition-colors" title="Personalizează" data-testid="cookie-customize">
                <SlidersHorizontal className="w-3.5 h-3.5 text-stone-400" />
              </button>
            ) : (
              <button onClick={saveCustom} className="px-3 py-1.5 rounded-full text-[11px] font-bold text-[#ccff00] hover:bg-white/5 transition-colors" data-testid="cookie-save-custom">
                Salvează
              </button>
            )}
            <button onClick={rejectOptional} className="p-1.5 rounded-full hover:bg-white/10 text-stone-500 hover:text-stone-300 transition-colors" data-testid="cookie-banner-close" title="Refuză opționale">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {customize && (
            <div className="w-full flex flex-wrap items-center gap-x-5 gap-y-1.5 pb-1" data-testid="cookie-banner-customize">
              <label className="flex items-center gap-2 opacity-60 cursor-not-allowed">
                <input type="checkbox" checked={true} disabled className="w-3.5 h-3.5 accent-stone-500 shrink-0" />
                <span className="text-[11px] font-medium" style={{ color: "#d6d3d1" }}>Funcționale <span className="text-stone-500">(obligatorii)</span></span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={prefs.analytics}
                  onChange={e => setPrefs(p => ({ ...p, analytics: e.target.checked }))}
                  className="w-3.5 h-3.5 accent-[#ccff00] shrink-0"
                  data-testid="cookie-pref-analytics" />
                <span className="text-[11px] font-medium" style={{ color: "#d6d3d1" }}>Statistice</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={prefs.marketing}
                  onChange={e => setPrefs(p => ({ ...p, marketing: e.target.checked }))}
                  className="w-3.5 h-3.5 accent-[#ccff00] shrink-0"
                  data-testid="cookie-pref-marketing" />
                <span className="text-[11px] font-medium" style={{ color: "#d6d3d1" }}>Marketing</span>
              </label>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
