// PropManage - Settings panel (shown under "Setări" tab for all roles)
// Includes: Profile edit, Change password, Dual-role switcher, Referrals, Support,
// Contact, Data & Privacy (GDPR).
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import {
  User as UserIcon, Settings as SettingsIcon, RefreshCw, Share2, Heart,
  LifeBuoy, MessageCircle, Lock, ChevronRight, X, Mail, Phone, MapPin,
  Download, Trash2, AlertTriangle, CheckCircle2, Shield, BellRing, BellOff,
} from "lucide-react";
import { useAuth, formatApiError } from "../auth";
import { API } from "./DashShared";
import { pushSupported, getPushStatus, subscribeToPush, unsubscribeFromPush, ensureServiceWorker } from "../push";

// ============= MAIN PANEL =============
export const SettingsPanel = () => {
  const { user, refreshUser, logout } = useAuth();
  const [modal, setModal] = useState(null); // "profile" | "password" | "privacy" | "referral" | "support" | "contact"
  const [pushStatus, setPushStatus] = useState("unsupported");

  useEffect(() => {
    if (!pushSupported()) return;
    ensureServiceWorker().then(() => getPushStatus().then(setPushStatus));
  }, []);

  if (!user) return null;

  const initials = (user.name || "U").split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  const switchView = async () => {
    const target = user.active_view === "client" ? "specialist" : "client";
    try {
      await axios.post(`${API}/auth/switch-view`, { view: target });
      await refreshUser();
      // Navigate the user to the corresponding dashboard
      window.location.href = target === "client" ? "/client" : "/specialist";
    } catch (e) {
      alert(formatApiError(e));
    }
  };

  const showDualRole = user.role === "specialist" && user.dual_role_enabled;
  const inClientView = user.active_view === "client";

  const togglePush = async () => {
    try {
      if (pushStatus === "subscribed") {
        const s = await unsubscribeFromPush();
        setPushStatus(s);
        alert("Notificările push au fost dezactivate.");
      } else {
        const s = await subscribeToPush();
        setPushStatus(s);
        alert("Notificările push au fost activate. Vei primi alerte pentru oportunități noi.");
      }
    } catch (e) {
      alert(e.message || formatApiError(e));
    }
  };

  const Row = ({ icon: Icon, title, subtitle, onClick, danger, tid }) => (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 py-4 border-b border-white/5 hover:bg-white/[0.02] transition-colors group ${
        danger ? "text-red-400" : ""
      }`}
      data-testid={tid}
    >
      <Icon className={`w-5 h-5 shrink-0 ${danger ? "text-red-400" : "text-stone-400"}`} />
      <div className="flex-1 text-left">
        <div className="text-sm font-medium">{title}</div>
        {subtitle && <div className="text-xs text-stone-500 mt-0.5">{subtitle}</div>}
      </div>
      <ChevronRight className="w-4 h-4 text-stone-600 group-hover:text-stone-400 transition-colors" />
    </button>
  );

  return (
    <div className="max-w-2xl mx-auto" data-testid="settings-panel">
      {/* Profile header */}
      <div className="flex items-center gap-4 mb-8 pb-6 border-b border-white/5">
        <div className="relative">
          {user.avatar ? (
            <img src={user.avatar} alt={user.name} className="w-20 h-20 rounded-full object-cover" />
          ) : (
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-stone-600 to-stone-800 flex items-center justify-center font-serif text-2xl">
              {initials}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-xs uppercase tracking-wider text-stone-500">Bună!,</div>
          <h2 className="font-serif text-3xl truncate" data-testid="settings-username">{user.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#d4ff3a]/15 text-[#d4ff3a] border border-[#d4ff3a]/30">
              {inClientView ? "Profil Client" : user.role}
            </span>
            {user.verified && (
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                <Shield className="w-2.5 h-2.5" />Verified
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-0">
        <Row
          icon={UserIcon}
          title="Profilul meu"
          subtitle="Editează imaginea de profil, numele, adresa de email, numărul de telefon și locația."
          onClick={() => setModal("profile")}
          tid="row-profile"
        />
        <Row
          icon={SettingsIcon}
          title="Schimbă parola"
          subtitle="Actualizează și gestionează parola ta."
          onClick={() => setModal("password")}
          tid="row-password"
        />
        {showDualRole && (
          <Row
            icon={RefreshCw}
            title={inClientView ? "Treci la profilul de profesionist" : "Treci la profilul de client"}
            subtitle={
              inClientView
                ? "Revino la dashboard-ul tău de specialist pentru a primi lead-uri."
                : "Schimbă pe profilul de client pentru a solicita servicii pentru imobilul tău."
            }
            onClick={switchView}
            tid="row-switch-view"
          />
        )}
        <Row
          icon={Share2}
          title="Recomandă prietenilor tăi"
          subtitle="Trimite invitația și câștigă tokeni + Digital Twin pentru fiecare prieten care finalizează prima cerere."
          onClick={() => setModal("referral")}
          tid="row-referral"
        />
        {pushStatus !== "unsupported" && (
          <Row
            icon={pushStatus === "subscribed" ? BellRing : BellOff}
            title={pushStatus === "subscribed" ? "Notificări push: ACTIVE" : "Activează notificări push"}
            subtitle={
              pushStatus === "denied"
                ? "Browser-ul a blocat permisiunea. Activează manual din setări site."
                : pushStatus === "subscribed"
                ? "Primești alerte pe browser pentru oportunități și actualizări. Apasă pentru a dezactiva."
                : "Primește alerte pe browser/telefon pentru lead-uri noi și notificări importante."
            }
            onClick={pushStatus === "denied" ? () => alert("Permisiunea pentru notificări este blocată. Resetează din browser settings.") : togglePush}
            tid="row-push"
          />
        )}
        <Row
          icon={Heart}
          title="Evaluează aplicația"
          subtitle="Spune-ne ce îți place și ce am putea îmbunătăți."
          onClick={() => setModal("review-app")}
          tid="row-review-app"
        />
        <Row
          icon={LifeBuoy}
          title="Centrul de suport"
          subtitle="Întrebări frecvente, ghiduri și asistență."
          onClick={() => setModal("support")}
          tid="row-support"
        />
        <Row
          icon={MessageCircle}
          title="Contactează-ne"
          subtitle="Trimite-ne un mesaj direct."
          onClick={() => setModal("contact")}
          tid="row-contact"
        />
        <Row
          icon={Lock}
          title="Date și confidențialitate"
          subtitle="Exportă-ți datele sau cere ștergerea contului (GDPR)."
          onClick={() => setModal("privacy")}
          tid="row-privacy"
        />
        <Row
          icon={Trash2}
          title="Deconectare"
          subtitle="Ieși din contul curent."
          onClick={async () => {
            await logout();
            window.location.href = "/login";
          }}
          tid="row-logout"
        />
      </div>

      {modal === "profile" && <ProfileModal onClose={() => setModal(null)} />}
      {modal === "password" && <PasswordModal onClose={() => setModal(null)} />}
      {modal === "privacy" && <PrivacyModal onClose={() => setModal(null)} />}
      {modal === "referral" && <ReferralModal onClose={() => setModal(null)} />}
      {modal === "review-app" && <SimpleInfoModal title="Evaluează PropManage" onClose={() => setModal(null)}>
        <p className="text-sm text-stone-300 leading-relaxed">
          Apreciem feedback-ul tău. Sistemul de evaluare publică va fi disponibil când aplicația este publicată în App Store / Google Play.
        </p>
      </SimpleInfoModal>}
      {modal === "support" && <SimpleInfoModal title="Centrul de suport" onClose={() => setModal(null)}>
        <div className="space-y-3 text-sm">
          <FAQItem q="Cum funcționează escrow-ul?" a="Banii intră într-un cont securizat când plasezi plata. Sunt eliberați specialistului doar după ce confirmi finalizarea lucrării." />
          <FAQItem q="Ce sunt tokenii?" a="Tokenii sunt recompense pe care le câștigi pentru activitate pe platformă (joburi finalizate, recenzii, referrals). 1 token = 1 RON discount pe serviciile premium." />
          <FAQItem q="Ce e Digital Twin?" a="O reprezentare digitală a proprietății tale (camere, instalații, scor de sănătate). Specialiștii o folosesc pentru intervenții mai eficiente." />
          <FAQItem q="Cum deschid o dispută?" a="Pe orice lucrare în curs sau finalizată, apasă butonul 'Deschide dispută'. Un admin va media în maximum 48h." />
        </div>
      </SimpleInfoModal>}
      {modal === "contact" && <ContactModal onClose={() => setModal(null)} />}
    </div>
  );
};

// ============= PROFILE EDIT MODAL =============
const ProfileModal = ({ onClose }) => {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({
    name: user.name || "",
    phone: user.phone || "",
    zone: user.zone || "",
    avatar: user.avatar || "",
  });
  const [loading, setLoading] = useState(false);

  const onAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1.5 * 1024 * 1024) {
      alert("Avatar prea mare (max 1.5MB).");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm({ ...form, avatar: reader.result });
    reader.readAsDataURL(file);
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {};
      ["name", "phone", "zone", "avatar"].forEach((k) => {
        if (form[k] !== (user[k] || "")) payload[k] = form[k];
      });
      if (Object.keys(payload).length === 0) {
        onClose();
        return;
      }
      await axios.patch(`${API}/auth/profile`, payload);
      await refreshUser();
      onClose();
    } catch (err) {
      alert(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Profilul meu" onClose={onClose} tid="profile-modal">
      <form onSubmit={submit} className="space-y-4">
        <div className="flex items-center gap-4">
          {form.avatar ? (
            <img src={form.avatar} alt="" className="w-16 h-16 rounded-full object-cover" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-stone-600 to-stone-800" />
          )}
          <label className="px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-full text-xs cursor-pointer" data-testid="upload-avatar-btn">
            Schimbă poza
            <input type="file" accept="image/*" onChange={onAvatar} className="hidden" />
          </label>
        </div>

        <Field label="Nume" icon={UserIcon}>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#d4ff3a]/50"
            data-testid="profile-name-input"
          />
        </Field>

        <Field label="Email" icon={Mail}>
          <input
            value={user.email}
            disabled
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-stone-500 cursor-not-allowed"
          />
        </Field>

        <Field label="Telefon" icon={Phone}>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="+40 700 000 000"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#d4ff3a]/50"
            data-testid="profile-phone-input"
          />
        </Field>

        <Field label="Locație / Zonă" icon={MapPin}>
          <input
            value={form.zone}
            onChange={(e) => setForm({ ...form, zone: e.target.value })}
            placeholder="București - Sector 3"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#d4ff3a]/50"
            data-testid="profile-zone-input"
          />
        </Field>

        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 py-3 bg-white/5 rounded-xl text-sm">Anulează</button>
          <button type="submit" disabled={loading} className="flex-1 btn-accent py-3 rounded-xl text-sm font-medium" data-testid="profile-save-btn">
            {loading ? "..." : "Salvează"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
};

// ============= PASSWORD CHANGE MODAL =============
const PasswordModal = ({ onClose }) => {
  const [form, setForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (form.new_password.length < 6) {
      alert("Parola nouă trebuie să aibă cel puțin 6 caractere.");
      return;
    }
    if (form.new_password !== form.confirm) {
      alert("Parolele nu coincid.");
      return;
    }
    setLoading(true);
    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: form.current_password,
        new_password: form.new_password,
      });
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      alert(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Schimbă parola" onClose={onClose} tid="password-modal">
      {success ? (
        <div className="text-center py-8" data-testid="password-success">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <div className="font-serif text-xl">Parolă actualizată</div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Parola curentă">
            <input
              type="password"
              required
              value={form.current_password}
              onChange={(e) => setForm({ ...form, current_password: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm"
              data-testid="pwd-current"
            />
          </Field>
          <Field label="Parola nouă (min 6 caractere)">
            <input
              type="password"
              required
              minLength={6}
              value={form.new_password}
              onChange={(e) => setForm({ ...form, new_password: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm"
              data-testid="pwd-new"
            />
          </Field>
          <Field label="Confirmă parola nouă">
            <input
              type="password"
              required
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm"
              data-testid="pwd-confirm"
            />
          </Field>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-3 bg-white/5 rounded-xl text-sm">Anulează</button>
            <button type="submit" disabled={loading} className="flex-1 btn-accent py-3 rounded-xl text-sm font-medium" data-testid="pwd-save">
              {loading ? "..." : "Salvează"}
            </button>
          </div>
        </form>
      )}
    </ModalShell>
  );
};

// ============= GDPR PRIVACY MODAL =============
const PrivacyModal = ({ onClose }) => {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [delForm, setDelForm] = useState({ password: "", confirmation: "" });
  const [showDelete, setShowDelete] = useState(false);

  const exportData = async () => {
    setExporting(true);
    try {
      const { data } = await axios.post(`${API}/auth/account-export`);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `propmanage-export-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(formatApiError(err));
    } finally {
      setExporting(false);
    }
  };

  const deleteAccount = async (e) => {
    e.preventDefault();
    if (!window.confirm("Confirmi ștergerea definitivă a contului? Această acțiune nu poate fi anulată.")) return;
    setDeleting(true);
    try {
      await axios.post(`${API}/auth/account-delete`, delForm);
      alert("Cont șters. Vei fi deconectat.");
      window.location.href = "/login";
    } catch (err) {
      alert(formatApiError(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <ModalShell title="Date și confidențialitate" onClose={onClose} tid="privacy-modal">
      <div className="space-y-4 text-sm">
        <div className="bg-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Download className="w-4 h-4 text-[#d4ff3a]" />
            <div className="font-medium">Exportă datele tale</div>
          </div>
          <p className="text-xs text-stone-400 mb-3 leading-relaxed">
            Conform GDPR (Art. 20 — portabilitatea datelor), poți descărca toate datele tale: profil, proprietăți, cereri, notificări, tranzacții.
          </p>
          <button onClick={exportData} disabled={exporting} className="btn-accent px-4 py-2 rounded-full text-xs font-medium" data-testid="export-data-btn">
            {exporting ? "Se generează..." : "Descarcă JSON"}
          </button>
        </div>

        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <div className="font-medium text-red-400">Șterge contul</div>
          </div>
          <p className="text-xs text-stone-400 mb-3 leading-relaxed">
            Conform GDPR (Art. 17 — dreptul de a fi uitat). Datele tale personale vor fi anonimizate ireversibil. Istoricul tranzacțiilor și disputele se păstrează pentru conformitate fiscală.
          </p>
          {!showDelete ? (
            <button onClick={() => setShowDelete(true)} className="px-4 py-2 bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 rounded-full text-xs font-medium" data-testid="show-delete-btn">
              Vreau să șterg contul
            </button>
          ) : (
            <form onSubmit={deleteAccount} className="space-y-2">
              <input
                type="password"
                placeholder="Parola curentă"
                required
                value={delForm.password}
                onChange={(e) => setDelForm({ ...delForm, password: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm"
                data-testid="del-password"
              />
              <input
                placeholder="Tastează STERGE pentru confirmare"
                required
                value={delForm.confirmation}
                onChange={(e) => setDelForm({ ...delForm, confirmation: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm"
                data-testid="del-confirmation"
              />
              <button type="submit" disabled={deleting} className="w-full bg-red-500 hover:bg-red-600 text-white py-2.5 rounded-xl text-sm font-medium" data-testid="del-submit-btn">
                {deleting ? "Se șterge..." : "Confirmă ștergerea"}
              </button>
            </form>
          )}
        </div>
      </div>
    </ModalShell>
  );
};

// ============= REFERRAL MODAL (real stats + copy link) =============
const ReferralModal = ({ onClose }) => {
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    axios.get(`${API}/auth/referral`).then(r => setStats(r.data)).catch(() => setStats({ referred_total: 0, converted_total: 0 }));
  }, []);

  const link = stats ? `${window.location.origin}${stats.referral_url}` : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (_e) { /* clipboard may be blocked */ }
  };

  return (
    <ModalShell title="Recomandă PropManage" onClose={onClose} tid="referral-modal">
      <p className="text-sm text-stone-300 leading-relaxed mb-4">
        Pentru fiecare prieten invitat care își <span className="text-[#d4ff3a] font-medium">finalizează prima cerere</span>,
        primești <span className="text-[#d4ff3a] font-medium">+500 tokeni</span> și
        Digital Twin <span className="text-[#d4ff3a] font-medium">activat gratuit</span> pe prima ta proprietate.
      </p>

      {stats && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-white/5 rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-stone-500">Invitați</div>
            <div className="font-serif text-3xl mt-1" data-testid="ref-stat-referred">{stats.referred_total}</div>
          </div>
          <div className="bg-[#d4ff3a]/5 border border-[#d4ff3a]/20 rounded-2xl p-4">
            <div className="text-[10px] uppercase tracking-wider text-[#d4ff3a]">Convertiți</div>
            <div className="font-serif text-3xl mt-1 text-[#d4ff3a]" data-testid="ref-stat-converted">{stats.converted_total}</div>
          </div>
        </div>
      )}

      <div className="bg-white/5 rounded-xl p-3 text-xs text-stone-300 break-all border border-white/10" data-testid="referral-link">
        {link || "—"}
      </div>
      <button
        onClick={copy}
        className="mt-3 w-full btn-accent py-2.5 rounded-xl text-sm font-medium"
        data-testid="copy-referral-btn"
      >
        {copied ? "✓ Copiat" : "Copiază linkul"}
      </button>
    </ModalShell>
  );
};

// ============= CONTACT MODAL =============
const ContactModal = ({ onClose }) => {
  const [form, setForm] = useState({ subject: "", message: "" });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post(`${API}/support/contact`, form);
      setSent(true);
      setTimeout(onClose, 1800);
    } catch (err) {
      alert(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Contactează-ne" onClose={onClose} tid="contact-modal">
      {sent ? (
        <div className="text-center py-8" data-testid="contact-sent">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
          <div className="font-serif text-xl">Mesaj trimis</div>
          <p className="text-sm text-stone-400 mt-2">Vei primi un răspuns în maxim 24h pe email-ul tău.</p>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Subiect">
            <input
              required
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm"
              data-testid="contact-subject"
            />
          </Field>
          <Field label="Mesaj">
            <textarea
              required
              rows={5}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm resize-none"
              data-testid="contact-message"
            />
          </Field>
          <button type="submit" disabled={loading} className="w-full btn-accent py-3 rounded-xl text-sm font-medium" data-testid="contact-send">{loading ? "Se trimite..." : "Trimite mesaj"}</button>
        </form>
      )}
    </ModalShell>
  );
};

// ============= HELPERS =============
const ModalShell = ({ title, onClose, children, tid }) => (
  <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      onClick={(e) => e.stopPropagation()}
      className="glass-strong rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-auto no-scrollbar"
      data-testid={tid}
    >
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-serif text-2xl">{title}</h2>
        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg" data-testid={`${tid}-close`}>
          <X className="w-4 h-4 text-stone-400" />
        </button>
      </div>
      {children}
    </motion.div>
  </div>
);

const Field = ({ label, icon: Icon, children }) => (
  <div>
    <label className="text-[10px] uppercase tracking-wider text-stone-500 flex items-center gap-1.5 mb-1.5">
      {Icon && <Icon className="w-3 h-3" />}
      {label}
    </label>
    {children}
  </div>
);

const SimpleInfoModal = ({ title, onClose, children }) => (
  <ModalShell title={title} onClose={onClose} tid={`info-${title.replace(/\s+/g, "-").toLowerCase()}`}>
    {children}
  </ModalShell>
);

const FAQItem = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white/5 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full px-4 py-3 text-left flex items-center justify-between">
        <span className="text-sm font-medium">{q}</span>
        <ChevronRight className={`w-4 h-4 text-stone-400 transition-transform ${open ? "rotate-90" : ""}`} />
      </button>
      {open && <div className="px-4 pb-3 text-xs text-stone-400 leading-relaxed">{a}</div>}
    </div>
  );
};
