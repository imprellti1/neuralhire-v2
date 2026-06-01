import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webRoot = path.resolve(__dirname, '..');
const publicDir = path.join(webRoot, 'public');
const srcDir = path.join(webRoot, 'src');

const WEB_PORT = Number(process.env.WEB_PORT || 5173);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

function safeResolve(baseDir, requestPath) {
  const cleaned = requestPath.replace(/^\/+/, '');
  const filePath = path.resolve(baseDir, cleaned);
  if (!filePath.startsWith(baseDir)) return null;
  return filePath;
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';
  const stream = fs.createReadStream(filePath);
  res.writeHead(200, { 'Content-Type': contentType });
  stream.pipe(res);
  stream.on('error', () => {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  if (pathname.startsWith('/src/')) {
    const rel = pathname.slice('/src/'.length);
    const srcPath = safeResolve(srcDir, rel);
    if (srcPath && fs.existsSync(srcPath) && fs.statSync(srcPath).isFile()) {
      return sendFile(res, srcPath);
    }
  }

  const publicPath = safeResolve(publicDir, pathname === '/' ? 'index.html' : pathname);
  if (publicPath && fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
    return sendFile(res, publicPath);
  }

  const fallback = path.join(publicDir, 'index.html');
  if (fs.existsSync(fallback)) {
    return sendFile(res, fallback);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
});

server.listen(WEB_PORT, () => {
  console.log(`[web] NeuralHire Web v2 running at http://localhost:${WEB_PORT}`);
  console.log(`[web] Serving public: ${publicDir}`);
  console.log(`[web] Serving src: ${srcDir}`);
});
