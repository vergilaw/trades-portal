import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { handleSePayWebhook } from "./sepay-webhook";
import { createHmac } from "node:crypto";

test("SePay migrations and signed callbacks settle once with isolated owner data", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key, bucket_id text, owner_id text, name text);
    create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
    create function storage.extension(text) returns text language sql immutable as $$ select split_part($1,'.',2) $$;
    create function storage.allow_any_operation(text[]) returns boolean language sql immutable as $$ select true $$;`);
  for (const name of [
    "20260928000000_initial_schema.sql",
    "20260928010000_quote_photos.sql",
    "20260930000000_quote_mutations.sql",
    "20261003000000_manual_payments.sql",
  ]) {
    await db.exec(
      (
        await readFile(join(process.cwd(), "supabase/migrations", name), "utf8")
      ).replace("create extension if not exists pgcrypto;", ""),
    );
  }
  const owner = "11111111-1111-4111-8111-111111111111",
    other = "22222222-2222-4222-8222-222222222222",
    connection = "33333333-3333-4333-8333-333333333333",
    otherConnection = "44444444-4444-4444-8444-444444444444";
  await db.query("insert into auth.users(id) values ($1),($2)", [owner, other]);
  await db.exec(
    "grant select,insert,update,delete on public.profiles,public.quotes,public.quote_items to authenticated;",
  );
  async function role(
    name: "postgres" | "authenticated" | "anon" | "service_role",
    user = "",
  ) {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      user,
    ]);
    if (name !== "postgres") await db.exec(`set role ${name}`);
  }
  async function scalar<T = string>(sql: string, args: unknown[] = []) {
    return (await db.query<{ value: T }>(sql, args)).rows[0]?.value;
  }
  async function newPayment(recipient = owner, account?: string) {
    await role("postgres");
    const quote = (
      await db.query<{ id: string; public_token: string }>(
        "insert into public.quotes(contractor_id,title,customer_name,status,total,currency) values($1,'Fixture work','Fixture customer','approved',1500000,'VND') returning id,public_token",
        [recipient],
      )
    ).rows[0];
    await role("authenticated", recipient);
    const receiving =
      account ??
      (await scalar(
        "select public.save_bank_account('970422','0012345678','TEST OWNER') as value",
      ));
    const id = await scalar(
      "select public.create_quote_payment($1,$2) as value",
      [quote.id, receiving],
    );
    const row = (
      await db.query<{ reference: string; created_at: string }>(
        "select reference,created_at from public.payment_requests where id=$1",
        [id],
      )
    ).rows[0];
    return {
      id,
      account: receiving,
      token: quote.public_token,
      reference: row.reference,
      at: new Date(new Date(row.created_at).getTime() + 60000).toISOString(),
    };
  }
  const old = await newPayment();
  await db.query(
    "select public.change_quote_payment($1,'paid','Verified old receipt')",
    [old.id],
  );
  await role("postgres");
  await db.exec(
    await readFile(
      join(
        process.cwd(),
        "supabase/migrations/20261004000000_sepay_reconciliation.sql",
      ),
      "utf8",
    ),
  );
  const payment = await newPayment();
  await role("postgres");
  await db.exec(
    await readFile(
      join(
        process.cwd(),
        "supabase/migrations/20261004010000_quote_edit_alias.sql",
      ),
      "utf8",
    ),
  );
  await t.test(
    "Quote editing replaces items atomically and retains owner isolation",
    async () => {
      await role("authenticated", owner);
      const editable = await scalar(
        "insert into public.quotes(contractor_id,title,customer_name,status) values(auth.uid(),'Original','Customer','sent') returning id as value",
      );
      const items = JSON.stringify([
        { description: "Updated work", quantity: 2, unitPrice: 125000 },
      ]);
      const update =
        "select quote_id as value from public.update_quote_with_items($1,'Updated','Customer',null,null,null,10,null,$2::jsonb)";
      assert.equal(await scalar(update, [editable, items]), editable);
      assert.equal(
        Number(
          await scalar("select total as value from public.quotes where id=$1", [
            editable,
          ]),
        ),
        275000,
      );
      assert.equal(
        await scalar(
          "select description as value from public.quote_items where quote_id=$1",
          [editable],
        ),
        "Updated work",
      );
      const token = await scalar(
        "select public_token as value from public.quotes where id=$1",
        [editable],
      );
      await role("authenticated", other);
      await assert.rejects(db.query(update, [editable, items]), /not editable/);
      await role("anon");
      assert.equal(
        await scalar(
          "select status as value from public.respond_to_portal_quote($1,'approved')",
          [token],
        ),
        "approved",
      );
      assert.equal(
        (
          await db.query(
            "select * from public.respond_to_portal_quote($1,'rejected')",
            [token],
          )
        ).rows.length,
        0,
      );
    },
  );
  const foreign = await newPayment(other);
  await role("service_role");
  await db.query(
    "select public.configure_sepay_connection($1,$2,$3,$4::uuid[])",
    [owner, connection, "encrypted-fixture-only-".repeat(5), [payment.account]],
  );
  await db.query(
    "select public.configure_sepay_connection($1,$2,$3,$4::uuid[])",
    [
      other,
      otherConnection,
      "encrypted-other-fixture-".repeat(5),
      [foreign.account],
    ],
  );
  let providerId = 100;
  async function settle(
    p: typeof payment,
    overrides: Record<string, unknown> = {},
  ) {
    await role("service_role");
    const values = {
      connection,
      version: 1,
      provider: ++providerId,
      bin: "970422",
      gateway: "MBBank",
      account: "0012345678",
      amount: 1500000,
      type: "in",
      reference: p.reference,
      content: p.reference,
      bankRef: "FT123",
      at: p.at,
      reason: "valid",
      ...overrides,
    };
    return scalar(
      "select public.reconcile_sepay_transaction($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) as value",
      Object.values(values),
    );
  }
  await t.test(
    "Existing manual receipts are backfilled and settlement constraints remain strict",
    async () => {
      await role("authenticated", owner);
      assert.equal(
        await scalar(
          "select settlement_source as value from public.payment_requests where id=$1",
          [old.id],
        ),
        "manual",
      );
      await role("postgres");
      await assert.rejects(
        db.query(
          "update public.payment_requests set status='paid',paid_at=now() where id=$1",
          [payment.id],
        ),
      );
    },
  );
  await t.test(
    "Owner metadata is readable but credentials and server RPCs are inaccessible",
    async () => {
      await role("authenticated", owner);
      assert.equal(
        await scalar<number>(
          "select count(*)::int as value from public.sepay_connections",
        ),
        1,
      );
      await assert.rejects(
        db.query("select * from public.sepay_connection_secrets"),
      );
      await assert.rejects(
        db.query("update public.sepay_connections set is_active=false"),
      );
      await assert.rejects(
        db.query("select public.disconnect_sepay_connection($1)", [owner]),
      );
      await assert.rejects(
        db.query(
          "select public.configure_sepay_connection($1,$2,$3,$4::uuid[])",
          [owner, connection, "x".repeat(100), [payment.account]],
        ),
      );
      await assert.rejects(
        db.query(
          "select public.reconcile_sepay_transaction($1,1,1,'970422','MBBank','0012345678',1500000,'in',$2,$2,'FT',now(),'valid')",
          [connection, payment.reference],
        ),
      );
      await role("anon");
      await assert.rejects(db.query("select * from public.sepay_transactions"));
      await role("service_role");
      await assert.rejects(
        db.query(
          "select public.configure_sepay_connection($1,$2,$3,$4::uuid[])",
          [owner, connection, "x".repeat(100), [foreign.account]],
        ),
      );
    },
  );
  await t.test(
    "A signed SePay fixture settles an approved quote and its public portal",
    async () => {
      await role("service_role");
      const payload = {
        id: 500,
        gateway: "MBBank",
        accountNumber: "0012345678",
        transferAmount: 1500000,
        transferType: "in",
        content: payment.reference,
        transactionDate: new Date(Date.parse(payment.at) + 7 * 3600000)
          .toISOString()
          .slice(0, 19)
          .replace("T", " "),
      };
      const raw = JSON.stringify(payload);
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const secret = "signed-fixture-secret";
      const request = () =>
        new Request("https://fixture.local/webhook", {
          method: "POST",
          body: raw,
          headers: {
            "content-type": "application/json",
            "x-sepay-timestamp": timestamp,
            "x-sepay-signature": `sha256=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`,
          },
        });
      const dependencies = {
        async connection() {
          return { id: connection, owner_id: owner, key_version: 1, secret };
        },
        async reconcile(input: Record<string, unknown>) {
          await db.query(
            "select public.reconcile_sepay_transaction($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
            Object.values(input).length
              ? [
                  input.p_connection_id,
                  input.p_key_version,
                  input.p_provider_id,
                  input.p_bank_bin,
                  input.p_gateway,
                  input.p_account_number,
                  input.p_amount,
                  input.p_transfer_type,
                  input.p_reference,
                  input.p_content,
                  input.p_bank_reference,
                  input.p_transaction_at,
                  input.p_reference_reason,
                ]
              : [],
          );
        },
      };
      const responses = await Promise.all([
        handleSePayWebhook(request(), connection, dependencies),
        handleSePayWebhook(request(), connection, dependencies),
      ]);
      assert.ok(responses.every((r) => r.status === 200));
      await role("authenticated", owner);
      assert.equal(
        await scalar(
          "select status as value from public.payment_requests where id=$1",
          [payment.id],
        ),
        "paid",
      );
      assert.equal(
        await scalar<number>(
          "select count(*)::int as value from public.payment_events where payment_id=$1 and actor_kind='system'",
          [payment.id],
        ),
        1,
      );
      assert.equal(
        await scalar<number>(
          "select count(*)::int as value from public.sepay_transactions where provider_id=500",
        ),
        1,
      );
      await role("anon");
      const portal = await scalar<Record<string, unknown>>(
        "select public.get_portal_payment($1) as value",
        [payment.token],
      );
      assert.equal(portal.settlement_source, "sepay");
      assert.equal(portal.status, "paid");
      for (const key of [
        "owner_id",
        "settled_transaction_id",
        "encrypted_secret",
        "bank_reference",
        "content",
      ])
        assert.ok(!(key in portal));
    },
  );
  await t.test(
    "Mismatch, ambiguous references and closed requests are retained without settlement",
    async () => {
      const cases = [
        { amount: 1499999 },
        { amount: 1500001 },
        { account: "999999" },
        { bin: "970436" },
        { bin: null },
        { reference: null, reason: "missing_reference" },
        { reference: null, reason: "multiple_references" },
        { at: "2000-01-01T00:00:00Z" },
        { at: "2099-01-01T00:00:00Z" },
      ];
      for (const overrides of cases) {
        const p = await newPayment();
        assert.equal(await settle(p, overrides), "review");
        await role("authenticated", owner);
        assert.equal(
          await scalar(
            "select status as value from public.payment_requests where id=$1",
            [p.id],
          ),
          "pending",
        );
      }
      const cancelled = await newPayment();
      await db.query(
        "select public.change_quote_payment($1,'cancelled',null)",
        [cancelled.id],
      );
      assert.equal(await settle(cancelled), "review");
      assert.equal(await settle(foreign), "review"); // Same bank/account, different owner.
      assert.equal(await settle(payment, { type: "out" }), "ignored");
      assert.equal(await settle(payment), "review"); // Already paid.
    },
  );
  await t.test(
    "Delayed callbacks use transfer time and reported requests can settle",
    async () => {
      const p = await newPayment();
      await role("postgres");
      await db.query(
        "update public.payment_requests set created_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1",
        [p.id],
      );
      assert.equal(
        await settle(p, {
          at: new Date(Date.now() - 36 * 3600000).toISOString(),
        }),
        "matched",
      );
      const reported = await newPayment();
      await role("anon");
      await db.query("select public.report_portal_payment($1,$2)", [
        reported.token,
        reported.id,
      ]);
      assert.equal(await settle(reported), "matched");
    },
  );
  await t.test(
    "Manual and automatic confirmations in either order never overwrite receipts",
    async () => {
      const manual = await newPayment();
      await db.query(
        "select public.change_quote_payment($1,'paid','Bank statement verified')",
        [manual.id],
      );
      assert.equal(await settle(manual), "review");
      await role("authenticated", owner);
      assert.equal(
        await scalar(
          "select settlement_source as value from public.payment_requests where id=$1",
          [manual.id],
        ),
        "manual",
      );
      const auto = await newPayment();
      assert.equal(await settle(auto), "matched");
      await role("authenticated", owner);
      await db.query(
        "select public.change_quote_payment($1,'paid','Duplicate owner click')",
        [auto.id],
      );
      assert.equal(
        await scalar(
          "select settlement_source as value from public.payment_requests where id=$1",
          [auto.id],
        ),
        "sepay",
      );
      await assert.rejects(
        db.query("select public.change_quote_payment($1,'pending',null)", [
          auto.id,
        ]),
      );
    },
  );
  await t.test(
    "Failed transactions roll back, key rotation invalidates stale callbacks and isolation remains",
    async () => {
      const p = await newPayment();
      const id = 700;
      await assert.rejects(settle(p, { provider: id, amount: 1.5 }));
      assert.equal(await settle(p, { provider: id }), "matched");
      assert.equal(await settle(p, { provider: id, amount: 1 }), "duplicate");
      await role("service_role");
      await db.query(
        "select public.configure_sepay_connection($1,$2,$3,$4::uuid[])",
        [owner, connection, "new-encrypted-fixture-".repeat(5), [p.account]],
      );
      await assert.rejects(settle(p)); // Previous key version.
      await db.query("select public.disconnect_sepay_connection($1)", [owner]);
      await assert.rejects(settle(p, { version: 2 }));
      await role("authenticated", other);
      assert.equal(
        await scalar<number>(
          "select count(*)::int as value from public.sepay_transactions",
        ),
        0,
      );
      await assert.rejects(
        db.query("insert into public.sepay_transactions(owner_id) values($1)", [
          other,
        ]),
      );
      await assert.rejects(db.query("delete from public.sepay_transactions"));
      await role("authenticated", owner);
      assert.ok(
        (await scalar<number>(
          "select count(*)::int as value from public.sepay_transactions",
        )) > 0,
      );
    },
  );
});
