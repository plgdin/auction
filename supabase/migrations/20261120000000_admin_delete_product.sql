-- Admin hard-delete for shop listings.
--
-- Products are referenced by auction_financial_records.product_id with
-- ON DELETE RESTRICT, which blocks every hard delete once an item has been
-- through an auction. This RPC clears those finance rows first (they are the
-- only RESTRICT reference), then deletes the product so the remaining
-- CASCADE / SET NULL rules take over:
--   * CASCADE  : product_images, cart_items, inventory_reservations, offers,
--                auctions (+ bids), auction_selection_history, product_reports,
--                saved_products
--   * SET NULL : order_items (keeps title/image/price snapshots), reviews
--
-- Order history is preserved. The action is audited and the seller notified.

create or replace function public.admin_delete_product(p_product_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;

  select * into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Listing not found';
  end if;

  -- The RESTRICT foreign key that would otherwise block the delete.
  delete from public.auction_financial_records
  where product_id = p_product_id;

  delete from public.products
  where id = p_product_id;

  perform public.log_audit(
    'listing.deleted',
    'product',
    p_product_id::text,
    jsonb_build_object('title', v_product.title, 'seller_id', v_product.seller_id)
  );

  perform public.notify_user(
    v_product.seller_id,
    'listing_deleted',
    'Listing removed by admin',
    v_product.title || ' was permanently removed from the shop.',
    jsonb_build_object('href', '#/seller?tab=listings')
  );
end;
$$;

revoke all on function public.admin_delete_product(uuid) from public;
grant execute on function public.admin_delete_product(uuid) to authenticated;
