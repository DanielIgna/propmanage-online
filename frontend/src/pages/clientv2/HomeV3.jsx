// ACASĂ — răspunde, în ordine, la: Cum e casa mea? · Ce se întâmplă acum? · Ce trebuie să fac? ·
// Ce am construit? · Care e următorul pas? Restul: dezvăluit progresiv („Explorează mai mult").
import React, { useEffect, useState } from "react";
import axios from "axios";
import {
  ChevronRight, ShieldCheck, Sparkles, Clock, CircleHelp, Gift, Map, Trophy, Compass, Box, HeartPulse, BookOpen, Plus, Check, X,
} from "lucide-react";
import { Card, Overline, H2, Primary, Secondary, Chip, Ring, Stat, Fold, Ghost } from "./ui3";
import { HouseMapV3, PLAIN } from "./HouseMapV3";
import { buildTodo, buildIndicators } from "./data3";
import { chapterForNextStep } from "../../lib/houseHealthAxis";
import { HouseHealthAxisPreview } from "../../components/HouseHealthAxisCard";
import { API } from "../DashShared";
import { formatApiError } from "../../auth";

const TONE_DOT = { lime: "bg-[#ccff00]", amber: "bg-amber-400", sky: "bg-sky-400", rose: "bg-rose-400" };

// 1 · Cum este casa mea? — UN scor, în cuvinte simple, cu explicație la cerere
const StatusNow = ({ d, explain, go }) => {
  const inds = buildIndicators(d);
  const main = inds.find(i => i.id === "scor") || inds[0];
  const c = d.completeness;
  const confirmed = d.requests.filter(r => r.status === "confirmed").length;
  const risks = d.risks?.risks?.length ?? 0;
  const s = main?.value ?? 0;
  const mood = s >= 80 ? "Casa ta e bine documentată și îngrijită." : s >= 50 ? "Casa ta e la jumătatea drumului — un început solid." : s >= 25 ? "Casa ta a pornit — mai sunt câteva capitole de completat." : "Hai să construim memoria casei tale.";
  return (
    <Card tid="v3-status-now">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => main && explain(main)} data-testid="v3-status-ring" aria-label="Ce înseamnă scorul?"><Ring value={s} label="/100" size={84} /></button>
        <div className="flex-1 min-w-0">
          <Overline>Cum este casa mea?</Overline>
          <H2 className="mt-1">{mood}</H2>
          <button type="button" onClick={() => main && explain(main)} data-testid="v3-status-explain" className="mt-1.5 inline-flex items-center gap-1 min-h-[36px] text-xs font-bold text-[#166534]">
            <CircleHelp className="w-3.5 h-3.5" /> Ce înseamnă „Scorul casei"?
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2" data-testid="v3-status-facts">
        {[[c?.docs_count ?? 0, "documente", ["house", "carte"]], [confirmed, "lucrări finalizate", ["jobs"]], [risks, risks === 1 ? "risc de verificat" : "riscuri de verificat", ["house", "riscuri"]]].map(([v, l, g]) => (
          <button type="button" key={l} onClick={() => go(...g)} className="rounded-2xl bg-slate-50 p-3 text-left min-h-[60px]" data-testid={`v3-fact-${g[1] || g[0]}`}>
            <div className="xos-num text-xl leading-none text-slate-900 font-medium">{v}</div>
            <div className="text-[11px] text-slate-500 mt-1 leading-tight">{l}</div>
          </button>
        ))}
      </div>
    </Card>
  );
};

// 2+3 · Ce se întâmplă acum / ce trebuie să fac? — max 3 rânduri, o acțiune fiecare
const TodoNow = ({ d, act, go }) => {
  const items = buildTodo(d);
  const inProgress = d.requests.filter(r => r.status === "in_progress");
  const unread = (d.notifs || []).filter(n => !n.read);
  if (items.length === 0) {
    return (
      <Card tid="v3-todo-calm" tone="accent">
        <div className="flex items-center gap-3">
          <span className="w-11 h-11 rounded-2xl bg-white flex items-center justify-center shrink-0"><ShieldCheck className="w-6 h-6 text-[#166534]" /></span>
          <div className="flex-1"><Overline>Ce se întâmplă acum?</Overline><H2 className="mt-0.5">Totul e în regulă — nimic urgent.</H2>
            {inProgress[0] && <p className="text-xs text-slate-600 mt-1">{inProgress[0].specialist_name} lucrează la «{inProgress[0].title}».</p>}</div>
        </div>
        {unread[0] && (
          <button type="button" onClick={() => act("notifs")} className="mt-3 w-full min-h-[44px] flex items-center gap-2 rounded-2xl bg-white px-3.5 text-left" data-testid="v3-todo-notif">
            <span className="w-2 h-2 rounded-full bg-[#166534] shrink-0" /><span className="flex-1 text-xs font-bold text-slate-700 truncate">{unread[0].title}</span><ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
        )}
        <Primary className="mt-4" full onClick={() => act("request")} tid="v3-todo-request">Solicită un serviciu</Primary>
      </Card>
    );
  }
  return (
    <div data-testid="v3-todo">
      <div className="flex items-end justify-between px-1">
        <div><Overline>Ce trebuie să fac?</Overline><H2 className="mt-1">De făcut acum</H2></div>
        <Ghost onClick={() => go("jobs")} tid="v3-todo-all">Toate lucrările <ChevronRight className="w-3.5 h-3.5" /></Ghost>
      </div>
      <div className="mt-3 space-y-2">
        {items.map(it => (
          <div key={it.id} className="rounded-3xl border border-slate-100 bg-white shadow-sm p-4" data-testid={`v3-todo-${it.id}`}>
            <div className="flex flex-col sm:flex-row sm:items-start gap-3">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${TONE_DOT[it.tone]}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-black text-slate-900 leading-snug">{it.title}</div>
                  <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">{it.sub}</p>
                  {it.more > 0 && <button type="button" onClick={() => go("jobs", it.kind)} className="mt-1 text-[11px] font-bold text-slate-400 underline min-h-[28px]" data-testid={`v3-todo-more-${it.id}`}>+{it.more} {it.moreLabel}</button>}
                </div>
              </div>
              <Primary onClick={() => act(it.kind, it.req || it.task)} tid={`v3-todo-cta-${it.id}`} className="w-full sm:w-auto sm:!min-h-[40px] sm:!px-4 text-xs shrink-0">{it.cta}</Primary>
            </div>
          </div>
        ))}
        {inProgress.length > 0 && (
          <button type="button" onClick={() => go("jobs", "in_lucru")} className="w-full min-h-[48px] flex items-center gap-3 rounded-2xl bg-slate-50 px-4 text-left" data-testid="v3-todo-inprogress">
            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            <span className="flex-1 text-xs font-bold text-slate-600 truncate">{inProgress.length === 1 ? `${inProgress[0].specialist_name || "Specialistul"} lucrează la «${inProgress[0].title}»` : `${inProgress.length} lucrări în desfășurare`}</span>
            <ChevronRight className="w-4 h-4 text-slate-300" />
          </button>
        )}
      </div>
    </div>
  );
};

// 5 · Următorul pas recomandat — UNUL singur (Copilotul), explicabil
const NextStep = ({ d, act }) => {
  const a = d.copilot?.next_action;
  const [why, setWhy] = useState(false);
  if (!a) return null;
  const ch = d.completeness ? chapterForNextStep(d.completeness) : null;
  const ex = a.explain || {};
  return (
    <Card tid="v3-next-step" tone="accent">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="w-8 h-8 rounded-xl bg-[#ccff00] flex items-center justify-center shrink-0"><Sparkles className="w-4 h-4 text-black" /></span>
        <Overline className="!text-[#166534]">Următorul pas recomandat</Overline>
        {ch && <Chip tone="dark" tid="v3-next-chapter">Capitolul {ch.code} · {PLAIN[ch.code][0]}</Chip>}
      </div>
      {d.copilot?.summary?.text && <p className="mt-2 text-xs text-slate-600 leading-relaxed" data-testid="v3-next-summary">{d.copilot.summary.text}</p>}
      <div className="mt-2.5 text-base font-black text-slate-900 leading-snug" data-testid="v3-next-title">{a.title}</div>
      <p className="mt-1 text-sm text-slate-600 leading-relaxed">{a.value}</p>
      <div className="mt-2 flex items-center gap-2 text-[11px] font-bold text-slate-500">
        {ex.duration && <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-white border border-slate-100"><Clock className="w-3 h-3" />{ex.duration}</span>}
        {a.impact != null && <span className="px-2 py-1 rounded-full bg-white border border-slate-100">impact {a.impact}/10</span>}
      </div>
      <div className="mt-3 flex items-center gap-2">
        <Primary className="flex-1" onClick={() => act("copilot", a)} tid="v3-next-cta">Fă pasul acum</Primary>
        <Secondary onClick={() => setWhy(v => !v)} tid="v3-next-why"><CircleHelp className="w-4 h-4" /> De ce?</Secondary>
      </div>
      {why && (
        <div className="mt-3 rounded-2xl bg-white border border-slate-100 p-3.5 space-y-1.5 text-xs" data-testid="v3-next-explain">
          {[["De ce?", ex.why], ["Ce câștigi?", ex.gain], ["Ce deblochezi?", ex.unlocks], ["Impact casă", ex.house_impact]].map(([k, v]) => v && (
            <div key={k} className="flex gap-2"><span className="w-24 shrink-0 font-black text-slate-500">{k}</span><span className="text-slate-700 leading-snug">{v}</span></div>
          ))}
        </div>
      )}
      <Ghost className="mt-1" onClick={() => act("mentor", a)} tid="v3-next-more">Vezi toate recomandările <ChevronRight className="w-3.5 h-3.5" /></Ghost>
    </Card>
  );
};

// 4 · Ce am construit deja? — 4 fapte, fiecare duce undeva
const BuiltSoFar = ({ d, go }) => {
  const e = d.engagement; const j = d.journey; const mem = d.copilot?.progress?.membership;
  return (
    <div data-testid="v3-built">
      <Overline className="px-1">Ce am construit deja?</Overline>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Stat value={`${d.completeness?.score ?? 0}%`} label="Cartea casei" sub={`${d.completeness?.docs_count ?? 0} documente`} onClick={() => go("house", "carte")} tid="v3-built-book" />
        <Stat value={`${e?.badges_earned_count ?? 0}/${e?.badges?.length ?? 10}`} label="Realizări" sub={e?.last_achievement?.label} onClick={() => go("more", "realizari")} tid="v3-built-badges" />
        <Stat value={`${j?.current_level ?? 1}/7`} label="Drumul casei" sub={j?.current_label} onClick={() => go("more", "drum")} tid="v3-built-journey" />
        <Stat value={mem?.level?.name || "—"} label="Nivel membru" sub={mem?.next_level ? `${mem.next_level.points_needed}p până la ${mem.next_level.name}` : `${mem?.points ?? 0} puncte`} onClick={() => go("more", "beneficii")} tid="v3-built-member" />
      </div>
    </div>
  );
};

// Recomandări comerciale (Revenue Hunter) — acceptă = creează cererea reală; „Nu acum" = dismiss
export const OppCard = ({ o, d, act, go }) => {
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const accept = async () => {
    setBusy(true);
    try { await axios.post(`${API}/client/opportunities/${o.id}/accept`); setOk(true); act("reloadRequests"); }
    catch (e) { alert(formatApiError(e)); }
    setBusy(false);
  };
  const dismiss = async () => {
    setBusy(true);
    try { await axios.post(`${API}/client/opportunities/${o.id}/dismiss`); d.update({ opps: d.opps.filter(x => x.id !== o.id) }); } catch { /* noop */ }
    setBusy(false);
  };
  if (ok) {
    return (
      <div className="rounded-2xl border border-[#166534]/25 bg-[#166534]/5 p-3.5 flex items-center gap-3" data-testid={`opp-accepted-${o.service}`}>
        <Check className="w-5 h-5 text-[#166534] shrink-0" />
        <span className="text-xs font-semibold text-slate-700 flex-1">Cererea a fost creată — specialiștii au fost anunțați.</span>
        <button type="button" onClick={() => go("jobs")} className="text-[11px] font-black text-[#166534] shrink-0" data-testid="opp-see-job">Vezi lucrarea →</button>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-slate-100 p-3.5" data-testid={`opp-card-${o.service}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[10px] font-black uppercase tracking-wide text-[#166534]">{o.service_label}</span>
        {o.estimated_value_ron && <span className="text-[10px] font-mono font-semibold text-slate-400">≈ {Number(o.estimated_value_ron).toLocaleString("ro")} RON</span>}
      </div>
      <div className="mt-0.5 text-sm font-black text-slate-900">{o.title}</div>
      <p className="mt-1 text-xs text-slate-500 leading-relaxed">{o.benefit}</p>
      <div className="mt-2.5 flex gap-2">
        <Primary className="flex-1 !min-h-[40px] text-xs" disabled={busy} onClick={accept} tid={`opp-accept-${o.service}`}>{busy ? "Se creează…" : "Vreau ofertă"}</Primary>
        <Secondary className="!min-h-[40px] text-xs" disabled={busy} onClick={dismiss} tid={`opp-dismiss-${o.service}`}>Nu acum</Secondary>
      </div>
    </div>
  );
};

// Explorează — colapsat pe mobil, deschis pe desktop; header-ul spune ce e înăuntru
export const ExploreMore = ({ d, go, act, forceOpen, openKeys }) => {
  const [open, setOpen] = useState({ ...(forceOpen ? { beneficii: true, recomandari: true } : {}), ...(openKeys || {}) });
  useEffect(() => { if (openKeys) setOpen(o => ({ ...o, ...openKeys })); }, [openKeys]);
  const t = (k) => setOpen(o => ({ ...o, [k]: !o[k] }));
  const show = (id) => !(d.hidden || []).includes(`widget:${id}`);
  const b = d.copilot?.benefits; const plan = d.plan; const j = d.journey;
  const txActive = (d.requests || []).some(r => (r.status === "assigned" && !r.escrow_amount) || r.status === "completed");
  const opps = show("opportunities") && !txActive ? d.opps.slice(0, 2) : [];
  const subActive = plan?.subscription_active || d.copilot?.subscription?.active;
  return (
    <div className="space-y-2" data-testid="v3-explore">
      <Overline className="px-1">Explorează mai mult</Overline>
      {show("benefits_pulse") && (
        <Fold icon={Gift} title="Beneficii & plan" open={!!open.beneficii} onToggle={() => t("beneficii")} tid="v3-fold-benefits"
          summary={`${b?.available ?? 0} beneficii active${b?.expiring_soon?.length ? ` · ${b.expiring_soon.length} expiră curând` : ""} · ${subActive ? "House Health activ" : "plan gratuit"}`}>
          <div className="flex items-center gap-2 flex-wrap">
            <Chip tone={subActive ? "emerald" : "slate"} tid="v3-plan-status">{subActive ? "House Health · activ" : "Plan gratuit"}</Chip>
            {b?.available_value ? <span className="text-xs text-slate-500">valoare disponibilă ≈ {b.available_value} RON</span> : null}
            {!subActive && plan?.cheapest_paid && <span className="text-xs text-slate-500">· {plan.cheapest_paid.name} de la {plan.cheapest_paid.price_eur} €/{plan.cheapest_paid.billing_period === "yearly" ? "an" : "lună"}</span>}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Secondary full onClick={() => go("more", "beneficii")} tid="v3-fold-benefits-go">Beneficiile <ChevronRight className="w-4 h-4" /></Secondary>
            <Secondary full onClick={() => act("hhUpgrade")} tid="v3-plan-cta">{subActive ? "Abonamentul meu" : "Vezi planurile"}</Secondary>
          </div>
        </Fold>
      )}
      {opps.length > 0 && (
        <Fold icon={Sparkles} title="Recomandat pentru casa ta" open={!!open.recomandari} onToggle={() => t("recomandari")} tid="v3-fold-opps"
          summary={opps.map(o => o.service_label).join(" · ")}>
          <div className="space-y-2">{opps.map(o => <OppCard key={o.id} o={o} d={d} act={act} go={go} />)}</div>
        </Fold>
      )}
      {show("house_journey") && (
        <Fold icon={Map} title="Drumul casei" open={!!open.drum} onToggle={() => t("drum")} tid="v3-fold-journey"
          summary={j ? `Nivel ${j.current_level}/7 · ${j.current_label}${j.next_level ? ` · urmează: ${j.next_level.label}` : ""}` : "—"}>
          {j && (
            <div className="space-y-1.5">
              {j.levels.map(L => (
                <div key={L.key} className="flex items-center gap-2.5 text-sm" data-testid={`v3-journey-${L.key}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${L.status === "done" ? "bg-[#ccff00]" : L.status === "in_progress" ? "bg-amber-100" : "bg-slate-100"}`}>{L.status === "done" ? <Check className="w-3 h-3 text-black" strokeWidth={3} /> : <span className="text-[9px] font-black text-slate-500">{L.level}</span>}</span>
                  <span className={`flex-1 ${L.status === "done" ? "text-slate-400" : "text-slate-800 font-bold"}`}>{L.label}</span>
                  <Chip tone={L.status === "done" ? "emerald" : L.status === "in_progress" ? "amber" : "slate"}>{{ done: "Gata", in_progress: "În lucru", missing: "Urmează" }[L.status]}</Chip>
                </div>
              ))}
              {j.next_level?.missing?.[0] && <p className="text-xs text-slate-500 pt-1">Pentru nivelul {j.next_level.level} îți lipsește: <b>{j.next_level.missing.map(m => m.label).join(" · ")}</b></p>}
            </div>
          )}
        </Fold>
      )}
      {show("achievements") && (
        <Fold icon={Trophy} title="Realizări" open={!!open.realizari} onToggle={() => t("realizari")} tid="v3-fold-badges"
          summary={d.engagement ? `${d.engagement.badges_earned_count}/${d.engagement.badges?.length} insigne · ultima: ${d.engagement.last_achievement?.label || "—"}` : "—"}>
          <div className="grid grid-cols-2 gap-2">
            {(d.engagement?.badges || []).map(bd => (
              <div key={bd.id} className={`flex items-center gap-2 rounded-2xl border p-2.5 ${bd.earned ? "border-amber-100 bg-amber-50/50" : "border-slate-100 opacity-60"}`}>
                <span className={`text-lg ${bd.earned ? "" : "grayscale"}`}>{bd.icon}</span><span className="text-[11px] font-bold text-slate-700 leading-tight">{bd.label}</span>
              </div>
            ))}
          </div>
        </Fold>
      )}
      {show("discover") && (
        <Fold icon={Compass} title="Descoperă" open={!!open.descopera} onToggle={() => t("descopera")} tid="v3-fold-discover" summary="Digital Twin · House Health · Ghid întreținere">
          <div className="grid grid-cols-3 gap-2">
            {[[Box, "Digital Twin", "casa în 3D", () => act("twin"), "v3-discover-twin"], [HeartPulse, "House Health", "sănătatea casei", () => act("health"), "v3-discover-health"], [BookOpen, "Ghid", "sfaturi sezoniere", () => act("ai"), "v3-discover-guide"]].map(([I, l, s, fn, tid]) => (
              <button type="button" key={l} onClick={fn} data-testid={tid} className="min-h-[84px] rounded-2xl bg-slate-50 p-3 text-left hover:bg-slate-100">
                <I className="w-5 h-5 text-[#166534]" /><div className="mt-2 text-xs font-black text-slate-900">{l}</div><div className="text-[10px] text-slate-500">{s}</div>
              </button>
            ))}
          </div>
        </Fold>
      )}
    </div>
  );
};

export const HomeSkeleton = () => (
  <div className="px-5 lg:px-0 space-y-4" data-testid="v2-home-skeleton">{[160, 120, 140, 180].map((h, i) => <div key={i} className="cv2-skeleton rounded-3xl" style={{ height: h }} />)}</div>
);

export const HomeV3 = ({ d, go, act, explain }) => {
  const show = (id) => !(d.hidden || []).includes(`widget:${id}`);
  if (!d.prop) {
    return (
      <div className="px-5 lg:px-0 lg:max-w-2xl" data-testid="v3-home-onboarding">
        <Card tone="dark">
          <Overline className="!text-white/50">Pasul 1 din 3 · 1 minut</Overline>
          <h1 className="mt-2 xos-display text-2xl lg:text-3xl font-medium tracking-tight">Hai să pornim: adaugă prima ta proprietate</h1>
          <p className="mt-2 text-sm text-white/70">Apoi urci primul document și casa ta capătă memorie.</p>
          <Primary className="mt-4" full onClick={() => act("addProperty")} tid="v2-hero-cta"><Plus className="w-4 h-4" /> Adaugă proprietatea</Primary>
        </Card>
        <HouseHealthAxisPreview onCta={() => act("addProperty")} />
      </div>
    );
  }
  // Pasul 2 din onboarding: proprietate fără niciun document → CTA direct în Cartea casei
  const firstDoc = d.completeness && d.completeness.docs_count === 0 && !d.requests.some(r => r.status !== "confirmed");
  return (
    <div className="px-5 lg:px-0 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start" data-testid="v3-home">
      <div className="lg:col-span-7 xl:col-span-8 space-y-4 lg:space-y-5 min-w-0">
        {firstDoc && show("hero") && (
          <Card tone="dark" tid="v2-hero-doc">
            <Overline className="!text-white/50">Pasul 2 din 3 · 30 secunde</Overline>
            <h1 className="mt-2 xos-display text-2xl lg:text-3xl font-medium tracking-tight">Dă-i o memorie casei: urcă primul document</h1>
            <p className="mt-2 text-sm text-white/70">Actul, o factură sau o poză a locuinței «{d.prop.name}» — rămân salvate permanent în cartea casei.</p>
            <Primary className="mt-4" full onClick={() => go("house", "carte")} tid="v2-hero-cta">Adaugă primul document</Primary>
          </Card>
        )}
        <StatusNow d={d} explain={explain} go={go} />
        {show("contextual") && <TodoNow d={d} act={act} go={go} />}
        {show("house_copilot") && <NextStep d={d} act={act} />}
        <HouseMapV3 completeness={d.completeness} mode="compact" onGo={(sec) => go("house", sec)} />
        <div className="lg:hidden"><BuiltSoFar d={d} go={go} /></div>
        <div className="lg:hidden pb-4"><ExploreMore d={d} go={go} act={act} /></div>
      </div>
      <aside className="hidden lg:block lg:col-span-5 xl:col-span-4 space-y-5 lg:sticky lg:top-6">
        <BuiltSoFar d={d} go={go} />
        <ExploreMore d={d} go={go} act={act} forceOpen />
      </aside>
    </div>
  );
};

// Mini-tur de bun venit (3 pași) — DOAR la prima vizită pe /client (localStorage).
export const HomeIntroTour = () => {
  const KEY = "pm_home_tour_v1_seen";
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => {
      try {
        if (localStorage.getItem(KEY)) return;
        if (!localStorage.getItem("pm_cookie_consent_v1")) return;
        setOpen(true);
      } catch { /* noop */ }
    };
    check();
    window.addEventListener("pm-cookie-consent", check);
    return () => window.removeEventListener("pm-cookie-consent", check);
  }, []);
  const finish = () => { try { localStorage.setItem(KEY, "1"); } catch { /* noop */ } setOpen(false); };
  if (!open) return null;
  const STEPS = [
    { tag: "Acasă", title: "Cum e casa ta, dintr-o privire", body: "Sus vezi Scorul casei și, imediat sub el, ce ai de făcut acum — o acțiune per rând." },
    { tag: "Copilot", title: "Un singur pas recomandat", body: "Copilotul Casei alege pasul cu impactul cel mai mare. Apasă „De ce?” ca să înțelegi." },
    { tag: "Harta Casei", title: "Vezi progresul proprietății", body: "Harta casei A→G arată cât de completă e casa ta și ce capitol urmează." },
  ];
  const cur = STEPS[step];
  const isLast = step === STEPS.length - 1;
  return (
    <div className="fixed z-[45] left-4 right-4 lg:left-auto lg:right-8 lg:w-[380px] cv2-fade"
      style={{ bottom: "calc(var(--pm-dock-h) + var(--pm-safe-b) + 5.5rem)" }} data-testid="home-intro-tour">
      <div className="rounded-2xl bg-slate-900 text-white shadow-2xl border border-white/10 p-4">
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black uppercase tracking-[0.14em] px-2 py-0.5 rounded-full bg-[#ccff00] text-black">{cur.tag}</span>
          <span className="text-[10px] text-white/40 flex-1">Ghid rapid · {step + 1}/{STEPS.length}</span>
          <button type="button" onClick={finish} data-testid="home-intro-close" className="p-1 rounded-full hover:bg-white/10 text-white/60" aria-label="Închide"><X className="w-4 h-4" /></button>
        </div>
        <div className="mt-2 text-sm font-black">{cur.title}</div>
        <p className="mt-1 text-xs text-white/70 leading-relaxed">{cur.body}</p>
        <div className="mt-3 flex items-center gap-2">
          <div className="flex gap-1 flex-1">
            {STEPS.map((_, i) => <span key={i} className={`h-1 w-6 rounded-full ${i <= step ? "bg-[#ccff00]" : "bg-white/15"}`} />)}
          </div>
          <button type="button" onClick={finish} data-testid="home-intro-skip" className="text-[11px] font-bold text-white/50 px-2">Sari peste</button>
          <button type="button" onClick={() => (isLast ? finish() : setStep(s => s + 1))} data-testid="home-intro-next"
            className="px-4 py-1.5 rounded-full text-[11px] font-black text-black bg-[#ccff00] active:scale-[0.97] transition-transform">{isLast ? "Am înțeles" : "Mai departe"}</button>
        </div>
      </div>
    </div>
  );
};
