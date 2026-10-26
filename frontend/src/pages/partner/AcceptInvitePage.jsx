// Public page for partner portal users to set their password from an email invite.
// Route: /partners/accept-invite?token=...
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Building2, Loader2, CheckCircle2, AlertTriangle, KeyRound } from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;
const ax = axios.create({ baseURL: API, headers: { "X-PM-Client": "propmanage-app" } });

const AcceptInvitePage = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState(null);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) { setLoading(false); return; }
      try {
        const { data } = await ax.get(`/api/partner/invite/${token}`);
        setInfo(data);
      } catch (e) {
        setInfo({ valid: false });
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (pwd.length < 8) { setErr("Parola trebuie să aibă minim 8 caractere."); return; }
    if (pwd !== pwd2) { setErr("Parolele nu coincid."); return; }
    setSubmitting(true);
    try {
      await ax.post(`/api/partner/accept-invite`, { token, password: pwd });
      setDone(true);
      setTimeout(() => navigate("/login"), 2500);
    } catch (e) {
      setErr(e.response?.data?.detail || e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const Shell = ({ children }) => (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[#0a0a0b] text-white relative overflow-hidden" data-testid="accept-invite-page">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-[#d4ff3a] blur-[200px] opacity-10" />
      <div className="relative w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#d4ff3a] to-[#a8e028] flex items-center justify-center">
            <Building2 className="w-5 h-5 text-black" strokeWidth={2.5} />
          </div>
          <span className="font-serif text-2xl font-semibold">PropManage</span>
        </Link>
        <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-8 backdrop-blur-xl">{children}</div>
      </div>
    </div>
  );

  if (loading) return <Shell><div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-[#d4ff3a]" /></div></Shell>;

  if (!token || !info?.valid) return (
    <Shell>
      <div className="text-center space-y-3" data-testid="invite-invalid">
        <AlertTriangle className="w-10 h-10 text-rose-400 mx-auto" />
        <h1 className="text-xl font-semibold">Invitație invalidă</h1>
        <p className="text-sm text-white/60">Linkul este expirat, a fost deja folosit sau este incorect. Cere administratorului o nouă invitație.</p>
        <Link to="/login" className="inline-block mt-2 text-sm text-[#d4ff3a] hover:underline">Mergi la autentificare</Link>
      </div>
    </Shell>
  );

  if (done) return (
    <Shell>
      <div className="text-center space-y-3" data-testid="invite-success">
        <CheckCircle2 className="w-10 h-10 text-[#d4ff3a] mx-auto" />
        <h1 className="text-xl font-semibold">Cont activat</h1>
        <p className="text-sm text-white/60">Parola a fost setată. Te redirecționăm către autentificare…</p>
      </div>
    </Shell>
  );

  return (
    <Shell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold flex items-center gap-2"><KeyRound className="w-5 h-5 text-[#d4ff3a]" /> Activează-ți contul</h1>
        <p className="text-sm text-white/60 mt-2">
          Portal partener <span className="text-[#d4ff3a] font-medium">{info.partner_company}</span>
        </p>
        <p className="text-xs text-white/40 mt-1">{info.email}</p>
      </div>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Parolă nouă</label>
          <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-[#d4ff3a] outline-none text-sm" placeholder="Minim 8 caractere" data-testid="invite-password" />
        </div>
        <div>
          <label className="block text-xs uppercase tracking-wider text-white/50 mb-1.5">Confirmă parola</label>
          <input type="password" value={pwd2} onChange={(e) => setPwd2(e.target.value)} className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 focus:border-[#d4ff3a] outline-none text-sm" placeholder="Reintrodu parola" data-testid="invite-password-confirm" />
        </div>
        {err && <div className="text-sm text-rose-400" data-testid="invite-error">{err}</div>}
        <button type="submit" disabled={submitting} className="w-full py-2.5 rounded-lg bg-[#d4ff3a] text-black font-semibold hover:bg-[#c3ef2a] disabled:opacity-50 flex items-center justify-center gap-2" data-testid="invite-submit">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Setează parola & activează"}
        </button>
      </form>
    </Shell>
  );
};

export default AcceptInvitePage;
export { AcceptInvitePage };
