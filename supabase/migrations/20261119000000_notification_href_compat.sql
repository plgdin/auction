-- Notification href compatibility
--
-- Historical migrations (which we deliberately leave untouched) emit legacy
-- hashes like '#/order/<id>' in notification data. Active app code now emits
-- clean '/orders/<id>'. To keep old generated links working, we normalize hrefs
-- at the database boundary (BEFORE INSERT), fix up already-stored rows, and
-- keep the React client's normalizeHref as a second line of defence.
-- Historical migrations are NOT edited so their recorded history stays intact.

-- Normalize a single notification's data->>'href':
--   1. strip a leading '#/'      -> '#/order/x' becomes '/order/x'
--   2. map '^/order/' to plural  -> '/order/x'   becomes '/orders/x'
-- The strict '^/order/' anchor leaves '/orders/', '/order-confirmed/', etc. alone.
-- Missing keys, NULL data and non-text hrefs are ignored.
create or replace function public.normalize_notification_href()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_href text;
  v_norm text;
begin
  if new.data is null or jsonb_typeof(new.data -> 'href') is distinct from 'string' then
    return new;
  end if;

  v_href := new.data ->> 'href';
  v_norm := regexp_replace(v_href, '^#/', '/');
  v_norm := regexp_replace(v_norm, '^/order/', '/orders/');

  if v_norm is distinct from v_href then
    new.data := jsonb_set(new.data, '{href}', to_jsonb(v_norm));
  end if;

  return new;
end;
$$;

-- Fire for every insert, including those from old SQL functions via notify_user().
drop trigger if exists notifications_normalize_href on public.notifications;
create trigger notifications_normalize_href
  before insert on public.notifications
  for each row execute function public.normalize_notification_href();

-- Backfill existing rows that still carry a legacy hash or singular order href.
-- Re-running is a no-op because normalized hrefs no longer match either pattern.
update public.notifications
set data = jsonb_set(
  data,
  '{href}',
  to_jsonb(regexp_replace(regexp_replace(data ->> 'href', '^#/', '/'), '^/order/', '/orders/'))
)
where jsonb_typeof(data -> 'href') = 'string'
  and (data ->> 'href' like '#/%' or data ->> 'href' ~ '^/order/');
