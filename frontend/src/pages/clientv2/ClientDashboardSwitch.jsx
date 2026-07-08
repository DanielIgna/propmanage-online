import React from "react";
import { Sparkles } from "lucide-react";
import { ClientDashboard } from "../ClientDashboard";
import ClientDashboardV2 from "./ClientDashboardV2";

// Feature flag migrare controlată: implicit V2 (nou); „legacy" = dashboardul clasic
export default function ClientDashboardSwitch() {
  const mode = localStorage.getItem("pm_client_ui") || "v2";
  if (mode === "legacy") {
    return (
      <>
        <ClientDashboard />
        <button
          onClick={() => { localStorage.setItem("pm_client_ui", "v2"); window.location.reload(); }}
          data-testid="switch-to-v2-btn"
          className="fixed top-3 right-3 z-[70] flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-bold text-white shadow-lg shadow-emerald-900/30"
          style={{ background: "#34C759" }}>
          <Sparkles className="w-3.5 h-3.5" /> Noul dashboard
        </button>
      </>
    );
  }
  return <ClientDashboardV2 />;
}
