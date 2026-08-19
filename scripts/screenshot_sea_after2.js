const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    geolocation: { latitude: 44.4056, longitude: 8.9463 }, // Genoa
    permissions: ['geolocation']
  });
  const page = await context.newPage();

  // URL params: az=180, alt=-5 to look at sea horizon. t=1716033600000 (May 18, 2024 12:00:00 UTC)
  await page.goto('http://127.0.0.1:3000/index.html?vista=cielo&lat=44.4056&lon=8.9463&alt=-5&az=180&t=1716033600000', { waitUntil: 'networkidle' });

  // Give it a few seconds to render
  await page.waitForTimeout(5000);

  await page.screenshot({ path: 'screenshot_sea_after2.png' });
  await browser.close();
})();
