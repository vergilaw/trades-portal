-- Add the quote creation date to the existing capability-scoped portal response.
-- Preserve the existing rule: approved portals remain available after expiry.
create or replace function public.get_portal_quote(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'id', q.id, 'token', q.public_token, 'title', q.title, 'customerName', q.customer_name,
    'currency', q.currency, 'notes', q.notes, 'status', q.status, 'subtotal', q.subtotal,
    'taxRate', q.tax_rate, 'taxAmount', q.tax_amount, 'total', q.total,
    'createdAt', q.created_at, 'expiresAt', q.expires_at, 'respondedAt', q.responded_at,
    'contractor', jsonb_build_object('name', p.full_name, 'businessName', p.business_name, 'phone', p.phone),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', i.id, 'description', i.description,
      'quantity', i.quantity, 'unitPrice', i.unit_price, 'position', i.position) order by i.position)
      from public.quote_items i where i.quote_id = q.id), '[]'::jsonb),
    'photos', coalesce((select jsonb_agg(jsonb_build_object('id', ph.id, 'phase', ph.phase,
      'storagePath', ph.storage_path, 'width', ph.width, 'height', ph.height, 'position', ph.position) order by ph.position)
      from public.quote_photos ph where ph.quote_id = q.id), '[]'::jsonb)
  ) into result from public.quotes q join public.profiles p on p.id = q.contractor_id
    where q.public_token = p_token and q.status in ('sent','approved','rejected')
      and (q.status = 'approved' or q.expires_at is null or q.expires_at > now());
  return result;
end; $$;
