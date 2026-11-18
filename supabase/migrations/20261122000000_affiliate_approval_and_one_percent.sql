-- ============================================================================
-- Migration: 20261122000000_affiliate_approval_and_one_percent.sql
-- Description: Sets default affiliate commission to 1.00%, implements
--              application and admin approval workflow for affiliate links.
-- ============================================================================

-- 1. Update platform settings default commission to 1%
insert into public.platform_settings (key, value)
values ('affiliate_commission_pct', '1'::jsonb)
on conflict (key) do update set value = '1'::jsonb;

-- 2. Expand status constraint to support 'pending' and 'rejected'
alter table public.affiliate_accounts drop constraint if exists affiliate_accounts_status_check;
alter table public.affiliate_accounts
  add constraint affiliate_accounts_status_check
  check (status in ('pending', 'active', 'rejected', 'paused', 'banned'));

-- 3. Set default commission rate to 1.00% and update existing 5% accounts
alter table public.affiliate_accounts alter column commission_pct set default 1.00;
alter table public.affiliate_accounts add column if not exists application_note text;

update public.affiliate_accounts
set commission_pct = 1.00
where commission_pct = 5.00;

-- 4. User RPC: Apply for affiliate program (starts in 'pending' status)
create or replace function public.affiliate_apply(p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_account public.affiliate_accounts;
  v_base text;
  v_code text;
begin
  if v_uid is null then raise exception 'Sign in to apply for the affiliate program.'; end if;

  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.is_blocked then raise exception 'Your account is blocked.'; end if;

  select * into v_account from public.affiliate_accounts where user_id = v_uid;
  if found then
    return jsonb_build_object(
      'account', to_jsonb(v_account),
      'status', v_account.status
    );
  end if;

  -- Generate code in advance for when admin approves
  v_base := regexp_replace(lower(coalesce(nullif(split_part(v_profile.full_name, ' ', 1), ''), 'lelam')), '[^a-z0-9]', '', 'g');
  if length(v_base) < 3 then v_base := 'lelam'; end if;
  v_base := substr(v_base, 1, 10);

  loop
    v_code := v_base || substr(md5(random()::text), 1, 4);
    exit when not exists (
      select 1 from public.affiliate_accounts where lower(code) = v_code
    );
  end loop;

  insert into public.affiliate_accounts (
    user_id,
    display_name,
    contact_email,
    kind,
    code,
    commission_pct,
    status,
    application_note
  ) values (
    v_uid,
    v_profile.full_name,
    v_profile.email,
    'creator',
    v_code,
    1.00,
    'pending',
    p_note
  ) returning * into v_account;

  return jsonb_build_object(
    'account', to_jsonb(v_account),
    'status', 'pending'
  );
end;
$$;

grant execute on function public.affiliate_apply(text) to authenticated;

-- 5. User RPC: Dashboard only returns link if status is active
create or replace function public.affiliate_dashboard()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_account public.affiliate_accounts;
  v_app_url text;
  v_commissions jsonb;
begin
  if v_uid is null then raise exception 'Sign in to access affiliate dashboard.'; end if;

  select * into v_account from public.affiliate_accounts where user_id = v_uid;
  if not found then
    return jsonb_build_object('account', null, 'status', 'unapplied');
  end if;

  if v_account.status <> 'active' then
    return jsonb_build_object(
      'account', to_jsonb(v_account),
      'status', v_account.status,
      'link', null
    );
  end if;

  select coalesce(value #>> '{}', 'https://lelam.co') into v_app_url
  from public.platform_settings where key = 'app_url';

  select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) into v_commissions
  from (
    select * from public.affiliate_commissions
    where affiliate_id = v_account.id
    order by created_at desc
    limit 50
  ) c;

  return jsonb_build_object(
    'account', to_jsonb(v_account),
    'status', 'active',
    'link', rtrim(coalesce(v_app_url, 'https://lelam.co'), '/') || '/?ref=' || v_account.code,
    'commissions', v_commissions
  );
end;
$$;

grant execute on function public.affiliate_dashboard() to authenticated;

-- 6. Admin RPC: Approve affiliate application (1% default)
create or replace function public.admin_approve_affiliate(
  p_affiliate_id uuid,
  p_commission_pct numeric default 1.00
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.affiliate_accounts;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;

  update public.affiliate_accounts
  set status = 'active',
      commission_pct = coalesce(p_commission_pct, 1.00),
      updated_at = now()
  where id = p_affiliate_id
  returning * into v_account;

  if not found then raise exception 'Affiliate account not found'; end if;

  if v_account.user_id is not null then
    perform public.notify_user(
      v_account.user_id,
      'affiliate_approved',
      'Affiliate application approved!',
      'Your affiliate link is now live! Share it to earn ' || v_account.commission_pct || '% on orders.',
      jsonb_build_object('href', '/account?tab=affiliate')
    );
  end if;

  return to_jsonb(v_account);
end;
$$;

grant execute on function public.admin_approve_affiliate(uuid, numeric) to authenticated;

-- 7. Admin RPC: Reject affiliate application
create or replace function public.admin_reject_affiliate(
  p_affiliate_id uuid,
  p_reason text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account public.affiliate_accounts;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;

  update public.affiliate_accounts
  set status = 'rejected',
      updated_at = now()
  where id = p_affiliate_id
  returning * into v_account;

  if not found then raise exception 'Affiliate account not found'; end if;

  if v_account.user_id is not null then
    perform public.notify_user(
      v_account.user_id,
      'affiliate_rejected',
      'Affiliate application update',
      coalesce(p_reason, 'Your affiliate application was not approved at this time.'),
      jsonb_build_object('href', '/account?tab=affiliate')
    );
  end if;

  return to_jsonb(v_account);
end;
$$;

grant execute on function public.admin_reject_affiliate(uuid, text) to authenticated;

