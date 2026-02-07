const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  
  const baseUrl = 'https://dashboard-keprojects.vercel.app';
  const pages = ['/', '/words', '/wrong', '/stats', '/control'];
  
  for (const path of pages) {
    const name = path === '/' ? 'home' : path.slice(1);
    console.log(`Testing ${name}...`);
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `/tmp/dashboard_${name}.png`, fullPage: true });
    console.log(`Screenshot saved: /tmp/dashboard_${name}.png`);
  }
  
  await browser.close();
  console.log('Done!');
})();
