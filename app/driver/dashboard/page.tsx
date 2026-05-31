"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import DriverLocationSender from "@/components/DriverLocationSender";
import DriverRegistrationForm from "@/components/DriverRegistrationForm";
import DriverRequests from "@/components/DriverRequests";
import TopNav from "@/components/TopNav";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type DriverUser = {
  email: string;
};

export default function DriverDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<DriverUser | null>(null);
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
        router.replace("/driver-login");
        return;
      }

      setUser({ email: data.session.user.email || "Driver account" });
      setLoading(false);
    }

    loadDriver();
  }, [router]);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    router.replace("/driver-login");
  }

  return (
    <main className="auth-page driver-dashboard-page">
      <TopNav />
      <section className="driver-dashboard-header">
        <div>
          <div className="eyebrow">Driver dashboard</div>
          <h1>Go online</h1>
          <p>Manage approval, GPS status, and live trips.</p>
        </div>
        <button className="secondary-btn driver-logout-btn" type="button" onClick={signOut}>
          <LogOut size={17} />
        </button>
      </section>

      {loading && <section className="auth-card"><p className="status-message">Checking driver account...</p></section>}
      {message && <section className="auth-card"><p className="status-message">{message}</p></section>}

      {!loading && user && (
        <>
          <section className="auth-card driver-account-card">
            <strong>{user.email}</strong>
            <span>Driver username</span>
          </section>
          <section className="auth-card driver-dashboard-card">
            <DriverLocationSender />
          </section>
          <section className="auth-card driver-dashboard-card">
            <DriverRequests />
          </section>
          <section className="auth-card driver-dashboard-card">
            <DriverRegistrationForm />
          </section>
        </>
      )}
      <BottomNav />
    </main>
  );
}
