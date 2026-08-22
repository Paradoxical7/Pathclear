// Geometry helpers built on Turf.js.
// Turf works in [lon, lat] (GeoJSON) order; Leaflet works in [lat, lon].
// These helpers keep the conversion in one place.

import { lineString, length, along, bearing, point } from "@turf/turf";

// Build a reusable route object from raw [lon, lat] coordinates.
export function makeRoute(coordsLonLat) {
  const line = lineString(coordsLonLat);
  const lengthKm = length(line, { units: "kilometers" });
  // Leaflet wants [lat, lon].
  const latlngs = coordsLonLat.map(([lon, lat]) => [lat, lon]);
  return { line, lengthKm, lengthM: lengthKm * 1000, latlngs, coordsLonLat };
}

// Position (and heading) at a given distance travelled along the route.
// distanceM is clamped to the route length. Returns Leaflet-friendly lat/lon
// plus a compass bearing in degrees (0 = north) for rotating the icon.
export function positionAt(route, distanceM) {
  const clamped = Math.max(0, Math.min(distanceM, route.lengthM));
  const km = clamped / 1000;
  const here = along(route.line, km, { units: "kilometers" });

  // Look a little ahead to derive heading; near the end, look behind instead.
  const aheadKm = Math.min(km + 0.02, route.lengthKm);
  const behindKm = Math.max(km - 0.02, 0);
  const a = along(route.line, behindKm, { units: "kilometers" });
  const b = along(route.line, aheadKm, { units: "kilometers" });
  const heading = bearing(point(a.geometry.coordinates), point(b.geometry.coordinates));

  const [lon, lat] = here.geometry.coordinates;
  return { lat, lon, heading };
}
