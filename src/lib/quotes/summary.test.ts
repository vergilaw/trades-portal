import assert from "node:assert/strict";
import test from "node:test";
import { databaseFixture } from "../../../tests/database-fixture";
import { parseDashboardSummary, type DashboardSummary } from "./summary";
import { formatMoney } from "./format";

test("Dashboard summaries cover all rows, currencies, actual receipts and owner isolation", async (t) => {
  const db = await databaseFixture();
  t.after(() => db.close());
  const owner = "11111111-1111-4111-8111-111111111111",
    other = "22222222-2222-4222-8222-222222222222";
  await db.query("insert into auth.users(id) values($1),($2)", [owner, other]);
  async function role(name: string, id = "") {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec(`set role ${name}`);
  }
  async function summary() {
    return (
      await db.query<{ value: DashboardSummary }>(
        "select public.get_dashboard_summary() as value",
      )
    ).rows[0].value;
  }
  await role("authenticated", owner);
  assert.deepEqual(await summary(), {
    counts: { all: 0, pending: 0, approved: 0 },
    totals: [],
  });
  await role("postgres");
  const account = (
    await db.query<{ id: string }>(
      "insert into public.bank_accounts(owner_id,bank_bin,account_number,holder_name) values($1,'970422','0123456789','OWNER') returning id",
      [owner],
    )
  ).rows[0].id;
  async function quote(
    status: string,
    amount: number,
    currency = "VND",
    quoteOwner = owner,
    expired = false,
  ) {
    return (
      await db.query<{ id: string; public_token: string }>(
        "insert into public.quotes(contractor_id,title,customer_name,status,total,currency,created_at,expires_at) values($1,'Work','Customer',$2,$3,$4,now()-interval '2 days',case when $5 then now()-interval '1 day' else null end) returning id,public_token",
        [quoteOwner, status, amount, currency, expired],
      )
    ).rows[0];
  }
  const manual = await quote("approved", 1000),
    automatic = await quote("approved", 2000);
  const reported = await quote("approved", 3000),
    cancelled = await quote("approved", 4000),
    expired = await quote("approved", 5000);
  await quote("approved", 6000); // No payment request yet.
  await quote("approved", 10.25, "USD");
  await quote("approved", 0.1, "EUR");
  await quote("approved", 0.2, "EUR");
  const expiredSent = await quote("sent", 999, "VND", owner, true);
  await quote("rejected", 999);
  await quote("draft", 999);
  await quote("approved", 999999, "USD", other);
  async function payment(
    quoteId: string,
    amount: number,
    status: string,
    isExpired = false,
  ) {
    return (
      await db.query<{ id: string }>(
        `insert into public.payment_requests(quote_id,owner_id,bank_account_id,bank_bin,account_number,holder_name,amount,status,created_at,expires_at,paid_at,confirmed_by,settlement_source,reported_at)
      values($1,$2,$3,'970422','0123456789','OWNER',$4,$5,now()-interval '2 days',case when $6 then now()-interval '1 day' else now()+interval '1 day' end,
      case when $5='paid' then now() else null end,case when $5='paid' then $2::uuid else null end,case when $5='paid' then 'manual' else null end,case when $5='reported' then now() else null end) returning id`,
        [quoteId, owner, account, amount, status, isExpired],
      )
    ).rows[0].id;
  }
  await payment(manual.id, 1000, "paid");
  const autoPayment = await payment(automatic.id, 2000, "pending");
  const connection = "33333333-3333-4333-8333-333333333333";
  await db.query(
    "insert into public.sepay_connections(id,owner_id) values($1,$2)",
    [connection, owner],
  );
  const tx = (
    await db.query<{ id: string }>(
      `insert into public.sepay_transactions(owner_id,connection_id,provider_id,gateway,account_number,amount,transfer_type,content,bank_reference,transaction_at,payment_id,outcome,reason)
    values($1,$2,1,'MBBank','0123456789',2000,'in','fixture','fixture',now(),$3,'matched','Matched') returning id`,
      [owner, connection, autoPayment],
    )
  ).rows[0].id;
  await db.query(
    "update public.payment_requests set status='paid',paid_at=now(),settlement_source='sepay',settled_transaction_id=$1 where id=$2",
    [tx, autoPayment],
  );
  await payment(reported.id, 3000, "reported");
  await payment(cancelled.id, 4000, "cancelled");
  await payment(cancelled.id, 4000, "pending"); // Replacement must not duplicate the balance.
  await payment(expired.id, 5000, "pending", true);
  await db.query(
    "insert into public.quotes(contractor_id,title,customer_name,status,total) select $1,'Extra','Customer','sent',1 from generate_series(1,1005)",
    [owner],
  );
  await role("authenticated", owner);
  const result = await summary();
  assert.deepEqual(result.counts, { all: 1017, pending: 1005, approved: 9 });
  const amounts = new Map(result.totals.map((row) => [row.currency, row]));
  assert.equal(Number(amounts.get("VND")?.approved), 21000);
  assert.equal(Number(amounts.get("VND")?.received), 3000);
  assert.equal(Number(amounts.get("VND")?.outstanding), 18000);
  assert.equal(Number(amounts.get("USD")?.outstanding), 10.25);
  assert.equal(amounts.get("EUR")?.approved, "0.30");
  assert.ok(parseDashboardSummary(result));
  await role("authenticated", other);
  assert.deepEqual((await summary()).counts, {
    all: 1,
    pending: 0,
    approved: 1,
  });
  assert.equal(Number((await summary()).totals[0].approved), 999999);
  await role("anon");
  await assert.rejects(summary(), /permission denied/);
  const portal = await db.query<{ value: { createdAt: string } | null }>(
    "select public.get_portal_quote($1) as value",
    [expiredSent.public_token],
  );
  assert.equal(portal.rows[0].value, null);
  const approvedPortal = (
    await db.query<{ value: { createdAt: string } }>(
      "select public.get_portal_quote($1) as value",
      [manual.public_token],
    )
  ).rows[0].value;
  assert.ok(approvedPortal.createdAt);
});

test("Summary parsing rejects malformed data and currency formatting preserves decimal strings", () => {
  assert.equal(parseDashboardSummary(null), null);
  assert.equal(
    parseDashboardSummary({
      counts: { all: -1, pending: 0, approved: 0 },
      totals: [],
    }),
    null,
  );
  assert.equal(
    parseDashboardSummary({
      counts: { all: 1, pending: 0, approved: 1 },
      totals: [
        { currency: "USD", approved: "NaN", received: "0", outstanding: "0" },
      ],
    }),
    null,
  );
  assert.equal(
    formatMoney("9007199254740993.25", "USD", "en"),
    "$9,007,199,254,740,993.25",
  );
});
