"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import BookingForm from "@/components/BookingForm";
import type { PlaceSelection } from "@/components/PlaceInput";
import RideLauncher from "@/components/RideLauncher";
import TopNav from "@/components/TopNav";

const LiveMap = dynamic(() => import("@/components/LiveMap"), { ssr: false });

export default function Home() {
  const [bookingOpen, setBookingOpen] = useState(false);
  const [mapPickup, setMapPickup] = useState<PlaceSelection | null>(null);

  useEffect(() => {
    function onMapTap(event: Event) {
      const detail = (event as CustomEvent<PlaceSelection>).detail;
      if (detail) setMapPickup(detail);
      setBookingOpen(true);
    }

    function onGoLiveMap() {
      setBookingOpen(false);
      setMapPickup(null);
    }

    window.addEventListener("taxi-map-tap", onMapTap);
    window.addEventListener("taxi-go-live-map", onGoLiveMap);
    return () => {
      window.removeEventListener("taxi-map-tap", onMapTap);
      window.removeEventListener("taxi-go-live-map", onGoLiveMap);
    };
  }, []);

  return (
    <main className="app-shell">
      <LiveMap />
      <div className="map-overlay" />
      <TopNav />
      {!bookingOpen && <RideLauncher onRequestRide={() => setBookingOpen(true)} />}
      <BookingForm open={bookingOpen} mapPickup={mapPickup} onClose={() => setBookingOpen(false)} />
      <BottomNav />
    </main>
  );
}
