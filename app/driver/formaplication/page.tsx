"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, LogOut } from "lucide-react";
import DriverRegistrationForm from "@/components/DriverRegistrationForm";
import TopNav from "@/components/TopNav";
import { clearAccountMode, getAccountMode } from "@/lib/accountMode";
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

      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user || getAccountMode() !== "driver") {
        router.replace("/driver");
        return;
      }

      const { data: profileData } = await supabase
        .from("driver_profiles")
        .select("approval_status")
        .eq("id", user.id)
        .maybeSingle();

      if (profileData?.approval_status === "approved") {
        router.replace("/driver/dashboard");
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
    router.replace("/driver");
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
