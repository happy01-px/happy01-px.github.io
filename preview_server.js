const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const HOST = '127.0.0.1';
const MAX_BODY_SIZE = 10 * 1024 * 1024;
const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost']);
const LOCAL_REMOTE_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
let currentPort = PORT;

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
  '.woff2': 'font/woff2',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

function isLocalHostname(hostname) {
  return LOCAL_HOSTNAMES.has(hostname);
}

function getHostnameFromHeader(value) {
  if (!value) return null;

  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

function isLocalRequest(request) {
  const remoteAddress = request.socket.remoteAddress;
  if (remoteAddress && !LOCAL_REMOTE_ADDRESSES.has(remoteAddress)) {
    return false;
  }

  const hostHeader = request.headers.host;
  if (hostHeader) {
    const hostName = hostHeader.split(':')[0];
    if (!isLocalHostname(hostName)) {
      return false;
    }
  }

  const originHostname = getHostnameFromHeader(request.headers.origin);
  if (request.headers.origin && !originHostname) {
    return false;
  }
  if (originHostname && !isLocalHostname(originHostname)) {
    return false;
  }

  const refererHostname = getHostnameFromHeader(request.headers.referer);
  if (request.headers.referer && !refererHostname) {
    return false;
  }
  if (refererHostname && !isLocalHostname(refererHostname)) {
    return false;
  }

  return true;
}

function applyCorsHeaders(request, response) {
  const origin = request.headers.origin;
  const originHostname = getHostnameFromHeader(origin);

  if (origin && originHostname && isLocalHostname(originHostname)) {
    response.setHeader('Access-Control-Allow-Origin', origin);
    response.setHeader('Vary', 'Origin');
  }

  response.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function getResponseContentType(contentType) {
  if (
    contentType.startsWith('text/') ||
    contentType === 'application/json' ||
    contentType === 'text/javascript' ||
    contentType === 'image/svg+xml'
  ) {
    return `${contentType}; charset=utf-8`;
  }

  return contentType;
}

const server = http.createServer(function (request, response) {
  console.log('request ', request.method, request.url);

  if (!isLocalRequest(request)) {
    response.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Forbidden');
    return;
  }

  applyCorsHeaders(request, response);

  if (request.method === 'OPTIONS') {
    response.writeHead(204);
    response.end();
    return;
  }

  if (!['GET', 'POST'].includes(request.method)) {
    response.writeHead(405, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Method Not Allowed');
    return;
  }

  // Handle data saving endpoint
  if (request.url.startsWith('/api/save') && request.method === 'POST') {
    let body = '';
    let bodyTooLarge = false;
    request.on('data', chunk => {
      if (bodyTooLarge) return;
      body += chunk.toString();
      if (body.length > MAX_BODY_SIZE) {
        bodyTooLarge = true;
        response.writeHead(413, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ success: false, error: 'Payload too large' }));
        request.destroy();
      }
    });
    request.on('end', () => {
      if (bodyTooLarge) return;

      try {
        const data = JSON.parse(body);
        
        // Determine target file path in the external data directory
        let targetFile = path.join(dataBase, 'data.json'); // Default legacy
        const parts = request.url.split('/');
        
        if (parts.length > 3) {
            const tableName = parts[3];
            if (/^[a-zA-Z0-9_]+$/.test(tableName)) {
                targetFile = path.join(dataBase, 'data', `${tableName}.json`);
            } else {
                response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
                response.end(JSON.stringify({ success: false, error: 'Invalid table name' }));
                return;
            }
        }

        const targetDir = path.dirname(targetFile);

        // Ensure directory exists
        if (!fs.existsSync(targetDir)) {
            try {
                fs.mkdirSync(targetDir, { recursive: true });
            } catch (err) {
                console.error('Error creating directory:', err);
                response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
                response.end(JSON.stringify({ success: false, error: 'Failed to create directory' }));
                return;
            }
        }

        // Write to file
        fs.writeFile(targetFile, JSON.stringify(data, null, 4), 'utf8', (err) => {
          if (err) {
            console.error(`Error writing to ${targetFile}:`, err);
            response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            response.end(JSON.stringify({ success: false, error: err.message }));
          } else {
            console.log(`Successfully saved data to ${targetFile}`);
            response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            response.end(JSON.stringify({ success: true }));
          }
        });
      } catch (e) {
        console.error('Invalid JSON received:', e);
        response.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
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
      const externalPath = path.join(dataBase, urlPath.replace(/^\/+/, ''));
      if (fs.existsSync(externalPath)) {
          servePath = externalPath;
      }
  }

  if (!servePath) {
      servePath = path.join(staticBase, urlPath.replace(/^\/+/, ''));
  }

  const extname = String(path.extname(servePath)).toLowerCase();
  const contentType = mimeTypes[extname] || 'application/octet-stream';

  fs.readFile(servePath, function(error, content) {
    if (error) {
      if(error.code == 'ENOENT') {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('404 Not Found: ' + urlPath, 'utf-8');
      } else {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Server Error: '+error.code);
      }
    } else {
      // Disable caching for development/real-time updates
      response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.setHeader('Pragma', 'no-cache');
      response.setHeader('Expires', '0');
      
      response.writeHead(200, { 'Content-Type': getResponseContentType(contentType) });
      response.end(content, 'utf-8');
    }
  });
});

server.listen(currentPort, HOST, () => {
  console.log(`Server running at http://${HOST}:${currentPort}/`);
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    const nextPort = currentPort + 1;
    console.log(`Port ${currentPort} is in use, retrying on ${nextPort}...`);
    server.close();
    currentPort = nextPort;
    server.listen(currentPort, HOST, () => {
      console.log(`Server running at http://${HOST}:${currentPort}/`);
    });
  } else {
    console.error(e);
  }
});
