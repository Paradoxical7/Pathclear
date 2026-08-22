// Fetches a real driving route from the OSRM public demo server, with a
// bundled offline fallback so the demo never breaks if OSRM is down or
// rate-limited. Returns raw [lon, lat] coordinates plus OSRM's distance
// (metres) and duration (seconds) estimates.

import { OSRM_BASE, START, END } from "../config.js";
import { FALLBACK_ROUTE } from "../data/fallbackRoute.js";

export async function fetchRoute({ signal } = {}) {
  const url =
    `${OSRM_BASE}/${START.lon},${START.lat};${END.lon},${END.lat}` +
    `?overview=full&geometries=geojson`;

  try {
    const res = await fetch(url, { signal });
    if (!res.ok) throw new Error(`OSRM responded ${res.status}`);
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) {
      throw new Error(`OSRM returned code ${data.code}`);
    }
    const route = data.routes[0];
    return {
      coordinates: route.geometry.coordinates, // [lon, lat]
      distance: route.distance,
      duration: route.duration,
      source: "osrm",
    };
  } catch (err) {
    if (err.name === "AbortError") throw err; // caller is tearing down; don't fall back
    // Any failure (network, CORS, rate limit, bad payload) → offline fallback.
    console.warn("[PathClear] OSRM fetch failed, using bundled route:", err.message);
    return {
      coordinates: FALLBACK_ROUTE.coordinates,
      distance: FALLBACK_ROUTE.distance,
      duration: FALLBACK_ROUTE.duration,
      source: "fallback",
    };
  }
}
