import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { IdCard, Copy, Check, ExternalLink, Share2, QrCode, ChevronDown } from "lucide-react";
import { API } from "../DashShared";
import { formatApiError } from "../../auth";
import { GREEN } from "./ui";

export const PassportCard = ({ prop }) => {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const load = useCallback(() => {
    axios.get(`${API}/properties/${prop.id}/passport`).then(r => setData(r.data)).catch(() => {});
  }, [prop.id]);
  useEffect(() => { load(); }, [load]);

  const enable = () => {
    setBusy(true);
    axios.post(`${API}/properties/${prop.id}/passport/enable`)
      .then(r => setData(r.data)).catch(e => alert(formatApiError(e))).finally(() => setBusy(false));
  };
  const patch = (body) => {
    axios.patch(`${API}/properties/${prop.id}/passport`, body)
      .then(r => setData(r.data)).catch(e => alert(formatApiError(e)));
  };
  const copy = () => {
    navigator.clipboard?.writeText(data.share_url);
    setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  const shareWa = () => {
    const text = `Pașaportul casei mele pe PropManage — identitate, istoric și dovezi: ${data.share_url}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  if (!data) return null;

  return (
    <div className="mt-4 rounded-3xl border border-slate-100 bg-white shadow-sm p-4" data-testid="passport-card">
      <div className="flex items-center gap-2">
        <span className="w-9 h-9 rounded-2xl bg-[#F0FBF4] flex items-center justify-center"><IdCard style={{ width: 18, height: 18, color: GREEN }} /></span>
        <div className="flex-1">
          <div className="text-sm font-black text-slate-900">Pașaportul casei</div>
          <div className="text-[11px] text-slate-400">profilul public de încredere · QR permanent</div>
        </div>
        {data.enabled && <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase text-black" style={{ background: "#d4ff3a" }} data-testid="passport-status">Public</span>}
      </div>

      {!data.enabled ? (
        <>
          <p className="mt-3 text-xs text-slate-500">Transformă cartea casei într-o carte de identitate publică: dovada că proprietatea ta e documentată și îngrijită — perfectă la vânzare sau închiriere. Tu controlezi ce se vede.</p>
          <button onClick={enable} disabled={busy} data-testid="passport-enable-btn"
            className="mt-3 w-full py-3 rounded-full text-sm font-black text-black active:scale-[0.98] transition-transform disabled:opacity-60" style={{ background: "#d4ff3a" }}>
            {busy ? "Se generează…" : "Activează pașaportul public"}
          </button>
        </>
      ) : (
        <>
          <div className="mt-3 flex items-center gap-2">
            <img src={data.qr_url} alt="QR" className="w-16 h-16 rounded-xl border border-slate-100" data-testid="passport-qr-img" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Link public</div>
              <div className="text-xs font-bold text-slate-700 truncate" data-testid="passport-share-url">{data.share_url}</div>
              <div className="mt-1.5 flex gap-1.5">
                <button onClick={copy} data-testid="passport-copy-btn"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold border-2 border-slate-200 text-slate-600">
                  {copied ? <Check className="w-3 h-3 text-green-600" /> : <Copy className="w-3 h-3" />} {copied ? "Copiat" : "Copiază"}
                </button>
                <button onClick={shareWa} data-testid="passport-whatsapp-btn"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-black text-black" style={{ background: "#d4ff3a" }}>
                  <Share2 className="w-3 h-3" /> WhatsApp
                </button>
                <a href={`/p/${data.slug}`} target="_blank" rel="noreferrer" data-testid="passport-open-btn"
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold border-2 border-slate-200 text-slate-600">
                  <ExternalLink className="w-3 h-3" /> Vezi
                </a>
              </div>
            </div>
          </div>

          <button onClick={() => setShowPrivacy(!showPrivacy)} data-testid="passport-privacy-toggle"
            className="mt-3 flex items-center gap-1 text-xs font-bold text-slate-500">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showPrivacy ? "rotate-180" : ""}`} /> Confidențialitate — ce e vizibil public
          </button>
          {showPrivacy && (
            <div className="mt-2 space-y-1.5" data-testid="passport-privacy-list">
              {Object.entries(data.privacy_labels).map(([k, label]) => (
                <label key={k} className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <input type="checkbox" checked={!!data.privacy[k]} data-testid={`passport-priv-${k}`}
                    onChange={e => patch({ privacy: { [k]: e.target.checked } })}
                    className="w-4 h-4 accent-[#34C759]" />
                  {label}
                </label>
              ))}
              <button onClick={() => patch({ enabled: false })} data-testid="passport-disable-btn"
                className="mt-1 text-[11px] font-bold text-red-400 underline">Dezactivează pașaportul public</button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
