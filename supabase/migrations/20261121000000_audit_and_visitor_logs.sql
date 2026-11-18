-- ============================================================================
-- Migration: 20261121000000_audit_and_visitor_logs.sql
-- Description: Extends audit_logs with visitor tracking columns (IP, location,
--              page path, user agent), adds public.log_visitor_activity RPC,
--              audit_logs_with_users view, and admin RLS security policies.
-- ============================================================================

-- 1. Ensure columns exist on audit_logs
alter table public.audit_logs add column if not exists ip_address text;
alter table public.audit_logs add column if not exists page_path text;
alter table public.audit_logs add column if not exists user_agent text;
alter table public.audit_logs add column if not exists location text;
alter table public.audit_logs add column if not exists city text;
alter table public.audit_logs add column if not exists country text;
alter table public.audit_logs add column if not exists country_code text;

-- Make entity_type optional for general page visits
alter table public.audit_logs alter column entity_type drop not null;

-- 2. Indexes for analytics and filtering
create index if not exists audit_logs_created_at_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action);
create index if not exists audit_logs_actor_id_idx on public.audit_logs (actor_id);
create index if not exists audit_logs_page_path_idx on public.audit_logs (page_path);
create index if not exists audit_logs_ip_address_idx on public.audit_logs (ip_address);

-- 3. Secure logging RPC function callable by anon guests and authenticated users
create or replace function public.log_visitor_activity(
  p_action text,
  p_page_path text default null,
  p_entity_type text default null,
  p_entity_id text default null,
  p_ip_address text default null,
  p_user_agent text default null,
  p_location text default null,
  p_city text default null,
  p_country text default null,
  p_country_code text default null,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_log_id uuid;
begin
  v_actor_id := auth.uid();

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    ip_address,
    page_path,
    user_agent,
    location,
    city,
    country,
    country_code,
    metadata,
    created_at
  ) values (
    v_actor_id,
    coalesce(p_action, 'page_view'),
    p_entity_type,
    p_entity_id,
    p_ip_address,
    coalesce(p_page_path, '/'),
    p_user_agent,
    p_location,
    p_city,
    p_country,
    p_country_code,
    coalesce(p_metadata, '{}'::jsonb),
    now()
  ) returning id into v_log_id;

  return v_log_id;
end;
$$;

grant execute on function public.log_visitor_activity to anon, authenticated;

-- 4. View joined with profiles for rich admin review
create or replace view public.audit_logs_with_users as
select
  a.id,
  a.actor_id,
  a.action,
  a.entity_type,
  a.entity_id,
  a.ip_address,
  a.page_path,
  a.user_agent,
  a.location,
  a.city,
  a.country,
  a.country_code,
  a.metadata,
  a.created_at,
  p.full_name as user_name,
  p.email as user_email,
  p.role as user_role
from public.audit_logs a
left join public.profiles p on p.id = a.actor_id;

grant select on public.audit_logs_with_users to authenticated;

-- 5. RLS security: Only admins can view audit logs
alter table public.audit_logs enable row level security;

drop policy if exists "Admins can view audit logs" on public.audit_logs;
create policy "Admins can view audit logs"
  on public.audit_logs
  for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );
