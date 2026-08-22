// Central configuration for the PathClear simulation.
// Kept in one place so every phase (routing, animation, and later the
// signal + preemption engine) reads from the same source of truth.

// --- Route endpoints (Orlando) --------------------------------------------
// Stored as [lat, lon] for Leaflet, converted to [lon, lat] for OSRM in lib/osrm.js.
export const START = { lat: 28.521023, lon: -81.376036, label: "Incident — SoDo, Orlando" };
export const END = { lat: 28.555493, lon: -81.375873, label: "AdventHealth Orlando" };

// Map view
export const MAP_CENTER = [28.5383, -81.3762]; // roughly the middle of the route
export const MAP_ZOOM = 14;

// --- Ambulance motion ------------------------------------------------------
// Real-world cruising speed of the ambulance in metres per second.
// 13.4 m/s ≈ 30 mph — a realistic urban emergency speed.
export const AMBULANCE_SPEED_MPS = 13.4;

// Simulation speed multiplier. The clock runs SIM_SPEED× faster than real
// time so a ~4 km route plays in under a minute. The underlying seconds are
// still "real" seconds, which keeps the Phase-4 impact numbers honest.
export const SIM_SPEED = 6;

// OSRM public demo routing server.
export const OSRM_BASE = "https://router.project-osrm.org/route/v1/driving";

// --- Traffic signals -------------------------------------------------------
// Signals are placed along the route at a fixed spacing (a stand-in for real
// intersections). Distances are in metres of route travelled.
export const SIGNAL_SPACING_M = 450; // gap between signals along the route
export const SIGNAL_FIRST_AT_M = 350; // distance to the first signal

// Normal signal cycle, in *simulated* seconds (green → yellow → red → repeat).
export const CYCLE = { green: 14, yellow: 3, red: 18 };

// --- Preemption engine -----------------------------------------------------
// When the ambulance is within PREEMPT_AHEAD_M of an upcoming signal, that
// signal is forced green. It stays green until the ambulance is PREEMPT_CLEAR_M
// past the stop line, then returns to its normal cycle.
export const PREEMPT_AHEAD_M = 280;
export const PREEMPT_CLEAR_M = 25;

// How close (metres) the ambulance gets to a red/yellow signal before it must
// stop and wait (only relevant when preemption is OFF).
export const STOP_LINE_GAP_M = 6;
