"use client";

import { useEffect, useState } from "react";
import { Square } from "lucide-react";
import { useRouter } from "next/navigation";
import type { PlaceSelection } from "@/components/shared/PlaceInput";
import { loadDraftPlace } from "@/lib/tripDraft";

const emptyPickup: PlaceSelection = { name: "", lat: 41.3275, lng: 19.8187 };
const emptyDestination: PlaceSelection = { name: "", lat: 41.3194, lng: 19.8157 };

export default function RideLauncher({
  initialPickup,
  onTripReady
}: {
  initialPickup: PlaceSelection | null;
  onTripReady: (pickup: PlaceSelection, destination: PlaceSelection) => void;
}) {
  const router = useRouter();
  const [pickup, setPickup] = useState<PlaceSelection>(initialPickup || emptyPickup);
  const [destination, setDestination] = useState<PlaceSelection>(emptyDestination);

  useEffect(() => {
    const savedPickup = loadDraftPlace("pickup");
    const savedDropoff = loadDraftPlace("dropoff");

    if (savedPickup) setPickup(savedPickup);
    else if (initialPickup) setPickup(initialPickup);
    if (savedDropoff) setDestination(savedDropoff);
  }, [initialPickup]);

  function startTripSearch() {
    if (!destination.name) {
      router.push("/dropoff");
      return;
    }

    onTripReady(pickup.name ? pickup : emptyPickup, destination);
  }

  return (
    <section className="ride-launcher uber-trip-launcher">
      <h1>Find a trip</h1>
      <div className="uber-route-card launcher-search">
        <span className="uber-route-dot" aria-hidden="true" />
        <button className="uber-location-button" type="button" onClick={() => router.push("/pickup")}>
          <span>{pickup.name || "Pick-up location"}</span>
        </button>
        <span className="uber-route-square" aria-hidden="true">
          <Square size={10} fill="currentColor" />
        </span>
        <button className="uber-location-button muted" type="button" onClick={() => router.push("/dropoff")}>
          <span>{destination.name || "Drop-off location"}</span>
        </button>
      </div>
      <button className="primary-btn launcher-submit" type="button" onClick={startTripSearch}>
        Find taxis
      </button>
    </section>
  );
}
