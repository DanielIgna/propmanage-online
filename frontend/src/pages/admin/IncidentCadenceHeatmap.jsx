// GitHub-style activity heatmap for incident-response cadence.
// Renders the last 91 days as a 7×13 grid (weekdays × weeks).
// Click on a day → navigate to Audit Log filtered by date_from/date_to.
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Flame } from "lucide-react";
import { AdminCard } from "./AdminLayoutMetronic";
import { API } from "../DashShared";

const WEEKDAY_LABELS_RO = ["L", "Ma", "Mi", "J", "V", "S", "D"]; // Mon..Sun
const MONTH_LABELS_RO = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Noi", "Dec"];

const intensityClass = (count, max) => {
  if (!count) return "bg-slate-100 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/40";
  if (max <= 1) return "bg-emerald-300 dark:bg-emerald-500/60";
  const ratio = count / max;
  if (ratio <= 0.25) return "bg-emerald-200 dark:bg-emerald-500/30";
  if (ratio <= 0.5) return "bg-emerald-400 dark:bg-emerald-500/55";
  if (ratio <= 0.75) return "bg-emerald-500 dark:bg-emerald-500/75";
  return "bg-emerald-600 dark:bg-emerald-400";
};

const fmtDateRo = (iso) => {
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return iso; }
};

export const IncidentCadenceHeatmap = () => {
  const [data, setData] = useState(null);
  const [weekCompare, setWeekCompare] = useState(null);
  const [hovered, setHovered] = useState(null);

  useEffect(() => {
    axios.get(`${API}/admin/incident-cadence-heatmap?days=91`).then(r => setData(r.data)).catch(() => {});
    axios.get(`${API}/admin/incident-cadence-weekly-compare`).then(r => setWeekCompare(r.data)).catch(() => {});
  }, []);

  if (!data) {
    return (
      <AdminCard title="Incident Response Cadence" testid="cadence-heatmap-loading">
        <div className="text-center py-8 text-slate-400 text-sm italic">Se încarcă heatmap-ul...</div>
      </AdminCard>
    );
  }

  // Organize cells into columns by ISO week (Mon-start)
  // Each column has 7 rows (Mon..Sun). Pad leading days of first week with null.
  const cells = data.cells;
  const maxCount = cells.reduce((m, c) => Math.max(m, c.count), 0);
  // Pad cells so the first column starts on Monday
  const firstWd = cells[0]?.weekday ?? 0;
  const padded = Array(firstWd).fill(null).concat(cells);
  const cols = [];
  for (let i = 0; i < padded.length; i += 7) {
    cols.push(padded.slice(i, i + 7));
  }

  // Detect month boundary positions for axis labels
  const monthLabels = cols.map((col, idx) => {
    const firstReal = col.find(c => c);
    if (!firstReal) return null;
    const d = new Date(firstReal.date + "T00:00:00");
    const day = d.getDate();
    if (idx === 0 || day <= 7) return MONTH_LABELS_RO[d.getMonth()];
    return null;
  });

  const goToDate = (iso) => {
    // Update URL with date params + tell AdminConsole to switch tab
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("audit_date", iso);
      window.history.replaceState({}, "", url.toString());
    } catch { /* ignore */ }
    window.dispatchEvent(new CustomEvent("propmanage:nav-admin", { detail: { tab: "audit", date: iso } }));
  };

  return (
    <AdminCard
      title={
        <div className="flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" />
          <span>Incident Response Cadence</span>
        </div>
      }
      testid="cadence-heatmap-card"
    >
      <div className="flex items-center justify-between mb-3 text-xs text-slate-500">
        <span>Activitate de incident response · ultimele {data.days} zile</span>
        <div className="flex items-center gap-3">
          <span><b className="text-slate-700 dark:text-slate-300">{data.total_sends}</b> trimiteri</span>
          <span>·</span>
          <span><b className="text-slate-700 dark:text-slate-300">{data.active_days}</b> zile active</span>
          {data.peak && (
            <>
              <span>·</span>
              <span>Vârf: <b className="text-orange-600 dark:text-orange-400">{data.peak.count}</b> pe {fmtDateRo(data.peak.date)}</span>
            </>
          )}
        </div>
      </div>

      {weekCompare && <WeeklyCompare wc={weekCompare} onCellClick={goToDate} />}

      <div className="overflow-x-auto">
        <div className="inline-block min-w-full">
          {/* Month labels above */}
          <div className="flex gap-[3px] mb-1 ml-7">
            {monthLabels.map((label, idx) => (
              <div key={idx} className="w-[14px] text-[10px] text-slate-500 text-center">
                {label || ""}
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            {/* Weekday labels (Mon..Sun) — show only Mo/We/Fr to save space */}
            <div className="flex flex-col gap-[3px] text-[10px] text-slate-500 pr-1 justify-around">
              {WEEKDAY_LABELS_RO.map((wd, idx) => (
                <div key={wd} className="h-[14px] w-4 leading-none">
                  {[0, 2, 4].includes(idx) ? wd : ""}
                </div>
              ))}
            </div>
            {/* Grid */}
            <div className="flex gap-[3px]" data-testid="cadence-grid">
              {cols.map((col, ci) => (
                <div key={ci} className="flex flex-col gap-[3px]">
                  {Array.from({ length: 7 }).map((_, ri) => {
                    const cell = col[ri];
                    if (!cell) return <div key={ri} className="w-[14px] h-[14px]" />;
                    const cls = intensityClass(cell.count, maxCount);
                    const isHovered = hovered?.date === cell.date;
                    return (
                      <button
                        key={ri}
                        onClick={() => goToDate(cell.date)}
                        onMouseEnter={() => setHovered(cell)}
                        onMouseLeave={() => setHovered(null)}
                        className={`w-[14px] h-[14px] rounded-[3px] ${cls} transition-all hover:ring-2 hover:ring-orange-400 hover:ring-offset-1 dark:hover:ring-offset-slate-900 ${isHovered ? "scale-125" : ""}`}
                        title={`${fmtDateRo(cell.date)} · ${cell.count} trimitere(i)${cell.count ? ` · ${cell.recipients} destinatari` : ""}`}
                        data-testid={`cadence-cell-${cell.date}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Hover details + legend */}
          <div className="flex items-center justify-between mt-3 text-[11px] text-slate-500">
            <div data-testid="cadence-hover-detail">
              {hovered ? (
                <span>
                  <b className="text-slate-700 dark:text-slate-300">{fmtDateRo(hovered.date)}</b>
                  {hovered.count > 0 ? (
                    <> · <b className="text-orange-600 dark:text-orange-400">{hovered.count}</b> trimitere(i) către <b>{hovered.recipients}</b> destinatari </>
                  ) : (
                    <> · fără activitate </>
                  )}
                  <span className="text-slate-400">· click pt audit log</span>
                </span>
              ) : (
                <span className="italic text-slate-400">Hover pe o zi pentru detalii · click → audit log filtrat</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span>Mai puțin</span>
              <div className="w-[14px] h-[14px] rounded-[3px] bg-slate-100 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/40" />
              <div className="w-[14px] h-[14px] rounded-[3px] bg-emerald-200 dark:bg-emerald-500/30" />
              <div className="w-[14px] h-[14px] rounded-[3px] bg-emerald-400 dark:bg-emerald-500/55" />
              <div className="w-[14px] h-[14px] rounded-[3px] bg-emerald-500 dark:bg-emerald-500/75" />
              <div className="w-[14px] h-[14px] rounded-[3px] bg-emerald-600 dark:bg-emerald-400" />
              <span>Mai mult</span>
            </div>
          </div>
        </div>
      </div>
    </AdminCard>
  );
};


// ============= WEEKLY COMPARE SUB-COMPONENT =============
const WeeklyCompare = ({ wc, onCellClick }) => {
  const { current, previous, delta_pct: deltaPct, alert, alert_threshold_pct: threshold } = wc;
  const maxCount = Math.max(
    ...current.cells.map(c => c.count),
    ...previous.cells.map(c => c.count),
    1,
  );

  // Format delta label
  let deltaLabel, deltaTone, deltaArrow;
  if (deltaPct === null) {
    if (current.total_sends > 0) {
      deltaLabel = "—"; deltaTone = "red"; deltaArrow = "↑";
    } else {
      deltaLabel = "0%"; deltaTone = "slate"; deltaArrow = "→";
    }
  } else if (deltaPct > 0) {
    deltaLabel = `+${deltaPct}%`; deltaTone = deltaPct >= threshold ? "red" : "amber"; deltaArrow = "↑";
  } else if (deltaPct < 0) {
    deltaLabel = `${deltaPct}%`; deltaTone = "emerald"; deltaArrow = "↓";
  } else {
    deltaLabel = "0%"; deltaTone = "slate"; deltaArrow = "→";
  }

  const toneCls = {
    red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40",
    amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/40",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/40",
    slate: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  };

  return (
    <div className="mb-5 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50/50 to-white dark:from-slate-800/30 dark:to-slate-900" data-testid="weekly-compare">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">⚖️ Comparare săptămâni</span>
          {alert && (
            <span className="relative inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full bg-red-500 text-white" data-testid="weekly-compare-alert">
              <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-50"></span>
              <span className="relative">⚠️ Alertă</span>
            </span>
          )}
        </div>
        <div className={`text-xs px-3 py-1 rounded-full border font-semibold ${toneCls[deltaTone]}`} data-testid="weekly-compare-delta">
          {deltaArrow} {deltaLabel} <span className="opacity-60 font-normal">vs săpt. trecută</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <WeekMini week={previous} maxCount={maxCount} onCellClick={onCellClick} accentTone="slate" />
        <WeekMini week={current} maxCount={maxCount} onCellClick={onCellClick} accentTone={alert ? "red" : "emerald"} />
      </div>

      {alert && (
        <div className="mt-3 text-[11px] text-red-700 dark:text-red-300 italic">
          ⚠️ Activitatea săptămânii curente depășește pragul de <b>+{threshold}%</b> față de săptămâna trecută. Investighează deploy-urile / modificările recente sau verifică audit log-ul pentru anomalii.
        </div>
      )}
    </div>
  );
};

const WeekMini = ({ week, maxCount, onCellClick, accentTone }) => {
  const weekdayLabels = ["L", "Ma", "Mi", "J", "V", "S", "D"];
  const accentMap = {
    slate: "text-slate-500",
    emerald: "text-emerald-600 dark:text-emerald-400",
    red: "text-red-600 dark:text-red-400",
  };
  const fmt = (iso) => {
    try {
      const d = new Date(iso + "T00:00:00");
      return d.toLocaleDateString("ro-RO", { day: "2-digit", month: "short" });
    } catch { return iso; }
  };
  return (
    <div className="p-3 rounded-lg bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500 font-bold">{week.label}</div>
          <div className="text-[11px] text-slate-500">{fmt(week.monday)} → {fmt(week.sunday)}</div>
        </div>
        <div className={`text-2xl font-bold ${accentMap[accentTone]}`}>{week.total_sends}</div>
      </div>
      <div className="flex gap-1">
        {week.cells.map((c) => {
          const ratio = c.count / Math.max(maxCount, 1);
          const cls = c.is_future
            ? "bg-slate-50 dark:bg-slate-800/20 border border-dashed border-slate-200 dark:border-slate-700/40"
            : c.count === 0
              ? "bg-slate-100 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/40"
              : ratio <= 0.34
                ? "bg-emerald-200 dark:bg-emerald-500/30"
                : ratio <= 0.67
                  ? "bg-emerald-400 dark:bg-emerald-500/55"
                  : "bg-emerald-600 dark:bg-emerald-400";
          return (
            <button
              key={c.date}
              onClick={() => !c.is_future && onCellClick(c.date)}
              disabled={c.is_future}
              className={`flex-1 aspect-square rounded ${cls} ${c.is_future ? "cursor-not-allowed" : "hover:ring-2 hover:ring-orange-400 transition-all"}`}
              title={`${fmt(c.date)} (${weekdayLabels[c.weekday]})${c.is_future ? " · viitor" : ` · ${c.count} trimitere(i), ${c.recipients} destinatari`}`}
              data-testid={`weekmini-cell-${c.date}`}
            />
          );
        })}
      </div>
      <div className="flex gap-1 mt-1">
        {weekdayLabels.map((wd, idx) => (
          <div key={idx} className="flex-1 text-center text-[9px] text-slate-400 font-medium">{wd}</div>
        ))}
      </div>
    </div>
  );
};
