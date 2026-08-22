import { useCallback, useEffect, useRef, useState } from "react";
import MapView from "./components/MapView.jsx";
import { fetchRoute } from "./lib/osrm.js";
import { makeRoute, positionAt } from "./lib/geo.js";
import { AMBULANCE_SPEED_MPS, SIM_SPEED, START, END, STOP_LINE_GAP_M } from "./config.js";
import { buildSignals, effectiveState, nextSignalAhead } from "./lib/signals.js";
import { computeImpact } from "./lib/impact.js";
import ControlPanel from "./components/ControlPanel.jsx";

export default function App() {
  const mapRef = useRef(null);

  const [route, setRoute] = useState(null);
  const [signals, setSignals] = useState([]);
  const [source, setSource] = useState(null); // 'osrm' | 'fallback'
  const [osrmDuration, setOsrmDuration] = useState(null);
  const [avgSpeed, setAvgSpeed] = useState(AMBULANCE_SPEED_MPS);
  const [impact, setImpact] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | running | done
  const [preemptOn, setPreemptOn] = useState(true);
  const [progress, setProgress] = useState({
    fraction: 0,
    distanceM: 0,
    tripSec: 0,
    waitSec: 0,
    waiting: false,
  });

  // Animation state kept in refs so the 60fps loop never triggers re-renders.
  const rafRef = useRef(0);
  const travelledRef = useRef(0);
  const simSecRef = useRef(0); // realistic seconds elapsed on this trip
  const waitSecRef = useRef(0); // realistic seconds spent stopped at signals
  const lastFrameRef = useRef(0);
  const lastPanelRef = useRef(0);
  const preemptRef = useRef(true);
  const avgSpeedRef = useRef(AMBULANCE_SPEED_MPS); // m/s, from OSRM duration

  useEffect(() => {
    preemptRef.current = preemptOn;
  }, [preemptOn]);

  // Load the route once on mount.
  useEffect(() => {
    const ctrl = new AbortController();
    (async () => {
      try {
        const raw = await fetchRoute({ signal: ctrl.signal });
        if (ctrl.signal.aborted) return;
        const r = makeRoute(raw.coordinates);
        const sigs = buildSignals(r);
        // Average speed that reproduces OSRM's real-world drive-time estimate.
        const spd = raw.duration > 0 ? r.lengthM / raw.duration : AMBULANCE_SPEED_MPS;
        avgSpeedRef.current = spd;

        setRoute(r);
        setSignals(sigs);
        setSource(raw.source);
        setOsrmDuration(raw.duration);
        setAvgSpeed(spd);
        setImpact(computeImpact({ route: r, signals: sigs, avgSpeedMps: spd }));
        setStatus("ready");

        requestAnimationFrame(() => {
          mapRef.current?.showRoute(r);
          mapRef.current?.showSignals(sigs);
          mapRef.current?.updateSignals(
            sigs.map((s) => effectiveState(s, 0, 0, preemptRef.current))
          );
        });
      } catch (err) {
        if (err.name !== "AbortError") console.error("[PathClear] route load failed", err);
      }
    })();
    return () => ctrl.abort();
  }, []);

  const pushPanel = useCallback((r, travelledM, extra) => {
    setProgress({
      fraction: travelledM / r.lengthM,
      distanceM: travelledM,
      tripSec: simSecRef.current,
      waitSec: waitSecRef.current,
      ...extra,
    });
  }, []);

  const tick = useCallback(
    (now) => {
      const r = route;
      if (!r) return;
      const dt = (now - lastFrameRef.current) / 1000;
      lastFrameRef.current = now;

      // Realistic seconds elapsed this frame (animation runs SIM_SPEED× faster).
      const dSim = dt * SIM_SPEED;
      simSecRef.current += dSim;
      const simSec = simSecRef.current;
      const preempt = preemptRef.current;
      const step = avgSpeedRef.current * dSim; // metres of route this frame

      const cur = travelledRef.current;
      let proposed = Math.min(cur + step, r.lengthM);

      // Stop-at-red when not preempted green.
      let waiting = false;
      const next = nextSignalAhead(signals, cur);
      if (next) {
        const eff = effectiveState(next, simSec, cur, preempt);
        const stopLine = next.distanceAlongM - STOP_LINE_GAP_M;
        if (eff.state !== "green" && proposed >= stopLine) {
          proposed = Math.max(cur, stopLine);
          waiting = true;
          waitSecRef.current += dSim;
        }
      }
      travelledRef.current = proposed;

      const pos = positionAt(r, travelledRef.current);
      mapRef.current?.moveMarker(pos.lat, pos.lon);

      const states = signals.map((s) => effectiveState(s, simSec, travelledRef.current, preempt));
      mapRef.current?.updateSignals(states);

      if (now - lastPanelRef.current > 100) {
        lastPanelRef.current = now;
        pushPanel(r, travelledRef.current, { waiting });
      }

      if (travelledRef.current >= r.lengthM) {
        pushPanel(r, r.lengthM, { waiting: false });
        setStatus("done");
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    },
    [route, signals, pushPanel]
  );

  const start = useCallback(() => {
    if (!route) return;
    if (travelledRef.current >= route.lengthM) {
      travelledRef.current = 0;
      simSecRef.current = 0;
      waitSecRef.current = 0;
    }
    setStatus("running");
    lastFrameRef.current = performance.now();
    lastPanelRef.current = 0;
    rafRef.current = requestAnimationFrame(tick);
  }, [route, tick]);

  const pause = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    setStatus("ready");
  }, []);

  const reset = useCallback(() => {
    cancelAnimationFrame(rafRef.current);
    travelledRef.current = 0;
    simSecRef.current = 0;
    waitSecRef.current = 0;
    setStatus("ready");
    setProgress({ fraction: 0, distanceM: 0, tripSec: 0, waitSec: 0, waiting: false });
    if (route) {
      mapRef.current?.moveMarker(route.latlngs[0][0], route.latlngs[0][1]);
      mapRef.current?.updateSignals(
        signals.map((s) => effectiveState(s, 0, 0, preemptRef.current))
      );
    }
  }, [route, signals]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="flex h-screen w-screen flex-col bg-slate-950 text-slate-100 md:flex-row">
      <div className="relative flex-1">
        <MapView ref={mapRef} />
      </div>
      <ControlPanel
        status={status}
        source={source}
        route={route}
        signalCount={signals.length}
        osrmDuration={osrmDuration}
        avgSpeed={avgSpeed}
        impact={impact}
        progress={progress}
        preemptOn={preemptOn}
        onTogglePreempt={() => setPreemptOn((v) => !v)}
        onStart={start}
        onPause={pause}
        onReset={reset}
        startPoint={START}
        endPoint={END}
      />
    </div>
  );
}
