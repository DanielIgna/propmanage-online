// PropManage i18n - bilingv RO/EN
import React, { createContext, useContext, useState, useEffect } from "react";

const translations = {
  ro: {
    // Nav
    "nav.problem": "Problemă", "nav.solution": "Soluție", "nav.journey": "Experiență",
    "nav.twin": "Digital Twin", "nav.business": "Business", "nav.demo": "Începe Demo",
    "nav.login": "Conectează-te", "nav.logout": "Deconectare", "nav.dashboard": "Dashboard",
    // Common
    "common.loading": "Se încarcă...", "common.save": "Salvează", "common.cancel": "Anulează",
    "common.confirm": "Confirmă", "common.back": "Înapoi", "common.continue": "Continuă",
    "common.email": "Email", "common.password": "Parolă", "common.name": "Nume",
    // Login
    "login.title": "Bine ai venit", "login.subtitle": "Introdu datele pentru a accesa contul",
    "login.submit": "Conectează-te", "login.noAccount": "Nu ai cont?",
    "login.register": "Creează cont nou", "login.demo": "Conturi Demo",
    // Register
    "register.title": "Creează cont", "register.subtitle": "Începe-ți călătoria digitală",
    "register.role": "Tip cont", "register.client": "Proprietar", "register.specialist": "Specialist",
    "register.submit": "Creează cont", "register.hasAccount": "Ai deja cont?",
    // Dashboard Client
    "client.welcome": "Bună", "client.health": "Scor Sănătate",
    "client.requests": "Solicitările Mele", "client.specialists": "Specialiști",
    "client.newRequest": "Solicitare Nouă", "client.tokens": "Tokeni",
    "client.wallet": "Portofel", "client.properties": "Proprietăți",
    "client.viewTwin": "Vezi Digital Twin",
    // Dashboard Specialist
    "spec.opportunities": "Oportunități Noi", "spec.myJobs": "Lucrările Mele",
    "spec.accept": "Acceptă Lead", "spec.balance": "Sold Lead-uri",
    "spec.rating": "Rating", "spec.reviews": "Recenzii", "spec.start": "Pornește lucrarea",
    "spec.complete": "Marchează completă",
    // Admin
    "admin.title": "Panou de Control", "admin.users": "Utilizatori",
    "admin.activeJobs": "Joburi Active", "admin.pending": "Verificare în așteptare",
    "admin.verify": "Verifică", "admin.disputes": "Dispute",
    // Operator
    "op.title": "Validare Mentenanță", "op.approve": "Validare", "op.reject": "Respinge",
    "op.queue": "Coadă de Așteptare",
    // Request states
    "status.open": "Deschis", "status.assigned": "Asignat", "status.in_progress": "În lucru",
    "status.completed": "Finalizat", "status.confirmed": "Confirmat",
    // Categories
    "cat.electric": "Electric", "cat.plumbing": "Sanitar", "cat.hvac": "HVAC",
    "cat.other": "Altele",
  },
  en: {
    // Nav
    "nav.problem": "Problem", "nav.solution": "Solution", "nav.journey": "Experience",
    "nav.twin": "Digital Twin", "nav.business": "Business", "nav.demo": "Start Demo",
    "nav.login": "Sign In", "nav.logout": "Logout", "nav.dashboard": "Dashboard",
    // Common
    "common.loading": "Loading...", "common.save": "Save", "common.cancel": "Cancel",
    "common.confirm": "Confirm", "common.back": "Back", "common.continue": "Continue",
    "common.email": "Email", "common.password": "Password", "common.name": "Name",
    // Login
    "login.title": "Welcome back", "login.subtitle": "Enter your credentials to access your account",
    "login.submit": "Sign In", "login.noAccount": "No account?",
    "login.register": "Create new account", "login.demo": "Demo Accounts",
    // Register
    "register.title": "Create account", "register.subtitle": "Start your digital journey",
    "register.role": "Account type", "register.client": "Homeowner", "register.specialist": "Specialist",
    "register.submit": "Create account", "register.hasAccount": "Already have an account?",
    // Dashboard Client
    "client.welcome": "Hi", "client.health": "Health Score",
    "client.requests": "My Requests", "client.specialists": "Specialists",
    "client.newRequest": "New Request", "client.tokens": "Tokens",
    "client.wallet": "Wallet", "client.properties": "Properties",
    "client.viewTwin": "View Digital Twin",
    // Specialist
    "spec.opportunities": "New Opportunities", "spec.myJobs": "My Jobs",
    "spec.accept": "Accept Lead", "spec.balance": "Lead Balance",
    "spec.rating": "Rating", "spec.reviews": "Reviews", "spec.start": "Start work",
    "spec.complete": "Mark complete",
    // Admin
    "admin.title": "Control Panel", "admin.users": "Users",
    "admin.activeJobs": "Active Jobs", "admin.pending": "Pending verification",
    "admin.verify": "Verify", "admin.disputes": "Disputes",
    // Operator
    "op.title": "Maintenance Validation", "op.approve": "Approve", "op.reject": "Reject",
    "op.queue": "Queue",
    // Status
    "status.open": "Open", "status.assigned": "Assigned", "status.in_progress": "In Progress",
    "status.completed": "Completed", "status.confirmed": "Confirmed",
    // Categories
    "cat.electric": "Electric", "cat.plumbing": "Plumbing", "cat.hvac": "HVAC",
    "cat.other": "Other",
  }
};

const I18nContext = createContext(null);

export const I18nProvider = ({ children }) => {
  const [lang, setLang] = useState(() => localStorage.getItem("propmanage_lang") || "ro");
  
  useEffect(() => { localStorage.setItem("propmanage_lang", lang); }, [lang]);
  
  const t = (key) => translations[lang][key] || key;
  const toggle = () => setLang(l => l === "ro" ? "en" : "ro");
  
  return (
    <I18nContext.Provider value={{ lang, setLang, toggle, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be inside I18nProvider");
  return ctx;
};
