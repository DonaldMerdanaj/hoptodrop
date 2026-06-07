-- HopToDrop driver PWA migration
-- Run this in Supabase SQL Editor after the base schema.sql.

create extension if not exists pgcrypto;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role = 'admin' from public.profiles where id = auth.uid()), false)
$$;

alter table public.driver_profiles
  add column if not exists status text not null default 'offline';

alter table public.driver_profiles drop constraint if exists driver_profiles_status_check;
alter table public.driver_profiles add constraint driver_profiles_status_check
  check (status in ('online','offline','busy'));

create table if not exists public.driver_locations (
  id uuid primary key references auth.users(id) on delete cascade,
  driver_name text not null default '',
  vehicle text,
  status text not null default 'offline' check (status in ('online','offline','busy')),
  lat double precision not null,
  lng double precision not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  driver_id uuid not null references auth.users(id) on delete cascade,
  pickup text not null,
  dropoff text not null,
  fare numeric(10,2) not null default 0,
  status text not null check (status in ('completed','cancelled')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.earnings (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid references public.bookings(id) on delete set null,
  amount numeric(10,2) not null default 0,
  currency text not null default 'EUR',
  earned_on date not null default current_date,
  created_at timestamptz not null default now()
);

create index if not exists driver_profiles_status_idx on public.driver_profiles(status);
create index if not exists driver_profiles_approval_status_idx on public.driver_profiles(approval_status);
create index if not exists driver_locations_status_updated_idx on public.driver_locations(status, updated_at desc);
create index if not exists bookings_status_created_idx on public.bookings(status, created_at desc);
create index if not exists bookings_driver_status_idx on public.bookings(driver_id, status);
create index if not exists bookings_customer_created_idx on public.bookings(customer_id, created_at desc);
create index if not exists booking_route_points_booking_recorded_idx on public.booking_route_points(booking_id, recorded_at desc);
create index if not exists trip_history_driver_created_idx on public.trip_history(driver_id, created_at desc);
create index if not exists earnings_driver_earned_idx on public.earnings(driver_id, earned_on desc);

delete from public.trip_history older
using public.trip_history newer
where older.booking_id = newer.booking_id
  and older.ctid < newer.ctid;

delete from public.earnings older
using public.earnings newer
where older.booking_id = newer.booking_id
  and older.booking_id is not null
  and older.ctid < newer.ctid;

create unique index if not exists trip_history_booking_unique on public.trip_history(booking_id);
create unique index if not exists earnings_booking_unique on public.earnings(booking_id) where booking_id is not null;

alter table public.profiles enable row level security;
alter table public.driver_profiles enable row level security;
alter table public.driver_locations enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_route_points enable row level security;
alter table public.trip_history enable row level security;
alter table public.earnings enable row level security;

insert into storage.buckets (id, name, public)
values ('driver-documents', 'driver-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "Drivers upload own documents" on storage.objects;
drop policy if exists "Drivers read own documents" on storage.objects;
drop policy if exists "Admins read driver documents" on storage.objects;

create policy "Drivers upload own documents"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'driver-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.current_role() = 'driver'
);

create policy "Drivers read own documents"
on storage.objects for select
to authenticated
using (
  bucket_id = 'driver-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "Admins read driver documents"
on storage.objects for select
to authenticated
using (bucket_id = 'driver-documents' and public.is_admin());

drop policy if exists "Users can read own app profile" on public.profiles;
drop policy if exists "Users can create own app profile" on public.profiles;
drop policy if exists "Users can update own app profile" on public.profiles;
drop policy if exists "Admins can manage app profiles" on public.profiles;

create policy "Users can read own app profile"
on public.profiles for select
to authenticated
using (auth.uid() = id or public.is_admin());

create policy "Users can create own app profile"
on public.profiles for insert
to authenticated
with check (auth.uid() = id and role in ('customer','driver'));

create policy "Users can update own app profile"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id and role = public.current_role());

create policy "Admins can manage app profiles"
on public.profiles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Drivers can read own profile" on public.driver_profiles;
drop policy if exists "Drivers can create own profile" on public.driver_profiles;
drop policy if exists "Drivers can update own profile before approval" on public.driver_profiles;
drop policy if exists "Drivers can update own live status" on public.driver_profiles;
drop policy if exists "Admins can approve driver profiles" on public.driver_profiles;

create policy "Drivers can read own profile"
on public.driver_profiles for select
to authenticated
using (auth.uid() = id or public.is_admin());

create policy "Drivers can create own profile"
on public.driver_profiles for insert
to authenticated
with check (auth.uid() = id and public.current_role() = 'driver');

create policy "Drivers can update own profile before approval"
on public.driver_profiles for update
to authenticated
using (auth.uid() = id and public.current_role() = 'driver' and approval_status in ('draft','submitted','rejected'))
with check (auth.uid() = id and public.current_role() = 'driver' and approval_status in ('draft','submitted'));

create policy "Drivers can update own live status"
on public.driver_profiles for update
to authenticated
using (auth.uid() = id and public.current_role() = 'driver' and approval_status = 'approved')
with check (auth.uid() = id and public.current_role() = 'driver' and approval_status = 'approved');

create policy "Admins can approve driver profiles"
on public.driver_profiles for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Anyone can read online drivers" on public.driver_locations;
drop policy if exists "Authenticated users can read relevant drivers" on public.driver_locations;
drop policy if exists "Drivers can insert own location" on public.driver_locations;
drop policy if exists "Drivers can update own location" on public.driver_locations;
drop policy if exists "Admins can manage driver locations" on public.driver_locations;

create policy "Anyone can read online drivers"
on public.driver_locations for select
to anon
-- fix: only expose active online drivers, never offline last-known GPS positions.
using (status = 'online');

create policy "Authenticated users can read relevant drivers"
on public.driver_locations for select
to authenticated
using (
  status = 'online'
  or id = auth.uid()
  or exists (
    select 1 from public.bookings
    where bookings.driver_id = driver_locations.id
    and bookings.customer_id = auth.uid()
    and bookings.status in ('accepted','arrived','started')
  )
);

create policy "Drivers can insert own location"
on public.driver_locations for insert
to authenticated
with check (
  auth.uid() = id
  and public.current_role() = 'driver'
  and exists (
    select 1 from public.driver_profiles
    where driver_profiles.id = auth.uid()
    and driver_profiles.approval_status = 'approved'
  )
);

create policy "Drivers can update own location"
on public.driver_locations for update
to authenticated
using (auth.uid() = id and public.current_role() = 'driver')
with check (
  auth.uid() = id
  and public.current_role() = 'driver'
  and exists (
    select 1 from public.driver_profiles
    where driver_profiles.id = auth.uid()
    and driver_profiles.approval_status = 'approved'
  )
);

create policy "Admins can manage driver locations"
on public.driver_locations for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Customers can create own bookings" on public.bookings;
drop policy if exists "Authenticated users can create own bookings" on public.bookings;
drop policy if exists "Customers can read own bookings" on public.bookings;
drop policy if exists "Drivers can read pending and assigned bookings" on public.bookings;
drop policy if exists "Drivers can accept and progress own bookings" on public.bookings;
drop policy if exists "Admins can manage bookings" on public.bookings;

create policy "Authenticated users can create own bookings"
on public.bookings for insert
to authenticated
with check (
  -- fix: approved drivers can also book off duty; the trigger still forces customer_id = auth.uid().
  auth.uid() = customer_id
  and driver_id is null
  and status = 'pending'
);

create policy "Customers can read own bookings"
on public.bookings for select
to authenticated
using (auth.uid() = customer_id);

create policy "Drivers can read pending and assigned bookings"
on public.bookings for select
to authenticated
using (
  public.current_role() = 'driver'
  and exists (
    select 1 from public.driver_profiles
    where driver_profiles.id = auth.uid()
    and driver_profiles.approval_status = 'approved'
  )
  and (status = 'pending' or driver_id = auth.uid())
);

create policy "Admins can manage bookings"
on public.bookings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Customers can read route points for own bookings" on public.booking_route_points;
drop policy if exists "Drivers can read route points for own bookings" on public.booking_route_points;
drop policy if exists "Drivers can create own booking route points" on public.booking_route_points;
drop policy if exists "Admins can manage route points" on public.booking_route_points;

create policy "Customers can read route points for own bookings"
on public.booking_route_points for select
to authenticated
using (
  exists (
    select 1 from public.bookings
    where bookings.id = booking_route_points.booking_id
    and bookings.customer_id = auth.uid()
  )
);

create policy "Drivers can read route points for own bookings"
on public.booking_route_points for select
to authenticated
using (driver_id = auth.uid());

create policy "Drivers can create own booking route points"
on public.booking_route_points for insert
to authenticated
with check (
  public.current_role() = 'driver'
  and driver_id = auth.uid()
  and exists (
    select 1 from public.bookings
    where bookings.id = booking_route_points.booking_id
    and bookings.driver_id = auth.uid()
    and bookings.status in ('accepted','arrived','started')
  )
);

create policy "Admins can manage route points"
on public.booking_route_points for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Drivers can read own trip history" on public.trip_history;
drop policy if exists "Customers can read own trip history" on public.trip_history;
drop policy if exists "Admins can manage trip history" on public.trip_history;

create policy "Drivers can read own trip history"
on public.trip_history for select
to authenticated
using (driver_id = auth.uid());

create policy "Customers can read own trip history"
on public.trip_history for select
to authenticated
using (customer_id = auth.uid());

create policy "Admins can manage trip history"
on public.trip_history for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Drivers can read own earnings" on public.earnings;
drop policy if exists "Admins can manage earnings" on public.earnings;

create policy "Drivers can read own earnings"
on public.earnings for select
to authenticated
using (driver_id = auth.uid());

create policy "Admins can manage earnings"
on public.earnings for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.accept_booking(booking_id_input uuid)
returns setof public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  driver public.driver_profiles;
begin
  select * into driver
  from public.driver_profiles
  where id = auth.uid()
    and approval_status = 'approved';

  if driver.id is null or public.current_role() <> 'driver' then
    raise exception 'Approved driver account required';
  end if;

  if exists (
    select 1 from public.bookings
    where driver_id = auth.uid()
      and status in ('accepted','arrived','started')
  ) then
    raise exception 'Complete the active trip before accepting another';
  end if;

  return query
  update public.bookings
  set
    status = 'accepted',
    driver_id = auth.uid(),
    driver_name = driver.full_name,
    driver_vehicle = trim(concat_ws(' ', driver.vehicle_make, driver.vehicle_model, driver.license_plate)),
    accepted_at = now()
  where id = booking_id_input
    and status = 'pending'
    and driver_id is null
    -- fix: a driver can ride with the same account but cannot accept their own booking.
    and customer_id <> auth.uid()
  returning *;
end;
$$;

create or replace function public.progress_booking(booking_id_input uuid, next_status_input text)
returns setof public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  current_status text;
begin
  if public.current_role() <> 'driver' or not exists (
    select 1 from public.driver_profiles
    where id = auth.uid() and approval_status = 'approved'
  ) then
    raise exception 'Approved driver account required';
  end if;

  select status into current_status
  from public.bookings
  where id = booking_id_input and driver_id = auth.uid()
  for update;

  if not (
    (current_status = 'accepted' and next_status_input = 'arrived')
    or (current_status = 'arrived' and next_status_input = 'started')
    or (current_status = 'started' and next_status_input = 'completed')
  ) then
    raise exception 'Invalid booking status transition';
  end if;

  return query
  update public.bookings
  set
    status = next_status_input,
    arrived_at = case when next_status_input = 'arrived' then now() else arrived_at end,
    started_at = case when next_status_input = 'started' then now() else started_at end,
    completed_at = case when next_status_input = 'completed' then now() else completed_at end
  where id = booking_id_input and driver_id = auth.uid()
  returning *;
end;
$$;

revoke all on function public.accept_booking(uuid) from public;
revoke all on function public.progress_booking(uuid, text) from public;
grant execute on function public.accept_booking(uuid) to authenticated;
grant execute on function public.progress_booking(uuid, text) to authenticated;

create or replace function public.finalize_driver_trip()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('completed','cancelled') and old.status is distinct from new.status and new.driver_id is not null then
    insert into public.trip_history (booking_id, customer_id, driver_id, pickup, dropoff, fare, status, completed_at)
    values (new.id, new.customer_id, new.driver_id, new.pickup, new.dropoff, coalesce(new.estimated_price, 0), new.status, new.completed_at)
    on conflict do nothing;

    if new.status = 'completed' then
      insert into public.earnings (driver_id, booking_id, amount, earned_on)
      values (new.driver_id, new.id, coalesce(new.estimated_price, 0), current_date)
      on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists finalize_driver_trip_after_update on public.bookings;
create trigger finalize_driver_trip_after_update
after update on public.bookings
for each row execute function public.finalize_driver_trip();

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'driver_profiles') then
    alter publication supabase_realtime add table public.driver_profiles;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'driver_locations') then
    alter publication supabase_realtime add table public.driver_locations;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'bookings') then
    alter publication supabase_realtime add table public.bookings;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'booking_route_points') then
    alter publication supabase_realtime add table public.booking_route_points;
  end if;
end $$;
