const http = require('http'), fs = require('fs'), path = require('path');
const dir = path.resolve(__dirname, '..', 'dist');
const port = process.env.PORT || 8123;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  fs.readFile(path.join(dir, p), (e, d) => {
    if (e) { res.statusCode = 404; res.end('not found'); return; }
    res.setHeader('Content-Type', MIME[path.extname(p)] || 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-store');
    res.end(d);
  });
}).listen(port, () => console.log('serving ' + dir + ' on http://localhost:' + port));
