"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { ensureUserProfile, getCurrentUserProfile, roleDashboard } from "@/lib/authProfile";
import { driverDestination } from "@/lib/driverRouting";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function DriverPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function routeDriverSession() {
      if (!isSupabaseConfigured || !supabase) {
        setLoading(false);
        return;
      }

      const { user, profile } = await getCurrentUserProfile();
      if (!user) {
        setLoading(false);
        return;
      }

      if (!profile) {
        await ensureUserProfile(user, "driver");
        router.replace(await driverDestination(user.id));
        return;
      }

      if (profile.role !== "driver" && profile.role !== "admin") {
        router.replace(roleDashboard(profile.role));
        return;
      }

      if (profile.role === "admin") {
        router.replace("/admin");
        return;
      }

      router.replace(await driverDestination(user.id));
    }

    routeDriverSession();
  }, [router]);

  return (
    <main className="auth-page auth-entry-page">
      <header className="auth-brand-bar">HopToDrop</header>
      <section className="auth-entry-card">
        {loading && <p className="status-message">Checking driver account...</p>}
        {!loading && (
          <AuthForm
            role="driver"
            redirectPath="/driver"
            onAuthChange={async () => {
              if (!supabase) return;
              const { user, profile } = await getCurrentUserProfile();
              if (!user) return;
              if (!profile) {
                await ensureUserProfile(user, "driver");
                router.replace(await driverDestination(user.id));
                return;
              }
              if (profile.role !== "driver" && profile.role !== "admin") {
                router.replace(roleDashboard(profile.role));
                return;
              }
              if (profile.role === "admin") {
                router.replace("/admin");
                return;
              }
              router.replace(await driverDestination(user.id));
            }}
          />
        )}
      </section>
    </main>
  );
}
