const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    geolocation: { latitude: 44.4056, longitude: 8.9463 }, // Genoa
    permissions: ['geolocation']
  });
  const page = await context.newPage();

  await page.goto('http://127.0.0.1:3000/index.html?vista=cielo&lat=44.4056&lon=8.9463&alt=-5&az=180&time=12:00', { waitUntil: 'networkidle' });

  // Set time and view via UI evaluation
  await page.evaluate(() => {
    // Attempt to open the "Tempo e luogo" or force time if possible.
    // The previous window.impostaTempo wasn't defined, maybe it's window.app or we need to click.
    // A simpler way: The time was passed via URL parameter `time=12:00`.
    window.sky.az = 180;
    window.sky.alt = -5;
    window.sky.campo = 60;
    if (window.impostazioni) {
        window.impostazioni.terreno = true;
    }
  });

  // Give it a few seconds to render
  await page.waitForTimeout(5000);

  await page.screenshot({ path: 'screenshot_sea_after.png' });
  await browser.close();
})();
