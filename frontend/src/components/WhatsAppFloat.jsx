import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../auth";

// Buton flotant WhatsApp — config din Admin → Analytics & Growth → Integrări
// (telefon + mesaj editabile fără cod). Ascuns pe /admin și client-junior.
const API = process.env.REACT_APP_BACKEND_URL;

const WaIcon = () => (
  <svg viewBox="0 0 32 32" className="w-7 h-7 fill-white" aria-hidden="true">
    <path d="M16 3C9.4 3 4 8.3 4 14.9c0 2.6.8 5 2.3 7L4.7 27.6a1 1 0 0 0 1.2 1.3l5.9-1.5a12 12 0 0 0 4.2.7c6.6 0 12-5.3 12-11.9S22.6 3 16 3zm0 21.8c-1.4 0-2.7-.3-3.9-.8l-.7-.3-3.5.9.9-3.3-.4-.7a9.7 9.7 0 0 1-1.6-5.7c0-5.4 4.4-9.8 9.9-9.8s9.9 4.4 9.9 9.8-4.4 9.9-9.9 9.9h-.7zm5.4-7.3c-.3-.2-1.8-.9-2-1s-.5-.2-.7.2c-.2.3-.8 1-.9 1.2s-.3.2-.6.1a7.9 7.9 0 0 1-2.3-1.4 8.7 8.7 0 0 1-1.6-2c-.2-.3 0-.5.1-.6l.5-.5c.1-.2.2-.3.3-.5s0-.4 0-.5c-.1-.2-.7-1.7-1-2.3-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.2-.3-.2-.6-.4z" />
  </svg>
);

export const WhatsAppFloat = () => {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const [cfg, setCfg] = useState(null);

  useEffect(() => {
    fetch(`${API}/api/track/config`).then((r) => r.json()).then(setCfg).catch(() => {});
  }, []);

  if (!cfg || cfg.whatsapp_enabled === false || !cfg.whatsapp_phone) return null;
  if (pathname.startsWith("/admin") || pathname.startsWith("/dashboard/client-junior")) return null;

  const phone = cfg.whatsapp_phone.replace(/[^0-9]/g, "");
  const href = `https://wa.me/${phone}?text=${encodeURIComponent(cfg.whatsapp_message || "")}`;
  // utilizator logat (client/specialist/operator) → bula AI + bottom nav ocupă zona de jos:
  // mobil: deasupra AI bubble (care e la bottom-20); desktop: deasupra bulei AI (bottom-6)
  const hasAiBubble = !!user && user !== false && user.role !== "admin";
  const posClass = hasAiBubble ? "bottom-36 right-4 lg:bottom-24 lg:right-6" : "bottom-4 right-4";

  return (
    <a href={href} target="_blank" rel="noreferrer" data-testid="whatsapp-float-btn" aria-label="Scrie-ne pe WhatsApp" title="Scrie-ne pe WhatsApp"
      className={`fixed ${posClass} z-40 w-14 h-14 rounded-full flex items-center justify-center shadow-lg shadow-black/20 hover:scale-110 active:scale-95 transition-transform`}
      style={{ background: "#25D366" }}>
      <WaIcon />
    </a>
  );
};
