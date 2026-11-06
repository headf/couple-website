const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'memories.json');
const SETTINGS_FILE = path.join(__dirname, 'data', 'settings.json');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Load data
function loadData(filePath, fallback) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading data:', e.message);
  }
  return fallback;
}

function saveData(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// Initialize with defaults if not exist
if (!fs.existsSync(DATA_FILE)) {
  saveData(DATA_FILE, []);
}
if (!fs.existsSync(SETTINGS_FILE)) {
  saveData(SETTINGS_FILE, {
    anniversaryDate: '',
    partner1: '👦 男朋友',
    partner2: '👧 女朋友',
  });
}

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // ========== API Routes ==========

  // GET /api/memories
  if (pathname === '/api/memories' && req.method === 'GET') {
    const memories = loadData(DATA_FILE, []);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(memories));
    return;
  }

  // POST /api/memories
  if (pathname === '/api/memories' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const memory = JSON.parse(body);
        memory.id = Date.now().toString(36) + Math.random().toString(36).substr(2, 6);
        memory.createdAt = new Date().toISOString();
        const memories = loadData(DATA_FILE, []);
        memories.unshift(memory);
        saveData(DATA_FILE, memories);
        res.writeHead(201, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, memory }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // PUT /api/memories/:id
  const putMatch = pathname.match(/^\/api\/memories\/(.+)$/);
  if (putMatch && req.method === 'PUT') {
    const id = putMatch[1];
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const updates = JSON.parse(body);
        const memories = loadData(DATA_FILE, []);
        const idx = memories.findIndex(m => m.id === id);
        if (idx === -1) {
          res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: false, error: 'Not found' }));
          return;
        }
        memories[idx] = { ...memories[idx], ...updates, id: memories[idx].id, createdAt: memories[idx].createdAt };
        saveData(DATA_FILE, memories);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, memory: memories[idx] }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // DELETE /api/memories/:id
  const delMatch = pathname.match(/^\/api\/memories\/(.+)$/);
  if (delMatch && req.method === 'DELETE') {
    const id = delMatch[1];
    const memories = loadData(DATA_FILE, []);
    const filtered = memories.filter(m => m.id !== id);
    if (filtered.length === memories.length) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: 'Not found' }));
      return;
    }
    saveData(DATA_FILE, filtered);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // GET /api/settings
  if (pathname === '/api/settings' && req.method === 'GET') {
    const settings = loadData(SETTINGS_FILE, {});
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(settings));
    return;
  }

  // PUT /api/settings
  if (pathname === '/api/settings' && req.method === 'PUT') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const updates = JSON.parse(body);
        const current = loadData(SETTINGS_FILE, {});
        const merged = { ...current, ...updates };
        saveData(SETTINGS_FILE, merged);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, settings: merged }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: e.message }));
      }
    });
    return;
  }

  // ========== Static Files ==========
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);

  // Security: prevent directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // SPA fallback: serve index.html for unknown routes
        fs.readFile(path.join(__dirname, 'index.html'), (err2, data2) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not Found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(data2);
        });
      } else {
        res.writeHead(500);
        res.end('Internal Server Error');
      }
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  const networkInterfaces = require('os').networkInterfaces();
  console.log('');
  console.log('💕  情侣回忆录服务器已启动！');
  console.log('══════════════════════════════════════');
  console.log('');
  console.log('📍  本机访问:');
  console.log(`    http://localhost:${PORT}`);
  console.log('');

  // Show LAN addresses
  Object.keys(networkInterfaces).forEach(name => {
    networkInterfaces[name].forEach(iface => {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log('🌐  局域网访问 (其他电脑):');
        console.log(`    http://${iface.address}:${PORT}`);
        console.log('');
      }
    });
  });

  console.log('📂  数据存储位置:');
  console.log(`    ${DATA_FILE}`);
  console.log('');
  console.log('按 Ctrl+C 停止服务器');
  console.log('══════════════════════════════════════');
  console.log('');
});
