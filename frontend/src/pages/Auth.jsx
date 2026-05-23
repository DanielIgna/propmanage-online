// PropManage - Auth Pages (Login, Register)
import React, { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, ArrowRight, Sparkles, Languages } from "lucide-react";
import { useAuth, formatApiError } from "../auth";
import { useI18n } from "../i18n";

const Backdrop = () => (
  <div className="fixed inset-0 -z-10">
    <div className="absolute inset-0 bg-[#0a0a0b]" />
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[#d4ff3a] blur-[200px] opacity-10" />
    <div className="absolute inset-0 dotted-bg opacity-20" />
  </div>
);

const TopBar = () => {
  const { lang, toggle } = useI18n();
  return (
    <div className="absolute top-0 left-0 right-0 flex justify-between items-center p-6 z-10">
      <Link to="/" className="flex items-center gap-2" data-testid="auth-logo">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#d4ff3a] to-[#a8e028] flex items-center justify-center">
          <Building2 className="w-4 h-4 text-black" strokeWidth={2.5} />
        </div>
        <span className="font-serif text-xl font-semibold">PropManage</span>
      </Link>
      <button onClick={toggle} className="flex items-center gap-2 px-3 py-1.5 glass rounded-full text-xs uppercase tracking-wider" data-testid="lang-toggle">
        <Languages className="w-3.5 h-3.5" />
        {lang.toUpperCase()}
      </button>
    </div>
  );
};

export const LoginPage = () => {
  const { user, login } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  if (user && user !== false) return <Navigate to={`/${user.role}`} replace />;
  
  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const u = await login(email, password);
      navigate(`/${u.role}`);
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };
  
  const demoLogin = async (role) => {
    const creds = {
      client: { email: "client@propmanage.io", password: "Client123!" },
      specialist: { email: "specialist@propmanage.io", password: "Spec123!" },
      admin: { email: "admin@propmanage.io", password: "Admin123!" },
      operator: { email: "operator@propmanage.io", password: "Op123!" },
    }[role];
    setEmail(creds.email); setPassword(creds.password);
    setError(""); setLoading(true);
    try {
      const u = await login(creds.email, creds.password);
      navigate(`/${u.role}`);
    } catch (err) {
      setError(formatApiError(err));
    } finally { setLoading(false); }
  };
  
  return (
    <div className="min-h-screen relative flex items-center justify-center p-6">
      <Backdrop />
      <TopBar />
      
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="glass-strong rounded-3xl p-10">
          <h1 className="font-serif text-4xl mb-2" data-testid="login-title">{t("login.title")}</h1>
          <p className="text-sm text-stone-400 mb-8">{t("login.subtitle")}</p>
          
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-400 mb-1.5 block">{t("common.email")}</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#d4ff3a]/50 transition"
                placeholder="name@example.com"
                data-testid="login-email"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-400 mb-1.5 block">{t("common.password")}</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#d4ff3a]/50 transition"
                placeholder="••••••••"
                data-testid="login-password"
              />
            </div>
            {error && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3" data-testid="login-error">{error}</div>}
            <button type="submit" disabled={loading} className="btn-accent w-full py-3 rounded-xl font-medium disabled:opacity-50 flex items-center justify-center gap-2" data-testid="login-submit">
              {loading ? t("common.loading") : t("login.submit")}
              {!loading && <ArrowRight className="w-4 h-4" />}
            </button>
          </form>
          
          {/* Google OAuth */}
          {/* REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH */}
          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-white/10" />
            <span className="text-[10px] text-stone-500 uppercase tracking-wider">sau</span>
            <div className="flex-1 h-px bg-white/10" />
          </div>
          <button
            type="button"
            onClick={() => {
              const redirectUrl = window.location.origin + "/auth/callback";
              window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
            }}
            className="w-full flex items-center justify-center gap-3 bg-white text-black py-3 rounded-xl text-sm font-medium hover:bg-stone-100 transition"
            data-testid="google-login-btn"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuă cu Google
          </button>
          
          <div className="mt-6 text-center text-xs text-stone-500">
            {t("login.noAccount")} <Link to="/register" className="text-[#d4ff3a] hover:underline" data-testid="login-register-link">{t("login.register")}</Link>
          </div>
        </div>
        
        {/* Demo accounts */}
        <div className="mt-6 glass rounded-3xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4 text-[#d4ff3a]" />
            <div className="text-xs uppercase tracking-wider text-stone-400">{t("login.demo")}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {["client", "specialist", "admin", "operator"].map(role => (
              <button key={role} onClick={() => demoLogin(role)} disabled={loading}
                className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl py-2.5 text-xs font-medium capitalize transition disabled:opacity-50"
                data-testid={`demo-${role}`}>
                {role}
              </button>
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export const RegisterPage = () => {
  const { user, register } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "client", phone: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  if (user && user !== false) return <Navigate to={`/${user.role}`} replace />;
  
  const submit = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const u = await register(form);
      navigate(`/${u.role}`);
    } catch (err) {
      setError(formatApiError(err));
    } finally { setLoading(false); }
  };
  
  return (
    <div className="min-h-screen relative flex items-center justify-center p-6">
      <Backdrop /><TopBar />
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="glass-strong rounded-3xl p-10">
          <h1 className="font-serif text-4xl mb-2" data-testid="register-title">{t("register.title")}</h1>
          <p className="text-sm text-stone-400 mb-8">{t("register.subtitle")}</p>
          
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-400 mb-1.5 block">{t("common.name")}</label>
              <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#d4ff3a]/50"
                data-testid="register-name" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-400 mb-1.5 block">{t("common.email")}</label>
              <input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#d4ff3a]/50"
                data-testid="register-email" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-400 mb-1.5 block">{t("common.password")}</label>
              <input type="password" required minLength={6} value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#d4ff3a]/50"
                data-testid="register-password" />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-stone-400 mb-1.5 block">{t("register.role")}</label>
              <div className="grid grid-cols-2 gap-2">
                {[{v:"client", l:t("register.client")}, {v:"specialist", l:t("register.specialist")}].map(o => (
                  <button type="button" key={o.v} onClick={() => setForm({...form, role: o.v})}
                    className={`py-3 rounded-xl text-sm border transition ${form.role === o.v ? "bg-[#d4ff3a]/15 border-[#d4ff3a]/50 text-white" : "bg-white/5 border-white/10 text-stone-400"}`}
                    data-testid={`register-role-${o.v}`}>{o.l}</button>
                ))}
              </div>
            </div>
            {error && <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3" data-testid="register-error">{error}</div>}
            <button type="submit" disabled={loading} className="btn-accent w-full py-3 rounded-xl font-medium disabled:opacity-50" data-testid="register-submit">
              {loading ? t("common.loading") : t("register.submit")}
            </button>
          </form>
          <div className="mt-6 text-center text-xs text-stone-500">
            {t("register.hasAccount")} <Link to="/login" className="text-[#d4ff3a] hover:underline">Sign in</Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
