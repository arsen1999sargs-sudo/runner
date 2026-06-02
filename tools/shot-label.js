const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const path = require('path');
const PORT = 8123;
const TARGET = `http://127.0.0.1:${PORT}/runner/`;
const VAL = process.argv[2] || '$321';
const OUT = process.argv[3] || 'tools/_shot.png';
(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'serve-sub.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 700));
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(TARGET, { waitUntil: 'load', timeout: 30000 });
  for (let i = 0; i < 40; i++) { if (await page.evaluate(() => !!(window.cc && cc.director && cc.director.getScene && cc.director.getScene())) ) break; await page.waitForTimeout(400); }
  await page.waitForTimeout(1500);
  await page.evaluate((v) => {
    const find = (nm) => { const st = [...cc.director.getScene().children]; while (st.length) { const n = st.pop(); if (n.name === nm) return n; for (const c of n.children) st.push(c); } return null; };
    const el = find('EarningsLabel'); const lbl = el && el.getComponent(cc.Label);
    if (lbl) { lbl.string = v; if (lbl.updateRenderData) lbl.updateRenderData(true); }
  }, VAL);
  await page.waitForTimeout(600);
  // top-right corner where MoneyPanel sits
  await page.screenshot({ path: OUT, clip: { x: 1040, y: 0, width: 240, height: 150 } });
  console.log('saved', OUT, 'value', VAL);
  await browser.close(); server.kill();
})();
