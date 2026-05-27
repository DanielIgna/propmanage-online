import React, { useState, useEffect, useRef } from "react";
import { BrowserRouter, Routes, Route, Link, Navigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Wrench, Shield, Wallet, Box, Users, AlertTriangle, CheckCircle2,
  ArrowRight, ArrowUpRight, Zap, Droplet, Wind, Building2, Coins, TrendingUp,
  Eye, Lock, Star, Sparkles, FileCheck, Gavel, ChevronRight, Play, Pause,
  Activity, Layers, Cpu, Award, MessageSquare, Camera, Bell, Plus, Minus, Languages, LogIn, LogOut, LayoutDashboard, ShieldCheck
} from "lucide-react";
import { AuthProvider, useAuth } from "./auth";
import { I18nProvider, useI18n } from "./i18n";
import { useABTest } from "./ab";
import { LoginPage, RegisterPage } from "./pages/Auth";
import { ThemeToggle } from "./pages/DashShared";
import { ClientDashboard, SpecialistDashboard, AdminDashboard, OperatorDashboard } from "./pages/Dashboards";
import { AuthCallback } from "./pages/AuthCallback";
import { SpecialistProfile } from "./pages/SpecialistProfile";
import { PublicMarketplace } from "./pages/Marketplace";
import { ProjectWorkspace } from "./pages/ProjectWorkspace";
import { PaymentSuccess } from "./pages/PaymentSuccess";
import { TutorialOverlay } from "./pages/TutorialOverlay";
import { AIConciergeBubble } from "./components/AIConciergeBubble";
import { BookDemoModal } from "./pages/BookDemoModal";
import { PrivacyPage, TermsPage } from "./pages/LegalPages";
import { PrivacyNoticesPage } from "./pages/PrivacyNoticesPage";
import { StatusPage } from "./pages/StatusPage";
import { GDPRAuditBadge } from "./components/GDPRAuditBadge";
import { TrustStrip } from "./components/TrustStrip";
import DigitalTwinPage from "./pages/DigitalTwinPage";
import ReportApprovalPage from "./pages/ReportApprovalPage";
import { ImpersonationBanner } from "./components/ImpersonationBanner";
import "./App.css";

// ============= NAV =============
const Nav = () => {
  const [scrolled, setScrolled] = useState(false);
  const { user, logout } = useAuth();
  const { lang, toggle, t } = useI18n();
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = async () => {
    try { await logout(); } catch (_) { /* ignore */ }
    window.location.href = "/";
  };

  const links = [
    { href: "#problem", label: t("nav.problem") },
    { href: "#solution", label: t("nav.solution") },
    { href: "#journey", label: t("nav.journey") },
    { href: "#twin", label: t("nav.twin") },
    { href: "/marketplace", label: "Marketplace", external: true },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${scrolled ? "py-3" : "py-6"}`}>
      <div className={`max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between gap-2 ${scrolled ? "glass-strong rounded-full sm:mx-6 sm:px-6" : ""}`}>
        <a href="#top" className="flex items-center gap-2" data-testid="nav-logo">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#d4ff3a] to-[#a8e028] flex items-center justify-center">
            <Building2 className="w-4 h-4 text-black" strokeWidth={2.5} />
          </div>
          <span className="font-serif text-lg sm:text-xl font-semibold tracking-tight">PropManage</span>
        </a>
        <div className="hidden lg:flex items-center gap-6 xl:gap-8">
          {links.map(l => l.external ? (
            <Link key={l.href} to={l.href} className="text-sm text-stone-400 hover:text-white transition-colors" data-testid={`nav-${l.label}`}>
              {l.label}
            </Link>
          ) : (
            <a key={l.href} href={l.href} className="text-sm text-stone-400 hover:text-white transition-colors" data-testid={`nav-${l.label}`}>
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggle} className="flex items-center gap-1 px-2 sm:px-3 py-1.5 hover:bg-white/5 rounded-full text-xs uppercase tracking-wider text-stone-300" data-testid="lang-toggle">
            <Languages className="w-3.5 h-3.5" />{lang.toUpperCase()}
          </button>
          {user && user !== false && user.role === "admin" && (
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 transition-colors"
              data-testid="nav-admin"
              title="Panou Admin"
            >
              <ShieldCheck className="w-3.5 h-3.5" /><span className="hidden sm:inline">Admin</span>
            </Link>
          )}
          {user && user !== false ? (
            <>
              <Link to={`/${user.role}`} className="btn-accent px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium inline-flex items-center gap-1.5" data-testid="nav-dashboard">
                <LayoutDashboard className="w-3.5 h-3.5" /><span className="hidden sm:inline">{t("nav.dashboard")}</span>
              </Link>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium bg-white/5 hover:bg-white/10 text-stone-300 border border-white/10 transition-colors"
                data-testid="nav-logout"
                title="Deconectare"
              >
                <LogOut className="w-3.5 h-3.5" /><span className="hidden sm:inline">Logout</span>
              </button>
            </>
          ) : (
            <Link to="/login" className="btn-accent px-3 sm:px-5 py-2 sm:py-2.5 rounded-full text-xs sm:text-sm font-medium inline-flex items-center gap-1.5" data-testid="nav-login">
              <LogIn className="w-3.5 h-3.5" /><span className="hidden sm:inline">{t("nav.login")}</span>
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
};

// ============= HERO =============
const Hero = () => {
  const { t } = useI18n();
  const { variant, trackClick } = useABTest("hero_cta1");
  const { variant: variant2, trackClick: trackClick2 } = useABTest("hero_cta2");
  const ctaText = t(`hero.cta1.variant_${variant}`) || t("hero.cta1");
  const cta2Text = t(`hero.cta2.variant_${variant2}`) || t("hero.cta2");
  return (
  <section id="top" className="relative min-h-screen flex items-center pt-32 pb-20 px-6 overflow-hidden">
    <div className="absolute inset-0 dotted-bg opacity-30" />
    <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-[#d4ff3a] blur-[150px] opacity-10" />
    
    <div className="max-w-7xl mx-auto w-full relative">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full" data-testid="hero-badge">
            <div className="w-2 h-2 rounded-full bg-[#d4ff3a] pulse-dot" />
            <span className="text-xs tracking-wide text-stone-300">{t("hero.badge")}</span>
          </div>
        </div>
        <TrustStrip className="mb-8" />
        
        <h1 className="font-serif text-6xl md:text-8xl lg:text-9xl leading-[0.95] tracking-tight mb-8 max-w-5xl" data-testid="hero-title">
          {t("hero.title1")}<br/>
          <span className="italic gradient-text">{t("hero.title2")}</span> {t("hero.title3")}
        </h1>
        
        <p className="text-lg md:text-xl text-stone-400 max-w-2xl mb-10 leading-relaxed">
          {t("hero.subtitle")}
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <a href="#problem" onClick={trackClick} className="btn-accent px-8 py-4 rounded-full font-medium inline-flex items-center gap-2 group" data-testid="hero-start-btn" data-ab-variant={variant}>
            {ctaText}
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
          <a href="#journey" onClick={trackClick2} className="glass px-8 py-4 rounded-full font-medium inline-flex items-center gap-2 hover:bg-white/10 transition-colors" data-testid="hero-journey-btn" data-ab-variant={variant2}>
            <Play className="w-4 h-4" />
            {cta2Text}
          </a>
        </div>
      </motion.div>

      {/* Stats strip */}
      <motion.div 
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.3 }}
        className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-8 pt-12 border-t border-white/5"
      >
        {[
          { v: "12,842", l: t("hero.stat1") },
          { v: "856", l: t("hero.stat2") },
          { v: "142", l: t("hero.stat3") },
          { v: "94%", l: t("hero.stat4") },
        ].map((s, i) => (
          <div key={i} data-testid={`hero-stat-${i}`}>
            <div className="font-serif text-4xl md:text-5xl font-medium">{s.v}</div>
            <div className="text-xs uppercase tracking-wider text-stone-500 mt-2">{s.l}</div>
          </div>
        ))}
      </motion.div>
    </div>
  </section>
  );
};

// ============= SECTION HEADER =============
const SectionTag = ({ num, label }) => (
  <div className="inline-flex items-center gap-3 mb-6">
    <span className="font-mono text-xs text-[#d4ff3a]">{num}</span>
    <div className="w-12 h-px bg-[#d4ff3a]" />
    <span className="text-xs uppercase tracking-[0.2em] text-stone-400">{label}</span>
  </div>
);

// ============= PROBLEM =============
const Problem = () => {
  const { t } = useI18n();
  const problems = [
    { icon: Eye, title: t("problem.p1.t"), desc: t("problem.p1.d") },
    { icon: Activity, title: t("problem.p2.t"), desc: t("problem.p2.d") },
    { icon: Shield, title: t("problem.p3.t"), desc: t("problem.p3.d") },
    { icon: TrendingUp, title: t("problem.p4.t"), desc: t("problem.p4.d") },
  ];

  return (
    <section id="problem" className="py-32 px-6 relative">
      <div className="max-w-7xl mx-auto">
        <SectionTag num="01" label={t("sec.problem")} />
        <h2 className="font-serif text-5xl md:text-7xl tracking-tight mb-6 max-w-4xl" data-testid="problem-title">
          {t("problem.title1")} <span className="italic">{t("problem.title2")}</span>
        </h2>
        <p className="text-lg text-stone-400 max-w-2xl mb-16">
          {t("problem.intro")}
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {problems.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass p-8 rounded-3xl hover:bg-white/[0.06] transition-colors"
              data-testid={`problem-card-${i}`}
            >
              <div className="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
                <p.icon className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="font-serif text-2xl mb-3">{p.title}</h3>
              <p className="text-sm text-stone-400 leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============= SOLUTION =============
const Solution = () => {
  const { t } = useI18n();
  const pillars = [
    { icon: Box, title: t("sol.p1.t"), desc: t("sol.p1.d") },
    { icon: Users, title: t("sol.p2.t"), desc: t("sol.p2.d") },
    { icon: Lock, title: t("sol.p3.t"), desc: t("sol.p3.d") },
    { icon: FileCheck, title: t("sol.p4.t"), desc: t("sol.p4.d") },
  ];

  return (
    <section id="solution" className="py-32 px-6 relative">
      <div className="absolute inset-0 dotted-bg opacity-20" />
      <div className="max-w-7xl mx-auto relative">
        <SectionTag num="02" label={t("sec.solution")} />
        <div className="grid lg:grid-cols-2 gap-16 items-start mb-20">
          <div>
            <h2 className="font-serif text-5xl md:text-7xl tracking-tight" data-testid="solution-title">
              {t("sol.title1")} <span className="italic">{t("sol.title2")}</span>
            </h2>
          </div>
          <div className="lg:pt-12">
            <p className="text-lg text-stone-400 leading-relaxed">
              {t("sol.intro")}
            </p>
            <div className="mt-8 flex items-center gap-3 text-sm text-stone-300">
              <CheckCircle2 className="w-5 h-5 text-[#d4ff3a]" />
              <span className="text-white font-medium">{t("sol.tagline")}</span>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {pillars.map((p, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-strong p-8 rounded-3xl group hover:border-[#d4ff3a]/30 transition-all"
              data-testid={`solution-pillar-${i}`}
            >
              <div className="w-14 h-14 rounded-2xl bg-[#d4ff3a]/10 border border-[#d4ff3a]/20 flex items-center justify-center mb-6 group-hover:bg-[#d4ff3a]/20 transition-colors">
                <p.icon className="w-6 h-6 text-[#d4ff3a]" strokeWidth={1.5} />
              </div>
              <h3 className="font-serif text-2xl mb-3">{p.title}</h3>
              <p className="text-sm text-stone-400 leading-relaxed">{p.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============= USER JOURNEY (Interactive) =============
const UserJourney = () => {
  const steps = [
    { id: "A", title: "Creează cont", desc: "Înregistrare rapidă cu email, Google sau Apple. Verificare telefon în 30 secunde.", visual: "auth" },
    { id: "B", title: "Adaugă proprietatea", desc: "Introdu detaliile imobilului. Sistemul inițiază procesul de digitalizare.", visual: "property" },
    { id: "C", title: "Vezi Digital Twin", desc: "Explorează modelul 3D al proprietății cu toate sistemele mapate (HVAC, Electric, Sanitar).", visual: "twin" },
    { id: "D", title: "Detectează problema", desc: "Senzori IoT sau utilizatorul identifică o anomalie. Sistemul propune intervenție.", visual: "alert" },
    { id: "E", title: "System match", desc: "Algoritmul găsește specialiștii potriviți: distanță, rating, preț, disponibilitate.", visual: "match" },
    { id: "F", title: "Alege specialist", desc: "Compară oferte, vezi recenzii, verifică certificările. Confirmă selecția.", visual: "select" },
    { id: "G", title: "Execuție lucrare", desc: "Chat în timp real, apel video de verificare, tracking GPS specialist.", visual: "work" },
    { id: "H", title: "Plată în Escrow", desc: "Suma e securizată în portofelul PropManage. Specialistul vede că banii sunt acolo.", visual: "escrow" },
    { id: "I", title: "Confirmă finalizarea", desc: "Verifici lucrarea, eliberezi plata, primești +100 tokens recompensă.", visual: "confirm" },
    { id: "J", title: "Update Digital Twin", desc: "Istoricul proprietății se actualizează automat. Scorul de sănătate crește.", visual: "update" },
  ];

  const [active, setActive] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  
  useEffect(() => {
    if (!autoplay) return;
    const timer = setInterval(() => {
      setActive(prev => (prev + 1) % steps.length);
    }, 3500);
    return () => clearInterval(timer);
  }, [autoplay, steps.length]);

  return (
    <section id="journey" className="py-32 px-6 relative">
      <div className="max-w-7xl mx-auto">
        <SectionTag num="03" label="Experiență Utilizator" />
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <h2 className="font-serif text-5xl md:text-7xl tracking-tight max-w-3xl" data-testid="journey-title">
            Călătoria de la <span className="italic">A la J</span>.
          </h2>
          <button onClick={() => setAutoplay(!autoplay)} className="glass px-4 py-2.5 rounded-full flex items-center gap-2 text-sm hover:bg-white/10 transition-colors" data-testid="journey-autoplay">
            {autoplay ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            {autoplay ? "Pauză auto-play" : "Pornește auto-play"}
          </button>
        </div>
        <p className="text-lg text-stone-400 max-w-2xl mb-16">
          Click pe oricare pas sau lasă să ruleze automat. Un flux complet, transparent, fără surprize.
        </p>

        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-12">
          {/* Steps list */}
          <div className="space-y-2">
            {steps.map((s, i) => (
              <button
                key={s.id}
                onClick={() => { setActive(i); setAutoplay(false); }}
                className={`w-full text-left p-5 rounded-2xl transition-all border ${
                  active === i 
                    ? "bg-[#d4ff3a]/10 border-[#d4ff3a]/30" 
                    : "glass border-white/5 hover:bg-white/[0.04]"
                }`}
                data-testid={`journey-step-${s.id}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`relative w-10 h-10 rounded-full flex items-center justify-center font-serif text-lg shrink-0 ${
                    active === i ? "bg-[#d4ff3a] text-black" : "bg-white/10 text-stone-400"
                  }`}>
                    {s.id}
                    {active === i && autoplay && (
                      <svg className="absolute inset-0 -m-0.5" viewBox="0 0 44 44">
                        <circle cx="22" cy="22" r="20" fill="none" stroke="#d4ff3a" strokeWidth="1.5" strokeDasharray="125.6" strokeDashoffset="125.6" opacity="0.6">
                          <animate attributeName="stroke-dashoffset" from="125.6" to="0" dur="3.5s" repeatCount="1" />
                        </circle>
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{s.title}</div>
                    {active === i && (
                      <motion.p 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="text-sm text-stone-400 mt-2"
                      >
                        {s.desc}
                      </motion.p>
                    )}
                  </div>
                  <ChevronRight className={`w-4 h-4 shrink-0 transition-transform ${active === i ? "rotate-90 text-[#d4ff3a]" : "text-stone-500"}`} />
                </div>
              </button>
            ))}
          </div>

          {/* Visual preview */}
          <div className="lg:sticky lg:top-32 h-fit">
            <PhoneMockup step={steps[active]} />
          </div>
        </div>
      </div>
    </section>
  );
};

// ============= PHONE MOCKUP =============
const PhoneMockup = ({ step }) => {
  const renderContent = () => {
    switch (step.visual) {
      case "auth":
        return (
          <div className="space-y-3">
            <div className="text-center mb-6">
              <h4 className="font-serif text-xl mb-1">Bine ai venit</h4>
              <p className="text-xs text-stone-400">Introduceți datele pentru a accesa contul</p>
            </div>
            <button className="w-full bg-white text-black py-3 rounded-xl text-sm font-medium">Continuă cu Google</button>
            <button className="w-full bg-black border border-white/20 py-3 rounded-xl text-sm font-medium">Continuă cu Apple</button>
            <div className="text-center text-xs text-stone-500 py-2">SAU EMAIL</div>
            <div className="bg-white/5 rounded-xl px-4 py-3 text-xs text-stone-400">name@example.com</div>
            <div className="bg-white/5 rounded-xl px-4 py-3 text-xs text-stone-400">••••••••</div>
            <button className="w-full bg-[#d4ff3a] text-black py-3 rounded-xl text-sm font-medium">Conectează-te</button>
          </div>
        );
      case "property":
        return (
          <div className="space-y-4">
            <div className="aspect-video rounded-xl bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-white/10 flex items-center justify-center">
              <Building2 className="w-12 h-12 text-white/40" strokeWidth={1} />
            </div>
            <h4 className="font-serif text-xl">Skyline Loft A4</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-stone-400">Tip</span><span>Apartament 3 cam.</span></div>
              <div className="flex justify-between"><span className="text-stone-400">Suprafață</span><span>92 m²</span></div>
              <div className="flex justify-between"><span className="text-stone-400">Etaj</span><span>4 / 8</span></div>
            </div>
            <button className="w-full bg-[#d4ff3a] text-black py-3 rounded-xl text-sm font-medium mt-4">Inițiază Digitalizare</button>
          </div>
        );
      case "twin":
        return (
          <div className="space-y-3">
            <div className="aspect-square rounded-xl bg-gradient-to-br from-cyan-500/30 via-emerald-500/20 to-purple-500/20 border border-white/10 relative overflow-hidden flex items-center justify-center">
              <div className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-black/40 backdrop-blur px-2 py-1 rounded-full text-[10px]">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" /> LIVE 3D
              </div>
              <Box className="w-20 h-20 text-white/30" strokeWidth={0.8} />
            </div>
            <div className="text-xs text-stone-400">Subsisteme · 4 active</div>
            {[
              { i: Zap, n: "Sistem Electric", s: "Optim", c: "emerald" },
              { i: Droplet, n: "Sistem Hidraulic", s: "Atenție", c: "red" },
              { i: Wind, n: "HVAC", s: "92% eficient", c: "emerald" },
            ].map((it, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-${it.c}-500/15`}>
                  <it.i className={`w-4 h-4 text-${it.c}-400`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium">{it.n}</div>
                  <div className={`text-[10px] text-${it.c}-400`}>{it.s}</div>
                </div>
                <CheckCircle2 className={`w-4 h-4 text-${it.c}-400`} />
              </div>
            ))}
          </div>
        );
      case "alert":
        return (
          <div className="space-y-3">
            <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-red-400">Anomalie detectată</div>
                  <p className="text-xs text-stone-300 mt-1">Sistem hidraulic — debit neregulat în Sector B. Inspecție urgentă necesară.</p>
                </div>
              </div>
            </div>
            <div className="bg-white/5 rounded-xl p-4 space-y-2">
              <div className="text-xs text-stone-400 uppercase tracking-wider">Recomandare AI</div>
              <p className="text-sm">Specialist Instalator Sanitar · ETA &lt; 2h · Cost estimat: 180-250 RON</p>
            </div>
            <button className="w-full bg-[#d4ff3a] text-black py-3 rounded-xl text-sm font-medium">Solicită Mentenanță</button>
          </div>
        );
      case "match":
      case "select":
        return (
          <div className="space-y-3">
            <div className="text-xs text-stone-400">3 specialiști disponibili</div>
            {[
              { n: "Andrei Popescu", r: "4.9", p: "180-250", d: "1.2 km", v: true, a: "Disponibil acum" },
              { n: "Mihai Ionescu", r: "4.7", p: "150-220", d: "3.5 km", v: true, a: "În 2h" },
              { n: "Cristian Vasile", r: "4.5", p: "200-280", d: "0.8 km", v: false, a: "Mâine" },
            ].map((s, i) => (
              <div key={i} className={`bg-white/5 rounded-xl p-3 ${i === 0 && step.visual === "select" ? "ring-2 ring-[#d4ff3a]" : ""}`}>
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-stone-600 to-stone-800 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{s.n}</span>
                      {s.v && <CheckCircle2 className="w-3 h-3 text-[#d4ff3a]" />}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-stone-400 mt-0.5">
                      <span className="flex items-center gap-0.5"><Star className="w-2.5 h-2.5 fill-yellow-400 text-yellow-400" />{s.r}</span>
                      <span>·</span><span>{s.p} RON</span><span>·</span><span>{s.d}</span>
                    </div>
                    <div className={`text-[10px] mt-1 ${s.a.includes("acum") ? "text-emerald-400" : "text-stone-500"}`}>{s.a}</div>
                  </div>
                </div>
              </div>
            ))}
            {step.visual === "select" && <button className="w-full bg-[#d4ff3a] text-black py-3 rounded-xl text-sm font-medium">Confirmă Specialist</button>}
          </div>
        );
      case "work":
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-stone-600 to-stone-800" />
              <div className="flex-1">
                <div className="text-sm font-medium flex items-center gap-1">
                  Andrei Popescu <CheckCircle2 className="w-3 h-3 text-[#d4ff3a]" />
                </div>
                <div className="text-[10px] text-stone-400">Expert HVAC · 4.9/5</div>
              </div>
              <button className="bg-white/10 p-2 rounded-lg"><MessageSquare className="w-3.5 h-3.5" /></button>
            </div>
            <div className="space-y-2">
              {[
                { s: "Pe drum", t: "10:15", a: true },
                { s: "În lucru", t: "10:45", a: true, current: true },
                { s: "Verificare", t: "—", a: false },
                { s: "Finalizat", t: "—", a: false },
              ].map((t, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${t.current ? "bg-[#d4ff3a] pulse-dot" : t.a ? "bg-emerald-400" : "bg-stone-700"}`} />
                  <div className="text-xs flex-1">{t.s}</div>
                  <div className="text-[10px] text-stone-500">{t.t}</div>
                </div>
              ))}
            </div>
            <div className="bg-white/5 rounded-xl p-3">
              <div className="text-[10px] text-stone-400 uppercase mb-2">Ultim mesaj</div>
              <p className="text-xs">"Am identificat scurgerea la valva de expansiune. Înlocuiesc piesa acum."</p>
            </div>
          </div>
        );
      case "escrow":
        return (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-[#d4ff3a]/20 to-emerald-500/10 border border-[#d4ff3a]/30 rounded-2xl p-6 text-center">
              <Lock className="w-8 h-8 text-[#d4ff3a] mx-auto mb-3" />
              <div className="text-xs text-stone-400 uppercase tracking-wider mb-1">Suma în Escrow</div>
              <div className="font-serif text-4xl">1,200 <span className="text-lg">RON</span></div>
              <div className="inline-flex items-center gap-1.5 mt-3 bg-emerald-500/10 px-3 py-1 rounded-full">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="text-[10px] text-emerald-400 uppercase tracking-wider">Securizat</span>
              </div>
            </div>
            <div className="text-xs text-stone-400 text-center">Banii sunt eliberați doar după confirmarea ta.</div>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between bg-white/5 rounded-lg p-2"><span>Comision PropManage</span><span>3%</span></div>
              <div className="flex justify-between bg-white/5 rounded-lg p-2"><span>Protecție Escrow</span><span className="text-emerald-400">Inclusă</span></div>
            </div>
          </div>
        );
      case "confirm":
        return (
          <div className="space-y-4 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            </div>
            <h4 className="font-serif text-2xl">Lucrare Confirmată!</h4>
            <p className="text-xs text-stone-400">Toate detaliile au fost salvate în jurnalul digital al proprietății.</p>
            <div className="bg-[#d4ff3a]/10 border border-[#d4ff3a]/30 rounded-2xl p-4 flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-[#d4ff3a]" />
              <div className="text-left flex-1">
                <div className="text-[10px] text-stone-400 uppercase">Bonus Recompensă</div>
                <div className="text-sm font-medium">Ai primit +100 Tokeni</div>
              </div>
            </div>
            <button className="w-full bg-white text-black py-3 rounded-xl text-sm font-medium">Eliberează Plata</button>
          </div>
        );
      case "update":
        return (
          <div className="space-y-4">
            <div className="text-xs text-stone-400 uppercase tracking-wider">Digital Twin actualizat</div>
            <div className="bg-white/5 rounded-2xl p-5">
              <div className="text-xs text-stone-400 mb-1">Scor Sănătate</div>
              <div className="flex items-baseline gap-2">
                <div className="font-serif text-5xl">98</div>
                <div className="text-sm text-stone-500">/100</div>
                <div className="ml-auto text-xs text-emerald-400 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> +12
                </div>
              </div>
              <div className="h-2 bg-white/5 rounded-full mt-3 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#d4ff3a] to-emerald-400 rounded-full" style={{ width: "98%" }} />
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-stone-400 uppercase tracking-wider">Istoric mentenanță</div>
              {[
                { d: "Azi", t: "Reparație HVAC", w: "Andrei Popescu", s: "FINALIZAT" },
                { d: "12 Oct", t: "Înlocuire filtre", w: "Mihai Ionescu", s: "FINALIZAT" },
              ].map((h, i) => (
                <div key={i} className="bg-white/5 rounded-xl p-3">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium">{h.t}</span>
                    <span className="text-[10px] text-emerald-400">{h.s}</span>
                  </div>
                  <div className="text-[10px] text-stone-500 mt-0.5">{h.d} · {h.w}</div>
                </div>
              ))}
            </div>
          </div>
        );
      default: return null;
    }
  };

  return (
    <div className="relative">
      <div className="absolute inset-0 phone-glow" />
      <div className="relative mx-auto max-w-[340px] bg-black border border-white/10 rounded-[3rem] p-3 shadow-2xl">
        <div className="bg-[#0a0a0b] rounded-[2.5rem] overflow-hidden">
          <div className="h-6 bg-black flex items-center justify-center">
            <div className="w-20 h-4 bg-black rounded-full" />
          </div>
          <div className="p-5 min-h-[520px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={step.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============= SPECIALIST JOURNEY =============
const SpecialistJourney = () => {
  const tiers = [
    {
      name: "ENTRY",
      color: "stone",
      price: "Gratuit",
      desc: "Înregistrare nouă",
      features: ["Acces lead-uri standard", "Profil de bază", "Comision standard 15%", "0-9 recenzii"]
    },
    {
      name: "VERIFIED",
      color: "lime",
      price: "După 10+ joburi",
      desc: "Specialist Verificat",
      features: ["Lead-uri prioritare", "Insignă VERIFIED", "Comision redus -15%", "Rating min 4.8", "Profil extins"],
      highlight: true
    },
    {
      name: "PREMIUM",
      color: "amber",
      price: "Elite Network",
      desc: "PropManage Elite",
      features: ["Acces Wallet Users (50K+)", "Comisioane preferențiale", "Top 3 în căutări", "Account manager dedicat", "Acces beta features"]
    },
  ];

  return (
    <section className="py-32 px-6 relative">
      <div className="max-w-7xl mx-auto">
        <SectionTag num="04" label="Experiență Specialist" />
        <div className="grid lg:grid-cols-2 gap-12 items-end mb-16">
          <h2 className="font-serif text-5xl md:text-7xl tracking-tight" data-testid="specialist-title">
            De la <span className="italic">Entry</span> la <span className="italic">Premium</span>.
          </h2>
          <p className="text-lg text-stone-400 max-w-md">
            Specialiștii cresc în reputație, accesează lead-uri mai bune și câștigă mai mult — toate transparent, măsurabil, meritocratic.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {tiers.map((t, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`relative p-8 rounded-3xl ${
                t.highlight
                  ? "bg-gradient-to-br from-[#d4ff3a]/20 to-emerald-500/5 border-2 border-[#d4ff3a]/40 glow-lime"
                  : "glass border border-white/10"
              }`}
              data-testid={`tier-${t.name}`}
            >
              {t.highlight && (
                <div className="absolute -top-3 left-8 bg-[#d4ff3a] text-black text-[10px] font-bold tracking-wider px-3 py-1 rounded-full">
                  RECOMANDAT
                </div>
              )}
              <div className="text-xs tracking-[0.2em] text-stone-400 mb-2">{t.name}</div>
              <div className="font-serif text-3xl mb-1">{t.desc}</div>
              <div className="text-sm text-stone-400 mb-6">{t.price}</div>
              <div className="space-y-3">
                {t.features.map((f, j) => (
                  <div key={j} className="flex items-start gap-2 text-sm">
                    <CheckCircle2 className={`w-4 h-4 mt-0.5 shrink-0 ${t.highlight ? "text-[#d4ff3a]" : "text-stone-500"}`} />
                    <span className={t.highlight ? "text-white" : "text-stone-300"}>{f}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Specialist flow */}
        <div className="mt-20 glass-strong rounded-3xl p-10">
          <h3 className="font-serif text-3xl mb-8">Flux specialist · 6 pași</h3>
          <div className="grid md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { i: Bell, t: "Primește lead" },
              { i: Coins, t: "Plătește 40-50 RON" },
              { i: FileCheck, t: "Trimite ofertă" },
              { i: Wrench, t: "Execută jobul" },
              { i: Star, t: "Primește rating" },
              { i: Award, t: "Devine Verified" },
            ].map((s, i) => (
              <div key={i} className="text-center" data-testid={`spec-step-${i}`}>
                <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto mb-3">
                  <s.i className="w-5 h-5 text-[#d4ff3a]" strokeWidth={1.5} />
                </div>
                <div className="text-xs text-stone-400 mb-1">PAS {i + 1}</div>
                <div className="text-sm font-medium">{s.t}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ============= WALLET ECOSYSTEM =============
const WalletEcosystem = () => {
  const items = [
    {
      icon: Wallet, color: "emerald", label: "WALLET",
      title: "Bani reali",
      desc: "Plăți, escrow, retrageri automate. Securizat prin PropManage Pay.",
      stats: [{ k: "Sold curent", v: "2,450.80 RON" }, { k: "Săptămâna", v: "+12%" }]
    },
    {
      icon: Sparkles, color: "lime", label: "TOKENS",
      title: "Recompense",
      desc: "Câștigi tokens pentru joburi, recenzii și referrals. Folosește-le în ecosistem.",
      stats: [{ k: "+100", v: "per job" }, { k: "+500", v: "per referral" }, { k: "+20", v: "per review" }]
    },
    {
      icon: Coins, color: "amber", label: "CREDITS",
      title: "Pentru specialiști",
      desc: "Cumperi lead-uri și unlock-uri. Alimentezi din Wallet sau bancar direct.",
      stats: [{ k: "Per lead", v: "40-50 RON" }, { k: "Rambursare", v: "Da, în 7 zile" }]
    },
  ];

  return (
    <section className="py-32 px-6 relative">
      <div className="max-w-7xl mx-auto">
        <SectionTag num="05" label="Wallet & Ecosistem" />
        <h2 className="font-serif text-5xl md:text-7xl tracking-tight mb-6 max-w-4xl" data-testid="wallet-title">
          Trei monede. <span className="italic">Un singur ecosistem.</span>
        </h2>
        <p className="text-lg text-stone-400 max-w-2xl mb-16">
          Wallet pentru valoare reală. Tokens pentru engagement. Credits pentru specialiști. Totul interconectat, totul transparent.
        </p>

        <div className="grid md:grid-cols-3 gap-4">
          {items.map((it, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-strong rounded-3xl p-8 relative overflow-hidden"
              data-testid={`wallet-${it.label}`}
            >
              <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full bg-${it.color}-500 opacity-10 blur-3xl`} />
              <div className="relative">
                <div className={`w-14 h-14 rounded-2xl bg-${it.color}-500/15 border border-${it.color}-500/30 flex items-center justify-center mb-6`}>
                  <it.icon className={`w-6 h-6 text-${it.color}-400`} strokeWidth={1.5} />
                </div>
                <div className="text-xs tracking-[0.2em] text-stone-400 mb-2">{it.label}</div>
                <h3 className="font-serif text-3xl mb-3">{it.title}</h3>
                <p className="text-sm text-stone-400 leading-relaxed mb-6">{it.desc}</p>
                <div className="space-y-2 pt-6 border-t border-white/5">
                  {it.stats.map((s, j) => (
                    <div key={j} className="flex justify-between text-sm">
                      <span className="text-stone-400">{s.k}</span>
                      <span className="font-medium">{s.v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Escrow flow */}
        <div className="mt-16 glass-strong rounded-3xl p-10">
          <div className="flex items-center gap-3 mb-8">
            <Lock className="w-5 h-5 text-[#d4ff3a]" />
            <h3 className="font-serif text-3xl">Logică Escrow</h3>
          </div>
          <div className="grid md:grid-cols-5 gap-4 items-center">
            {[
              { t: "Client plătește", d: "Suma intră în escrow", c: "white" },
              { i: ArrowRight, sep: true },
              { t: "Specialist lucrează", d: "Vede că banii sunt securizați", c: "lime" },
              { i: ArrowRight, sep: true },
              { t: "Client confirmă", d: "Plata eliberată instant", c: "emerald" },
            ].map((s, i) => s.sep ? (
              <s.i key={i} className="w-5 h-5 text-stone-600 mx-auto hidden md:block" />
            ) : (
              <div key={i} className="text-center md:text-left">
                <div className={`font-serif text-xl mb-1 ${s.c === "lime" ? "text-[#d4ff3a]" : s.c === "emerald" ? "text-emerald-400" : ""}`}>{s.t}</div>
                <div className="text-xs text-stone-400">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ============= DIGITAL TWIN =============
const DigitalTwin = () => {
  const [hovered, setHovered] = useState(null);
  const systems = [
    { id: "hvac", name: "HVAC", health: 98, status: "Excelent", icon: Wind, color: "emerald" },
    { id: "elec", name: "Sistem Electric", health: 94, status: "Optim", icon: Zap, color: "emerald" },
    { id: "plumb", name: "Instalații Sanitare", health: 62, status: "Atenție", icon: Droplet, color: "red" },
    { id: "struct", name: "Structură", health: 90, status: "Excelent", icon: Layers, color: "emerald" },
  ];

  return (
    <section id="twin" className="py-32 px-6 relative">
      <div className="absolute inset-0 dotted-bg opacity-20" />
      <div className="max-w-7xl mx-auto relative">
        <SectionTag num="06" label="Digital Twin · Element diferențiator" />
        <h2 className="font-serif text-5xl md:text-7xl tracking-tight mb-6 max-w-4xl" data-testid="twin-title">
          Casa ta, în <span className="italic">3D real-time</span>.
        </h2>
        <p className="text-lg text-stone-400 max-w-2xl mb-16">
          LiDAR + termografie + senzori IoT. Fiecare echipament mapat, fiecare intervenție documentată, fiecare anomalie detectată automat.
        </p>

        <div className="grid lg:grid-cols-[1.3fr_1fr] gap-8">
          {/* 3D Building Visualization */}
          <div className="glass-strong rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10" />
            <div className="relative">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <div className="text-xs text-stone-400 uppercase tracking-wider mb-1">Previzualizare Live</div>
                  <h3 className="font-serif text-2xl">Vila Horizon · TW-09 Alpha</h3>
                </div>
                <div className="inline-flex items-center gap-2 bg-emerald-500/10 px-3 py-1.5 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs text-emerald-400">LIVE 3D</span>
                </div>
              </div>

              {/* Building */}
              <div className="aspect-[4/3] rounded-2xl bg-gradient-to-br from-slate-900 via-cyan-950 to-slate-900 border border-white/10 relative overflow-hidden flex items-center justify-center">
                <svg viewBox="0 0 400 300" className="w-full h-full p-8">
                  {/* Building outline */}
                  <g fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1">
                    <path d="M80 250 L80 100 L200 50 L320 100 L320 250 Z" />
                    <path d="M80 100 L200 150 L320 100" />
                    <path d="M200 50 L200 150 L200 250" />
                  </g>
                  {/* Floors */}
                  {[140, 180, 220].map((y, i) => (
                    <line key={i} x1="80" y1={y} x2="320" y2={y} stroke="rgba(255,255,255,0.1)" strokeDasharray="2 4" />
                  ))}
                  {/* System dots */}
                  {systems.map((s, i) => {
                    const positions = [[140, 130], [260, 170], [140, 210], [260, 230]];
                    return (
                      <g key={s.id} onMouseEnter={() => setHovered(s.id)} onMouseLeave={() => setHovered(null)} style={{ cursor: "pointer" }}>
                        <circle 
                          cx={positions[i][0]} 
                          cy={positions[i][1]} 
                          r={hovered === s.id ? "12" : "6"} 
                          fill={s.color === "red" ? "#f87171" : "#d4ff3a"} 
                          className="transition-all"
                        />
                        <circle 
                          cx={positions[i][0]} 
                          cy={positions[i][1]} 
                          r="14" 
                          fill={s.color === "red" ? "#f87171" : "#d4ff3a"} 
                          opacity="0.2"
                        >
                          <animate attributeName="r" values="14;22;14" dur="2s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.2;0;0.2" dur="2s" repeatCount="indefinite" />
                        </circle>
                      </g>
                    );
                  })}
                </svg>
                <div className="absolute bottom-4 left-4 right-4 flex gap-3 text-xs">
                  <div className="bg-black/40 backdrop-blur px-3 py-2 rounded-lg">
                    <div className="text-stone-400 text-[10px]">Temp</div>
                    <div className="text-white">22.4°C</div>
                  </div>
                  <div className="bg-black/40 backdrop-blur px-3 py-2 rounded-lg">
                    <div className="text-stone-400 text-[10px]">Umiditate</div>
                    <div className="text-white">48%</div>
                  </div>
                  <div className="bg-black/40 backdrop-blur px-3 py-2 rounded-lg">
                    <div className="text-stone-400 text-[10px]">Senzori</div>
                    <div className="text-emerald-400">98.2%</div>
                  </div>
                </div>
              </div>

              {/* Health score */}
              <div className="mt-6 flex items-center gap-6">
                <div>
                  <div className="text-xs text-stone-400 uppercase tracking-wider mb-1">Scor Sănătate</div>
                  <div className="font-serif text-5xl">94<span className="text-2xl text-stone-500">/100</span></div>
                </div>
                <div className="flex-1">
                  <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                    <motion.div initial={{ width: 0 }} whileInView={{ width: "94%" }} transition={{ duration: 1.5, ease: "easeOut" }} className="h-full bg-gradient-to-r from-[#d4ff3a] to-emerald-400" />
                  </div>
                  <div className="flex justify-between text-[10px] text-stone-500 mt-2">
                    <span>0</span><span>50</span><span>100</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Systems list */}
          <div className="space-y-3">
            {systems.map((s, i) => (
              <motion.div
                key={s.id}
                onMouseEnter={() => setHovered(s.id)}
                onMouseLeave={() => setHovered(null)}
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className={`glass rounded-2xl p-5 cursor-pointer transition-all ${hovered === s.id ? "bg-white/[0.08] border-[#d4ff3a]/30" : ""}`}
                data-testid={`twin-system-${s.id}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-${s.color}-500/15 border border-${s.color}-500/30`}>
                    <s.icon className={`w-5 h-5 text-${s.color}-400`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{s.name}</div>
                    <div className={`text-xs text-${s.color}-400 mt-0.5`}>{s.status}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-serif text-2xl">{s.health}</div>
                    <div className="text-[10px] text-stone-500">/100</div>
                  </div>
                </div>
              </motion.div>
            ))}
            <div className="glass-strong rounded-2xl p-5 mt-6 border-[#d4ff3a]/30">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-[#d4ff3a]" />
                <div className="text-xs text-[#d4ff3a] uppercase tracking-wider">AI Insight</div>
              </div>
              <p className="text-sm text-stone-300">Sistemul hidraulic necesită inspecție în max 7 zile. Recomandare: Instalator verificat în zonă.</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ============= ADMIN TRUST =============
const AdminTrust = () => {
  const items = [
    { icon: FileCheck, t: "Verificare specialiști", d: "Asigurări, certificări, documente legale — totul scanat și validat manual." },
    { icon: Gavel, t: "Mediere dispute", d: "Sistem de arbitraj imparțial. Refund, release sau request more info." },
    { icon: Award, t: "Quality control", d: "Audit lunar al lucrărilor, validare 3D model, rating real timp." },
    { icon: Shield, t: "Audit certificat extern", d: "Standard de audit verificat extern pentru fiecare proprietate premium." },
  ];

  return (
    <section className="py-32 px-6 relative">
      <div className="max-w-7xl mx-auto">
        <SectionTag num="07" label="Administrare & Încredere" />
        <div className="grid lg:grid-cols-2 gap-16 mb-16">
          <h2 className="font-serif text-5xl md:text-7xl tracking-tight" data-testid="admin-title">
            Trust este <span className="italic">infrastructură</span>.
          </h2>
          <p className="text-lg text-stone-400 lg:pt-8 max-w-md">
            Fiecare specialist verificat. Fiecare dispută rezolvată. Fiecare lucrare validată. PropAdmin este layer-ul invizibil care face platforma de încredere.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-12">
          {items.map((it, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="glass p-8 rounded-3xl flex gap-5"
              data-testid={`admin-item-${i}`}
            >
              <div className="w-12 h-12 rounded-2xl bg-[#d4ff3a]/10 border border-[#d4ff3a]/20 flex items-center justify-center shrink-0">
                <it.icon className="w-5 h-5 text-[#d4ff3a]" />
              </div>
              <div>
                <h3 className="font-serif text-2xl mb-2">{it.t}</h3>
                <p className="text-sm text-stone-400 leading-relaxed">{it.d}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Admin dashboard preview */}
        <div className="glass-strong rounded-3xl p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="text-xs text-stone-400 uppercase tracking-wider mb-1">PropAdmin · Control Center</div>
              <h3 className="font-serif text-2xl">Metrici Live</h3>
            </div>
            <div className="text-xs text-stone-400">real-time · last 24h</div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { v: "24", l: "Total cereri", c: "+12%" },
              { v: "08", l: "În așteptare", c: "PRIORITATE", warn: true },
              { v: "05", l: "Documente incomplete", c: "Acțiune necesară", err: true },
              { v: "11", l: "Verificați azi", c: "✓", ok: true },
            ].map((s, i) => (
              <div key={i} className="bg-white/[0.03] rounded-2xl p-5">
                <div className="font-serif text-4xl mb-1">{s.v}</div>
                <div className="text-xs text-stone-400 mb-2">{s.l}</div>
                <div className={`text-[10px] uppercase tracking-wider ${s.warn ? "text-amber-400" : s.err ? "text-red-400" : s.ok ? "text-emerald-400" : "text-stone-500"}`}>{s.c}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ============= BUSINESS MODEL =============
const BusinessModel = () => {
  const { showSection } = useI18n();
  return (
    <BusinessModelInner showUnitEconomics={showSection("landing_show_unit_economics", false)} />
  );
};

const BusinessModelInner = ({ showUnitEconomics }) => {
  const streams = [
    { icon: Coins, name: "Lead Fees", desc: "Specialiști plătesc 40-50 RON per lead acceptat.", n: "01" },
    { icon: TrendingUp, name: "Service Commissions", desc: "3% comision pe fiecare tranzacție escrow.", n: "02" },
    { icon: Sparkles, name: "Activare Wallet", desc: "750€ licență pe viață pentru utilizatorii premium.", n: "03" },
    { icon: Activity, name: "Abonament (în pregătire)", desc: "59€/lună pentru planuri complete de mentenanță.", n: "04" },
  ];

  return (
    <section id="business" className="py-32 px-6 relative">
      <div className="max-w-7xl mx-auto">
        <SectionTag num="08" label="Model de business" />
        <h2 className="font-serif text-5xl md:text-7xl tracking-tight mb-6 max-w-4xl" data-testid="business-title">
          Patru fluxuri de <span className="italic">venit</span>.
        </h2>
        <p className="text-lg text-stone-400 max-w-2xl mb-16">
          Marketplace economics + SaaS recurring + Premium licensing. Un model diversificat, scalabil, cu margini sănătoase.
        </p>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
          {streams.map((s, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-strong rounded-3xl p-8 group hover:bg-white/[0.06] transition-colors"
              data-testid={`stream-${i}`}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center">
                  <s.icon className="w-5 h-5 text-[#d4ff3a]" />
                </div>
                <span className="font-mono text-xs text-stone-500">{s.n}</span>
              </div>
              <h3 className="font-serif text-2xl mb-2">{s.name}</h3>
              <p className="text-sm text-stone-400 leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Projection */}
        {showUnitEconomics && (
          <div className="mt-16 glass-strong rounded-3xl p-10">
            <h3 className="font-serif text-3xl mb-8">Indicatori economici</h3>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { l: "ARPU lunar (proprietar premium)", v: "~64€" },
                { l: "Take-rate marketplace", v: "8-12%" },
                { l: "LTV / CAC (target)", v: "4.2x" },
              ].map((s, i) => (
                <div key={i} className="border-l-2 border-[#d4ff3a]/30 pl-6">
                  <div className="text-xs uppercase tracking-wider text-stone-400 mb-2">{s.l}</div>
                  <div className="font-serif text-4xl">{s.v}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};

// ============= VALUE PROPOSITION =============
const ValueProp = () => {
  const actors = [
    {
      role: "Client",
      icon: Home,
      color: "lime",
      benefits: [
        { t: "Transparență totală", d: "Vezi exact ce se întâmplă în casa ta — costuri, intervenții, istoric." },
        { t: "Control absolut", d: "Decizi când, cum, cu cine. Plăți securizate, recenzii reale." },
        { t: "Valoare crescută", d: "Casă digitalizată = casă mai valoroasă pe piață cu 8-15%." },
      ]
    },
    {
      role: "Specialist",
      icon: Wrench,
      color: "amber",
      benefits: [
        { t: "Lead-uri calificate", d: "Clienți cu intent real, briefing detaliat, budget definit." },
        { t: "Workflow structurat", d: "Plata garantată prin escrow. Fără negocieri, fără risc." },
        { t: "Sistem de reputație", d: "Rating real, badge VERIFIED, acces la elite network." },
      ]
    },
    {
      role: "Platformă",
      icon: Cpu,
      color: "cyan",
      benefits: [
        { t: "Ecosistem scalabil", d: "Network effects: mai mulți clienți → mai mulți specialiști." },
        { t: "Venituri recurente", d: "Abonamente + comisioane + licențe premium." },
        { t: "Avantaj de date", d: "Cel mai mare dataset de mentenanță rezidențială din regiune." },
      ]
    },
  ];

  return (
    <section className="py-32 px-6 relative">
      <div className="max-w-7xl mx-auto">
        <SectionTag num="09" label="Propunere de valoare" />
        <h2 className="font-serif text-5xl md:text-7xl tracking-tight mb-6 max-w-4xl" data-testid="value-title">
          Toată lumea <span className="italic">câștigă</span>.
        </h2>
        <p className="text-lg text-stone-400 max-w-2xl mb-16">
          Marketplace-urile reale funcționează când toți cei trei actori — client, furnizor, platformă — au incentive aliniate.
        </p>

        <div className="grid md:grid-cols-3 gap-4">
          {actors.map((a, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-strong rounded-3xl p-8"
              data-testid={`value-actor-${i}`}
            >
              <div className="flex items-center gap-3 mb-8 pb-6 border-b border-white/5">
                <div className={`w-12 h-12 rounded-2xl bg-${a.color}-500/15 border border-${a.color}-500/30 flex items-center justify-center`}>
                  <a.icon className={`w-5 h-5 text-${a.color}-400`} />
                </div>
                <h3 className="font-serif text-2xl">{a.role}</h3>
              </div>
              <div className="space-y-6">
                {a.benefits.map((b, j) => (
                  <div key={j}>
                    <div className="flex items-start gap-2 mb-1">
                      <CheckCircle2 className={`w-4 h-4 text-${a.color}-400 mt-0.5 shrink-0`} />
                      <div className="font-medium">{b.t}</div>
                    </div>
                    <p className="text-sm text-stone-400 leading-relaxed pl-6">{b.d}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============= GOLDEN PATH =============
const GoldenPath = () => {
  const path = [
    { i: Users, t: "Cont", c: "Andrei creează cont" },
    { i: AlertTriangle, t: "Solicitare", c: "Alertă: scurgere baie" },
    { i: Wrench, t: "Specialist", c: "Match cu Mihai 4.9★" },
    { i: Camera, t: "Lucrare", c: "Lucrare 1h 45min" },
    { i: Lock, t: "Plată", c: "Escrow 450 RON" },
    { i: FileCheck, t: "Istoric", c: "Actualizare jurnal digital" },
    { i: TrendingUp, t: "Twin actualizat", c: "+5% sănătate" },
  ];

  return (
    <section className="py-32 px-6 relative">
      <div className="absolute inset-0 dotted-bg opacity-30" />
      <div className="max-w-7xl mx-auto relative">
        <SectionTag num="10" label="Drumul ideal" />
        <h2 className="font-serif text-5xl md:text-7xl tracking-tight mb-6 max-w-4xl" data-testid="golden-title">
          De la <span className="italic">click</span> la <span className="italic">finalizare</span>.
        </h2>
        <p className="text-lg text-stone-400 max-w-2xl mb-16">
          Un singur flux. Șapte pași. Sub 24 de ore de la problemă la rezolvare documentată.
        </p>

        <div className="relative">
          {/* Connecting line */}
          <div className="absolute top-10 left-0 right-0 h-px hidden lg:block divider-line" />
          
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
            {path.map((p, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="relative text-center"
                data-testid={`golden-${i}`}
              >
                <div className="relative w-20 h-20 mx-auto mb-4">
                  <div className="absolute inset-0 rounded-full bg-[#d4ff3a]/20 blur-xl" />
                  <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#d4ff3a] to-[#a8e028] flex items-center justify-center">
                    <p.i className="w-7 h-7 text-black" strokeWidth={2} />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-black border-2 border-[#d4ff3a] flex items-center justify-center text-[10px] font-mono">
                    {i + 1}
                  </div>
                </div>
                <div className="font-serif text-xl mb-1">{p.t}</div>
                <div className="text-xs text-stone-400">{p.c}</div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Time savings */}
        <div className="mt-20 grid md:grid-cols-3 gap-4">
          {[
            { v: "23h", l: "Average resolution time", before: "Înainte: 7-14 zile" },
            { v: "100%", l: "Documented interventions", before: "Înainte: 0%" },
            { v: "+15%", l: "Creștere valoare proprietate", before: "După 12 luni utilizare" },
          ].map((s, i) => (
            <div key={i} className="glass-strong rounded-3xl p-8">
              <div className="font-serif text-6xl mb-2 text-[#d4ff3a]">{s.v}</div>
              <div className="text-sm font-medium mb-2">{s.l}</div>
              <div className="text-xs text-stone-500">{s.before}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ============= CTA + FOOTER =============
const CTA = () => {
  const { t } = useI18n();
  const { variant: ctaVariant, trackClick: trackCtaClick } = useABTest("cta_btn1");
  const ctaBtn1Text = t(`cta.btn1.variant_${ctaVariant}`) || t("cta.btn1");
  return (
  <section id="cta" className="py-32 px-6 relative">
    <div className="max-w-7xl mx-auto">
      <div className="relative glass-strong rounded-[3rem] p-12 md:p-20 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-[#d4ff3a] blur-[120px] opacity-20" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-emerald-500 blur-[120px] opacity-10" />
        
        <div className="relative max-w-3xl">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full mb-8">
            <div className="w-2 h-2 rounded-full bg-[#d4ff3a] pulse-dot" />
            <span className="text-xs tracking-wide text-stone-300">{t("cta.badge")}</span>
          </div>
          <h2 className="font-serif text-5xl md:text-7xl tracking-tight mb-6" data-testid="cta-title">
            {t("cta.title1")} <span className="italic">{t("cta.title2")}</span>
          </h2>
          <p className="text-lg text-stone-400 mb-10 max-w-xl">
            {t("cta.intro")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4">
            <Link to="/register" onClick={trackCtaClick} className="btn-accent px-8 py-4 rounded-full font-medium inline-flex items-center gap-2 group" data-testid="cta-primary" data-ab-variant={ctaVariant}>
              {ctaBtn1Text}
              <ArrowUpRight className="w-4 h-4 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </Link>
            <Link to="/login" className="glass px-8 py-4 rounded-full font-medium inline-flex items-center gap-2 hover:bg-white/10 transition-colors" data-testid="cta-secondary">
              {t("cta.btn2")}
            </Link>
          </div>
          <div className="text-xs text-stone-500 mt-6">{t("cta.footer")}</div>
        </div>
      </div>
    </div>
  </section>
  );
};

const Footer = () => (
  <footer className="border-t border-white/5 py-12 px-6">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between gap-6">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#d4ff3a] to-[#a8e028] flex items-center justify-center">
          <Building2 className="w-3.5 h-3.5 text-black" strokeWidth={2.5} />
        </div>
        <span className="font-serif text-lg">PropManage</span>
        <span className="text-xs text-stone-500 ml-2">© 2026 · Property Operating System</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-stone-500">
        <Link to="/terms" className="hover:text-white transition-colors" data-testid="footer-terms">Termeni</Link>
        <Link to="/privacy" className="hover:text-white transition-colors" data-testid="footer-privacy">Confidențialitate</Link>
        <Link to="/status" className="hover:text-white transition-colors inline-flex items-center gap-1" data-testid="footer-status">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Status
        </Link>
        <GDPRAuditBadge variant="footer" />
        <a href="mailto:admin@propmanage.io" className="hover:text-white transition-colors">Contact</a>
      </div>
    </div>
  </footer>
);

// ============= PROMO BANNER (CMS-driven) =============
const PromoBanner = () => {
  const { t } = useI18n();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem("pm_promo_dismissed") === "1");
  const text = t("landing.promo_banner");
  if (dismissed || !text || text === "landing.promo_banner") return null;
  const close = () => { sessionStorage.setItem("pm_promo_dismissed", "1"); setDismissed(true); };
  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-[#d4ff3a] via-[#a8e028] to-[#d4ff3a] text-black text-center text-xs sm:text-sm font-medium py-2 px-12 flex items-center justify-center gap-2" data-testid="promo-banner">
      <Sparkles className="w-3.5 h-3.5" />
      <span className="truncate max-w-[80vw]">{text}</span>
      <button onClick={close} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-black/10 rounded-full" data-testid="promo-banner-close" aria-label="Închide">
        <Minus className="w-3.5 h-3.5 rotate-45" />
      </button>
    </div>
  );
};

// ============= LANDING PAGE =============
const LandingPage = () => {
  const { t, showSection, isPreview } = useI18n();
  const promoText = t("landing.promo_banner");
  const hasPromo = !!promoText && promoText !== "landing.promo_banner" && sessionStorage.getItem("pm_promo_dismissed") !== "1";
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoModeDismissed, setDemoModeDismissed] = useState(() => sessionStorage.getItem("pm_demo_mode_dismissed") === "1");

  React.useEffect(() => {
    const handler = () => setDemoOpen(true);
    window.addEventListener("propmanage:book-demo", handler);
    return () => window.removeEventListener("propmanage:book-demo", handler);
  }, []);

  return (
    <div className={`grain min-h-screen bg-[#0a0a0b] text-stone-100 ${(hasPromo || isPreview || !demoModeDismissed) ? "pt-9 sm:pt-10" : ""}`}>
      {isPreview && <PreviewBanner />}
      {!isPreview && !demoModeDismissed && (
        <div className="fixed top-0 left-0 right-0 z-[58] bg-stone-900/95 backdrop-blur border-b border-amber-500/30 text-amber-200" data-testid="demo-mode-banner">
          <div className="flex items-center gap-2 px-3 sm:px-10 py-1.5 text-[11px] sm:text-xs">
            <span className="opacity-80 truncate flex-1 sm:flex-none sm:text-center">
              <span className="hidden sm:inline">🧪 Demo Mode · Plățile Stripe sunt în mod test, fără bani reali</span>
              <span className="sm:hidden">🧪 Demo · Stripe test mode</span>
            </span>
            <button onClick={() => setDemoOpen(true)} className="underline hover:no-underline font-medium text-[#d4ff3a] shrink-0" data-testid="demo-mode-cta">
              <span className="hidden sm:inline">Programează demo</span>
              <span className="sm:hidden">Demo</span>
            </button>
            <button onClick={() => { sessionStorage.setItem("pm_demo_mode_dismissed", "1"); setDemoModeDismissed(true); }} className="shrink-0 w-7 h-7 -mr-1 flex items-center justify-center hover:bg-white/10 active:bg-white/15 rounded-full text-stone-300" aria-label="Închide banner demo" data-testid="demo-mode-dismiss">
              <Minus className="w-4 h-4 rotate-45" />
            </button>
          </div>
        </div>
      )}
      {!isPreview && demoModeDismissed && <PromoBanner />}
      <Nav />
      <Hero />
      <Problem />
      <Solution />
      <UserJourney />
      <SpecialistJourney />
      <WalletEcosystem />
      <DigitalTwin />
      {showSection("landing_show_admin_trust", false) && <AdminTrust />}
      {showSection("landing_show_business_model", false) && <BusinessModel />}
      {showSection("landing_show_value_proposition", true) && <ValueProp />}
      {showSection("landing_show_golden_path", true) && <GoldenPath />}
      <CTA />
      <Footer />
      {/* Sticky "Book a Demo" floating CTA (bottom-left, doesn't fight Emergent badge) */}
      <button
        onClick={() => setDemoOpen(true)}
        className="fixed bottom-6 left-6 z-[55] inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-[#d4ff3a] text-black font-semibold text-sm shadow-2xl shadow-lime-500/30 hover:scale-105 transition-transform"
        data-testid="floating-book-demo"
      >
        <Sparkles className="w-4 h-4" />
        Programează o demonstrație
      </button>
      <BookDemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
    </div>
  );
};

// ============= PREVIEW MODE BANNER =============
const PreviewBanner = () => (
  <div className="fixed top-0 left-0 right-0 z-[60] bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-black text-center text-xs sm:text-sm font-semibold py-2 px-12 flex items-center justify-center gap-2" data-testid="preview-banner">
    <span>👁 PREVIEW MODE — Modificările tale nesalvate sunt aplicate doar pentru tine</span>
    <a href="/" className="ml-3 underline hover:no-underline text-[11px] opacity-80 hover:opacity-100">Ieși din preview →</a>
  </div>
);

// ============= MAIN APP =============
function App() {
  return (
    <div className="App">
      <I18nProvider>
        <AuthProvider>
          <BrowserRouter>
            <ImpersonationBanner />
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/privacy/notices" element={<PrivacyNoticesPage />} />
              <Route path="/digital-twin" element={<DigitalTwinPage />} />
              <Route path="/report-respond/:token" element={<ReportApprovalPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/status" element={<StatusPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/marketplace" element={<PublicMarketplace />} />
              <Route path="/specialists/:id" element={<SpecialistProfile />} />
              <Route path="/client" element={<ClientDashboard />} />
              <Route path="/specialist" element={<SpecialistDashboard />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/operator" element={<OperatorDashboard />} />
              <Route path="/projects/:id" element={<ProjectWorkspace />} />
              <Route path="/payment-success" element={<PaymentSuccess />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <TutorialOverlay />
            <AIConciergeBubble />
          </BrowserRouter>
        </AuthProvider>
      </I18nProvider>
    </div>
  );
}

export default App;
