"use client";

import { useEffect, useState } from "react";
import type { Booking } from "@/lib/types";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function CustomerBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let customerId = "";

    async function load() {
      if (!isSupabaseConfigured || !supabase) {
        setMessage("Connect Supabase to show real ride history.");
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      customerId = userData.user?.id || "";
      if (!customerId) {
        setMessage("Log in to see your ride history.");
        return;
      }

      // fix: customer dashboard shows only the logged-in customer's real bookings.
      const { data, error } = await supabase
        .from("bookings")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) setMessage(error.message);
      if (data) setBookings(data as Booking[]);
    }

    load();

    if (!isSupabaseConfigured || !supabase) return;
    const client = supabase;
    const channel = client
      .channel("customer-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, (payload) => {
        const next = payload.new as Booking;
        if (!next?.id) return;
        if (customerId && next.customer_id !== customerId) return;
        setBookings((current) => {
          const exists = current.some((booking) => booking.id === next.id);
          if (exists) return current.map((booking) => (booking.id === next.id ? next : booking));
          return [next, ...current];
        });
      })
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, []);

  return (
    <div className="panel-list ride-history-list">
      <h2>Ride history</h2>
      {bookings.map((booking) => (
        <article className="list-item" key={booking.id}>
          <div>
            <strong>{booking.pickup} to {booking.dropoff}</strong>
            <p>{booking.ride_class} | {booking.passengers} rider | {booking.payment_method} | EUR {Number(booking.estimated_price).toFixed(2)}</p>
            {booking.driver_name && <p>{booking.driver_name} | {booking.driver_vehicle}</p>}
            <p>{new Date(booking.created_at).toLocaleDateString()} | {new Date(booking.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
          <span className={`status-pill ${booking.status}`}>{booking.status}</span>
        </article>
      ))}
      {bookings.length === 0 && <p>{message || "No rides yet."}</p>}
    </div>
  );
}
