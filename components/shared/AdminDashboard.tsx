"use client";

import { useEffect, useMemo, useState } from "react";
import TopNav from "@/components/shared/TopNav";
import { requireRole } from "@/lib/authProfile";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import type { Booking, BookingStatus } from "@/lib/types";

const statuses: BookingStatus[] = ["pending", "accepted", "assigned", "arrived", "started", "completed", "cancelled"];

type DriverApprovalStatus = "draft" | "submitted" | "approved" | "rejected";

type DriverProfile = {
  id: string;
  full_name: string;
  phone: string;
  city: string;
  vehicle_make: string;
  vehicle_model: string;
  license_plate: string;
  driver_license_url: string | null;
  vehicle_registration_url: string | null;
  insurance_url: string | null;
  approval_status: DriverApprovalStatus;
  status?: "online" | "offline" | "busy";
};

function money(value: number) {
  return `EUR ${Number(value || 0).toFixed(2)}`;
}

export default function AdminDashboard() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [message, setMessage] = useState("");
  const [driverFilter, setDriverFilter] = useState<DriverApprovalStatus | "all">("submitted");
  const [bookingFilter, setBookingFilter] = useState<BookingStatus | "all">("all");

  async function load() {
    if (!isSupabaseConfigured || !supabase) {
      setMessage("Connect Supabase to use real dispatch.");
      return;
    }

    const { allowed, user, profile } = await requireRole(["admin"]);
    if (!allowed) {
      setMessage("Admin access required.");
      console.log("[admin:blocked]", {
        route: window.location.pathname,
        userId: user?.id,
        email: user?.email,
        role: profile?.role
      });
      return;
    }

    const { data: bookingData } = await supabase.from("bookings").select("*").order("created_at", { ascending: false });
    const { data: driverData } = await supabase
      .from("driver_profiles")
      .select("id, full_name, phone, city, vehicle_make, vehicle_model, license_plate, driver_license_url, vehicle_registration_url, insurance_url, approval_status, status")
      .order("submitted_at", { ascending: false });

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

  async function updateDriver(id: string, approval_status: DriverApprovalStatus) {
    if (!isSupabaseConfigured || !supabase) return;
    const rejectionReason = approval_status === "rejected"
      ? window.prompt("Reason for rejection (shown to the driver):")?.trim()
      : null;
    if (approval_status === "rejected" && !rejectionReason) return;

    const { error } = await supabase
      .from("driver_profiles")
      .update({
        approval_status,
        rejection_reason: rejectionReason,
        approved_at: approval_status === "approved" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);

    if (error) setMessage(error.message);
    else load();
  }

  async function openDocument(path: string | null) {
    if (!path || !supabase) return;
    const { data, error } = await supabase.storage.from("driver-documents").createSignedUrl(path, 300);
    if (error) {
      setMessage(error.message);
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  const stats = useMemo(() => {
    const completedRevenue = bookings
      .filter((booking) => booking.status === "completed")
      .reduce((total, booking) => total + Number(booking.estimated_price || 0), 0);

    return {
      pendingDrivers: drivers.filter((driver) => driver.approval_status === "submitted").length,
      approvedDrivers: drivers.filter((driver) => driver.approval_status === "approved").length,
      onlineDrivers: drivers.filter((driver) => driver.status === "online" || driver.status === "busy").length,
      pendingRides: bookings.filter((booking) => booking.status === "pending").length,
      activeRides: bookings.filter((booking) => ["accepted", "arrived", "started"].includes(booking.status)).length,
      completedRevenue,
      commission: completedRevenue * 0.1
    };
  }, [bookings, drivers]);

  const filteredDrivers = useMemo(() => {
    return drivers.filter((driver) => driverFilter === "all" || driver.approval_status === driverFilter);
  }, [driverFilter, drivers]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((booking) => bookingFilter === "all" || booking.status === bookingFilter);
  }, [bookingFilter, bookings]);

  return (
    <main className="admin-page">
      <TopNav />
      <section className="admin-card">
        <div className="admin-header">
          <div>
            <div className="eyebrow">Dispatch</div>
            <h1>Admin dashboard</h1>
            <p>Review real rides, driver applications, live driver status, revenue, and commission.</p>
          </div>
          <button className="secondary-btn compact-btn" onClick={load}>Refresh</button>
        </div>
        {message && <p className="status-message">{message}</p>}

        <div className="admin-stat-grid">
          <AdminStat label="Pending drivers" value={String(stats.pendingDrivers)} />
          <AdminStat label="Approved drivers" value={String(stats.approvedDrivers)} />
          <AdminStat label="Online drivers" value={String(stats.onlineDrivers)} />
          <AdminStat label="Pending rides" value={String(stats.pendingRides)} />
          <AdminStat label="Active rides" value={String(stats.activeRides)} />
          <AdminStat label="Completed revenue" value={money(stats.completedRevenue)} />
          <AdminStat label="HopToDrop 10%" value={money(stats.commission)} />
        </div>

        <div className="panel-list">
          <div className="admin-panel-heading">
            <h2>Driver applications</h2>
            <select value={driverFilter} onChange={(event) => setDriverFilter(event.target.value as DriverApprovalStatus | "all")}>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="draft">Draft</option>
              <option value="all">All</option>
            </select>
          </div>
          {filteredDrivers.map((driver) => (
            <article className="job-card" key={driver.id}>
              <div>
                <strong>{driver.full_name}</strong>
                <p>{driver.city} | {driver.phone}</p>
                <p>{driver.vehicle_make} {driver.vehicle_model} | {driver.license_plate}</p>
                <span className={`status-pill ${driver.approval_status}`}>{driver.approval_status}</span>
                {driver.status && <span className={`status-pill ${driver.status}`}>{driver.status}</span>}
                <div className="admin-actions">
                  <button className="secondary-btn compact-btn" onClick={() => openDocument(driver.driver_license_url)}>License</button>
                  <button className="secondary-btn compact-btn" onClick={() => openDocument(driver.vehicle_registration_url)}>Registration</button>
                  <button className="secondary-btn compact-btn" onClick={() => openDocument(driver.insurance_url)}>Insurance</button>
                </div>
              </div>
              <div className="admin-actions">
                <button className="secondary-btn compact-btn" onClick={() => updateDriver(driver.id, "approved")}>Approve</button>
                <button className="secondary-btn compact-btn" onClick={() => updateDriver(driver.id, "rejected")}>Reject</button>
              </div>
            </article>
          ))}
          {filteredDrivers.length === 0 && <p>No driver applications in this filter.</p>}
        </div>

        <div className="panel-list">
          <div className="admin-panel-heading">
            <h2>Ride requests</h2>
            <select value={bookingFilter} onChange={(event) => setBookingFilter(event.target.value as BookingStatus | "all")}>
              <option value="all">All</option>
              {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          {filteredBookings.map((booking) => (
            <article className="list-item booking-row" key={booking.id}>
              <div>
                <strong>{booking.pickup} to {booking.dropoff}</strong>
                <p>{booking.customer_name} | {booking.customer_phone}</p>
                <p>{booking.ride_class} | {booking.payment_method} | {money(Number(booking.estimated_price))}</p>
                {booking.driver_name && <p>{booking.driver_name} | {booking.driver_vehicle} | {booking.driver_eta} min pickup</p>}
              </div>
              <select value={booking.status} onChange={(event) => updateStatus(booking.id, event.target.value as BookingStatus)}>
                {statuses.map((status) => <option key={status}>{status}</option>)}
              </select>
            </article>
          ))}
          {filteredBookings.length === 0 && <p>No rides in this filter.</p>}
        </div>
      </section>
    </main>
  );
}

function AdminStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="admin-stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
