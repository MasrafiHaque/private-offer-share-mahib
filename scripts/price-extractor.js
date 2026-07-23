/**
 * Daraz Product Page থেকে Price বের করার Logic
 */
const { chromium } = require("playwright");

async function extractPrice(url) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
  });

  try {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForLoadState("networkidle", { timeout: 20000 }).catch(() => {});

    try {
      const closeBtn = page.locator('[class*="close"], [aria-label="close"]').first();
      if (await closeBtn.isVisible({ timeout: 3000 })) await closeBtn.click();
    } catch (_) {}

    await page.waitForTimeout(2500);

    const result = await page.evaluate(() => {
      if (!document.body) return null;
      const selectors = [
        ".pdp-price",
        ".pdp-price_type_normal",
        ".pdp-product-price .pdp-price",
        '[class*="pdp-price"]',
        '[data-spm="price"]'
      ];
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.textContent.trim()) {
          return { method: "selector:" + sel, raw: el.textContent.trim() };
        }
      }
      const metaPrice = document.querySelector(
        'meta[property="product:price:amount"], meta[property="og:price:amount"]'
      );
      if (metaPrice) return { method: "meta-tag", raw: metaPrice.content };

      const bodyText = document.body.innerText;
      const match = bodyText.match(/৳\s?[\d,]+/);
      if (match) return { method: "text-fallback", raw: match[0] };
      return null;
    });

    if (!result) {
      return { success: false, error: "Price খুঁজে পাওয়া যায়নি", finalUrl: page.url() };
    }

    return {
      success: true,
      finalUrl: page.url(),
      method: result.method,
      rawPrice: result.raw,
      price: Number(result.raw.replace(/[^\d]/g, ""))
    };
  } catch (err) {
    return { success: false, error: err.message };
  } finally {
    await browser.close();
  }
}

module.exports = { extractPrice };