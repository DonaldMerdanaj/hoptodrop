"use client";

import { useEffect, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type DriverProfile = {
  full_name: string;
  phone: string;
  approval_status: "draft" | "submitted" | "approved" | "rejected";
  vehicle_make: string;
  vehicle_model: string;
  license_plate: string;
};

export default function DriverLocationSender() {
  const [message, setMessage] = useState("");
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [online, setOnline] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!isSupabaseConfigured || !supabase) return;
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return;

      const { data } = await supabase
        .from("driver_profiles")
        .select("full_name, phone, approval_status, vehicle_make, vehicle_model, license_plate")
        .eq("id", userData.user.id)
        .maybeSingle();

      if (data) setProfile(data as DriverProfile);

      const { data: location } = await supabase
        .from("driver_locations")
        .select("status")
        .eq("id", userData.user.id)
        .maybeSingle();
      setOnline(location?.status === "online");
    }

    loadProfile();
  }, []);

  useEffect(() => {
    return () => {
      // fix: clear any active GPS watcher when the driver console unmounts.
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
    };
  }, []);

  async function goOnline() {
    setMessage("Getting GPS location...");

    if (!isSupabaseConfigured || !supabase) {
      setMessage("Supabase is required for live driver location.");
      return;
    }

    if (!profile) {
      setMessage("Complete driver registration first.");
      return;
    }

    if (profile.approval_status !== "approved") {
      setMessage("Your driver profile must be approved before going online.");
      return;
    }

    if (!navigator.geolocation) {
      setMessage("GPS is not available on this device.");
      return;
    }

    const client = supabase;
    const vehicle = `${profile.vehicle_make} ${profile.vehicle_model} ${profile.license_plate}`.trim();

    // fix: store the watch id so it can be cleared on offline/unmount.
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const { data: userData } = await client.auth.getUser();
        const user = userData.user;
        if (!user) {
          setMessage("Please login first.");
          return;
        }

        const { error } = await client.from("driver_locations").upsert({
          id: user.id,
          driver_name: profile.full_name,
          vehicle,
          status: "online",
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          updated_at: new Date().toISOString()
        });

        // fix: store the driver's live route trail for the active assigned/accepted/started ride.
        const { data: activeBooking } = await client
          .from("bookings")
          .select("id, status")
          .eq("driver_id", user.id)
          .in("status", ["assigned", "accepted", "started"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeBooking) {
          await client.from("booking_route_points").insert({
            booking_id: activeBooking.id,
            driver_id: user.id,
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            phase: activeBooking.status,
            recorded_at: new Date().toISOString()
          });
        }

        if (error) setMessage(error.message);
        else {
          setOnline(true);
          setMessage("You are online. Your location is live.");
        }
      },
      () => setMessage("Location permission denied."),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }

  async function goOffline() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (!isSupabaseConfigured || !supabase) {
      setMessage("Supabase is required for live driver location.");
      return;
    }

    const { data } = await supabase.auth.getUser();
    if (!data.user) return setMessage("Please login first.");
    await supabase.from("driver_locations").update({ status: "offline" }).eq("id", data.user.id);
    setOnline(false);
    setMessage("You are offline.");
  }

  return (
    <div className="driver-controls">
      <div className={`driver-status ${online ? "approved" : profile?.approval_status || "draft"}`}>
        <strong>{online ? "Online and visible to riders" : profile?.approval_status === "approved" ? "Ready to go online" : "Driver approval required"}</strong>
        <span>{profile?.approval_status === "approved" ? "Keep this page open while driving." : "Submit registration before going online."}</span>
      </div>
      <div className="driver-online-actions">
        <button className="primary-btn" onClick={goOnline}>{online ? "Refresh live GPS" : "Go online"}</button>
        <button className="secondary-btn" onClick={goOffline}>Go offline</button>
      </div>
      {message && <p className="status-message">{message}</p>}
    </div>
  );
}
