const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const path = require('path');
const PORT = 8123;
const W = +(process.argv[2] || 412), H = +(process.argv[3] || 915);
const TARGET = `http://127.0.0.1:${PORT}/runner/`;

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'serve-sub.js')], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 700));
  const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  await page.addInitScript(() => {
    window.__OPENS__ = [];
    window.mraid = { open: u => window.__OPENS__.push('mraid:' + u), getState: () => 'default' };
    window.open = function (u) { window.__OPENS__.push('open:' + u); return null; };
  });
  await page.goto(TARGET, { waitUntil: 'load', timeout: 30000 });
  for (let i = 0; i < 40; i++) { if (await page.evaluate(() => !!(window.cc && cc.director && cc.director.getScene && cc.director.getScene()))) break; await page.waitForTimeout(400); }
  await page.waitForTimeout(1200);

  const geo = await page.evaluate(() => {
    const out = { view: {}, found: {} };
    const vs = cc.view.getVisibleSize(); out.view.visible = [Math.round(vs.width), Math.round(vs.height)];
    const cv = document.querySelector('canvas'); out.view.canvasCSS = [cv.clientWidth, cv.clientHeight];
    const getUI = (n) => n.getComponent(cc.UITransform) || (n._uiProps && n._uiProps.uiTransformComp) || null;
    const scene = cc.director.getScene();
    const stack = [...scene.children]; const names = ['DownloadButton', 'Player'];
    const want = {};
    while (stack.length) { const n = stack.pop(); if (names.indexOf(n.name) >= 0 && !want[n.name]) want[n.name] = n; for (const c of n.children) stack.push(c); }
    for (const nm of names) {
      const n = want[nm]; if (!n) { out.found[nm] = 'NOT FOUND'; continue; }
      const ui = getUI(n); const wp = n.worldPosition;
      const o = { active: n.activeInHierarchy, comps: n.components.map(c => c.constructor.name), worldPos: [Math.round(wp.x), Math.round(wp.y)], scale: +n.scale.x.toFixed(2) };
      if (ui) { const bb = ui.getBoundingBoxToWorld(); o.bbox = { x: Math.round(bb.x), y: Math.round(bb.y), w: Math.round(bb.width), h: Math.round(bb.height) }; }
      out.found[nm] = o;
    }
    return out;
  });
  console.log(`viewport ${W}x${H} | visible=${JSON.stringify(geo.view.visible)} canvasCSS=${JSON.stringify(geo.view.canvasCSS)}`);
  console.log(JSON.stringify(geo.found, null, 2));

  // Map a world-UI bbox to screen px and tap its center via touchscreen.
  const toScreen = (cx, cy) => {
    const vs = geo.view.visible, css = geo.view.canvasCSS;
    return [Math.round((cx / vs[0]) * css[0]), Math.round(css[1] - (cy / vs[1]) * css[1])];
  };
  const tapAndCheck = async (label, cx, cy) => {
    const [sx, sy] = toScreen(cx, cy);
    const b = await page.evaluate(() => window.__OPENS__.length);
    await page.touchscreen.tap(sx, sy); await page.waitForTimeout(400);
    const a = await page.evaluate(() => window.__OPENS__.length);
    console.log(`tap ${label} world(${cx},${cy}) -> screen(${sx},${sy}) linkOpened=${a > b}`);
  };
  const db = geo.found.DownloadButton, pl = geo.found.Player;
  // first a start tap up top
  await page.touchscreen.tap(Math.round(geo.view.canvasCSS[0]/2), 60); await page.waitForTimeout(300);
  if (db && db.bbox) await tapAndCheck('DownloadButton-center', db.bbox.x + db.bbox.w/2, db.bbox.y + db.bbox.h/2);
  if (pl && pl.worldPos) await tapAndCheck('Player-center', pl.worldPos[0], pl.worldPos[1]);
  // overlap?
  if (db && db.bbox && pl && pl.worldPos) {
    const inX = pl.worldPos[0] >= db.bbox.x && pl.worldPos[0] <= db.bbox.x + db.bbox.w;
    const inY = pl.worldPos[1] >= db.bbox.y && pl.worldPos[1] <= db.bbox.y + db.bbox.h;
    console.log(`\nPlayer center inside DownloadButton bbox? X=${inX} Y=${inY}`);
  }
  console.log('opens:', await page.evaluate(() => window.__OPENS__));
  await browser.close(); server.kill();
})();
