/**
 * Lightweight Google Analytics 4 (GA4) loader.
 * Activates only if REACT_APP_GA4_MEASUREMENT_ID is set (e.g. G-XXXXXXXXXX).
 * Tracks page views automatically on route changes.
 */

const MEASUREMENT_ID = (process.env.REACT_APP_GA4_MEASUREMENT_ID || "").trim();

let _loaded = false;

export function initAnalytics() {
  if (_loaded) return;
  if (typeof window === "undefined") return;
  if (!MEASUREMENT_ID || !MEASUREMENT_ID.startsWith("G-")) return;

  // Inject gtag.js script
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag() { window.dataLayer.push(arguments); };
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID, {
    send_page_view: true,
    anonymize_ip: true,
  });
  _loaded = true;
  // eslint-disable-next-line no-console
  console.info(`[analytics] GA4 initialized with ${MEASUREMENT_ID}`);
}

export function trackPageView(path) {
  if (!_loaded || typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", "page_view", { page_path: path });
}

export function trackEvent(name, params = {}) {
  if (!_loaded || typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, params);
}

export const ANALYTICS_ENABLED = !!MEASUREMENT_ID;

initAnalytics();
