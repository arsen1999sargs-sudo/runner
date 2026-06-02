// Validate the fit-to-frame algorithm (fontSize shrink) on the live engine before rebuild.
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const path = require('path');
const PORT = 8123;
const TARGET = `http://127.0.0.1:${PORT}/runner/`;
const VAL = process.argv[2] || '$3210';
const OUT = process.argv[3] || 'tools/_fit.png';
(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'serve-sub.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 700));
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(TARGET, { waitUntil: 'load', timeout: 30000 });
  for (let i = 0; i < 40; i++) { if (await page.evaluate(() => !!(window.cc && cc.director && cc.director.getScene && cc.director.getScene())) ) break; await page.waitForTimeout(400); }
  await page.waitForTimeout(1500);
  const info = await page.evaluate((v) => {
    const find = (nm) => { const st = [...cc.director.getScene().children]; while (st.length) { const n = st.pop(); if (n.name === nm) return n; for (const c of n.children) st.push(c); } return null; };
    const el = find('EarningsLabel'); const lbl = el && el.getComponent(cc.Label);
    if (!lbl) return { err: 'no label' };
    const BASE = 30, MAXW = 70;
    lbl.string = v; lbl.fontSize = BASE; lbl.lineHeight = BASE;
    lbl.updateRenderData && lbl.updateRenderData(true);
    const ui = el.getComponent(cc.UITransform) || (el._uiProps && el._uiProps.uiTransformComp);
    let w = ui.contentSize.width; const w0 = Math.round(w);
    let fs = BASE;
    if (w > MAXW) { fs = Math.max(14, Math.floor(BASE * MAXW / w)); lbl.fontSize = fs; lbl.lineHeight = fs; lbl.updateRenderData && lbl.updateRenderData(true); w = ui.contentSize.width; }
    return { w0, fs, wFinal: Math.round(w) };
  }, VAL);
  console.log(VAL, JSON.stringify(info));
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT, clip: { x: 1040, y: 0, width: 240, height: 150 } });
  console.log('saved', OUT);
  await browser.close(); server.kill();
})();
