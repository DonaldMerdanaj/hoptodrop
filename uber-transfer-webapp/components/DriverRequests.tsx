"use client";

import { useEffect, useState } from "react";
import type { Booking } from "@/lib/types";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function DriverRequests() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured || !supabase) {
        setMessage("Connect Supabase to receive real ride requests.");
        return;
      }

      const { data } = await supabase
        .from("bookings")
        .select("*")
        .in("status", ["pending", "assigned", "accepted"])
        .order("created_at", { ascending: false });
      if (data) setBookings(data as Booking[]);
    }

    load();
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
        driver_name: profile.full_name,
        driver_vehicle: vehicle
      })
      .eq("id", id);

    if (error) setMessage(error.message);
    else {
      setMessage("Ride accepted.");
      setBookings((current) => current.map((booking) => (
        booking.id === id ? { ...booking, status: "accepted", driver_name: profile.full_name, driver_vehicle: vehicle } : booking
      )));
    }
  }

  return (
    <div className="driver-jobs">
      <h2>Live ride requests</h2>
      {bookings.map((booking) => (
        <article className="job-card" key={booking.id}>
          <div>
            <strong>{booking.pickup} to {booking.dropoff}</strong>
            <p>{booking.ride_class} | EUR {booking.estimated_price} | {booking.payment_method}</p>
          </div>
          <button className="secondary-btn compact-btn" onClick={() => acceptRide(booking.id)}>Accept</button>
        </article>
      ))}
      {bookings.length === 0 && <p>No live requests right now.</p>}
      {message && <p className="status-message">{message}</p>}
    </div>
  );
}
