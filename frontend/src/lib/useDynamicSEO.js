import { useEffect } from "react";
import axios from "axios";

const API = process.env.REACT_APP_BACKEND_URL;
let _cache = null;
let _cachePromise = null;

function fetchSettings() {
  if (_cache) return Promise.resolve(_cache);
  if (_cachePromise) return _cachePromise;
  _cachePromise = axios
    .get(`${API}/api/app-settings/public`)
    .then(r => { _cache = r.data; return _cache; })
    .catch(() => null);
  return _cachePromise;
}

function applyMeta(title, description, ogImage) {
  if (title) document.title = title;
  if (description) {
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement("meta"); m.name = "description"; document.head.appendChild(m); }
    m.content = description;
  }
  const setOG = (prop, content) => {
    if (!content) return;
    let m = document.querySelector(`meta[property="${prop}"]`);
    if (!m) { m = document.createElement("meta"); m.setAttribute("property", prop); document.head.appendChild(m); }
    m.content = content;
  };
  setOG("og:title", title);
  setOG("og:description", description);
  setOG("og:image", ogImage);
}

/**
 * Apply dynamic SEO meta tags from admin-configured settings.
 * `pageKey` matches a section in seo settings (e.g. "home", "estate", "whyus", "sell", "client", "specialist").
 * `fallback` is used if settings aren't loaded yet or missing.
 */
export function useDynamicSEO(pageKey, fallback = {}) {
  useEffect(() => {
    let cancelled = false;
    fetchSettings().then(s => {
      if (cancelled) return;
      const seo = s?.seo || {};
      const title = seo[`${pageKey}_title`] || fallback.title || document.title;
      const description = seo[`${pageKey}_description`] || fallback.description || "";
      const ogImage = seo.og_image || fallback.ogImage || "";
      applyMeta(title, description, ogImage);
    });
    return () => { cancelled = true; };
  }, [pageKey, fallback.title, fallback.description, fallback.ogImage]);
}

/** Clear cached app settings — call after admin saves SEO to force fresh fetch on next navigation. */
export function invalidateSEOCache() {
  _cache = null;
  _cachePromise = null;
}
