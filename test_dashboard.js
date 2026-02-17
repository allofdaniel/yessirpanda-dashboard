/* eslint-disable @typescript-eslint/no-require-imports */

const { chromium } = require('playwright');
const os = require('os');
const pathModule = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  
  const baseUrl = process.env.DASHBOARD_URL || 'https://dashboard-keprojects.vercel.app';
  const pages = ['/', '/words', '/wrong', '/stats', '/control'];
  
  for (const path of pages) {
    const name = path === '/' ? 'home' : path.slice(1);
    console.log(`Testing ${name}...`);
    await page.goto(`${baseUrl}${path}`, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000);
    const outPath = pathModule.join(os.tmpdir(), `dashboard_${name}.png`);
    await page.screenshot({ path: outPath, fullPage: true });
    console.log(`Screenshot saved: ${outPath}`);
  }
  
  await browser.close();
  console.log('Done!');
})();
