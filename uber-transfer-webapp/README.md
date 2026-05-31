# HopToDrop

Complete Next.js + Supabase taxi and ride-hailing app with:

- Live driver map
- Rider request flow with pickup, destination, ride class, ETA, and upfront fare
- Multiple ride tiers: Taxi, Comfort, XL, and Moto
- Customer account screen with assigned driver details and ride history
- Driver app with live-location controls and nearby request cards
- Real driver onboarding with profile, license, vehicle, insurance, and payout fields
- Admin driver approval workflow
- Admin dispatch dashboard with rider, driver, payment, and status updates
- Google Maps JavaScript map with Albania-only Places autocomplete

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

Production domain: `https://www.hoptodrop.com`.

Add `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env.local` to enable Google Maps and Google Places autocomplete.

For Google Cloud, enable:

- Maps JavaScript API
- Places API
- Directions API if you want Google road routes instead of a straight fallback line

## Supabase setup

1. Create a Supabase project.
2. Go to SQL Editor.
3. Run `supabase/schema.sql`.
4. Copy Project URL and anon key into `.env.local`.
5. Enable email auth in Supabase Auth.
6. Create an admin user and set `user_metadata.role` to `admin` for dispatch approval access.

## Notes

- The rider location search is restricted to Albania with Google Places `componentRestrictions`.
- Driver locations update in real time with Supabase Realtime.
- Driver accounts must be approved before they can go online or accept rides.
