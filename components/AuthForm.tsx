"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ensureCustomerProfile } from "@/lib/customerProfile";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type AuthFormProps = {
  role: "customer" | "driver";
  onAuthChange?: () => void;
  redirectPath?: string;
};

function authMessage(errorMessage: string) {
  if (errorMessage.toLowerCase().includes("invalid api key")) {
    return "Invalid Supabase anon key. In Vercel, set NEXT_PUBLIC_SUPABASE_ANON_KEY to the anon public key from the same Supabase project as NEXT_PUBLIC_SUPABASE_URL, then redeploy.";
  }

  if (errorMessage.toLowerCase().includes("invalid login credentials")) {
    return "Invalid email or password. If you just created this account, open the confirmation link sent to your email first.";
  }

  return errorMessage;
}

function authRedirectFor(role: "customer" | "driver", redirectPath?: string) {
  return redirectPath || (role === "driver" ? "/driver/dashboard" : "/client/dashboard");
}

function confirmationRedirectUrl(role: "customer" | "driver", redirectPath?: string) {
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(authRedirectFor(role, redirectPath))}`;
}

export default function AuthForm({ role, onAuthChange, redirectPath }: AuthFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  async function signIn() {
    setMessage("Signing in...");
    if (!isSupabaseConfigured || !supabase) {
      setMessage("Supabase is required for real accounts. Add your Supabase URL and anon key.");
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(authMessage(error.message));
    else {
      if (role === "customer" && data.user) {
        // fix: one email can be used as customer or driver; customer mode stores a rider profile.
        await ensureCustomerProfile(data.user);
      }

      setMessage("Signed in successfully.");
      onAuthChange?.();
      router.replace(authRedirectFor(role, redirectPath));
    }
  }

  async function signUp() {
    setMessage("Creating account...");
    if (!isSupabaseConfigured || !supabase) {
      setMessage("Supabase is required for real accounts. Add your Supabase URL and anon key.");
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // fix: send a real Supabase confirmation link that returns to the correct app page after email verification.
        emailRedirectTo: confirmationRedirectUrl(role, redirectPath),
        data: { role }
      }
    });
    if (error) setMessage(authMessage(error.message));
    else {
      if (role === "customer" && data.session && data.user) {
        // fix: if email confirmation is disabled, create the customer profile immediately after signup.
        await ensureCustomerProfile(data.user);
      }
      setMessage("Confirmation link sent. Open the email link to verify this account, then log in.");
      setMode("login");
    }
  }

  async function resendConfirmation() {
    if (!email) {
      setMessage("Enter your email address first, then resend the confirmation link.");
      return;
    }

    setMessage("Sending confirmation link...");
    if (!isSupabaseConfigured || !supabase) {
      setMessage("Supabase is required for email confirmation.");
      return;
    }

    // fix: allow users to request another Supabase signup confirmation email if the first link was not received.
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: confirmationRedirectUrl(role, redirectPath)
      }
    });

    if (error) setMessage(authMessage(error.message));
    else setMessage("Confirmation link sent again. Check inbox and spam/junk.");
  }

  async function signInWithGoogle() {
    setMessage("Opening Google login...");
    if (!isSupabaseConfigured || !supabase) {
      setMessage("Supabase is required for Google login.");
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(authRedirectFor(role, redirectPath))}`,
        queryParams: {
          access_type: "offline",
          prompt: "consent"
        }
      }
    });

    if (error) setMessage(authMessage(error.message));
  }

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    // fix: route a single submit button through the selected login/signup mode.
    if (mode === "login") await signIn();
    else await signUp();
  }

  return (
    <form onSubmit={submitAuth}>
      <h2 className="auth-form-title">{mode === "login" ? "Login" : "Create Account"}</h2>
      <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button className="primary-btn" type="submit">{mode === "login" ? "Login" : "Create Account"}</button>
      <button className="secondary-btn" type="button" onClick={signInWithGoogle}>Continue with Google</button>
      <button
        className="auth-toggle"
        type="button"
        onClick={() => setMode((current) => (current === "login" ? "signup" : "login"))}
      >
        {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Log in"}
      </button>
      <button className="auth-toggle" type="button" onClick={resendConfirmation}>
        Resend confirmation email
      </button>
      <small className="auth-note">Your email is your username.</small>
      {message && <p className="status-message">{message}</p>}
    </form>
  );
}
