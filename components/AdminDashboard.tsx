"use client";

import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import TopNav from "@/components/TopNav";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Booking, BookingStatus } from "@/lib/types";

const statuses: BookingStatus[] = ["pending", "accepted", "assigned", "arrived", "started", "completed", "cancelled"];

type DriverProfile = {
  id: string;
  full_name: string;
  phone: string;
  city: string;
  vehicle_make: string;
  vehicle_model: string;
  license_plate: string;
  approval_status: "draft" | "submitted" | "approved" | "rejected";
};

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [message, setMessage] = useState("");

  async function load() {
    if (!isSupabaseConfigured || !supabase) {
      setMessage("Connect Supabase to use real dispatch.");
      return;
    }

    const { data: bookingData } = await supabase.from("bookings").select("*").order("created_at", { ascending: false });
    const { data: driverData } = await supabase.from("driver_profiles").select("id, full_name, phone, city, vehicle_make, vehicle_model, license_plate, approval_status").order("submitted_at", { ascending: false });

    if (bookingData) setBookings(bookingData as Booking[]);
    if (driverData) setDrivers(driverData as DriverProfile[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function updateStatus(id: string, status: BookingStatus) {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase.from("bookings").update({ status }).eq("id", id);
    if (error) setMessage(error.message);
    else load();
  }

  async function updateDriver(id: string, approval_status: DriverProfile["approval_status"]) {
    if (!isSupabaseConfigured || !supabase) return;
    const { error } = await supabase
      .from("driver_profiles")
      .update({
        approval_status,
        approved_at: approval_status === "approved" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) setMessage(error.message);
    else load();
  }

  return (
    <main className="admin-page">
      <TopNav />
      <section className="admin-card">
        <div className="admin-header">
          <div>
            <div className="eyebrow">Dispatch</div>
            <h1>Admin dashboard</h1>
            <p>Review real rides, driver applications, and live dispatch status.</p>
          </div>
          <button className="secondary-btn compact-btn" onClick={load}>Refresh</button>
        </div>
        {message && <p className="status-message">{message}</p>}

        <div className="panel-list">
          <h2>Driver applications</h2>
          {drivers.map((driver) => (
            <article className="job-card" key={driver.id}>
              <div>
                <strong>{driver.full_name}</strong>
                <p>{driver.city} | {driver.phone}</p>
                <p>{driver.vehicle_make} {driver.vehicle_model} | {driver.license_plate}</p>
                <span className={`status-pill ${driver.approval_status}`}>{driver.approval_status}</span>
              </div>
              <div className="admin-actions">
                <button className="secondary-btn compact-btn" onClick={() => updateDriver(driver.id, "approved")}>Approve</button>
                <button className="secondary-btn compact-btn" onClick={() => updateDriver(driver.id, "rejected")}>Reject</button>
              </div>
            </article>
          ))}
          {drivers.length === 0 && <p>No driver applications yet.</p>}
        </div>

        <div className="panel-list">
          <h2>Ride requests</h2>
          {bookings.map((booking) => (
            <article className="list-item booking-row" key={booking.id}>
              <div>
                <strong>{booking.pickup} to {booking.dropoff}</strong>
                <p>{booking.customer_name} | {booking.customer_phone}</p>
                <p>{booking.ride_class} | {booking.payment_method} | €{Number(booking.estimated_price).toFixed(2)}</p>
                {booking.driver_name && <p>{booking.driver_name} | {booking.driver_vehicle} | {booking.driver_eta} min pickup</p>}
              </div>
              <select value={booking.status} onChange={(event) => updateStatus(booking.id, event.target.value as BookingStatus)}>
                {statuses.map((status) => <option key={status}>{status}</option>)}
              </select>
            </article>
          ))}
          {bookings.length === 0 && <p>No rides yet.</p>}
        </div>
      </section>
      <BottomNav />
    </main>
  );
}
