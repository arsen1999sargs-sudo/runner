// Reproduce "tap-to-jump opens the CTA link" + map the DOWNLOAD button's click zone.
// Drives REAL Chrome against the local subpath server, intercepts every link-open
// (mraid.open / FbPlayableAd / ExitApi / window.open), then clicks a grid of points
// and reports which screen coords trigger a link-open.
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 8123;
const TARGET = process.argv[2] || `http://127.0.0.1:${PORT}/runner/`;
const LIVE = !!process.argv[2];

(async () => {
  const server = LIVE ? null : spawn(process.execPath, [path.join(__dirname, 'serve-sub.js')], {
    env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore',
  });
  await new Promise(r => setTimeout(r, 700));

  const browser = await chromium.launch({
    channel: 'chrome', headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();

  // Intercept link-opens BEFORE any page script runs.
  await page.addInitScript(() => {
    window.__OPENS__ = [];
    const rec = (how, url) => { window.__OPENS__.push(how + ':' + (url || '')); };
    window.mraid = { open: u => rec('mraid', u), getState: () => 'default' };
    window.FbPlayableAd = { onCTAClick: () => rec('fb', '') };
    window.ExitApi = { exit: () => rec('exit', '') };
    const oo = window.open; window.open = function (u) { rec('window.open', u); return null; };
  });

  await page.goto(TARGET, { waitUntil: 'load', timeout: 30000 });
  // wait for scene
  for (let i = 0; i < 40; i++) {
    const ok = await page.evaluate(() => !!(window.cc && cc.director && cc.director.getScene && cc.director.getScene()));
    if (ok) break; await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1500);

  const opensCount = () => page.evaluate(() => window.__OPENS__.length);
  const lastOpen = () => page.evaluate(() => window.__OPENS__[window.__OPENS__.length - 1] || '');

  // Start the game with a tap near the TOP (away from the bottom banner).
  const before = await opensCount();
  await page.mouse.click(640, 120);
  await page.waitForTimeout(400);
  const afterStart = await opensCount();
  console.log(`start-tap @ (640,120): linkOpened=${afterStart > before} ${afterStart > before ? '('+await lastOpen()+')' : ''}`);

  // Grid sweep — which screen points open the CTA link?
  const xs = [200, 440, 640, 840, 1080];
  const ys = [100, 250, 400, 520, 600, 660, 700];
  console.log('\n=== CLICK MAP (X across, Y down) — L=link opened, .=no link ===');
  let hdr = 'Y\\X   ' + xs.map(x => String(x).padStart(5)).join('');
  console.log(hdr);
  for (const y of ys) {
    let row = String(y).padStart(4) + '  ';
    for (const x of xs) {
      const b = await opensCount();
      await page.mouse.click(x, y);
      await page.waitForTimeout(250);
      const a = await opensCount();
      row += (a > b ? '    L' : '    .');
    }
    console.log(row);
  }

  await browser.close();
  if (server) server.kill();
})();
