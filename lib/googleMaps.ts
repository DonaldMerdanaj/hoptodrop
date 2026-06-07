"use client";

const GOOGLE_MAPS_SCRIPT_ID = "google-maps-js";
let googleMapsPromise: Promise<any> | null = null;

declare global {
  interface Window {
    google?: any;
  }
}

export function getGoogleMapsKey() {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "";
}

type MapMarkerOptions = {
  map: any;
  position: { lat: number; lng: number };
  title?: string;
  color?: string;
  label?: string;
  size?: number;
};

function markerNode({ title, color = "#111827", label = "", size = 18 }: Omit<MapMarkerOptions, "map" | "position">) {
  const node = document.createElement("div");
  node.className = "hoptodrop-map-marker";
  node.title = title || "";
  node.setAttribute("aria-label", title || label || "Map marker");
  node.style.width = `${size}px`;
  node.style.height = `${size}px`;
  node.style.borderRadius = "999px";
  node.style.display = "grid";
  node.style.placeItems = "center";
  node.style.color = "#fff";
  node.style.background = color;
  node.style.border = "3px solid #fff";
  node.style.boxShadow = "0 8px 18px rgba(15,23,42,.22)";
  node.style.fontSize = size > 24 ? "9px" : "0";
  node.style.fontWeight = "900";
  node.style.lineHeight = "1";
  node.style.whiteSpace = "nowrap";
  node.style.pointerEvents = "none";
  node.textContent = label;
  return node;
}

export function createMapMarker(maps: any, options: MapMarkerOptions) {
  let position = options.position;
  const node = markerNode(options);
  const overlay = new maps.OverlayView();

  overlay.onAdd = () => {
    const pane = overlay.getPanes()?.overlayMouseTarget;
    pane?.appendChild(node);
  };

  overlay.draw = () => {
    const projection = overlay.getProjection();
    if (!projection) return;
    const point = projection.fromLatLngToDivPixel(new maps.LatLng(position.lat, position.lng));
    if (!point) return;
    node.style.position = "absolute";
    node.style.left = `${point.x}px`;
    node.style.top = `${point.y}px`;
    node.style.transform = "translate(-50%, -50%)";
  };

  overlay.onRemove = () => {
    node.remove();
  };

  overlay.setMap(options.map);

  return {
    setMap(map: any | null) {
      overlay.setMap(map);
    },
    setPosition(next: { lat: number; lng: number }) {
      position = next;
      overlay.draw();
    }
  };
}

export function loadGoogleMaps(): Promise<any> {
  const key = getGoogleMapsKey();
  if (!key) return Promise.reject(new Error("Missing NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"));
  if (typeof window === "undefined") return Promise.reject(new Error("Google Maps requires the browser"));
  if (window.google?.maps) return Promise.resolve(window.google.maps);
  if (googleMapsPromise) return googleMapsPromise;

  googleMapsPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(GOOGLE_MAPS_SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google!.maps));
      existing.addEventListener("error", () => reject(new Error("Google Maps failed to load")));
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    // fix: pass Google's loading=async parameter so the live site avoids the Maps direct-load warning.
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&v=weekly&region=AL&language=en&loading=async`;
    script.onload = () => resolve(window.google!.maps);
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}
