import assert from "node:assert/strict";
import test from "node:test";
import { authDestination, passwordErrors } from "./recovery";
import { appUrl, getAppOrigin } from "../app-url";

test("Auth destination only permits the dashboard and password reset", () => {
  assert.equal(authDestination("/reset-password"), "/reset-password");
  for (const next of [
    null,
    "/dashboard",
    "https://evil.example",
    "//evil.example",
    "/reset-password?next=https://evil.example",
    "/\\evil.example",
    "%2Freset-password",
  ])
    assert.equal(authDestination(next), "/dashboard");
});
test("Password recovery validates both fields", () => {
  assert.deepEqual(passwordErrors("valid-password", "valid-password"), {});
  assert.ok(passwordErrors("short", "short").password);
  assert.ok(passwordErrors("valid-password", "different").confirmPassword);
});
test("Absolute links use a canonical APP_URL", (t) => {
  const original = { ...process.env };
  t.after(() => {
    process.env = original;
  });
  process.env.APP_URL = "https://portal.example.test";
  assert.equal(
    appUrl("/auth/callback?next=/reset-password"),
    "https://portal.example.test/auth/callback?next=/reset-password",
  );
  assert.throws(() => appUrl("//evil.example"));
  for (const value of [
    "https://example.test/path",
    "https://user:secret@example.test",
    "javascript:alert(1)",
    "https://example.test?x=1",
  ]) {
    process.env.APP_URL = value;
    assert.throws(getAppOrigin);
  }
  Object.assign(process.env, {
    NODE_ENV: "production",
    APP_URL: "http://portal.example.test",
  });
  assert.throws(getAppOrigin);
});
