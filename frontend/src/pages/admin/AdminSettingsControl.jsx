import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  Settings, Save, RefreshCcw, AlertCircle, CheckCircle2, Loader2,
  Facebook, Instagram, Youtube, Linkedin, Sparkles, Building2, Mail, Phone, MapPin
} from "lucide-react";

const API = process.env.REACT_APP_BACKEND_URL;

const SectionCard = ({ icon: Icon, title, description, children }) => (
  <div className="bg-[#0e0e10] border border-white/10 rounded-3xl p-6 md:p-8">
    <div className="flex items-start gap-3 mb-6">
      <div className="w-11 h-11 rounded-2xl bg-[#d4ff3a]/10 border border-[#d4ff3a]/30 flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-[#d4ff3a]" />
      </div>
      <div>
        <h2 className="font-serif text-2xl">{title}</h2>
        {description && <p className="text-xs text-stone-400 mt-1">{description}</p>}
      </div>
    </div>
    <div className="space-y-4">{children}</div>
  </div>
);

const TextField = ({ label, value, onChange, placeholder, icon: Icon, type = "text", testid, hint }) => (
  <div>
    <label className="text-xs text-stone-400 uppercase tracking-wider">{label}</label>
    <div className="relative mt-1">
      {Icon && <Icon className="w-4 h-4 text-stone-500 absolute left-3 top-1/2 -translate-y-1/2" />}
      <input
        type={type}
        value={value || ""}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full bg-white/5 border border-white/10 rounded-xl ${Icon ? "pl-10" : "pl-4"} pr-4 py-2.5 text-sm focus:border-[#d4ff3a]/50 focus:outline-none transition-colors`}
        data-testid={testid}
      />
    </div>
    {hint && <p className="text-[11px] text-stone-500 mt-1">{hint}</p>}
  </div>
);

export const AdminSettingsControl = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    axios.get(`${API}/api/admin/app-settings`, { withCredentials: true })
      .then(r => setData(r.data))
      .catch(e => setError(e?.response?.data?.detail || "Eroare la încărcare"))
      .finally(() => setLoading(false));
  }, []);

  const updateField = (section, key, value) => {
    setData(d => ({ ...d, [section]: { ...d[section], [key]: value } }));
    setSaved(false);
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await axios.put(`${API}/api/admin/app-settings`, {
        social: data.social,
        pricing: {
          audit_ron: Number(data.pricing?.audit_ron) || 0,
          twin_ron: Number(data.pricing?.twin_ron) || 0,
          commission_pct: Number(data.pricing?.commission_pct) || 0,
        },
        contact: data.contact,
        company: data.company,
      }, { withCredentials: true });
      setData(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) {
      setError(e?.response?.data?.detail || "Eroare la salvare");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-stone-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> Se încarcă...</div>;
  }

  if (!data) {
    return <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center text-red-400">{error || "Datele nu pot fi încărcate."}</div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white">
      <div className="max-w-4xl mx-auto px-6 pt-28 pb-16">
        {/* Header */}
        <Link to="/admin" className="text-xs text-stone-400 hover:text-white inline-flex items-center gap-1 mb-3">
          ← Înapoi la Admin Dashboard
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <h1 className="font-serif text-4xl md:text-5xl tracking-tight" data-testid="settings-control-title">
              Control <span className="italic gradient-text">Administrare</span>
            </h1>
            <p className="text-sm text-stone-400 mt-2">Editează link-uri sociale, tarife, comisioane și date de contact — fără cod, fără re-deploy.</p>
          </div>
          <button onClick={save} disabled={saving} className="pm-btn pm-btn-primary pm-btn-lg" data-testid="settings-save">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? "Se salvează..." : saved ? "Salvat ✓" : "Salvează modificările"}
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 mb-6 flex items-start gap-3" data-testid="settings-error">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-sm text-red-300">{error}</div>
          </div>
        )}

        <div className="space-y-6">
          {/* Pricing & Commission */}
          <SectionCard icon={Sparkles} title="Prețuri & Comision · Imobile Verificate" description="Afectează direct pagina Sell, calculatorul de comision și paginile publice.">
            <div className="grid md:grid-cols-3 gap-4">
              <TextField label="Audit complet (RON)" value={data.pricing?.audit_ron} onChange={v => updateField("pricing", "audit_ron", v)} type="number" testid="pricing-audit" hint="Tariful pentru auditul tehnic al unui imobil" />
              <TextField label="Digital Twin (RON)" value={data.pricing?.twin_ron} onChange={v => updateField("pricing", "twin_ron", v)} type="number" testid="pricing-twin" hint="Tariful pentru crearea Digital Twin-ului 3D" />
              <TextField label="Comision vânzare (%)" value={data.pricing?.commission_pct} onChange={v => updateField("pricing", "commission_pct", v)} type="number" testid="pricing-commission" hint="Procentul comisionului la finalizarea vânzării" />
            </div>
            <div className="bg-[#d4ff3a]/8 border border-[#d4ff3a]/30 rounded-2xl p-4 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-[#d4ff3a] shrink-0 mt-0.5" />
              <div className="text-xs text-stone-300">
                Costul Digital Twin se scade automat din comisionul de vânzare ca bonus pentru proprietar. Acest mesaj este afișat pe `/imobile-verificate/sell` și în calculatorul din `/de-ce-noi`.
              </div>
            </div>
          </SectionCard>

          {/* Social Media */}
          <SectionCard icon={Building2} title="Rețele Sociale" description="Link-urile apar în footer și pe pagina /de-ce-noi. Lasă gol pentru a ascunde linkul.">
            <TextField label="Facebook · PropManage (principal)" value={data.social?.facebook_main} onChange={v => updateField("social", "facebook_main", v)} icon={Facebook} placeholder="https://www.facebook.com/..." testid="social-facebook-main" />
            <TextField label="Facebook · Imobile Verificate" value={data.social?.facebook_estate} onChange={v => updateField("social", "facebook_estate", v)} icon={Facebook} placeholder="https://www.facebook.com/..." testid="social-facebook-estate" />
            <TextField label="Instagram · PropManage" value={data.social?.instagram_main} onChange={v => updateField("social", "instagram_main", v)} icon={Instagram} placeholder="https://www.instagram.com/..." testid="social-instagram-main" />
            <TextField label="Instagram · Imobile Verificate" value={data.social?.instagram_estate} onChange={v => updateField("social", "instagram_estate", v)} icon={Instagram} placeholder="https://www.instagram.com/..." testid="social-instagram-estate" />
            <TextField label="YouTube" value={data.social?.youtube} onChange={v => updateField("social", "youtube", v)} icon={Youtube} placeholder="https://www.youtube.com/@..." testid="social-youtube" />
            <TextField label="LinkedIn" value={data.social?.linkedin} onChange={v => updateField("social", "linkedin", v)} icon={Linkedin} placeholder="https://www.linkedin.com/company/..." testid="social-linkedin" />
          </SectionCard>

          {/* Contact */}
          <SectionCard icon={Mail} title="Date de Contact" description="Afișate în footer, pagina de contact și folosite pentru notificările admin.">
            <TextField label="Email contact" value={data.contact?.email} onChange={v => updateField("contact", "email", v)} icon={Mail} type="email" placeholder="contact@propmanage.ro" testid="contact-email" />
            <TextField label="Telefon" value={data.contact?.phone} onChange={v => updateField("contact", "phone", v)} icon={Phone} placeholder="+40 XXX XXX XXX" testid="contact-phone" />
            <TextField label="Adresă sediu" value={data.contact?.address} onChange={v => updateField("contact", "address", v)} icon={MapPin} placeholder="Str. Exemplu, Nr. 1, București" testid="contact-address" />
          </SectionCard>

          {/* Company */}
          <SectionCard icon={Settings} title="Identitate Companie" description="Nume + tagline afișate în footer și pagina principală.">
            <TextField label="Nume companie" value={data.company?.name} onChange={v => updateField("company", "name", v)} placeholder="PropManage" testid="company-name" />
            <TextField label="Tagline" value={data.company?.tagline} onChange={v => updateField("company", "tagline", v)} placeholder="Property Operating System" testid="company-tagline" />
          </SectionCard>

          {/* Last Updated */}
          {data.updated_at && (
            <div className="text-center text-xs text-stone-500 pt-4">
              Ultima modificare: {new Date(data.updated_at).toLocaleString("ro-RO")} · de către {data.updated_by || "—"}
            </div>
          )}
        </div>

        {/* Floating save bar (mobile) */}
        <div className="md:hidden fixed bottom-4 left-4 right-4 z-50">
          <button onClick={save} disabled={saving} className="pm-btn pm-btn-primary pm-btn-lg w-full shadow-2xl">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? "Se salvează..." : saved ? "Salvat ✓" : "Salvează modificările"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AdminSettingsControl;
