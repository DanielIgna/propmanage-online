// Lightweight SEO helper — sets document.title and updates meta tags
// without adding react-helmet-async (saves ~10KB and avoids Provider wrapping).
//
// Usage:
//   useSEO({
//     title: "Marketplace specialiști verificați · PropManage",
//     description: "...",
//     canonical: "https://propmanage.ro/marketplace",
//     jsonLd: { ... }    // optional Schema.org payload
//   });
//
// On unmount it restores the previous title (so navigating away doesn't
// leave a stale tab title flicker).

import { useEffect } from "react";

const ensureMeta = (selector, attr, name, value) => {
  if (value == null) return;
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", String(value));
};

const ensureLink = (rel, href) => {
  if (!href) return;
  let el = document.head.querySelector(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
};

export const useSEO = ({ title, description, canonical, ogImage, jsonLd, noindex = false } = {}) => {
  useEffect(() => {
    const prevTitle = document.title;
    if (title) document.title = title;

    ensureMeta('meta[name="description"]',  "name",     "description",     description);
    ensureMeta('meta[property="og:title"]', "property", "og:title",        title);
    ensureMeta('meta[property="og:description"]', "property", "og:description", description);
    ensureMeta('meta[name="twitter:title"]', "name",    "twitter:title",   title);
    ensureMeta('meta[name="twitter:description"]', "name", "twitter:description", description);
    if (canonical) {
      ensureLink("canonical", canonical);
      ensureMeta('meta[property="og:url"]', "property", "og:url", canonical);
    }
    if (ogImage) {
      ensureMeta('meta[property="og:image"]', "property", "og:image", ogImage);
      ensureMeta('meta[name="twitter:image"]', "name", "twitter:image", ogImage);
    }
    if (noindex) {
      ensureMeta('meta[name="robots"]', "name", "robots", "noindex, nofollow");
    }

    // Inject JSON-LD into <head> with a marker attribute so we can remove it on cleanup.
    let scriptEl = null;
    if (jsonLd) {
      scriptEl = document.createElement("script");
      scriptEl.type = "application/ld+json";
      scriptEl.dataset.dynamicSeo = "true";
      scriptEl.textContent = JSON.stringify(jsonLd);
      document.head.appendChild(scriptEl);
    }

    return () => {
      document.title = prevTitle;
      if (scriptEl && scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl);
      if (noindex) {
        // Restore the global "index, follow" rule from index.html
        ensureMeta('meta[name="robots"]', "name", "robots", "index, follow, max-image-preview:large");
      }
    };
  }, [title, description, canonical, ogImage, JSON.stringify(jsonLd || null), noindex]);
};
