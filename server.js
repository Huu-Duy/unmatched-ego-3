const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';
const BASE_DIR = __dirname;
const DB_PATH = path.join(BASE_DIR, 'database.json');

// Khởi tạo Database file nếu chưa có
function initDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    const initialData = {
      players: [
        { id: 1, name: "Player1", score: 100, level: 1, createdAt: new Date().toISOString() }
      ],
      gameSettings: {
        volume: 0.8,
        graphics: "high",
        autoSave: true
      },
      matchHistory: []
    };
    fs.writeFileSync(DB_PATH, JSON.stringify(initialData, null, 2), 'utf-8');
    console.log('[Database] Đã tạo database mới tại:', DB_PATH);
  } else {
    console.log('[Database] Đã kết nối cơ sở dữ liệu database.json hiện có.');
  }
}

function getDatabase() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
  } catch (e) {
    return {};
  }
}

function saveDatabase(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Database Error] Không thể ghi file:', err.message);
  }
}

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.wasm': 'application/wasm',
  '.data': 'application/octet-stream',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

initDatabase();

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    return res.end();
  }

  let urlObj;
  try {
    urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch (e) {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    return res.end('Bad Request');
  }

  let pathname = urlObj.pathname;

  // 1. HEALTH CHECK ENDPOINT (Dành cho Render / Cloud Monitoring)
  if (pathname === '/healthz' || pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
  }

  // 2. API DATABASE ENDPOINTS
  if (pathname === '/api/database' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(getDatabase(), null, 2));
  }

  if (pathname === '/api/save' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const db = getDatabase();
        db.lastSave = payload;
        db.lastSavedAt = new Date().toISOString();
        saveDatabase(db);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'success', message: 'Dữ liệu đã được lưu vào database.json' }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'error', error: err.message }));
      }
    });
    return;
  }

  // 3. STATIC FILES SERVING (Game WebGL Files)
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const safePath = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(BASE_DIR, safePath);

  // Kiểm tra file có tồn tại không
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Mock API fallback nếu Unity gửi request tới API ngoài
      if (pathname.startsWith('/api') || pathname.includes('sdk') || pathname.includes('crazygames')) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'mock_ok' }));
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end(`404 Not Found: ${pathname}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    let contentType = MIME_TYPES[ext] || 'application/octet-stream';

    // Xử lý các file .br nếu request bằng tên gốc
    if (ext === '.br') {
      if (filePath.includes('.wasm.')) contentType = 'application/wasm';
      else if (filePath.includes('.js.')) contentType = 'application/javascript; charset=utf-8';
      else if (filePath.includes('.data.')) contentType = 'application/octet-stream';
    }

    // Tối ưu cache: File trong Build/ được cache vĩnh viễn giúp client load tức thì
    const isBuildAsset = pathname.startsWith('/Build/');
    const headers = {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': isBuildAsset ? 'public, max-age=31536000, immutable' : 'no-cache'
    };

    res.writeHead(200, headers);

    const readStream = fs.createReadStream(filePath);
    
    // Ngăn chặn server crash khi client đóng kết nối giữa chừng (ví dụ đóng tab lúc tải 56MB)
    readStream.on('error', (streamErr) => {
      console.error('[Stream Error]:', streamErr.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end();
    });

    res.on('close', () => {
      readStream.destroy();
    });

    readStream.pipe(res);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`====================================================`);
  console.log(`  🎮 SERVER & DATABASE GAME UNMATCHED EGO 2`);
  console.log(`====================================================`);
  console.log(`  🌐 Port:         ${PORT}`);
  console.log(`  🌐 Host:         ${HOST}`);
  console.log(`  💾 Database API: /api/database`);
  console.log(`  📁 Thư mục game: ${BASE_DIR}`);
  console.log(`====================================================`);
});
