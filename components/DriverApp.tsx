"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Banknote,
  Bell,
  Briefcase,
  CarFront,
  CheckCircle2,
  Home,
  LocateFixed,
  LogOut,
  MapPin,
  Navigation,
  Phone,
  Search,
  UserRound
} from "lucide-react";
import { useRouter } from "next/navigation";
import { clearAccountMode } from "@/lib/accountMode";
import { getCurrentUserProfile } from "@/lib/authProfile";
import { loadGoogleMaps } from "@/lib/googleMaps";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Booking } from "@/lib/types";

type DriverTab = "home" | "trips" | "earnings" | "profile";
type DriverStatus = "online" | "offline" | "busy";

type DriverProfile = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  city: string;
  approval_status: "draft" | "submitted" | "approved" | "rejected";
  vehicle_make: string;
  vehicle_model: string;
  license_plate: string;
  vehicle_color: string;
  profile_photo_url: string | null;
  driver_license_url: string | null;
  vehicle_registration_url: string | null;
  insurance_url: string | null;
  status?: DriverStatus;
};

type DriverLocation = {
  lat: number;
  lng: number;
  status: DriverStatus;
};

type LocationPermission = "unknown" | "prompt" | "granted" | "denied" | "unsupported";

const tirana = { lat: 41.3275, lng: 19.8187 };

function mapsDirectionsUrl(booking: Booking, target: "pickup" | "dropoff") {
  const lat = target === "pickup" ? booking.pickup_lat : booking.dropoff_lat;
  const lng = target === "pickup" ? booking.pickup_lng : booking.dropoff_lng;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${lat},${lng}`)}&travelmode=driving`;
}

function kmBetween(aLat: number, aLng: number, bLat: number, bLng: number) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthKm = 6371;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const a = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return earthKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function money(value: number) {
  return `EUR ${Number(value || 0).toFixed(2)}`;
}

export default function DriverApp({ initialProfile }: { initialProfile: DriverProfile }) {
  const router = useRouter();
  const [tab, setTab] = useState<DriverTab>("home");
  const [profile, setProfile] = useState(initialProfile);
  const [location, setLocation] = useState<DriverLocation | null>(null);
  const [incoming, setIncoming] = useState<Booking | null>(null);
  const [activeTrip, setActiveTrip] = useState<Booking | null>(null);
  const [history, setHistory] = useState<Booking[]>([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [countdown, setCountdown] = useState(15);
  const [locationPermission, setLocationPermission] = useState<LocationPermission>("unknown");
  const locationTimerRef = useRef<number | null>(null);
  const activeTripRef = useRef<Booking | null>(null);

  const status = profile.status || location?.status || "offline";

  const loadDriverData = useCallback(async () => {
    if (!supabase) return;

    const { user } = await getCurrentUserProfile();
    if (!user) return;

    const { data: locationData } = await supabase
      .from("driver_locations")
      .select("lat,lng,status")
      .eq("id", user.id)
      .maybeSingle();

    if (locationData) setLocation(locationData as DriverLocation);

    const { data: active } = await supabase
      .from("bookings")
      .select("*")
      .eq("driver_id", user.id)
      .in("status", ["accepted", "arrived", "started"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (active) setActiveTrip(active as Booking);

    const { data: tripHistory } = await supabase
      .from("bookings")
      .select("*")
      .eq("driver_id", user.id)
      .in("status", ["completed", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (tripHistory) setHistory(tripHistory as Booking[]);
  }, []);

  useEffect(() => {
    loadDriverData();
  }, [loadDriverData]);

  useEffect(() => {
    activeTripRef.current = activeTrip;
  }, [activeTrip]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationPermission("unsupported");
      return;
    }

    if (!navigator.permissions?.query) {
      setLocationPermission("prompt");
      return;
    }

    let mounted = true;
    navigator.permissions.query({ name: "geolocation" as PermissionName }).then((permission) => {
      if (!mounted) return;
      setLocationPermission(permission.state as LocationPermission);
      permission.onchange = () => setLocationPermission(permission.state as LocationPermission);
      if (permission.state === "granted") saveLocation("offline", false);
    }).catch(() => setLocationPermission("prompt"));

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const client = supabase;
    const channel = client
      .channel("driver-app-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, (payload) => {
        const booking = payload.new as Booking;
        if (!booking?.id) return;

        if (booking.status === "pending") {
          setIncoming(booking);
          setCountdown(15);
          if ("vibrate" in navigator) navigator.vibrate([180, 80, 180]);
          try {
            new Audio("data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAESsAACJWAAACABAAZGF0YQgAAAAA").play().catch(() => {});
          } catch {
            // Audio alert is optional on browsers that block autoplay.
          }
        }

        if (booking.driver_id === profile.id && ["accepted", "arrived", "started"].includes(booking.status)) {
          setActiveTrip(booking);
        }

        if (booking.driver_id === profile.id && ["completed", "cancelled"].includes(booking.status)) {
          setActiveTrip(null);
          setHistory((current) => [booking, ...current.filter((trip) => trip.id !== booking.id)]);
        }
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [profile.id]);

  useEffect(() => {
    if (!incoming) return;
    const timer = window.setInterval(() => {
      setCountdown((value) => {
        if (value <= 1) {
          setIncoming(null);
          return 15;
        }
        return value - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [incoming]);

  useEffect(() => {
    return () => {
      if (locationTimerRef.current !== null) window.clearInterval(locationTimerRef.current);
    };
  }, []);

  function readCurrentPosition() {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Location is not supported on this device."));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        maximumAge: 2500,
        timeout: 12000
      });
    });
  }

  async function saveLocation(nextStatus = status, showErrors = true) {
    if (!supabase || !navigator.geolocation) return false;
    const client = supabase;
    const { user } = await getCurrentUserProfile();
    if (!user) return false;

    try {
      const position = await readCurrentPosition();
      const nextLocation = {
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        status: nextStatus as DriverStatus
      };
      setLocation(nextLocation);

      await client.from("driver_locations").upsert({
        id: user.id,
        driver_name: profile.full_name,
        vehicle: `${profile.vehicle_make} ${profile.vehicle_model} ${profile.license_plate}`.trim(),
        status: nextStatus,
        lat: nextLocation.lat,
        lng: nextLocation.lng,
        updated_at: new Date().toISOString()
      });

      await client.from("driver_profiles").update({
        status: nextStatus,
        updated_at: new Date().toISOString()
      }).eq("id", user.id);

      const currentTrip = activeTripRef.current;
      if (currentTrip) {
        await client.from("booking_route_points").insert({
          booking_id: currentTrip.id,
          driver_id: user.id,
          lat: nextLocation.lat,
          lng: nextLocation.lng,
          phase: currentTrip.status,
          recorded_at: new Date().toISOString()
        });
      }

      setLocationPermission("granted");
      setMessage("");
      return true;
    } catch (error) {
      setLocationPermission("denied");
      if (showErrors) {
        setMessage("Location is required to go online. Allow location access in your browser settings, then try again.");
      }
      return false;
    }
  }

  async function updateStoredStatus(nextStatus: DriverStatus) {
    if (!supabase) return;
    const { user } = await getCurrentUserProfile();
    if (!user) return;

    await supabase.from("driver_profiles").update({
      status: nextStatus,
      updated_at: new Date().toISOString()
    }).eq("id", user.id);

    await supabase.from("driver_locations").update({
      status: nextStatus,
      updated_at: new Date().toISOString()
    }).eq("id", user.id);
  }

  async function setDriverStatus(nextStatus: DriverStatus) {
    if (locationTimerRef.current !== null) window.clearInterval(locationTimerRef.current);

    if (nextStatus === "offline") {
      setProfile((current) => ({ ...current, status: "offline" }));
      await updateStoredStatus("offline");
      setMessage("You are offline. Turn Online on when you are ready for trips.");
      return;
    }

    const locationSaved = await saveLocation(nextStatus, true);
    if (!locationSaved) {
      setProfile((current) => ({ ...current, status: "offline" }));
      return;
    }

    setProfile((current) => ({ ...current, status: nextStatus }));
    if (nextStatus === "online" || nextStatus === "busy") {
      locationTimerRef.current = window.setInterval(() => saveLocation(nextStatus), 5000);
    }
  }

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    clearAccountMode();
    router.replace("/login?role=driver");
  }

  async function acceptIncoming() {
    if (!incoming || !supabase) return;
    const { user } = await getCurrentUserProfile();
    if (!user) return;

    const vehicle = `${profile.vehicle_make} ${profile.vehicle_model} ${profile.license_plate}`.trim();
    const { error } = await supabase
      .from("bookings")
      .update({
        status: "accepted",
        driver_id: user.id,
        driver_name: profile.full_name,
        driver_vehicle: vehicle,
        accepted_at: new Date().toISOString()
      })
      .eq("id", incoming.id)
      .is("driver_id", null)
      .eq("status", "pending");

    if (error) setMessage(error.message);
    else {
      setActiveTrip({ ...incoming, status: "accepted", driver_id: user.id, driver_name: profile.full_name, driver_vehicle: vehicle });
      setIncoming(null);
      await setDriverStatus("busy");
    }
  }

  async function declineIncoming() {
    setIncoming(null);
    setCountdown(15);
  }

  async function updateTrip(status: "arrived" | "started" | "completed") {
    if (!activeTrip || !supabase) return;
    const column = status === "arrived" ? "arrived_at" : status === "started" ? "started_at" : "completed_at";
    const { error } = await supabase
      .from("bookings")
      .update({ status, [column]: new Date().toISOString() })
      .eq("id", activeTrip.id)
      .eq("driver_id", profile.id);

    if (error) setMessage(error.message);
    else {
      const nextTrip = { ...activeTrip, status } as Booking;
      if (status === "completed") {
        setHistory((current) => [nextTrip, ...current]);
        setActiveTrip(null);
        await setDriverStatus("online");
      } else {
        setActiveTrip(nextTrip);
      }
    }
  }

  const filteredHistory = useMemo(() => {
    return history.filter((trip) => {
      const query = `${trip.pickup} ${trip.dropoff} ${trip.status}`.toLowerCase();
      const dateMatch = dateFilter ? trip.created_at.startsWith(dateFilter) : true;
      return query.includes(search.toLowerCase()) && dateMatch;
    });
  }, [dateFilter, history, search]);

  const completed = history.filter((trip) => trip.status === "completed");
  const today = new Date().toISOString().slice(0, 10);
  const daily = completed.filter((trip) => trip.created_at.startsWith(today)).reduce((sum, trip) => sum + Number(trip.estimated_price || 0), 0);
  const monthly = completed.filter((trip) => trip.created_at.slice(0, 7) === today.slice(0, 7)).reduce((sum, trip) => sum + Number(trip.estimated_price || 0), 0);
  const weekly = completed.slice(0, 7).reduce((sum, trip) => sum + Number(trip.estimated_price || 0), 0);
  const chartBars = [daily, weekly / 7, monthly / Math.max(1, new Date().getDate())];
  const maxBar = Math.max(...chartBars, 1);

  return (
    <main className="driver-app-shell">
      {tab === "home" && (
        <section className="driver-app-map-screen">
          <DriverGoogleMap location={location} />
          <div className="driver-glass-top">
            <div>
              <span>Driver app</span>
              <strong>{profile.full_name || "HopToDrop driver"}</strong>
            </div>
            <StatusBadge status={status} />
          </div>
          <div className="driver-glass-bottom">
            {locationPermission !== "granted" && (
              <LocationAccessCard permission={locationPermission} onRequest={() => saveLocation("offline", true)} />
            )}
            <div className="driver-status-switch">
              {(["offline", "online", "busy"] as DriverStatus[]).map((item) => (
                <button className={status === item ? "active" : ""} key={item} onClick={() => setDriverStatus(item)}>
                  {item}
                </button>
              ))}
            </div>
            {activeTrip ? <ActiveTripCard trip={activeTrip} onUpdate={updateTrip} /> : <p className="driver-muted">Go online to receive nearby ride requests.</p>}
            {message && <p className="status-message">{message}</p>}
          </div>
        </section>
      )}

      {tab === "trips" && (
        <section className="driver-tab-page">
          <Header title="Trips" subtitle="Completed and cancelled rides" />
          <div className="driver-search-row">
            <Search size={17} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search trips" />
            <input type="date" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} />
          </div>
          {filteredHistory.map((trip) => (
            <article className="driver-history-card" key={trip.id}>
              <span className={`status-pill ${trip.status}`}>{trip.status}</span>
              <strong>{trip.pickup} to {trip.dropoff}</strong>
              <p>{new Date(trip.created_at).toLocaleString()} - {money(Number(trip.estimated_price))}</p>
            </article>
          ))}
          {!filteredHistory.length && <p className="driver-muted">No trips found.</p>}
        </section>
      )}

      {tab === "earnings" && (
        <section className="driver-tab-page">
          <Header title="Earnings" subtitle={`${completed.length} completed trips`} />
          <div className="driver-earnings-grid">
            <Metric label="Today" value={money(daily)} />
            <Metric label="Week" value={money(weekly)} />
            <Metric label="Month" value={money(monthly)} />
          </div>
          <div className="driver-chart-card">
            {chartBars.map((value, index) => (
              <div className="driver-chart-bar" key={index}>
                <span style={{ height: `${Math.max(10, (value / maxBar) * 120)}px` }} />
                <small>{["Day", "Week", "Month"][index]}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {tab === "profile" && (
        <section className="driver-tab-page">
          <Header title="Profile" subtitle={profile.email} />
          <div className="driver-profile-card">
            {profile.profile_photo_url ? <img src={profile.profile_photo_url} alt={profile.full_name} /> : <UserRound size={46} />}
            <strong>{profile.full_name}</strong>
            <span>{profile.city} - {profile.phone}</span>
          </div>
          <div className="driver-doc-list">
            <ProfileRow label="Vehicle" value={`${profile.vehicle_make} ${profile.vehicle_model}`} />
            <ProfileRow label="Plate" value={profile.license_plate} />
            <ProfileRow label="Color" value={profile.vehicle_color} />
            <ProfileRow label="Driver license" value={profile.driver_license_url ? "Uploaded" : "Missing"} />
            <ProfileRow label="Registration" value={profile.vehicle_registration_url ? "Uploaded" : "Missing"} />
            <ProfileRow label="Insurance" value={profile.insurance_url ? "Uploaded" : "Missing"} />
          </div>
          <a className="primary-btn" href="/driver/formaplication">Edit profile</a>
        </section>
      )}

      {incoming && (
        <section className="incoming-ride-card">
          <div className="incoming-countdown">{countdown}</div>
          <span>New ride request</span>
          <strong>{incoming.customer_name || "Passenger"}</strong>
          <p><MapPin size={15} /> {incoming.pickup}</p>
          <p><Navigation size={15} /> {incoming.dropoff}</p>
          <div className="incoming-meta">
            <b>{money(Number(incoming.estimated_price))}</b>
            <small>{location ? `${kmBetween(location.lat, location.lng, incoming.pickup_lat, incoming.pickup_lng).toFixed(1)} km away` : "Nearby"}</small>
          </div>
          <div className="driver-job-actions">
            <button className="primary-btn" onClick={acceptIncoming}>Accept</button>
            <button className="secondary-btn" onClick={declineIncoming}>Decline</button>
          </div>
        </section>
      )}

      <nav className="driver-bottom-tabs">
        <TabButton tab="home" active={tab} setTab={setTab} icon={<Home size={19} />} label="Home" />
        <TabButton tab="trips" active={tab} setTab={setTab} icon={<Briefcase size={19} />} label="Trips" />
        <TabButton tab="earnings" active={tab} setTab={setTab} icon={<Banknote size={19} />} label="Earnings" />
        <TabButton tab="profile" active={tab} setTab={setTab} icon={<UserRound size={19} />} label="Profile" />
      </nav>
      {tab === "profile" && (
        <button className="driver-floating-logout" type="button" onClick={signOut}>
          <LogOut size={18} /> Logout
        </button>
      )}
    </main>
  );
}

function DriverGoogleMap({ location }: { location: DriverLocation | null }) {
  const mapNodeRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);

  useEffect(() => {
    let active = true;
    loadGoogleMaps().then((maps) => {
      if (!active || !mapNodeRef.current || mapRef.current) return;
      mapRef.current = new maps.Map(mapNodeRef.current, {
        center: location || tirana,
        zoom: 15,
        disableDefaultUI: true,
        styles: [{ featureType: "poi", stylers: [{ visibility: "off" }] }]
      });
      markerRef.current = new maps.Marker({
        map: mapRef.current,
        position: location || tirana,
        icon: {
          path: maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: "#111827",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 3
        }
      });
    }).catch(() => {});
    return () => { active = false; };
  }, [location]);

  useEffect(() => {
    if (!location || !mapRef.current || !markerRef.current) return;
    markerRef.current.setPosition(location);
    mapRef.current.panTo(location);
  }, [location]);

  return <div className="driver-google-map" ref={mapNodeRef} />;
}

function LocationAccessCard({
  permission,
  onRequest
}: {
  permission: LocationPermission;
  onRequest: () => void;
}) {
  const denied = permission === "denied";
  const unsupported = permission === "unsupported";

  return (
    <article className={`driver-location-card ${denied || unsupported ? "warning" : ""}`}>
      <div className="driver-location-icon">
        <LocateFixed size={18} />
      </div>
      <div>
        <strong>{unsupported ? "Location unavailable" : denied ? "Location blocked" : "Allow driver location"}</strong>
        <p>
          {unsupported
            ? "This device does not support browser location."
            : denied
              ? "Open browser settings and allow location for HopToDrop before going online."
              : "HopToDrop needs your live location while you are online or completing a ride."}
        </p>
      </div>
      {!unsupported && (
        <button className="secondary-btn" type="button" onClick={onRequest}>
          Allow
        </button>
      )}
    </article>
  );
}

function ActiveTripCard({ trip, onUpdate }: { trip: Booking; onUpdate: (status: "arrived" | "started" | "completed") => void }) {
  return (
    <article className="active-trip-card">
      <span className={`status-pill ${trip.status}`}>{trip.status}</span>
      <strong>{trip.customer_name || "Passenger"}</strong>
      <p>{trip.pickup}</p>
      <p>{trip.dropoff}</p>
      <div className="driver-job-actions stacked">
        <a className="primary-btn" href={mapsDirectionsUrl(trip, trip.status === "started" ? "dropoff" : "pickup")} target="_blank" rel="noreferrer">
          <Navigation size={17} /> Navigate
        </a>
        {trip.customer_phone && <a className="secondary-btn" href={`tel:${trip.customer_phone}`}><Phone size={17} /> Call passenger</a>}
        {trip.status === "accepted" && <button className="secondary-btn" onClick={() => onUpdate("arrived")}><Bell size={17} /> Arrived</button>}
        {trip.status === "arrived" && <button className="primary-btn" onClick={() => onUpdate("started")}><CarFront size={17} /> Start trip</button>}
        {trip.status === "started" && <button className="primary-btn" onClick={() => onUpdate("completed")}><CheckCircle2 size={17} /> Complete trip</button>}
      </div>
    </article>
  );
}

function Header({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="driver-tab-header">
      <span>HopToDrop Driver</span>
      <strong>{title}</strong>
      <p>{subtitle}</p>
    </header>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="driver-metric-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ProfileRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="driver-profile-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({ status }: { status: DriverStatus }) {
  return <b className={`driver-status-badge ${status}`}>{status}</b>;
}

function TabButton({
  tab,
  active,
  setTab,
  icon,
  label
}: {
  tab: DriverTab;
  active: DriverTab;
  setTab: (tab: DriverTab) => void;
  icon: ReactNode;
  label: string;
}) {
  return (
    <button className={active === tab ? "active" : ""} onClick={() => setTab(tab)}>
      {icon}
      <span>{label}</span>
    </button>
  );
}
