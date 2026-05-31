"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
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
      const oauthError = searchParams.get("error_description") || searchParams.get("error");

      if (oauthError) {
        setError(oauthError);
        return;
      }

      if (!code) {
        setError("No OAuth code was returned by Supabase.");
        return;
      }

      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        setError(exchangeError.message);
        return;
      }

      setMessage("Signed in. Redirecting...");
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
