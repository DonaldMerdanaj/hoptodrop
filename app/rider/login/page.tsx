"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthForm from "@/components/shared/AuthForm";
import { clearAccountMode } from "@/lib/accountMode";
import { getCurrentUserProfile, roleDashboard } from "@/lib/authProfile";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function RiderLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    async function routeExistingSession() {
      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      const { user, profile } = await getCurrentUserProfile();
      if (!user || !profile) {
        setLoading(false);
        return;
      }

      if (profile.role === "driver") {
        if (supabase) await supabase.auth.signOut();
        clearAccountMode();
        setNotice("You were signed in as a driver. Log in here with a rider account to book rides.");
        setLoading(false);
        return;
      }

      router.replace(roleDashboard(profile.role));
    }

    routeExistingSession();
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
