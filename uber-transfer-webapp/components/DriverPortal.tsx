"use client";

import { useEffect, useState } from "react";
import AuthForm from "@/components/AuthForm";
import DriverLocationSender from "@/components/DriverLocationSender";
import DriverRegistrationForm from "@/components/DriverRegistrationForm";
import DriverRequests from "@/components/DriverRequests";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type AuthUser = {
  email?: string;
};

export default function DriverPortal() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    const { data } = await supabase.auth.getUser();
    setUser(data.user ? { email: data.user.email || "" } : null);
    setLoading(false);
  }

  useEffect(() => {
    refreshUser();
    if (!isSupabaseConfigured || !supabase) return;

    const { data } = supabase.auth.onAuthStateChange(() => {
      refreshUser();
    });

    return () => data.subscription.unsubscribe();
  }, []);

  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }

  if (loading) return <p>Checking account...</p>;

  if (!user) {
    return (
      <>
        <AuthForm role="driver" onAuthChange={refreshUser} />
        <div className="driver-login-note">
          <strong>Driver account first</strong>
          <span>Create an account with email/password or continue with Google. After login, the registration form and driver console will appear.</span>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="account-strip">
        <div>
          <strong>{user.email}</strong>
          <span>Driver username</span>
        </div>
        <button className="secondary-btn compact-btn" onClick={signOut}>Sign out</button>
      </div>
      <DriverRegistrationForm />
      <DriverLocationSender />
      <DriverRequests />
    </>
  );
}
