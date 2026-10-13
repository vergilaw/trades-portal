import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, writeFile } from "node:fs/promises";
import { createCanvas } from "@napi-rs/canvas";
import jsQR from "jsqr";
import { renderQuotePdf } from "./pdf";
import { samplePdfQuote } from "../../../tests/pdf-fixture";

test("PDF embeds Vietnamese fonts, repeats table headers, preserves long content and a scannable portal QR", async (t) => {
  const original = process.env.APP_URL;
  process.env.APP_URL = "https://portal.example.test";
  t.after(() => {
    if (original === undefined) delete process.env.APP_URL;
    else process.env.APP_URL = original;
  });
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  await mkdir("test-results/pdf", { recursive: true });
  for (const [name, locale, long] of [
    ["quote-vi", "vi", false],
    ["quote-en", "en", false],
    ["quote-long", "vi", true],
  ] as const) {
    const quote = samplePdfQuote(long);
    const buffer = await renderQuotePdf(quote, locale);
    assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
    await writeFile(`test-results/pdf/${name}.pdf`, buffer);
    const loader = getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: false,
    });
    const doc = await loader.promise;
    if (long) assert.ok(doc.numPages > 1);
    let text = "",
      decoded = false;
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ");
      text += pageText;
      assert.ok(pageText.includes(locale === "vi" ? "Mô tả" : "Description"));
      const viewport = page.getViewport({ scale: 2 });
      const canvas = createCanvas(
        Math.ceil(viewport.width),
        Math.ceil(viewport.height),
      );
      const context = canvas.getContext("2d");
      await page.render({
        canvasContext: context as unknown as CanvasRenderingContext2D,
        viewport,
        canvas: null,
      }).promise;
      await writeFile(
        `test-results/pdf/${name}-${i}.png`,
        canvas.toBuffer("image/png"),
      );
      assert.ok(pageText.includes(`${i} / ${doc.numPages}`), pageText);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
      const qr = jsQR(pixels.data, canvas.width, canvas.height);
      if (qr) {
        assert.equal(
          qr.data,
          `https://portal.example.test/portal/${quote.token}?lang=${locale}`,
        );
        decoded = true;
      }
      // All extracted text must stay inside the page margins.
      for (const item of content.items)
        if ("str" in item && item.str.trim()) {
          assert.ok(
            item.transform[4] >= 30 && item.transform[4] + item.width <= 565,
            `Text outside horizontal bounds: ${item.str}`,
          );
          assert.ok(
            item.transform[5] >= 20 && item.transform[5] <= 820,
            `Text outside vertical bounds: ${item.str}`,
          );
        }
    }
    assert.ok(text.includes("Điện Minh An"));
    assert.ok(text.includes("Nguyễn Thị Hương"));
    assert.ok(text.includes(long ? "20." : "Nhân công thi công"));
    assert.ok(
      text.includes(
        locale === "vi"
          ? "Đây không phải mã QR chuyển tiền."
          : "It is not a payment QR.",
      ),
    );
    assert.ok(decoded, "QR is readable from the rendered PDF");
    await loader.destroy();
  }
});
