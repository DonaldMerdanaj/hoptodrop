"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getCurrentUserProfile, roleDashboard } from "@/lib/authProfile";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

async function driverDestination(userId: string) {
  if (!supabase) return "/driver/formaplication";

  const { data } = await supabase
    .from("driver_profiles")
    .select("approval_status")
    .eq("id", userId)
    .maybeSingle();

  return data?.approval_status === "approved" ? "/driver/dashboard" : "/driver/formaplication";
}

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

      if (profile?.role && profile.role !== "driver" && profile.role !== "admin") {
        router.replace(roleDashboard(profile.role));
        return;
      }

      if (profile?.role !== "driver") {
        setLoading(false);
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
              if (profile?.role && profile.role !== "driver" && profile.role !== "admin") {
                router.replace(roleDashboard(profile.role));
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
