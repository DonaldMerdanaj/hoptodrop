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
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let mounted = true;

    async function routeExistingSession() {
      try {
        if (!isSupabaseConfigured) {
          return;
        }

        const { user, profile } = await getCurrentUserProfile();
        if (!user) {
          return;
        }

        if (profile?.role === "driver") {
          if (supabase) await supabase.auth.signOut();
          clearAccountMode();
          if (mounted) {
            setNotice("You were signed in as a driver. Choose a rider Google account to book rides.");
          }
          return;
        }

        if (!profile) {
          // fix: fresh rider Google sessions should create the missing customer profile instead of hanging on the login screen.
          await ensureUserProfile(user, "customer");
          await ensureRiderProfile(user);
          router.replace("/");
          return;
        }

        router.replace(profile.role === "customer" ? "/" : roleDashboard(profile.role));
      } catch (error) {
        console.error("[rider-login]", error);
        if (mounted) {
          setNotice("We could not finish checking your rider session. Please try logging in again.");
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
        {/* fix: keep rider login usable while the session check runs silently in the background. */}
        {notice && <p className="auth-dev-warning">{notice}</p>}
        <AuthForm
          role="customer"
          redirectPath="/"
          title="Start your ride"
          note="Use your rider account to book transfers, follow your driver, and see ride history."
        />
      </section>
    </main>
  );
}
