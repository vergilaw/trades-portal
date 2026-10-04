-- Offline VietQR + manual settlement. Privileged mutations only through RPCs.
create table public.payment_banks (
  bin text primary key check (bin ~ '^[0-9]{6}$'),
  name text not null
);
insert into public.payment_banks (bin, name) values
  ('970416','ACB'), ('970405','Agribank'), ('970418','BIDV'),
  ('970431','Eximbank'), ('970437','HDBank'), ('970452','KienLongBank'),
  ('970449','LPBank'), ('970422','MBBank'), ('970426','MSB'),
  ('970428','NamABank'), ('970419','NCB'), ('970448','OCB'),
  ('970412','PVcomBank'), ('970403','Sacombank'), ('970429','SCB'),
  ('970440','SeABank'), ('970443','SHB'), ('970424','ShinhanBank'),
  ('970407','Techcombank'), ('970423','TPBank'), ('970441','VIB'),
  ('970427','VietABank'), ('970433','VietBank'), ('970436','Vietcombank'),
  ('970415','VietinBank'), ('970432','VPBank');

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  bank_bin text not null references public.payment_banks(bin),
  account_number text not null check (account_number ~ '^[A-Za-z0-9]{1,19}$'),
  holder_name text not null check (holder_name ~ '^[A-Z][A-Z ]{1,99}$'),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(owner_id, bank_bin, account_number)
);
create table public.payment_requests (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete restrict,
  owner_id uuid not null references public.profiles(id),
  bank_account_id uuid not null references public.bank_accounts(id),
  bank_bin text not null references public.payment_banks(bin),
  account_number text not null check (account_number ~ '^[A-Za-z0-9]{1,19}$'),
  holder_name text not null,
  amount numeric(14,0) not null check (amount > 0),
  currency text not null default 'VND' check (currency = 'VND'),
  reference text not null unique default ('TP' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 20)))
    check (reference ~ '^TP[A-F0-9]{20}$'),
  status text not null default 'pending' check (status in ('pending','reported','paid','cancelled')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  reported_at timestamptz,
  paid_at timestamptz,
  confirmed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at > created_at),
  check ((status = 'paid') = (paid_at is not null and confirmed_by is not null)),
  check (status <> 'reported' or reported_at is not null)
);
-- 22-character reference fits the NAPAS purpose-of-transfer field (25 chars).
create unique index one_live_payment_per_quote on public.payment_requests(quote_id)
  where status in ('pending','reported','paid');
create index payment_requests_owner_created on public.payment_requests(owner_id, created_at desc);
create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payment_requests(id) on delete restrict,
  owner_id uuid not null references public.profiles(id),
  actor_id uuid,
  actor_kind text not null check (actor_kind in ('owner','customer')),
  from_status text check (from_status in ('pending','reported','paid','cancelled')),
  to_status text not null check (to_status in ('pending','reported','paid','cancelled')),
  note text check (length(note) <= 300),
  created_at timestamptz not null default now()
);
create index payment_events_payment_created on public.payment_events(payment_id, created_at);
create trigger payment_requests_updated before update on public.payment_requests
  for each row execute function public.set_updated_at();

alter table public.payment_banks enable row level security;
alter table public.bank_accounts enable row level security;
alter table public.payment_requests enable row level security;
alter table public.payment_events enable row level security;
create policy "Read supported banks" on public.payment_banks for select to authenticated using (true);
create policy "Read own bank accounts" on public.bank_accounts for select to authenticated using (owner_id = (select auth.uid()));
create policy "Read own payments" on public.payment_requests for select to authenticated using (owner_id = (select auth.uid()));
create policy "Read own payment history" on public.payment_events for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.payment_banks, public.bank_accounts, public.payment_requests, public.payment_events from public, anon, authenticated;
grant select on public.payment_banks, public.bank_accounts, public.payment_requests, public.payment_events to authenticated;

create function public.save_bank_account(p_bin text, p_number text, p_holder text)
returns uuid language plpgsql security definer set search_path = public as $$
declare account_id uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first'; end if;
  -- Serialize account additions; bound the settings list without a count race.
  perform 1 from public.profiles where id = auth.uid() for update;
  if not exists (select 1 from public.bank_accounts where owner_id = auth.uid() and bank_bin = p_bin and account_number = p_number)
     and (select count(*) from public.bank_accounts where owner_id = auth.uid()) >= 10 then
    raise exception 'A maximum of 10 receiving accounts is allowed';
  end if;
  insert into public.bank_accounts(owner_id, bank_bin, account_number, holder_name)
    values (auth.uid(), p_bin, p_number, p_holder)
    on conflict (owner_id, bank_bin, account_number) do update set holder_name = excluded.holder_name, is_active = true
    returning id into account_id;
  return account_id;
end; $$;

create function public.set_bank_account_active(p_id uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_active is null then raise exception 'Invalid account state'; end if;
  update public.bank_accounts set is_active = p_active where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'Account not found'; end if;
end; $$;

create function public.create_quote_payment(p_quote_id uuid, p_account_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare q public.quotes%rowtype; a public.bank_accounts%rowtype; existing public.payment_requests%rowtype; new_id uuid;
begin
  select * into q from public.quotes where id = p_quote_id and contractor_id = auth.uid() for update;
  if not found or q.status <> 'approved' then raise exception 'Only approved quotes can be paid'; end if;
  if q.currency <> 'VND' or q.total <= 0 or q.total <> trunc(q.total) then
    raise exception 'Payment requires a positive whole VND total';
  end if;
  select * into existing from public.payment_requests where quote_id = q.id and status in ('pending','reported','paid') for update;
  if found then
    if existing.status <> 'pending' or existing.expires_at > now() then return existing.id; end if;
    update public.payment_requests set status = 'cancelled' where id = existing.id;
    insert into public.payment_events(payment_id, owner_id, actor_id, actor_kind, from_status, to_status, note)
      values (existing.id, q.contractor_id, auth.uid(), 'owner', 'pending', 'cancelled', 'Expired request replaced');
  end if;
  select * into a from public.bank_accounts where id = p_account_id and owner_id = auth.uid() and is_active for share;
  if not found then raise exception 'Choose an active receiving account'; end if;
  insert into public.payment_requests(quote_id, owner_id, bank_account_id, bank_bin, account_number, holder_name, amount)
    values (q.id, q.contractor_id, a.id, a.bank_bin, a.account_number, a.holder_name, q.total) returning id into new_id;
  insert into public.payment_events(payment_id, owner_id, actor_id, actor_kind, to_status)
    values (new_id, q.contractor_id, auth.uid(), 'owner', 'pending');
  return new_id;
end; $$;

create function public.report_portal_payment(p_token uuid, p_payment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p public.payment_requests%rowtype;
begin
  select pr.* into p from public.payment_requests pr join public.quotes q on q.id = pr.quote_id
    where q.public_token = p_token and q.status = 'approved' and pr.id = p_payment_id for update of pr;
  if not found then raise exception 'Payment not found'; end if;
  if p.status in ('reported','paid') then return; end if;
  if p.status <> 'pending' or p.expires_at <= now() then raise exception 'Payment is not available'; end if;
  update public.payment_requests set status = 'reported', reported_at = now() where id = p.id;
  insert into public.payment_events(payment_id, owner_id, actor_id, actor_kind, from_status, to_status)
    values (p.id, p.owner_id, null, 'customer', 'pending', 'reported');
end; $$;

create function public.change_quote_payment(p_payment_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare p public.payment_requests%rowtype;
begin
  if p_status is null or p_status not in ('paid','pending','cancelled') or length(p_note) > 300 then raise exception 'Invalid payment update'; end if;
  select * into p from public.payment_requests where id = p_payment_id and owner_id = auth.uid() for update;
  if not found then raise exception 'Payment not found'; end if;
  if p.status = p_status then return; end if;
  if p.status not in ('pending','reported') or (p_status = 'pending' and p.status <> 'reported') then raise exception 'Payment cannot be changed'; end if;
  if p_status = 'paid' and (p_note is null or length(trim(p_note)) = 0) then raise exception 'Enter a bank reference or verification note'; end if;
  update public.payment_requests set status = p_status,
    paid_at = case when p_status = 'paid' then now() else null end,
    confirmed_by = case when p_status = 'paid' then auth.uid() else null end,
    reported_at = case when p_status = 'pending' then null else reported_at end
    where id = p.id;
  insert into public.payment_events(payment_id, owner_id, actor_id, actor_kind, from_status, to_status, note)
    values (p.id, p.owner_id, auth.uid(), 'owner', p.status, p_status, nullif(trim(p_note), ''));
end; $$;

create function public.get_portal_payment(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'bank_bin', p.bank_bin, 'account_number', p.account_number,
    'holder_name', p.holder_name, 'amount', p.amount, 'currency', p.currency, 'reference', p.reference,
    'status', p.status, 'expires_at', p.expires_at, 'reported_at', p.reported_at, 'paid_at', p.paid_at)
  from public.payment_requests p join public.quotes q on q.id = p.quote_id
  where q.public_token = p_token and q.status = 'approved'
  order by p.created_at desc, p.id desc limit 1;
$$;

revoke all on function public.save_bank_account(text,text,text), public.set_bank_account_active(uuid,boolean),
  public.create_quote_payment(uuid,uuid), public.change_quote_payment(uuid,text,text),
  public.report_portal_payment(uuid,uuid), public.get_portal_payment(uuid) from public;
grant execute on function public.save_bank_account(text,text,text), public.set_bank_account_active(uuid,boolean),
  public.create_quote_payment(uuid,uuid), public.change_quote_payment(uuid,text,text) to authenticated;
grant execute on function public.report_portal_payment(uuid,uuid), public.get_portal_payment(uuid) to anon, authenticated;

-- Approval ends quote-response expiry; keep accepted portals available for payment.
create or replace function public.get_portal_quote(p_token uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'id', q.id, 'token', q.public_token, 'title', q.title, 'customerName', q.customer_name,
    'currency', q.currency, 'notes', q.notes, 'status', q.status, 'subtotal', q.subtotal,
    'taxRate', q.tax_rate, 'taxAmount', q.tax_amount, 'total', q.total,
    'expiresAt', q.expires_at, 'respondedAt', q.responded_at,
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
create or replace function public.can_read_portal_photo(p_storage_path text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.quote_photos ph join public.quotes q on q.id = ph.quote_id
    where ph.storage_path = p_storage_path and q.public_token::text = (storage.foldername(p_storage_path))[1]
      and q.status in ('sent','approved','rejected')
      and (q.status = 'approved' or q.expires_at is null or q.expires_at > now()));
$$;
