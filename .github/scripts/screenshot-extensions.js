const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const OUTPUT_DIR = path.resolve(__dirname, '../../images');

const EXTENSIONS = [
  {
    url: 'https://marketplace.visualstudio.com/items?itemName=jeffreybulanadi.bc-docker-manager',
    output: 'ext-bc-docker-manager.png',
    name: 'BC Docker Manager',
  },
  {
    url: 'https://marketplace.visualstudio.com/items?itemName=jeffreybulanadi.al-indent-prism',
    output: 'ext-al-indent-prism.png',
    name: 'AL Indent Prism',
  },
  {
    url: 'https://marketplace.visualstudio.com/items?itemName=jeffreybulanadi.vscodeaquarium',
    output: 'ext-vscodeaquarium.png',
    name: 'VSCode Aquarium',
  },
];

// Full-width clip of the page top: captures the VS Marketplace nav bar,
// breadcrumb, extension logo, title, publisher, install count, rating,
// price, short description, and Install button — exactly like the sample.
const CLIP = { x: 0, y: 0, width: 1280, height: 420 };

async function screenshotExtension(context, ext) {
  const page = await context.newPage();

  try {
    console.log(`Navigating to ${ext.url}`);

    // domcontentloaded is reliable; networkidle never fires on the Marketplace
    // due to continuous background requests.
    await page.goto(ext.url, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Dismiss cookie / consent banners before anything else
    const consentBtn = page
      .locator('button:has-text("Accept"), button:has-text("OK"), button:has-text("I accept")')
      .first();
    if (await consentBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await consentBtn.click();
      await page.waitForTimeout(500);
    }

    // Wait until the extension name appears in an h1, confirming the card rendered
    await page.waitForFunction(
      (name) => {
        const h1 = document.querySelector('h1');
        return h1 && h1.textContent.includes(name);
      },
      ext.name,
      { timeout: 20000 }
    );

    // Small extra buffer for install count / rating badges to load
    await page.waitForTimeout(2500);

    const outputPath = path.join(OUTPUT_DIR, ext.output);
    await page.screenshot({ path: outputPath, clip: CLIP });
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
    viewport: { width: 1280, height: 900 },
    colorScheme: 'dark',
  });

  for (const ext of EXTENSIONS) {
    await screenshotExtension(context, ext);
  }

  await browser.close();
  console.log('Done.');
})();
