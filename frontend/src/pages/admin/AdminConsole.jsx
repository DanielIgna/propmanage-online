// Main Admin Console — Metronic-style entry point. Replaces old AdminDashboard.
import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../auth";
import { AdminLayoutMetronic } from "./AdminLayoutMetronic";
import { AdminOverview } from "./AdminOverview";
import { AdminUsers } from "./AdminUsers";
import { AdminVerification, AdminDisputes } from "./AdminVerificationDisputes";
import { AdminCMS, AdminEmailTemplates, AdminZones } from "./AdminContentTools";
import {
  AdminTrustWeights, AdminPlatformSettings, AdminFinance, AdminProjects, AdminActivityFull
} from "./AdminPlatformTools";
import { AdminABTests } from "./AdminABTests";

const TITLES = {
  overview: { title: "Dashboard", subtitle: "Privire de ansamblu asupra platformei" },
  activity: { title: "Activitate Live", subtitle: "Toate evenimentele din sistem (refresh la 10s)" },
  users: { title: "Toți userii", subtitle: "Caută, filtrează, editează, banează" },
  verification: { title: "Verificare specialiști", subtitle: "Coadă de aprobare cu documente" },
  projects: { title: "Proiecte", subtitle: "Workspace-uri de design și mentenanță" },
  disputes: { title: "Dispute & Sesizări", subtitle: "Mediere și rezolvare cazuri" },
  finance: { title: "Finanțe & Escrow", subtitle: "Wallets, tranzacții, payouts" },
  cms: { title: "Texte (CMS)", subtitle: "Editează landing page, etichete UI, categorii" },
  emails: { title: "Template-uri Email", subtitle: "Modifică subiectul și HTML-ul emailurilor automate" },
  zones: { title: "Zone Acoperire", subtitle: "Adaugă orașe / cartiere sau dezactivează cele existente" },
  abtests: { title: "Experimente A/B", subtitle: "Testează variante și măsoară CTR în timp real" },
  trust: { title: "Trust Score Weights", subtitle: "Ajustează ponderea fiecărui factor (suma = 100%)" },
  settings: { title: "Setări Platformă", subtitle: "Feature flags, comisioane, branding" },
};

export const AdminDashboard = () => {
  const { user } = useAuth();
  const [active, setActive] = useState("overview");

  if (!user) return <div className="min-h-screen flex items-center justify-center text-slate-500">Se încarcă...</div>;
  if (user === false) return <Navigate to="/login" replace />;
  const effectiveRole = user.active_view || user.role;
  if (effectiveRole !== "admin") return <Navigate to={`/${effectiveRole}`} replace />;

  const meta = TITLES[active] || TITLES.overview;
  return (
    <AdminLayoutMetronic active={active} onChange={setActive} title={meta.title} subtitle={meta.subtitle}>
      {active === "overview" && <AdminOverview />}
      {active === "activity" && <AdminActivityFull />}
      {active === "users" && <AdminUsers />}
      {active === "verification" && <AdminVerification />}
      {active === "projects" && <AdminProjects />}
      {active === "disputes" && <AdminDisputes />}
      {active === "finance" && <AdminFinance />}
      {active === "cms" && <AdminCMS />}
      {active === "emails" && <AdminEmailTemplates />}
      {active === "zones" && <AdminZones />}
      {active === "trust" && <AdminTrustWeights />}
      {active === "abtests" && <AdminABTests />}
      {active === "settings" && <AdminPlatformSettings />}
    </AdminLayoutMetronic>
  );
};

export default AdminDashboard;
