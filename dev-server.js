// server.js - servidor local (arquivos estáticos + proxy). Rode: node server.js  (Node 18+)
if (typeof fetch === 'undefined') {
  console.error('Node muito antigo. Instale o Node 18 ou mais novo: https://nodejs.org');
  process.exit(1);
}

const http = require('http');
const fs = require('fs');
const path = require('path');
const handler = require('./api/olhovivo.js');

const PORTA = process.env.PORT || 3000;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  // rota da API: adapta req/res para o formato do Vercel
  if (url.pathname === '/api/olhovivo') {
    req.query = Object.fromEntries(url.searchParams);
    res.status = c => { res.statusCode = c; return res; };
    res.json = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    return handler(req, res);
  }

  // arquivos estáticos
  const arquivo = path.join(__dirname, url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname));
  if (!arquivo.startsWith(__dirname) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
    res.statusCode = 404;
    return res.end('404');
  }
  res.setHeader('Content-Type', TIPOS[path.extname(arquivo)] || 'application/octet-stream');
  fs.createReadStream(arquivo).pipe(res);
}).listen(PORTA, () => console.log(`Rodando em http://localhost:${PORTA}`));
