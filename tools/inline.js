// Inliner: build/web-mobile/  ->  dist/index.html (single self-contained file)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Gzip ONLY the big engine chunk (cocos-js/_virtual_cc*.js, ~2.4MB -> ~0.6MB). It is
// loaded via async System.instantiate (DecompressionStream). The earlier race that hung
// the splash was between TWO concurrent gzipped chunks clobbering SystemJS's shared
// register slot — gzipping a SINGLE chunk avoids any concurrency, so it is safe. This
// keeps the single file well under the 5MB limit even with Spine included (clean console).
const GZIP = (rel) => /^cocos-js\/_virtual_cc.*\.js$/i.test(rel);

const ROOT = path.resolve(__dirname, '..');
const BUILD = path.join(ROOT, 'build', 'web-mobile');
const OUTDIR = path.join(ROOT, 'dist');
const OUT = path.join(OUTDIR, 'index.html');

const EXCLUDE_SPINE = process.argv.includes('--no-spine');

const TEXT_EXT = ['.js', '.json', '.css', '.txt', '.html', '.map'];
const MIME = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.gif': 'image/gif', '.bmp': 'image/bmp',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.wasm': 'application/wasm', '.bin': 'application/octet-stream',
  '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2',
};

const INLINE_DIRECT = new Set([
  'index.html', 'style.css',
  'src/polyfills.bundle.js', 'src/system.bundle.js', 'src/import-map.json',
]);

const files = {};
let nBin = 0, nText = 0, totalRaw = 0;

function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const st = fs.statSync(full);
    if (st.isDirectory()) { walk(full); continue; }
    const rel = path.relative(BUILD, full).split(path.sep).join('/');
    const ext = path.extname(full).toLowerCase();
    // Drop the unused Spine runtime (~0.6MB) to fit under 5MB. The game has no Spine
    // assets, so the engine's startup preload of it just warns (harmless) and continues.
    if (EXCLUDE_SPINE && /spine/i.test(rel)) continue;
    const buf = fs.readFileSync(full);
    totalRaw += buf.length;
    if (TEXT_EXT.includes(ext)) { files[rel] = { text: buf.toString('utf8') }; nText++; }
    else { files[rel] = { b64: buf.toString('base64'), mime: MIME[ext] || 'application/octet-stream' }; nBin++; }
  }
}
walk(BUILD);

const read = (rel) => fs.readFileSync(path.join(BUILD, rel), 'utf8');

const runtimeMap = {};
let nGz = 0, gzBefore = 0, gzAfter = 0;
for (const k of Object.keys(files)) {
  if (INLINE_DIRECT.has(k)) continue;
  const rec = files[k];
  if (rec.text !== undefined && GZIP(k)) {
    const raw = Buffer.from(rec.text, 'utf8');
    const gz = zlib.gzipSync(raw, { level: 9 });
    gzBefore += raw.length; gzAfter += gz.length; nGz++;
    runtimeMap[k] = { gz: gz.toString('base64') };
  } else {
    runtimeMap[k] = rec;
  }
}

const interceptor = `
<script>
(function(){
  var F = window.__F__;
  function norm(u){ u = String(u||''); var i = u.indexOf('?'); if(i>=0)u=u.slice(0,i); i=u.indexOf('#'); if(i>=0)u=u.slice(0,i); return u; }
  var KEYS = Object.keys(F);
  function find(u){
    u = norm(u);
    if (F[u]) return u;
    for (var i=0;i<KEYS.length;i++){ var k=KEYS[i]; if (u===k || u.endsWith('/'+k) || u.endsWith(k)) return k; }
    var b = u.substring(u.lastIndexOf('/')+1);
    if (b) for (var j=0;j<KEYS.length;j++){ var k2=KEYS[j]; if (k2===b || k2.endsWith('/'+b)) return k2; }
    return null;
  }
  window.__iFind__ = find;
  function b64u8(s){ var x=atob(s), a=new Uint8Array(x.length); for(var i=0;i<x.length;i++)a[i]=x.charCodeAt(i); return a; }
  window.__b64u8__ = b64u8;
  // Async gunzip via DecompressionStream (used for engine JS chunks).
  window.__gunzip__ = function(u8){
    if (typeof DecompressionStream === 'undefined') return Promise.reject(new Error('DecompressionStream unsupported'));
    var ds = new DecompressionStream('gzip');
    return new Response(new Blob([u8]).stream().pipeThrough(ds)).arrayBuffer()
      .then(function(ab){ return new TextDecoder('utf-8').decode(ab); });
  };
  function bytes(r){ var s=atob(r.b64), a=new Uint8Array(s.length); for(var i=0;i<s.length;i++)a[i]=s.charCodeAt(i); return a; }
  function blobURL(r){
    if (r._u) return r._u;
    var blob = (r.text!==undefined) ? new Blob([r.text], {type:'text/javascript'}) : new Blob([bytes(r)], {type:r.mime||'application/octet-stream'});
    return (r._u = URL.createObjectURL(blob));
  }
  var of = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = function(input, init){
    var url = (typeof input==='string') ? input : (input && input.url);
    var k = find(url);
    if (k){ var r=F[k];
      if (r.gz!==undefined){ return window.__gunzip__(b64u8(r.gz)).then(function(t){ return new Response(t,{status:200,headers:{'Content-Type':'text/javascript'}}); }); }
      var body = (r.text!==undefined) ? r.text : bytes(r);
      return Promise.resolve(new Response(body, {status:200, headers:{'Content-Type': r.mime||(r.text!==undefined?'text/plain':'application/octet-stream')}})); }
    return of ? of(input, init) : Promise.reject(new Error('offline:'+url));
  };
  var XO = XMLHttpRequest.prototype.open, XS = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(m,u){ this.__u=u; this.__k=find(u); return XO.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function(){
    var self=this, k=self.__k; if(!k) return XS.apply(this, arguments);
    var r=F[k];
    setTimeout(function(){
      var rt = self.responseType || '';
      try {
        function def(n,v){ try{ Object.defineProperty(self,n,{configurable:true,get:function(){return v;}}); }catch(e){} }
        def('readyState',4); def('status',200); def('statusText','OK');
        if (r.text!==undefined){
          def('response', (rt==='json') ? JSON.parse(r.text) : r.text);
          def('responseText', r.text);
        } else {
          // binary: fresh ArrayBuffer/Blob on EACH access (decodeAudioData detaches the buffer)
          Object.defineProperty(self,'response',{configurable:true,get:function(){ var u8=bytes(r); return (rt==='blob') ? new Blob([u8],{type:r.mime}) : u8.buffer; }});
        }
        // Fire ONLY via dispatchEvent. dispatchEvent(new Event('load')) ALSO invokes the
        // onload PROPERTY handler — so calling self.onload() too would fire it twice. The
        // engine's downloader removes the request id on first completion; a second call
        // makes _downloading.remove(id) return undefined and throws "undefined.length",
        // which aborts the per-request callbacks and can stall the whole load (the desktop
        // "splash hang"). One dispatch covers both onX properties and addEventListener.
        try { self.dispatchEvent(new Event('readystatechange')); } catch(e){}
        try { self.dispatchEvent(new Event('load')); } catch(e){}
        try { self.dispatchEvent(new Event('loadend')); } catch(e){}
      } catch(e){ try { self.dispatchEvent(new Event('error')); } catch(_){} }
    }, 0);
  };
  ['HTMLImageElement','HTMLAudioElement','HTMLVideoElement'].forEach(function(tag){
    var proto = window[tag] && window[tag].prototype; if(!proto) return;
    var d = Object.getOwnPropertyDescriptor(proto,'src'); if(!d||!d.set) return;
    Object.defineProperty(proto,'src',{ configurable:true, enumerable:true,
      get:function(){ return d.get.call(this); },
      set:function(v){ var k=find(v); d.set.call(this, k ? blobURL(F[k]) : v); }
    });
  });
  // Fonts. Cocos loads TTF via new FontFace(family, 'url(...)') whose source is fetched
  // by the browser's NATIVE font loader — it bypasses fetch/XHR, so on a single inlined
  // file (any host path) that url 404s and text falls back to a system font. Rewrite the
  // url() to a blob URL from the map so the real font loads everywhere.
  var FONT_URL = /url\\(\\s*(['"]?)([^'")]+)\\1\\s*\\)/g;
  function rewriteUrls(css){ return css.replace(FONT_URL, function(m, q, u){ var k = find(u); return k ? 'url("'+blobURL(F[k])+'")' : m; }); }
  // Path A: browsers using the FontFace constructor (new FontFace(family, 'url(...)')).
  if (window.FontFace){
    var OFF = window.FontFace;
    var WF = function(family, source, descriptors){
      if (typeof source === 'string') source = rewriteUrls(source);
      return new OFF(family, source, descriptors);
    };
    WF.prototype = OFF.prototype;
    try { window.FontFace = WF; } catch(e){}
  }
  // Path B (what desktop Chrome actually uses here): the engine injects a <style> whose
  // textContent is "@font-face{ ... src:url('<ttf>') }" then appends it — the browser's CSS
  // engine fetches that url directly (bypasses fetch/XHR/FontFace), 404ing on the inlined
  // file. Intercept textContent on style elements so the url() points at the map's blob.
  (function(){
    var OCE = Document.prototype.createElement;
    var tcd = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
    if (!tcd || !tcd.set) return;
    Document.prototype.createElement = function(tag){
      var el = OCE.apply(this, arguments);
      if (String(tag).toLowerCase() === 'style'){
        Object.defineProperty(el, 'textContent', { configurable:true, enumerable:true,
          get:function(){ return tcd.get.call(this); },
          set:function(v){ tcd.set.call(this, (typeof v==='string' && v.indexOf('@font-face')>=0) ? rewriteUrls(v) : v); }
        });
      }
      return el;
    };
  })();
  // Intercept <script src> too. Cocos loads asset-bundle index.js via a real <script>
  // tag, which bypasses fetch/XHR. On a subpath host (github.io/runner/) those 404 and
  // the engine hangs on the splash. Serve them from the map as a blob URL so they load
  // on ANY path. Unmapped scripts (excluded spine) fall through to the network.
  (function(){
    var SP = window.HTMLScriptElement && window.HTMLScriptElement.prototype; if(!SP) return;
    var sd = Object.getOwnPropertyDescriptor(SP,'src'); if(!sd||!sd.set) return;
    Object.defineProperty(SP,'src',{ configurable:true, enumerable:true,
      // getter returns the ORIGINAL url the engine set (so Cocos derives the bundle base correctly).
      get:function(){ return this.__os !== undefined ? this.__os : sd.get.call(this); },
      set:function(v){
        var k = find(v);
        if (k && F[k]){
          // Mapped asset-bundle index.js. Its modules are pre-registered at startup
          // (see overrideScript), so the <script> just needs to fire onload WITHOUT a
          // 404 — point it at an empty data URL. Works on any host path (root/subpath/
          // file://): Cocos takes the onload path and uses the pre-registered modules.
          this.__os = v;
          sd.set.call(this, 'data:text/javascript,');
        } else {
          sd.set.call(this, v); // unmapped (excluded spine) -> network (harmless 404)
        }
      }
    });
  })();
})();
</script>`;

const overrideScript = `
<script>
(function(){
  var S = System.constructor.prototype, orig = S.instantiate;
  S.instantiate = function(url, parent){
    var self = this, args = arguments;
    var k = window.__iFind__ ? window.__iFind__(url) : null;
    var rec = k && window.__F__ ? window.__F__[k] : null;
    if (rec && rec.gz !== undefined){
      // gzipped engine chunk: decompress async, then eval + return its register.
      return window.__gunzip__(window.__b64u8__(rec.gz)).then(function(text){
        (0, eval)(text + '\\n//# sourceURL=' + url);
        var reg = self.getRegister ? self.getRegister(url) : null;
        return reg || orig.apply(self, args);
      });
    }
    if (rec && rec.text !== undefined){
      (0, eval)(rec.text + '\\n//# sourceURL=' + url);
      var reg = this.getRegister ? this.getRegister(url) : null;
      return reg || (orig.apply(this, arguments));
    }
    return orig.apply(this, arguments);
  };
  // Pre-register bundle modules at startup. Together with the <script src> interceptor
  // (which makes bundle index.js "load" via an empty data: URL — no 404), Cocos finds
  // these modules already registered and boots on ANY host path (root, github.io/runner/
  // subpath, or file://).
  try {
    Object.keys(window.__F__).forEach(function(k){
      if (/assets\\/[^/]+\\/index\\.js$/.test(k)) {
        try { (0, eval)(window.__F__[k].text + '\\n//# sourceURL=' + k); } catch(e){ console.error('preload', k, e && e.message); }
      }
    });
  } catch(e){}
})();
</script>`;

let html = read('index.html');

// NOTE: use FUNCTION replacements everywhere — string replacements interpret $&, $1, $$ etc.,
// which would corrupt embedded JS that contains "$&" and similar sequences.
html = html.replace(/<link[^>]*href=["']style\.css["'][^>]*>/i, () => '<style>\n' + read('style.css') + '\n</style>');
html = html.replace(/<script[^>]*src=["']src\/polyfills\.bundle\.js["'][^>]*>\s*<\/script>/i, () => '<script>\n' + read('src/polyfills.bundle.js') + '\n</script>');
html = html.replace(/<script[^>]*src=["']src\/system\.bundle\.js["'][^>]*>\s*<\/script>/i, () => '<script>\n' + read('src/system.bundle.js') + '\n</script>' + overrideScript);
html = html.replace(/<script[^>]*src=["']src\/import-map\.json["'][^>]*>\s*<\/script>/i, () => '<script type="systemjs-importmap">\n' + read('src/import-map.json') + '\n</script>');

// Escape "<" (so </script> in sources can't end the tag) and U+2028 / U+2029 (line
// separators that break inline-script string literals). Pure-ASCII regex via \u escapes.
// Put data in a JSON script tag (textContent is NOT parsed as JS, so no string-literal
// pitfalls). Only "<" must be escaped so "</script>" can't end the tag; JSON.parse
// turns < back into "<". U+2028/U+2029 are valid inside JSON, no escaping needed.
const mapJson = JSON.stringify(runtimeMap).replace(/</g, '\\u003c');
const mapScript = '<script type="application/json" id="__FD__">' + mapJson + '</script>\n'
  + '<script>window.__F__=JSON.parse(document.getElementById("__FD__").textContent);</script>';

// Empty-data favicon so the browser does NOT auto-probe /favicon.ico (a harmless but
// console-visible 404 on a single-file host). Keeps the console fully clean for ad-network review.
const favicon = '<link rel="icon" href="data:,">';

// Inject AFTER <meta charset> so the browser decodes the (UTF-8) embedded data correctly.
// The charset declaration must be within the first 1024 bytes — the huge map must come after it.
if (/<meta\s+charset/i.test(html)) {
  html = html.replace(/(<meta\s+charset[^>]*>)/i, (m) => m + '\n' + favicon + '\n' + mapScript + '\n' + interceptor);
} else {
  html = html.replace(/<head>/i, () => '<head>\n<meta charset="utf-8">\n' + favicon + '\n' + mapScript + '\n' + interceptor);
}

fs.mkdirSync(OUTDIR, { recursive: true });
fs.writeFileSync(OUT, html);

const mb = (n) => (n / 1048576).toFixed(2);
console.log('files: ' + (nText + nBin) + ' (' + nText + ' text, ' + nBin + ' binary), raw ' + mb(totalRaw) + ' MB');
console.log('gzipped ' + nGz + ' engine chunk(s): ' + mb(gzBefore) + ' MB -> ' + mb(gzAfter) + ' MB');
console.log('spine excluded: ' + EXCLUDE_SPINE + ' | OUTPUT: ' + OUT + ' | HTML size: ' + mb(fs.statSync(OUT).size) + ' MB');
