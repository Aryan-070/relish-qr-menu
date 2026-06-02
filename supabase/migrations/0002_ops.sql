-- Relish Staff Console — realtime ops spine (Phase 0).
-- Apply with: supabase db push   (or paste into the Supabase SQL editor).
-- Mirrors the domain model in src/console/lib/types.ts and the demo seed in
-- src/data/opsSeed.ts. Every table is scoped to a restaurant and RLS-guarded
-- exactly like 0001_init.sql (helper: public.current_restaurant_id()).
--
-- Depends on 0001_init.sql for: public.restaurants, public.current_restaurant_id().

-- ── updated_at trigger helper ───────────────────────────────────────────────
-- 0001 did not define one; create it here (idempotent) for menu_items.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ── Menu categories ─────────────────────────────────────────────────────────
create table if not exists public.menu_categories (
  id             text not null,                       -- 'starters'
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  name           text not null,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now(),
  primary key (restaurant_id, id)
);
create index if not exists menu_categories_restaurant_idx
  on public.menu_categories (restaurant_id);

-- ── Menu items ──────────────────────────────────────────────────────────────
-- Columns mirror EditableMenuItem (snake_case). dietary/allergens/nutrition/
-- modifier_groups are nullable forward-compat columns not yet on the TS type.
create table if not exists public.menu_items (
  id              text not null,                      -- stable item id, e.g. 'paneer-tikka'
  restaurant_id   uuid not null references public.restaurants (id) on delete cascade,
  category_id     text not null,
  name            text not null,
  price           integer not null,                   -- rupees (whole)
  description     text not null default '',
  tags            text[] not null default '{}',
  customizations  text[] not null default '{}',
  is_jain         boolean not null default false,
  can_be_jain     boolean not null default false,
  chefs_special   boolean not null default false,
  spice_level     int not null default 0,             -- 0..3
  available       boolean not null default true,
  sold_out        boolean not null default false,
  image_url       text,
  video_url       text,
  badges          text[] not null default '{}',
  dietary         text[],
  allergens       text[],
  nutrition       jsonb,
  modifier_groups jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  primary key (restaurant_id, id)
);
create index if not exists menu_items_restaurant_idx
  on public.menu_items (restaurant_id, category_id);

drop trigger if exists menu_items_touch_updated_at on public.menu_items;
create trigger menu_items_touch_updated_at
  before update on public.menu_items
  for each row execute function public.touch_updated_at();

-- ── Modifier groups + modifiers (normalized) ────────────────────────────────
create table if not exists public.modifier_groups (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  menu_item_id   text not null,                       -- references menu_items.id
  name           text not null,
  min            int not null default 0,
  max            int not null default 1,
  created_at     timestamptz not null default now()
);
create index if not exists modifier_groups_restaurant_idx
  on public.modifier_groups (restaurant_id);
create index if not exists modifier_groups_item_idx
  on public.modifier_groups (restaurant_id, menu_item_id);

create table if not exists public.modifiers (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  group_id       uuid not null references public.modifier_groups (id) on delete cascade,
  label          text not null,
  price_delta    integer not null default 0,          -- rupees, may be negative
  created_at     timestamptz not null default now()
);
create index if not exists modifiers_restaurant_idx
  on public.modifiers (restaurant_id);
create index if not exists modifiers_group_idx
  on public.modifiers (group_id);

-- ── Restaurant tables (floor) ───────────────────────────────────────────────
-- Named restaurant_tables to avoid colliding with the reserved-ish "tables".
-- Mirrors the Table entity.
create table if not exists public.restaurant_tables (
  id             text not null,                       -- 'T01'
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  label          text not null,                       -- 'Table 1'
  seats          int not null default 2,
  zone           text not null,                       -- 'Garden' | 'Indoor' | 'Patio' | 'Bar'
  status         text not null default 'available',   -- TableStatus union
  waiter_id      text,                                -- staff.id, nullable
  guests         int not null default 0,
  seated_at      timestamptz,
  created_at     timestamptz not null default now(),
  primary key (restaurant_id, id)
);
create index if not exists restaurant_tables_restaurant_idx
  on public.restaurant_tables (restaurant_id);

-- ── Orders + order lines ────────────────────────────────────────────────────
create table if not exists public.orders (
  id             text not null,                       -- 'ORD-00123'
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  table_id       text not null,
  waiter_id      text not null,
  placed_at      timestamptz not null default now(),
  total          integer not null default 0,          -- rupees
  paid           boolean not null default false,
  status         text not null default 'open',
  created_at     timestamptz not null default now(),
  primary key (restaurant_id, id)
);
create index if not exists orders_restaurant_idx
  on public.orders (restaurant_id, placed_at desc);
create index if not exists orders_table_idx
  on public.orders (restaurant_id, table_id);

create table if not exists public.order_lines (
  id             uuid primary key default gen_random_uuid(),
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  order_id       text not null,                       -- references orders.id
  item_id        text not null,
  name           text not null,
  price          integer not null,                    -- rupees, unit price
  qty            integer not null default 1,
  category_id    text not null,
  modifiers      jsonb,                               -- selected modifiers, nullable
  seat           int,                                 -- per-seat assignment, nullable
  created_at     timestamptz not null default now()
);
create index if not exists order_lines_restaurant_idx
  on public.order_lines (restaurant_id);
create index if not exists order_lines_order_idx
  on public.order_lines (restaurant_id, order_id);

-- ── Service requests ────────────────────────────────────────────────────────
create table if not exists public.service_requests (
  id             text not null,                       -- 'REQ-001'
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  table_id       text not null,
  type           text not null,                       -- RequestType union
  created_at     timestamptz not null default now(),
  status         text not null default 'pending',     -- RequestStatus union
  claimed_by     text,                                -- staff.id, nullable
  note           text,
  primary key (restaurant_id, id)
);
create index if not exists service_requests_restaurant_idx
  on public.service_requests (restaurant_id, created_at desc);

-- ── Staff ───────────────────────────────────────────────────────────────────
create table if not exists public.staff (
  id             text not null,                       -- 'W1', 'admin', 'mgr'
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  name           text not null,
  role           text not null,                       -- Role union
  shift          text not null default 'AM',          -- 'AM' | 'PM'
  hue            int not null default 0,              -- 0..360
  created_at     timestamptz not null default now(),
  primary key (restaurant_id, id)
);
create index if not exists staff_restaurant_idx
  on public.staff (restaurant_id);

-- ── Row Level Security ──────────────────────────────────────────────────────
alter table public.menu_categories   enable row level security;
alter table public.menu_items        enable row level security;
alter table public.modifier_groups   enable row level security;
alter table public.modifiers         enable row level security;
alter table public.restaurant_tables enable row level security;
alter table public.orders            enable row level security;
alter table public.order_lines       enable row level security;
alter table public.service_requests  enable row level security;
alter table public.staff             enable row level security;

create policy "own menu_categories" on public.menu_categories
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

create policy "own menu_items" on public.menu_items
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

create policy "own modifier_groups" on public.modifier_groups
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

create policy "own modifiers" on public.modifiers
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

create policy "own restaurant_tables" on public.restaurant_tables
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

create policy "own orders" on public.orders
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

create policy "own order_lines" on public.order_lines
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

create policy "own service_requests" on public.service_requests
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

create policy "own staff" on public.staff
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

-- ── Realtime publication ────────────────────────────────────────────────────
-- Add the live-ops tables to supabase_realtime. Guarded so re-running is safe
-- (add table fails if the table is already a member of the publication).
do $$
declare
  t text;
  rt text[] := array[
    'orders', 'order_lines', 'restaurant_tables', 'service_requests', 'menu_items'
  ];
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array rt loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end
$$;
