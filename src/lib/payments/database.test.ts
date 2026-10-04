import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { banks } from "./banks";

// Execute real migrations in PostgreSQL. Only Supabase-owned Auth/Storage
// infrastructure is stubbed; payment tables, RLS and RPCs are unmodified.
test("Payment migration enforces ownership, settlement and audit invariants", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key, bucket_id text, owner_id text, name text);
    create function storage.foldername(text) returns text[] language sql immutable as
      $$ select (string_to_array($1, '/'))[1:array_length(string_to_array($1, '/'), 1)-1] $$;
    create function storage.extension(text) returns text language sql immutable as $$ select split_part($1, '.', 2) $$;
    create function storage.allow_any_operation(text[]) returns boolean language sql immutable as $$ select true $$;
  `);
  for (const name of [
    "20260928000000_initial_schema.sql",
    "20260928010000_quote_photos.sql",
    "20260930000000_quote_mutations.sql",
    "20261003000000_manual_payments.sql",
  ]) {
    let sql = await readFile(
      join(process.cwd(), "supabase/migrations", name),
      "utf8",
    );
    // gen_random_uuid is built into modern PostgreSQL; pgcrypto is unnecessary
    // for this test, and is not bundled into the WASM test runtime.
    sql = sql.replace("create extension if not exists pgcrypto;", "");
    await db.exec(sql);
  }
  const owner = "11111111-1111-4111-8111-111111111111",
    other = "22222222-2222-4222-8222-222222222222";
  await db.query("insert into auth.users(id) values ($1),($2)", [owner, other]);
  await db.exec(
    "grant select, insert, update, delete on public.profiles, public.quotes, public.quote_items to authenticated;",
  );
  async function role(name: "postgres" | "authenticated" | "anon", user = "") {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [
      user,
    ]);
    if (name !== "postgres") await db.exec(`set role ${name}`);
  }
  async function scalar<T = string>(sql: string, args: unknown[] = []) {
    const result = await db.query<{ value: T }>(sql, args);
    return result.rows[0]?.value;
  }
  async function quote(
    status = "approved",
    amount = 1500000,
    currency = "VND",
    recipient = owner,
  ) {
    await role("postgres");
    return (
      await db.query<{ id: string; public_token: string }>(
        "insert into public.quotes(contractor_id,title,customer_name,status,total,currency) values ($1,'Work','Customer',$2,$3,$4) returning id,public_token",
        [recipient, status, amount, currency],
      )
    ).rows[0];
  }
  let account = "",
    payment = "";
  const q = await quote();
  const foreignQuote = await quote("approved", 100, "VND", other);

  await t.test(
    "Catalog and account validation agree; accounts belong to the caller",
    async () => {
      await role("authenticated", owner);
      const catalog = await db.query<{ bin: string; name: string }>(
        "select bin,name from public.payment_banks order by bin",
      );
      assert.deepEqual(
        catalog.rows,
        [...banks].sort((a, b) => a.bin.localeCompare(b.bin)),
      );
      account = await scalar(
        "select public.save_bank_account('970436','0011001234567','NGUYEN VAN AN') as value",
      );
      assert.equal(
        await scalar(
          "select public.save_bank_account('970436','0011001234567','NGUYEN VAN AN') as value",
        ),
        account,
      );
      await assert.rejects(
        db.query(
          "select public.save_bank_account('000000','123456','NGUYEN VAN AN')",
        ),
      );
      await assert.rejects(
        db.query(
          "select public.save_bank_account('970436','123 456','NGUYEN VAN AN')",
        ),
      );
      await assert.rejects(
        db.query(
          "insert into public.bank_accounts(owner_id,bank_bin,account_number,holder_name) values ($1,'970436','1234','TEST NAME')",
          [other],
        ),
      );
      await role("authenticated", other);
      assert.equal(
        await scalar<number>(
          "select count(*)::int as value from public.bank_accounts",
        ),
        0,
      );
      await assert.rejects(
        db.query("select public.set_bank_account_active($1,false)", [account]),
      );
    },
  );
  await t.test(
    "Creation is idempotent and snapshots cannot change when an account changes",
    async () => {
      await role("authenticated", owner);
      payment = await scalar(
        "select public.create_quote_payment($1,$2) as value",
        [q.id, account],
      );
      assert.equal(
        await scalar("select public.create_quote_payment($1,$2) as value", [
          q.id,
          account,
        ]),
        payment,
      );
      await db.query(
        "select public.save_bank_account('970436','0011001234567','NEW HOLDER')",
      );
      await db.query("select public.set_bank_account_active($1,false)", [
        account,
      ]);
      assert.equal(
        await scalar(
          "select holder_name as value from public.payment_requests where id=$1",
          [payment],
        ),
        "NGUYEN VAN AN",
      );
      assert.equal(
        await scalar<number>(
          "select count(*)::int as value from public.payment_events where payment_id=$1",
          [payment],
        ),
        1,
      );
      await assert.rejects(
        db.query("select public.create_quote_payment($1,$2)", [
          foreignQuote.id,
          account,
        ]),
      );
      await assert.rejects(
        db.query(
          "update public.payment_requests set status='paid' where id=$1",
          [payment],
        ),
      );
      await assert.rejects(
        db.query("delete from public.payment_events where payment_id=$1", [
          payment,
        ]),
      );
    },
  );
  await t.test(
    "Public access needs the matching portal token; it cannot enumerate or confirm",
    async () => {
      await role("anon");
      await assert.rejects(db.query("select * from public.payment_requests"));
      await assert.rejects(db.query("select * from public.bank_accounts"));
      assert.equal(
        await scalar("select public.get_portal_payment($1) as value", [
          foreignQuote.public_token,
        ]),
        null,
      );
      await assert.rejects(
        db.query("select public.report_portal_payment($1,$2)", [
          foreignQuote.public_token,
          payment,
        ]),
      );
      await assert.rejects(
        db.query(
          "select public.change_quote_payment($1,'paid','bank verified')",
          [payment],
        ),
      );
      const visible = await scalar<{
        reference: string;
        amount: number;
        owner_id?: string;
      }>("select public.get_portal_payment($1) as value", [q.public_token]);
      assert.equal(visible.amount, 1500000);
      assert.match(visible.reference, /^TP[A-F0-9]{20}$/);
      assert.equal(visible.owner_id, undefined);
      await role("authenticated", other);
      assert.equal(
        await scalar<number>(
          "select count(*)::int as value from public.payment_requests",
        ),
        0,
      );
      await assert.rejects(
        db.query(
          "select public.change_quote_payment($1,'paid','bank verified')",
          [payment],
        ),
      );
    },
  );
  await t.test(
    "Reports are not receipts; transitions and repeated actions keep an atomic history",
    async () => {
      await role("anon");
      await db.query("select public.report_portal_payment($1,$2)", [
        q.public_token,
        payment,
      ]);
      await db.query("select public.report_portal_payment($1,$2)", [
        q.public_token,
        payment,
      ]);
      await role("authenticated", owner);
      assert.equal(
        await scalar(
          "select status as value from public.payment_requests where id=$1",
          [payment],
        ),
        "reported",
      );
      assert.equal(
        await scalar(
          "select paid_at as value from public.payment_requests where id=$1",
          [payment],
        ),
        null,
      );
      assert.equal(
        await scalar<number>(
          "select count(*)::int as value from public.payment_events where payment_id=$1",
          [payment],
        ),
        2,
      );
      await assert.rejects(
        db.query("select public.change_quote_payment($1,'paid',null)", [
          payment,
        ]),
      );
      await db.query(
        "select public.change_quote_payment($1,'pending','Not on statement yet')",
        [payment],
      );
      await role("anon");
      await db.query("select public.report_portal_payment($1,$2)", [
        q.public_token,
        payment,
      ]);
      await role("authenticated", owner);
      await db.query(
        "select public.change_quote_payment($1,'paid','BANK123 verified full amount')",
        [payment],
      );
      await db.query(
        "select public.change_quote_payment($1,'paid','BANK123 verified full amount')",
        [payment],
      );
      assert.equal(
        await scalar(
          "select confirmed_by as value from public.payment_requests where id=$1",
          [payment],
        ),
        owner,
      );
      assert.equal(
        await scalar<number>(
          "select count(*)::int as value from public.payment_events where payment_id=$1",
          [payment],
        ),
        5,
      );
      await assert.rejects(
        db.query("select public.change_quote_payment($1,'cancelled',null)", [
          payment,
        ]),
      );
      assert.equal(
        await scalar("select public.create_quote_payment($1,$2) as value", [
          q.id,
          account,
        ]),
        payment,
      );
    },
  );
  await t.test(
    "Only positive whole VND approved quotes and active own accounts can create requests",
    async () => {
      for (const [status, amount, currency] of [
        ["sent", 100, "VND"],
        ["rejected", 100, "VND"],
        ["approved", 0, "VND"],
        ["approved", 1.5, "VND"],
        ["approved", 100, "USD"],
      ] as const) {
        const invalid = await quote(status, amount, currency);
        await role("authenticated", owner);
        await assert.rejects(
          db.query("select public.create_quote_payment($1,$2)", [
            invalid.id,
            account,
          ]),
        );
      }
      const accepted = await quote();
      await role("authenticated", owner);
      await assert.rejects(
        db.query("select public.create_quote_payment($1,$2)", [
          accepted.id,
          account,
        ]),
      );
      await db.query("select public.set_bank_account_active($1,true)", [
        account,
      ]);
      await role("authenticated", other);
      await assert.rejects(
        db.query("select public.create_quote_payment($1,$2)", [
          foreignQuote.id,
          account,
        ]),
      );
    },
  );
  await t.test(
    "Expired and cancelled requests cannot be reported; replacement preserves the old history",
    async () => {
      const accepted = await quote();
      await role("authenticated", owner);
      const expired = await scalar(
        "select public.create_quote_payment($1,$2) as value",
        [accepted.id, account],
      );
      await role("postgres");
      await db.query(
        "update public.payment_requests set created_at=now()-interval '8 days', expires_at=now()-interval '1 day' where id=$1",
        [expired],
      );
      await role("anon");
      await assert.rejects(
        db.query("select public.report_portal_payment($1,$2)", [
          accepted.public_token,
          expired,
        ]),
      );
      await role("authenticated", owner);
      const replacement = await scalar(
        "select public.create_quote_payment($1,$2) as value",
        [accepted.id, account],
      );
      assert.notEqual(replacement, expired);
      assert.equal(
        await scalar(
          "select status as value from public.payment_requests where id=$1",
          [expired],
        ),
        "cancelled",
      );
      assert.equal(
        await scalar(
          "select note as value from public.payment_events where payment_id=$1 and to_status='cancelled'",
          [expired],
        ),
        "Expired request replaced",
      );
      await db.query(
        "select public.change_quote_payment($1,'cancelled','Wrong receiving account')",
        [replacement],
      );
      await role("anon");
      await assert.rejects(
        db.query("select public.report_portal_payment($1,$2)", [
          accepted.public_token,
          replacement,
        ]),
      );
    },
  );
  await t.test(
    "Accepted quotes remain readable after response expiry, including payment details",
    async () => {
      await role("postgres");
      await db.query(
        "update public.quotes set created_at=now()-interval '10 days',expires_at=now()-interval '1 day' where id=$1",
        [q.id],
      );
      await role("anon");
      const portal = await scalar<{ status: string }>(
        "select public.get_portal_quote($1) as value",
        [q.public_token],
      );
      assert.equal(portal.status, "approved");
      assert.ok(
        await scalar("select public.get_portal_payment($1) as value", [
          q.public_token,
        ]),
      );
    },
  );
});
