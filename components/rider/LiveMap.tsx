"use client";

import { useEffect, useRef, useState } from "react";
import type { DriverLocation } from "@/lib/types";
import { createMapMarker, getGoogleMapsKey, loadGoogleMaps } from "@/lib/googleMaps";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type RoutePoint = {
  name: string;
  lat: number;
  lng: number;
};

const defaultPickup: RoutePoint = { name: "", lat: 41.3275, lng: 19.8187 };
const defaultDropoff: RoutePoint = { name: "", lat: 41.3194, lng: 19.8157 };

function asLatLng(point: RoutePoint) {
  return { lat: point.lat, lng: point.lng };
}

export default function LiveMap({ initialRiderLocation }: { initialRiderLocation?: RoutePoint | null }) {
  // fix: LiveMap now uses Google Maps directly, so the old react-leaflet dynamic imports and module-scope L.DivIcon SSR crash path are removed.
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);
  const riderMarkerRef = useRef<any>(null);
  const directionsRef = useRef<any>(null);
  const activeDriverMarkerRef = useRef<any>(null);
  const [drivers, setDrivers] = useState<DriverLocation[]>([]);
  const [route, setRoute] = useState({ pickup: defaultPickup, dropoff: defaultDropoff });
  const [riderLocation, setRiderLocation] = useState<RoutePoint | null>(null);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    if (initialRiderLocation) {
      setRiderLocation(initialRiderLocation);
      setRoute((current) => ({ ...current, pickup: initialRiderLocation }));
    }
  }, [initialRiderLocation]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;

    const client = supabase;

    async function loadDrivers() {
      const { data } = await client
        .from("driver_locations")
        .select("*")
        .in("status", ["online", "busy"]);

      if (data) setDrivers(data as DriverLocation[]);
    }

    loadDrivers();

    const channel = client
      .channel("live-driver-map")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations" },
        (payload) => {
          const next = payload.new as DriverLocation;
          if (!next?.id) return;
          setDrivers((current) => {
            const existing = current.find((driver) => driver.id === next.id);
            if (next.status === "offline") return current.filter((driver) => driver.id !== next.id);
            if (existing) return current.map((driver) => (driver.id === next.id ? next : driver));
            return [...current, next];
          });
        }
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    function onPreview(event: Event) {
      const detail = (event as CustomEvent<{ pickup: RoutePoint; dropoff: RoutePoint }>).detail;
      if (detail?.pickup && detail?.dropoff) setRoute(detail);
    }

    function onRiderLocation(event: Event) {
      const detail = (event as CustomEvent<RoutePoint>).detail;
      if (detail?.lat && detail?.lng) {
        setRiderLocation(detail);
        setRoute((current) => ({ ...current, pickup: detail }));
      }
    }

    function onActiveDriverLocation(event: Event) {
      const detail = (event as CustomEvent<{ lat: number; lng: number }>).detail;
      if (!detail || typeof detail.lat !== "number" || typeof detail.lng !== "number") return;
      const maps = window.google?.maps;
      if (!maps || !mapRef.current) return;

      if (!activeDriverMarkerRef.current) {
        // fix: use a custom overlay marker instead of deprecated google.maps.Marker.
        activeDriverMarkerRef.current = createMapMarker(maps, {
          map: mapRef.current,
          position: detail,
          title: "Your driver",
          label: "TAXI",
          color: "#16a34a",
          size: 34
        });
      } else {
        activeDriverMarkerRef.current.setPosition(detail);
      }
    }

    function clearActiveDriver() {
      activeDriverMarkerRef.current?.setMap(null);
      activeDriverMarkerRef.current = null;
    }

    window.addEventListener("taxi-route-preview", onPreview);
    window.addEventListener("taxi-rider-location", onRiderLocation);
    window.addEventListener("taxi-active-driver-location", onActiveDriverLocation);
    window.addEventListener("taxi-clear-active-driver", clearActiveDriver);
    return () => {
      window.removeEventListener("taxi-route-preview", onPreview);
      window.removeEventListener("taxi-rider-location", onRiderLocation);
      window.removeEventListener("taxi-active-driver-location", onActiveDriverLocation);
      window.removeEventListener("taxi-clear-active-driver", clearActiveDriver);
    };
  }, []);

  useEffect(() => {
    if (!getGoogleMapsKey()) {
      setMapError("Add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable Google Maps and Places autocomplete.");
      return;
    }

    loadGoogleMaps()
      .then((maps) => {
        if (!mapNode.current) return;

        if (!mapRef.current) {
          mapRef.current = new maps.Map(mapNode.current, {
            center: asLatLng(route.pickup),
            zoom: 13,
            disableDefaultUI: true,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            clickableIcons: false,
            styles: [
              { featureType: "poi.business", stylers: [{ visibility: "off" }] },
              { featureType: "poi.attraction", stylers: [{ visibility: "off" }] },
              { featureType: "poi.school", stylers: [{ visibility: "off" }] },
              { featureType: "transit", stylers: [{ visibility: "off" }] },
              { featureType: "road", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
              { featureType: "administrative", elementType: "labels", stylers: [{ visibility: "simplified" }] }
            ]
          });
        }

        maps.event.clearListeners(mapRef.current, "click");
        mapRef.current.addListener("click", (event: any) => {
          const location = event.latLng;
          if (!location) return;

          const fallback = {
            name: `Pinned pickup (${location.lat().toFixed(5)}, ${location.lng().toFixed(5)})`,
            lat: location.lat(),
            lng: location.lng()
          };

          const geocoder = new maps.Geocoder();
          geocoder.geocode({ location }, (results: any[], status: string) => {
            window.dispatchEvent(new CustomEvent("taxi-map-tap", {
              detail: {
                ...fallback,
                name: status === "OK" && results?.[0]?.formatted_address ? results[0].formatted_address : fallback.name
              }
            }));
          });
        });

        markerRefs.current.forEach((marker) => marker.setMap(null));
        markerRefs.current = [];
        directionsRef.current?.setMap(null);
        riderMarkerRef.current?.setMap(null);

        const bounds = new maps.LatLngBounds();
        const pickupLatLng = asLatLng(route.pickup);
        const dropoffLatLng = asLatLng(route.dropoff);

        if (riderLocation) {
          const center = asLatLng(riderLocation);
          // fix: use custom overlay markers to avoid deprecated google.maps.Marker warnings.
          riderMarkerRef.current = createMapMarker(maps, {
            map: mapRef.current,
            position: center,
            title: "Current location",
            color: "#2563eb",
            size: 18
          });
          mapRef.current.setCenter(center);
          mapRef.current.setZoom(15);
          bounds.extend(center);
        }

        if (route.pickup.name) {
          markerRefs.current.push(
            createMapMarker(maps, {
              map: mapRef.current,
              position: pickupLatLng,
              title: route.pickup.name,
              color: "#111827",
              size: 18
            })
          );
          bounds.extend(pickupLatLng);
        }

        if (route.dropoff.name) {
          markerRefs.current.push(
            createMapMarker(maps, {
              map: mapRef.current,
              position: dropoffLatLng,
              title: route.dropoff.name,
              color: "#2563eb",
              size: 18
            })
          );
          bounds.extend(dropoffLatLng);
        }


        drivers.forEach((driver) => {
          const marker = createMapMarker(maps, {
            map: mapRef.current,
            position: { lat: driver.lat, lng: driver.lng },
            title: `${driver.driver_name} - ${driver.vehicle || "Taxi"}`,
            label: "TAXI",
            color: driver.status === "busy" ? "#6b7280" : "#111827",
            size: 34
          });
          markerRefs.current.push(marker);
          bounds.extend({ lat: driver.lat, lng: driver.lng });
        });

        if (route.pickup.name && route.dropoff.name) {
          const service = new maps.DirectionsService();
          const renderer = new maps.DirectionsRenderer({
            map: mapRef.current,
            suppressMarkers: true,
            preserveViewport: true,
            polylineOptions: { strokeColor: "#111827", strokeOpacity: 0.88, strokeWeight: 4 }
          });
          directionsRef.current = renderer;
          service.route({ origin: pickupLatLng, destination: dropoffLatLng, travelMode: maps.TravelMode.DRIVING }, (result: any, status: string) => {
            if (status === "OK" && result) renderer.setDirections(result);
          });

          mapRef.current.fitBounds(bounds, 80);
        } else if (!riderLocation && !bounds.isEmpty()) {
          mapRef.current.fitBounds(bounds, 80);
        }
      })
      .catch((error) => setMapError(error.message));
  }, [riderLocation, drivers, route]);

  return (
    <div className="map-wrap">
      <div className="google-map" ref={mapNode} />
      {mapError && (
        <button
          className="map-empty-state"
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent("taxi-map-tap", { detail: defaultPickup }))}
        >
          <strong>Google Maps not configured</strong>
          <span>{mapError}</span>
        </button>
      )}
    </div>
  );
}
