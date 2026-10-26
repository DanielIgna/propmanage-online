// ServiciiOverview — pagina publică /servicii: listează toate serviciile active
// definite în Admin → Menu Manager (grupul «servicii»). Fiecare card duce la serviciul respectiv.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  ArrowLeft, ArrowRight, Layers, Home, Palette, Box, Users, MessageCircle,
  Building2, Hammer, Trees, Compass,
} from "lucide-react";
import { SiteNav } from "../components/SiteNav";

const API = process.env.REACT_APP_BACKEND_URL;

const ICONS = {
  Home, Palette, Box, Users, MessageCircle, Building2, Hammer, Trees, Compass, Layers,
};

const isInternal = (href) => typeof href === "string" && href.startsWith("/");

export default function ServiciiOverview() {
  const [services, setServices] = useState(undefined); // undefined=loading, []=gol

  useEffect(() => {
    document.title = "Servicii · Ecosistemul PropManage | PropManage";
    axios.get(`${API}/api/public/site-menu`)
      .then((r) => {
        const items = r.data?.items || [];
        const grp = items.find((it) => it.id === "servicii");
        setServices((grp?.children || []).filter((c) => c.href));
      })
      .catch(() => setServices([]));
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white" data-testid="servicii-overview-page">
      <SiteNav />
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-28 pb-20">
        <Link to="/" className="text-stone-500 hover:text-white inline-flex items-center gap-1.5 text-sm mb-8" data-testid="servicii-back-home">
          <ArrowLeft className="w-4 h-4" /> Acasă
        </Link>

        <div className="max-w-2xl mb-12">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider text-[#d4ff3a] mb-4">
            <Layers className="w-3.5 h-3.5" /> Ecosistem
          </div>
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.05] tracking-tight mb-4">
            Toate serviciile, într-un singur loc
          </h1>
          <p className="text-base text-stone-400">
            De la verificarea imobilelor și proiectare, la marketplace-ul de specialiști —
            fiecare serviciu PropManage lucrează pe date reale despre locuința ta.
          </p>
        </div>

        {services === undefined ? (
          <div className="py-24 flex justify-center">
            <div className="w-6 h-6 border-2 border-stone-600 border-t-[#d4ff3a] rounded-full animate-spin" />
          </div>
        ) : services.length === 0 ? (
          <div className="py-16 text-center text-stone-500" data-testid="servicii-empty">
            Serviciile se actualizează. Revino în curând.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="servicii-grid">
            {services.map((s) => {
              const Icon = ICONS[s.icon] || Layers;
              const Card = (
                <div className="group h-full rounded-2xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] hover:border-[#d4ff3a]/40 transition-colors p-6 flex flex-col">
                  <div className="w-11 h-11 rounded-xl bg-[#d4ff3a]/10 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-[#d4ff3a]" />
                  </div>
                  <div className="font-serif text-xl mb-1.5">{s.label}</div>
                  {s.description && <p className="text-sm text-stone-400 flex-1">{s.description}</p>}
                  <div className="mt-4 inline-flex items-center gap-1.5 text-sm text-[#d4ff3a] group-hover:gap-2.5 transition-all">
                    Descoperă <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              );
              return isInternal(s.href) ? (
                <Link key={s.id} to={s.href} data-testid={`servicii-card-${s.id}`}>{Card}</Link>
              ) : (
                <a key={s.id} href={s.href} target="_blank" rel="noopener noreferrer" data-testid={`servicii-card-${s.id}`}>{Card}</a>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
