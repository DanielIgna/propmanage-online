import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, ShieldCheck, Box, Sparkles, ArrowRight, CheckCircle2, Calendar, FileText } from "lucide-react";

export const SellMyProperty = () => {
  const steps = [
    { icon: FileText, t: "Briefing imobil", d: "Completezi un formular simplu cu datele de bază (5 min)." },
    { icon: Calendar, t: "Programare audit", d: "Specialiștii noștri auditează imobilul și instalațiile." },
    { icon: Sparkles, t: "Raport + Recomandări", d: "Primești raport complet cu recomandări personalizate." },
    { icon: CheckCircle2, t: "Acceptă recomandările", d: "Min. 90% recomandări acceptate pentru listare." },
    { icon: Box, t: "Digital Twin", d: "Creăm modelul 3D al imobilului pentru cumpărători." },
    { icon: Building2, t: "LIVE pe platformă", d: "Imobilul devine vizibil cumpărătorilor verificați." },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        <div className="absolute inset-0 dotted-bg opacity-30" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full bg-[#d4ff3a] blur-[150px] opacity-10" />
        <div className="max-w-5xl mx-auto relative">
          <Link to="/imobile-verificate" className="text-xs text-stone-400 hover:text-white inline-flex items-center gap-1 mb-6">
            ← Înapoi la Imobile Verificate
          </Link>
          <div className="inline-flex items-center gap-2 px-4 py-2 glass rounded-full mb-6">
            <ShieldCheck className="w-3.5 h-3.5 text-[#d4ff3a]" />
            <span className="text-xs tracking-wide text-stone-300">Pentru proprietari</span>
          </div>
          <h1 className="font-serif text-5xl md:text-7xl tracking-tight leading-[0.95] mb-6" data-testid="sell-hero-title">
            Vinde-ți imobilul <span className="italic gradient-text">cu credibilitate</span>.
          </h1>
          <p className="text-lg text-stone-400 max-w-2xl mb-10">
            Te ajutăm să vinzi mai rapid și la un preț corect. Auditul tehnic + Digital Twin cresc încrederea cumpărătorilor și valoarea percepută a imobilului.
          </p>
          <div className="bg-[#0e0e10] border border-white/10 rounded-3xl p-8 mb-12">
            <h3 className="font-serif text-2xl mb-2">Comision avantajos · 2.5%</h3>
            <p className="text-sm text-stone-400 mb-4">Standard în piață: 5–6%. Tu plătești <strong className="text-white">2.5%</strong> și, la finalizarea vânzării, costul Digital Twin-ului se <strong className="text-[#d4ff3a]">scade ca bonus</strong> din comision.</p>
            <button disabled className="opacity-60 cursor-not-allowed btn-accent px-6 py-3 rounded-full font-medium inline-flex items-center gap-2 text-sm" data-testid="sell-start-cta">
              Începe procesul · În curând <ArrowRight className="w-4 h-4" />
            </button>
            <p className="text-xs text-stone-500 mt-3">📅 Funcționalitate disponibilă în ETAPA 2 — momentan ne poți contacta direct.</p>
          </div>
        </div>
      </section>

      <section className="px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <h2 className="font-serif text-4xl md:text-5xl mb-12">Procesul în <span className="italic gradient-text">6 pași</span></h2>
          <div className="grid md:grid-cols-2 gap-4">
            {steps.map((s, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="bg-[#0e0e10] border border-white/10 rounded-2xl p-6 flex gap-4"
                data-testid={`sell-step-${i}`}
              >
                <div className="w-12 h-12 shrink-0 rounded-xl bg-[#d4ff3a]/10 border border-[#d4ff3a]/30 flex items-center justify-center">
                  <s.icon className="w-5 h-5 text-[#d4ff3a]" />
                </div>
                <div>
                  <div className="text-[10px] text-stone-500 uppercase tracking-wider mb-1">Pas {i + 1}</div>
                  <h3 className="font-serif text-xl mb-1">{s.t}</h3>
                  <p className="text-sm text-stone-400 leading-relaxed">{s.d}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default SellMyProperty;
