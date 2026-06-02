"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  ChevronDown,
  Clock,
  Crosshair,
  MapPin,
  Navigation,
  Square,
  UserRound
} from "lucide-react";
import PlaceInput, { type PlaceSelection } from "@/components/PlaceInput";
import {
  loadDraftPickupTime,
  loadDraftPlace,
  saveDraftPickupTime,
  saveDraftPlace
} from "@/lib/tripDraft";

type TripStep = "pickup" | "dropoff" | "pickuptime";

const emptyPickup: PlaceSelection = { name: "", lat: 41.3275, lng: 19.8187 };
const emptyDropoff: PlaceSelection = { name: "", lat: 41.3194, lng: 19.8157 };

const recentLocations: PlaceSelection[] = [
  { name: "Memoriali i Pavaresise, Tirane", lat: 41.3238, lng: 19.8166 },
  { name: "Skanderbeg Square, Tirane", lat: 41.3289, lng: 19.8187 }
];

const airportSuggestions: PlaceSelection[] = [
  { name: "Tirana International Airport Nene Tereza", lat: 41.4147, lng: 19.7206 }
];

const popularDestinations: PlaceSelection[] = [
  { name: "Vlore city center", lat: 40.4661, lng: 19.4914 },
  { name: "Durres port", lat: 41.3134, lng: 19.4543 },
  { name: "Sarande promenade", lat: 39.8756, lng: 20.0053 }
];

export default function TripStepPage({ step }: { step: TripStep }) {
  const [pickup, setPickup] = useState<PlaceSelection>(emptyPickup);
  const [dropoff, setDropoff] = useState<PlaceSelection>(emptyDropoff);
  const [pickupTime, setPickupTime] = useState("Pick up now");
  const [activeField, setActiveField] = useState<"pickup" | "dropoff" | null>(
    step === "dropoff" ? "dropoff" : "pickup"
  );

  useEffect(() => {
    setPickup(loadDraftPlace("pickup") || emptyPickup);
    setDropoff(loadDraftPlace("dropoff") || emptyDropoff);
    setPickupTime(loadDraftPickupTime());
  }, []);

  function selectPickup(place: PlaceSelection) {
    setPickup(place);
    saveDraftPlace("pickup", place);
  }

  function selectDropoff(place: PlaceSelection) {
    setDropoff(place);
    saveDraftPlace("dropoff", place);
  }

  function choosePickupTime(value: string) {
    setPickupTime(value);
    saveDraftPickupTime(value);
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition((position) => {
      selectPickup({
        name: "Current location",
        lat: position.coords.latitude,
        lng: position.coords.longitude
      });
    });
  }

  function choosePickupSuggestion(place: PlaceSelection) {
    selectPickup(place);
    setActiveField("dropoff");
  }

  const showPickupHelpers = activeField === "pickup";

  return (
    <main className="trip-step-page">
      <header className="trip-step-header">
        <Link href="/" aria-label="Back to map">
          <ArrowLeft size={28} />
        </Link>
        <strong>Book Your Transfer</strong>
        <Link className="trip-step-login" href="/customer-login">
          <UserRound size={18} fill="currentColor" />
          Account
        </Link>
      </header>

      <section className="trip-step-chips">
        <button className={step === "pickuptime" ? "active" : ""} type="button" onClick={() => choosePickupTime("Pick up now")}>
          <Clock size={18} fill="currentColor" />
          {pickupTime}
          <ChevronDown size={17} />
        </button>
        <button type="button">
          <UserRound size={18} fill="currentColor" />
          For me
          <ChevronDown size={17} />
        </button>
      </section>

      <section className="trip-step-card">
        <div className={`trip-step-field ${activeField === "pickup" ? "active" : ""}`}>
          <span className="trip-field-icon pickup"><MapPin size={18} fill="currentColor" /></span>
          <PlaceInput
            label="Pickup"
            value={pickup}
            onChange={setPickup}
            onPlaceSelected={selectPickup}
            onFocusChange={(focused) => focused && setActiveField("pickup")}
            placeholder="Pickup location"
          />
        </div>
        <div className={`trip-step-field ${activeField === "dropoff" ? "active" : ""}`}>
          <span className="trip-field-icon"><Square size={13} fill="currentColor" /></span>
          <PlaceInput
            label="Dropoff"
            value={dropoff}
            onChange={setDropoff}
            onPlaceSelected={selectDropoff}
            onFocusChange={(focused) => focused && setActiveField("dropoff")}
            placeholder="Dropoff location"
          />
        </div>
      </section>

      {showPickupHelpers && (
        <section className="trip-step-options">
          <button type="button" onClick={useCurrentLocation}>
            <span className="option-icon primary"><Crosshair size={22} /></span>
            <span>
              <strong>Use current location</strong>
              <small>Get your pickup point automatically</small>
            </span>
          </button>
          <Link href="/" className="trip-option-link">
            <span className="option-icon"><Navigation size={21} fill="currentColor" /></span>
            <span>
              <strong>Choose on map</strong>
              <small>Choose the exact pickup point</small>
            </span>
          </Link>
          <TripSuggestionGroup title="Recent locations" places={recentLocations} onSelect={choosePickupSuggestion} />
          <TripSuggestionGroup title="Airport suggestions" places={airportSuggestions} icon="airport" onSelect={choosePickupSuggestion} />
          <TripSuggestionGroup title="Popular destinations" places={popularDestinations} onSelect={choosePickupSuggestion} />
        </section>
      )}

      {step === "pickuptime" && (
        <section className="trip-time-options">
          {["Pick up now", "In 15 min", "In 30 min", "Schedule later"].map((option) => (
            <button
              className={pickupTime === option ? "active" : ""}
              key={option}
              type="button"
              onClick={() => choosePickupTime(option)}
            >
              {option}
            </button>
          ))}
        </section>
      )}

      <Link className="primary-btn trip-step-continue" href="/">
        Continue
      </Link>
    </main>
  );
}

function TripSuggestionGroup({
  title,
  places,
  icon,
  onSelect
}: {
  title: string;
  places: PlaceSelection[];
  icon?: "airport";
  onSelect: (place: PlaceSelection) => void;
}) {
  return (
    <div className="trip-suggestion-group">
      <h2>{title}</h2>
      {places.map((place) => (
        <button key={place.name} type="button" onClick={() => onSelect(place)}>
          <span className="option-icon">
            {icon === "airport" ? <Building2 size={20} /> : <MapPin size={20} fill="currentColor" />}
          </span>
          <span>
            <strong>{place.name}</strong>
            <small>Albania</small>
          </span>
        </button>
      ))}
    </div>
  );
}
