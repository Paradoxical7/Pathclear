import { useEffect, useImperativeHandle, useRef, forwardRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MAP_CENTER, MAP_ZOOM, START, END } from "../config.js";

// Small HTML-based markers so we don't depend on Leaflet's default PNG icons.
const ambulanceIcon = L.divIcon({
  className: "pc-marker",
  html: `<div class="pc-ambulance"><span>🚑</span></div>`,
  iconSize: [40, 40],
  iconAnchor: [20, 20],
});

function endpointIcon(kind) {
  const cls = kind === "start" ? "pc-start" : "pc-end";
  const glyph = kind === "start" ? "●" : "✚";
  return L.divIcon({
    className: "pc-marker",
    html: `<div class="pc-endpoint ${cls}">${glyph}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

const MapView = forwardRef(function MapView(_props, ref) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const routeLayerRef = useRef(null);
  const ambulanceRef = useRef(null);
  const signalMarkersRef = useRef([]);
  const signalElsRef = useRef([]);

  // Initialise the Leaflet map exactly once.
  useEffect(() => {
    if (mapRef.current) return;
    const map = L.map(containerRef.current, {
      center: MAP_CENTER,
      zoom: MAP_ZOOM,
      zoomControl: true,
    });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;

    // Endpoint markers.
    L.marker([START.lat, START.lon], { icon: endpointIcon("start") })
      .addTo(map)
      .bindTooltip(START.label, { direction: "top" });
    L.marker([END.lat, END.lon], { icon: endpointIcon("end") })
      .addTo(map)
      .bindTooltip(END.label, { direction: "top" });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Imperative API used by the simulation loop in App — keeps 60fps marker
  // updates out of React's render cycle.
  useImperativeHandle(ref, () => ({
    showRoute(route) {
      const map = mapRef.current;
      if (!map) return;
      if (routeLayerRef.current) routeLayerRef.current.remove();
      routeLayerRef.current = L.polyline(route.latlngs, {
        color: "#2563eb",
        weight: 5,
        opacity: 0.85,
      }).addTo(map);
      map.fitBounds(routeLayerRef.current.getBounds(), { padding: [40, 40] });

      // Place the ambulance at the start.
      const [lat, lon] = route.latlngs[0];
      if (!ambulanceRef.current) {
        ambulanceRef.current = L.marker([lat, lon], {
          icon: ambulanceIcon,
          zIndexOffset: 1000,
        }).addTo(map);
      } else {
        ambulanceRef.current.setLatLng([lat, lon]);
      }
    },
    showSignals(signals) {
      const map = mapRef.current;
      if (!map) return;
      // Clear any existing signal markers.
      signalMarkersRef.current.forEach((m) => m.remove());
      signalMarkersRef.current = [];
      signalElsRef.current = [];

      signals.forEach((s) => {
        const icon = L.divIcon({
          className: "pc-marker",
          html: `<div class="pc-signal" data-state="red"><span class="pc-signal-dot"></span></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
        const marker = L.marker([s.lat, s.lon], { icon, zIndexOffset: 500 }).addTo(map);
        signalMarkersRef.current.push(marker);
        // getElement() is the icon root; the .pc-signal div is its first child.
        const root = marker.getElement();
        signalElsRef.current.push(root ? root.querySelector(".pc-signal") : null);
      });
    },
    updateSignals(states) {
      const els = signalElsRef.current;
      for (let i = 0; i < els.length; i++) {
        const el = els[i];
        const st = states[i];
        if (!el || !st) continue;
        if (el.dataset.state !== st.state) el.dataset.state = st.state;
        if (st.preempted) el.classList.add("preempt");
        else el.classList.remove("preempt");
      }
    },
    moveMarker(lat, lon) {
      if (ambulanceRef.current) ambulanceRef.current.setLatLng([lat, lon]);
    },
    panTo(lat, lon) {
      if (mapRef.current) mapRef.current.panTo([lat, lon], { animate: true });
    },
  }), []);

  return <div ref={containerRef} className="h-full w-full" />;
});

export default MapView;
