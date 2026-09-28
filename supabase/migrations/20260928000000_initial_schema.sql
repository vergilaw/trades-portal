-- Trades Portal MVP: profiles, quotes, and quote_items only.
-- Run this migration with the Supabase CLI or paste it into the SQL Editor.

create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  business_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.quotes (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references public.profiles (id) on delete cascade,
  public_token uuid not null unique default gen_random_uuid(),
  title text not null,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  currency text not null default 'VND' check (currency ~ '^[A-Z]{3}$'),
  notes text,
  status text not null default 'sent'
    check (status in ('draft', 'sent', 'approved', 'rejected')),
  tax_rate numeric(5, 2) not null default 0 check (tax_rate >= 0 and tax_rate <= 100),
  subtotal numeric(14, 2) not null default 0 check (subtotal >= 0),
  tax_amount numeric(14, 2) not null default 0 check (tax_amount >= 0),
  total numeric(14, 2) not null default 0 check (total >= 0),
  expires_at timestamptz,
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > created_at)
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  description text not null,
  quantity numeric(12, 2) not null default 1 check (quantity > 0),
  unit_price numeric(14, 2) not null check (unit_price >= 0),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (quote_id, position)
);

create index quotes_contractor_created_at_idx
  on public.quotes (contractor_id, created_at desc);
create index quotes_public_token_idx on public.quotes (public_token);
create index quote_items_quote_position_idx on public.quote_items (quote_id, position);

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger quotes_set_updated_at
before update on public.quotes
for each row execute function public.set_updated_at();

create trigger quote_items_set_updated_at
before update on public.quote_items
for each row execute function public.set_updated_at();

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, business_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'business_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.quotes enable row level security;
alter table public.quote_items enable row level security;

create policy "Contractors can view their profile"
on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy "Contractors can update their profile"
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy "Contractors can view their quotes"
on public.quotes for select to authenticated
using (contractor_id = (select auth.uid()));

create policy "Contractors can create their quotes"
on public.quotes for insert to authenticated
with check (contractor_id = (select auth.uid()));

create policy "Contractors can update their quotes"
on public.quotes for update to authenticated
using (contractor_id = (select auth.uid()))
with check (contractor_id = (select auth.uid()));

create policy "Contractors can delete their quotes"
on public.quotes for delete to authenticated
using (contractor_id = (select auth.uid()));

create policy "Contractors can view their quote items"
on public.quote_items for select to authenticated
using (
  exists (
    select 1 from public.quotes
    where quotes.id = quote_items.quote_id
      and quotes.contractor_id = (select auth.uid())
  )
);

create policy "Contractors can create their quote items"
on public.quote_items for insert to authenticated
with check (
  exists (
    select 1 from public.quotes
    where quotes.id = quote_items.quote_id
      and quotes.contractor_id = (select auth.uid())
  )
);

create policy "Contractors can update their quote items"
on public.quote_items for update to authenticated
using (
  exists (
    select 1 from public.quotes
    where quotes.id = quote_items.quote_id
      and quotes.contractor_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.quotes
    where quotes.id = quote_items.quote_id
      and quotes.contractor_id = (select auth.uid())
  )
);

create policy "Contractors can delete their quote items"
on public.quote_items for delete to authenticated
using (
  exists (
    select 1 from public.quotes
    where quotes.id = quote_items.quote_id
      and quotes.contractor_id = (select auth.uid())
  )
);

-- Public access uses capability-style RPCs. Direct anonymous SELECT is deliberately
-- not enabled, so a caller cannot enumerate every portal quote.
create function public.get_portal_quote(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  portal_quote jsonb;
begin
  select jsonb_build_object(
    'id', q.id,
    'token', q.public_token,
    'title', q.title,
    'customerName', q.customer_name,
    'currency', q.currency,
    'notes', q.notes,
    'status', q.status,
    'subtotal', q.subtotal,
    'taxRate', q.tax_rate,
    'taxAmount', q.tax_amount,
    'total', q.total,
    'expiresAt', q.expires_at,
    'respondedAt', q.responded_at,
    'contractor', jsonb_build_object(
      'name', p.full_name,
      'businessName', p.business_name,
      'phone', p.phone
    ),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', qi.id,
        'description', qi.description,
        'quantity', qi.quantity,
        'unitPrice', qi.unit_price,
        'position', qi.position
      ) order by qi.position)
      from public.quote_items qi
      where qi.quote_id = q.id
    ), '[]'::jsonb)
  )
  into portal_quote
  from public.quotes q
  join public.profiles p on p.id = q.contractor_id
  where q.public_token = p_token
    and q.status in ('sent', 'approved', 'rejected')
    and (q.expires_at is null or q.expires_at > now());

  return portal_quote;
end;
$$;

create function public.respond_to_portal_quote(p_token uuid, p_decision text)
returns table (status text, responded_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Invalid quote decision';
  end if;

  return query
  update public.quotes
  set status = p_decision,
      responded_at = now()
  where public_token = p_token
    and status = 'sent'
    and (expires_at is null or expires_at > now())
  returning quotes.status, quotes.responded_at;
end;
$$;

revoke all on function public.get_portal_quote(uuid) from public;
revoke all on function public.respond_to_portal_quote(uuid, text) from public;
grant execute on function public.get_portal_quote(uuid) to anon, authenticated;
grant execute on function public.respond_to_portal_quote(uuid, text) to anon, authenticated;
