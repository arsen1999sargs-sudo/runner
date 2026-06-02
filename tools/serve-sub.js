const http=require('http'),fs=require('fs'),path=require('path');
const file=path.resolve(__dirname,'..','dist','index.html');const port=process.env.PORT||8123;
http.createServer((req,res)=>{const p=decodeURIComponent(req.url.split('?')[0]);
if(p==='/runner/'||p==='/runner/index.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));return;}
if(p==='/'){res.statusCode=302;res.setHeader('Location','/runner/');res.end();return;}
res.statusCode=404;res.end('not found');}).listen(port,()=>console.log('sub on '+port));
