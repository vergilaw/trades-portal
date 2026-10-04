-- SePay credentials are kept separately from owner-readable connection metadata.
create table public.sepay_connections (
  id uuid primary key,
  owner_id uuid not null unique references public.profiles(id),
  is_active boolean not null default true,
  key_version integer not null default 1,
  last_received_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.sepay_connection_secrets (
  connection_id uuid primary key references public.sepay_connections(id),
  encrypted_secret text not null
);
create table public.sepay_connection_accounts (
  connection_id uuid not null references public.sepay_connections(id),
  bank_account_id uuid not null references public.bank_accounts(id),
  primary key(connection_id, bank_account_id)
);
create table public.sepay_transactions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  connection_id uuid not null references public.sepay_connections(id),
  provider_id bigint not null check (provider_id > 0),
  bank_bin text,
  gateway text not null,
  account_number text not null,
  amount numeric(14,0) not null check (amount > 0),
  transfer_type text not null check (transfer_type in ('in','out')),
  reference text,
  content text not null,
  bank_reference text not null,
  transaction_at timestamptz not null,
  payment_id uuid references public.payment_requests(id),
  outcome text not null check (outcome in ('matched','review','ignored')),
  reason text not null,
  received_at timestamptz not null default now(),
  unique(owner_id, provider_id)
);
create index sepay_transactions_owner_received on public.sepay_transactions(owner_id, received_at desc);
alter table public.payment_requests add column settlement_source text check (settlement_source in ('manual','sepay'));
alter table public.payment_requests add column settled_transaction_id uuid unique references public.sepay_transactions(id);
update public.payment_requests set settlement_source = 'manual' where status = 'paid';
-- Replace the original paid/confirmed_by check without depending on its generated name.
do $$ declare constraint_name text; begin
  select conname into constraint_name from pg_constraint
  where conrelid = 'public.payment_requests'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) like '%confirmed_by%';
  if constraint_name is not null then execute format('alter table public.payment_requests drop constraint %I', constraint_name); end if;
end $$;
alter table public.payment_requests add constraint payment_settlement_integrity check (
  (status = 'paid' and paid_at is not null and settlement_source is not null and
    ((settlement_source = 'manual' and confirmed_by is not null and settled_transaction_id is null)
      or (settlement_source = 'sepay' and confirmed_by is null and settled_transaction_id is not null)))
  or (status <> 'paid' and paid_at is null and confirmed_by is null and settlement_source is null and settled_transaction_id is null)
);
alter table public.payment_events drop constraint payment_events_actor_kind_check;
alter table public.payment_events add constraint payment_events_actor_kind_check check (actor_kind in ('owner','customer','system'));

alter table public.sepay_connections enable row level security;
alter table public.sepay_connection_secrets enable row level security;
alter table public.sepay_connection_accounts enable row level security;
alter table public.sepay_transactions enable row level security;
create policy "Read own SePay connection" on public.sepay_connections for select to authenticated using (owner_id = (select auth.uid()));
create policy "Read own SePay account links" on public.sepay_connection_accounts for select to authenticated using
  (exists (select 1 from public.sepay_connections c where c.id = connection_id and c.owner_id = (select auth.uid())));
create policy "Read own SePay transactions" on public.sepay_transactions for select to authenticated using (owner_id = (select auth.uid()));
revoke all on public.sepay_connections, public.sepay_connection_secrets, public.sepay_connection_accounts, public.sepay_transactions from public, anon, authenticated;
grant select on public.sepay_connections, public.sepay_connection_accounts, public.sepay_transactions to authenticated;
grant select on public.sepay_connections, public.sepay_connection_secrets to service_role;

create function public.configure_sepay_connection(p_owner_id uuid, p_id uuid, p_secret text, p_account_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare existing_id uuid; begin
  -- Serialize configuration for this owner without blocking FK key-share locks
  -- taken by an in-flight webhook that already holds the connection row.
  perform 1 from public.profiles where id = p_owner_id for no key update;
  if not found then raise exception 'Owner not found'; end if;
  if p_secret is null or length(p_secret) < 50 or p_account_ids is null or cardinality(p_account_ids) not between 1 and 10 then raise exception 'Invalid connection'; end if;
  if (select count(*) from public.bank_accounts where id = any(p_account_ids) and owner_id = p_owner_id and is_active) <> cardinality(p_account_ids) then
    raise exception 'Choose your active receiving accounts';
  end if;
  select id into existing_id from public.sepay_connections where owner_id = p_owner_id for update;
  if found and existing_id <> p_id then raise exception 'Connection identity cannot change'; end if;
  insert into public.sepay_connections(id, owner_id) values (p_id, p_owner_id)
    on conflict (owner_id) do update set is_active = true, key_version = sepay_connections.key_version + 1, updated_at = now();
  insert into public.sepay_connection_secrets(connection_id, encrypted_secret) values (p_id, p_secret)
    on conflict (connection_id) do update set encrypted_secret = excluded.encrypted_secret;
  delete from public.sepay_connection_accounts where connection_id = p_id;
  insert into public.sepay_connection_accounts select p_id, unnest(p_account_ids);
end $$;

create function public.disconnect_sepay_connection(p_owner_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.sepay_connections set is_active = false, updated_at = now() where owner_id = p_owner_id;
end $$;

create function public.reconcile_sepay_transaction(
  p_connection_id uuid, p_key_version integer, p_provider_id bigint, p_bank_bin text,
  p_gateway text, p_account_number text, p_amount numeric, p_transfer_type text,
  p_reference text, p_content text, p_bank_reference text, p_transaction_at timestamptz,
  p_reference_reason text
) returns text language plpgsql security definer set search_path = public as $$
declare c public.sepay_connections%rowtype; p public.payment_requests%rowtype;
  new_id uuid; result text := 'review'; v_reason text; begin
  select * into c from public.sepay_connections where id = p_connection_id for update;
  if not found or not c.is_active or c.key_version <> p_key_version then raise exception 'Connection unavailable'; end if;
  if p_provider_id is null or p_provider_id <= 0 or p_amount is null or p_amount <= 0 or p_amount <> trunc(p_amount)
    or p_transfer_type is null or p_transfer_type not in ('in','out') or p_transaction_at is null
    or p_content is null or length(p_content) > 10000 then raise exception 'Invalid transaction'; end if;
  -- One durable insert and one settlement share the same transaction. A failed
  -- settlement rolls the insert back, so provider retries can safely recover.
  insert into public.sepay_transactions(owner_id, connection_id, provider_id, bank_bin, gateway, account_number,
    amount, transfer_type, reference, content, bank_reference, transaction_at, outcome, reason)
  values(c.owner_id, c.id, p_provider_id, p_bank_bin, p_gateway, p_account_number, p_amount, p_transfer_type,
    p_reference, p_content, p_bank_reference, p_transaction_at, 'review', 'unmatched')
  on conflict(owner_id, provider_id) do nothing returning id into new_id;
  if new_id is null then return 'duplicate'; end if;
  update public.sepay_connections set last_received_at = now() where id = c.id;
  if p_transfer_type = 'out' then result := 'ignored'; v_reason := 'outgoing';
  elsif p_reference_reason <> 'valid' then v_reason := p_reference_reason;
  elsif p_bank_bin is null then v_reason := 'unknown_bank';
  else
    select * into p from public.payment_requests where owner_id = c.owner_id and reference = p_reference for update;
    if not found then v_reason := 'unknown_reference';
    elsif p.bank_bin <> p_bank_bin or p.account_number <> p_account_number then v_reason := 'wrong_account';
    elsif not exists (select 1 from public.sepay_connection_accounts where connection_id = c.id and bank_account_id = p.bank_account_id) then v_reason := 'account_not_linked';
    elsif p.status not in ('pending','reported') then v_reason := 'request_closed';
    elsif not exists (select 1 from public.quotes where id = p.quote_id and contractor_id = c.owner_id and status = 'approved') then v_reason := 'request_closed';
    elsif p_transaction_at < p.created_at or p_transaction_at > p.expires_at then v_reason := 'outside_validity';
    elsif p.amount <> p_amount then v_reason := 'amount_mismatch';
    else
      result := 'matched'; v_reason := 'matched';
      update public.payment_requests set status = 'paid', paid_at = p_transaction_at,
        confirmed_by = null, settlement_source = 'sepay', settled_transaction_id = new_id where id = p.id;
      insert into public.payment_events(payment_id, owner_id, actor_id, actor_kind, from_status, to_status, note)
        values(p.id, p.owner_id, null, 'system', p.status, 'paid', 'SePay');
    end if;
  end if;
  update public.sepay_transactions set outcome = result, reason = v_reason,
    payment_id = case when p.id is not null then p.id else null end where id = new_id;
  return result;
end $$;
create or replace function public.change_quote_payment(p_payment_id uuid, p_status text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare p public.payment_requests%rowtype; begin
  if p_status is null or p_status not in ('paid','pending','cancelled') or length(p_note) > 300 then raise exception 'Invalid payment update'; end if;
  select * into p from public.payment_requests where id = p_payment_id and owner_id = auth.uid() for update;
  if not found then raise exception 'Payment not found'; end if;
  if p.status = p_status then return; end if;
  if p.status not in ('pending','reported') or (p_status = 'pending' and p.status <> 'reported') then raise exception 'Payment cannot be changed'; end if;
  if p_status = 'paid' and (p_note is null or length(trim(p_note)) = 0) then raise exception 'Enter a bank reference or verification note'; end if;
  update public.payment_requests set status = p_status,
    paid_at = case when p_status = 'paid' then now() else null end,
    confirmed_by = case when p_status = 'paid' then auth.uid() else null end,
    settlement_source = case when p_status = 'paid' then 'manual' else null end,
    reported_at = case when p_status = 'pending' then null else reported_at end where id = p.id;
  insert into public.payment_events(payment_id, owner_id, actor_id, actor_kind, from_status, to_status, note)
    values(p.id, p.owner_id, auth.uid(), 'owner', p.status, p_status, nullif(trim(p_note), ''));
end $$;
create or replace function public.get_portal_payment(p_token uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'bank_bin', p.bank_bin, 'account_number', p.account_number,
    'holder_name', p.holder_name, 'amount', p.amount, 'currency', p.currency, 'reference', p.reference,
    'status', p.status, 'expires_at', p.expires_at, 'reported_at', p.reported_at, 'paid_at', p.paid_at,
    'settlement_source', p.settlement_source)
  from public.payment_requests p join public.quotes q on q.id = p.quote_id
  where q.public_token = p_token and q.status = 'approved'
  order by p.created_at desc, p.id desc limit 1;
$$;
revoke all on function public.configure_sepay_connection(uuid,uuid,text,uuid[]), public.disconnect_sepay_connection(uuid),
  public.reconcile_sepay_transaction(uuid,integer,bigint,text,text,text,numeric,text,text,text,text,timestamptz,text) from public, anon, authenticated;
grant execute on function public.configure_sepay_connection(uuid,uuid,text,uuid[]), public.disconnect_sepay_connection(uuid),
  public.reconcile_sepay_transaction(uuid,integer,bigint,text,text,text,numeric,text,text,text,text,timestamptz,text) to service_role;
