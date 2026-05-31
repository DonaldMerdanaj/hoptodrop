"use client";

import { useState } from "react";
import { CarFront, Search } from "lucide-react";
import PlaceInput, { type PlaceSelection } from "@/components/PlaceInput";

const emptyDestination: PlaceSelection = { name: "", lat: 41.3275, lng: 19.8187 };

export default function RideLauncher({ onDestinationSelected }: { onDestinationSelected: (destination: PlaceSelection) => void }) {
  const [destination, setDestination] = useState<PlaceSelection>(emptyDestination);

  return (
    <section className="ride-launcher simple-launcher">
      <div className="where-to-pill launcher-search">
        <Search size={22} />
        <PlaceInput
          label="Destination"
          value={destination}
          onChange={setDestination}
          onPlaceSelected={onDestinationSelected}
          placeholder="Where to?"
        />
        <CarFront size={23} />
      </div>
    </section>
  );
}
