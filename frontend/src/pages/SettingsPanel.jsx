// PropManage - Settings panel (shown under "Setări" tab for all roles)
// Includes: Profile edit, Change password, Dual-role switcher, Referrals, Support,
// Contact, Data & Privacy (GDPR).
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import axios from "axios";
import {
  User as UserIcon, Settings as SettingsIcon, RefreshCw, Share2, Heart,
  LifeBuoy, MessageCircle, Lock, ChevronRight, X, Mail, Phone, MapPin as MapPinIcon,
  Download, Trash2, AlertTriangle, CheckCircle2, Shield, BellRing, BellOff,
  Sun, Eye, Globe, Clock,
} from "lucide-react";
import { useAuth, formatApiError } from "../auth";
import { API } from "./DashShared";
import { pushSupported, getPushStatus, subscribeToPush, unsubscribeFromPush, ensureServiceWorker } from "../push";

// ============= MAIN PANEL =============
export const SettingsPanel = () => {
  const { user, refreshUser, logout } = useAuth();
  const [modal, setModal] = useState(null);
  const [pushStatus, setPushStatus] = useState("unsupported");
  const [digestEnabled, setDigestEnabled] = useState(true);

  useEffect(() => {
    if (!pushSupported()) return;
    ensureServiceWorker().then(() => getPushStatus().then(setPushStatus));
  }, []);

  useEffect(() => {
    if (user) setDigestEnabled(!user.digest_disabled);
  }, [user]);

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

  const toggleDigest = async () => {
    const next = !digestEnabled;
    try {
      await axios.post(`${API}/auth/digest-preference`, { enabled: next });
      setDigestEnabled(next);
      await refreshUser();
    } catch (e) {
      alert(formatApiError(e));
    }
  };

  const previewDigest = async () => {
    try {
      const { data } = await axios.post(`${API}/auth/digest/preview`);
      setModal({ kind: "digest-preview", data });
    } catch (e) {
      alert(formatApiError(e));
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
        {user.role === "specialist" && (
          <Row
            icon={MapPinIcon}
            title="Aria de acoperire"
            subtitle={`Scope: ${user.coverage_scope || "local"} · ${(user.coverage_zones || []).length} zone · răspuns ≤ ${user.response_time_minutes || 60} min`}
            onClick={() => setModal("coverage")}
            tid="row-coverage"
          />
        )}
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
          icon={Sun}
          title={digestEnabled ? "Rezumat zilnic: ACTIV (19:00)" : "Activează rezumat zilnic"}
          subtitle={
            digestEnabled
              ? "Primești zilnic la 19:00 (ora României) un email cu activitatea relevantă pentru tine. Apasă pentru a dezactiva."
              : "Email zilnic la 19:00 cu activitatea importantă: lucrări, lead-uri, dispute. Te ține la curent fără să intri pe app."
          }
          onClick={toggleDigest}
          tid="row-digest"
        />
        {digestEnabled && (
          <Row
            icon={Eye}
            title="Previzualizează rezumatul de azi"
            subtitle="Vezi cum arată email-ul care va fi trimis astăzi, fără a-l trimite."
            onClick={previewDigest}
            tid="row-digest-preview"
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
      {modal === "coverage" && <CoverageModal user={user} refreshUser={refreshUser} onClose={() => setModal(null)} />}
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
      {modal && typeof modal === "object" && modal.kind === "digest-preview" && (
        <DigestPreviewModal data={modal.data} onClose={() => setModal(null)} />
      )}
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
  // Phase 49 Part C — formal DSAR via DPO queue + granular consents
  const [erasureReason, setErasureReason] = useState("");
  const [erasureLoading, setErasureLoading] = useState(false);
  const [erasureOk, setErasureOk] = useState(null);
  const [consents, setConsents] = useState({});
  const [consentsLoaded, setConsentsLoaded] = useState(false);

  useEffect(() => {
    axios.get(`${API}/gdpr/me/consents`)
      .then(r => setConsents(r.data.consents || {}))
      .catch(() => {})
      .finally(() => setConsentsLoaded(true));
  }, []);

  const toggleConsent = async (key, current) => {
    const nextVal = !current;
    setConsents(c => ({ ...c, [key]: { value: nextVal, updated_at: new Date().toISOString() } }));
    try {
      await axios.post(`${API}/gdpr/me/consents`, { key, value: nextVal });
    } catch (err) {
      // revert
      setConsents(c => ({ ...c, [key]: { value: current, updated_at: new Date().toISOString() } }));
      alert(formatApiError(err));
    }
  };

  const exportData = async () => {
    setExporting(true);
    try {
      // Use new GDPR-aligned export (Art. 15) — adds rights summary and comprehensive scope
      const { data } = await axios.get(`${API}/gdpr/me/export`);
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

  const submitErasureRequest = async () => {
    if (!window.confirm("Trimiți o cerere oficială de ștergere către DPO. Vei primi răspuns în maxim 30 zile. Continuăm?")) return;
    setErasureLoading(true);
    try {
      const { data } = await axios.post(`${API}/gdpr/me/erasure-request`, {
        reason: erasureReason,
        confirm: true,
      });
      setErasureOk(data);
    } catch (err) {
      alert(formatApiError(err));
    } finally {
      setErasureLoading(false);
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
        {/* Art. 15 — Export */}
        <div className="bg-white/5 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Download className="w-4 h-4 text-[#d4ff3a]" />
            <div className="font-medium">Exportă datele tale (Art. 15 + Art. 20)</div>
          </div>
          <p className="text-xs text-stone-400 mb-3 leading-relaxed">
            Descarcă toate datele tale într-un format JSON structurat: profil, cereri, proiecte, plăți, notificări, contoare AI Concierge. Include și un rezumat al drepturilor tale GDPR.
          </p>
          <button onClick={exportData} disabled={exporting} className="btn-accent px-4 py-2 rounded-full text-xs font-medium" data-testid="export-data-btn">
            {exporting ? "Se generează..." : "Descarcă JSON"}
          </button>
        </div>

        {/* Granular consents */}
        <div className="bg-white/5 rounded-xl p-4" data-testid="consents-section">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-[#d4ff3a]" />
            <div className="font-medium">Consimțăminte granulare</div>
          </div>
          <p className="text-xs text-stone-400 mb-3 leading-relaxed">
            Controlează ce comunicări non-tranzacționale ne dai voie să-ți trimitem.
          </p>
          {!consentsLoaded ? (
            <div className="text-xs text-stone-500">Se încarcă...</div>
          ) : (
            <div className="space-y-2">
              {[
                { key: "marketing_email", label: "Marketing prin email (newsletter, oferte)" },
                { key: "product_updates", label: "Update-uri de produs (feature noi, schimbări)" },
                { key: "research_participation", label: "Cercetare UX (sondaje opționale)" },
              ].map(c => {
                const cur = !!consents[c.key]?.value;
                return (
                  <label key={c.key} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/[0.03] cursor-pointer" data-testid={`consent-${c.key}`}>
                    <span className="text-xs text-stone-300">{c.label}</span>
                    <input
                      type="checkbox"
                      checked={cur}
                      onChange={() => toggleConsent(c.key, cur)}
                      className="w-4 h-4 accent-[#d4ff3a]"
                    />
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Art. 17 formal erasure via DPO queue */}
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4" data-testid="dsar-erasure-section">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-4 h-4 text-amber-400" />
            <div className="font-medium text-amber-300">Cerere oficială ștergere via DPO (Art. 17)</div>
          </div>
          <p className="text-xs text-stone-400 mb-3 leading-relaxed">
            Pentru o cerere formală cu audit trail. Răspuns garantat în 30 zile prin DPO. Recomandat dacă ai întrebări complexe sau cont B2B.
          </p>
          {erasureOk ? (
            <div className="text-xs text-emerald-300 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3" data-testid="erasure-ok">
              ✅ Cerere {erasureOk.deduped ? "deja existentă" : "înregistrată"} (ID: {erasureOk.id?.slice(-8)}). SLA: {new Date(erasureOk.sla_due_at).toLocaleDateString("ro-RO")}.
            </div>
          ) : (
            <>
              <textarea
                rows={2}
                value={erasureReason}
                onChange={(e) => setErasureReason(e.target.value)}
                placeholder="Motiv (opțional, max 500 caractere)"
                maxLength={500}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs mb-2"
                data-testid="erasure-reason"
              />
              <button
                onClick={submitErasureRequest}
                disabled={erasureLoading}
                className="px-4 py-2 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-full text-xs font-medium"
                data-testid="erasure-submit-btn"
              >
                {erasureLoading ? "Se trimite..." : "Trimite cerere către DPO"}
              </button>
            </>
          )}
        </div>

        {/* Direct delete (fast path) */}
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <div className="font-medium text-red-400">Șterge contul imediat</div>
          </div>
          <p className="text-xs text-stone-400 mb-3 leading-relaxed">
            Pentru clienții individuali care vor o ștergere rapidă. Datele personale sunt anonimizate ireversibil. Istoricul tranzacțiilor și disputele rămân pentru conformitate fiscală (10 ani).
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

const DigestPreviewModal = ({ data, onClose }) => {
  if (!data) return null;
  return (
    <ModalShell title="Rezumatul tău de astăzi" onClose={onClose} tid="digest-preview-modal">
      {data.empty ? (
        <div className="text-center py-8">
          <Sun className="w-10 h-10 text-stone-700 mx-auto mb-2" />
          <p className="text-sm text-stone-400">{data.summary}</p>
          <p className="text-xs text-stone-600 mt-2">Email-ul nu va fi trimis dacă nu există activitate relevantă.</p>
        </div>
      ) : (
        <>
          <div className="text-xs text-[#d4ff3a] mb-3">{data.summary}</div>
          <div dangerouslySetInnerHTML={{ __html: data.cards }} className="text-stone-300 text-sm" />
          <p className="text-[10px] text-stone-600 mt-4 text-center">
            Acesta este conținutul email-ului trimis astăzi la 19:00.
          </p>
        </>
      )}
    </ModalShell>
  );
};

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



// ============= COVERAGE MODAL (specialist's work scope + zones + response time) =============
const CoverageModal = ({ user, refreshUser, onClose }) => {
  const isDesigner = (user.service_categories || []).includes("interior_design");
  const [scope, setScope] = useState(user.coverage_scope || "local");
  const [zones, setZones] = useState(user.coverage_zones || []);
  const [responseTime, setResponseTime] = useState(user.response_time_minutes || 60);
  const [grouped, setGrouped] = useState([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [expandedCity, setExpandedCity] = useState(null);

  useEffect(() => {
    axios.get(`${API}/regions/grouped`).then(r => setGrouped(r.data || [])).catch(() => setGrouped([]));
  }, []);

  const toggleZone = (z) => {
    setZones(prev => prev.includes(z) ? prev.filter(x => x !== z) : [...prev, z]);
  };

  const submit = async () => {
    if (scope !== "national" && zones.length === 0) {
      alert("Pentru scope local/regional, alege cel puțin o zonă.");
      return;
    }
    setBusy(true);
    try {
      await axios.post(`${API}/specialists/coverage-scope`, {
        scope, zones, response_time_minutes: parseInt(responseTime),
      });
      await refreshUser();
      onClose();
    } catch (e) { alert(e?.response?.data?.detail || "Eroare"); }
    finally { setBusy(false); }
  };

  const filteredGrouped = search
    ? grouped.map(g => ({ ...g, zones: g.zones.filter(z => z.zone.toLowerCase().includes(search.toLowerCase()) || g.city.toLowerCase().includes(search.toLowerCase())) })).filter(g => g.zones.length > 0)
    : grouped;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-3" onClick={onClose}>
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={e => e.stopPropagation()}
        className="bg-stone-950 border border-white/10 rounded-3xl p-5 w-full max-w-lg max-h-[90vh] overflow-y-auto" data-testid="coverage-modal">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-xl">Aria de acoperire</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center" data-testid="coverage-close"><X className="w-4 h-4" /></button>
        </div>
        <p className="text-xs text-stone-400 mb-4">
          Definește unde lucrezi și în cât timp ajungi la client. Pentru intervenții rapide, alege zone apropiate.
        </p>

        {/* Scope chooser */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {[
            { id: "local", label: "Local", desc: "Cartiere apropiate" },
            { id: "regional", label: "Regional", desc: "Multi-oraș" },
            { id: "national", label: "Național", desc: "Doar designer", locked: !isDesigner },
          ].map(s => (
            <button key={s.id}
              disabled={s.locked}
              onClick={() => setScope(s.id)}
              className={`text-left rounded-xl p-3 border transition ${
                scope === s.id ? "bg-[#d4ff3a]/10 border-[#d4ff3a]/40" : "bg-white/5 border-white/10 hover:bg-white/10"
              } ${s.locked ? "opacity-40 cursor-not-allowed" : ""}`}
              data-testid={`scope-${s.id}`}>
              <div className="flex items-center gap-1.5 mb-1">
                <Globe className="w-3 h-3" />
                <span className="text-xs font-medium">{s.label}</span>
                {s.locked && <Lock className="w-2.5 h-2.5" />}
              </div>
              <div className="text-[10px] text-stone-400 leading-tight">{s.desc}</div>
            </button>
          ))}
        </div>

        {/* Response time slider */}
        <div className="bg-white/5 rounded-xl p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5 text-xs text-stone-300">
              <Clock className="w-3.5 h-3.5" />Timp maxim de răspuns
            </div>
            <span className="font-medium text-sm text-[#d4ff3a]" data-testid="response-time-value">{responseTime} min</span>
          </div>
          <input type="range" min="15" max="240" step="15" value={responseTime} onChange={e => setResponseTime(e.target.value)}
            className="w-full accent-[#d4ff3a]" data-testid="response-time-slider" />
          <div className="flex justify-between text-[10px] text-stone-500 mt-1">
            <span>15 min (urgent)</span>
            <span>1h</span>
            <span>4h</span>
          </div>
        </div>

        {/* Zones picker (hidden if national) */}
        {scope !== "national" && (
          <>
            <div className="text-[10px] uppercase tracking-wider text-stone-400 mb-2 flex justify-between items-center">
              <span>Zone acoperite ({zones.length} selectate)</span>
              {zones.length > 0 && <button onClick={() => setZones([])} className="text-stone-500 hover:text-stone-300 normal-case">Resetează</button>}
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Caută cartier sau oraș..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm mb-3" data-testid="zone-search" />
            <div className="space-y-1 mb-3 max-h-64 overflow-y-auto">
              {filteredGrouped.map(g => (
                <div key={g.city} className="bg-white/[0.03] rounded-xl">
                  <button onClick={() => setExpandedCity(expandedCity === g.city ? null : g.city)}
                    className="w-full px-3 py-2 flex items-center justify-between text-left text-xs">
                    <span className="font-medium">{g.city}</span>
                    <span className="text-stone-500">{g.zones.filter(z => zones.includes(z.zone)).length} / {g.zones.length}</span>
                  </button>
                  {(expandedCity === g.city || search) && (
                    <div className="px-3 pb-2 flex flex-wrap gap-1">
                      {g.zones.map(z => (
                        <button key={z.zone} onClick={() => toggleZone(z.zone)}
                          className={`text-[10px] px-2 py-1 rounded-full border transition ${zones.includes(z.zone) ? "bg-[#d4ff3a]/20 text-[#d4ff3a] border-[#d4ff3a]/40" : "bg-white/5 text-stone-400 border-white/10 hover:bg-white/10"}`}
                          data-testid={`zone-chip-${z.zone}`}>
                          {z.zone}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {scope === "national" && (
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-3 mb-3 text-xs text-purple-200">
            ✨ Cu scope-ul național, primești proiecte din toată România. Recomandat doar pentru designeri care coordonează la distanță.
          </div>
        )}

        <button onClick={submit} disabled={busy}
          className="w-full py-2.5 btn-accent rounded-full text-sm font-medium disabled:opacity-50" data-testid="coverage-save">
          {busy ? "..." : "Salvează aria"}
        </button>
      </motion.div>
    </div>
  );
};
