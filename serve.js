#!/usr/bin/env node

const https = require('https');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const PORT = parseInt(process.argv[2] || '8443', 10);
const DIR = __dirname;

// Generate self-signed cert on the fly
function generateCert() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });

  const cert = crypto.X509Certificate ? selfSign() : null;
  if (cert) return cert;

  // Fallback: use openssl if available
  const { execSync } = require('child_process');
  const keyFile = path.join(os.tmpdir(), 'hs-dev-key.pem');
  const certFile = path.join(os.tmpdir(), 'hs-dev-cert.pem');

  execSync(
    `openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 ` +
    `-keyout ${keyFile} -out ${certFile} -days 1 -nodes ` +
    `-subj "/CN=localhost" 2>/dev/null`
  );

  return {
    key: fs.readFileSync(keyFile),
    cert: fs.readFileSync(certFile),
  };
}

function selfSign() {
  // Node 19+ has built-in X509 cert creation — but most installs don't
  // So we always use the openssl fallback
  return null;
}

// MIME types
const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
};

function getLocalIP() {
  const nets = os.networkInterfaces();
  for (const iface of Object.values(nets)) {
    for (const addr of iface) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address;
    }
  }
  return '0.0.0.0';
}

const { key, cert } = generateCert();

const server = https.createServer({ key, cert }, (req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';

  const filePath = path.join(DIR, url);

  // Block path traversal
  if (!filePath.startsWith(DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    const mime = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': mime,
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('');
  console.log('  Handstand dev server running');
  console.log('');
  console.log(`  Local:   https://localhost:${PORT}`);
  console.log(`  Phone:   https://${ip}:${PORT}`);
  console.log('');
  console.log('  (Accept the self-signed cert warning on your phone)');
  console.log('');
});
