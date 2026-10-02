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

  delete from public.quote_items where quote_id = updated_id;

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

create or replace function public.duplicate_quote(p_quote_id uuid)
returns table (quote_id uuid, quote_token uuid)
language plpgsql
security invoker
set search_path = public
as $$
declare
  source_quote public.quotes%rowtype;
  duplicated_id uuid;
  duplicated_token uuid;
begin
  select q.*
  into source_quote
  from public.quotes q
  where q.id = p_quote_id
    and q.contractor_id = (select auth.uid());

  if source_quote.id is null then
    raise exception 'Quote not found';
  end if;

  insert into public.quotes (
    contractor_id,
    title,
    customer_name,
    customer_email,
    customer_phone,
    currency,
    notes,
    status,
    tax_rate,
    subtotal,
    tax_amount,
    total,
    expires_at
  )
  values (
    source_quote.contractor_id,
    left(source_quote.title, 133) || ' (copy)',
    source_quote.customer_name,
    source_quote.customer_email,
    source_quote.customer_phone,
    source_quote.currency,
    source_quote.notes,
    'sent',
    source_quote.tax_rate,
    source_quote.subtotal,
    source_quote.tax_amount,
    source_quote.total,
    null
  )
  returning id, public_token into duplicated_id, duplicated_token;

  insert into public.quote_items (
    quote_id,
    description,
    quantity,
    unit_price,
    position
  )
  select
    duplicated_id,
    qi.description,
    qi.quantity,
    qi.unit_price,
    qi.position
  from public.quote_items qi
  where qi.quote_id = source_quote.id
  order by qi.position;

  return query select duplicated_id, duplicated_token;
end;
$$;

revoke all on function public.update_quote_with_items(
  uuid, text, text, text, text, text, numeric, timestamptz, jsonb
) from public;
revoke all on function public.duplicate_quote(uuid) from public;

grant execute on function public.update_quote_with_items(
  uuid, text, text, text, text, text, numeric, timestamptz, jsonb
) to authenticated;
grant execute on function public.duplicate_quote(uuid) to authenticated;
