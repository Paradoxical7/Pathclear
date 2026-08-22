# PathClear 🚑

A real-time **emergency-vehicle traffic-signal preemption simulator** — software only, no hardware required.

An ambulance drives a **real street route** on a live map. As it approaches each
intersection, the signal ahead is forced green and returns to its normal cycle
once the ambulance passes — modelling the preemption systems that normally cost
tens of thousands of dollars per intersection in hardware.

> **This is a simulation / proof-of-concept**, not a fielded system. The point is
> the engineering: real geospatial routing, a real-time proximity engine, a signal
> state machine, and a quantified before/after result.

## Status

**Phase 4 complete** — real OSRM street routing, animated ambulance, traffic
signals with independent state machines, a proximity-based preemption engine, and
an **impact panel** with a realistic response-time clock and a quantified
with-vs-without-preemption comparison.

Roadmap:

- [x] **Phase 0** — Vite + React + Tailwind + Leaflet base map (Orlando)
- [x] **Phase 1** — real OSRM street route + ambulance animation
- [x] **Phase 2** — traffic signals with a red/green/yellow state machine
- [x] **Phase 3** — proximity-based preemption engine + ON/OFF toggle
- [x] **Phase 4** — impact panel: realistic trip clock + time saved, avg over a cycle
- [ ] **Phase 5** — polish, demo GIF, Vercel deploy

## Impact model (the resume number)

The trip clock runs in **real-world time**: the ambulance moves at the average
speed that reproduces OSRM's drive-time estimate for the route
(`distance ÷ duration`), so a full run reads in realistic minutes, not the 6×
animation speed.

`src/lib/impact.js` runs a small deterministic discrete-event simulation of the
same rules the live view uses (drive at average speed; stop at red/yellow unless
preempted). It reports, in seconds:

- **With preemption** — the ambulance never waits, so it hits free-flow time.
- **Without preemption (averaged)** — the same trip is simulated across many
  signal-cycle phase offsets and averaged, so the figure reflects a *typical*
  run rather than one lucky/unlucky set of lights.
- **Time saved** and **% faster**.

On the bundled Orlando route (4.0 km, 8 signals) this is roughly **7:32 with vs.
8:35 without → ~1:03 saved, ~12% faster**, avoiding ~7 red-light stops on average.

> **Honesty note:** this is a *simulated* result under a defined model
> (fixed-timing signals, ambulance fully stops at reds when not preempted,
> OSRM free-flow drive time). It is not a measurement of a fielded system. The
> defensible framing is "~12% faster in simulation," never "reduced real
> response times."

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | React + Vite | Fast dev loop; component split for map / panel / controls |
| Map + tiles | Leaflet + OpenStreetMap | Free, no API key, open data, full layer control |
| Routing | OSRM (public demo server) | Real street routes over OSM data, not straight lines |
| Geo math | Turf.js | Distance, along-line interpolation, proximity checks |
| Animation | `requestAnimationFrame` + interpolation | Smooth 60fps motion, not `setInterval` |
| Styling | Tailwind CSS v4 | Fast, consistent |
| Deploy | Vercel *(planned)* | One-command deploy, live URL |

## How it works

1. On load, the app requests a driving route between two Orlando points from the
   OSRM public server (`src/lib/osrm.js`). If OSRM is unreachable or rate-limited,
   it falls back to a **bundled pre-fetched route** (`src/data/fallbackRoute.js`)
   so the demo never breaks.
2. The route polyline and signal markers are drawn on a Leaflet map
   (`src/components/MapView.jsx`).
3. Signals are placed along the route (`src/lib/signals.js`); each runs an
   independent **red → green → yellow** state machine on the simulation clock
   with a staggered phase offset.
4. The animation loop (`src/App.jsx`) advances a distance-travelled counter each
   frame and uses Turf's `along()` to interpolate the ambulance's exact position.
   Each frame it also runs the **preemption engine**: for every signal it
   computes the ambulance→signal gap and forces the upcoming one green inside
   `PREEMPT_AHEAD_M`, releasing it back to its normal cycle once the ambulance is
   `PREEMPT_CLEAR_M` past the stop line.
5. With preemption **off**, the ambulance stops at red/yellow lights (stop-line
   logic) and accumulates a signal-wait timer — the baseline the preemption
   system improves on.
6. The control panel (`src/components/ControlPanel.jsx`) has the preemption
   toggle and shows route distance, signal count, progress, live status
   ("Clearing path" / "Stopped at red"), and accumulated signal wait.

Ambulance speed, simulation speed, signal spacing/timing, and preemption
thresholds all live in `src/config.js`.

## Run locally

```bash
npm install
npm run dev
```

Then open the printed local URL. `npm run build` produces a production build in `dist/`.

## Project structure

```
src/
  config.js               route endpoints, speeds, OSRM URL
  App.jsx                 layout + the requestAnimationFrame simulation loop
  components/
    MapView.jsx           Leaflet map, route polyline, ambulance marker
    ControlPanel.jsx      telemetry + controls
  lib/
    osrm.js               OSRM fetch with offline fallback
    geo.js                Turf helpers (route length, position-along-route)
    signals.js            signal placement, state machine, preemption logic
  data/
    fallbackRoute.js      bundled Orlando route for offline/rate-limited use
```
