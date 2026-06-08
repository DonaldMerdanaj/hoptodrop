import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with HopToDrop taxi bookings, driver applications, and ride account access.",
  alternates: {
    canonical: "/support"
  }
};

export default function SupportPage() {
  return (
    <main className="info-page">
      <header className="info-header">
        <Link href="/" aria-label="Back to booking">Back</Link>
        <strong>Support</strong>
      </header>

      <section className="info-card">
        <span>Help center</span>
        <h1>Need help with a ride or driver account?</h1>
        <p>
          Use this page for quick guidance while HopToDrop support channels are being finalized.
          For urgent ride issues, contact the driver or dispatcher directly when available in the app.
        </p>
      </section>

      <section className="info-list">
        <article>
          <strong>Rider bookings</strong>
          <p>Log in from the rider icon, then open your dashboard to see ride history and active booking status.</p>
        </article>
        <article>
          <strong>Driver applications</strong>
          <p>Drivers should use driver.hoptodrop.com to submit documents and wait for admin approval.</p>
        </article>
        <article>
          <strong>Account access</strong>
          <p>If email login fails, confirm the email link from Supabase and use the correct rider or driver portal.</p>
        </article>
      </section>

      <Link className="primary-btn info-cta" href="/">Return to booking</Link>
    </main>
  );
}
