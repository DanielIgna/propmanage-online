import React, { useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";
import { MessageSquareHeart, X, Send, ThumbsUp, ThumbsDown } from "lucide-react";
import { useAuth } from "../auth";

const API = process.env.REACT_APP_BACKEND_URL;
const QUESTIONS = [
  ["confusing", "Ce ți s-a părut confuz?"],
  ["easy", "Ce a fost ușor?"],
  ["trust", "Ce ți-a dat încredere?"],
  ["almost_quit", "Ce aproape te-a făcut să renunți?"],
  ["impressed", "Ce funcție te-a impresionat cel mai mult?"],
];

export const BetaFeedbackWidget = () => {
  const { user } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState({});
  const [recommend, setRecommend] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(() => localStorage.getItem("pm_beta_fb_done") === "1");
  const [hidden, setHidden] = useState(() => sessionStorage.getItem("pm_beta_fb_hide") === "1");

  const show = user && ["client", "specialist"].includes(user.role) &&
    (pathname.startsWith("/client") || pathname.startsWith("/specialist"));
  if (!show || done || hidden) return null;

  const dismiss = () => { sessionStorage.setItem("pm_beta_fb_hide", "1"); setHidden(true); };
  const submit = async () => {
    setBusy(true); setErr("");
    try {
      await axios.post(`${API}/api/feedback/beta`, { ...answers, recommend });
      localStorage.setItem("pm_beta_fb_done", "1");
      setDone(true);
    } catch (e) {
      setErr(e?.response?.data?.detail || "Nu am putut trimite. Încearcă din nou.");
    } finally { setBusy(false); }
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} data-testid="beta-feedback-open"
      className="fixed bottom-4 left-4 z-[60] inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-slate-900 text-white text-xs font-bold shadow-lg hover:scale-105 transition-transform">
      <MessageSquareHeart className="w-4 h-4 text-[#d4ff3a]" /> Feedback beta
    </button>
  );

  return (
    <div className="fixed bottom-4 left-4 z-[60] w-[340px] max-w-[calc(100vw-2rem)] rounded-3xl bg-white border border-slate-200 shadow-2xl p-4" data-testid="beta-feedback-panel">
      <div className="flex items-start gap-2">
        <MessageSquareHeart className="w-5 h-5 text-slate-900 shrink-0 mt-0.5" />
        <div className="flex-1">
          <div className="text-sm font-black text-slate-900">Ești în beta — părerea ta decide roadmap-ul</div>
          <div className="text-[11px] text-slate-400">2 minute · citit de fondator</div>
        </div>
        <button onClick={dismiss} data-testid="beta-feedback-close" aria-label="Închide" className="p-1 text-slate-400"><X className="w-4 h-4" /></button>
      </div>
      <div className="mt-3 space-y-2 max-h-[46vh] overflow-y-auto pr-1">
        {QUESTIONS.map(([k, q]) => (
          <div key={k}>
            <label className="text-[11px] font-bold text-slate-500">{q}</label>
            <input value={answers[k] || ""} onChange={e => setAnswers(a => ({ ...a, [k]: e.target.value }))}
              data-testid={`beta-fb-${k}`} maxLength={500}
              className="mt-0.5 w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-slate-400" />
          </div>
        ))}
        <div>
          <label className="text-[11px] font-bold text-slate-500">Ai recomanda PropManage?</label>
          <div className="mt-1 flex gap-2">
            <button onClick={() => setRecommend(true)} data-testid="beta-fb-recommend-yes"
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border-2 ${recommend === true ? "border-green-500 bg-green-50 text-green-700" : "border-slate-200 text-slate-500"}`}>
              <ThumbsUp className="w-3.5 h-3.5" /> Da
            </button>
            <button onClick={() => setRecommend(false)} data-testid="beta-fb-recommend-no"
              className={`flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold border-2 ${recommend === false ? "border-red-400 bg-red-50 text-red-600" : "border-slate-200 text-slate-500"}`}>
              <ThumbsDown className="w-3.5 h-3.5" /> Nu
            </button>
          </div>
        </div>
        <div>
          <label className="text-[11px] font-bold text-slate-500">De ce?</label>
          <input value={answers.why || ""} onChange={e => setAnswers(a => ({ ...a, why: e.target.value }))}
            data-testid="beta-fb-why" maxLength={500}
            className="mt-0.5 w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-slate-400" />
        </div>
      </div>
      {err && <div className="mt-2 text-[11px] font-bold text-red-500" data-testid="beta-fb-error">{err}</div>}
      <button onClick={submit} disabled={busy} data-testid="beta-fb-submit"
        className="mt-3 w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-black text-black disabled:opacity-60" style={{ background: "#d4ff3a" }}>
        <Send className="w-4 h-4" /> {busy ? "Se trimite…" : "Trimite feedback"}
      </button>
    </div>
  );
};
