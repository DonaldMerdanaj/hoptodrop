"use client";

import { useEffect, useState } from "react";
import BottomNav from "@/components/BottomNav";
import DriverPortal from "@/components/DriverPortal";
import TopNav from "@/components/TopNav";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function DriverLoginPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    async function checkDriverAuth() {
      if (!isSupabaseConfigured || !supabase) return;
      // fix: check auth on the driver page before showing online controls.
      const { data } = await supabase.auth.getUser();
      setIsAuthenticated(Boolean(data.user));
    }

    checkDriverAuth();
    if (!isSupabaseConfigured || !supabase) return;

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(Boolean(session?.user));
    });

    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <main className="auth-page">
      <TopNav />
      <section className="auth-card">
        <div className="eyebrow">Driver app</div>
        <h1>Go online and accept trips</h1>
        <p>Register as a real driver, wait for approval, then share live location and accept ride requests.</p>
        {!isAuthenticated && <p className="status-message">Please log in to go online.</p>}
        <DriverPortal />
      </section>
      <BottomNav />
    </main>
  );
}
