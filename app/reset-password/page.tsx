"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { getCurrentUserProfile } from "@/lib/authProfile";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

function ResetPasswordContent() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("Opening secure reset link...");
  const [doneHref, setDoneHref] = useState("/admin");

  useEffect(() => {
    async function loadRecoverySession() {
      if (!isSupabaseConfigured || !supabase) {
        setMessage("Supabase is not configured.");
        setLoading(false);
        return;
      }

      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      if (accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (error) {
          setMessage(error.message);
          setLoading(false);
          return;
        }

        window.history.replaceState(null, "", "/reset-password");
      }

      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setMessage("This reset link is expired. Please request a new password reset email.");
        setLoading(false);
        return;
      }

      const { profile } = await getCurrentUserProfile();
      if (profile?.role === "driver") setDoneHref("https://driver.hoptodrop.com/");
      else if (profile?.role === "customer") setDoneHref("/rider/dashboard");
      else setDoneHref("/admin");

      setReady(true);
      setLoading(false);
      setMessage("");
    }

    loadRecoverySession();
  }, []);

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase || saving) return;

    if (password.length < 8) {
      setMessage("Use at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setMessage("The two passwords do not match.");
      return;
    }

    setSaving(true);
    setMessage("Saving new password...");
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    // fix: Supabase recovery links now complete with a real password update screen.
    setReady(false);
    setMessage("Password updated successfully.");
  }

  return (
    <main className="auth-page">
      <section className="auth-card">
        <form className="auth-entry-form" onSubmit={submitPassword}>
          <div className="eyebrow">Account security</div>
          <h1>Set new password</h1>
          {loading && <p className="status-message">{message}</p>}
          {!loading && ready && (
            <>
              <input
                type="password"
                placeholder="New password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={saving}
                required
              />
              <input
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={saving}
                required
              />
              <button className="primary-btn auth-main-btn" type="submit" disabled={saving}>
                {saving ? "Saving..." : "Update password"}
              </button>
            </>
          )}
          {!loading && !ready && (
            <Link className="primary-btn auth-main-btn" href={doneHref}>
              Continue
            </Link>
          )}
          {message && !loading && <p className="status-message">{message}</p>}
        </form>
      </section>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-page">
          <section className="auth-card"><p className="status-message">Opening secure reset link...</p></section>
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}
