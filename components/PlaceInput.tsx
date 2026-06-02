"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";
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
  onFocusChange?: (focused: boolean) => void;
  placeholder: string;
};

type Suggestion = {
  placeId: string;
  mainText: string;
  secondaryText: string;
  description: string;
};

export default function PlaceInput({ label, value, onChange, onPlaceSelected, onFocusChange, placeholder }: PlaceInputProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const placesNodeRef = useRef<HTMLDivElement | null>(null);
  const sessionTokenRef = useRef<any>(null);
  const requestIdRef = useRef(0);
  const [mapsApi, setMapsApi] = useState<any>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadGoogleMaps()
      .then((maps) => {
        setMapsApi(maps);
        sessionTokenRef.current = new maps.places.AutocompleteSessionToken();
      })
      .catch(() => {
        // Google autocomplete stays optional until a Maps key is configured.
      });
  }, []);

  useEffect(() => {
    if (!mapsApi?.places?.AutocompleteService || !focused || value.name.trim().length < 2) {
      setSuggestions([]);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const service = new mapsApi.places.AutocompleteService();
    setLoading(true);

    const timer = window.setTimeout(() => {
      service.getPlacePredictions(
        {
          input: value.name,
          componentRestrictions: { country: "al" },
          sessionToken: sessionTokenRef.current
        },
        (predictions: any[] | null, status: string) => {
          if (requestIdRef.current !== requestId) return;
          setLoading(false);

          if (status !== mapsApi.places.PlacesServiceStatus.OK || !predictions) {
            setSuggestions([]);
            return;
          }

          setSuggestions(predictions.slice(0, 5).map((prediction) => ({
            placeId: prediction.place_id,
            mainText: prediction.structured_formatting?.main_text || prediction.description,
            secondaryText: prediction.structured_formatting?.secondary_text || "",
            description: prediction.description
          })));
        }
      );
    }, 160);

    return () => window.clearTimeout(timer);
  }, [focused, mapsApi, value.name]);

  function selectSuggestion(suggestion: Suggestion) {
    if (!mapsApi || !placesNodeRef.current) return;

    const service = new mapsApi.places.PlacesService(placesNodeRef.current);
    service.getDetails(
      {
        placeId: suggestion.placeId,
        fields: ["formatted_address", "geometry", "name", "place_id"],
        sessionToken: sessionTokenRef.current
      },
      (place: any, status: string) => {
        const location = place?.geometry?.location;
        if (status !== mapsApi.places.PlacesServiceStatus.OK || !location) return;

        const selection = {
          name: place.formatted_address || place.name || suggestion.description,
          lat: location.lat(),
          lng: location.lng(),
          placeId: place.place_id || suggestion.placeId
        };

        onChange(selection);
        onPlaceSelected?.(selection);
        setSuggestions([]);
        setFocused(false);
        sessionTokenRef.current = new mapsApi.places.AutocompleteSessionToken();
        inputRef.current?.blur();
      }
    );
  }

  return (
    <label className="place-input">
      <span>{label}</span>
      <input
        ref={inputRef}
        value={value.name}
        onChange={(event) => onChange({ ...value, name: event.target.value })}
        onFocus={() => {
          setFocused(true);
          onFocusChange?.(true);
        }}
        onBlur={() => window.setTimeout(() => {
          setFocused(false);
          onFocusChange?.(false);
        }, 140)}
        placeholder={placeholder}
        autoComplete="off"
        required
      />
      {focused && (suggestions.length > 0 || loading) && (
        <div className="place-suggestions" role="listbox">
          {loading && <div className="place-suggestion muted">Searching Albania...</div>}
          {!loading && suggestions.map((suggestion) => (
            <button
              className="place-suggestion"
              key={suggestion.placeId}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => selectSuggestion(suggestion)}
            >
              <MapPin size={17} />
              <span>
                <strong>{suggestion.mainText}</strong>
                {suggestion.secondaryText && <small>{suggestion.secondaryText}</small>}
              </span>
            </button>
          ))}
        </div>
      )}
      <div ref={placesNodeRef} className="places-service-node" />
    </label>
  );
}
