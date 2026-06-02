"use client";

import type { PlaceSelection } from "@/components/PlaceInput";

const pickupKey = "hoptodrop_trip_pickup";
const dropoffKey = "hoptodrop_trip_dropoff";
const pickupTimeKey = "hoptodrop_trip_pickup_time";

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const value = window.sessionStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export function loadDraftPlace(kind: "pickup" | "dropoff") {
  return readJson<PlaceSelection>(kind === "pickup" ? pickupKey : dropoffKey);
}

export function saveDraftPlace(kind: "pickup" | "dropoff", place: PlaceSelection) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(kind === "pickup" ? pickupKey : dropoffKey, JSON.stringify(place));
}

export function loadDraftPickupTime() {
  if (typeof window === "undefined") return "Pick up now";
  return window.sessionStorage.getItem(pickupTimeKey) || "Pick up now";
}

export function saveDraftPickupTime(value: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(pickupTimeKey, value);
}
