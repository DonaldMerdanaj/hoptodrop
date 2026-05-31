"use client";

import { useEffect, useRef, useState } from "react";
import type { Booking } from "@/lib/types";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function DriverRequests() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("");
  const [driverId, setDriverId] = useState<string | null>(null);
  const driverIdRef = useRef<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured || !supabase) {
        setMessage("Connect Supabase to receive real ride requests.");
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      setDriverId(userData.user?.id || null);
      driverIdRef.current = userData.user?.id || null;

      const { data } = await supabase
        .from("bookings")
        .select("*")
        .or(`status.eq.pending,driver_id.eq.${userData.user?.id || "00000000-0000-0000-0000-000000000000"}`)
        .in("status", ["pending", "accepted", "assigned", "arrived", "started"])
        .order("created_at", { ascending: false });
      if (data) setBookings(data as Booking[]);
    }

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
          const shouldShow = next.status === "pending" || (!!currentDriverId && next.driver_id === currentDriverId && next.status !== "completed" && next.status !== "cancelled");
          const exists = current.some((booking) => booking.id === next.id);
          if (!shouldShow) return current.filter((booking) => booking.id !== next.id);
          if (exists) return current.map((booking) => (booking.id === next.id ? next : booking));
          return [next, ...current];
        });
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, []);

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
      .eq("status", "pending");

    if (error) setMessage(error.message);
    else {
      setMessage("Ride accepted.");
      setBookings((current) => current.map((booking) => (
        booking.id === id ? { ...booking, status: "accepted", driver_id: userData.user.id, driver_name: profile.full_name, driver_vehicle: vehicle, accepted_at: new Date().toISOString() } : booking
      )));
    }
  }

  async function updateRide(id: string, status: "arrived" | "started" | "completed") {
    if (!isSupabaseConfigured || !supabase) return;

    const timestampColumn = status === "arrived" ? "arrived_at" : status === "started" ? "started_at" : "completed_at";
    const { error } = await supabase
      .from("bookings")
      .update({ status, [timestampColumn]: new Date().toISOString() })
      .eq("id", id);

    if (error) setMessage(error.message);
    else {
      setMessage(status === "completed" ? "Ride completed." : `Ride marked ${status}.`);
      setBookings((current) => current
        .map((booking) => (booking.id === id ? { ...booking, status, [timestampColumn]: new Date().toISOString() } : booking))
        .filter((booking) => booking.status !== "completed"));
    }
  }

  function actionsFor(booking: Booking) {
    if (booking.status === "pending") {
      return <button className="secondary-btn compact-btn" onClick={() => acceptRide(booking.id)}>Accept</button>;
    }
    if (booking.status === "accepted" || booking.status === "assigned") {
      return <button className="secondary-btn compact-btn" onClick={() => updateRide(booking.id, "arrived")}>Arrived</button>;
    }
    if (booking.status === "arrived") {
      return <button className="secondary-btn compact-btn" onClick={() => updateRide(booking.id, "started")}>Start</button>;
    }
    if (booking.status === "started") {
      return <button className="primary-btn compact-btn" onClick={() => updateRide(booking.id, "completed")}>Complete</button>;
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
            <p>{booking.ride_class} | €{Number(booking.estimated_price).toFixed(2)} | {booking.payment_method}</p>
            <span className={`status-pill ${booking.status}`}>{booking.status}</span>
          </div>
          {actionsFor(booking)}
        </article>
      ))}
      {bookings.length === 0 && <p>No live requests right now.</p>}
      {message && <p className="status-message">{message}</p>}
    </div>
  );
}
