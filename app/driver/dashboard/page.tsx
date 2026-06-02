"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CarFront, CheckCircle2, LogOut, MapPinned } from "lucide-react";
import DriverLocationSender from "@/components/DriverLocationSender";
import DriverRequests from "@/components/DriverRequests";
import TopNav from "@/components/TopNav";
import { clearAccountMode, getAccountMode } from "@/lib/accountMode";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type DriverUser = {
  email: string;
};

type DriverProfile = {
  approval_status: "draft" | "submitted" | "approved" | "rejected";
  full_name: string;
  vehicle_make: string;
  vehicle_model: string;
  license_plate: string;
};

export default function DriverDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<DriverUser | null>(null);
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadDriver() {
      if (!isSupabaseConfigured || !supabase) {
        setMessage("Supabase is not configured. Add the Supabase URL and anon key.");
        setLoading(false);
        return;
      }

      // fix: driver dashboard is protected and uses the persisted session before rendering live driver tools.
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) {
        router.replace("/driver");
        return;
      }

      if (getAccountMode() !== "driver") {
        // fix: visiting driver dashboard with a customer session must not switch the account into driver mode.
        router.replace("/driver");
        return;
      }

      setUser({ email: data.session.user.email || "Driver account" });

      const { data: profileData } = await supabase
        .from("driver_profiles")
        .select("approval_status, full_name, vehicle_make, vehicle_model, license_plate")
        .eq("id", data.session.user.id)
        .maybeSingle();

      const nextProfile = profileData as DriverProfile | null;
      if (nextProfile?.approval_status !== "approved") {
        router.replace("/driver/formaplication");
        return;
      }

      setProfile(nextProfile);
      setLoading(false);
    }

    loadDriver();
  }, [router]);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    clearAccountMode();
    router.replace("/driver");
  }

  return (
    <main className="auth-page driver-dashboard-page">
      <TopNav />
      <section className="driver-dashboard-header">
        <div>
          <div className="eyebrow">Driver dashboard</div>
          <h1>Driver app</h1>
          <p>Go online, accept trips, navigate, and complete rides.</p>
        </div>
        <button className="secondary-btn driver-logout-btn" type="button" onClick={signOut}>
          <LogOut size={17} />
        </button>
      </section>

      {loading && <section className="auth-card"><p className="status-message">Checking driver account...</p></section>}
      {message && <section className="auth-card"><p className="status-message">{message}</p></section>}

      {!loading && user && (
        <>
          <section className="auth-card driver-command-card">
            <div className="driver-command-top">
              <span className="driver-live-dot approved" />
              <div>
                <strong>{profile?.full_name || "Driver account"}</strong>
                <span>{user.email}</span>
              </div>
            </div>
            <div className="driver-command-grid">
              <div>
                <CheckCircle2 size={18} />
                <span>Status</span>
                <strong>{profile?.approval_status || "setup"}</strong>
              </div>
              <div>
                <CarFront size={18} />
                <span>Vehicle</span>
                <strong>{profile ? `${profile.vehicle_make} ${profile.vehicle_model}` : "Not added"}</strong>
              </div>
              <div>
                <MapPinned size={18} />
                <span>Plate</span>
                <strong>{profile?.license_plate || "Pending"}</strong>
              </div>
            </div>
          </section>

          <section className="auth-card driver-dashboard-card">
            <DriverLocationSender />
          </section>

          <section className="auth-card driver-dashboard-card">
            <DriverRequests />
          </section>
        </>
      )}
    </main>
  );
}
