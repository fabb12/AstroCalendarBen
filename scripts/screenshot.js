const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
  const page = await browser.newPage();

  await page.goto('http://localhost:3000/index.html?vista=cielo');

  // Wait for load, then set location
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    localStorage.setItem('astrocalendario_posizione',
      JSON.stringify({ lat: 44.4056, lon: 8.9463, nome: 'Genova', fonte: 'manuale' }));
  });

  await page.reload();
  await page.waitForTimeout(2000);

  await page.evaluate(() => {
    // Set daytime for better visibility of the sea color
    const ora = new Date();
    ora.setHours(12, 0, 0);
    skyImpostaOffsetTempo((ora.getTime() - Date.now()) / 1000);

    // Look at the horizon over the sea (South)
    sky.az = 180;
    sky.alt = -2;

    // Turn on terrain if not already
    sky.terreno = true;
  });

  await page.waitForTimeout(10000); // wait for terrain and sea to load

  await page.screenshot({ path: 'screenshot_sea.png' });
  await browser.close();
})();
