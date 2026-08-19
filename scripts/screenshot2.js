const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    geolocation: { latitude: 44.4056, longitude: 8.9463 }, // Genoa
    permissions: ['geolocation']
  });
  const page = await context.newPage();

  // Expose a function to signal when terrain is ready
  await page.goto('http://127.0.0.1:3000/index.html?vista=cielo&lat=44.4056&lon=8.9463&alt=-5&az=180&time=12:00', { waitUntil: 'networkidle' });

  // Let's force some state in the app
  await page.evaluate(() => {
    // Set time to noon
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    window.impostaTempo(now.getTime());

    // Set view
    window.sky.az = 180;
    window.sky.alt = -5;
    window.sky.campo = 60;

    // Ensure terrain is shown
    if (window.impostazioni) {
        window.impostazioni.terreno = true;
    }
  });

  // Wait for terrain to load
  console.log("Waiting for terrain to load...");
  await page.waitForFunction(() => {
    return window.terreno && window.terreno.pronto;
  }, { timeout: 30000 }).catch(e => console.log("Terrain didn't load in time"));

  // Give it a few more seconds to render
  await page.waitForTimeout(3000);

  await page.screenshot({ path: 'screenshot_sea2.png' });
  await browser.close();
})();
