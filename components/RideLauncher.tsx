"use client";

import { useEffect, useState } from "react";
import { Clock, Square, UserRound } from "lucide-react";
import PlaceInput, { type PlaceSelection } from "@/components/PlaceInput";

const emptyPickup: PlaceSelection = { name: "", lat: 41.3275, lng: 19.8187 };
const emptyDestination: PlaceSelection = { name: "", lat: 41.3194, lng: 19.8157 };

export default function RideLauncher({
  initialPickup,
  onTripReady
}: {
  initialPickup: PlaceSelection | null;
  onTripReady: (pickup: PlaceSelection, destination: PlaceSelection) => void;
}) {
  const [pickup, setPickup] = useState<PlaceSelection>(initialPickup || emptyPickup);
  const [destination, setDestination] = useState<PlaceSelection>(emptyDestination);

  useEffect(() => {
    if (initialPickup) setPickup(initialPickup);
  }, [initialPickup]);

  function selectDestination(nextDestination: PlaceSelection) {
    setDestination(nextDestination);
    onTripReady(pickup.name ? pickup : emptyPickup, nextDestination);
  }

  return (
    <section className="ride-launcher uber-trip-launcher">
      <h1>Find a trip</h1>
      <div className="uber-route-card launcher-search">
        <span className="uber-route-dot" aria-hidden="true" />
        <PlaceInput
          label="Pickup"
          value={pickup}
          onChange={setPickup}
          placeholder="Pick-up location"
        />
        <span className="uber-route-square" aria-hidden="true">
          <Square size={10} fill="currentColor" />
        </span>
        <PlaceInput
          label="Drop-off"
          value={destination}
          onChange={setDestination}
          onPlaceSelected={selectDestination}
          placeholder="Drop-off location"
        />
      </div>
      <div className="uber-trip-chips">
        <button type="button">
          <Clock size={18} fill="currentColor" />
          Pick up now
        </button>
        <button type="button">
          <UserRound size={18} fill="currentColor" />
          For me
        </button>
      </div>
    </section>
  );
}
