"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BookingForm from "@/components/rider/BookingForm";
import type { PlaceSelection } from "@/components/shared/PlaceInput";
import RideLauncher from "@/components/rider/RideLauncher";
import TopNav from "@/components/shared/TopNav";
import { getCurrentUserProfile } from "@/lib/authProfile";
import { driverDestination } from "@/lib/driverRouting";
import { reverseGeocodeAddress } from "@/lib/googleMaps";
import { isSupabaseConfigured } from "@/lib/supabase";
import { loadBookingDraft } from "@/lib/tripDraft";

const LiveMap = dynamic(() => import("@/components/rider/LiveMap"), { ssr: false });

function isInsideAlbania(lat: number, lng: number) {
  return lat >= 39.6 && lat <= 42.7 && lng >= 19.0 && lng <= 21.2;
}

export default function Home() {
  const router = useRouter();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [mapPickup, setMapPickup] = useState<PlaceSelection | null>(null);
  const [launcherDestination, setLauncherDestination] = useState<PlaceSelection | null>(null);
  const [locationStatus, setLocationStatus] = useState<"checking" | "inside" | "outside" | "unknown">("checking");
  const [currentPickup, setCurrentPickup] = useState<PlaceSelection | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    async function protectRiderBookingPage() {
      if (!isSupabaseConfigured) {
        setCheckingRole(false);
        return;
      }

      const { user, profile } = await getCurrentUserProfile();
      const isDriverDomain = window.location.hostname === "driver.hoptodrop.com";

      if (isDriverDomain && user && profile?.role === "driver") {
        // fix: only the driver subdomain should auto-open the driver portal; hoptodrop.com must stay rider-facing.
        router.replace(await driverDestination(user.id));
        return;
      }

      if (isDriverDomain && user && profile?.role === "admin") {
        router.replace("/admin");
        return;
      }

      setCheckingRole(false);
    }

    protectRiderBookingPage();
  }, [router]);

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
    if (checkingRole) return;
    if (!navigator.geolocation) {
      setLocationStatus("unknown");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const pickup = {
          // fix: show the rider's current street/address on the main booking card.
          name: await reverseGeocodeAddress(lat, lng),
          lat,
          lng
        };

        setCurrentPickup(pickup);
        setMapPickup(pickup);
        setLocationStatus(isInsideAlbania(pickup.lat, pickup.lng) ? "inside" : "outside");
        window.dispatchEvent(new CustomEvent("taxi-rider-location", { detail: pickup }));
      },
      () => setLocationStatus("unknown"),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, [checkingRole]);

  useEffect(() => {
    if (locationStatus === "outside") setBookingOpen(false);
  }, [locationStatus]);

  useEffect(() => {
    if (checkingRole || locationStatus === "outside") return;
    const draft = loadBookingDraft();
    if (!draft?.reopen) return;

    // fix: after rider login, reopen the booking sheet with the saved form instead of returning to an empty map.
    setMapPickup(draft.pickup);
    setLauncherDestination(draft.dropoff);
    setBookingOpen(true);
  }, [checkingRole, locationStatus]);

  if (checkingRole) {
    return (
      <main className="app-shell">
        <div className="map-empty-state">
          <strong>Checking account...</strong>
          <span>Opening the right HopToDrop app.</span>
        </div>
      </main>
    );
  }

  return (
    <main className={`app-shell ${bookingOpen ? "booking-frame-active" : ""}`}>
      <LiveMap initialRiderLocation={currentPickup} />
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
          initialPickup={currentPickup}
          onTripReady={(pickup, destination) => {
            setMapPickup(pickup);
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
    </main>
  );
}
