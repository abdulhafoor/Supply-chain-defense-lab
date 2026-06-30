const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  const filePath = path.join(__dirname, 'packages', req.url.split('/').pop());
  if (fs.existsSync(filePath)) {
    res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
    fs.createReadStream(filePath).pipe(res);
  } else {
    res.writeHead(404);
    res.end('Package not found');
  }
});

server.listen(8080, () => console.log('Attacker package server on :8080'));
