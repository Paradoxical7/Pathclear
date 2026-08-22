// Traffic-signal placement, the per-signal state machine, and the proximity
// preemption logic. All distances are in metres of route travelled; all times
// are in *simulated* seconds so signal cycles line up with the sim clock.

import {
  SIGNAL_SPACING_M,
  SIGNAL_FIRST_AT_M,
  CYCLE,
  PREEMPT_AHEAD_M,
  PREEMPT_CLEAR_M,
} from "../config.js";
import { positionAt } from "./geo.js";

const CYCLE_TOTAL = CYCLE.green + CYCLE.yellow + CYCLE.red; // seconds

// Build evenly spaced signals along the route, each with a fixed phase offset
// so they don't all cycle in lockstep.
export function buildSignals(route) {
  const signals = [];
  let d = SIGNAL_FIRST_AT_M;
  let i = 0;
  while (d < route.lengthM - 80) {
    const pos = positionAt(route, d);
    signals.push({
      id: i,
      distanceAlongM: d,
      lat: pos.lat,
      lon: pos.lon,
      // Deterministic, spread-out offset (no RNG → reproducible demo).
      offsetSec: (i * 11) % CYCLE_TOTAL,
    });
    d += SIGNAL_SPACING_M;
    i += 1;
  }
  return signals;
}

// A signal's colour under its normal cycle at a given simulated time.
export function normalState(signal, simSec) {
  const t = (simSec + signal.offsetSec) % CYCLE_TOTAL;
  if (t < CYCLE.green) return "green";
  if (t < CYCLE.green + CYCLE.yellow) return "yellow";
  return "red";
}

// Effective colour, taking preemption into account.
// Returns { state, preempted }.
export function effectiveState(signal, simSec, ambDistM, preemptOn) {
  const gap = signal.distanceAlongM - ambDistM; // >0 = signal is ahead
  if (preemptOn && gap <= PREEMPT_AHEAD_M && gap >= -PREEMPT_CLEAR_M) {
    return { state: "green", preempted: true };
  }
  return { state: normalState(signal, simSec), preempted: false };
}

// The next signal strictly ahead of the ambulance (or null past the last one).
export function nextSignalAhead(signals, ambDistM) {
  for (const s of signals) {
    if (s.distanceAlongM > ambDistM + 0.5) return s;
  }
  return null;
}
