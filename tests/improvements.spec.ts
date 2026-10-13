import { test, expect, type Page } from "@playwright/test";
import { readFile, mkdir, writeFile } from "node:fs/promises";

const fixture = "http://127.0.0.1:54321";
async function signIn(
  page: Page,
  email = "fixture@example.test",
  password = "fixture-password",
) {
  await page.goto("/login?lang=en");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}

test("Recovery and resend pages fit both languages and missing sessions explain the next step", async ({
  page,
}) => {
  for (const width of [375, 768, 1440])
    for (const locale of ["vi", "en"]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of [
        "forgot-password",
        "resend-confirmation",
        "reset-password",
      ]) {
        await page.goto(`/${route}?lang=${locale}`);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await noOverflow(page);
        await page.screenshot({
          path: `test-results/${route}-${width}-${locale}.png`,
          fullPage: true,
        });
      }
    }
  await page.goto("/reset-password?lang=en");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Request a new email link",
  );
  await expect(page.getByLabel("New password", { exact: true })).toHaveCount(0);
  await page.goto("/forgot-password?lang=en");
  await page
    .getByRole("button", { name: "Send reset link", exact: true })
    .click();
  await expect(
    page.getByText("Enter a valid email address.", { exact: true }),
  ).toBeVisible();
});

test("PKCE password recovery changes the password, signs out, rejects reuse and keeps email responses private", async ({
  page,
  request,
  browser,
}) => {
  await request.post(`${fixture}/__fixture/reset-auth`);
  try {
    await page.goto("/forgot-password?lang=en");
    await page
      .getByLabel("Email", { exact: true })
      .fill("fixture@example.test");
    await page
      .getByRole("button", { name: "Send reset link", exact: true })
      .click();
    const expectedMessage =
      "If this account can receive recovery emails, a password reset link will arrive shortly.";
    await expect(
      page.getByRole("status").filter({ hasText: expectedMessage }),
    ).toBeVisible();
    const button = page.getByRole("button", {
      name: "Send reset link",
      exact: true,
    });
    await expect(button).toBeDisabled();
    const emails = await (
      await request.get(`${fixture}/__fixture/emails`)
    ).json();
    expect(emails).toHaveLength(1);
    const link = new URL(emails[0].redirectTo);
    expect(link.origin).toBe("http://127.0.0.1:3100");
    expect(link.searchParams.get("next")).toBe("/reset-password");
    link.searchParams.set("code", emails[0].code);
    // A different browser has no PKCE verifier and cannot redeem this email.
    const outsider = await browser.newContext();
    const outsidePage = await outsider.newPage();
    await outsidePage.goto(link.toString());
    await expect(outsidePage).toHaveURL(/forgot-password\?error=invalid_link/);
    await outsider.close();
    await page.goto(link.toString());
    await expect(page).toHaveURL(/reset-password$/);
    await page.getByLabel("New password", { exact: true }).fill("short");
    await page
      .getByLabel("Confirm password", { exact: true })
      .fill("different");
    await page
      .getByRole("button", { name: "Save new password", exact: true })
      .click();
    await expect(
      page.getByText("Password must be at least 8 characters.", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      page.getByText("Passwords do not match.", { exact: true }),
    ).toBeVisible();
    await page
      .getByLabel("New password", { exact: true })
      .fill("updated-fixture-password");
    await page
      .getByLabel("Confirm password", { exact: true })
      .fill("updated-fixture-password");
    await page
      .getByRole("button", { name: "Save new password", exact: true })
      .click();
    await expect(page).toHaveURL(/login\?password_updated=1/);
    await expect(page.getByRole("status")).toContainText("Password updated");
    await page.goto("/reset-password");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "reset session is unavailable",
    );
    await page.goto(link.toString());
    await expect(page).toHaveURL(/forgot-password\?error=invalid_link/);
    await signIn(page, "fixture@example.test", "updated-fixture-password");
    const unknown = await browser.newContext();
    const unknownPage = await unknown.newPage();
    await unknownPage.goto("/forgot-password?lang=en");
    await unknownPage
      .getByLabel("Email", { exact: true })
      .fill("unknown@example.test");
    await unknownPage
      .getByRole("button", { name: "Send reset link", exact: true })
      .click();
    await expect(
      unknownPage.getByRole("status").filter({ hasText: expectedMessage }),
    ).toBeVisible();
    await unknown.close();
  } finally {
    await request.post(`${fixture}/__fixture/reset-auth`);
  }
});

test("Confirmation resend establishes PKCE, expiry errors recover, external next values stay internal and email limits are clear", async ({
  page,
  request,
}) => {
  await request.post(`${fixture}/__fixture/reset-auth`);
  await page.goto("/resend-confirmation?lang=en");
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
  await page
    .getByRole("button", { name: "Send confirmation link", exact: true })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "If this account needs confirmation" }),
  ).toBeVisible();
  const emails = await (
    await request.get(`${fixture}/__fixture/emails`)
  ).json();
  const link = new URL(emails[0].redirectTo);
  link.searchParams.set("code", emails[0].code);
  link.searchParams.set("next", "https://evil.example");
  await page.goto(link.toString());
  await expect(page).toHaveURL(/127\.0\.0\.1:3100\/dashboard$/);
  await page.goto(
    "/auth/callback?code=expired-fixture-code&next=/reset-password",
  );
  await expect(page).toHaveURL(/forgot-password\?error=invalid_link/);
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "expired",
  );
  await page.goto("/resend-confirmation?lang=en");
  await page
    .getByLabel("Email", { exact: true })
    .fill("rate-limited@example.test");
  await page
    .getByRole("button", { name: "Send confirmation link", exact: true })
    .click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Too many email requests",
  );
  await expect(
    page.getByRole("button", { name: "Send confirmation link", exact: true }),
  ).toBeDisabled();
});

test("Dashboard summaries do not follow list filters and failed summaries show a retry without invented zeroes", async ({
  page,
  request,
}) => {
  await signIn(page);
  const overview = page.getByRole("region", { name: "Quote overview" });
  const initial = await overview.textContent();
  await page.goto("/dashboard?lang=en&q=no-such-quote&status=rejected");
  expect(await overview.textContent()).toBe(initial);
  await request.post(`${fixture}/__fixture/summary-error`, {
    data: { enabled: true },
  });
  try {
    await page.reload();
    await expect(overview.getByRole("alert")).toContainText(
      "could not be loaded",
    );
    await expect(
      overview.getByText("Approved value", { exact: true }),
    ).toHaveCount(0);
    await request.post(`${fixture}/__fixture/summary-error`, {
      data: { enabled: false },
    });
    await overview
      .getByRole("button", { name: "Try again", exact: true })
      .click();
    await expect(
      overview.getByText("Approved value", { exact: true }),
    ).toBeVisible();
  } finally {
    await request.post(`${fixture}/__fixture/summary-error`, {
      data: { enabled: false },
    });
  }
});

test("Owners and portal visitors download PDFs; missing or foreign credentials cannot read them", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(180000);
  await signIn(page);
  await page.goto("/quote/new?lang=en");
  await page
    .getByLabel("Job title", { exact: true })
    .fill("PDF fixture installation");
  await page
    .getByLabel("Customer name", { exact: true })
    .fill("Nguyễn Thị Hương");
  await page
    .getByLabel("Description", { exact: true })
    .fill("Vật tư và nhân công");
  await page.getByLabel("Unit price", { exact: true }).fill("1500000");
  await page.getByRole("button", { name: "Create quote", exact: true }).click();
  await expect(page).toHaveURL(/dashboard\?created=/);
  const token = new URL(page.url()).searchParams.get("created")!;
  await page
    .getByRole("link", { name: "PDF fixture installation", exact: true })
    .click();
  await expect(page).toHaveURL(/\/quote\/[0-9a-f-]{36}$/);
  const quotePath = new URL(page.url()).pathname;
  const id = quotePath.split("/").pop()!;
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download PDF", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe(`bao-gia-${id.slice(0, 8)}.pdf`);
  const saved = await download.path();
  expect((await readFile(saved!)).subarray(0, 5).toString()).toBe("%PDF-");
  const ownerResult = await page.request.get(`${quotePath}/pdf?lang=vi`);
  expect(ownerResult.status()).toBe(200);
  expect(ownerResult.headers()["cache-control"]).toBe("private, no-store");
  const publicResult = await request.get(`/portal/${token}/pdf?lang=en`);
  expect(publicResult.status()).toBe(200);
  expect(publicResult.headers()["content-type"]).toBe("application/pdf");
  await mkdir("test-results/pdf", { recursive: true });
  await writeFile(
    "test-results/pdf/endpoint-quote.pdf",
    await ownerResult.body(),
  );
  expect((await request.get(`${quotePath}/pdf`)).status()).toBe(401);
  expect(
    (
      await request.get("/portal/00000000-0000-4000-8000-000000000000/pdf")
    ).status(),
  ).toBe(404);
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await signIn(otherPage, "other@example.test");
  expect((await otherPage.request.get(`${quotePath}/pdf`)).status()).toBe(404);
  await other.close();
  const customer = await browser.newContext();
  const portal = await customer.newPage();
  await portal.goto(`/portal/${token}?lang=vi`);
  const portalDownload = portal.waitForEvent("download");
  await portal.getByRole("button", { name: "Tải PDF", exact: true }).click();
  expect((await portalDownload).suggestedFilename()).toBe(
    download.suggestedFilename(),
  );
  // A failed download leaves an accessible message and an enabled retry button.
  await portal.route(`**/portal/${token}/pdf*`, (route) =>
    route.fulfill({ status: 503, contentType: "application/json", body: "{}" }),
  );
  await portal.getByRole("button", { name: "Tải PDF", exact: true }).click();
  await expect(portal.getByRole("main").getByRole("alert")).toContainText(
    "Chưa tạo được PDF",
  );
  await expect(
    portal.getByRole("button", { name: "Tải PDF", exact: true }),
  ).toBeEnabled();
  await customer.close();
  await request.post(`${fixture}/__fixture/quote-state`, {
    data: { id, status: "sent", expired: true },
  });
  expect((await request.get(`/portal/${token}/pdf`)).status()).toBe(404);
  await request.post(`${fixture}/__fixture/quote-state`, {
    data: { id, status: "approved", expired: true },
  });
  expect((await request.get(`/portal/${token}/pdf`)).status()).toBe(200);
  await request.post(`${fixture}/__fixture/quote-state`, {
    data: { id, status: "rejected", expired: true },
  });
  expect((await request.get(`/portal/${token}/pdf`)).status()).toBe(404);
  await request.post(`${fixture}/__fixture/quote-state`, {
    data: { id, status: "draft", expired: false },
  });
  expect((await request.get(`/portal/${token}/pdf`)).status()).toBe(404);
});
