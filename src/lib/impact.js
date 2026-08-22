// Impact model: how much time preemption saves on the run.
//
// This is a small deterministic discrete-event simulation of the same rules the
// live animation uses (drive at a constant average speed; stop at red/yellow
// signals unless they're preempted green). Because it's deterministic, the
// numbers are stable and reproducible.
//
// To answer "on average how much do we save?", we run the no-preemption case
// across many signal-cycle phase offsets and average the result — otherwise the
// figure would depend on exactly which lights happened to be red on one run.

import { CYCLE, STOP_LINE_GAP_M } from "../config.js";
import { effectiveState, nextSignalAhead } from "./signals.js";

const CYCLE_TOTAL = CYCLE.green + CYCLE.yellow + CYCLE.red;

// Simulate one trip. `phase` shifts the whole signal timeline so we can sample
// different "what colour was each light when I arrived" situations.
// Returns times in real-world seconds: { totalSec, driveSec, waitSec, stops }.
export function simulateTrip({ route, signals, avgSpeedMps, preempt, phase = 0 }) {
  const dt = 0.1; // seconds per step
  let t = 0;
  let travelled = 0;
  let wait = 0;
  let stops = 0;
  let wasStopped = false;
  const guard = 60000; // ≤ 6000 s of sim, safety bound

  for (let i = 0; i < guard && travelled < route.lengthM; i++) {
    t += dt;
    let proposed = Math.min(travelled + avgSpeedMps * dt, route.lengthM);
    const next = nextSignalAhead(signals, travelled);
    let stoppedThisStep = false;
    if (next) {
      const eff = effectiveState(next, t + phase, travelled, preempt);
      const stopLine = next.distanceAlongM - STOP_LINE_GAP_M;
      if (eff.state !== "green" && proposed >= stopLine) {
        proposed = Math.max(travelled, stopLine);
        wait += dt;
        stoppedThisStep = true;
      }
    }
    if (stoppedThisStep && !wasStopped) stops += 1;
    wasStopped = stoppedThisStep;
    travelled = proposed;
  }
  return { totalSec: t, driveSec: t - wait, waitSec: wait, stops };
}

// Compare preemption on vs off, averaging the "off" case over a full cycle.
export function computeImpact({ route, signals, avgSpeedMps, samples = 12 }) {
  // With preemption the ambulance never waits, so it's phase-independent — one run.
  const withTrip = simulateTrip({ route, signals, avgSpeedMps, preempt: true, phase: 0 });

  // Without preemption, average across evenly spaced phase offsets.
  let sumTotal = 0;
  let sumWait = 0;
  let sumStops = 0;
  let worstTotal = 0;
  for (let k = 0; k < samples; k++) {
    const phase = (CYCLE_TOTAL * k) / samples;
    const trip = simulateTrip({ route, signals, avgSpeedMps, preempt: false, phase });
    sumTotal += trip.totalSec;
    sumWait += trip.waitSec;
    sumStops += trip.stops;
    if (trip.totalSec > worstTotal) worstTotal = trip.totalSec;
  }
  const withoutAvg = sumTotal / samples;
  const savedAvg = withoutAvg - withTrip.totalSec;

  return {
    withSec: withTrip.totalSec,
    withoutAvgSec: withoutAvg,
    withoutWorstSec: worstTotal,
    savedAvgSec: savedAvg,
    pctFaster: withoutAvg > 0 ? (savedAvg / withoutAvg) * 100 : 0,
    avgWaitWithoutSec: sumWait / samples,
    avgStopsWithout: sumStops / samples,
  };
}
