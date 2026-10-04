import { test, expect, type Page } from "@playwright/test";
import { createHmac } from "node:crypto";
async function signIn(page: Page) {
  await page.goto("/login?lang=vi");
  await page.getByLabel("Email", { exact: true }).fill("fixture@example.test");
  await page.getByLabel("Mật khẩu", { exact: true }).fill("fixture-password");
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
test("Both languages and keyboard validation fit 375px, 768px and 1440px", async ({
  page,
}) => {
  for (const width of [375, 768, 1440])
    for (const locale of ["vi", "en"]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/login?lang=${locale}`);
      await expect(page.locator("html")).toHaveAttribute("lang", locale);
      await noOverflow(page);
      await page.screenshot({
        path: `test-results/login-${width}-${locale}.png`,
        fullPage: true,
        caret: "initial",
      });
      await page.goto(`/signup?lang=${locale}`);
      await noOverflow(page);
      await page.screenshot({
        path: `test-results/signup-${width}-${locale}.png`,
        fullPage: true,
        caret: "initial",
      });
    }
  await page.goto("/signup?lang=vi");
  await page
    .getByRole("button", { name: "Tạo tài khoản", exact: true })
    .click();
  await expect(page.getByText("Nhập địa chỉ email hợp lệ.")).toBeVisible();
  await page.keyboard.press("Tab");
  expect(await page.locator(":focus").count()).toBe(1);
  await signIn(page);
  for (const width of [375, 768, 1440])
    for (const locale of ["vi", "en"]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of [
        "/dashboard",
        "/quote/new",
        "/payments",
        "/settings",
      ]) {
        await page.goto(`${route}?lang=${locale}`);
        await noOverflow(page);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await page.screenshot({
          path: `test-results/${route.replaceAll("/", "-")}-${width}-${locale}.png`,
          fullPage: true,
          caret: "initial",
        });
      }
    }
});
test("Quote edit, duplicate, approval, SePay setup and signed receipt update both views", async ({
  page,
  browser,
  request,
}) => {
  test.setTimeout(120000);
  await signIn(page);
  await page.goto("/quote/new");
  await page
    .getByLabel("Tên công việc", { exact: true })
    .fill("Fixture electrical installation");
  await page
    .getByLabel("Tên khách hàng", { exact: true })
    .fill("Customer text stays in English");
  await page.getByLabel("Mô tả", { exact: true }).fill("Materials and labour");
  await page.getByLabel("Đơn giá", { exact: true }).fill("1500000");
  await page.getByRole("button", { name: "Tạo báo giá", exact: true }).click();
  await expect(page).toHaveURL(/dashboard\?created=/);
  const token = new URL(page.url()).searchParams.get("created")!;
  await page
    .getByRole("link", { name: "Fixture electrical installation", exact: true })
    .click();
  await expect(page).toHaveURL(/\/quote\/[0-9a-f-]{36}$/);
  const quoteUrl = page.url();
  await page.getByRole("link", { name: "Sửa", exact: true }).click();
  await page
    .getByLabel("Tên công việc", { exact: true })
    .fill("Updated fixture electrical installation");
  await page.getByRole("button", { name: "Lưu thay đổi", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Updated fixture electrical installation",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Nhân bản", exact: true }).click();
  await expect(
    page.getByText("Đã nhân bản báo giá với liên kết cổng khách hàng mới."),
  ).toBeVisible();
  expect(page.url()).not.toContain(new URL(quoteUrl).pathname);
  await page.goto(quoteUrl);
  const customer = await browser.newContext({
    viewport: { width: 375, height: 900 },
  });
  const portal = await customer.newPage();
  await portal.goto(`/portal/${token}?lang=en`);
  await expect(
    portal.getByText("Customer text stays in English", { exact: true }),
  ).toBeVisible();
  await portal
    .getByRole("button", { name: "Approve quote", exact: true })
    .click();
  await expect(
    portal.getByRole("heading", { name: "Quote approved", exact: true }),
  ).toBeVisible();
  await page.goto("/settings");
  await page.getByRole("checkbox", { name: /MBBank/ }).check();
  await page
    .getByRole("button", { name: "Kết nối SePay", exact: true })
    .click();
  await expect(
    page.getByText("Lưu khóa ngay. Khóa sẽ không được hiển thị lại."),
  ).toBeVisible();
  const codes = await page.locator("code").allTextContents();
  const webhook = codes.find((c) => c.includes("/api/payments/sepay/"))!;
  const secret = codes.find((c) => /^[a-f0-9]{64}$/.test(c))!;
  await page.getByRole("button", { name: "Đóng khóa", exact: true }).click();
  await expect(page.locator("code").filter({ hasText: secret })).toHaveCount(0);
  await page.reload();
  await expect(page.locator("code").filter({ hasText: secret })).toHaveCount(0);
  await page.clock.install();
  await page.goto(quoteUrl);
  await page
    .getByRole("button", { name: "Tạo QR thanh toán", exact: true })
    .click();
  await expect(
    page.getByText("Chờ chuyển khoản", { exact: true }),
  ).toBeVisible();
  await portal.reload();
  await expect(
    portal.getByAltText("Bank transfer QR for this payment request"),
  ).toBeVisible();
  const reference = (await portal.locator("dd").allTextContents()).find((v) =>
    /^TP[A-F0-9]{20}$/.test(v),
  )!;
  await page
    .getByRole("textbox", {
      name: "Mã giao dịch hoặc ghi chú xác minh",
      exact: true,
    })
    .fill("Draft verification note");
  let refreshRequests = 0;
  page.on("request", (req) => {
    if (
      new URL(req.url()).pathname === new URL(quoteUrl).pathname &&
      req.headers().rsc === "1"
    )
      refreshRequests++;
  });
  await page.clock.fastForward(11000);
  await expect.poll(() => refreshRequests).toBeGreaterThan(0);
  const refresh = page.getByRole("button", {
    name: "Làm mới trạng thái",
    exact: true,
  });
  await expect(refresh).toBeEnabled();
  await expect(
    page.getByRole("textbox", {
      name: "Mã giao dịch hoặc ghi chú xác minh",
      exact: true,
    }),
  ).toHaveValue("Draft verification note");
  const beforeHidden = refreshRequests;
  await page.evaluate(() =>
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    }),
  );
  await page.clock.fastForward(30000);
  expect(refreshRequests).toBe(beforeHidden);
  await page.evaluate(() =>
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    }),
  );
  await page.clock.fastForward(15 * 60 * 1000);
  await expect(
    page.getByText("Đã tạm dừng tự làm mới. Nhấn làm mới để kiểm tra lại.", {
      exact: true,
    }),
  ).toBeVisible();
  expect(refreshRequests).toBe(beforeHidden);
  await refresh.click();
  await expect.poll(() => refreshRequests).toBeGreaterThan(beforeHidden);
  await expect(refresh).toBeEnabled();
  const transactionDate = new Date(Date.now() + 7 * 3600000)
    .toISOString()
    .slice(0, 19)
    .replace("T", " ");
  const raw = JSON.stringify({
    id: 999999,
    gateway: "MBBank",
    accountNumber: "0012345678",
    transferAmount: 1500000,
    transferType: "in",
    content: reference,
    transactionDate,
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const result = await request.post(webhook, {
    data: raw,
    headers: {
      "content-type": "application/json",
      "x-sepay-timestamp": timestamp,
      "x-sepay-signature": `sha256=${createHmac("sha256", secret).update(`${timestamp}.${raw}`).digest("hex")}`,
    },
  });
  expect(result.status()).toBe(200);
  expect(await result.json()).toEqual({ success: true });
  await expect(
    portal.getByText("Confirmed by SePay", { exact: true }),
  ).toBeVisible({ timeout: 20000 });
  await expect(
    page.getByText("SePay đã xác nhận", { exact: true }),
  ).toBeVisible({ timeout: 20000 });
  for (const width of [375, 768, 1440])
    for (const locale of ["vi", "en"]) {
      await portal.setViewportSize({ width, height: 900 });
      await portal.goto(`/portal/${token}?lang=${locale}`);
      await noOverflow(portal);
      await portal.screenshot({
        path: `test-results/paid-portal-${width}-${locale}.png`,
        fullPage: true,
        caret: "initial",
      });
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${new URL(quoteUrl).pathname}?lang=${locale}`);
      await noOverflow(page);
      await page.screenshot({
        path: `test-results/quote-${width}-${locale}.png`,
        fullPage: true,
        caret: "initial",
      });
    }
  await customer.close();
});
