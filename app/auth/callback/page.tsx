"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { setAccountMode, type AccountMode } from "@/lib/accountMode";
import { ensureCustomerProfile } from "@/lib/customerProfile";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Finishing secure sign in...");
  const [error, setError] = useState("");

  useEffect(() => {
    async function finishAuth() {
      if (!isSupabaseConfigured || !supabase) {
        setError("Supabase is not configured. Add the Supabase URL and anon key.");
        return;
      }

      const code = searchParams.get("code");
      const next = searchParams.get("next") || "/client/dashboard";
      const callbackMode = searchParams.get("mode") === "driver" ? "driver" : "customer";
      const oauthError = searchParams.get("error_description") || searchParams.get("error");

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
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
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

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        setError(userError?.message || "Could not load the signed-in user.");
        return;
      }

      const role = userData.user.user_metadata?.role;
      // fix: OAuth/email callback records whether the user entered customer or driver mode.
      setAccountMode(callbackMode as AccountMode);
      if (next.startsWith("/client") && role !== "admin") {
        if (!role) {
          // fix: Google customer sign-in receives customer metadata without blocking the same email from driver mode.
          await supabase.auth.updateUser({ data: { role: "customer" } });
        }

        // fix: Google/email callback creates the persistent customer profile before opening dashboard.
        await ensureCustomerProfile(userData.user);
      }

      setMessage("Email confirmed. Redirecting...");
      router.replace(next);
    }

    finishAuth();
  }, [router, searchParams]);

  return (
    <main className="auth-page">
      <section className="auth-card callback-card">
        <div className="eyebrow">Google login</div>
        <h1>{error ? "Sign in failed" : "Welcome back"}</h1>
        <p>{error || message}</p>
        {error && (
          <Link className="primary-btn" href="/customer-login">
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
            <div className="eyebrow">Google login</div>
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
