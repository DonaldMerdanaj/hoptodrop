create extension if not exists "uuid-ossp";

create table if not exists public.bookings (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references auth.users(id) on delete set null,
  customer_name text not null default '',
  customer_phone text not null default '',
  pickup text not null,
  dropoff text not null,
  pickup_lat double precision not null default 41.3275,
  pickup_lng double precision not null default 19.8187,
  dropoff_lat double precision not null default 41.3194,
  dropoff_lng double precision not null default 19.8157,
  pickup_time timestamptz not null,
  passengers integer not null default 1,
  luggage text,
  vehicle_type text not null,
  ride_class text not null default 'Taxi',
  payment_method text not null default 'Cash',
  driver_name text,
  driver_vehicle text,
  driver_eta integer,
  estimated_price numeric not null default 0,
  status text not null default 'pending' check (status in ('pending','accepted','assigned','completed','cancelled')),
  created_at timestamptz not null default now()
);

create table if not exists public.driver_locations (
  id uuid primary key references auth.users(id) on delete cascade,
  driver_name text not null,
  vehicle text,
  status text not null default 'offline' check (status in ('online','offline','busy')),
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.driver_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null,
  phone text not null,
  city text not null default 'Tirana',
  national_id text not null,
  license_number text not null,
  license_expires_at date not null,
  taxi_license_number text not null,
  vehicle_make text not null,
  vehicle_model text not null,
  vehicle_year integer not null,
  license_plate text not null,
  vehicle_color text not null,
  seats integer not null default 4,
  iban text not null,
  profile_photo_url text,
  driver_license_url text not null,
  vehicle_registration_url text not null,
  insurance_url text not null,
  approval_status text not null default 'draft' check (approval_status in ('draft','submitted','approved','rejected')),
  rejection_reason text,
  submitted_at timestamptz,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bookings enable row level security;
alter table public.driver_locations enable row level security;
alter table public.driver_profiles enable row level security;

drop policy if exists "Anyone can create bookings" on public.bookings;
drop policy if exists "Anyone can read bookings" on public.bookings;

-- fix: require authenticated customer-owned inserts and remove public booking reads.
create policy "Authenticated users can create bookings"
on public.bookings for insert
to authenticated
with check (auth.uid() = customer_id);

create policy "Customers can read own bookings"
on public.bookings for select
to authenticated
using (auth.uid() = customer_id);

-- TODO: Replace with admin role check before production
create policy "Authenticated users can read all bookings (temp)"
on public.bookings for select
to authenticated
using (true);

create policy "Admins can update bookings"
on public.bookings for update
to authenticated
using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy "Anyone can read online drivers"
on public.driver_locations for select
to anon, authenticated
using (true);

create policy "Drivers can insert own location"
on public.driver_locations for insert
to authenticated
with check (auth.uid() = id);

create policy "Drivers can update own location"
on public.driver_locations for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Drivers can read own profile"
on public.driver_profiles for select
to authenticated
using (auth.uid() = id or (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

create policy "Drivers can create own profile"
on public.driver_profiles for insert
to authenticated
with check (auth.uid() = id);

create policy "Drivers can update own profile before approval"
on public.driver_profiles for update
to authenticated
using (auth.uid() = id and approval_status in ('draft','submitted','rejected'))
with check (auth.uid() = id and approval_status in ('draft','submitted'));

create policy "Admins can approve driver profiles"
on public.driver_profiles for update
to authenticated
using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin')
with check ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

alter publication supabase_realtime add table public.driver_locations;
