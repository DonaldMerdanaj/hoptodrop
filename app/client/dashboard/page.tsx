"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarClock, LogOut, MapPinned, UserRound } from "lucide-react";
import CustomerBookings from "@/components/CustomerBookings";
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
    let mounted = true;

    async function loadUser() {
      try {
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
        if (!mounted) return;
        setUser({
          avatarUrl: customerProfile?.avatar_url || "",
          email: customerProfile?.email || sessionUser.email || "",
          name: customerProfile?.full_name || sessionUser.email || "HopToDrop rider",
          phone: customerProfile?.phone || ""
        });
        setError("");
      } catch (err) {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : "Could not load your rider profile.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadUser();

    return () => {
      mounted = false;
    };
  }, [router]);

  async function logout() {
    if (!supabase) return;
    setLoading(true);
    await supabase.auth.signOut();
    clearAccountMode();
    router.replace("/customer-login");
  }

  return (
    <main className="auth-page dashboard-page rider-dashboard-page">
      <header className="rider-dashboard-top">
        <Link href="/" aria-label="Back to booking">
          <ArrowLeft size={22} />
        </Link>
        <strong>Rides</strong>
        <button type="button" onClick={logout} aria-label="Log out">
          <LogOut size={19} />
        </button>
      </header>

      <section className="rider-hero-card">
        <div>
          <span>HopToDrop</span>
          <h1>Your ride dashboard</h1>
          <p>Track active rides and review your transfer history.</p>
        </div>
        <CalendarClock size={30} />
      </section>

      <section className="dashboard-card rider-dashboard-card">
        {loading && (
          <div className="rider-loading-card">
            <span />
            <div>
              <strong>Loading your profile</strong>
              <p>Checking your rider account...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="rider-error-card">
            <strong>Profile could not load</strong>
            <p>{error}</p>
            <button className="secondary-btn" type="button" onClick={() => window.location.reload()}>
              Try again
            </button>
          </div>
        )}

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
            </div>

            <CustomerBookings />
          </>
        )}
      </section>
    </main>
  );
}
