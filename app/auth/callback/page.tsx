"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { clearAccountMode, clearAuthIntent, getAuthIntent, setAccountMode, type AccountMode } from "@/lib/accountMode";
import { ensureUserProfile, getCurrentUserProfile } from "@/lib/authProfile";
import { ensureRiderProfile } from "@/lib/riderProfile";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

function callbackModeFromUrl(searchParams: { get: (name: string) => string | null }) {
  if (typeof window !== "undefined" && window.location.hostname === "driver.hoptodrop.com") {
    return "driver";
  }

  if (getAuthIntent() === "driver") return "driver";

  if (searchParams.get("mode") === "driver" || searchParams.get("next")?.includes("driver.hoptodrop.com")) {
    return "driver";
  }

  return "customer";
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Finishing secure sign in...");
  const [error, setError] = useState("");
  const callbackMode = callbackModeFromUrl(searchParams);
  const authMethod = searchParams.get("method") === "google" ? "Google login" : "Email confirmation";
  const errorBackHref = callbackMode === "driver" ? "https://driver.hoptodrop.com/login" : "/rider/login";

  useEffect(() => {
    async function finishAuth() {
      if (!isSupabaseConfigured || !supabase) {
        setError("Supabase is not configured. Add the Supabase URL and anon key.");
        return;
      }

      const code = searchParams.get("code");
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const isRecoveryLink = searchParams.get("type") === "recovery" || hashParams.get("type") === "recovery";
      // fix: callback role must come from the OAuth/email URL, never stale localStorage accountMode.
      // fix: driver callbacks always finish on driver.hoptodrop.com, ignoring stale or unsafe next values.
      const next = callbackMode === "driver" ? "https://driver.hoptodrop.com/" : searchParams.get("next") || "/rider/dashboard";
      const oauthError = searchParams.get("error_description") || searchParams.get("error");

      if (callbackMode === "driver" && window.location.hostname !== "driver.hoptodrop.com" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1") {
        // fix: if Supabase falls back to the main Site URL, move the OAuth code/tokens to the driver origin before session exchange.
        window.location.replace(`https://driver.hoptodrop.com/auth/callback${window.location.search}${window.location.hash}`);
        return;
      }

      if (oauthError) {
        setError(oauthError);
        return;
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          setError(exchangeError.message);
          return;
        }
      } else {
        // fix: support Supabase email confirmation links that restore the session from URL tokens instead of an OAuth code.
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });

          if (sessionError) {
            setError(sessionError.message);
            return;
          }
        } else {
          const { data } = await supabase.auth.getSession();
          if (!data.session) {
            setError("The confirmation link is invalid or expired. Please request a new sign-up email.");
            return;
          }
        }
      }

      if (isRecoveryLink) {
        // fix: password recovery links open the reset form instead of redirecting to the rider home page.
        router.replace(`/reset-password${window.location.hash || ""}`);
        return;
      }

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setError(userError?.message || "Could not load the signed-in user.");
        return;
      }

      const { profile } = await getCurrentUserProfile();
      if (profile?.role === "admin") {
        setMessage("Email confirmed. Redirecting...");
        router.replace("/admin");
        return;
      }

      if (callbackMode === "driver" && profile && profile.role !== "driver") {
        // fix: wrong-role driver OAuth attempts should not leave a rider session stuck inside the driver portal.
        await supabase.auth.signOut();
        clearAccountMode();
        clearAuthIntent();
        setError(`This Google account is registered as ${profile.role}. Choose a different Google account for the driver portal, or use the rider app.`);
        return;
      }

      if (!profile) await ensureUserProfile(userData.user, callbackMode as "customer" | "driver");
      // fix: OAuth/email callback records whether the user entered customer or driver mode.
      setAccountMode(callbackMode as AccountMode);
      clearAuthIntent();
      if (callbackMode === "customer") {
        // fix: rider profile creation depends on the auth mode, and driver accounts may also book rides.
        await ensureRiderProfile(userData.user);
      }

      setMessage("Email confirmed. Redirecting...");
      if (/^https?:\/\//.test(next)) {
        window.location.replace(next);
        return;
      }
      router.replace(next);
    }

    finishAuth();
  }, [callbackMode, router, searchParams]);

  return (
    <main className="auth-page">
      <section className="auth-card callback-card">
        {/* fix: callback label reflects the auth method instead of always saying Google login. */}
        <div className="eyebrow">{authMethod}</div>
        <h1>{error ? "Sign in failed" : "Welcome back"}</h1>
        <p>{error || message}</p>
        {error && (
          <Link className="primary-btn" href={errorBackHref}>
            Back to login
          </Link>
        )}
      </section>
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-page">
          <section className="auth-card callback-card">
            <div className="eyebrow">Secure sign in</div>
            <h1>Welcome back</h1>
            <p>Finishing secure sign in...</p>
          </section>
        </main>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
