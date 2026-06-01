"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Booking } from "@/lib/types";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

const emptyDriverId = "00000000-0000-0000-0000-000000000000";

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

    const { data: userData } = await supabase.auth.getUser();
    const currentDriverId = userData.user?.id || emptyDriverId;
    driverIdRef.current = userData.user?.id || null;

    const { data, error } = await supabase
      .from("bookings")
      .select("*")
      .or(`status.eq.pending,driver_id.eq.${currentDriverId}`)
      .in("status", ["pending", "assigned", "accepted", "started"])
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

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      setMessage("Login before accepting rides.");
      return;
    }

    const { data: profile } = await supabase
      .from("driver_profiles")
      .select("full_name, vehicle_make, vehicle_model, license_plate, approval_status")
      .eq("id", userData.user.id)
      .maybeSingle();

    if (!profile || profile.approval_status !== "approved") {
      setMessage("Only approved drivers can accept rides.");
      return;
    }

    const vehicle = `${profile.vehicle_make} ${profile.vehicle_model} ${profile.license_plate}`.trim();
    const { error } = await supabase
      .from("bookings")
      .update({
        status: "accepted",
        driver_id: userData.user.id,
        driver_name: profile.full_name,
        driver_vehicle: vehicle,
        accepted_at: new Date().toISOString()
      })
      .eq("id", id)
      .in("status", ["pending", "assigned"]);

    if (error) setMessage(error.message);
    else {
      // fix: driver must explicitly accept a customer request before pickup navigation starts.
      setMessage("Ride accepted. Drive to the pickup point.");
      setBookings((current) => current.map((booking) => (
        booking.id === id
          ? { ...booking, status: "accepted", driver_id: userData.user.id, driver_name: profile.full_name, driver_vehicle: vehicle, accepted_at: new Date().toISOString() }
          : booking
      )));
    }
  }

  async function declineRide(id: string) {
    if (!isSupabaseConfigured || !supabase) return;

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) setMessage(error.message);
    else {
      setMessage("Ride declined.");
      setBookings((current) => current.filter((booking) => booking.id !== id));
    }
  }

  async function updateRide(id: string, status: "started" | "completed") {
    if (!isSupabaseConfigured || !supabase) return;

    const timestampColumn = status === "started" ? "started_at" : "completed_at";
    const { error } = await supabase
      .from("bookings")
      .update({ status, [timestampColumn]: new Date().toISOString() })
      .eq("id", id);

    if (error) setMessage(error.message);
    else {
      setMessage(status === "completed" ? "Job done." : "Client picked up.");
      setBookings((current) => current
        .map((booking) => (booking.id === id ? { ...booking, status, [timestampColumn]: new Date().toISOString() } : booking))
        .filter((booking) => booking.status !== "completed"));
    }
  }

  function actionsFor(booking: Booking) {
    if (booking.status === "pending" || booking.status === "assigned") {
      return (
        <div className="driver-job-actions">
          <button className="primary-btn compact-btn" onClick={() => acceptRide(booking.id)}>Accept</button>
          <button className="secondary-btn compact-btn" onClick={() => declineRide(booking.id)}>Decline</button>
        </div>
      );
    }
    if (booking.status === "accepted") {
      return <button className="secondary-btn compact-btn" onClick={() => updateRide(booking.id, "started")}>Picked up</button>;
    }
    if (booking.status === "started") {
      return <button className="primary-btn compact-btn" onClick={() => updateRide(booking.id, "completed")}>Job done</button>;
    }
    return <span className={`status-pill ${booking.status}`}>{booking.status}</span>;
  }

  return (
    <div className="driver-jobs">
      <h2>Live ride requests</h2>
      {bookings.map((booking) => (
        <article className="job-card" key={booking.id}>
          <div>
            <strong>{booking.pickup} to {booking.dropoff}</strong>
            <p>{booking.ride_class} | EUR {Number(booking.estimated_price).toFixed(2)} | {booking.payment_method}</p>
            <span className={`status-pill ${booking.status}`}>{booking.status}</span>
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
