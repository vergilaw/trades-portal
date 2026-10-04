// Isolated Supabase-shaped HTTP fixture backed by the real PostgreSQL migrations.
// No request from these tests reaches the configured .env.local project.
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createHmac, randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
async function main() {
  const owner = "11111111-1111-4111-8111-111111111111";
  const db = new PGlite();
  await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create schema storage;
  create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema public,auth to anon,authenticated,service_role; grant execute on function auth.uid() to anon,authenticated,service_role;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key,bucket_id text,owner_id text,name text);
  create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
  create function storage.extension(text) returns text language sql immutable as $$ select split_part($1,'.',2) $$;
  create function storage.allow_any_operation(text[]) returns boolean language sql immutable as $$ select true $$;`);
  for (const name of [
    "20260928000000_initial_schema.sql",
    "20260928010000_quote_photos.sql",
    "20260930000000_quote_mutations.sql",
    "20261003000000_manual_payments.sql",
    "20261004000000_sepay_reconciliation.sql",
    "20261004010000_quote_edit_alias.sql",
  ])
    await db.exec(
      (await readFile(`supabase/migrations/${name}`, "utf8")).replace(
        "create extension if not exists pgcrypto;",
        "",
      ),
    );
  await db.exec(
    "grant select,insert,update,delete on public.profiles,public.quotes,public.quote_items to authenticated;",
  );
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data) values($1,'fixture@example.test','{\"business_name\":\"Điện Minh An\"}')",
    [owner],
  );
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    owner,
  ]);
  await db.exec("set role authenticated");
  await db.query(
    "select public.save_bank_account('970422','0012345678','TEST OWNER')",
  );
  await db.exec("reset role");
  const user = {
    id: owner,
    aud: "authenticated",
    role: "authenticated",
    email: "fixture@example.test",
    email_confirmed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
  };
  function token() {
    const head = Buffer.from(
        JSON.stringify({ alg: "HS256", typ: "JWT" }),
      ).toString("base64url"),
      body = Buffer.from(
        JSON.stringify({
          sub: owner,
          role: "authenticated",
          aud: "authenticated",
          iss: "http://127.0.0.1:54321/auth/v1",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
          email: user.email,
        }),
      ).toString("base64url");
    return `${head}.${body}.${createHmac("sha256", "local-test-jwt").update(`${head}.${body}`).digest("base64url")}`;
  }
  const allowedTables = new Set([
    "profiles",
    "quotes",
    "quote_items",
    "quote_photos",
    "bank_accounts",
    "payment_requests",
    "payment_events",
    "sepay_connections",
    "sepay_connection_secrets",
    "sepay_connection_accounts",
    "sepay_transactions",
  ]);
  let queue = Promise.resolve();
  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "http://127.0.0.1:3100");
    res.setHeader("Access-Control-Allow-Headers", "*");
    res.setHeader(
      "Access-Control-Allow-Methods",
      "GET,POST,PATCH,DELETE,OPTIONS",
    );
    res.setHeader("Content-Type", "application/json");
    if (req.method === "OPTIONS") {
      res.end();
      return;
    }
    const url = new URL(req.url ?? "/", "http://127.0.0.1:54321");
    let raw = "";
    for await (const chunk of req) raw += chunk.toString();
    let body: Record<string, unknown> = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      res.statusCode = 400;
      res.end("{}");
      return;
    }
    if (url.pathname === "/auth/v1/token") {
      if (body.email !== user.email || body.password !== "fixture-password") {
        res.statusCode = 400;
        res.end(
          JSON.stringify({
            error_code: "invalid_credentials",
            msg: "Invalid login credentials",
          }),
        );
        return;
      }
      res.end(
        JSON.stringify({
          access_token: token(),
          refresh_token: "fixture-refresh",
          token_type: "bearer",
          expires_in: 3600,
          user,
        }),
      );
      return;
    }
    if (url.pathname === "/auth/v1/user") {
      res.end(JSON.stringify(user));
      return;
    }
    if (url.pathname === "/auth/v1/logout") {
      res.end("{}");
      return;
    }
    if (url.pathname.endsWith("/.well-known/jwks.json")) {
      res.end('{"keys":[]}');
      return;
    }
    const previous = queue;
    let release!: () => void;
    queue = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      await db.exec("reset role");
      const isService = req.headers.apikey === "fixture-server-key";
      const signed = req.headers.authorization?.startsWith("Bearer eyJ");
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
        signed ? owner : "",
      ]);
      await db.exec(
        `set role ${isService ? "service_role" : signed ? "authenticated" : "anon"}`,
      );
      if (url.pathname.startsWith("/rest/v1/rpc/")) {
        const name = url.pathname.split("/").pop()!;
        if (!/^[a-z_]+$/.test(name)) throw new Error("Invalid RPC");
        const args = Object.entries(body);
        const result = await db.query<{ value: unknown }>(
          `select to_jsonb(public.${name}(${args
            .map(([key], i) => {
              if (!/^p_[a-z_]+$/.test(key)) throw new Error("Invalid argument");
              return `${key} => $${i + 1}`;
            })
            .join(",")})) as value`,
          args.map(([, value]) =>
            Array.isArray(value) &&
            value.some((item) => typeof item === "object")
              ? JSON.stringify(value)
              : value,
          ),
        );
        const resultValue = result.rows[0]?.value;
        res.end(
          JSON.stringify(
            [
              "respond_to_portal_quote",
              "update_quote_with_items",
              "duplicate_quote",
            ].includes(name)
              ? result.rows.map((r) => r.value)
              : (resultValue ?? null),
          ),
        );
        return;
      }
      const table = url.pathname.split("/").pop()!;
      if (!allowedTables.has(table)) {
        res.statusCode = 404;
        res.end("{}");
        return;
      }
      const args: unknown[] = [];
      const filters: string[] = [];
      for (const [key, value] of url.searchParams) {
        if (["select", "order", "limit", "offset", "columns"].includes(key))
          continue;
        if (!/^[a-z_]+$/.test(key)) throw new Error("Invalid filter");
        const dot = value.indexOf("."),
          op = value.slice(0, dot),
          val = value.slice(dot + 1);
        args.push(
          op === "in"
            ? val
                .slice(1, -1)
                .split(",")
                .map((v) => v.replace(/^\"|\"$/g, ""))
            : val,
        );
        const pos = `$${args.length}`;
        if (op === "in") filters.push(`${key} = any(${pos})`);
        else {
          const symbol = (
            { eq: "=", gt: ">", gte: ">=", lt: "<", lte: "<=" } as Record<
              string,
              string
            >
          )[op];
          if (!symbol) throw new Error("Invalid operator");
          filters.push(`${key} ${symbol} ${pos}`);
        }
      }
      const where = filters.length ? ` where ${filters.join(" and ")}` : "";
      let rows: Record<string, unknown>[] = [];
      if (req.method === "POST") {
        const inputs = Array.isArray(body) ? body : [body];
        for (const input of inputs) {
          const keys = Object.keys(input);
          if (!keys.every((k) => /^[a-z_]+$/.test(k)))
            throw new Error("Invalid field");
          rows.push(
            ...(
              await db.query<Record<string, unknown>>(
                `insert into public.${table}(${keys.join(",")}) values(${keys.map((_, i) => `$${i + 1}`).join(",")}) returning *`,
                Object.values(input),
              )
            ).rows,
          );
        }
        res.statusCode = 201;
      } else if (req.method === "PATCH") {
        const keys = Object.keys(body);
        if (!keys.every((k) => /^[a-z_]+$/.test(k)))
          throw new Error("Invalid field");
        const start = args.length;
        args.push(...Object.values(body));
        rows = (
          await db.query<Record<string, unknown>>(
            `update public.${table} set ${keys.map((k, i) => `${k}=$${start + i + 1}`).join(",")}${where} returning *`,
            args,
          )
        ).rows;
      } else if (req.method === "DELETE") {
        rows = (
          await db.query<Record<string, unknown>>(
            `delete from public.${table}${where} returning *`,
            args,
          )
        ).rows;
      } else {
        const all = (
          await db.query<Record<string, unknown>>(
            `select * from public.${table}${where}`,
            args,
          )
        ).rows;
        const orders = (url.searchParams.get("order") ?? "").split(",");
        all.sort((a, b) => {
          for (const order of orders) {
            const [key, direction] = order.split(".");
            if (a[key] === b[key]) continue;
            return (
              (String(a[key]) < String(b[key]) ? -1 : 1) *
              (direction === "desc" ? -1 : 1)
            );
          }
          return 0;
        });
        const offset = Number(url.searchParams.get("offset") ?? 0),
          limit = Number(url.searchParams.get("limit") ?? all.length);
        rows = all.slice(offset, offset + limit);
        res.setHeader(
          "Content-Range",
          `${offset}-${offset + rows.length - 1}/${all.length}`,
        );
      }
      if (table === "quotes")
        for (const row of rows) {
          row.quote_items = (
            await db.query(
              "select * from public.quote_items where quote_id=$1 order by position",
              [row.id],
            )
          ).rows;
          row.quote_photos = (
            await db.query(
              "select * from public.quote_photos where quote_id=$1",
              [row.id],
            )
          ).rows;
        }
      const single = req.headers.accept?.includes("vnd.pgrst.object");
      // Match PostgREST: its JSON numerics are numbers, while PGlite's query
      // API returns numeric strings.
      const numericColumns = new Set([
        "subtotal",
        "tax_rate",
        "tax_amount",
        "total",
        "quantity",
        "unit_price",
        "amount",
      ]);
      const toJsonRow = (row: Record<string, unknown>) => {
        for (const [key, value] of Object.entries(row)) {
          if (numericColumns.has(key) && value !== null)
            row[key] = Number(value);
          if (Array.isArray(value))
            value.forEach((item) => {
              if (item && typeof item === "object") toJsonRow(item);
            });
        }
      };
      rows.forEach(toJsonRow);
      res.end(JSON.stringify(single ? (rows[0] ?? null) : rows));
    } catch (error) {
      console.error(
        "Fixture database:",
        error instanceof Error ? error.message : "Unknown error",
      );
      res.statusCode = 400;
      res.end(
        JSON.stringify({
          code: "FIXTURE",
          message: error instanceof Error ? error.message : "Fixture failed",
        }),
      );
    } finally {
      release();
    }
  });
  server.listen(54321, "127.0.0.1");
  const next = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "--port", "3100"],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-publishable-key",
        SUPABASE_SECRET_KEY: "fixture-server-key",
        SEPAY_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
        APP_URL: "http://127.0.0.1:3100",
        ENABLE_DEMO_DATA_IMPORT: "false",
      },
    },
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => {
      next.kill(signal);
      server.close();
      void db.close();
    });
  next.on("exit", (code) => {
    server.close();
    void db.close();
    process.exitCode = code ?? 0;
  });
}
void main();
