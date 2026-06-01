"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, MapPinned, UserRound } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import CustomerBookings from "@/components/CustomerBookings";
import TopNav from "@/components/TopNav";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type DashboardUser = {
  avatarUrl: string;
  email: string;
  name: string;
};

export default function ClientDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<DashboardUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadUser() {
      if (!isSupabaseConfigured || !supabase) {
        setError("Supabase is not configured. Add the Supabase URL and anon key.");
        setLoading(false);
        return;
      }

      // fix: read the persisted browser session first so dashboard does not show "Auth session missing" during OAuth restore.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        setError(sessionError.message);
        setLoading(false);
        return;
      }

      const sessionUser = sessionData.session?.user;
      if (!sessionUser) {
        router.replace("/customer-login");
        return;
      }

      if (sessionUser.user_metadata?.role === "driver") {
        // fix: a driver session cannot open the customer dashboard.
        router.replace("/driver/dashboard");
        return;
      }

      const metadata = sessionUser.user_metadata || {};
      setUser({
        avatarUrl: metadata.avatar_url || metadata.picture || "",
        email: sessionUser.email || "",
        name: metadata.full_name || metadata.name || sessionUser.email || "HopToDrop rider"
      });
      setLoading(false);
    }

    loadUser();
  }, [router]);

  async function logout() {
    if (!supabase) return;
    setLoading(true);
    await supabase.auth.signOut();
    router.replace("/customer-login");
  }

  return (
    <main className="auth-page dashboard-page">
      <TopNav />
      <section className="auth-card dashboard-card">
        <div className="eyebrow">Rider dashboard</div>
        <h1>Your rides</h1>

        {loading && <p className="status-message">Loading your profile...</p>}
        {error && <p className="status-message">{error}</p>}

        {!loading && user && (
          <>
            <div className="profile-panel">
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} />
              ) : (
                <span className="profile-fallback">
                  <UserRound size={28} />
                </span>
              )}
              <div>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>
            </div>

            <div className="dashboard-actions">
              <Link className="primary-btn" href="/">
                <MapPinned size={18} />
                Book a ride
              </Link>
              <button className="secondary-btn" type="button" onClick={logout}>
                <LogOut size={18} />
                Log out
              </button>
            </div>

            <CustomerBookings />
          </>
        )}
      </section>
      <BottomNav />
    </main>
  );
}
