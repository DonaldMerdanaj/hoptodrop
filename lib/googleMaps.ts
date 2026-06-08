"use client";

const GOOGLE_MAPS_SCRIPT_ID = "google-maps-js";
const GOOGLE_MAPS_CALLBACK = "__hoptodropGoogleMapsReady";
let googleMapsPromise: Promise<any> | null = null;

declare global {
  interface Window {
    google?: any;
    __hoptodropGoogleMapsReady?: () => void;
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

type MarkerPosition = { lat: number; lng: number };

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
  let animationFrame = 0;
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
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      overlay.setMap(map);
    },
    setPosition(next: MarkerPosition, animationMs = 650) {
      const start = position;
      const startedAt = performance.now();
      if (animationFrame) window.cancelAnimationFrame(animationFrame);

      // fix: animate live marker updates so the rider sees the taxi glide instead of jumping between GPS points.
      function step(now: number) {
        const progress = animationMs <= 0 ? 1 : Math.min(1, (now - startedAt) / animationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        position = {
          lat: start.lat + (next.lat - start.lat) * eased,
          lng: start.lng + (next.lng - start.lng) * eased
        };
        overlay.draw();
        if (progress < 1) animationFrame = window.requestAnimationFrame(step);
      }

      animationFrame = window.requestAnimationFrame(step);
    },
    snapTo(next: MarkerPosition) {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      position = next;
      overlay.draw();
    }
  };
}

export async function reverseGeocodeAddress(lat: number, lng: number) {
  try {
    const maps = await loadGoogleMaps();
    const geocoder = new maps.Geocoder();
    const location = { lat, lng };

    return await new Promise<string>((resolve) => {
      // fix: current-location labels use the real Google address instead of the generic "Current location" text.
      geocoder.geocode({ location }, (results: any[] | null, status: string) => {
        if (status === "OK" && results?.[0]?.formatted_address) {
          resolve(results[0].formatted_address);
          return;
        }

        resolve(`Pinned location (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
      });
    });
  } catch {
    return `Pinned location (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
  }
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
    // fix: when using loading=async, wait for Google's callback before reading google.maps.Map.
    window[GOOGLE_MAPS_CALLBACK] = () => {
      if (window.google?.maps?.Map) resolve(window.google.maps);
      else reject(new Error("Google Maps loaded without the Maps library"));
    };
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&v=weekly&region=AL&language=en&loading=async&callback=${GOOGLE_MAPS_CALLBACK}`;
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}
