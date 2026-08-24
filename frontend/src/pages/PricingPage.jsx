/**
 * PricingPage — /pricing
 *
 * Task 2: fluxul comercial minim viabil pentru PropManage Basic 9€/lună.
 * Reutilizează 100% infrastructura existentă:
 *   - GET  /api/me/entitlements  (source of truth tier curent)
 *   - POST /api/house-health/checkout-session {plan_slug: "basic", origin_url}
 *   - Redirect Stripe → success_url /house-health/upgrade/success (existent)
 *
 * Hick's Law: un singur CTA principal (Basic). FREE = starea curentă,
 * BASIC = target. Fără PRO/PREMIUM aici.
 */
import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { Check, Sparkles, Loader2, ShieldCheck, ArrowLeft, Lock } from "lucide-react";
import { API } from "./DashShared";
import { useEntitlements, clearEntitlementCache } from "../hooks/useEntitlements";
import { formatApiError } from "../auth";

const BASIC_PRICE_EUR = 9;
const BASIC_SLUG = "basic";

const FREE_FEATURES = [
  "Adaugă proprietatea și profilul de bază",
  "Dosar Tehnic al proprietății",
  "Vizualizează starea documentelor",
];

const BASIC_FEATURES = [
  "Tot ce este în Gratuit",
  "House Health Basic — sănătatea casei",
  "Documentație tehnică extinsă (upload)",
  "Recomandări de întreținere",
];

const PricingPage = () => {
  const navigate = useNavigate();
  const { entitlements, loading: entLoading, refresh } = useEntitlements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Dacă tocmai a revenit dintr-un checkout success, forțează refresh entitlements
    if (window.location.search.includes("session_id")) {
      refresh();
    }
  }, [refresh]);

  const isFree = (entitlements?.tier || "FREE") === "FREE";
  const isBasic = ["CLIENT_BASIC", "CLIENT_PRO", "CLIENT_PREMIUM"].includes(entitlements?.tier);

  const startCheckout = async () => {
    setBusy(true);
    setError(null);
    try {
      const origin = window.location.origin;
      const res = await axios.post(`${API}/house-health/checkout-session`, {
        plan_slug: BASIC_SLUG,
        origin_url: origin,
      });
      const url = res.data?.url;
      if (!url) throw new Error("Sesiune de checkout invalidă.");
      // Curățăm cache-ul înainte de redirect ca la revenire să reia entitlements
      clearEntitlementCache();
      window.location.href = url;
    } catch (e) {
      // Dacă nu e autentificat → duce la login cu redirect back to pricing
      const status = e?.response?.status;
      if (status === 401 || status === 403) {
        navigate("/login?next=/pricing");
        return;
      }
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white" data-testid="pricing-page">
      {/* Top bar */}
      <div className="max-w-5xl mx-auto px-5 pt-6 flex items-center gap-2">
        <button onClick={() => navigate(-1)} data-testid="pricing-back"
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full border-2 border-slate-200 text-[11px] font-bold text-slate-600 hover:bg-slate-100">
          <ArrowLeft className="w-3 h-3" /> Înapoi
        </button>
        <div className="ml-auto text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
          PropManage · Abonament
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-3xl mx-auto px-5 pt-8 text-center">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#d4ff3a]/40 text-[10px] font-black uppercase tracking-[0.14em] text-slate-800">
          <Sparkles className="w-3 h-3" /> Un plan. Fără complicații.
        </div>
        <h1 className="mt-4 text-4xl sm:text-5xl font-black text-slate-900 leading-[1.05]"
          data-testid="pricing-heading">
          9€/lună deblochează<br />PropManage Basic.
        </h1>
        <p className="mt-4 text-base text-slate-600 max-w-xl mx-auto">
          Cont gratuit pentru începători. Când vrei să folosești House Health, activezi Basic.
          Fără angajament pe termen lung.
        </p>
      </div>

      {/* Cards */}
      <div className="max-w-4xl mx-auto px-5 mt-12 pb-24 grid md:grid-cols-2 gap-5">
        {/* FREE card */}
        <div className="rounded-3xl border-2 border-slate-200 bg-white p-6" data-testid="pricing-card-free">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
              <Lock className="w-4 h-4 text-slate-500" />
            </span>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">Nivel 1</div>
              <div className="text-lg font-black text-slate-900 leading-tight">Gratuit</div>
            </div>
          </div>
          <div className="mt-5">
            <span className="text-4xl font-black text-slate-900">0€</span>
            <span className="text-[11px] font-bold text-slate-500 ml-1">/lună</span>
          </div>
          <ul className="mt-5 space-y-2" data-testid="pricing-free-features">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[12px] text-slate-700">
                <Check className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          {isFree ? (
            <div className="mt-6 rounded-xl bg-slate-100 px-4 py-2.5 text-center text-[11px] font-bold text-slate-600"
              data-testid="pricing-free-current">
              Planul tău actual
            </div>
          ) : (
            <div className="mt-6 text-[10px] text-slate-400 text-center">
              Poți reveni la Gratuit anulând abonamentul.
            </div>
          )}
        </div>

        {/* BASIC card — Recommended */}
        <div className="relative rounded-3xl border-2 p-6 bg-white shadow-lg"
          style={{ borderColor: "#166534" }}
          data-testid="pricing-card-basic">
          <div className="absolute -top-3 left-6 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-[0.16em] text-black"
            style={{ background: "#d4ff3a" }}>
            Recomandat
          </div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#166534" }}>
              <ShieldCheck className="w-4 h-4 text-[#d4ff3a]" />
            </span>
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: "#166534" }}>Nivel 2</div>
              <div className="text-lg font-black text-slate-900 leading-tight">PropManage Basic</div>
            </div>
          </div>
          <div className="mt-5">
            <span className="text-5xl font-black text-slate-900">{BASIC_PRICE_EUR}€</span>
            <span className="text-[12px] font-bold text-slate-500 ml-1">/lună</span>
          </div>
          <div className="mt-1 text-[10px] font-bold text-slate-400">
            Facturare lunară · Anulezi oricând
          </div>
          <ul className="mt-5 space-y-2" data-testid="pricing-basic-features">
            {BASIC_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-[12px] text-slate-800">
                <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#166534" }} />
                <span className="font-medium">{f}</span>
              </li>
            ))}
          </ul>

          {isBasic ? (
            <div className="mt-6 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-2.5 text-center text-[11px] font-black text-emerald-800"
              data-testid="pricing-basic-current">
              Ai deja acces · {entitlements?.tier_label}
            </div>
          ) : entLoading ? (
            <button disabled className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-black text-black opacity-60"
              style={{ background: "#d4ff3a" }}>
              <Loader2 className="w-4 h-4 animate-spin" /> Se pregătește...
            </button>
          ) : (
            <button onClick={startCheckout} disabled={busy}
              data-testid="pricing-basic-cta"
              className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-sm font-black text-black hover:opacity-90 disabled:opacity-60"
              style={{ background: "#d4ff3a" }}>
              {busy ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Deschidem checkout-ul...</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Activează Basic pentru 9€/lună</>
              )}
            </button>
          )}
          <div className="mt-2 text-[9px] text-slate-400 text-center">
            Plată securizată prin Stripe · Fără taxe ascunse
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-3xl mx-auto px-5 -mt-16 pb-12" data-testid="pricing-error">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-[12px] text-rose-700">
            {error}
          </div>
        </div>
      )}

      {/* Bottom disclaimer */}
      <div className="max-w-2xl mx-auto px-5 pb-12 text-center text-[10px] text-slate-400">
        House Health Basic devine disponibil automat imediat după activarea abonamentului.
        Poți gestiona sau anula abonamentul oricând din contul tău.
      </div>
    </div>
  );
};

export default PricingPage;
