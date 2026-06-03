"use client";

import AuthForm from "@/components/AuthForm";

export default function DriverLoginPage() {
  return (
    <main className="auth-page auth-entry-page driver-auth-page">
      <header className="auth-brand-bar driver-auth-hero">
        <span>HopToDrop Driver</span>
        <small>Earn driving across Albania</small>
      </header>
      <section className="auth-entry-card">
        <AuthForm
          role="driver"
          redirectPath="/"
          title="Driver Portal"
          note="Log in to manage active transfers, update your vehicle location, and check earnings."
        />
      </section>
    </main>
  );
}
