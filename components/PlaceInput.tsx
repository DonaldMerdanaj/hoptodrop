"use client";

import { useEffect, useRef } from "react";
import { loadGoogleMaps } from "@/lib/googleMaps";

export type PlaceSelection = {
  name: string;
  lat: number;
  lng: number;
  placeId?: string;
};

type PlaceInputProps = {
  label: string;
  value: PlaceSelection;
  onChange: (place: PlaceSelection) => void;
  onPlaceSelected?: (place: PlaceSelection) => void;
  placeholder: string;
};

export default function PlaceInput({ label, value, onChange, onPlaceSelected, placeholder }: PlaceInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let listener: { remove: () => void } | null = null;

    loadGoogleMaps()
      .then((maps) => {
        if (!inputRef.current || !maps.places?.Autocomplete) return;

        const autocomplete = new maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: "al" },
          fields: ["formatted_address", "geometry", "name", "place_id"],
          strictBounds: false
        });

        listener = autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          const location = place.geometry?.location;
          if (!location) return;

          const selection = {
            name: place.formatted_address || place.name || inputRef.current?.value || "",
            lat: location.lat(),
            lng: location.lng(),
            placeId: place.place_id
          };

          onChange(selection);
          onPlaceSelected?.(selection);
        });
      })
      .catch(() => {
        // Demo mode keeps the input usable until a real Google key is added.
      });

    return () => {
      listener?.remove();
    };
  }, [onChange]);

  return (
    <label>
      <span>{label}</span>
      <input
        ref={inputRef}
        value={value.name}
        onChange={(event) => onChange({ ...value, name: event.target.value })}
        placeholder={placeholder}
        required
      />
    </label>
  );
}
