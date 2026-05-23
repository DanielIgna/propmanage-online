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
