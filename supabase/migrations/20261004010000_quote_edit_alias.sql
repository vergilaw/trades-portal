-- Qualify quote_items.quote_id to avoid collision with the RPC output parameter.
-- Atomic quote editing and duplication for authenticated quote owners.

create or replace function public.update_quote_with_items(
  p_quote_id uuid,
  p_title text,
  p_customer_name text,
  p_customer_email text,
  p_customer_phone text,
  p_notes text,
  p_tax_rate numeric,
  p_expires_at timestamptz,
  p_items jsonb
)
returns table (quote_id uuid, quote_token uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_id uuid;
  updated_token uuid;
  calculated_subtotal numeric(14, 2) := 0;
  calculated_tax numeric(14, 2) := 0;
  calculated_total numeric(14, 2) := 0;
  item jsonb;
  item_description text;
  item_quantity numeric;
  item_unit_price numeric;
begin
  if p_title is null or length(trim(p_title)) = 0 or length(trim(p_title)) > 140 then
    raise exception 'Invalid quote title';
  end if;
  if p_customer_name is null or length(trim(p_customer_name)) = 0
    or length(trim(p_customer_name)) > 120 then
    raise exception 'Invalid customer name';
  end if;
  if p_tax_rate is null or p_tax_rate < 0 or p_tax_rate > 100 then
    raise exception 'Invalid tax rate';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'Expiry date must be in the future';
  end if;
  if p_items is null
    or jsonb_typeof(p_items) is distinct from 'array'
    or jsonb_array_length(p_items) < 1
    or jsonb_array_length(p_items) > 20 then
    raise exception 'A quote needs between 1 and 20 items';
  end if;

  for item in select value from jsonb_array_elements(p_items)
  loop
    item_description := trim(item ->> 'description');
    item_quantity := (item ->> 'quantity')::numeric;
    item_unit_price := (item ->> 'unitPrice')::numeric;

    if item_description is null or length(item_description) = 0
      or length(item_description) > 240
      or item_quantity is null
      or item_quantity <= 0
      or item_unit_price is null
      or item_unit_price < 0 then
      raise exception 'Invalid quote item';
    end if;

    calculated_subtotal := calculated_subtotal
      + (item_quantity * item_unit_price);
  end loop;

  calculated_subtotal := round(calculated_subtotal, 2);
  calculated_tax := round(calculated_subtotal * p_tax_rate / 100, 2);
  calculated_total := calculated_subtotal + calculated_tax;

  update public.quotes as q
  set title = trim(p_title),
      customer_name = trim(p_customer_name),
      customer_email = nullif(trim(p_customer_email), ''),
      customer_phone = nullif(trim(p_customer_phone), ''),
      notes = nullif(trim(p_notes), ''),
      tax_rate = p_tax_rate,
      subtotal = calculated_subtotal,
      tax_amount = calculated_tax,
      total = calculated_total,
      expires_at = p_expires_at
  where q.id = p_quote_id
    and q.contractor_id = (select auth.uid())
    and q.status = 'sent'
  returning q.id, q.public_token into updated_id, updated_token;

  if updated_id is null then
    raise exception 'Quote is not editable';
  end if;

  delete from public.quote_items as qi where qi.quote_id = updated_id;

  insert into public.quote_items (
    quote_id,
    description,
    quantity,
    unit_price,
    position
  )
  select
    updated_id,
    trim(value ->> 'description'),
    (value ->> 'quantity')::numeric,
    (value ->> 'unitPrice')::numeric,
    (ordinality - 1)::integer
  from jsonb_array_elements(p_items) with ordinality;

  return query select updated_id, updated_token;
end;
$$;

-- The approval RPC also has output parameters matching columns in quotes.
create or replace function public.respond_to_portal_quote(p_token uuid, p_decision text)
returns table (status text, responded_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  if p_decision is null or p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid quote decision';
  end if;
  return query
  update public.quotes as q
  set status = p_decision, responded_at = now()
  where q.public_token = p_token and q.status = 'sent'
    and (q.expires_at is null or q.expires_at > now())
  returning q.status, q.responded_at;
end;
$$;
