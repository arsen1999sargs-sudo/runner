// Validate the SHRINK approach: fix label node width to the free space inside the frame,
// set overflow=SHRINK, and let the engine fit any string (font-independent).
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const path = require('path');
const PORT = 8123;
const TARGET = `http://127.0.0.1:${PORT}/runner/`;
const VAL = process.argv[2] || '$99999';
const WIDE = process.argv[3] === 'wide';   // simulate a wider system font
const OUT = process.argv[4] || 'tools/_shrink.png';
(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'serve-sub.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 700));
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(TARGET, { waitUntil: 'load', timeout: 30000 });
  for (let i = 0; i < 40; i++) { if (await page.evaluate(() => !!(window.cc && cc.director && cc.director.getScene && cc.director.getScene())) ) break; await page.waitForTimeout(400); }
  await page.waitForTimeout(1500);
  const info = await page.evaluate((args) => {
    const [v, wide] = args;
    const find = (nm) => { const st = [...cc.director.getScene().children]; while (st.length) { const n = st.pop(); if (n.name === nm) return n; for (const c of n.children) st.push(c); } return null; };
    const el = find('EarningsLabel'); const lbl = el && el.getComponent(cc.Label);
    if (!lbl) return { err: 'no label' };
    const panel = el.parent; const icon = panel && panel.getChildByName('PayPalIcon');
    const fui = icon && icon.getComponent(cc.UITransform);
    const halfFrame = fui ? fui.contentSize.width / 2 : 70;
    const labelX = el.position.x;
    const pad = 8, PULSE = 1.15;
    const peakW = (halfFrame - pad - labelX) * 2;
    const availW = Math.max(20, peakW / PULSE);   // reserve room for the pulse peak
    const ui = el.getComponent(cc.UITransform) || (el._uiProps && el._uiProps.uiTransformComp);
    if (wide) { lbl.fontFamily = 'Impact'; lbl.isSystemFontUsed = true; } // wider font to stress-test
    lbl.isBold = false;                 // less bold, as requested
    lbl.overflow = cc.Label.Overflow.SHRINK;
    ui.setContentSize(availW, ui.contentSize.height || 40);
    lbl.fontSize = 30; lbl.lineHeight = 30;
    lbl.string = v;
    lbl.updateRenderData && lbl.updateRenderData(true);
    el.setScale(PULSE, PULSE, 1);       // simulate the PULSE PEAK (moment the balance changes)
    return { halfFrame, labelX: Math.round(labelX), availW: Math.round(availW), atPulsePeak: PULSE, contentW: Math.round(ui.contentSize.width) };
  }, [VAL, WIDE]);
  console.log(VAL, WIDE ? '(wide font)' : '', JSON.stringify(info));
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT, clip: { x: 1040, y: 0, width: 240, height: 150 } });
  console.log('saved', OUT);
  await browser.close(); server.kill();
})();
