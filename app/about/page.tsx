import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description: "HopToDrop is a mobile taxi booking web app for live rides and airport transfers across Albania.",
  alternates: {
    canonical: "/about"
  }
};

export default function AboutPage() {
  return (
    <main className="info-page">
      <header className="info-header">
        <Link href="/" aria-label="Back to booking">Back</Link>
        <strong>About HopToDrop</strong>
      </header>

      <section className="info-card">
        <span>Albania taxi web app</span>
        <h1>Live rides, airport transfers, and approved drivers.</h1>
        <p>
          HopToDrop is built for riders who want a simple mobile booking flow in Albania.
          Open the app, choose pickup and dropoff, confirm the trip, and follow the ride from your phone.
        </p>
      </section>

      <section className="info-list">
        <article>
          <strong>Mobile-first booking</strong>
          <p>The main screen stays focused on the map and trip request, like a real ride app.</p>
        </article>
        <article>
          <strong>Albania service area</strong>
          <p>HopToDrop is designed around Tirana, Tirana Airport, Durres, Vlora, Saranda, and nearby routes.</p>
        </article>
        <article>
          <strong>Driver approval</strong>
          <p>Drivers submit profile, vehicle, and document details before they can go online.</p>
        </article>
      </section>

      <Link className="primary-btn info-cta" href="/">Book a ride</Link>
    </main>
  );
}
