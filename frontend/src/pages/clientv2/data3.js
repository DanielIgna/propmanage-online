// Date Client Beta (UX aprobat) — DOAR API-uri existente; backend-ul rămâne sursa de adevăr.
import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { API } from "../DashShared";

const get = (url) => axios.get(url).then(r => r.data).catch(() => null);

export function useHouseData(prop) {
  const [d, setD] = useState({ loaded: false });
  const propId = prop?.id || null;

  const load = useCallback(async () => {
    const [copilot, journey, engagement, opps, hh, maint, wallet, pulse, rules] = await Promise.all([
      get(`${API}/copilot/dashboard`), get(`${API}/journey/house`), get(`${API}/engagement/summary`), get(`${API}/client/opportunities`),
      get(`${API}/house-health/dashboard`), get(`${API}/maintenance/tasks`), get(`${API}/benefits/wallet`), get(`${API}/benefits/pulse`), get(`${API}/ui-rules/my`),
    ]);
    let pd = {};
    if (propId) {
      const [completeness, dna, maturity, risks, assets, docs, ptr, attrs] = await Promise.all([
        get(`${API}/properties/${propId}/completeness`), get(`${API}/properties/${propId}/dna`),
        get(`${API}/properties/${propId}/maturity`), get(`${API}/properties/${propId}/risks`),
        get(`${API}/properties/${propId}/assets`), get(`${API}/properties/${propId}/documents`),
        get(`${API}/properties/${propId}/technical-record`), get(`${API}/properties/${propId}/dna-attributes`),
      ]);
      pd = { completeness, dna, maturity, risks, assets, docs, ptr, attrs: attrs?.attributes || [] };
    }
    setD({
      loaded: true, copilot, journey, engagement, opps: opps?.opportunities || [], hh, maint: maint?.tasks || [], wallet,
      plan: pulse?.plan || null, hidden: rules?.hidden || [], ...pd,
    });
  }, [propId]);

  useEffect(() => {
    load();
    window.addEventListener("propmanage:doc-uploaded", load);
    return () => window.removeEventListener("propmanage:doc-uploaded", load);
  }, [load]);

  const update = useCallback((partial) => setD(p => ({ ...p, ...partial })), []);
  return { ...d, reload: load, update };
}

// ── Lucrări: CERERE → OFERTE → ÎN LUCRU → FINALIZAT ─────────────────────────
export const STAGES = [
  { id: "cerere", label: "Cerere", statuses: ["open"], hint: "aștepți oferte" },
  { id: "oferte", label: "Oferte", statuses: ["assigned"], hint: "specialist ales" },
  { id: "in_lucru", label: "În lucru", statuses: ["in_progress"], hint: "se execută" },
  { id: "finalizat", label: "Finalizat", statuses: ["completed"], hint: "de confirmat" },
];
export const stageOf = (r) => STAGES.find(s => s.statuses.includes(r.status)) || null;

// Ce trebuie să facă utilizatorul pentru o lucrare (o singură acțiune clară)
export const jobAction = (r, offersCount = 0) => {
  if (r.status === "assigned" && !r.escrow_amount) return { kind: "pay", urgent: true, label: "Plătește avansul", why: `${r.specialist_name || "Specialistul"} e pregătit · banii rămân protejați până confirmi` };
  if (r.status === "completed") return { kind: "confirm", urgent: true, label: "Confirmă lucrarea", why: "Specialistul a marcat lucrarea finalizată — confirmă ca să eliberezi plata" };
  if (r.status === "open") return { kind: "offers", urgent: offersCount > 0, label: offersCount > 0 ? `Compară ${offersCount} oferte` : "Vezi ofertele", why: offersCount > 0 ? "Specialiștii așteaptă răspunsul tău" : "Așteptăm ofertele specialiștilor" };
  if (r.status === "assigned") return { kind: "open", urgent: false, label: "Istoric", why: `${r.specialist_name || "Specialist"} · avans plătit, urmează execuția` };
  if (r.status === "in_progress") return { kind: "open", urgent: false, label: "Istoric", why: `${r.specialist_name || "Specialistul"} lucrează acum` };
  return null;
};

// ── Acasă: „De făcut acum" — max 3, din date reale, o acțiune per rând ──────
export function buildTodo(d) {
  const reqs = d.requests || [];
  const items = [];
  const done = reqs.filter(r => r.status === "completed");
  const pay = reqs.filter(r => r.status === "assigned" && !r.escrow_amount);
  const open = reqs.filter(r => r.status === "open");
  const overdue = (d.maint || []).filter(t => t.status === "overdue");
  const oc = d.offersCount || 0;
  if (done[0]) items.push({ id: "confirm", tone: "lime", title: `«${done[0].title}» e gata de confirmat`, sub: "Confirmi și plata se eliberează către specialist.", cta: "Confirmă", kind: "confirm", req: done[0], more: done.length - 1, moreLabel: "de confirmat" });
  if (pay[0]) items.push({ id: "pay", tone: "amber", title: `Avans de plătit la «${pay[0].title}»`, sub: `${pay[0].specialist_name || "Specialistul"} e pregătit · plata rămâne protejată (escrow) până confirmi.`, cta: "Plătește", kind: "pay", req: pay[0], more: pay.length - 1, moreLabel: "așteaptă avansul" });
  if (open[0]) items.push({ id: "offers", tone: "sky", title: oc > 0 ? `${oc} oferte la «${open[0].title}»` : `«${open[0].title}» așteaptă oferte`, sub: oc > 0 ? "Specialiștii așteaptă răspunsul tău — compară și alege." : "Te anunțăm când primești oferte de la specialiști verificați.", cta: oc > 0 ? "Compară" : "Vezi cererea", kind: "offers", req: open[0], more: open.length - 1, moreLabel: "cereri deschise" });
  if (overdue[0]) items.push({ id: "maint", tone: "rose", title: `Revizie depășită: ${overdue[0].title}`, sub: "Solicită oferta în 1 click — taskul se reprogramează după finalizare.", cta: "Solicită", kind: "maint", task: overdue[0], more: overdue.length - 1, moreLabel: "revizii depășite" });
  return items.slice(0, 3);
}

// ── Indicatorii casei — UN singur loc care explică fiecare scor ─────────────
export function buildIndicators(d) {
  const hs = d.copilot?.house_score;
  const c = d.completeness;
  const pvi = d.dna?.pvi;
  const m = d.maturity;
  const hh = d.hh;
  const rd = d.journey?.readiness;
  const list = [];
  if (hs) list.push({ id: "scor", label: "Scorul casei", value: hs.score, max: 100, pct: hs.score,
    meaning: "Cât de bine e cunoscută și îngrijită casa ta în PropManage: documente, Digital Twin, sănătate, lucrări, beneficii și comunitate — într-un singur număr.",
    how: (hs.items || []).map(i => ({ label: i.label, points: Math.round(i.points), max: i.max, hint: i.hint })),
    improve: hs.top_gap ? `${hs.top_gap.label}: ${hs.top_gap.hint} (până la +${Math.round(hs.top_gap.potential)} puncte)` : null, go: ["house", "rezumat"] });
  if (c) list.push({ id: "carte", label: "Cartea casei", value: c.score, max: 100, suffix: "%", pct: c.score,
    meaning: "Cât din documentația importantă a casei e adunată într-un loc: acte, planuri, fotografii, garanții, instalații. Este memoria permanentă a locuinței.",
    how: (c.items || []).map(i => ({ label: i.label, points: i.earned, max: i.max })),
    improve: c.next_step ? `${c.next_step.label} (+${c.next_step.expected_gain}%)` : null, go: ["house", "carte"] });
  if (pvi) list.push({ id: "pvi", label: "Valoarea documentată (PVI)", value: pvi.score, max: 100, pct: pvi.score,
    meaning: "Cât de bine poți DOVEDI valoarea casei — la vânzare, credit sau asigurare — prin documente, lucrări confirmate și audituri. Nu este prețul de piață.",
    how: (pvi.reasons || []).map(r => ({ label: r.label, points: r.points, max: r.max })),
    improve: (pvi.reasons || []).find(r => !r.done)?.label || null, go: ["house", "rezumat"] });
  if (m) list.push({ id: "twin", label: "Digital Twin", value: `L${m.level}`, sub: m.level_label, pct: Math.round((m.level / 5) * 100),
    meaning: "Cât de „vie” e copia digitală a casei: de la înregistrată, la documentată, activă, monitorizată și predictivă (L0–L5).",
    how: (m.criteria || []).map(cr => ({ label: `L${cr.level} · ${cr.label}`, points: cr.ok ? 1 : 0, max: 1, hint: cr.hint })),
    improve: m.next_step?.title || null, go: ["house", "echipamente"] });
  if (hh && hh.enabled !== false && !hh.locked) list.push({ id: "hh", label: "House Health", value: hh.score_overall, max: 100, pct: hh.score_overall,
    sub: { Excellent: "Excelent", Good: "Bine", Fair: "Acceptabil", "Needs Attention": "Necesită atenție" }[hh.classification] || hh.classification,
    meaning: "Starea de sănătate a casei — aer, umiditate, siguranță, sisteme — evaluată periodic prin abonamentul House Health.",
    how: [], improve: "Programează următoarea evaluare House Health.", go: ["house", "riscuri"] });
  if (rd) list.push({ id: "readiness", label: "Pregătire tranzacție", value: rd.score, max: 100, pct: rd.score,
    meaning: rd.note || "Cât de pregătită e casa pentru administrare, credit sau vânzare — pe baza documentației.",
    how: (rd.dimensions || []).map(x => ({ label: x.label, points: x.pct, max: 100, hint: x.missing?.map(mm => mm.label).join(" · ") })),
    improve: rd.dimensions?.find(x => x.missing?.length)?.missing?.[0]?.label || null, go: ["house", "dosar"] });
  return list;
}

export const timeAgo = (iso) => {
  if (!iso) return "";
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "azi"; if (days === 1) return "ieri"; if (days < 30) return `acum ${days} zile`;
  return new Date(iso).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" });
};
export const fmtDate = (d) => (d ? new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString("ro-RO", { day: "numeric", month: "short", year: "numeric" }) : "—");
