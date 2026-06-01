"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import BottomNav from "@/components/BottomNav";
import TopNav from "@/components/TopNav";
import { setAccountMode } from "@/lib/accountMode";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function DriverLoginPage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkDriverAuth() {
      if (!isSupabaseConfigured || !supabase) {
        setLoading(false);
        return;
      }

      // fix: authenticated drivers are sent to the real dashboard URL.
      const { data } = await supabase.auth.getSession();
      if (data.session?.user) {
        // fix: the same Supabase account can open driver mode; driver approval is checked in driver_profiles.
        setAccountMode("driver");
        setIsAuthenticated(true);
        router.replace("/driver/dashboard");
        return;
      }

      setLoading(false);
    }

    checkDriverAuth();
    if (!isSupabaseConfigured || !supabase) return;

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
      if (session?.user) {
        setAccountMode("driver");
        router.replace("/driver/dashboard");
      }
    });

    return () => data.subscription.unsubscribe();
  }, [router]);

  return (
    <main className="auth-page">
      <TopNav />
      <section className="auth-card">
        <div className="eyebrow">Driver app</div>
        <h1>Go online and accept trips</h1>
        <p>Register as a real driver, wait for approval, then share live location and accept ride requests.</p>
        {loading && <p className="status-message">Checking driver account...</p>}
        {!loading && !isAuthenticated && (
          <>
            <p className="status-message">Please log in to go online.</p>
            <AuthForm role="driver" redirectPath="/driver/dashboard" />
            <div className="driver-login-note">
              <strong>Use your account</strong>
              <span>You can use the same email as rider and driver. Driver approval is handled inside the driver dashboard.</span>
            </div>
          </>
        )}
      </section>
      <BottomNav />
    </main>
  );
}
