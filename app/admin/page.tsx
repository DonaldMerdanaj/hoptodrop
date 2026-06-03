"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminDashboard from "@/components/shared/AdminDashboard";
import { requireRole, roleDashboard } from "@/lib/authProfile";
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

      const { user, profile, allowed } = await requireRole(["admin"]);
      if (!user) {
        router.replace("/rider/login");
        return;
      }

      if (!allowed) {
        router.replace(roleDashboard(profile?.role));
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
