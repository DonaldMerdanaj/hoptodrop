"use client";

import { useEffect, useRef, useState } from "react";
import type { DriverLocation } from "@/lib/types";
import { getGoogleMapsKey, loadGoogleMaps } from "@/lib/googleMaps";
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

function pinIcon(maps: any, color: string, scale = 9) {
  return {
    path: maps.SymbolPath.CIRCLE,
    fillColor: color,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 4,
    scale
  };
}

export default function LiveMap({ initialCustomerLocation }: { initialCustomerLocation?: RoutePoint | null }) {
  // fix: LiveMap now uses Google Maps directly, so the old react-leaflet dynamic imports and module-scope L.DivIcon SSR crash path are removed.
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<any[]>([]);
  const customerMarkerRef = useRef<any>(null);
  const customerRadiusRef = useRef<any>(null);
  const directionsRef = useRef<any>(null);
  const [drivers, setDrivers] = useState<DriverLocation[]>([]);
  const [route, setRoute] = useState({ pickup: defaultPickup, dropoff: defaultDropoff });
  const [customerLocation, setCustomerLocation] = useState<RoutePoint | null>(null);
  const [mapError, setMapError] = useState("");

  useEffect(() => {
    if (initialCustomerLocation) {
      setCustomerLocation(initialCustomerLocation);
      setRoute((current) => ({ ...current, pickup: initialCustomerLocation }));
    }
  }, [initialCustomerLocation]);

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

    function onCustomerLocation(event: Event) {
      const detail = (event as CustomEvent<RoutePoint>).detail;
      if (detail?.lat && detail?.lng) {
        setCustomerLocation(detail);
        setRoute((current) => ({ ...current, pickup: detail }));
      }
    }

    window.addEventListener("taxi-route-preview", onPreview);
    window.addEventListener("taxi-customer-location", onCustomerLocation);
    return () => {
      window.removeEventListener("taxi-route-preview", onPreview);
      window.removeEventListener("taxi-customer-location", onCustomerLocation);
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
        customerMarkerRef.current?.setMap(null);
        customerRadiusRef.current?.setMap(null);

        const bounds = new maps.LatLngBounds();
        const pickupLatLng = asLatLng(route.pickup);
        const dropoffLatLng = asLatLng(route.dropoff);

        if (customerLocation) {
          const center = asLatLng(customerLocation);
          customerRadiusRef.current = new maps.Circle({
            map: mapRef.current,
            center,
            radius: 1000,
            strokeColor: "#2563eb",
            strokeOpacity: 0.55,
            strokeWeight: 2,
            fillColor: "#2563eb",
            fillOpacity: 0.08
          });
          customerMarkerRef.current = new maps.Marker({
            map: mapRef.current,
            position: center,
            title: "Current location",
            icon: pinIcon(maps, "#2563eb", 8)
          });
          mapRef.current.setCenter(center);
          mapRef.current.setZoom(15);
          bounds.extend(center);
        }

        if (route.pickup.name) {
          markerRefs.current.push(
            new maps.Marker({
              map: mapRef.current,
              position: pickupLatLng,
              title: route.pickup.name,
              icon: pinIcon(maps, "#111827", 8)
            })
          );
          bounds.extend(pickupLatLng);
        }

        if (route.dropoff.name) {
          markerRefs.current.push(
            new maps.Marker({
              map: mapRef.current,
              position: dropoffLatLng,
              title: route.dropoff.name,
              icon: pinIcon(maps, "#2563eb", 8)
            })
          );
          bounds.extend(dropoffLatLng);
        }


        drivers.forEach((driver) => {
          const marker = new maps.Marker({
            map: mapRef.current,
            position: { lat: driver.lat, lng: driver.lng },
            title: `${driver.driver_name} - ${driver.vehicle || "Taxi"}`,
            label: { text: "TAXI", color: "#ffffff", fontSize: "9px", fontWeight: "900" },
            icon: pinIcon(maps, driver.status === "busy" ? "#6b7280" : "#111827", 15)
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
        } else if (!customerLocation && !bounds.isEmpty()) {
          mapRef.current.fitBounds(bounds, 80);
        }
      })
      .catch((error) => setMapError(error.message));
  }, [customerLocation, drivers, route]);

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
