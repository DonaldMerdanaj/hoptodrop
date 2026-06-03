"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import AuthForm from "@/components/shared/AuthForm";

function LoginContent() {
  const searchParams = useSearchParams();
  const role = searchParams.get("role") === "driver" ? "driver" : "customer";
  const isDriver = role === "driver";

  return (
    <main className={`auth-page auth-entry-page ${isDriver ? "driver-auth-page" : "rider-auth-page"}`}>
      {isDriver ? (
        <header className="driver-auth-hero">
          <div>
            <span>HopToDrop</span>
            <strong>Driver portal</strong>
          </div>
          <p>Sign in, finish approval, go online, and manage trips from the live driver app.</p>
        </header>
      ) : (
        <header className="auth-brand-bar rider-auth-hero">
          <span>HopToDrop</span>
          <small>Book airport and city transfers</small>
        </header>
      )}
      <section className={`auth-entry-card ${isDriver ? "driver-auth-card" : ""}`}>
        <AuthForm
          role={role}
          redirectPath={isDriver ? "/driver" : "/rider/dashboard"}
          title={isDriver ? "Driver sign in" : "What's your email?"}
          note={
            isDriver
              ? "Driver accounts must be approved before going online."
              : "By continuing, you agree to use your email for secure HopToDrop account access."
          }
        />
        <Link className="auth-portal-link" href={isDriver ? "/rider/login" : "/driver/login"}>
          {isDriver ? "Use rider login instead" : "Use driver login instead"}
        </Link>
      </section>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="auth-page">
          <section className="auth-card"><p className="status-message">Loading login...</p></section>
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
