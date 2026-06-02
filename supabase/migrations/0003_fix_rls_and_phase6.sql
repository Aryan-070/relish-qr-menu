-- ════════════════════════════════════════════════════════════════════════════
-- 0003 — Fix RLS recursion + add Phase 6 tables (loyalty / reservations / feedback)
--
-- Run ONCE in the Supabase dashboard → SQL Editor (0001 + 0002 are already
-- applied to this project). Idempotent: safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

-- ── (A) Fix the infinite-recursion in RLS ───────────────────────────────────
-- The helper read app_users under RLS, and app_users' SELECT policy called the
-- helper → infinite recursion ("stack depth limit exceeded", 54001) on EVERY
-- query. SECURITY DEFINER lets the helper bypass RLS; the membership policy now
-- matches the user's own row directly.
create or replace function public.current_restaurant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from public.app_users where user_id = auth.uid()
$$;

drop policy if exists "own membership" on public.app_users;
create policy "own membership" on public.app_users
  for select using (user_id = auth.uid());

-- ── (B) Phase 6 tables ──────────────────────────────────────────────────────
create table if not exists public.customers (
  id             text primary key,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  name           text not null,
  phone          text not null,
  points         integer not null default 0,
  tier           text not null default 'Bronze',
  visits         integer not null default 0,
  lifetime_spend integer not null default 0,
  tags           text[] not null default '{}',
  last_visit     timestamptz,
  joined_at      timestamptz not null default now()
);
create index if not exists customers_restaurant_idx on public.customers (restaurant_id);

create table if not exists public.reservations (
  id             text primary key,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  name           text not null,
  phone          text not null,
  party_size     integer not null,
  at             timestamptz not null,
  table_id       text,
  status         text not null default 'booked',
  notes          text,
  created_at     timestamptz not null default now()
);
create index if not exists reservations_restaurant_idx on public.reservations (restaurant_id);

create table if not exists public.waitlist (
  id             text primary key,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  name           text not null,
  phone          text,
  party_size     integer not null,
  quoted_mins    integer not null default 0,
  status         text not null default 'waiting',
  added_at       timestamptz not null default now()
);
create index if not exists waitlist_restaurant_idx on public.waitlist (restaurant_id);

create table if not exists public.feedback (
  id               text primary key,
  restaurant_id    uuid not null references public.restaurants (id) on delete cascade,
  rating           integer not null,
  comment          text,
  table_id         text,
  routed_to_public boolean not null default false,
  created_at       timestamptz not null default now()
);
create index if not exists feedback_restaurant_idx on public.feedback (restaurant_id);

-- ── RLS — scope every row to the caller's restaurant ────────────────────────
alter table public.customers    enable row level security;
alter table public.reservations enable row level security;
alter table public.waitlist     enable row level security;
alter table public.feedback     enable row level security;

drop policy if exists "own customers" on public.customers;
create policy "own customers" on public.customers
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

drop policy if exists "own reservations" on public.reservations;
create policy "own reservations" on public.reservations
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

drop policy if exists "own waitlist" on public.waitlist;
create policy "own waitlist" on public.waitlist
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

drop policy if exists "own feedback" on public.feedback;
create policy "own feedback" on public.feedback
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

-- ── Realtime — broadcast row changes for live cross-device sync ─────────────
do $$ begin
  alter publication supabase_realtime add table
    public.customers, public.reservations, public.waitlist, public.feedback;
exception when duplicate_object then null; end $$;
