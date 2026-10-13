-- Owner-scoped summaries are calculated independently of Data API row limits.
create function public.get_dashboard_summary()
returns jsonb language sql stable security invoker set search_path = public as $$
  with owned_quotes as (
    select id, status, expires_at, currency, total from public.quotes
    where contractor_id = (select auth.uid())
  ), approved as (
    select currency, sum(total) as value from owned_quotes
    where status = 'approved' group by currency
  ), received as (
    select p.currency, sum(p.amount) as value from public.payment_requests p
    where p.owner_id = (select auth.uid()) and p.status = 'paid'
    group by p.currency
  ), approved_receipts as (
    select q.currency, sum(p.amount) as value from owned_quotes q
    join public.payment_requests p on p.quote_id = q.id and p.currency = q.currency
    where q.status = 'approved' and p.owner_id = (select auth.uid()) and p.status = 'paid'
    group by q.currency
  ), currencies as (
    select currency from approved union select currency from received
  )
  select jsonb_build_object(
    'counts', (select jsonb_build_object(
      'all', count(*),
      'pending', count(*) filter (where status = 'sent' and (expires_at is null or expires_at > now())),
      'approved', count(*) filter (where status = 'approved')
    ) from owned_quotes),
    'totals', coalesce((select jsonb_agg(jsonb_build_object(
      'currency', c.currency,
      'approved', coalesce(a.value, 0)::text,
      'received', coalesce(r.value, 0)::text,
      'outstanding', (coalesce(a.value, 0) - coalesce(ar.value, 0))::text
    ) order by c.currency) from currencies c
    left join approved a using (currency)
    left join received r using (currency)
    left join approved_receipts ar using (currency)), '[]'::jsonb)
  );
$$;
revoke all on function public.get_dashboard_summary() from public, anon;
grant execute on function public.get_dashboard_summary() to authenticated;
