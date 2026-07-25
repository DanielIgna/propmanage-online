import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Plus, Building2, Wrench, MessageCircle, Sparkles, ShieldCheck, ChevronRight,
  CreditCard, Star, Bell, Brain,
} from "lucide-react";
import { GREEN, CTA, Steps, stepForStatus, Skeleton } from "./ui";
import { API } from "../DashShared";

const IMG_TWIN = "https://images.unsplash.com/photo-1721244654394-36a7bc2da288?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NDk1Nzh8MHwxfHNlYXJjaHwyfHxhcmNoaXRlY3R1cmFsJTIwYmx1ZXByaW50JTIwYnVpbGRpbmd8ZW58MHx8fHwxNzg0OTkwMDEyfDA&ixlib=rb-4.1.0&q=85&w=800";
const IMG_HEALTH = "https://images.pexels.com/photos/36035073/pexels-photo-36035073.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940";
const IMG_GUIDE = "https://static.prod-images.emergentagent.com/jobs/c0629304-e2e2-4a6f-8f15-5c4c3ef257d1/images/7b363db9e5f2b9781098798793b0f1746f212980f43a212562902c1e28838a43.jpeg";

// Copilot — „Care e următoarea acțiune pentru casa ta?" (Blueprint Faza 4)
const CopilotCard = ({ go, actions, hasProps }) => {
  const [data, setData] = useState(null);
  const [summary, setSummary] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    axios.get(`${API}/client/copilot`).then(r => setData(r.data)).catch(() => {});
  }, []);

  const run = (a) => {
    if (a.cta === "jobs") go("jobs");
    else if (a.cta === "property") (hasProps ? go("property") : actions.openPropManager());
    else if (a.cta === "request") actions.openWizard();
  };

  const askAI = async () => {
    setBusy(true);
    try {
      const { data: d } = await axios.get(`${API}/client/copilot/summary`);
      setSummary(d.summary);
    } catch {
      setSummary("Rezumatul AI e temporar indisponibil — reîncearcă în câteva minute.");
    }
    setBusy(false);
  };

  if (!data?.actions?.length) return null;
  return (
    <div className="mx-5 mt-6 lg:mx-0 lg:mt-0 cv2-fade cv2-d2" data-testid="v2-copilot-card">
      <div className="rounded-3xl xos-accent-panel p-4 lg:p-5">
        <div className="flex items-center gap-2.5">
          <span className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 bg-[#ccff00]">
            <Sparkles className="text-black" style={{ width: 18, height: 18 }} />
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-black text-slate-900 leading-none xos-display tracking-tight">Copilot</div>
            <div className="text-[10px] text-slate-400 mt-0.5">următoarea acțiune pentru casa ta</div>
          </div>
          <button onClick={askAI} disabled={busy} data-testid="v2-copilot-ai-btn"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black bg-[#166534]/5 text-[#166534] disabled:opacity-50">
            <Brain className={`w-3.5 h-3.5 ${busy ? "animate-pulse" : ""}`} />
            {busy ? "Gândește..." : "Rezumat AI"}
          </button>
        </div>
        {summary && (
          <p className="mt-3 text-xs leading-relaxed text-slate-600 rounded-2xl p-3 bg-[#166534]/5" data-testid="v2-copilot-summary">
            {summary}
          </p>
        )}
        <div className="mt-3 space-y-2">
          {data.actions.map((a) => (
            <button key={a.kind} onClick={() => run(a)} data-testid={`v2-copilot-action-${a.kind}`}
              className="w-full flex items-center gap-2.5 rounded-2xl border border-slate-100 bg-white p-3 text-left active:scale-[0.98] transition-transform">
              <span className="w-1.5 h-1.5 rounded-full shrink-0 bg-[#166534]" />
              <span className="text-xs font-semibold text-slate-700 flex-1 leading-snug">{a.text}</span>
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Hero A — fără proprietate
const HeroA = ({ onAddProperty }) => (
  <div className="mx-5 lg:mx-0 rounded-3xl p-5 lg:p-8 text-black shadow-[0_20px_60px_-20px_rgba(204,255,0,0.4)]" style={{ background: "linear-gradient(135deg, #b3e600 0%, #ccff00 100%)" }} data-testid="v2-hero-a">
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-black/60"><Sparkles className="w-3.5 h-3.5" /> Pasul 1 din 3 · 2 minute</div>
    <h1 className="mt-2 xos-display text-2xl lg:text-4xl font-medium tracking-tight leading-snug">Hai să pornim: adaugă prima ta proprietate</h1>
    <div className="mt-3 h-1.5 rounded-full bg-black/15"><div className="h-full w-1/3 rounded-full bg-black" /></div>
    <button onClick={onAddProperty} className="mt-4 w-full lg:w-auto lg:px-10 py-3.5 rounded-full bg-black text-[#ccff00] text-sm font-black active:scale-[0.98] transition-transform" data-testid="v2-hero-cta">
      Adaugă proprietatea
    </button>
  </div>
);

// Hero B — cu proprietate, fără lucrare activă
const HeroB = ({ prop, confirmedCount, onRequest }) => (
  <div className="mx-5 lg:mx-0 rounded-3xl p-5 lg:p-8 border border-slate-100 bg-white shadow-sm" data-testid="v2-hero-b">
    <div className="flex items-center gap-3">
      <span className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 bg-[#166534]/5">
        <ShieldCheck className="w-6 h-6 text-[#166534]" />
      </span>
      <div>
        <h1 className="xos-display text-lg lg:text-2xl font-medium tracking-tight text-slate-900 leading-snug">Totul e în regulă la {prop?.name}</h1>
        <div className="mt-0.5 text-xs text-slate-400">{confirmedCount > 0 ? `${confirmedCount} lucrări finalizate` : "nicio lucrare în derulare"} · totul la zi</div>
      </div>
    </div>
    <div className="mt-4 lg:max-w-xs"><CTA testid="v2-hero-cta" onClick={onRequest}>Solicită un serviciu</CTA></div>
  </div>
);

// Hero C — lucrare activă (date reale)
const HeroC = ({ req, offersCount, onCta }) => {
  const step = stepForStatus(req.status);
  let cta = "Deschide lucrarea";
  let sub = "lucrarea ta e în derulare";
  if (req.status === "open") { cta = offersCount > 0 ? `Vezi ofertele (${offersCount})` : "Vezi cererea"; sub = offersCount > 0 ? "Specialiștii așteaptă răspunsul tău" : "Așteptăm ofertele specialiștilor"; }
  else if (req.status === "assigned" && !req.escrow_amount) { cta = "Plătește avansul (escrow)"; sub = `${req.specialist_name || "Specialistul"} e pregătit — plata rămâne protejată până confirmi lucrarea`; }
  else if (req.status === "assigned") { sub = `${req.specialist_name || "Specialist"} · plata e în escrow`; }
  else if (req.status === "in_progress") { sub = `${req.specialist_name || "Specialistul"} lucrează acum`; }
  else if (req.status === "completed") { cta = "Confirmă & eliberează plata"; sub = "Specialistul a marcat lucrarea ca finalizată"; }
  return (
    <div className="mx-5 lg:mx-0 rounded-3xl p-5 lg:p-8 border border-slate-100 bg-white shadow-sm" data-testid="v2-hero-c">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-[#166534]">
        <span className="w-2 h-2 rounded-full animate-pulse bg-[#166534]" /> Lucrare activă
      </div>
      <h1 className="mt-1.5 xos-display text-xl lg:text-3xl font-medium tracking-tight text-slate-900 leading-snug">{req.title}</h1>
      <p className="mt-1 text-xs lg:text-sm text-slate-400">{sub}</p>
      <div className="mt-4 lg:max-w-lg"><Steps current={step} /></div>
      <div className="mt-4 lg:max-w-xs"><CTA testid="v2-hero-cta" onClick={onCta}>{cta}</CTA></div>
    </div>
  );
};

export const HomeSkeleton = () => (
  <div data-testid="v2-home-skeleton">
    <div className="mx-5"><Skeleton className="h-40 rounded-3xl" /></div>
    <div className="mx-5 mt-5 grid grid-cols-2 gap-3">
      {[0, 1, 2, 3].map(i => <Skeleton key={i} className="min-h-[100px]" />)}
    </div>
    <div className="mx-5 mt-6"><Skeleton className="h-16" /></div>
  </div>
);

// Bento pe desktop: hero 7 col / copilot 5 col; mobil rămâne stivă (mobile-first)
const WIDGET_SPAN = {
  hero: "lg:col-span-7",
  quick_actions: "lg:col-span-7",
  copilot: "lg:col-span-5 lg:row-span-2",
  contextual: "lg:col-span-7",
  discover: "lg:col-span-12",
};

export const HomeV2 = ({ user, prop, properties, requests, notifs, offersCount, go, actions }) => {
  const navigate = useNavigate();
  const [layout, setLayout] = useState([
    { id: "hero", enabled: true }, { id: "quick_actions", enabled: true }, { id: "copilot", enabled: true },
    { id: "contextual", enabled: true }, { id: "discover", enabled: true },
  ]);
  const [hidden, setHidden] = useState([]);
  useEffect(() => {
    axios.get(`${API}/xos/layout/client_home`).then(r => { if (r.data.items?.length) setLayout(r.data.items); }).catch(() => {});
    axios.get(`${API}/ui-rules/my`).then(r => setHidden(r.data.hidden || [])).catch(() => {});
  }, []);
  const activeReqs = requests.filter(r => r.status !== "confirmed");
  const activeReq = activeReqs[0];
  const confirmedCount = requests.filter(r => r.status === "confirmed").length;
  const unread = notifs.filter(n => !n.read);

  const heroCta = () => {
    if (!activeReq) return;
    if (activeReq.status === "open" && offersCount > 0) navigate(`/client/requests/${activeReq.id}/offers`);
    else if (activeReq.status === "assigned" && !activeReq.escrow_amount) actions.payEscrow(activeReq.id);
    else if (activeReq.status === "completed") actions.confirmRequest(activeReq.id, activeReq);
    else go("jobs");
  };

  // carduri contextuale REALE — apar doar când condiția e adevărată
  const contextual = [];
  if (activeReq?.status === "open" && offersCount > 0) contextual.push({ icon: Star, text: `${offersCount} oferte la «${activeReq.title}»`, cta: "Compară", onClick: () => navigate(`/client/requests/${activeReq.id}/offers`), tid: "v2-ctx-offers" });
  const payReq = requests.find(r => r.status === "assigned" && !r.escrow_amount);
  if (payReq) contextual.push({ icon: CreditCard, text: `Plată în așteptare pentru «${payReq.title}»`, cta: "Plătește", onClick: () => actions.payEscrow(payReq.id), tid: "v2-ctx-pay" });
  const doneReq = requests.find(r => r.status === "completed");
  if (doneReq) contextual.push({ icon: ShieldCheck, text: `«${doneReq.title}» a fost finalizată — confirmă lucrarea`, cta: "Confirmă", onClick: () => actions.confirmRequest(doneReq.id, doneReq), tid: "v2-ctx-confirm" });
  if (contextual.length < 2 && unread[0]) contextual.push({ icon: Bell, text: unread[0].title, cta: "Vezi", onClick: actions.openNotifs, tid: "v2-ctx-notif" });

  // XOS: widget-uri randate în ordinea/vizibilitatea din Layout Builder + UI Rules
  const widgets = {
    hero: (
      <div className="cv2-fade" key="hero">
        {properties.length === 0 ? <HeroA onAddProperty={actions.openPropManager} />
          : activeReq ? <HeroC req={activeReq} offersCount={offersCount} onCta={heroCta} />
          : <HeroB prop={prop} confirmedCount={confirmedCount} onRequest={actions.openWizard} />}
      </div>
    ),
    quick_actions: (
      <div key="quick_actions" className="mx-5 mt-5 lg:mx-0 lg:mt-0 grid grid-cols-2 lg:grid-cols-4 gap-3 cv2-fade cv2-d1" data-testid="v2-actions">
        {[
          [Plus, "Solicită", "serviciu nou", actions.openWizard, "v2-action-request", "text-[#166534]", false],
          [Building2, "Proprietatea", prop ? prop.name : "adaugă prima", () => go("property"), "v2-action-property", "text-sky-600", false],
          [Wrench, "Lucrări", activeReqs.length ? `${activeReqs.length} active` : "istoric", () => go("jobs"), "v2-action-jobs", "text-amber-600", false],
          [MessageCircle, "Întreabă AI", "asistent 24/7", actions.openAI, "v2-action-ai", "text-violet-600", true],
        ].map(([Icon, label, sub, onClick, tid, color, aiGlow]) => (
          <button key={label} onClick={onClick} data-testid={tid}
            className={`rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm min-h-[104px] transition-transform duration-300 hover:-translate-y-1 active:scale-[0.97] ${aiGlow ? "xos-ai-glow" : ""}`}>
            <Icon className={`w-5 h-5 ${color}`} strokeWidth={1.9} />
            <div className="mt-3 text-sm font-black text-slate-900">{label}</div>
            <div className="text-[10px] text-slate-400 font-medium truncate">{sub}</div>
          </button>
        ))}
      </div>
    ),
    copilot: <CopilotCard key="copilot" go={go} actions={actions} hasProps={properties.length > 0} />,
    contextual: contextual.length > 0 ? (
      <div key="contextual" className="mx-5 mt-6 lg:mx-0 lg:mt-0 cv2-fade cv2-d2" data-testid="v2-contextual">
          <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 px-1">Noutăți pentru tine</h3>
          <div className="mt-2 space-y-2">
            {contextual.slice(0, 2).map(({ icon: Icon, text, cta, onClick, tid }) => (
              <button key={tid} onClick={onClick} data-testid={tid}
                className="w-full flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm text-left active:scale-[0.98] transition-transform">
                <Icon className="w-4.5 h-4.5 shrink-0 text-[#166534]" style={{ width: 18, height: 18 }} />
                <span className="text-xs font-semibold text-slate-700 flex-1 leading-snug">{text}</span>
                <span className="text-[11px] font-black flex items-center shrink-0 text-[#166534]">{cta}<ChevronRight className="w-3.5 h-3.5" /></span>
              </button>
            ))}
          </div>
        </div>
    ) : null,
    discover: (
      <div key="discover" className="mt-7 lg:mt-2 pb-8 cv2-fade cv2-d3" data-testid="v2-discover">
        <h3 className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400 px-6 lg:px-1">Descoperă</h3>
        <div className="mt-2 flex gap-3 overflow-x-auto px-5 lg:px-0 lg:grid lg:grid-cols-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[
            ["Digital Twin", "locuința ta în 3D", IMG_TWIN, actions.openTwin],
            ["House Health", "scorul casei tale", IMG_HEALTH, actions.openHealth],
            ["Ghid întreținere", "sfaturi sezoniere", IMG_GUIDE, actions.openAI],
          ].map(([l, s, img, onClick]) => (
            <button key={l} onClick={onClick}
              className="group relative shrink-0 w-44 h-28 lg:w-full lg:h-36 rounded-2xl overflow-hidden text-left shadow-sm transition-transform duration-300 hover:-translate-y-1">
              <img src={img} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" aria-hidden="true" />
              <span className="relative z-10 flex h-full flex-col justify-end p-3.5">
                <span className="text-xs lg:text-sm font-black xos-on-image">{l}</span>
                <span className="text-[10px] xos-on-image-muted">{s}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    ),
  };

  const visible = layout.filter(w => w.enabled && !hidden.includes(`widget:${w.id}`) && widgets[w.id]);
  return (
    <div className="lg:grid lg:grid-cols-12 lg:gap-6 lg:grid-flow-dense lg:items-start lg:px-5">
      {visible.map(w => (
        <div key={w.id} className={WIDGET_SPAN[w.id] || "lg:col-span-12"}>{widgets[w.id]}</div>
      ))}
    </div>
  );
};
