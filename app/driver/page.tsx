"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DriverApp from "@/components/driver/DriverApp";
import { getCurrentUserProfile } from "@/lib/authProfile";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type DriverProfile = {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  city: string;
  approval_status: "draft" | "submitted" | "approved" | "rejected";
  vehicle_make: string;
  vehicle_model: string;
  license_plate: string;
  vehicle_color: string;
  profile_photo_url: string | null;
  driver_license_url: string | null;
  vehicle_registration_url: string | null;
  insurance_url: string | null;
  status?: "online" | "offline" | "busy";
};

export default function DriverPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [message, setMessage] = useState("Checking driver access...");

  useEffect(() => {
    async function loadDriverApp() {
      if (!isSupabaseConfigured || !supabase) {
        setMessage("Supabase is not configured. Add the Supabase URL and anon key.");
        return;
      }

      const { user, profile: appProfile } = await getCurrentUserProfile();
      if (!user) {
        router.replace("/driver/login");
        return;
      }

      if (!appProfile) {
        router.replace("/driver/login");
        return;
      }

      if (appProfile.role === "admin") {
        router.replace("/admin");
        return;
      }

      if (appProfile.role !== "driver") {
        // fix: driver-domain app guard never routes wrong-role sessions into the rider/main app.
        router.replace("/driver/login");
        return;
      }

      const { data, error } = await supabase
        .from("driver_profiles")
        .select("id,email,full_name,phone,city,approval_status,vehicle_make,vehicle_model,license_plate,vehicle_color,profile_photo_url,driver_license_url,vehicle_registration_url,insurance_url,status")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        setMessage(error.message);
        return;
      }

      if (!data || data.approval_status !== "approved") {
        router.replace("/driver/application");
        return;
      }

      if (data.profile_photo_url) {
        const { data: signedPhoto } = await supabase.storage
          .from("driver-documents")
          .createSignedUrl(data.profile_photo_url, 3600);
        if (signedPhoto?.signedUrl) data.profile_photo_url = signedPhoto.signedUrl;
      }

      setProfile(data as DriverProfile);
    }

    loadDriverApp();
  }, [router]);

  if (profile) return <DriverApp initialProfile={profile} />;

  return (
    <main className="driver-app-loading">
      <section>
        <span>HopToDrop Driver</span>
        <strong>{message}</strong>
      </section>
    </main>
  );
}
