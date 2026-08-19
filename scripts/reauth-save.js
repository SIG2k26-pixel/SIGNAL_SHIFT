/**
 * Re-authorize Google OAuth2 and SAVE the new refresh token to a file.
 * Usage:
 *   1. Set DRIVE_CLIENT_ID and DRIVE_CLIENT_SECRET env vars
 *   2. Run: node scripts/reauth-save.js
 *   3. Open the printed URL, authorize, then wait for the file to appear
 */

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const os = require('os');

const CLIENT_ID = process.env.DRIVE_CLIENT_ID;
const CLIENT_SECRET = process.env.DRIVE_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3333/callback';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];
const OUT_FILE = path.join(os.tmpdir(), 'signal-shift-refresh-token.txt');

function buildAuthUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',
    prompt: 'consent'
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

async function exchangeCode(code) {
  const postData = new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code'
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error(`Parse error: ${data}`)); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  if (parsed.pathname === '/callback' && parsed.query.code) {
    const code = parsed.query.code;
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`<html><body style="font-family:Arial;text-align:center;padding:60px">
      <h2>✅ Authorization successful! You can close this tab.</h2></body></html>`);
    server.close();
    try {
      const tokens = await exchangeCode(code);
      if (tokens.refresh_token) {
        fs.writeFileSync(OUT_FILE, tokens.refresh_token, 'utf8');
        console.log('✅ REFRESH TOKEN SAVED TO:', OUT_FILE);
      } else {
        console.log('⚠️ No refresh_token returned:', JSON.stringify(tokens, null, 2));
      }
    } catch (e) {
      console.error('❌ Token exchange failed:', e.message);
    }
  } else {
    res.writeHead(404);
    res.end('Waiting for callback...');
  }
});

server.listen(3333, () => {
  console.log('Open this URL in your browser and authorize:');
  console.log(buildAuthUrl());
  console.log('\nWaiting for callback...');
});

setTimeout(() => { console.log('(timeout after 300s)'); process.exit(1); }, 300000);
