const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const https = require('https');

// --- Daily log file helper ---
function getLogFile() {
  const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return path.resolve(__dirname, `alerts-${date}.log`);
}

// --- Save alert into JSON file for persistence ---
function saveAlert(alert) {
  const dbFile = path.resolve(__dirname, 'alerts.json');
  let alerts = [];
  if (fs.existsSync(dbFile)) {
    alerts = JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
  }
  alerts.push({
    timestamp: new Date().toISOString(),
    event: alert.event,
    package: alert.package,
    expected: alert.expected,
    observed: alert.observed,
    severity: alert.severity || 'INFO'
  });
  fs.writeFileSync(dbFile, JSON.stringify(alerts, null, 2));
}

// --- Send alert to Slack/Teams via webhook ---
function sendToWebhook(alert, webhookUrl) {
  if (!webhookUrl) return;
  const payload = JSON.stringify({
    text: `ALERT: ${alert.event} (${alert.severity || 'INFO'})\nPackage: ${alert.package}\nObserved: ${alert.observed}`
  });

  const url = new URL(webhookUrl);
  const options = {
    hostname: url.hostname,
    path: url.pathname + url.search,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  };

  const req = https.request(options);
  req.write(payload);
  req.end();
}

// --- Parse log entries ---
function parseEntries(data) {
  return data.trim().split('\n\n').map(block => {
    const lines = block.split('\n');
    let timestamp = null;
    if (lines[0].startsWith('[')) {
      const endBracket = lines[0].indexOf(']');
      if (endBracket !== -1) {
        timestamp = lines[0].substring(1, endBracket);
      }
    }

    // Extract severity from the first line
    let severity = 'INFO';
    const severityMatch = lines[0].match(/\((.*?)\)/);
    if (severityMatch) {
      severity = severityMatch[1];
    }

    return {
      timestamp,
      event: lines[0].split('ALERT: ')[1]?.split(' (')[0],
      package: lines[1]?.replace('  Package: ', ''),
      expected: lines[2]?.replace('  Expected: ', ''),
      observed: lines[3]?.replace('  Observed: ', ''),
      severity
    };
  });
}

// --- HTTP server ---
const server = http.createServer((req, res) => {
  // --- Global CORS headers ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/alert') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const alert = JSON.parse(body);
        const entry = `[${new Date().toISOString()}] ALERT: ${alert.event} (${alert.severity || 'INFO'})\n` +
                      `  Package: ${alert.package}\n` +
                      `  Expected: ${Array.isArray(alert.expected) ? alert.expected.join(', ') : alert.expected}\n` +
                      `  Observed: ${alert.observed}\n\n`;

        fs.appendFileSync(getLogFile(), entry);
        saveAlert(alert);
        sendToWebhook(alert, process.env.SLACK_WEBHOOK_URL);
        sendToWebhook(alert, process.env.TEAMS_WEBHOOK_URL);

        console.log('Alert logged:\n' + entry);
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('Alert received and logged');
      } catch (e) {
        console.error('Error processing alert:', e);
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Invalid alert payload');
      }
    });
  } else if (req.method === 'GET' && req.url.startsWith('/alerts/recent')) {
    const logFile = getLogFile();
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const limit = parseInt(urlObj.searchParams.get('limit') || '10', 10);

    if (fs.existsSync(logFile)) {
      const data = fs.readFileSync(logFile, 'utf-8');
      const entries = parseEntries(data);
      const recent = entries.slice(-limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ alerts: recent }, null, 2));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('No alerts today');
    }
  } else if (req.method === 'GET' && req.url.startsWith('/alerts/latest')) {
    const logFile = getLogFile();
    if (fs.existsSync(logFile)) {
      const data = fs.readFileSync(logFile, 'utf-8');
      const entries = parseEntries(data);
      const latest = entries[entries.length - 1];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(latest, null, 2));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('No alerts today');
    }
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

server.listen(3001, () => {
  console.log('Monitor listening on port 3001');
});
