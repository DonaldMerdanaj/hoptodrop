"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { setAccountMode } from "@/lib/accountMode";
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
  return `${window.location.origin}/auth/callback?next=${encodeURIComponent(authRedirectFor(role, redirectPath))}&mode=${role}`;
}

export default function AuthForm({ role, onAuthChange, redirectPath }: AuthFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
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

      // fix: booking is blocked for driver-mode sessions until the user logs in as a customer.
      setAccountMode(role);
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
      if (data.session) setAccountMode(role);
      if (!data.session) {
        // fix: after signup, explicitly request the confirmation email so unconfirmed existing accounts can receive a fresh link.
        await supabase.auth.resend({
          type: "signup",
          email,
          options: {
            emailRedirectTo: confirmationRedirectUrl(role, redirectPath)
          }
        });
      }
      setMessage("Confirmation link sent. Check inbox and spam/junk, then open the email link.");
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
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(authRedirectFor(role, redirectPath))}&mode=${role}`,
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
    if (!showPassword) {
      setShowPassword(true);
      return;
    }

    // fix: route a single submit button through the selected login/signup mode.
    if (mode === "login") await signIn();
    else await signUp();
  }

  return (
    <form className="auth-entry-form" onSubmit={submitAuth}>
      <h1>What's your email?</h1>
      <input
        type="email"
        placeholder="Enter your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      {showPassword && (
        <input
          type="password"
          placeholder={mode === "login" ? "Enter your password" : "Create a password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
        />
      )}
      <button className="primary-btn auth-main-btn" type="submit">
        {!showPassword ? "Continue" : mode === "login" ? "Login" : "Create Account"}
      </button>
      <div className="auth-divider"><span />or<span /></div>
      <button className="secondary-btn auth-google-btn" type="button" onClick={signInWithGoogle}>
        <span className="google-mark">G</span>
        Continue with Google
      </button>
      <button
        className="auth-toggle"
        type="button"
        onClick={() => {
          setMode((current) => (current === "login" ? "signup" : "login"));
          setShowPassword(true);
        }}
      >
        {mode === "login" ? "Don't have an account? Sign up" : "Already have an account? Log in"}
      </button>
      <button className="auth-toggle" type="button" onClick={resendConfirmation}>
        Resend confirmation email
      </button>
      <small className="auth-note">By continuing, you agree to use your email for secure HopToDrop account access.</small>
      {message && <p className="status-message">{message}</p>}
    </form>
  );
}
