"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, MapPinned, UserRound } from "lucide-react";
import CustomerBookings from "@/components/CustomerBookings";
import TopNav from "@/components/TopNav";
import { clearAccountMode } from "@/lib/accountMode";
import { requireRole, roleDashboard } from "@/lib/authProfile";
import { getCustomerProfile } from "@/lib/customerProfile";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type DashboardUser = {
  avatarUrl: string;
  email: string;
  name: string;
  phone: string;
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

      const { user: sessionUser, profile: appProfile, allowed } = await requireRole(["customer", "admin"]);
      if (!sessionUser) {
        router.replace("/customer-login");
        return;
      }

      if (!allowed) {
        router.replace(roleDashboard(appProfile?.role));
        return;
      }

      // fix: dashboard reads the real customer profile row stored in Supabase.
      const customerProfile = await getCustomerProfile(sessionUser);
      setUser({
        avatarUrl: customerProfile?.avatar_url || "",
        email: customerProfile?.email || sessionUser.email || "",
        name: customerProfile?.full_name || sessionUser.email || "HopToDrop rider",
        phone: customerProfile?.phone || ""
      });
      setLoading(false);
    }

    loadUser();
  }, [router]);

  async function logout() {
    if (!supabase) return;
    setLoading(true);
    await supabase.auth.signOut();
    clearAccountMode();
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
                {user.phone && <span>{user.phone}</span>}
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
    </main>
  );
}
