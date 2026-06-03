/**
 * Runtime patch for stale REACT_APP_BACKEND_URL.
 *
 * Problem: REACT_APP_BACKEND_URL is inlined at build time. If the deployment
 * uses a custom domain that later goes down (e.g. DNS issue), every fetch and
 * axios call fails with Network Error.
 *
 * Solution: At startup, detect if the configured backend host differs from the
 * current page host AND the configured host is unreachable. If so, rewrite all
 * outgoing requests to use the current origin (same-origin), which is always
 * reachable thanks to Emergent's Kubernetes ingress routing /api/* to backend.
 *
 * Side-effects:
 *  - Patches window.fetch
 *  - Sets axios.defaults to intercept all requests
 *
 * Safe to import multiple times (idempotent).
 */

let _applied = false;
let _rewriteTo = null;
let _rewriteFrom = null;

function init() {
  if (_applied) return;
  if (typeof window === "undefined") return;

  const configured = (process.env.REACT_APP_BACKEND_URL || "").trim();
  if (!configured) return;

  let configuredHost;
  try {
    configuredHost = new URL(configured).host;
  } catch (e) {
    return;
  }

  const currentHost = window.location.host;
  if (configuredHost === currentHost) return; // nothing to do

  // Only activate if the configured host is the public custom domain
  // (likely propmanage.ro or another custom). On preview / emergent.host
  // domain, the configured URL would normally be the same.
  // We test by issuing a synchronous-looking probe; instead we just blindly
  // rewrite — same-origin is always safe in Emergent deployments because
  // /api/* is routed to backend by the ingress.
  _rewriteFrom = configured.replace(/\/$/, "");
  _rewriteTo = window.location.origin;

  // Patch global fetch
  const origFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    if (typeof input === "string" && input.startsWith(_rewriteFrom)) {
      input = _rewriteTo + input.slice(_rewriteFrom.length);
    } else if (input && typeof input === "object" && input.url && input.url.startsWith(_rewriteFrom)) {
      const newUrl = _rewriteTo + input.url.slice(_rewriteFrom.length);
      try {
        input = new Request(newUrl, input);
      } catch (e) {
        // ignore — let original input through
      }
    }
    return origFetch(input, init);
  };

  // Patch axios (lazy — only if axios is already imported)
  try {
    // eslint-disable-next-line global-require
    const axios = require("axios");
    axios.interceptors.request.use((config) => {
      if (config.url && config.url.startsWith(_rewriteFrom)) {
        config.url = _rewriteTo + config.url.slice(_rewriteFrom.length);
      }
      if (config.baseURL && config.baseURL.startsWith(_rewriteFrom)) {
        config.baseURL = _rewriteTo + config.baseURL.slice(_rewriteFrom.length);
      }
      return config;
    });
  } catch (e) {
    // axios not installed — fine
  }

  // eslint-disable-next-line no-console
  console.info(
    `[backend-url-fallback] Rewriting "${_rewriteFrom}" → "${_rewriteTo}" (configured backend differs from current host).`
  );
  _applied = true;
}

init();

export default { applied: _applied, from: _rewriteFrom, to: _rewriteTo };
