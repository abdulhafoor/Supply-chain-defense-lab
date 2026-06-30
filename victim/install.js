const http = require('http');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

function download(url, out) {
  return new Promise((res, rej) => {
    const file = fs.createWriteStream(out);
    http.get(url, r => {
      r.pipe(file);
      file.on('finish', () => res(out));
    }).on('error', rej);
  });
}

function sha256(filePath) {
  const h = crypto.createHash('sha256');
  const data = fs.readFileSync(filePath);
  h.update(data);
  return h.digest('hex');
}

async function run() {
  const url = process.argv[2] || 'http://attacker:8080/packages/benign.tgz';
  const out = path.resolve(__dirname, 'downloads', 'pkg.tgz');
  if (!fs.existsSync(path.dirname(out))) fs.mkdirSync(path.dirname(out), { recursive: true });

  console.log('Downloading', url);
  await download(url, out);

  // Normalize observed hash to lowercase
  const observed = sha256(out).toLowerCase();

  // Normalize all expected hashes to lowercase
  const expectedHashes = (process.env.EXPECTED_HASHES || '')
    .split(',')
    .map(h => h.trim().toLowerCase());

  console.log('observed hash:', observed);

  if (!expectedHashes.includes(observed)) {
    console.log('HASH MISMATCH — posting alert');
    const payload = JSON.stringify({
      source: 'integrity-checker',
      event: 'hash_mismatch',
      package: url,
      expected: expectedHashes,
      observed,
      timestamp: new Date().toISOString()
    });

    const options = {
      hostname: 'monitor',
      port: 3001,
      path: '/alert',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        console.log(`Monitor responded with status ${res.statusCode}: ${body}`);
      });
    });

    req.on('error', e => console.error('alert post error', e));
    req.write(payload);
    req.end();
  } else {
    console.log('Hash OK');
  }
}

run().catch(e => console.error(e));
