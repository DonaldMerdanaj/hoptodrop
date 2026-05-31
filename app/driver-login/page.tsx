"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import BottomNav from "@/components/BottomNav";
import TopNav from "@/components/TopNav";
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
      if (session?.user) router.replace("/driver/dashboard");
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
              <strong>Driver account first</strong>
              <span>Create an account and confirm the email link. After login, your driver dashboard will open.</span>
            </div>
          </>
        )}
      </section>
      <BottomNav />
    </main>
  );
}
