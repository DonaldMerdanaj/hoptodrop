"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, LogOut } from "lucide-react";
import DriverRegistrationForm from "@/components/driver/DriverRegistrationForm";
import TopNav from "@/components/shared/TopNav";
import { clearAccountMode } from "@/lib/accountMode";
import { requireRole, roleDashboard } from "@/lib/authProfile";
import { driverDestination } from "@/lib/driverRouting";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type DriverProfile = {
  approval_status?: "draft" | "submitted" | "approved" | "rejected";
};

export default function DriverApplicationPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<DriverProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadApplication() {
      if (!isSupabaseConfigured || !supabase) {
        setMessage("Supabase is not configured. Add the Supabase URL and anon key.");
        setLoading(false);
        return;
      }

      const { user, profile: appProfile, allowed } = await requireRole(["driver", "admin"]);
      if (!user) {
        router.replace("/driver/login");
        return;
      }

      if (!allowed) {
        router.replace(roleDashboard(appProfile?.role));
        return;
      }

      if (appProfile?.role === "admin") {
        router.replace("/admin");
        return;
      }

      const { data: profileData } = await supabase
        .from("driver_profiles")
        .select("approval_status")
        .eq("id", user.id)
        .maybeSingle();

      if (profileData?.approval_status === "approved") {
        router.replace(await driverDestination(user.id));
        return;
      }

      setProfile(profileData as DriverProfile | null);
      setLoading(false);
    }

    loadApplication();
  }, [router]);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    clearAccountMode();
    router.replace("/driver/login");
  }

  return (
    <main className="auth-page driver-dashboard-page">
      <TopNav />
      <section className="driver-dashboard-header">
        <div>
          <div className="eyebrow">Driver application</div>
          <h1>Complete application</h1>
          <p>{profile?.approval_status === "submitted" ? "Your application is waiting for admin approval." : "Fill this in once. You can go online after approval."}</p>
        </div>
        <button className="secondary-btn driver-logout-btn" type="button" onClick={signOut}>
          <LogOut size={17} />
        </button>
      </section>

      {loading && <section className="auth-card"><p className="status-message">Checking driver application...</p></section>}
      {message && <section className="auth-card"><p className="status-message">{message}</p></section>}
      {!loading && (
        <section className="auth-card driver-dashboard-card">
          <div className="driver-form-intro">
            <FileText size={19} />
            <div>
              <strong>{profile ? "Update driver application" : "Start driver application"}</strong>
              <span>After approval, HopToDrop will open your live driver dashboard automatically.</span>
            </div>
          </div>
          <DriverRegistrationForm />
        </section>
      )}
    </main>
  );
}
