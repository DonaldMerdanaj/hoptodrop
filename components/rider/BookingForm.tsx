"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Car, CheckCircle2, Clock3, LocateFixed, MapPin, Navigation, Search } from "lucide-react";
import PlaceInput, { type PlaceSelection } from "@/components/shared/PlaceInput";
import { getCurrentUserProfile } from "@/lib/authProfile";
import { getRiderProfile, saveRiderProfile } from "@/lib/riderProfile";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { DriverLocation } from "@/lib/types";

const places = [
  { name: "", lat: 41.3275, lng: 19.8187 },
  { name: "", lat: 41.3194, lng: 19.8157 }
];

type Step = "where" | "driver" | "details" | "requested" | "assigned" | "arrived" | "started" | "completed";
type AvailableDriver = DriverLocation & {
  eta: number;
  rideClass: string;
  multiplier: number;
  seats: number;
};

function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateTaxiPrice(distance: number, multiplier = 1) {
  const minimumFare = 4;
  const includedKm = 3;
  const extraKmRate = 0.9;
  const baseFare = distance <= includedKm ? minimumFare : minimumFare + (distance - includedKm) * extraKmRate;
  return baseFare * multiplier;
}

function driverEtaMinutes(driver: DriverLocation, pickup: PlaceSelection) {
  const kmToPickup = distanceKm(driver.lat, driver.lng, pickup.lat, pickup.lng);
  return Math.max(2, Math.round(kmToPickup * 3));
}

function normalizeDriver(driver: DriverLocation, pickup: PlaceSelection): AvailableDriver {
  return {
    ...driver,
    eta: driverEtaMinutes(driver, pickup),
    rideClass: "Taxi",
    multiplier: 1,
    seats: 4
  };
}

function routePreview(origin: PlaceSelection, destination: PlaceSelection) {
  window.dispatchEvent(new CustomEvent("taxi-route-preview", {
    detail: { pickup: origin, dropoff: destination }
  }));
}

export default function BookingForm({
  open,
  mapPickup,
  initialPickup,
  initialDropoff,
  onClose
}: {
  open: boolean;
  mapPickup: PlaceSelection | null;
  initialPickup: PlaceSelection | null;
  initialDropoff: PlaceSelection | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("where");
  const [pickup, setPickup] = useState<PlaceSelection>(places[0]);
  const [dropoff, setDropoff] = useState<PlaceSelection>(places[1]);
  const [availableDrivers, setAvailableDrivers] = useState<AvailableDriver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<AvailableDriver | null>(null);
  const [riderName, setRiderName] = useState("");
  const [riderPhone, setRiderPhone] = useState("");
  const [passengers, setPassengers] = useState(1);
  const paymentMethod = "Cash";
  const [typingMode, setTypingMode] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [message, setMessage] = useState("");
  const [locatingPickup, setLocatingPickup] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [riderLoggedIn, setRiderLoggedIn] = useState(false);
  const dragStartY = useRef<number | null>(null);

  const tripKm = distanceKm(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
  const estimatedPrice = useMemo(() => {
    return Number(calculateTaxiPrice(tripKm, selectedDriver?.multiplier || 1).toFixed(2));
  }, [selectedDriver?.multiplier, tripKm]);

  useEffect(() => {
    const hasValidRoute = [pickup.lat, pickup.lng, dropoff.lat, dropoff.lng].every(Number.isFinite);
    if ((step === "where" || step === "driver") && hasValidRoute) routePreview(pickup, dropoff);
    if ((step === "details" || step === "assigned") && selectedDriver) {
      routePreview(
        { name: `${selectedDriver.driver_name} location`, lat: selectedDriver.lat, lng: selectedDriver.lng },
        pickup
      );
    }
    if (step === "started") routePreview(pickup, dropoff);
  }, [pickup, dropoff, selectedDriver, step]);

  useEffect(() => {
    if (mapPickup) setPickup(mapPickup);
  }, [mapPickup]);

  useEffect(() => {
    if (initialPickup) setPickup(initialPickup);
  }, [initialPickup]);

  useEffect(() => {
    if (initialDropoff) setDropoff(initialDropoff);
  }, [initialDropoff]);

  useEffect(() => {
    if (open) {
      setStep("where");
      setCollapsed(false);
      setMessage("");
      setBookingId(null);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !isSupabaseConfigured || !supabase) return;

    async function checkRiderSession() {
      const { user, profile: appProfile } = await getCurrentUserProfile();
      // fix: a signed-in driver can also ride; only admin accounts are excluded from rider booking.
      setRiderLoggedIn(Boolean(user && appProfile?.role !== "admin"));

      if (user && appProfile?.role !== "admin") {
        // fix: preload rider details for both rider-only accounts and approved drivers booking off duty.
        const profile = await getRiderProfile(user);
        setRiderName((current) => current || profile?.full_name || "");
        setRiderPhone((current) => current || profile?.phone || "");
      }
    }

    checkRiderSession();
    const { data } = supabase.auth.onAuthStateChange(() => {
      getCurrentUserProfile().then(({ user, profile }) => {
        // fix: rider login state reflects booking permission, not only the profile.role value.
        setRiderLoggedIn(Boolean(user && profile?.role !== "admin"));
      });
    });

    return () => data.subscription.unsubscribe();
  }, [open]);

  useEffect(() => {
    if (!open || !isSupabaseConfigured || !supabase) return;

    const client = supabase;

    async function loadOnlineDrivers() {
      // fix: booking form now uses real online drivers from Supabase instead of example taxis.
      const { data, error } = await client
        .from("driver_locations")
        .select("*")
        .eq("status", "online")
        .order("updated_at", { ascending: false });

      if (error) {
        setMessage(error.message);
        return;
      }

      const drivers = (data || []).map((driver) => normalizeDriver(driver as DriverLocation, pickup));
      setAvailableDrivers(drivers);
      setSelectedDriver((current) => {
        if (!drivers.length) return null;
        if (!current) return drivers[0];
        return drivers.find((driver) => driver.id === current.id) || drivers[0];
      });
    }

    loadOnlineDrivers();

    const channel = client
      .channel("booking-online-drivers")
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_locations" }, loadOnlineDrivers)
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [open, pickup]);

  useEffect(() => {
    if (!bookingId || !isSupabaseConfigured || !supabase) return;

    const client = supabase;
    function applyBookingStatus(booking: {
      status?: string;
      driver_id?: string | null;
      driver_name?: string | null;
      driver_vehicle?: string | null;
      driver_eta?: number | null;
    }) {
      // fix: rider booking sheet now follows the real driver accept/pickup/job-done lifecycle.
      if (booking.status === "accepted") {
        if (booking.driver_id) {
          setSelectedDriver((current) => ({
            id: booking.driver_id!,
            driver_name: booking.driver_name || "Your driver",
            vehicle: booking.driver_vehicle || "Taxi",
            status: "busy",
            lat: current && current.id === booking.driver_id ? current.lat : pickup.lat,
            lng: current && current.id === booking.driver_id ? current.lng : pickup.lng,
            updated_at: new Date().toISOString(),
            eta: booking.driver_eta || current?.eta || 5,
            rideClass: "Taxi",
            multiplier: 1,
            seats: 4
          }));
        }
        setStep("assigned");
        setMessage(`${booking.driver_name || "Your driver"} accepted and is driving to pickup.`);
      }
      if (booking.status === "arrived") {
        setStep("arrived");
        setMessage(`${booking.driver_name || "Your driver"} has arrived at pickup.`);
      }
      if (booking.status === "started") {
        setStep("started");
        setMessage("Rider picked up. Ride is in progress.");
      }
      if (booking.status === "completed") {
        setStep("completed");
        setMessage("Ride completed. Thanks for riding with HopToDrop.");
        window.dispatchEvent(new Event("taxi-clear-active-driver"));
      }
      if (booking.status === "cancelled") {
        setStep("driver");
        setSelectedDriver(null);
        setBookingId(null);
        setMessage("Driver declined this ride. Please choose another online taxi.");
        window.dispatchEvent(new Event("taxi-clear-active-driver"));
      }
    }

    async function refreshBookingStatus() {
      const { data } = await client
        .from("bookings")
        .select("status, driver_id, driver_name, driver_vehicle, driver_eta")
        .eq("id", bookingId)
        .maybeSingle();
      if (data) applyBookingStatus(data);
    }

    async function refreshDriverLocation() {
      const { data } = await client
        .from("booking_route_points")
        .select("lat,lng")
        .eq("booking_id", bookingId)
        .order("recorded_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return;
      window.dispatchEvent(new CustomEvent("taxi-active-driver-location", { detail: data }));
    }

    const channel = client
      .channel(`customer-booking-${bookingId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        (payload) => {
          applyBookingStatus(payload.new as { status?: string; driver_name?: string | null });
        }
      )
      .subscribe();

    const routeChannel = client
      .channel(`customer-route-${bookingId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "booking_route_points", filter: `booking_id=eq.${bookingId}` },
        (payload) => {
          const point = payload.new as { lat?: number; lng?: number };
          if (typeof point.lat !== "number" || typeof point.lng !== "number") return;
          window.dispatchEvent(new CustomEvent("taxi-active-driver-location", {
            detail: { lat: point.lat, lng: point.lng }
          }));
        }
      )
      .subscribe();

    // fix: poll booking status as a fallback so riders see accept/pickup/done promptly if realtime lags.
    refreshBookingStatus();
    refreshDriverLocation();
    const statusTimer = window.setInterval(refreshBookingStatus, 2500);

    return () => {
      client.removeChannel(channel);
      client.removeChannel(routeChannel);
      window.clearInterval(statusTimer);
    };
  }, [bookingId, pickup.lat, pickup.lng]);

  if (!open) return null;

  function findDrivers() {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (!pickup.name.trim()) {
      setMessage("Add your pickup location or use current location.");
      return;
    }
    if (!Number.isFinite(pickup.lat) || !Number.isFinite(pickup.lng)) {
      setMessage("Select a pickup suggestion or use current location.");
      return;
    }
    if (!dropoff.name.trim()) {
      setMessage("Choose your destination first.");
      return;
    }
    if (!Number.isFinite(dropoff.lat) || !Number.isFinite(dropoff.lng)) {
      setMessage("Select a destination from the suggestions.");
      return;
    }

    setTypingMode(false);
    setStep("driver");

    if (availableDrivers.length === 0) {
      setSelectedDriver(null);
      setMessage("No taxis are available nearby right now. Please try again in a few minutes.");
      return;
    }

    setSelectedDriver((current) => current || availableDrivers[0]);
    setMessage("Online taxis found.");
  }

  async function useCurrentPickup() {
    setMessage("");
    if (!navigator.geolocation) {
      setMessage("Current location is not available in this browser.");
      return;
    }

    setLocatingPickup(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const fallback = {
          name: "Current location",
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };

        try {
          const maps = await loadGoogleMaps();
          const geocoder = new maps.Geocoder();
          geocoder.geocode({ location: { lat: fallback.lat, lng: fallback.lng } }, (results: any[], status: string) => {
            setPickup({
              ...fallback,
              name: status === "OK" && results?.[0]?.formatted_address ? results[0].formatted_address : fallback.name
            });
            setLocatingPickup(false);
          });
        } catch {
          setPickup(fallback);
          setLocatingPickup(false);
        }
      },
      () => {
        setMessage("Allow location access to use current pickup.");
        setLocatingPickup(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  function continueWithDriver() {
    if (!selectedDriver) {
      setMessage("No online taxi is available right now.");
      return;
    }

    setStep("details");
    setMessage("Add rider details to request the first available nearby taxi.");
  }

  async function confirmRide() {
    if (!selectedDriver) {
      setMessage("Choose an online taxi first.");
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setMessage("Supabase is required to confirm a real ride.");
      return;
    }

    const { user, profile: appProfile } = await getCurrentUserProfile();
    if (!user) {
      setMessage("Log in as a rider to confirm this ride.");
      console.log("[booking:create:blocked]", {
        route: window.location.pathname,
        // fix: unauthenticated booking debug logs use explicit nulls so TypeScript does not narrow user to never.
        userId: null,
        email: null,
        role: null,
        customerId: null,
        driverId: selectedDriver.id
      });
      router.push("/rider/login");
      return;
    }

    if (appProfile?.role === "admin") {
      setMessage("Admin accounts cannot create rider bookings from this screen.");
      return;
    }

    setMessage("Requesting ride...");
    // fix: driver accounts can book while off duty; ride details are stored in the rider profile.
    const profile = user
      ? await saveRiderProfile(user, { full_name: riderName, phone: riderPhone })
      : null;
    const finalRiderName = riderName || profile?.full_name || "HopToDrop rider";
    const finalRiderPhone = riderPhone || profile?.phone || "+355";

    const booking = {
      customer_id: null,
      customer_name: finalRiderName,
      customer_phone: finalRiderPhone,
      pickup: pickup.name,
      dropoff: dropoff.name,
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      dropoff_lat: dropoff.lat,
      dropoff_lng: dropoff.lng,
      pickup_time: new Date().toISOString(),
      passengers,
      luggage: "Not required",
      vehicle_type: selectedDriver.vehicle || "Taxi",
      ride_class: selectedDriver.rideClass,
      payment_method: "Cash",
      driver_id: null,
      driver_name: null,
      driver_vehicle: null,
      driver_eta: selectedDriver.eta,
      estimated_price: estimatedPrice
    };

    console.log("[booking:create]", {
      route: window.location.pathname,
      userId: user.id,
      email: user.email,
      role: appProfile?.role || "customer",
      customerId: user.id,
      driverId: null
    });

    const { data, error } = await supabase
      .from("bookings")
      .insert({ ...booking, customer_id: user.id, status: "pending" })
      .select("id, status")
      .single();

    if (error) {
      setMessage(error.message);
      return;
    }

    setBookingId(data?.id || null);

    setStep("requested");
    setMessage("Request sent to nearby online taxis. Waiting for a driver to accept.");
  }

  function submitStep(event: React.FormEvent) {
    event.preventDefault();
    if (step === "where") findDrivers();
    else if (step === "details") confirmRide();
  }

  const title = {
    where: "Where to?",
    driver: "Choose taxi",
    details: "Request ride",
    requested: "Request sent",
    assigned: "Driver assigned",
    arrived: "Driver arrived",
    started: "Ride in progress",
    completed: "Ride completed"
  }[step];

  const collapsedTitle = dropoff.name || "Where to?";
  const collapsedSubtitle = pickup.name ? `Pickup: ${pickup.name}` : "Add pickup location";
  const canShowDriverEta = Boolean(selectedDriver && pickup.name.trim() && dropoff.name.trim());
  const etaLabel = canShowDriverEta && selectedDriver ? `${selectedDriver.eta} min` : "";

  function startSheetDrag(event: React.PointerEvent<HTMLElement>) {
    dragStartY.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function endSheetDrag(event: React.PointerEvent<HTMLElement>) {
    if (dragStartY.current === null) return;

    const dragDistance = event.clientY - dragStartY.current;
    if (dragDistance > 45) setCollapsed(true);
    if (dragDistance < -35) setCollapsed(false);
    dragStartY.current = null;
  }

  if (collapsed) {
    return (
      <section className="ride-sheet minimized" onPointerDown={startSheetDrag} onPointerUp={endSheetDrag}>
        <button className="sheet-drag-handle" type="button" aria-label="Expand booking form" onClick={() => setCollapsed(false)} />
        <button className="minimized-sheet" type="button" onClick={() => setCollapsed(false)}>
          <Search size={21} />
          <span>
            <strong>{collapsedTitle}</strong>
            <small>{collapsedSubtitle}</small>
          </span>
          {etaLabel && <b>{etaLabel}</b>}
        </button>
      </section>
    );
  }

  return (
    <section className={`${typingMode ? "ride-sheet typing-mode" : "ride-sheet"} step-${step}`}>
      <button
        className="sheet-drag-handle"
        type="button"
        aria-label="Minimize booking form"
        onPointerDown={startSheetDrag}
        onPointerUp={endSheetDrag}
        onClick={() => setCollapsed(true)}
      />
      <div className="sheet-header compact-header">
        <div>
          <span className="eyebrow">{step === "where" ? "Location" : step === "driver" ? "Taxi" : step === "details" ? "Details" : "Live trip"}</span>
          <h1>{title}</h1>
        </div>
        <div className="sheet-actions">
          {etaLabel && <div className="eta-chip"><Clock3 size={16} /> {etaLabel}</div>}
          <button className="icon-close" type="button" onClick={onClose} aria-label="Close booking form">x</button>
        </div>
      </div>

      <form
        className="ride-form"
        onSubmit={submitStep}
        onFocusCapture={(event) => {
          if ((event.target as HTMLElement).matches("input, select, textarea")) setTypingMode(true);
        }}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setTypingMode(false);
        }}
      >
        {step === "where" && (
          <>
            <div className="route-card">
              <div className="route-dot start" />
              <div className="pickup-field">
                <PlaceInput label="Pickup" value={pickup} onChange={setPickup} placeholder="Pickup location" />
                <button className="current-location-btn" type="button" onClick={useCurrentPickup}>
                  <LocateFixed size={15} />
                  {locatingPickup ? "Locating..." : "Use current location"}
                </button>
              </div>
              <div className="route-line" />
              <div className="route-dot end" />
              <PlaceInput label="Destination" value={dropoff} onChange={setDropoff} placeholder="Where to?" />
            </div>
            <button className="primary-btn request-btn" type="submit">
              <Search size={19} />
              Find taxis
            </button>
          </>
        )}

        {step === "driver" && (
          <>
            <div className="fare-box">
              <div><span>{tripKm.toFixed(1)} km trip</span><strong>Choose your ride</strong></div>
              <div><span>From</span><strong>EUR {calculateTaxiPrice(tripKm).toFixed(2)}</strong></div>
            </div>
            <div className="driver-pick-list">
              {selectedDriver && (
                <div className="driver-pick-card active">
                  <span className="driver-avatar"><Car size={22} /></span>
                  <span className="driver-option-copy">
                    <strong>First available taxi</strong>
                    <small>{availableDrivers.length} online nearby</small>
                    <small>Estimated pickup in {selectedDriver.eta} min</small>
                  </span>
                  <b>EUR {calculateTaxiPrice(tripKm).toFixed(2)}</b>
                </div>
              )}
              {availableDrivers.length === 0 && (
                <div className="trip-status-card">
                  <Clock3 size={22} />
                  <div>
                    <strong>No online taxis</strong>
                    <span>No taxis are available nearby right now. Please try again in a few minutes.</span>
                  </div>
                </div>
              )}
            </div>
            <button className="primary-btn request-btn" type="button" onClick={continueWithDriver} disabled={!selectedDriver}>
              <Car size={19} />
              {selectedDriver ? `Request taxi - EUR ${estimatedPrice.toFixed(2)}` : "Waiting for online taxi"}
            </button>
            <button className="secondary-btn compact-step-back" type="button" onClick={() => setStep("where")}>Back to location</button>
          </>
        )}

        {step === "details" && selectedDriver && (
          <>
            <div className="trip-summary-card">
              <strong>First available nearby taxi</strong>
              <span>Estimated pickup in {selectedDriver.eta} min</span>
            </div>
            <div className="quick-grid details-grid">
              <label><span>Name</span><input value={riderName} onChange={(e) => setRiderName(e.target.value)} placeholder="Rider name" /></label>
              <label><span>Phone</span><input value={riderPhone} onChange={(e) => setRiderPhone(e.target.value)} placeholder="+355 ..." /></label>
              <label><span>Passengers</span><input type="number" min={1} max={selectedDriver.seats} value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} /></label>
              <label><span>Payment</span><input value="Cash" readOnly /></label>
            </div>
            <div className="fare-box">
              <div><span>{tripKm.toFixed(1)} km trip</span><strong>EUR {estimatedPrice.toFixed(2)}</strong></div>
              <div><span>Route</span><strong>Driver to pickup</strong></div>
            </div>
            <button className="primary-btn request-btn" type="submit">
              <MapPin size={19} />
              {riderLoggedIn ? "Confirm ride" : "Log in to confirm ride"}
            </button>
            <button className="secondary-btn compact-step-back" type="button" onClick={() => setStep("driver")}>Back to taxis</button>
          </>
        )}

        {step === "requested" && (
          <div className="trip-status-card">
            <Clock3 size={22} />
            <div>
              <strong>Waiting for a driver</strong>
              <span>Your request was sent to approved online taxis nearby.</span>
            </div>
          </div>
        )}

        {step === "assigned" && (
          <>
            <div className="trip-status-card">
              <Navigation size={22} />
              <div>
                <strong>{selectedDriver ? `${selectedDriver.driver_name} assigned` : "Driver assigned"}</strong>
                <span>Your driver is on the way to the pickup point.</span>
              </div>
            </div>
          </>
        )}

        {step === "arrived" && (
          <>
            <div className="trip-status-card">
              <MapPin size={22} />
              <div>
                <strong>Your driver has arrived</strong>
                <span>Meet the driver at the pickup point. The trip starts after pickup.</span>
              </div>
            </div>
          </>
        )}

        {step === "started" && (
          <>
            <div className="trip-status-card">
              <Navigation size={22} />
              <div>
                <strong>Ride started</strong>
                <span>Map now shows the route to destination.</span>
              </div>
            </div>
            <p className="status-message">Your driver will complete the ride after drop-off.</p>
          </>
        )}

        {step === "completed" && (
          <div className="trip-status-card completed">
            <CheckCircle2 size={24} />
            <div>
              <strong>Ride completed</strong>
              <span>EUR {estimatedPrice.toFixed(2)} - {paymentMethod}</span>
            </div>
          </div>
        )}

        {message && <p className="status-message">{message}</p>}
      </form>
    </section>
  );
}
