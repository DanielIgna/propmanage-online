// Harta casei A→G — aceeași structură (SSOT lib/houseHealthAxis), prezentată în limbaj simplu.
// compact = 7 segmente (Acasă) · full = listă cu progres per capitol (Casa mea → Rezumat).
import React, { useState } from "react";
import { ChevronRight, Check } from "lucide-react";
import { HOUSE_HEALTH_AXIS, STATE_META, AXIS_NOT_ENERGY_CLASS, AXIS_DISCLAIMER, deriveChapterState, chapterForNextStep } from "../../lib/houseHealthAxis";
import { Card, Chip, Overline, Primary, Sheet, Bar, Ghost } from "./ui3";

export const PLAIN = {
  A: ["Identitate", "Ce este casa mea?"],
  B: ["Documente", "Ce acte am și ce lipsește?"],
  C: ["Energie", "Cât consumă casa?"],
  D: ["Siguranță", "E casa sigură și sănătoasă?"],
  E: ["Echipamente", "Ce instalații am și când le întrețin?"],
  F: ["Lucrări", "Ce trebuie reparat?"],
  G: ["Digital Twin", "Cum arată progresul și cum îl arăt altora?"],
};
export const CHAPTER_SECTION = { A: "dosar", B: "carte", C: "riscuri", D: "riscuri", E: "echipamente", F: "riscuri", G: "echipamente" };
const TONE = { verificat: "emerald", documentat: "lime", lipsa: "slate", lipsa_date: "amber" };
const SEG = { verificat: "bg-emerald-500", documentat: "bg-[#ccff00]", lipsa: "bg-slate-200", lipsa_date: "bg-amber-300" };

const chapterProgress = (c, compl) => {
  const by = {}; (compl?.items || []).forEach(i => { by[i.id] = i; });
  let e = 0, m = 0; c.items.forEach(id => { if (by[id]) { e += by[id].earned || 0; m += by[id].max || 0; } });
  return { e, m, pct: m ? Math.round((e / m) * 100) : 0, items: c.items.filter(id => by[id]).map(id => by[id]) };
};

const ChapterSheet = ({ c, compl, onClose, onGo }) => {
  const state = deriveChapterState(c, compl);
  const meta = STATE_META[state];
  const p = chapterProgress(c, compl);
  const [plain, q] = PLAIN[c.code];
  return (
    <Sheet title={`${c.code} · ${plain}`} sub={c.title} onClose={onClose} tid="v3-chapter-sheet">
      <div className="flex items-center gap-2 flex-wrap">
        <Chip tone={TONE[state]} tid="v3-chapter-state">{meta.label}</Chip>
        <span className="text-xs text-slate-500">{meta.hint}</span>
      </div>
      <p className="mt-4 text-base font-bold text-slate-900 leading-snug">{q}</p>
      <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{c.why}</p>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs"><Overline>Ce se numără aici</Overline><span className="font-mono text-slate-400">{p.e}/{p.m} puncte</span></div>
        <div className="mt-2"><Bar pct={p.pct} /></div>
        <div className="mt-2 space-y-1.5">
          {p.items.map(i => {
            const done = (i.earned || 0) >= (i.max || 0) && i.max > 0;
            return (
              <div key={i.id} className="flex items-center gap-2 text-sm">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${done ? "bg-[#ccff00]" : (i.earned || 0) > 0 ? "bg-[#F6FEE7] border border-[#D2F2DC]" : "bg-slate-100"}`}>
                  <Check className={`w-3 h-3 ${done ? "text-black" : "text-slate-300"}`} strokeWidth={3} />
                </span>
                <span className={`flex-1 ${done ? "text-slate-700 font-semibold" : "text-slate-500"}`}>{i.label}</span>
                <span className="text-xs font-mono text-slate-400">{i.earned}/{i.max}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-4 rounded-2xl bg-[#F6FEE7] border border-[#D2F2DC] p-4">
        <Overline className="!text-[#166534]">Următorul pas</Overline>
        <p className="mt-1 text-sm font-bold text-slate-900">{c.nextHint}</p>
        <Primary className="mt-3" full onClick={() => onGo(CHAPTER_SECTION[c.code])} tid="v3-chapter-go">Mergi la capitol <ChevronRight className="w-4 h-4" /></Primary>
      </div>
      <p className="mt-3 text-[11px] text-slate-400 leading-relaxed">{c.evidence}</p>
    </Sheet>
  );
};

export const HouseMapV3 = ({ completeness, mode = "compact", onGo, tid = "v3-house-map" }) => {
  const [open, setOpen] = useState(null);
  const [legal, setLegal] = useState(false);
  const compl = completeness;
  const next = compl ? chapterForNextStep(compl) : null;
  const states = HOUSE_HEALTH_AXIS.map(c => (compl ? deriveChapterState(c, compl) : "lipsa_date"));
  const count = (s) => states.filter(x => x === s).length;

  return (
    <Card tid={tid}>
      <div className="flex items-start gap-3">
        <span className="w-10 h-10 rounded-2xl bg-slate-900 text-[#ccff00] flex items-center justify-center shrink-0 text-[11px] font-black">A→G</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-black text-slate-900 leading-tight">Harta casei</div>
          <div className="text-xs text-slate-500 mt-0.5">7 capitole, de la identitate la Digital Twin · <b className="text-slate-700">{count("verificat")} complete</b> · {count("documentat")} începute · {count("lipsa") + count("lipsa_date")} de pornit</div>
        </div>
      </div>

      {mode === "compact" ? (
        <>
          <div className="mt-4 grid grid-cols-7 gap-1.5" data-testid="v3-map-segments">
            {HOUSE_HEALTH_AXIS.map((c, i) => {
              const s = states[i];
              const isNext = next?.code === c.code;
              return (
                <button type="button" key={c.code} onClick={() => setOpen(c)} data-testid={`v3-map-seg-${c.code}`}
                  className={`min-h-[64px] rounded-2xl p-1.5 flex flex-col items-center justify-between text-center active:scale-[0.97] transition-transform ${isNext ? "ring-2 ring-[#166534]/40 bg-[#F6FEE7]" : "bg-slate-50 hover:bg-slate-100"}`}>
                  <span className={`h-1.5 w-full rounded-full ${SEG[s]}`} />
                  <span className="text-sm font-black text-slate-900 leading-none">{c.code}</span>
                  <span className="text-[9px] font-bold text-slate-500 leading-tight truncate w-full">{PLAIN[c.code][0]}</span>
                </button>
              );
            })}
          </div>
          {next && (
            <button type="button" onClick={() => setOpen(next)} data-testid="v3-map-next"
              className="mt-3 w-full min-h-[52px] flex items-center gap-3 rounded-2xl bg-[#F6FEE7] border border-[#D2F2DC] px-3.5 py-2.5 text-left">
              <span className="w-8 h-8 rounded-xl bg-slate-900 text-[#ccff00] flex items-center justify-center text-xs font-black shrink-0">{next.code}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-[10px] font-black uppercase tracking-wide text-[#166534]">Ești la capitolul {next.code} · {PLAIN[next.code][0]}</span>
                <span className="block text-sm font-bold text-slate-900 truncate">Următorul pas: {compl?.next_step?.label || next.nextHint}</span>
              </span>
              {compl?.next_step?.expected_gain != null && <Chip tone="dark">+{compl.next_step.expected_gain}%</Chip>}
              <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
            </button>
          )}
        </>
      ) : (
        <div className="mt-4 space-y-2" data-testid="v3-map-list">
          {HOUSE_HEALTH_AXIS.map((c, i) => {
            const s = states[i]; const p = chapterProgress(c, compl); const isNext = next?.code === c.code;
            return (
              <button type="button" key={c.code} onClick={() => setOpen(c)} data-testid={`v3-map-row-${c.code}`}
                className={`w-full min-h-[64px] flex items-center gap-3 rounded-2xl border px-3.5 py-3 text-left active:scale-[0.99] transition-transform ${isNext ? "border-[#166534]/25 bg-[#F6FEE7]" : "border-slate-100 bg-white hover:bg-slate-50"}`}>
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-sm font-black ${s === "verificat" ? "bg-emerald-50 text-emerald-700" : s === "documentat" ? "bg-[#F6FEE7] text-[#166534]" : "bg-slate-100 text-slate-400"}`}>
                  {s === "verificat" ? <Check className="w-5 h-5" strokeWidth={3} /> : c.code}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-2"><span className="text-sm font-black text-slate-900">{PLAIN[c.code][0]}</span><span className="text-xs text-slate-400 truncate hidden sm:inline">· {c.title}</span></span>
                  <span className="block text-xs text-slate-500 truncate">{PLAIN[c.code][1]}</span>
                  <div className="mt-1.5 max-w-[220px]"><Bar pct={p.pct} tone={s === "verificat" ? "#10b981" : "#ccff00"} h="h-1" /></div>
                </span>
                <Chip tone={TONE[s]} tid={`v3-map-state-${c.code}`}>{STATE_META[s].label}</Chip>
                <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-slate-400 leading-snug">{AXIS_NOT_ENERGY_CLASS}</span>
        <Ghost onClick={() => setLegal(v => !v)} tid="v3-map-legal">{legal ? "Ascunde" : "Notă legală"}</Ghost>
      </div>
      {legal && <p className="mt-1 text-[11px] text-slate-500 leading-relaxed rounded-2xl bg-slate-50 p-3" data-testid="v3-map-disclaimer">{AXIS_DISCLAIMER}</p>}
      {open && <ChapterSheet c={open} compl={compl} onClose={() => setOpen(null)} onGo={(sec) => { setOpen(null); onGo?.(sec); }} />}
    </Card>
  );
};
