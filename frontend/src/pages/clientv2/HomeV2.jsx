import React from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Building2, Wrench, MessageCircle, Sparkles, ShieldCheck, ChevronRight,
  Box, HeartPulse, FileText, CreditCard, Star, Bell,
} from "lucide-react";
import { GREEN, GREEN_SOFT, CTA, Steps, stepForStatus, Skeleton } from "./ui";

// Hero A — fără proprietate
const HeroA = ({ onAddProperty }) => (
  <div className="mx-5 rounded-3xl p-5 text-black shadow-xl shadow-lime-900/10" style={{ background: "linear-gradient(135deg, #a3e635 0%, #d4ff3a 100%)" }} data-testid="v2-hero-a">
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/80"><Sparkles className="w-3.5 h-3.5" /> Pasul 1 din 3 · 2 minute</div>
    <h1 className="mt-2 text-[22px] font-black leading-snug">Hai să pornim: adaugă prima ta proprietate</h1>
    <div className="mt-3 h-1.5 rounded-full bg-white/25"><div className="h-full w-1/3 rounded-full bg-white" /></div>
    <button onClick={onAddProperty} className="mt-4 w-full py-3.5 rounded-full bg-white text-emerald-600 text-sm font-black active:scale-[0.98] transition-transform" data-testid="v2-hero-cta">
      Adaugă proprietatea
    </button>
  </div>
);

// Hero B — cu proprietate, fără lucrare activă
const HeroB = ({ prop, confirmedCount, onRequest }) => (
  <div className="mx-5 rounded-3xl p-5 border border-slate-100 bg-white shadow-sm" data-testid="v2-hero-b">
    <div className="flex items-center gap-3">
      <span className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0" style={{ background: GREEN_SOFT }}>
        <ShieldCheck className="w-6 h-6" style={{ color: GREEN }} />
      </span>
      <div>
        <h1 className="text-lg font-black text-slate-900 leading-snug">Totul e în regulă la {prop?.name}</h1>
        <div className="mt-0.5 text-xs text-slate-400">{confirmedCount > 0 ? `${confirmedCount} lucrări finalizate` : "nicio lucrare în derulare"} · totul la zi</div>
      </div>
    </div>
    <div className="mt-4"><CTA testid="v2-hero-cta" onClick={onRequest}>Solicită un serviciu</CTA></div>
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
    <div className="mx-5 rounded-3xl p-5 border border-slate-100 bg-white shadow-sm" data-testid="v2-hero-c">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider" style={{ color: GREEN }}>
        <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: GREEN }} /> Lucrare activă
      </div>
      <h1 className="mt-1.5 text-[20px] font-black text-slate-900 leading-snug">{req.title}</h1>
      <p className="mt-1 text-xs text-slate-400">{sub}</p>
      <div className="mt-3"><Steps current={step} /></div>
      <div className="mt-4"><CTA testid="v2-hero-cta" onClick={onCta}>{cta}</CTA></div>
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

export const HomeV2 = ({ user, prop, properties, requests, notifs, offersCount, go, actions }) => {
  const navigate = useNavigate();
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

  return (
    <>
      <div className="cv2-fade">
        {properties.length === 0 ? <HeroA onAddProperty={actions.openPropManager} />
          : activeReq ? <HeroC req={activeReq} offersCount={offersCount} onCta={heroCta} />
          : <HeroB prop={prop} confirmedCount={confirmedCount} onRequest={actions.openWizard} />}
      </div>

      <div className="mx-5 mt-5 grid grid-cols-2 gap-3 cv2-fade cv2-d1" data-testid="v2-actions">
        {[
          [Plus, "Solicită", "serviciu nou", actions.openWizard, "v2-action-request"],
          [Building2, "Proprietatea", prop ? prop.name : "adaugă prima", () => go("property"), "v2-action-property"],
          [Wrench, "Lucrări", activeReqs.length ? `${activeReqs.length} active` : "istoric", () => go("jobs"), "v2-action-jobs"],
          [MessageCircle, "Întreabă AI", "asistent 24/7", actions.openAI, "v2-action-ai"],
        ].map(([Icon, label, sub, onClick, tid]) => (
          <button key={label} onClick={onClick} data-testid={tid}
            className="rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-sm active:scale-[0.97] transition-transform min-h-[100px]">
            <span className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: GREEN_SOFT }}>
              <Icon className="w-5 h-5" style={{ color: GREEN }} />
            </span>
            <div className="mt-2.5 text-sm font-black text-slate-900">{label}</div>
            <div className="text-[10px] text-slate-400 font-medium truncate">{sub}</div>
          </button>
        ))}
      </div>

      {contextual.length > 0 && (
        <div className="mx-5 mt-6 cv2-fade cv2-d2" data-testid="v2-contextual">
          <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-1">Noutăți pentru tine</h3>
          <div className="mt-2 space-y-2">
            {contextual.slice(0, 2).map(({ icon: Icon, text, cta, onClick, tid }) => (
              <button key={tid} onClick={onClick} data-testid={tid}
                className="w-full flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm text-left active:scale-[0.98] transition-transform">
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: GREEN_SOFT }}><Icon className="w-4 h-4" style={{ color: GREEN }} /></span>
                <span className="text-xs font-semibold text-slate-700 flex-1 leading-snug">{text}</span>
                <span className="text-[11px] font-black flex items-center shrink-0" style={{ color: GREEN }}>{cta}<ChevronRight className="w-3.5 h-3.5" /></span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-7 pb-8 cv2-fade cv2-d3" data-testid="v2-discover">
        <h3 className="text-[11px] font-black uppercase tracking-wider text-slate-400 px-6">Descoperă</h3>
        <div className="mt-2 flex gap-3 overflow-x-auto px-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[["Digital Twin", "locuința ta în 3D", Box, actions.openTwin], ["House Health", "scorul casei tale", HeartPulse, actions.openHealth], ["Ghid întreținere", "sfaturi sezoniere", FileText, actions.openAI]].map(([l, s, Icon, onClick]) => (
            <button key={l} onClick={onClick} className="shrink-0 w-36 rounded-2xl bg-white border border-slate-100 p-3.5 text-left shadow-sm">
              <Icon style={{ color: GREEN, width: 18, height: 18 }} />
              <div className="mt-2 text-xs font-black text-slate-900">{l}</div>
              <div className="text-[10px] text-slate-400">{s}</div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
};
