"use client";

import type { PlaceSelection } from "@/components/shared/PlaceInput";

const pickupKey = "hoptodrop_trip_pickup";
const dropoffKey = "hoptodrop_trip_dropoff";
const pickupTimeKey = "hoptodrop_trip_pickup_time";
const bookingDraftKey = "hoptodrop_booking_draft";

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

export type BookingDraft = {
  pickup: PlaceSelection;
  dropoff: PlaceSelection;
  riderName: string;
  riderPhone: string;
  passengers: number;
  reopen: boolean;
  savedAt: number;
};

export function saveBookingDraft(draft: Omit<BookingDraft, "savedAt">) {
  if (typeof window === "undefined") return;
  // fix: preserve the booking form through rider login so users do not restart after authentication.
  window.sessionStorage.setItem(bookingDraftKey, JSON.stringify({ ...draft, savedAt: Date.now() }));
  saveDraftPlace("pickup", draft.pickup);
  saveDraftPlace("dropoff", draft.dropoff);
}

export function loadBookingDraft() {
  const draft = readJson<BookingDraft>(bookingDraftKey);
  if (!draft) return null;
  const oneHour = 60 * 60 * 1000;
  if (Date.now() - draft.savedAt > oneHour) {
    clearBookingDraft();
    return null;
  }
  return draft;
}

export function clearBookingDraft() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(bookingDraftKey);
}
