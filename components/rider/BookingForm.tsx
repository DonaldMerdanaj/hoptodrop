"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Car, CheckCircle2, Clock3, LocateFixed, MapPin, Navigation, Search, Star } from "lucide-react";
import PlaceInput, { type PlaceSelection } from "@/components/shared/PlaceInput";
import { clearAccountMode } from "@/lib/accountMode";
import { getCurrentUserProfile } from "@/lib/authProfile";
import { getRiderProfile, saveRiderProfile } from "@/lib/riderProfile";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { DriverLocation } from "@/lib/types";

const places = [
  { name: "", lat: 41.3275, lng: 19.8187 },
  { name: "", lat: 41.3194, lng: 19.8157 }
];

type Step = "where" | "driver" | "details" | "assigned" | "arrived" | "started" | "completed";
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
  const [paymentMethod, setPaymentMethod] = useState("Cash");
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
    if (step === "where" || step === "driver") routePreview(pickup, dropoff);
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
      setRiderLoggedIn(Boolean(user && appProfile?.role === "customer"));

      if (user && appProfile?.role === "customer") {
        const profile = await getRiderProfile(user);
        setRiderName((current) => current || profile?.full_name || "");
        setRiderPhone((current) => current || profile?.phone || "");
      }
    }

    checkRiderSession();
    const { data } = supabase.auth.onAuthStateChange(() => {
      getCurrentUserProfile().then(({ user, profile }) => {
        setRiderLoggedIn(Boolean(user && profile?.role === "customer"));
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
    function applyBookingStatus(booking: { status?: string; driver_name?: string | null }) {
      // fix: rider booking sheet now follows the real driver accept/pickup/job-done lifecycle.
      if (booking.status === "accepted") {
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
      }
      if (booking.status === "cancelled") {
        setStep("driver");
        setSelectedDriver(null);
        setBookingId(null);
        setMessage("Driver declined this ride. Please choose another online taxi.");
      }
    }

    async function refreshBookingStatus() {
      const { data } = await client
        .from("bookings")
        .select("status, driver_name")
        .eq("id", bookingId)
        .maybeSingle();
      if (data) applyBookingStatus(data);
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

    // fix: poll booking status as a fallback so riders see accept/pickup/done promptly if realtime lags.
    refreshBookingStatus();
    const statusTimer = window.setInterval(refreshBookingStatus, 2500);

    return () => {
      client.removeChannel(channel);
      window.clearInterval(statusTimer);
    };
  }, [bookingId]);

  if (!open) return null;

  function findDrivers() {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (!pickup.name.trim()) {
      setMessage("Add your pickup location or use current location.");
      return;
    }
    if (!dropoff.name.trim()) {
      setMessage("Choose your destination first.");
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

  function chooseDriver(driver: AvailableDriver) {
    setSelectedDriver(driver);
    setMessage(`${driver.driver_name} selected.`);
  }

  function continueWithDriver() {
    if (!selectedDriver) {
      setMessage("Choose an online taxi first.");
      return;
    }

    setStep("details");
    setMessage(`${selectedDriver.driver_name} selected. Add rider details to request the ride.`);
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
    if (appProfile?.role === "driver") {
      await supabase.auth.signOut();
      clearAccountMode();
      setRiderLoggedIn(false);
      setMessage("Drivers must log out and sign in as a rider to book a ride.");
      router.push("/rider/login");
      return;
    }

    if (!user || appProfile?.role !== "customer") {
      setMessage("Log in as a rider to confirm this ride.");
      console.log("[booking:create:blocked]", {
        route: window.location.pathname,
        userId: user?.id,
        email: user?.email,
        role: appProfile?.role,
        customerId: user?.id,
        driverId: selectedDriver.id
      });
      router.push("/rider/login");
      return;
    }

    setMessage("Requesting ride...");
    // fix: ride confirmation stores the latest rider details in the database profile.
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
      payment_method: paymentMethod,
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
      role: appProfile.role,
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

    setStep("assigned");
    setMessage("Request sent to nearby online taxis. Waiting for a driver to accept.");
  }

  async function completeRide() {
    if (bookingId && isSupabaseConfigured && supabase) {
      await supabase.from("bookings").update({ status: "completed" }).eq("id", bookingId);
    }
    setStep("completed");
    setMessage("Ride completed. Thanks for riding with HopToDrop.");
  }

  function submitStep(event: React.FormEvent) {
    event.preventDefault();
    if (step === "where") findDrivers();
    else if (step === "details") confirmRide();
    else if (step === "started") completeRide();
  }

  const title = {
    where: "Where to?",
    driver: "Choose taxi",
    details: "Request ride",
    assigned: "Driver assigned",
    arrived: "Driver arrived",
    started: "Ride in progress",
    completed: "Ride completed"
  }[step];

  const collapsedTitle = dropoff.name || "Where to?";
  const collapsedSubtitle = pickup.name ? `Pickup: ${pickup.name}` : "Add pickup location";

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
          <b>{selectedDriver ? `${selectedDriver.eta} min` : "--"}</b>
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
          <div className="eta-chip"><Clock3 size={16} /> {selectedDriver ? `${selectedDriver.eta} min` : "--"}</div>
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
              {availableDrivers.map((driver) => (
                <button
                  className={selectedDriver?.id === driver.id ? "driver-pick-card active" : "driver-pick-card"}
                  key={driver.id}
                  type="button"
                  onClick={() => chooseDriver(driver)}
                >
                  <span className="driver-avatar"><Car size={22} /></span>
                  <span className="driver-option-copy">
                    <strong>{driver.driver_name}</strong>
                    <small>{driver.seats} seats - {driver.vehicle || "Taxi"}</small>
                    <small><Star size={12} /> Live taxi - {driver.eta} min pickup</small>
                  </span>
                  <b>EUR {calculateTaxiPrice(tripKm, driver.multiplier).toFixed(2)}</b>
                </button>
              ))}
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
              {selectedDriver ? `Continue with ${selectedDriver.driver_name} - EUR ${estimatedPrice.toFixed(2)}` : "Waiting for online taxi"}
            </button>
            <button className="secondary-btn compact-step-back" type="button" onClick={() => setStep("where")}>Back to location</button>
          </>
        )}

        {step === "details" && selectedDriver && (
          <>
            <div className="trip-summary-card">
              <strong>{selectedDriver.driver_name}</strong>
              <span>{selectedDriver.vehicle || "Taxi"} - {selectedDriver.eta} min away</span>
            </div>
            <div className="quick-grid details-grid">
              <label><span>Name</span><input value={riderName} onChange={(e) => setRiderName(e.target.value)} placeholder="Rider name" /></label>
              <label><span>Phone</span><input value={riderPhone} onChange={(e) => setRiderPhone(e.target.value)} placeholder="+355 ..." /></label>
              <label><span>Passengers</span><input type="number" min={1} max={selectedDriver.seats} value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} /></label>
              <label><span>Payment</span><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option>Cash</option><option>Card</option><option>Wallet</option></select></label>
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
            <button className="primary-btn request-btn" type="submit">
              <CheckCircle2 size={19} />
              Complete ride
            </button>
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
