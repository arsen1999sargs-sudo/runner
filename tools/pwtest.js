// Headless reliable test: load a URL in the system Chrome and report whether the
// Cocos scene loads + any console errors. Usage: node tools/pwtest.js <url>
const { chromium } = require('playwright-core');
const url = process.argv[2] || 'http://localhost:8123/runner/';
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
(async () => {
  const browser = await chromium.launch({ executablePath: CHROME, headless: true, args: ['--use-gl=angle','--use-angle=swiftshader','--ignore-gpu-blocklist'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', e => errors.push('PAGEERR: ' + String(e.message || e) + ' | STACK: ' + String(e.stack || '').slice(0, 400)));
  const reqfail = [];
  page.on('requestfailed', r => reqfail.push(r.url().slice(-60) + ' ' + (r.failure() && r.failure().errorText)));
  try { await page.goto(url, { waitUntil: 'load', timeout: 60000 }); } catch (e) { console.log('GOTO ERR ' + e.message); }
  let res = { cc: false, scene: false, nodes: 0 };
  for (let i = 0; i < 35; i++) {
    try {
      res = await page.evaluate(() => ({
        cc: typeof cc !== 'undefined',
        scene: typeof cc !== 'undefined' && cc.director && !!cc.director.getScene(),
        nodes: (typeof cc !== 'undefined' && cc.director && cc.director.getScene()) ? cc.director.getScene().children.length : 0
      }));
    } catch (e) {}
    if (res.scene) break;
    await page.waitForTimeout(1000);
  }
  // gameplay check: tap to start, then read game state + audio clips
  let play = {};
  if (res.scene) {
    try {
      await page.evaluate(() => { var cv=document.querySelector('canvas'); var r=cv.getBoundingClientRect(); var x=r.left+r.width/2,y=r.top+r.height/2; ['pointerdown','mousedown','pointerup','mouseup','touchstart','touchend'].forEach(function(t){try{cv.dispatchEvent(new MouseEvent(t,{bubbles:true,cancelable:true,clientX:x,clientY:y}));}catch(e){}}); });
      await page.waitForTimeout(2500);
      play = await page.evaluate(() => { var s=cc.director.getScene(); var gm=null,am=null; (function w(n){var cs=n._components||[];for(var i=0;i<cs.length;i++){var c=cs[i];if(c){if('state'in c&&typeof c.startGame==='function')gm=c;if('bgMusic'in c)am=c;}}for(var j=0;j<n.children.length;j++)w(n.children[j]);})(s); return { state: gm?gm.getState():'?', bgPlaying: am&&am.bgSource?am.bgSource.playing:'?', clips: am?{bg:!!am.bgMusic,jump:!!am.jumpSfx,win:!!am.winSfx}:'?' }; });
    } catch (e) { play = { err: e.message }; }
  }
  try { await page.screenshot({ path: 'tools/pwshot.png' }); } catch (e) {}
  const uniq = [...new Set(errors)];
  console.log(JSON.stringify({ url, SCENE_LOADED: res.scene, nodes: res.nodes, cc: res.cc, gameplay: play, errors: uniq.slice(0, 20) }, null, 1));
  await browser.close();
})().catch(e => { console.error('TEST CRASH', e.message); process.exit(1); });
