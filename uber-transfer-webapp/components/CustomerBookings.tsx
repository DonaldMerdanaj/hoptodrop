"use client";

import { useEffect, useState } from "react";
import type { Booking } from "@/lib/types";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function CustomerBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      if (!isSupabaseConfigured || !supabase) {
        setMessage("Connect Supabase to show real ride history.");
        return;
      }
      const { data } = await supabase.from("bookings").select("*").order("created_at", { ascending: false });
      if (data) setBookings(data as Booking[]);
    }

    load();
  }, []);

  return (
    <div className="panel-list">
      <h2>Your rides</h2>
      {bookings.map((booking) => (
        <article className="list-item" key={booking.id}>
          <div>
            <strong>{booking.pickup} to {booking.dropoff}</strong>
            <p>{booking.ride_class} | {booking.passengers} rider | {booking.payment_method} | EUR {booking.estimated_price}</p>
            {booking.driver_name && <p>{booking.driver_name} is {booking.driver_eta} min away in {booking.driver_vehicle}</p>}
          </div>
          <span className={`status-pill ${booking.status}`}>{booking.status}</span>
        </article>
      ))}
      {bookings.length === 0 && <p>{message || "No rides yet."}</p>}
    </div>
  );
}
