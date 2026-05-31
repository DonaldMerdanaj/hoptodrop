"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type AuthFormProps = {
  role: "customer" | "driver";
  onAuthChange?: () => void;
  redirectPath?: string;
};

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

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setMessage(error.message);
    else {
      setMessage("Signed in successfully.");
      onAuthChange?.();
      if (redirectPath) router.replace(redirectPath);
    }
  }

  async function signUp() {
    setMessage("Creating account...");
    if (!isSupabaseConfigured || !supabase) {
      setMessage("Supabase is required for real accounts. Add your Supabase URL and anon key.");
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role } }
    });
    if (error) setMessage(error.message);
    else {
      setMessage("Account created. Please check your email if confirmation is enabled.");
      onAuthChange?.();
      if (redirectPath) router.replace(redirectPath);
    }
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
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(redirectPath || (role === "driver" ? "/driver-login" : "/dashboard"))}`,
        queryParams: {
          access_type: "offline",
          prompt: "consent"
        }
      }
    });

    if (error) setMessage(error.message);
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
      <small className="auth-note">Your email is your username.</small>
      {message && <p className="status-message">{message}</p>}
    </form>
  );
}
