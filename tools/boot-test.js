// Boot test: drive REAL desktop Chrome (via playwright-core channel:chrome) against the
// local subpath server (mimics github.io/runner/) and report whether the game actually
// boots past the splash, plus every console message / page error. Deterministic — no MCP.
const { chromium } = require('playwright-core');
const { spawn } = require('child_process');
const path = require('path');

const PORT = 8123;
const URL = `http://127.0.0.1:${PORT}/runner/`;

(async () => {
  const server = spawn(process.execPath, [path.join(__dirname, 'serve-sub.js')], {
    env: { ...process.env, PORT: String(PORT) }, stdio: 'inherit',
  });
  await new Promise(r => setTimeout(r, 700));

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,                 // headless "new" Chrome -> SwiftShader WebGL, real engine path
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } }); // desktop
  const page = await ctx.newPage();

  const logs = [];
  const seenStacks = new Set();
  page.on('console', m => { const l = m.location(); logs.push(`[${m.type()}] ${m.text()}${l && l.url ? ' @'+l.url.slice(-50) : ''}`); });
  page.on('pageerror', e => {
    const stack = (e.stack || e.message || '').split('\n').slice(0, 6).join('\n');
    if (!seenStacks.has(stack)) { seenStacks.add(stack); logs.push(`[PAGEERROR+STACK]\n${stack}`); }
  });
  page.on('requestfailed', r => logs.push(`[REQFAIL] ${r.url().slice(-70)} :: ${r.failure()?.errorText}`));
  page.on('response', r => { if (r.status() >= 400) logs.push(`[HTTP ${r.status()}] ${r.url().slice(-80)}`); });

  let booted = false, splashGone = null, diag = {};
  try {
    await page.goto(URL, { waitUntil: 'load', timeout: 30000 });
    // Poll up to 25s for the game to boot past splash.
    for (let i = 0; i < 50; i++) {
      diag = await page.evaluate(() => {
        const out = { cc: typeof window.cc, dir: false, scene: null, splash: null, canvas: null };
        try {
          if (window.cc && cc.director) {
            out.dir = true;
            const s = cc.director.getScene && cc.director.getScene();
            out.scene = s ? (s.name || '(scene)') : null;
          }
          const sp = document.getElementById('splash');
          if (sp) out.splash = getComputedStyle(sp).display + '/' + (sp.style.opacity || '?');
          const cv = document.querySelector('canvas');
          if (cv) out.canvas = cv.width + 'x' + cv.height;
        } catch (e) { out.err = e.message; }
        return out;
      });
      if (diag.scene) { booted = true; break; }
      await page.waitForTimeout(500);
    }
  } catch (e) {
    logs.push(`[GOTO-FAIL] ${e.message}`);
  }

  console.log('\n========== BOOT RESULT ==========');
  console.log('booted (scene active):', booted);
  console.log('final diag:', JSON.stringify(diag));
  console.log('\n--- CONSOLE / ERRORS (' + logs.length + ') ---');
  console.log(logs.join('\n') || '(none)');
  console.log('=================================\n');

  await browser.close();
  server.kill();
  process.exit(booted ? 0 : 1);
})();
