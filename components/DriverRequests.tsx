"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, MapPinned, Navigation, Phone, XCircle } from "lucide-react";
import { getCurrentUserProfile } from "@/lib/authProfile";
import type { Booking } from "@/lib/types";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const emptyDriverId = "00000000-0000-0000-0000-000000000000";

function mapsDirectionsUrl(booking: Booking, target: "pickup" | "dropoff") {
  const lat = target === "pickup" ? booking.pickup_lat : booking.dropoff_lat;
  const lng = target === "pickup" ? booking.pickup_lng : booking.dropoff_lng;
  const destination = encodeURIComponent(`${lat},${lng}`);
  return `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
}

function tripStageCopy(status: Booking["status"]) {
  if (status === "pending" || status === "assigned") return "New request";
  if (status === "accepted") return "Drive to pickup";
  if (status === "arrived") return "Arrived at pickup";
  if (status === "started") return "Drive to destination";
  return status;
}

export default function DriverRequests() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [completedBookings, setCompletedBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("");
  const driverIdRef = useRef<string | null>(null);

  const load = useCallback(async (showErrors = true) => {
    if (!isSupabaseConfigured || !supabase) {
      if (showErrors) setMessage("Connect Supabase to receive real ride requests.");
      return;
    }

    const { user, profile } = await getCurrentUserProfile();
    if (!user || (profile?.role !== "driver" && profile?.role !== "admin")) {
      if (showErrors) setMessage("Login as an approved driver to receive ride requests.");
      return;
    }

    const currentDriverId = user.id || emptyDriverId;
    driverIdRef.current = user.id || null;

    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .or(`status.eq.pending,driver_id.eq.${currentDriverId}`)
      .in("status", ["pending", "assigned", "accepted", "arrived", "started"])
      .order("created_at", { ascending: false });

    if (error) {
      if (showErrors) setMessage(error.message);
    } else {
      setBookings((data || []) as Booking[]);
    }

    const { data: completed } = await supabase
      .from("bookings")
      .select("*")
      .eq("driver_id", currentDriverId)
      .in("status", ["completed", "cancelled"])
      .order("created_at", { ascending: false })
      .limit(8);
    if (completed) setCompletedBookings(completed as Booking[]);
  }, []);

  useEffect(() => {
    load();

    if (!isSupabaseConfigured || !supabase) return;
    const client = supabase;
    const channel = client
      .channel("driver-ride-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, (payload) => {
        const next = payload.new as Booking;
        if (!next?.id) return;

        setBookings((current) => {
          const currentDriverId = driverIdRef.current;
          const shouldShow =
            next.status === "pending" ||
            (!!currentDriverId && next.driver_id === currentDriverId && next.status !== "completed" && next.status !== "cancelled");
          const exists = current.some((booking) => booking.id === next.id);
          if (!shouldShow) return current.filter((booking) => booking.id !== next.id);
          if (exists) return current.map((booking) => (booking.id === next.id ? next : booking));
          return [next, ...current];
        });

        if (next.status === "completed" || next.status === "cancelled") {
          setCompletedBookings((current) => {
            const exists = current.some((booking) => booking.id === next.id);
            if (exists) return current.map((booking) => (booking.id === next.id ? next : booking));
            return [next, ...current].slice(0, 8);
          });
        }
      })
      .subscribe();

    // fix: poll as a fast fallback so driver requests appear even if mobile realtime is delayed or sleeping.
    const refreshTimer = window.setInterval(() => load(false), 2500);
    const refreshOnFocus = () => load(false);
    window.addEventListener("focus", refreshOnFocus);
    document.addEventListener("visibilitychange", refreshOnFocus);

    return () => {
      client.removeChannel(channel);
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshOnFocus);
      document.removeEventListener("visibilitychange", refreshOnFocus);
    };
  }, [load]);

  async function acceptRide(id: string) {
    if (!isSupabaseConfigured || !supabase) {
      setMessage("Connect Supabase to accept real rides.");
      return;
    }

    const { user, profile: appProfile } = await getCurrentUserProfile();
    if (!user) {
      setMessage("Login before accepting rides.");
      return;
    }
    if (appProfile?.role !== "driver") {
      setMessage("Only driver accounts can accept rides.");
      return;
    }

    const { data: profile } = await supabase
      .from("driver_profiles")
      .select("full_name, vehicle_make, vehicle_model, license_plate, approval_status")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.approval_status !== "approved") {
      setMessage("Only approved drivers can accept rides.");
      return;
    }

    const vehicle = `${profile.vehicle_make} ${profile.vehicle_model} ${profile.license_plate}`.trim();
    console.log("[booking:accept]", {
      route: window.location.pathname,
      userId: user.id,
      email: user.email,
      role: appProfile.role,
      bookingId: id,
      driverId: user.id
    });

    const { error } = await supabase
      .from("bookings")
      .update({
        status: "accepted",
        driver_id: user.id,
        driver_name: profile.full_name,
        driver_vehicle: vehicle,
        accepted_at: new Date().toISOString()
      })
      .eq("id", id)
      .is("driver_id", null)
      .eq("status", "pending");

    if (error) setMessage(error.message);
    else {
      // fix: driver must explicitly accept a customer request before pickup navigation starts.
      setMessage("Ride accepted. Drive to the pickup point.");
      setBookings((current) => current.map((booking) => (
        booking.id === id
          ? { ...booking, status: "accepted", driver_id: user.id, driver_name: profile.full_name, driver_vehicle: vehicle, accepted_at: new Date().toISOString() }
          : booking
      )));
    }
  }

  async function declineRide(id: string) {
    if (!isSupabaseConfigured || !supabase) return;
    const { user } = await getCurrentUserProfile();
    if (!user) return;

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("driver_id", user.id);

    if (error) setMessage(error.message);
    else {
      setMessage("Ride declined.");
      setBookings((current) => current.filter((booking) => booking.id !== id));
    }
  }

  async function updateRide(id: string, status: "arrived" | "started" | "completed") {
    if (!isSupabaseConfigured || !supabase) return;
    const { user, profile } = await getCurrentUserProfile();
    if (!user || profile?.role !== "driver") {
      setMessage("Login as a driver to update this ride.");
      return;
    }

    const timestampColumn = status === "arrived" ? "arrived_at" : status === "started" ? "started_at" : "completed_at";
    const { error } = await supabase
      .from("bookings")
      .update({ status, [timestampColumn]: new Date().toISOString() })
      .eq("id", id)
      .eq("driver_id", user.id);

    if (error) setMessage(error.message);
    else {
      setMessage(status === "arrived" ? "Arrived at pickup." : status === "completed" ? "Job done." : "Client picked up.");
      setBookings((current) => current
        .map((booking) => (booking.id === id ? { ...booking, status, [timestampColumn]: new Date().toISOString() } : booking))
        .filter((booking) => booking.status !== "completed"));
    }
  }

  function actionsFor(booking: Booking) {
    if (booking.status === "pending" || booking.status === "assigned") {
      return (
        <div className="driver-job-actions">
          <button className="primary-btn compact-btn" onClick={() => acceptRide(booking.id)}>
            <CheckCircle2 size={17} />
            Accept
          </button>
          <button className="secondary-btn compact-btn" onClick={() => declineRide(booking.id)}>
            <XCircle size={17} />
            Decline
          </button>
        </div>
      );
    }
    if (booking.status === "accepted") {
      return (
        <div className="driver-job-actions stacked">
          <a className="primary-btn compact-btn" href={mapsDirectionsUrl(booking, "pickup")} target="_blank" rel="noreferrer">
            <Navigation size={17} />
            Navigate to pickup
          </a>
          <button className="secondary-btn compact-btn" onClick={() => updateRide(booking.id, "arrived")}>
            <CheckCircle2 size={17} />
            Arrived
          </button>
        </div>
      );
    }
    if (booking.status === "arrived") {
      return (
        <div className="driver-job-actions stacked">
          <a className="secondary-btn compact-btn" href={mapsDirectionsUrl(booking, "pickup")} target="_blank" rel="noreferrer">
            <Navigation size={17} />
            Pickup location
          </a>
          <button className="primary-btn compact-btn" onClick={() => updateRide(booking.id, "started")}>
            <CheckCircle2 size={17} />
            Picked up
          </button>
        </div>
      );
    }
    if (booking.status === "started") {
      return (
        <div className="driver-job-actions stacked">
          <a className="primary-btn compact-btn" href={mapsDirectionsUrl(booking, "dropoff")} target="_blank" rel="noreferrer">
            <Navigation size={17} />
            Navigate to destination
          </a>
          <button className="secondary-btn compact-btn" onClick={() => updateRide(booking.id, "completed")}>
            <CheckCircle2 size={17} />
            Job done
          </button>
        </div>
      );
    }
    return <span className={`status-pill ${booking.status}`}>{booking.status}</span>;
  }

  return (
    <div className="driver-jobs">
      <h2>Live ride requests</h2>
      {bookings.map((booking) => (
        <article className={`job-card driver-trip-card ${booking.status}`} key={booking.id}>
          <div className="driver-trip-main">
            <div className="driver-trip-topline">
              <span className={`status-pill ${booking.status}`}>{tripStageCopy(booking.status)}</span>
              <strong>EUR {Number(booking.estimated_price).toFixed(2)}</strong>
            </div>
            <div className="driver-route-stack">
              <div>
                <MapPinned size={17} />
                <span>
                  <small>Pickup</small>
                  <strong>{booking.pickup}</strong>
                </span>
              </div>
              <div>
                <Navigation size={17} />
                <span>
                  <small>Destination</small>
                  <strong>{booking.dropoff}</strong>
                </span>
              </div>
            </div>
            <div className="driver-trip-meta">
              <span>{booking.ride_class}</span>
              <span>{booking.passengers} passenger{booking.passengers === 1 ? "" : "s"}</span>
              <span>{booking.payment_method}</span>
            </div>
            {booking.driver_id === driverIdRef.current && booking.customer_phone && (
              <a className="driver-call-link" href={`tel:${booking.customer_phone}`}>
                <Phone size={15} />
                Call customer
              </a>
            )}
          </div>
          {actionsFor(booking)}
        </article>
      ))}
      {bookings.length === 0 && <p>No live requests right now.</p>}
      {message && <p className="status-message">{message}</p>}

      <h2>Completed jobs</h2>
      {completedBookings.map((booking) => (
        <article className="job-card compact-history-card" key={booking.id}>
          <div>
            <strong>{booking.pickup} to {booking.dropoff}</strong>
            <p>EUR {Number(booking.estimated_price).toFixed(2)} | {booking.payment_method}</p>
            <span className={`status-pill ${booking.status}`}>{booking.status}</span>
          </div>
        </article>
      ))}
      {completedBookings.length === 0 && <p>No completed jobs yet.</p>}
    </div>
  );
}
