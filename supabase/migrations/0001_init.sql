-- Relish Staff Console — backend foundation (Phase 6.1 / 6.2).
-- Apply with: supabase db push   (or paste into the Supabase SQL editor).
-- Mirrors the commercial pricing model in src/console/lib/billing.ts.

-- ── Restaurants ─────────────────────────────────────────────────────────────
create table if not exists public.restaurants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ── App users: link an auth user to a restaurant + role ─────────────────────
create type public.app_role as enum ('admin', 'manager', 'waiter');

create table if not exists public.app_users (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  role           public.app_role not null default 'admin',
  display_name   text,
  created_at     timestamptz not null default now()
);
create index if not exists app_users_restaurant_idx on public.app_users (restaurant_id);

-- ── Subscriptions ───────────────────────────────────────────────────────────
create type public.package_id as enum ('web-menu', 'classic', 'cinematic', 'signature');

create table if not exists public.subscriptions (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null unique references public.restaurants (id) on delete cascade,
  package        public.package_id not null,
  started_at     timestamptz not null default now(),
  renewal_at     timestamptz not null,
  auto_renew     boolean not null default true,
  gst_pct        int not null default 18
);

-- ── Invoices ────────────────────────────────────────────────────────────────
create type public.invoice_status as enum ('paid', 'due', 'failed');

create table if not exists public.invoices (
  id             text primary key,                    -- 'INV-0001'
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  issued_at      timestamptz not null default now(),
  description    text not null,
  base           integer not null,                    -- ex-GST, in rupees
  gst            integer not null,
  total          integer not null,                    -- inc-GST
  status         public.invoice_status not null default 'due',
  razorpay_id    text,                                -- gateway reference (Phase 6.2)
  paid_at        timestamptz                          -- set by the Razorpay webhook on capture
);
create index if not exists invoices_restaurant_idx on public.invoices (restaurant_id, issued_at desc);

-- ── Video screens (usage metering — Phase 6.4) ──────────────────────────────
create table if not exists public.video_screens (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  label          text not null,                       -- 'hero', 'beverages', …
  active         boolean not null default true,
  bytes_served   bigint not null default 0,           -- egress this cycle
  created_at     timestamptz not null default now()
);
create index if not exists video_screens_restaurant_idx on public.video_screens (restaurant_id);

-- ── Row Level Security: a user only sees their own restaurant's rows ────────
alter table public.restaurants   enable row level security;
alter table public.app_users     enable row level security;
alter table public.subscriptions enable row level security;
alter table public.invoices      enable row level security;
alter table public.video_screens enable row level security;

-- Helper: the caller's restaurant id.
-- SECURITY DEFINER so it reads app_users WITHOUT triggering app_users' own RLS
-- policy — otherwise the policy calls this function which reads app_users which
-- evaluates the policy again → infinite recursion ("stack depth limit exceeded").
create or replace function public.current_restaurant_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select restaurant_id from public.app_users where user_id = auth.uid()
$$;

create policy "own restaurant" on public.restaurants
  for select using (id = public.current_restaurant_id());

-- Sign-up bootstrap: a signed-in user may create a restaurant and enrol *itself*.
-- (For stricter control, replace these with a SECURITY DEFINER signup RPC.)
create policy "create restaurant" on public.restaurants
  for insert with check (auth.uid() is not null);

-- Read your OWN membership row directly (user_id = auth.uid()), NOT via
-- current_restaurant_id() — that would recurse through this very policy.
create policy "own membership" on public.app_users
  for select using (user_id = auth.uid());

create policy "enrol self" on public.app_users
  for insert with check (user_id = auth.uid());

create policy "own subscription" on public.subscriptions
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

create policy "own invoices" on public.invoices
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

create policy "own video screens" on public.video_screens
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());
