"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminDashboard from "@/components/AdminDashboard";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

export default function AdminPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAdmin() {
      if (!isSupabaseConfigured || !supabase) {
        router.replace("/");
        return;
      }

      // fix: protect admin with the same persisted browser session used by customer and driver login.
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;

      if (!user) {
        router.replace("/customer-login");
        return;
      }

      if (user.user_metadata?.role !== "admin") {
        router.replace("/");
        return;
      }

      setAllowed(true);
      setLoading(false);
    }

    checkAdmin();
  }, [router]);

  if (loading) {
    return (
      <main className="admin-page">
        <section className="admin-card">
          <div className="eyebrow">Dispatch</div>
          <h1>Admin dashboard</h1>
          <p className="status-message">Checking admin access...</p>
        </section>
      </main>
    );
  }

  return allowed ? <AdminDashboard /> : null;
}
