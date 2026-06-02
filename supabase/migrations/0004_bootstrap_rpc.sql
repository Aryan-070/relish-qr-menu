-- ════════════════════════════════════════════════════════════════════════════
-- 0004 — bootstrap_tenant() RPC (fixes "new row violates RLS policy for
--        table restaurants" on first sign-in).
--
-- Run ONCE in the Supabase dashboard → SQL Editor (after 0001–0003). Idempotent.
--
-- WHY: provisioning a tenant from the client is a chicken-and-egg under RLS —
-- inserting a `restaurants` row then reading its id back via RETURNING is blocked
-- by the restaurants SELECT policy (id = current_restaurant_id()), which is still
-- null because the user has no membership yet. The clean fix (anticipated in
-- 0001's comments) is a SECURITY DEFINER function that creates the restaurant and
-- enrols the caller server-side, bypassing RLS, and returns the new id. The app
-- then seeds tenant data client-side, which now passes WITH CHECK because the
-- membership row exists and current_restaurant_id() resolves.
-- ════════════════════════════════════════════════════════════════════════════

create or replace function public.bootstrap_tenant(p_name text default 'My Restaurant')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rid uuid;
  v_name text := coalesce(nullif(btrim(p_name), ''), 'My Restaurant');
begin
  if v_uid is null then
    raise exception 'bootstrap_tenant: not authenticated';
  end if;

  -- Serialize concurrent first-sign-in calls for the SAME user (the auth effect
  -- and the billing loader can fire together) so we never create two tenants.
  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  -- Already enrolled? Return the existing tenant unchanged (idempotent no-op).
  select restaurant_id into v_rid from public.app_users where user_id = v_uid;
  if v_rid is not null then
    return v_rid;
  end if;

  -- First sign-in: create the restaurant and enrol the caller as admin.
  insert into public.restaurants (name) values (v_name)
    returning id into v_rid;

  insert into public.app_users (user_id, restaurant_id, role, display_name)
    values (v_uid, v_rid, 'admin', v_name);

  return v_rid;
end;
$$;

-- Only signed-in users may provision; the function itself checks auth.uid().
revoke all on function public.bootstrap_tenant(text) from public, anon;
grant execute on function public.bootstrap_tenant(text) to authenticated;
