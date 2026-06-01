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
  driver_id uuid references auth.users(id) on delete set null,
  driver_name text,
  driver_vehicle text,
  driver_eta integer,
  estimated_price numeric not null default 0,
  status text not null default 'pending' check (status in ('pending','accepted','assigned','arrived','started','completed','cancelled')),
  accepted_at timestamptz,
  arrived_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  phone text not null default '',
  avatar_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bookings add column if not exists driver_id uuid references auth.users(id) on delete set null;
alter table public.bookings add column if not exists accepted_at timestamptz;
alter table public.bookings add column if not exists arrived_at timestamptz;
alter table public.bookings add column if not exists started_at timestamptz;
alter table public.bookings add column if not exists completed_at timestamptz;
alter table public.customer_profiles add column if not exists phone text not null default '';
alter table public.customer_profiles add column if not exists avatar_url text not null default '';
alter table public.customer_profiles add column if not exists updated_at timestamptz not null default now();

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

create table if not exists public.booking_route_points (
  id uuid primary key default uuid_generate_v4(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  driver_id uuid not null references auth.users(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  phase text not null default 'accepted' check (phase in ('assigned','accepted','arrived','started','completed')),
  recorded_at timestamptz not null default now()
);

alter table public.bookings enable row level security;
alter table public.customer_profiles enable row level security;
alter table public.driver_locations enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.booking_route_points enable row level security;

alter table public.bookings drop constraint if exists bookings_status_check;
alter table public.bookings add constraint bookings_status_check
check (status in ('pending','accepted','assigned','arrived','started','completed','cancelled'));

alter table public.booking_route_points drop constraint if exists booking_route_points_phase_check;
alter table public.booking_route_points add constraint booking_route_points_phase_check
check (phase in ('assigned','accepted','arrived','started','completed'));

drop policy if exists "Anyone can create bookings" on public.bookings;
drop policy if exists "Anyone can read bookings" on public.bookings;
drop policy if exists "Authenticated users can create bookings" on public.bookings;
drop policy if exists "Customers can read own bookings" on public.bookings;
drop policy if exists "Authenticated users can read all bookings (temp)" on public.bookings;
drop policy if exists "Admins can update bookings" on public.bookings;

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

drop policy if exists "Customers can read own profile" on public.customer_profiles;
drop policy if exists "Customers can create own profile" on public.customer_profiles;
drop policy if exists "Customers can update own profile" on public.customer_profiles;
drop policy if exists "Admins can read customer profiles" on public.customer_profiles;

-- fix: customer login stores profile data in public.customer_profiles, protected per user.
create policy "Customers can read own profile"
on public.customer_profiles for select
to authenticated
using (auth.uid() = id);

create policy "Customers can create own profile"
on public.customer_profiles for insert
to authenticated
with check (auth.uid() = id);

create policy "Customers can update own profile"
on public.customer_profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "Admins can read customer profiles"
on public.customer_profiles for select
to authenticated
using ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

drop policy if exists "Drivers can accept and progress own bookings" on public.bookings;

create policy "Drivers can accept and progress own bookings"
on public.bookings for update
to authenticated
using (status in ('pending','assigned') or driver_id = auth.uid())
with check (driver_id = auth.uid());

drop policy if exists "Authenticated users can read booking route points" on public.booking_route_points;
drop policy if exists "Drivers can create own booking route points" on public.booking_route_points;

create policy "Authenticated users can read booking route points"
on public.booking_route_points for select
to authenticated
using (true);

create policy "Drivers can create own booking route points"
on public.booking_route_points for insert
to authenticated
with check (auth.uid() = driver_id);

drop policy if exists "Anyone can read online drivers" on public.driver_locations;
drop policy if exists "Drivers can insert own location" on public.driver_locations;
drop policy if exists "Drivers can update own location" on public.driver_locations;

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

drop policy if exists "Drivers can read own profile" on public.driver_profiles;
drop policy if exists "Drivers can create own profile" on public.driver_profiles;
drop policy if exists "Drivers can update own profile before approval" on public.driver_profiles;
drop policy if exists "Admins can approve driver profiles" on public.driver_profiles;

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

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'driver_locations'
  ) then
    alter publication supabase_realtime add table public.driver_locations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings'
  ) then
    alter publication supabase_realtime add table public.bookings;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'booking_route_points'
  ) then
    alter publication supabase_realtime add table public.booking_route_points;
  end if;
end $$;
