"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import BookingForm from "@/components/BookingForm";
import type { PlaceSelection } from "@/components/PlaceInput";
import RideLauncher from "@/components/RideLauncher";
import TopNav from "@/components/TopNav";

const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false });

function isInsideAlbania(lat: number, lng: number) {
  return lat >= 39.6 && lat <= 42.7 && lng >= 19.0 && lng <= 21.2;
}

export default function Home() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [mapPickup, setMapPickup] = useState<PlaceSelection | null>(null);
  const [launcherDestination, setLauncherDestination] = useState<PlaceSelection | null>(null);
  const [locationStatus, setLocationStatus] = useState<"checking" | "inside" | "outside" | "unknown">("checking");
  const [currentPickup, setCurrentPickup] = useState<PlaceSelection | null>(null);

  useEffect(() => {
    function onMapTap(event: Event) {
      if (locationStatus === "outside") return;
      const detail = (event as CustomEvent<PlaceSelection>).detail;
      if (detail) setMapPickup(detail);
      setBookingOpen(true);
    }

    function onGoLiveMap() {
      setBookingOpen(false);
      setMapPickup(null);
      setLauncherDestination(null);
    }

    window.addEventListener("taxi-map-tap", onMapTap);
    window.addEventListener("taxi-go-live-map", onGoLiveMap);
    return () => {
      window.removeEventListener("taxi-map-tap", onMapTap);
      window.removeEventListener("taxi-go-live-map", onGoLiveMap);
    };
  }, [locationStatus]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("unknown");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pickup = {
          name: "Current location",
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        setCurrentPickup(pickup);
        setMapPickup(pickup);
        setLocationStatus(isInsideAlbania(pickup.lat, pickup.lng) ? "inside" : "outside");
        window.dispatchEvent(new CustomEvent("taxi-customer-location", { detail: pickup }));
      },
      () => setLocationStatus("unknown"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    if (locationStatus === "outside") setBookingOpen(false);
  }, [locationStatus]);

  return (
    <main className="app-shell">
      <LiveMap initialCustomerLocation={currentPickup} />
      <div className="map-overlay" />
      <TopNav />
      {locationStatus === "outside" && (
        <section className="service-blocker">
          <strong>HopToDrop works only in Albania</strong>
          <span>Your current location is outside our service area.</span>
        </section>
      )}
      {!bookingOpen && locationStatus !== "outside" && (
        <RideLauncher
          onDestinationSelected={(destination) => {
            setLauncherDestination(destination);
            setBookingOpen(true);
          }}
        />
      )}
      <BookingForm
        open={bookingOpen}
        mapPickup={mapPickup}
        initialPickup={currentPickup}
        initialDropoff={launcherDestination}
        onClose={() => setBookingOpen(false)}
      />
      <BottomNav />
    </main>
  );
}
