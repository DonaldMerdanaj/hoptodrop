"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getCurrentUserProfile, roleDashboard } from "@/lib/authProfile";
import { driverDestination } from "@/lib/driverRouting";
import { isSupabaseConfigured } from "@/lib/supabase";

export default function CustomerLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

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
        router.replace(await driverDestination(user.id));
        return;
      }

      router.replace(roleDashboard(profile.role));
    }

    routeExistingSession();
  }, [router]);

  return (
    <main className="auth-page auth-entry-page">
      <header className="auth-brand-bar">HopToDrop</header>
      <section className="auth-entry-card">
        {loading && <p className="status-message">Checking customer account...</p>}
        {!loading && <AuthForm role="customer" redirectPath="/client/dashboard" />}
      </section>
    </main>
  );
}
