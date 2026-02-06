const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;

// Determine paths for packaged executable vs development
const isPkg = typeof process.pkg !== 'undefined';

// staticBase: Immutable application files (HTML, JS, CSS)
// In development: current directory
// In pkg: snapshot filesystem (inside the exe)
const staticBase = __dirname;

// dataBase: Mutable user data
// In development: current directory
// In pkg: The directory where the executable is located (external to the exe)
const dataBase = isPkg ? path.dirname(process.execPath) : __dirname;

console.log(`Server starting...`);
console.log(`Static Base (App): ${staticBase}`);
console.log(`Data Base (User): ${dataBase}`);

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

const server = http.createServer(function (request, response) {
  console.log('request ', request.url);

  // Handle CORS
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Request-Method', '*');
  response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
  response.setHeader('Access-Control-Allow-Headers', '*');

  if (request.method === 'OPTIONS') {
    response.writeHead(200);
    response.end();
    return;
  }

  // Handle data saving endpoint
  if (request.url.startsWith('/api/save') && request.method === 'POST') {
    let body = '';
    request.on('data', chunk => {
      body += chunk.toString();
    });
    request.on('end', () => {
      try {
        const data = JSON.parse(body);
        
        // Determine target file path in the external data directory
        let targetSubPath = '/data.json'; // Default legacy
        const parts = request.url.split('/');
        
        if (parts.length > 3) {
            const tableName = parts[3];
            if (/^[a-zA-Z0-9_]+$/.test(tableName)) {
                targetSubPath = `/data/${tableName}.json`;
            } else {
                response.writeHead(400, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: false, error: 'Invalid table name' }));
                return;
            }
        }

        // Construct absolute path using dataBase (ensures writing to disk, not inside exe)
        const targetFile = path.join(dataBase, targetSubPath);
        const targetDir = path.dirname(targetFile);

        // Ensure directory exists
        if (!fs.existsSync(targetDir)) {
            try {
                fs.mkdirSync(targetDir, { recursive: true });
            } catch (err) {
                console.error('Error creating directory:', err);
                response.writeHead(500, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify({ success: false, error: 'Failed to create directory' }));
                return;
            }
        }

        // Write to file
        fs.writeFile(targetFile, JSON.stringify(data, null, 4), 'utf8', (err) => {
          if (err) {
            console.error(`Error writing to ${targetFile}:`, err);
            response.writeHead(500, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: false, error: err.message }));
          } else {
            console.log(`Successfully saved data to ${targetFile}`);
            response.writeHead(200, { 'Content-Type': 'application/json' });
            response.end(JSON.stringify({ success: true }));
          }
        });
      } catch (e) {
        console.error('Invalid JSON received:', e);
        response.writeHead(400, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
      }
    });
    return;
  }

  // Handle File Serving
  let urlPath = request.url.split('?')[0];
  if (urlPath === '/') {
    urlPath = '/index.html';
  }

  // Prevent directory traversal
  if (urlPath.includes('..')) {
      response.writeHead(403);
      response.end('Forbidden');
      return;
  }

  // Strategy: 
  // 1. If requesting /data/..., try to serve from dataBase (external disk) first.
  // 2. Fallback to staticBase (bundled assets).
  
  let servePath = null;
  
  if (urlPath.startsWith('/data/')) {
      const externalPath = path.join(dataBase, urlPath);
      if (fs.existsSync(externalPath)) {
          servePath = externalPath;
      }
  }

  if (!servePath) {
      servePath = path.join(staticBase, urlPath);
  }

  const extname = String(path.extname(servePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(servePath, function(error, content) {
    if (error) {
      if(error.code == 'ENOENT') {
        response.writeHead(404, { 'Content-Type': 'text/plain' });
        response.end('404 Not Found: ' + urlPath, 'utf-8');
      } else {
        response.writeHead(500);
        response.end('Server Error: '+error.code);
      }
    } else {
      // Disable caching for development/real-time updates
      response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.setHeader('Pragma', 'no-cache');
      response.setHeader('Expires', '0');
      
      response.writeHead(200, { 'Content-Type': contentType });
      response.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://127.0.0.1:${PORT}/`);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.log(`Port ${PORT} is in use, retrying on ${PORT + 1}...`);
    server.close();
    server.listen(PORT + 1);
  } else {
    console.error(e);
  }
});