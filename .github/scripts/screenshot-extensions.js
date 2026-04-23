const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = path.resolve(__dirname, '../../images');

const EXTENSIONS = [
  {
    url: 'https://marketplace.visualstudio.com/items?itemName=jeffreybulanadi.bc-docker-manager',
    output: 'ext-bc-docker-manager.png',
  },
  {
    url: 'https://marketplace.visualstudio.com/items?itemName=jeffreybulanadi.al-indent-prism',
    output: 'ext-al-indent-prism.png',
  },
];

// Ordered list of selectors to try for the extension header section.
// The VS Code Marketplace uses dynamically generated class names, so we try
// several candidates and fall back to a viewport clip if none match.
const HEADER_SELECTORS = [
  '.ux-item-header',
  '.item-header',
  '[class*="itemHeader"]',
  '[class*="item-header"]',
  '.gallery-item-header',
];

async function screenshotExtension(context, url, outputPath) {
  const page = await context.newPage();

  try {
    console.log(`Navigating to ${url}`);
    // 'networkidle' never fires on the Marketplace (endless background requests).
    // Use 'domcontentloaded' then wait for a visible content element instead.
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Wait for the page title / install count area to appear
    await page.waitForSelector('body', { timeout: 15000 });

    // Dismiss cookie / consent banners if present
    const consentBtn = page
      .locator('button:has-text("Accept"), button:has-text("OK"), button:has-text("I accept")')
      .first();
    if (await consentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await consentBtn.click();
      await page.waitForTimeout(500);
    }

    // Buffer for lazy-loaded stats (install count, rating)
    await page.waitForTimeout(4000);

    // Try to find and screenshot the header element
    let captured = false;
    for (const selector of HEADER_SELECTORS) {
      const el = page.locator(selector).first();
      const visible = await el.isVisible({ timeout: 2000 }).catch(() => false);
      if (visible) {
        await el.screenshot({ path: outputPath });
        console.log(`  Captured via selector: ${selector}`);
        captured = true;
        break;
      }
    }

    // Fallback: clip the top of the page where the header always lives
    if (!captured) {
      console.log('  No selector matched — falling back to viewport clip');
      await page.screenshot({
        path: outputPath,
        clip: { x: 0, y: 0, width: 1280, height: 560 },
      });
    }

    console.log(`  Saved: ${outputPath}`);
  } finally {
    await page.close();
  }
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    colorScheme: 'light',
  });

  for (const ext of EXTENSIONS) {
    const outputPath = path.join(OUTPUT_DIR, ext.output);
    await screenshotExtension(context, ext.url, outputPath);
  }

  await browser.close();
  console.log('Done.');
})();
