"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthForm from "@/components/shared/AuthForm";
import { clearAccountMode } from "@/lib/accountMode";
import { ensureUserProfile, getCurrentUserProfile, roleDashboard } from "@/lib/authProfile";
import { ensureRiderProfile } from "@/lib/riderProfile";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function RiderLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let mounted = true;

    async function routeExistingSession() {
      try {
        if (!isSupabaseConfigured) {
          if (mounted) setLoading(false);
          return;
        }

        const { user, profile } = await getCurrentUserProfile();
        if (!user) {
          if (mounted) setLoading(false);
          return;
        }

        if (profile?.role === "driver") {
          if (supabase) await supabase.auth.signOut();
          clearAccountMode();
          if (mounted) {
            setNotice("You were signed in as a driver. Choose a rider Google account to book rides.");
            setLoading(false);
          }
          return;
        }

        if (!profile) {
          // fix: fresh rider Google sessions should create the missing customer profile instead of hanging on the login screen.
          await ensureUserProfile(user, "customer");
          await ensureRiderProfile(user);
          router.replace("/rider/dashboard");
          return;
        }

        router.replace(roleDashboard(profile.role));
      } catch (error) {
        console.error("[rider-login]", error);
        if (mounted) {
          setNotice("We could not finish checking your rider session. Please try logging in again.");
          setLoading(false);
        }
      }
    }

    routeExistingSession();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <main className="auth-page auth-entry-page rider-auth-page">
      <header className="auth-brand-bar rider-auth-hero">
        <span>HopToDrop</span>
        <small>Book rides across Albania</small>
      </header>
      <section className="auth-entry-card">
        {loading && <p className="status-message">Checking rider account...</p>}
        {!loading && (
          <>
            {notice && <p className="auth-dev-warning">{notice}</p>}
            <AuthForm
              role="customer"
              redirectPath="/rider/dashboard"
              title="Start your ride"
              note="Use your rider account to book transfers, follow your driver, and see ride history."
            />
          </>
        )}
      </section>
    </main>
  );
}
