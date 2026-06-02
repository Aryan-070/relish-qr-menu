-- ════════════════════════════════════════════════════════════════════════════
-- 0005 — Inventory / procurement + promotions + governance audit (Phase 1/2)
--
-- Run ONCE in the Supabase dashboard → SQL Editor (0001–0004 already applied).
-- Idempotent: safe to re-run. Mirrors the domain model in
-- src/console/lib/types.ts and the demo seed in src/data/opsSeed.ts, and is
-- read/written by src/console/lib/inventoryRepo.ts.
--
-- Every table is scoped to a restaurant and RLS-guarded exactly like 0002_ops.sql
-- and 0003_fix_rls_and_phase6.sql (helper: public.current_restaurant_id()).
--
-- Depends on 0001_init.sql for: public.restaurants, public.current_restaurant_id().
-- ════════════════════════════════════════════════════════════════════════════

-- ── Suppliers ───────────────────────────────────────────────────────────────
-- Mirrors Supplier. Created before ingredients so the supplier_id FK resolves.
create table if not exists public.suppliers (
  id             text not null,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  name           text not null,
  phone          text,
  email          text,
  created_at     timestamptz not null default now(),
  primary key (restaurant_id, id)
);
create index if not exists suppliers_restaurant_idx on public.suppliers (restaurant_id);

-- ── Ingredients ─────────────────────────────────────────────────────────────
-- Mirrors Ingredient. stock/low_threshold/cost_per_unit are whole-unit numbers.
create table if not exists public.ingredients (
  id             text not null,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  name           text not null,
  unit           text not null,                      -- 'kg' | 'L' | 'pcs' …
  stock          numeric not null default 0,
  low_threshold  numeric not null default 0,
  cost_per_unit  integer not null default 0,         -- rupees (whole)
  supplier_id    text,                               -- references suppliers.id, nullable
  created_at     timestamptz not null default now(),
  primary key (restaurant_id, id)
);
create index if not exists ingredients_restaurant_idx on public.ingredients (restaurant_id);

-- ── Recipes (bill of materials per menu item) ───────────────────────────────
-- Mirrors Recipe; lines are stored as jsonb (RecipeLine[]).
create table if not exists public.recipes (
  item_id        text not null,                      -- references menu_items.id
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  lines          jsonb not null default '[]'::jsonb, -- RecipeLine[]
  created_at     timestamptz not null default now(),
  primary key (restaurant_id, item_id)
);
create index if not exists recipes_restaurant_idx on public.recipes (restaurant_id);

-- ── Purchase orders ─────────────────────────────────────────────────────────
-- Mirrors PurchaseOrder; lines are stored as jsonb ({ingredientId,qty,cost}[]).
create table if not exists public.purchase_orders (
  id             text not null,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  supplier_id    text not null,                      -- references suppliers.id
  lines          jsonb not null default '[]'::jsonb,
  status         text not null default 'draft',      -- PoStatus union
  created_at     timestamptz not null default now(),
  received_at    timestamptz,
  primary key (restaurant_id, id)
);
create index if not exists purchase_orders_restaurant_idx
  on public.purchase_orders (restaurant_id, created_at desc);

-- ── Wastage ─────────────────────────────────────────────────────────────────
create table if not exists public.wastage (
  id             text not null,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  ingredient_id  text not null,                      -- references ingredients.id
  qty            numeric not null default 0,
  reason         text not null,
  created_at     timestamptz not null default now(),
  primary key (restaurant_id, id)
);
create index if not exists wastage_restaurant_idx
  on public.wastage (restaurant_id, created_at desc);

-- ── Stock movements (audit ledger of every stock delta) ─────────────────────
create table if not exists public.stock_movements (
  id             text not null,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  ingredient_id  text not null,                      -- references ingredients.id
  delta          numeric not null default 0,         -- signed: + purchase, - usage/wastage
  reason         text not null,                      -- 'order' | 'purchase' | 'wastage' | 'adjust'
  ref_id         text,                               -- order/PO/wastage id, nullable
  created_at     timestamptz not null default now(),
  primary key (restaurant_id, id)
);
create index if not exists stock_movements_restaurant_idx
  on public.stock_movements (restaurant_id, created_at desc);
create index if not exists stock_movements_ingredient_idx
  on public.stock_movements (restaurant_id, ingredient_id);

-- ── Promotions ──────────────────────────────────────────────────────────────
-- Mirrors Promo. start_hour/end_hour are 0..23 (happy-hour windows), nullable.
create table if not exists public.promos (
  id             text not null,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  name           text not null,
  kind           text not null,                      -- PromoKind union
  value          integer not null default 0,         -- percent (0..100) or flat rupees
  code           text,                               -- coupon code, nullable
  single_use     boolean not null default false,
  active         boolean not null default true,
  start_hour     int,                                -- 0..23, nullable
  end_hour       int,                                -- 0..23, nullable
  created_at     timestamptz not null default now(),
  primary key (restaurant_id, id)
);
create index if not exists promos_restaurant_idx on public.promos (restaurant_id);

-- ── Audit log (governance: voids / comps / discounts / merges / transfers) ──
create table if not exists public.audit_log (
  id             text not null,
  restaurant_id  uuid not null references public.restaurants (id) on delete cascade,
  type           text not null,                      -- AuditType union
  order_id       text,                               -- references orders.id, nullable
  table_id       text,                               -- references restaurant_tables.id, nullable
  amount         integer,                            -- rupees, nullable
  reason         text not null,
  staff_id       text,                               -- references staff.id, nullable
  created_at     timestamptz not null default now(),
  primary key (restaurant_id, id)
);
create index if not exists audit_log_restaurant_idx
  on public.audit_log (restaurant_id, created_at desc);

-- ── RLS — scope every row to the caller's restaurant ────────────────────────
alter table public.suppliers        enable row level security;
alter table public.ingredients      enable row level security;
alter table public.recipes          enable row level security;
alter table public.purchase_orders  enable row level security;
alter table public.wastage          enable row level security;
alter table public.stock_movements  enable row level security;
alter table public.promos           enable row level security;
alter table public.audit_log        enable row level security;

drop policy if exists "own suppliers" on public.suppliers;
create policy "own suppliers" on public.suppliers
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

drop policy if exists "own ingredients" on public.ingredients;
create policy "own ingredients" on public.ingredients
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

drop policy if exists "own recipes" on public.recipes;
create policy "own recipes" on public.recipes
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

drop policy if exists "own purchase_orders" on public.purchase_orders;
create policy "own purchase_orders" on public.purchase_orders
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

drop policy if exists "own wastage" on public.wastage;
create policy "own wastage" on public.wastage
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

drop policy if exists "own stock_movements" on public.stock_movements;
create policy "own stock_movements" on public.stock_movements
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

drop policy if exists "own promos" on public.promos;
create policy "own promos" on public.promos
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

drop policy if exists "own audit_log" on public.audit_log;
create policy "own audit_log" on public.audit_log
  for all using (restaurant_id = public.current_restaurant_id())
  with check (restaurant_id = public.current_restaurant_id());

-- ── Realtime — broadcast row changes for live cross-device sync ─────────────
do $$ begin
  alter publication supabase_realtime add table
    public.suppliers, public.ingredients, public.recipes, public.purchase_orders,
    public.wastage, public.stock_movements, public.promos, public.audit_log;
exception when duplicate_object then null; end $$;
