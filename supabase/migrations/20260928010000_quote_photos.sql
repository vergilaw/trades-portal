-- Before/after evidence photos for quotes.
-- The bucket remains private. Portal access is capability-based through the
-- quote public token and short-lived signed URLs.

create table public.quote_photos (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes (id) on delete cascade,
  storage_path text not null unique,
  phase text not null check (phase in ('before', 'after')),
  mime_type text not null check (
    mime_type in ('image/jpeg', 'image/png', 'image/webp')
  ),
  size_bytes integer not null check (size_bytes > 0 and size_bytes <= 2097152),
  width integer not null check (width > 0 and width <= 1920),
  height integer not null check (height > 0 and height <= 1920),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now()
);

create index quote_photos_quote_position_idx
  on public.quote_photos (quote_id, position);

create function public.prepare_quote_photo()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  photo_count integer;
  next_position integer;
begin
  -- Serialize photo inserts for a quote so the ten-photo limit cannot race.
  perform 1 from public.quotes where id = new.quote_id for update;

  select count(*), coalesce(max(position) + 1, 0)
  into photo_count, next_position
  from public.quote_photos
  where quote_id = new.quote_id;

  if photo_count >= 10 then
    raise exception 'A quote can have at most 10 photos'
      using errcode = 'check_violation';
  end if;

  new.position := next_position;
  return new;
end;
$$;

create trigger quote_photos_prepare_insert
before insert on public.quote_photos
for each row execute function public.prepare_quote_photo();

alter table public.quote_photos enable row level security;

create policy "Contractors can view their quote photos"
on public.quote_photos for select to authenticated
using (
  exists (
    select 1 from public.quotes
    where quotes.id = quote_photos.quote_id
      and quotes.contractor_id = (select auth.uid())
  )
);

create policy "Contractors can create their quote photos"
on public.quote_photos for insert to authenticated
with check (
  exists (
    select 1 from public.quotes
    where quotes.id = quote_photos.quote_id
      and quotes.contractor_id = (select auth.uid())
      and quote_photos.storage_path like quotes.public_token::text || '/%'
  )
);

create policy "Contractors can delete their quote photos"
on public.quote_photos for delete to authenticated
using (
  exists (
    select 1 from public.quotes
    where quotes.id = quote_photos.quote_id
      and quotes.contractor_id = (select auth.uid())
  )
);

grant select, insert, delete on public.quote_photos to authenticated;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'quote-images',
  'quote-images',
  false,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Contractors can upload quote images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'quote-images'
  and owner_id = (select auth.uid()::text)
  and array_length(storage.foldername(name), 1) = 1
  and lower(storage.extension(name)) in ('jpg', 'jpeg', 'png', 'webp')
  and exists (
    select 1 from public.quotes
    where quotes.public_token::text = (storage.foldername(name))[1]
      and quotes.contractor_id = (select auth.uid())
  )
);

create policy "Contractors can read quote images"
on storage.objects for select to authenticated
using (
  bucket_id = 'quote-images'
  and owner_id = (select auth.uid()::text)
  and storage.allow_any_operation(array[
    'object.get_authenticated_info',
    'object.get_authenticated'
  ])
);

create policy "Contractors can delete quote images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'quote-images'
  and owner_id = (select auth.uid()::text)
);

create function public.can_read_portal_photo(p_storage_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.quote_photos
    join public.quotes on quotes.id = quote_photos.quote_id
    where quote_photos.storage_path = p_storage_path
      and quotes.public_token::text =
        (storage.foldername(p_storage_path))[1]
      and quotes.status in ('sent', 'approved', 'rejected')
      and (quotes.expires_at is null or quotes.expires_at > now())
  );
$$;

revoke all on function public.can_read_portal_photo(text) from public;
grant execute on function public.can_read_portal_photo(text)
  to anon, authenticated;

create policy "Portal visitors can read quote images"
on storage.objects for select to anon, authenticated
using (
  bucket_id = 'quote-images'
  and storage.allow_any_operation(array[
    'object.get_authenticated_info',
    'object.get_authenticated'
  ])
  and public.can_read_portal_photo(name)
);

create or replace function public.get_portal_quote(p_token uuid)
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
    ), '[]'::jsonb),
    'photos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', qp.id,
        'phase', qp.phase,
        'storagePath', qp.storage_path,
        'width', qp.width,
        'height', qp.height,
        'position', qp.position
      ) order by qp.position)
      from public.quote_photos qp
      where qp.quote_id = q.id
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

revoke all on function public.get_portal_quote(uuid) from public;
grant execute on function public.get_portal_quote(uuid) to anon, authenticated;
