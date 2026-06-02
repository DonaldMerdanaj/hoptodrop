"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, MapPin, Square, UserRound } from "lucide-react";
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

export default function TripStepPage({ step }: { step: TripStep }) {
  const [pickup, setPickup] = useState<PlaceSelection>(emptyPickup);
  const [dropoff, setDropoff] = useState<PlaceSelection>(emptyDropoff);
  const [pickupTime, setPickupTime] = useState("Pick up now");

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

  const title = step === "pickuptime" ? "Pick-up time" : "Plan your ride";

  return (
    <main className="trip-step-page">
      <header className="trip-step-header">
        <Link href="/" aria-label="Back to map">
          <ArrowLeft size={30} />
        </Link>
        <strong>{title}</strong>
        <Link className="trip-step-login" href="/customer-login">
          <UserRound size={20} fill="currentColor" />
          Log in
        </Link>
      </header>

      <section className="trip-step-chips">
        <button className={step === "pickuptime" ? "active" : ""} type="button" onClick={() => choosePickupTime("Pick up now")}>
          <Clock size={18} fill="currentColor" />
          {pickupTime}
        </button>
        <button type="button">
          <UserRound size={18} fill="currentColor" />
          For me
        </button>
      </section>

      <section className="trip-step-card">
        <div className={`trip-step-field ${step === "pickup" ? "active" : ""}`}>
          <MapPin size={18} fill="currentColor" />
          <PlaceInput
            label="Pickup"
            value={pickup}
            onChange={setPickup}
            onPlaceSelected={selectPickup}
            placeholder="Pick-up location"
          />
        </div>
        <div className={`trip-step-field ${step === "dropoff" ? "active" : ""}`}>
          <Square size={14} fill="currentColor" />
          <PlaceInput
            label="Drop-off"
            value={dropoff}
            onChange={setDropoff}
            onPlaceSelected={selectDropoff}
            placeholder="Drop-off location"
          />
        </div>
      </section>

      {step === "pickup" && (
        <section className="trip-step-options">
          <button type="button">
            <span className="option-icon"><MapPin size={21} /></span>
            <span>
              <strong>Allow location access</strong>
              <small>Use your current position as the pick-up address</small>
            </span>
          </button>
          <button type="button">
            <span className="option-icon"><MapPin size={21} fill="currentColor" /></span>
            <span>
              <strong>Set location on map</strong>
              <small>Choose the exact pick-up point</small>
            </span>
          </button>
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
