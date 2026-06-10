"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminDashboard from "@/components/shared/AdminDashboard";
import { requireRole, roleDashboard } from "@/lib/authProfile";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

function adminAuthMessage(errorMessage: string) {
  if (errorMessage.toLowerCase().includes("invalid login credentials")) {
    return "Invalid admin email or password.";
  }

  return errorMessage;
}

export default function AdminPage() {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      if (!isSupabaseConfigured || !supabase) {
        router.replace("/");
        return;
      }

      const { user, profile, allowed } = await requireRole(["admin"]);
      if (!user) {
        // fix: /admin stays an admin entry point instead of falling into rider login.
        setShowLogin(true);
        setLoading(false);
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

  async function submitAdminLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || submitting) return;

    setSubmitting(true);
    setMessage("Checking admin account...");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setMessage(adminAuthMessage(error.message));
        return;
      }

      const { user, profile, allowed } = await requireRole(["admin"]);
      if (!user || !allowed) {
        await supabase.auth.signOut();
        setMessage(`This account is ${profile?.role || "not approved"} and cannot access admin.`);
        return;
      }

      setAllowed(true);
      setShowLogin(false);
      setMessage("");
    } finally {
      setSubmitting(false);
    }
  }

  async function signInWithGoogle() {
    if (!supabase || submitting) return;
    setSubmitting(true);
    setMessage("Opening Google login...");
    const origin = typeof window === "undefined" ? "https://hoptodrop.com" : window.location.origin;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/admin")}&method=google`,
        queryParams: { prompt: "select_account consent" }
      }
    });

    if (error) {
      setMessage(adminAuthMessage(error.message));
      setSubmitting(false);
    }
  }

  async function sendPasswordReset() {
    if (!supabase || submitting) return;
    if (!email) {
      setMessage("Enter the admin email first, then request the reset link.");
      return;
    }

    setSubmitting(true);
    setMessage("Sending password reset link...");
    const origin = typeof window === "undefined" ? "https://hoptodrop.com" : window.location.origin;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      // fix: admin reset emails return to the password reset screen instead of the rider home page.
      redirectTo: `${origin}/auth/callback?type=recovery&next=${encodeURIComponent("/admin")}`
    });
    setSubmitting(false);

    if (error) setMessage(adminAuthMessage(error.message));
    else setMessage("Password reset link sent. Check inbox and spam/junk.");
  }

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

  if (showLogin) {
    return (
      <main className="admin-page">
        <section className="admin-card">
          <div className="eyebrow">Operations</div>
          <h1>Admin sign in</h1>
          <p>Use an approved HopToDrop admin account to manage drivers and bookings.</p>
          <form className="auth-entry-form" onSubmit={submitAdminLogin}>
            <input
              type="email"
              placeholder="Admin email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={submitting}
              required
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
              required
            />
            <button className="primary-btn auth-main-btn" type="submit" disabled={submitting}>
              {submitting ? "Please wait..." : "Continue"}
            </button>
            <div className="auth-divider"><span />or<span /></div>
            <button className="secondary-btn auth-google-btn" type="button" onClick={signInWithGoogle} disabled={submitting}>
              <span className="google-mark">G</span>
              Continue with Google
            </button>
            <button className="auth-toggle" type="button" onClick={sendPasswordReset} disabled={submitting}>
              Forgot password? Send reset link
            </button>
            {message && <p className="status-message">{message}</p>}
          </form>
        </section>
      </main>
    );
  }

  return allowed ? <AdminDashboard /> : null;
}
