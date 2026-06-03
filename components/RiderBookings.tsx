"use client";

import { useEffect, useState } from "react";
import { getCurrentUserProfile } from "@/lib/authProfile";
import type { Booking } from "@/lib/types";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function RiderBookings() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let riderId = "";
    let mounted = true;

    async function load() {
      try {
        if (!isSupabaseConfigured || !supabase) {
          setMessage("Connect Supabase to show real ride history.");
          return;
        }

        const { user, profile } = await getCurrentUserProfile();
        riderId = user?.id || "";
        if (!riderId) {
          setMessage("Log in to see your ride history.");
          return;
        }
        if (profile?.role !== "customer" && profile?.role !== "admin") {
          setMessage("This dashboard is only for rider accounts.");
          return;
        }

        const { data, error } = await supabase
          .from("bookings")
          .select("*")
          .eq("customer_id", riderId)
          .order("created_at", { ascending: false });

        if (!mounted) return;
        if (error) setMessage(error.message);
        if (data) setBookings(data as Booking[]);
      } catch (err) {
        if (!mounted) return;
        setMessage(err instanceof Error ? err.message : "Could not load ride history.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();

    if (!isSupabaseConfigured || !supabase) return;
    const client = supabase;
    const channel = client
      .channel("rider-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, (payload) => {
        const next = payload.new as Booking;
        if (!next?.id) return;
        if (riderId && next.customer_id !== riderId) return;
        console.log("[booking:rider-realtime]", {
          route: window.location.pathname,
          bookingId: next.id,
          riderId: next.customer_id,
          driverId: next.driver_id
        });
        setBookings((current) => {
          const exists = current.some((booking) => booking.id === next.id);
          if (exists) return current.map((booking) => (booking.id === next.id ? next : booking));
          return [next, ...current];
        });
      })
      .subscribe();

    return () => {
      mounted = false;
      client.removeChannel(channel);
    };
  }, []);

  return (
    <div className="panel-list ride-history-list">
      <div className="ride-history-heading">
        <h2>Ride history</h2>
        <span>{bookings.length} rides</span>
      </div>
      {loading && (
        <>
          <div className="ride-skeleton" />
          <div className="ride-skeleton small" />
        </>
      )}
      {bookings.map((booking) => (
        <article className="list-item" key={booking.id}>
          <div>
            <strong>{booking.pickup} to {booking.dropoff}</strong>
            <p>{booking.ride_class} - {booking.passengers} rider - {booking.payment_method} - EUR {Number(booking.estimated_price).toFixed(2)}</p>
            {booking.driver_name && <p>{booking.driver_name} - {booking.driver_vehicle}</p>}
            <p>{new Date(booking.created_at).toLocaleDateString()} - {new Date(booking.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
          </div>
          <span className={`status-pill ${booking.status}`}>{booking.status}</span>
        </article>
      ))}
      {!loading && bookings.length === 0 && <p>{message || "No rides yet."}</p>}
    </div>
  );
}
