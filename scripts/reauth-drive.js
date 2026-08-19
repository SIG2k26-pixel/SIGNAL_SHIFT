/**
 * Re-authorize Google OAuth2 to get a new refresh token.
 * 
 * Usage:
 *   1. Set your CLIENT_ID and CLIENT_SECRET below (from Vercel env vars)
 *   2. Run: node scripts/reauth-drive.js
 *   3. Open the URL it prints in your browser
 *   4. Sign in with the Google account that owns the Drive folder
 *   5. Copy the authorization code from the redirect URL
 *   6. Paste it back in the terminal
 *   7. Copy the new refresh token to Vercel env vars
 */

const http = require('http');
const https = require('https');
const url = require('url');

// ══════════════════════════════════════════════════════════════
// PASTE YOUR VALUES HERE (from Vercel → Settings → Env Vars)
// ══════════════════════════════════════════════════════════════
const CLIENT_ID = process.env.DRIVE_CLIENT_ID || 'YOUR_CLIENT_ID_HERE';
const CLIENT_SECRET = process.env.DRIVE_CLIENT_SECRET || 'YOUR_CLIENT_SECRET_HERE';
// ══════════════════════════════════════════════════════════════

const REDIRECT_URI = 'http://localhost:3333/callback';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

function buildAuthUrl() {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    access_type: 'offline',        // ensures we get a refresh_token
    prompt: 'consent'              // forces consent screen to get new refresh_token
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
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  if (CLIENT_ID === 'YOUR_CLIENT_ID_HERE') {
    console.error('\n❌ Please set CLIENT_ID and CLIENT_SECRET in this script first.');
    console.error('   Find them in: Google Cloud Console → Credentials → OAuth 2.0 Client ID\n');
    process.exit(1);
  }

  const authUrl = buildAuthUrl();

  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  Google Drive OAuth2 Re-authorization');
  console.log('═══════════════════════════════════════════════════════\n');
  console.log('1. Open this URL in your browser:\n');
  console.log(`   ${authUrl}\n`);
  console.log('2. Sign in with the Google account that OWNS the Drive folder');
  console.log('3. Grant permission to access Google Drive');
  console.log('4. Copy the authorization code from the redirect URL\n');

  // Start local server to catch the redirect
  const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);

    if (parsed.pathname === '/callback' && parsed.query.code) {
      const code = parsed.query.code;

      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <html><body style="font-family:Arial;text-align:center;padding:60px">
          <h2>✅ Authorization successful!</h2>
          <p>You can close this tab and return to the terminal.</p>
        </body></html>
      `);

      server.close();

      try {
        console.log('   Exchanging authorization code for tokens...\n');
        const tokens = await exchangeCode(code);

        if (tokens.refresh_token) {
          console.log('═══════════════════════════════════════════════════════');
          console.log('  ✅ NEW REFRESH TOKEN OBTAINED');
          console.log('═══════════════════════════════════════════════════════\n');
          console.log('  Copy this to Vercel → Settings → Env Vars → DRIVE_REFRESH_TOKEN:\n');
          console.log(`  ${tokens.refresh_token}\n`);
          console.log('  Access token (expires in ~1 hour, auto-refreshed):');
          console.log(`  ${tokens.access_token}\n`);
          console.log('═══════════════════════════════════════════════════════');
        } else {
          console.log('⚠️  No refresh_token in response. This can happen if:');
          console.log('   - You already authorized this app before');
          console.log('   - The app is in "Production" mode\n');
          console.log('  Full response:', JSON.stringify(tokens, null, 2));
        }
      } catch (err) {
        console.error('❌ Token exchange failed:', err.message);
      }
    } else {
      res.writeHead(404);
      res.end('Waiting for OAuth callback...');
    }
  });

  server.listen(3333, () => {
    console.log('   (Local callback server listening on port 3333)\n');
  });
}

main();
