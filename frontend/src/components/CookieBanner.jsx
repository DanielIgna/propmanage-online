// PropManage — GDPR Cookie Consent Banner
// Shows on first visit. Stores prefs in localStorage + (if logged in) syncs to /api/cookies/consent.
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Cookie, ChevronDown, X } from "lucide-react";

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
    // Sync to backend (works for anonymous + logged-in users)
    try {
      await axios.post(`${API}/api/cookies/consent`, {
        functional_cookies_accepted: true,
        analytics_cookies_accepted: !!final.analytics,
        marketing_cookies_accepted: !!final.marketing,
      }, { withCredentials: true });
    } catch (e) {
      // Silent — banner doesn't fail if backend unreachable
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
        className="fixed bottom-4 left-4 z-40 w-10 h-10 rounded-full bg-stone-900 border border-white/10 hover:border-[#d4ff3a]/40 flex items-center justify-center opacity-60 hover:opacity-100 transition"
        title="Schimbă preferințele cookie"
        data-testid="cookie-banner-reopen"
      >
        <Cookie className="w-4 h-4 text-stone-300" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-sm z-50 pointer-events-none" data-testid="cookie-banner">
      <div className="pointer-events-auto bg-[#0a0a0b]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
        <div className="p-4">
          <div className="flex items-start gap-2.5">
            <Cookie className="w-4 h-4 text-[#d4ff3a] shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white mb-0.5">Preferințe cookie-uri</div>
              <p className="text-[11px] text-stone-400 leading-relaxed">
                Funcționale (obligatorii) · statistice & marketing opționale.
              </p>
            </div>
            <button onClick={rejectOptional} className="text-stone-500 hover:text-stone-300 shrink-0" data-testid="cookie-banner-close" title="Refuză opționale">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {customize && (
            <div className="mt-3 space-y-2 border-t border-white/5 pt-3" data-testid="cookie-banner-customize">
              <label className="flex items-start gap-2 opacity-60 cursor-not-allowed">
                <input type="checkbox" checked={true} disabled className="mt-0.5 w-3.5 h-3.5 accent-stone-500 shrink-0" />
                <div className="text-[11px]">
                  <div className="font-medium text-stone-300">Funcționale <span className="text-[10px] text-stone-500">(obligatorii)</span></div>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={prefs.analytics}
                  onChange={e => setPrefs(p => ({ ...p, analytics: e.target.checked }))}
                  className="mt-0.5 w-3.5 h-3.5 accent-[#d4ff3a] shrink-0"
                  data-testid="cookie-pref-analytics" />
                <div className="text-[11px] font-medium text-stone-300">Statistice</div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={prefs.marketing}
                  onChange={e => setPrefs(p => ({ ...p, marketing: e.target.checked }))}
                  className="mt-0.5 w-3.5 h-3.5 accent-[#d4ff3a] shrink-0"
                  data-testid="cookie-pref-marketing" />
                <div className="text-[11px] font-medium text-stone-300">Marketing</div>
              </label>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <button onClick={acceptAll} className="btn-accent px-3 py-1.5 rounded-lg text-[11px] font-semibold flex-1" data-testid="cookie-accept-all">
              Accept toate
            </button>
            <button onClick={rejectOptional} className="px-3 py-1.5 rounded-lg text-[11px] font-medium bg-white/5 border border-white/10 hover:bg-white/10 text-stone-300 flex-1" data-testid="cookie-reject-optional">
              Refuz
            </button>
            {!customize ? (
              <button onClick={() => setCustomize(true)} className="px-2 py-1.5 rounded-lg text-[11px] text-stone-400 hover:text-stone-200" data-testid="cookie-customize">
                <ChevronDown className="w-3 h-3" />
              </button>
            ) : (
              <button onClick={saveCustom} className="px-2 py-1.5 rounded-lg text-[11px] text-[#d4ff3a]" data-testid="cookie-save-custom">
                Salvează
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieBanner;
