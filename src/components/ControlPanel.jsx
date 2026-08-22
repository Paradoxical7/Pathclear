import { SIM_SPEED } from "../config.js";

function mmss(totalSec) {
  const s = Math.max(0, Math.round(totalSec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

function StatRow({ label, value, accent }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-xs uppercase tracking-wide text-slate-400">{label}</span>
      <span className={"font-mono text-sm " + (accent || "text-slate-100")}>{value}</span>
    </div>
  );
}

export default function ControlPanel({
  status,
  source,
  route,
  signalCount,
  avgSpeed,
  impact,
  progress,
  preemptOn,
  onTogglePreempt,
  onStart,
  onPause,
  onReset,
  startPoint,
  endPoint,
}) {
  const loading = status === "loading";
  const running = status === "running";
  const done = status === "done";
  const totalKm = route ? route.lengthM / 1000 : 0;
  const mph = avgSpeed ? Math.round(avgSpeed * 2.237) : 0;

  // The trip clock: live while running/done, otherwise the expected time for the
  // currently selected mode.
  const expectedSec = impact ? (preemptOn ? impact.withSec : impact.withoutAvgSec) : 0;
  const clockSec = running || done ? progress.tripSec : expectedSec;

  return (
    <aside className="flex w-full flex-col gap-4 overflow-y-auto border-t border-slate-800 bg-slate-900/95 p-5 md:w-[370px] md:border-l md:border-t-0">
      <header>
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <span>🚑</span> PathClear
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Emergency-vehicle signal-preemption simulator
        </p>
      </header>

      {/* Live trip clock — the headline */}
      <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-center">
        <div className="text-[11px] uppercase tracking-widest text-slate-400">
          Response time to hospital
        </div>
        <div
          className={
            "mt-1 font-mono text-5xl font-bold tabular-nums " +
            (progress.waiting ? "text-amber-300" : done ? "text-emerald-400" : "text-slate-50")
          }
        >
          {loading ? "—:—" : mmss(clockSec)}
        </div>
        <div className="mt-1 text-xs text-slate-400">
          {running || done ? (
            <>
              live · preemption {preemptOn ? "ON" : "OFF"}
              {progress.waitSec > 0 && (
                <span className="text-amber-300"> · {mmss(progress.waitSec)} at reds</span>
              )}
            </>
          ) : (
            <>expected · preemption {preemptOn ? "ON" : "OFF"}</>
          )}
        </div>
      </div>

      {/* Impact — with vs without */}
      {impact && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-300">
            Impact of preemption
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-slate-950/50 p-2.5 text-center">
              <div className="font-mono text-lg font-bold text-emerald-400">
                {mmss(impact.withSec)}
              </div>
              <div className="text-[11px] text-slate-400">with preemption</div>
            </div>
            <div className="rounded-lg bg-slate-950/50 p-2.5 text-center">
              <div className="font-mono text-lg font-bold text-slate-300">
                {mmss(impact.withoutAvgSec)}
              </div>
              <div className="text-[11px] text-slate-400">without (avg)</div>
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-center gap-2">
            <span className="font-mono text-2xl font-bold text-emerald-400">
              −{mmss(impact.savedAvgSec)}
            </span>
            <span className="text-sm font-semibold text-emerald-300">
              {impact.pctFaster.toFixed(0)}% faster
            </span>
          </div>
          <p className="mt-2 text-center text-[11px] leading-snug text-slate-500">
            Avg over a full signal cycle · {signalCount} signals · ~
            {Math.round(impact.avgStopsWithout)} stops avoided
          </p>
        </div>
      )}

      {/* Route */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-slate-400">Route</span>
          {source && (
            <span
              className={
                "rounded-full px-2 py-0.5 text-[11px] font-medium " +
                (source === "osrm"
                  ? "bg-emerald-500/15 text-emerald-300"
                  : "bg-amber-500/15 text-amber-300")
              }
            >
              {source === "osrm" ? "Live OSRM" : "Offline route"}
            </span>
          )}
        </div>
        <StatRow label="Distance" value={loading ? "…" : `${totalKm.toFixed(2)} km`} />
        <StatRow label="Signals" value={loading ? "…" : signalCount} />
        <StatRow label="Avg speed" value={loading ? "…" : `${mph} mph · ${SIM_SPEED}× sim`} />
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {running ? (
          <button
            onClick={onPause}
            className="flex-1 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400"
          >
            Pause
          </button>
        ) : (
          <button
            onClick={onStart}
            disabled={loading}
            className="flex-1 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-40"
          >
            {done ? "Replay" : progress.fraction > 0 ? "Resume" : "Dispatch"}
          </button>
        )}
        <button
          onClick={onReset}
          disabled={loading}
          className="rounded-lg border border-slate-700 px-4 py-2.5 text-sm font-medium text-slate-200 transition hover:bg-slate-800 disabled:opacity-40"
        >
          Reset
        </button>
      </div>

      {/* Preemption toggle */}
      <button
        onClick={onTogglePreempt}
        className={
          "flex items-center justify-between rounded-lg border p-3 text-left transition " +
          (preemptOn
            ? "border-emerald-500/40 bg-emerald-500/10"
            : "border-slate-700 bg-slate-950/60")
        }
      >
        <div>
          <div className="text-sm font-semibold">
            Signal preemption {preemptOn ? "ON" : "OFF"}
          </div>
          <div className="text-xs text-slate-400">
            {preemptOn ? "Lights clear as the ambulance nears" : "Ambulance waits at red lights"}
          </div>
        </div>
        <span
          className={
            "relative h-6 w-11 shrink-0 rounded-full transition " +
            (preemptOn ? "bg-emerald-500" : "bg-slate-600")
          }
        >
          <span
            className={
              "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all " +
              (preemptOn ? "left-[22px]" : "left-0.5")
            }
          />
        </span>
      </button>

      {/* Progress */}
      <div>
        <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
          <span>Progress</span>
          <span className="font-mono">{Math.round(progress.fraction * 100)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-100"
            style={{ width: `${progress.fraction * 100}%` }}
          />
        </div>
        <div className="mt-3">
          <StatRow
            label="Distance"
            value={`${(progress.distanceM / 1000).toFixed(2)} / ${totalKm.toFixed(2)} km`}
          />
          <StatRow
            label="Status"
            value={
              loading
                ? "Loading route"
                : done
                ? "✓ Arrived"
                : progress.waiting
                ? "⏸ Stopped at red"
                : running
                ? preemptOn
                  ? "🟢 Clearing path"
                  : "En route"
                : "Ready to dispatch"
            }
            accent={progress.waiting ? "text-amber-300" : done ? "text-emerald-400" : undefined}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="mt-auto space-y-2 border-t border-slate-800 pt-4 text-xs text-slate-400">
        <div className="flex flex-wrap gap-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-[#22c55e]" /> Green
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-[#eab308]" /> Yellow
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-full bg-[#ef4444]" /> Red
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />
          {startPoint?.label}
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-red-400" />
          {endPoint?.label}
        </div>
      </div>
    </aside>
  );
}
