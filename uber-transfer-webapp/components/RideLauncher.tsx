"use client";

import { CarFront, Search } from "lucide-react";

export default function RideLauncher({ onRequestRide }: { onRequestRide: () => void }) {
  return (
    <section className="ride-launcher simple-launcher">
      <button className="where-to-pill" type="button" onClick={onRequestRide}>
        <Search size={22} />
        <span>Where to?</span>
        <CarFront size={23} />
      </button>
    </section>
  );
}
