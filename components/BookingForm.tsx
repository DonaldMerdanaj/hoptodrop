"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Car, CheckCircle2, Clock3, LocateFixed, MapPin, Navigation, Phone, Search, Star } from "lucide-react";
import PlaceInput, { type PlaceSelection } from "@/components/PlaceInput";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const places = [
  { name: "", lat: 41.3275, lng: 19.8187 },
  { name: "", lat: 41.3194, lng: 19.8157 }
];

const nearbyDrivers = [
  { name: "Arben Hoxha", vehicle: "Toyota Corolla", plate: "AA 482 PT", eta: 2, rating: "4.94", lat: 41.3312, lng: 19.8161, rideClass: "Taxi", multiplier: 1, seats: 4 },
  { name: "Mira Duka", vehicle: "Hyundai Ioniq", plate: "TR 219 EL", eta: 4, rating: "4.91", lat: 41.3238, lng: 19.8242, rideClass: "Comfort", multiplier: 1.35, seats: 4 },
  { name: "Sara Kola", vehicle: "VW Touran XL", plate: "VL 044 TX", eta: 6, rating: "4.88", lat: 41.3359, lng: 19.8079, rideClass: "XL", multiplier: 1.65, seats: 6 }
];

type Step = "where" | "driver" | "details" | "assigned" | "started" | "completed";

const routePrices: Record<string, number> = {
  "tirana airport-tirana city center": 45,
  "tirana airport-durrës": 50,
  "tirana airport-durres": 50,
  "tirana airport-saranda": 110,
  "tirana airport-vlora": 85,
  "tirana airport-berat": 70,
  "tirana airport-shkoder": 75
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

function routePreview(origin: PlaceSelection, destination: PlaceSelection) {
  window.dispatchEvent(new CustomEvent("taxi-route-preview", {
    detail: { pickup: origin, dropoff: destination }
  }));
}

export default function BookingForm({
  open,
  mapPickup,
  initialDropoff,
  onClose
}: {
  open: boolean;
  mapPickup: PlaceSelection | null;
  initialDropoff: PlaceSelection | null;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>("where");
  const [pickup, setPickup] = useState<PlaceSelection>(places[0]);
  const [dropoff, setDropoff] = useState<PlaceSelection>(places[1]);
  const [selectedDriver, setSelectedDriver] = useState(nearbyDrivers[0]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [typingMode, setTypingMode] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [message, setMessage] = useState("");
  const [locatingPickup, setLocatingPickup] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const dragStartY = useRef<number | null>(null);

  const tripKm = distanceKm(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
  const estimatedPrice = useMemo(() => {
    // fix: use route-aware base prices with vehicle multipliers, falling back to 45.
    const normalize = (value: string) => value.toLowerCase().replace(/, albania/g, "").replace(/\s+/g, " ").trim();
    const routeKey = `${normalize(pickup.name)}-${normalize(dropoff.name)}`;
    const reverseRouteKey = `${normalize(dropoff.name)}-${normalize(pickup.name)}`;
    const basePrice = routePrices[routeKey] ?? routePrices[reverseRouteKey] ?? 45;
    const multiplierByClass: Record<string, number> = {
      Taxi: 1,
      "Private car": 1,
      XL: 1.3,
      Minivan: 1.3,
      Comfort: 1.6,
      "Luxury SUV": 1.6
    };

    return Math.round(basePrice * (multiplierByClass[selectedDriver.rideClass] ?? 1));
  }, [dropoff.name, pickup.name, selectedDriver.rideClass]);

  useEffect(() => {
    if (step === "where" || step === "driver") routePreview(pickup, dropoff);
    if (step === "details" || step === "assigned") {
      routePreview(
        { name: `${selectedDriver.name} location`, lat: selectedDriver.lat, lng: selectedDriver.lng },
        pickup
      );
    }
    if (step === "started") routePreview(pickup, dropoff);
  }, [pickup, dropoff, selectedDriver, step]);

  useEffect(() => {
    if (mapPickup) setPickup(mapPickup);
  }, [mapPickup]);

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
    setMessage("Nearby taxis found.");
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

  function chooseDriver(driver: typeof nearbyDrivers[number]) {
    setSelectedDriver(driver);
    setStep("details");
    setMessage(`${driver.name} selected. Add customer details to request the ride.`);
  }

  async function confirmRide() {
    setMessage("Requesting ride...");

    const booking = {
      customer_id: null,
      customer_name: customerName || "Guest rider",
      customer_phone: customerPhone || "+355",
      pickup: pickup.name,
      dropoff: dropoff.name,
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      dropoff_lat: dropoff.lat,
      dropoff_lng: dropoff.lng,
      pickup_time: new Date().toISOString(),
      passengers,
      luggage: "Not required",
      vehicle_type: selectedDriver.vehicle,
      ride_class: selectedDriver.rideClass,
      payment_method: paymentMethod,
      driver_name: selectedDriver.name,
      driver_vehicle: `${selectedDriver.vehicle} ${selectedDriver.plate}`,
      driver_eta: selectedDriver.eta,
      estimated_price: estimatedPrice
    };

    if (isSupabaseConfigured && supabase) {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        setMessage("Please log in before booking a real ride.");
        return;
      }

      const { data, error } = await supabase
        .from("bookings")
        .insert({ ...booking, customer_id: userData.user.id, status: "assigned" })
        .select("id")
        .single();

      if (error) {
        setMessage(error.message);
        return;
      }

      setBookingId(data?.id || null);
    }

    setStep("assigned");
    setMessage(`${selectedDriver.name} is coming to you. ${selectedDriver.eta} min pickup.`);
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
    details: "Customer details",
    assigned: "Driver arriving",
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
          <b>{selectedDriver.eta} min</b>
        </button>
      </section>
    );
  }

  return (
    <section className={typingMode ? "ride-sheet typing-mode" : "ride-sheet"}>
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
          <div className="eta-chip"><Clock3 size={16} /> {selectedDriver.eta} min</div>
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
            <div className="driver-pick-list">
              {nearbyDrivers.map((driver) => (
                <button
                  className={selectedDriver.name === driver.name ? "driver-pick-card active" : "driver-pick-card"}
                  key={driver.name}
                  type="button"
                  onClick={() => chooseDriver(driver)}
                >
                  <span className="driver-avatar"><Car size={22} /></span>
                  <span>
                    <strong>{driver.rideClass}</strong>
                    <small>{driver.name} - {driver.vehicle} - {driver.plate}</small>
                    <small><Star size={12} /> {driver.rating} rating</small>
                  </span>
                  <b>{driver.eta} min</b>
                </button>
              ))}
            </div>
            <button className="secondary-btn compact-step-back" type="button" onClick={() => setStep("where")}>Back to location</button>
          </>
        )}

        {step === "details" && (
          <>
            <div className="trip-summary-card">
              <strong>{selectedDriver.name}</strong>
              <span>{selectedDriver.vehicle} - {selectedDriver.plate} - {selectedDriver.eta} min away</span>
            </div>
            <div className="quick-grid details-grid">
              <label><span>Name</span><input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Rider name" /></label>
              <label><span>Phone</span><input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+355 ..." /></label>
              <label><span>Passengers</span><input type="number" min={1} max={selectedDriver.seats} value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} /></label>
              <label><span>Payment</span><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option>Cash</option><option>Card</option><option>Wallet</option></select></label>
            </div>
            <div className="fare-box">
              <div><span>{tripKm.toFixed(1)} km trip</span><strong>EUR {estimatedPrice}</strong></div>
              <div><span>Route</span><strong>Driver to pickup</strong></div>
            </div>
            <button className="primary-btn request-btn" type="submit">
              <MapPin size={19} />
              Confirm ride
            </button>
            <button className="secondary-btn compact-step-back" type="button" onClick={() => setStep("driver")}>Back to taxis</button>
          </>
        )}

        {step === "assigned" && (
          <>
            <div className="trip-status-card">
              <Navigation size={22} />
              <div>
                <strong>{selectedDriver.name} is heading to your pickup</strong>
                <span>{selectedDriver.vehicle} - {selectedDriver.plate} - {selectedDriver.eta} min</span>
              </div>
            </div>
            <div className="trip-actions">
              <button className="secondary-btn" type="button"><Phone size={17} /> Call driver</button>
              <button className="primary-btn" type="button" onClick={() => setStep("started")}>Start ride</button>
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
              <span>EUR {estimatedPrice} - {paymentMethod}</span>
            </div>
          </div>
        )}

        {message && <p className="status-message">{message}</p>}
      </form>
    </section>
  );
}
