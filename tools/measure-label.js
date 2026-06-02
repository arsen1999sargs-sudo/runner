// Measure EarningsLabel vs PayPalIcon frame in landscape after setting a 3-digit balance.
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const path = require('path');
const PORT = 8123;
const TARGET = `http://127.0.0.1:${PORT}/runner/`;
(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'serve-sub.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 700));
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); // landscape
  const page = await ctx.newPage();
  await page.goto(TARGET, { waitUntil: 'load', timeout: 30000 });
  for (let i = 0; i < 40; i++) { if (await page.evaluate(() => !!(window.cc && cc.director && cc.director.getScene && cc.director.getScene())) ) break; await page.waitForTimeout(400); }
  await page.waitForTimeout(1500);

  const res = await page.evaluate(() => {
    const find = (nm) => { const st = [...cc.director.getScene().children]; while (st.length) { const n = st.pop(); if (n.name === nm) return n; for (const c of n.children) st.push(c); } return null; };
    const el = find('EarningsLabel'), icon = find('PayPalIcon'), mp = find('MoneyPanel');
    if (!el) return { err: 'no EarningsLabel' };
    const lbl = el.getComponent(cc.Label);
    lbl.string = '$321';
    if (lbl.updateRenderData) lbl.updateRenderData(true);
    const out = {};
    const getUI = (n) => n && (n.getComponent(cc.UITransform) || (n._uiProps && n._uiProps.uiTransformComp) || null);
    const bb = (n) => { const ui = getUI(n); if (!ui) return null; const b = ui.getBoundingBoxToWorld(); return { L: Math.round(b.x), R: Math.round(b.x + b.width), w: Math.round(b.width), cy: Math.round(b.y + b.height/2) }; };
    out.mpScale = mp ? +mp.scale.x.toFixed(2) : null;
    out.label = bb(el);
    out.frame = bb(icon);
    const elui = getUI(el);
    out.labelContentW = elui ? Math.round(elui.contentSize.width) : null;
    out.fontSize = lbl.fontSize; out.overflow = lbl.overflow; out.hAlign = lbl.horizontalAlign;
    out.overflowEnum = { NONE: cc.Label.Overflow.NONE, CLAMP: cc.Label.Overflow.CLAMP, SHRINK: cc.Label.Overflow.SHRINK, RESIZE: cc.Label.Overflow.RESIZE_HEIGHT };
    return out;
  });
  console.log(JSON.stringify(res, null, 2));
  if (res.label && res.frame) {
    console.log(`\nlabel right=${res.label.R}, frame right=${res.frame.R}  => overflow past frame: ${res.label.R - res.frame.R}px`);
    console.log(`label left=${res.label.L}, frame left=${res.frame.L}`);
  }
  await browser.close(); server.kill();
})();
