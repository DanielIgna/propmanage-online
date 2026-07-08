// ============================================================================
// PropManage Analytics — tracker first-party + integrări externe pluggable
// ----------------------------------------------------------------------------
// • visitor_id persistent (localStorage) + session_id (30 min sliding)
// • pageview / heartbeat (timp pe pagină) / click (pt heatmap) / funnel
// • atribuire campanie: ?c={code} + utm_source (+ via_qr) — persistată 30 zile
// • integrări externe (Microsoft Clarity / GA4 / Meta Pixel) injectate DOAR
//   dacă ID-urile sunt configurate în Admin → Analytics & Growth → Integrări.
// Compat: exportă trackPageView (folosit de AnalyticsRouteTracker din App.js)
// și se auto-inițializează la import (index.js importă modulul side-effect).
// ============================================================================
const API = process.env.REACT_APP_BACKEND_URL;
const VISITOR_KEY = "pm_vid";
const SESSION_KEY = "pm_sid";
const ATTR_KEY = "pm_attr"; // {c, utm_source, via_qr, ts}
const SESSION_TTL = 30 * 60 * 1000;
const ATTR_TTL = 30 * 24 * 3600 * 1000;

let queue = [];
let flushTimer = null;
let pageEnteredAt = Date.now();
let heartbeatAcc = 0;
let currentPath = typeof window !== "undefined" ? window.location.pathname : "/";

const uid = () =>
  (window.crypto?.randomUUID ? window.crypto.randomUUID() : `${Date.now()}${Math.random().toString(36).slice(2)}`)
    .replace(/-/g, "").slice(0, 32);

const getVisitorId = () => {
  let v = localStorage.getItem(VISITOR_KEY);
  if (!v) { v = uid(); localStorage.setItem(VISITOR_KEY, v); }
  return v;
};

const getSessionId = () => {
  try {
    const raw = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
    if (raw && Date.now() - raw.t < SESSION_TTL) {
      raw.t = Date.now();
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(raw));
      return raw.id;
    }
  } catch { /* noop */ }
  const s = { id: uid(), t: Date.now() };
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
  return s.id;
};

const captureAttribution = () => {
  const p = new URLSearchParams(window.location.search);
  const c = p.get("c") || "";
  const utm = p.get("utm_source") || "";
  const viaQr = p.get("via_qr") === "1";
  if (c || utm) {
    localStorage.setItem(ATTR_KEY, JSON.stringify({ c, utm_source: utm, via_qr: viaQr, ts: Date.now() }));
  }
};

const getAttribution = () => {
  try {
    const a = JSON.parse(localStorage.getItem(ATTR_KEY) || "null");
    if (a && Date.now() - a.ts < ATTR_TTL) return a;
  } catch { /* noop */ }
  return { c: "", utm_source: "", via_qr: false };
};

const push = (ev) => {
  const attr = getAttribution();
  queue.push({
    referrer: document.referrer || "",
    utm_source: attr.utm_source,
    campaign_code: attr.c,
    via_qr: !!attr.via_qr,
    ts: new Date().toISOString(),
    ...ev,
  });
  if (queue.length >= 12) flush();
  else if (!flushTimer) flushTimer = setTimeout(flush, 5000);
};

const flush = (useBeacon = false) => {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  if (!queue.length) return;
  const body = JSON.stringify({
    visitor_id: getVisitorId(),
    session_id: getSessionId(),
    events: queue.splice(0, 50),
  });
  try {
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(`${API}/api/track`, new Blob([body], { type: "application/json" }));
    } else {
      fetch(`${API}/api/track`, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch { /* noop */ }
};

const flushTimeOnPage = (useBeacon = false) => {
  const dur = Date.now() - pageEnteredAt + heartbeatAcc;
  heartbeatAcc = 0;
  pageEnteredAt = Date.now();
  if (dur > 500 && !currentPath.startsWith("/admin")) {
    push({ type: "heartbeat", path: currentPath, duration_ms: Math.min(dur, 3600000) });
  }
  if (useBeacon) flush(true);
};

// ── API public ───────────────────────────────────────────────────────────────
export const trackPageView = (pathWithSearch) => {
  const path = (pathWithSearch || "/").split("?")[0];
  if (path === currentPath && queue.some((q) => q.type === "pageview" && q.path === path)) return;
  flushTimeOnPage();
  currentPath = path;
  if (path.startsWith("/admin")) return; // traficul admin nu intră în statistici
  push({ type: "pageview", path });
  // forward către GA4 dacă e activ
  if (window.gtag) window.gtag("event", "page_view", { page_path: path });
};

export const trackFunnel = (step) => {
  // step: signup_started | account_created | property_added | subscription | specialist_request
  push({ type: "funnel", funnel_step: step, path: currentPath });
  flush();
};

// A/B testing: variantă deterministă per vizitator (hash vid+key) + expunere trimisă o dată/sesiune
export const getAbVariant = (key) => {
  const s = getVisitorId() + key;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  const variant = h % 2 === 0 ? "A" : "B";
  const seenKey = `pm_ab_${key}`;
  try {
    if (!sessionStorage.getItem(seenKey)) {
      sessionStorage.setItem(seenKey, variant);
      push({ type: "ab", path: currentPath, ab_key: key, ab_variant: variant });
      flush();
    }
  } catch { /* noop */ }
  return variant;
};

// ── Integrări externe (modulare — se pot adăuga altele fără schimbări) ──────
const injectClarity = (id) => {
  if (!id || window.clarity) return;
  /* eslint-disable */
  (function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", id);
  /* eslint-enable */
};

const injectGA4 = (id) => {
  if (!id || window.gtag) return;
  const s = document.createElement("script");
  s.async = true; s.src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", id, { anonymize_ip: true });
};

const injectMetaPixel = (id) => {
  if (!id || window.fbq) return;
  /* eslint-disable */
  !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
  n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
  document,'script','https://connect.facebook.net/en_US/fbevents.js');
  window.fbq('init', id); window.fbq('track', 'PageView');
  /* eslint-enable */
};

// ── Init (auto la import) ────────────────────────────────────────────────────
let initialized = false;
export function initAnalytics() {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  captureAttribution();
  if (!currentPath.startsWith("/admin")) push({ type: "pageview", path: currentPath });

  // click tracking (throttled, coordonate % — pt heatmap Faza 2)
  let lastClick = 0;
  document.addEventListener("click", (e) => {
    const now = Date.now();
    if (now - lastClick < 800 || currentPath.startsWith("/admin")) return;
    lastClick = now;
    push({
      type: "click", path: currentPath,
      x_pct: +((e.clientX / window.innerWidth) * 100).toFixed(1),
      y_pct: +(((e.clientY + window.scrollY) / Math.max(document.body.scrollHeight, 1)) * 100).toFixed(1),
    });
  }, { passive: true });

  // timp pe pagină la ascundere/închidere tab
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushTimeOnPage(true);
    else pageEnteredAt = Date.now();
  });
  window.addEventListener("pagehide", () => flushTimeOnPage(true));

  // integrări externe din config (Clarity / GA4 / Meta Pixel)
  fetch(`${API}/api/track/config`).then((r) => r.json()).then((cfg) => {
    injectClarity(cfg.clarity_id);
    injectGA4(cfg.ga4_id);
    injectMetaPixel(cfg.meta_pixel_id);
  }).catch(() => {});
}

initAnalytics();
