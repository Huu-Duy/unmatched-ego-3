const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
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
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
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

  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  let pathname = urlObj.pathname;

  // 1. API DATABASE ENDPOINTS
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

  // 2. STATIC FILES SERVING (Game Files)
  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = path.join(BASE_DIR, decodeURIComponent(pathname));

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

    const headers = {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    };

    res.writeHead(200, headers);
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  🎮 SERVER & DATABASE GAME UNMATCHED EGO 2`);
  console.log(`====================================================`);
  console.log(`  🌐 Game URL:     http://localhost:${PORT}`);
  console.log(`  💾 Database API: http://localhost:${PORT}/api/database`);
  console.log(`  📁 Thư mục game: ${BASE_DIR}`);
  console.log(`  👉 Mở trình duyệt và truy cập: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
