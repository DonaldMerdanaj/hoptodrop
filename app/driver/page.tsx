"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getAccountMode } from "@/lib/accountMode";
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

      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user || getAccountMode() !== "driver") {
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
              const { data } = await supabase.auth.getUser();
              if (data.user) router.replace(await driverDestination(data.user.id));
            }}
          />
        )}
      </section>
    </main>
  );
}
