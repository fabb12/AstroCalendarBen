const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    geolocation: { latitude: 44.4056, longitude: 8.9463 }, // Genoa
    permissions: ['geolocation']
  });
  const page = await context.newPage();

  // Set the time explicitly via JS after load
  await page.goto('http://127.0.0.1:3000/index.html?vista=cielo&lat=44.4056&lon=8.9463&alt=-2&az=180', { waitUntil: 'networkidle' });

  await page.evaluate(() => {
    // Set time to 12:00 local time
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    window.appData = window.appData || {};
    // Let's see if we can set time. "impostaTempo" is not in window.
    // The main object might be 'app' or something.
    // We can also just wait for terrain to load
  });

  // Let's find out how to wait for terrain
  await page.waitForFunction(() => {
    // Look for the "terreno" loading message to disappear
    const text = document.body.innerText;
    return text && !text.includes("Sto misurando la forma del terreno");
  }, { timeout: 30000 }).catch(() => {});

  await page.waitForTimeout(2000);
  await page.screenshot({ path: 'screenshot_sea3.png' });
  await browser.close();
})();
