/**
 * Google Drive upload service.
 * Uses OAuth2 with the owner's Gmail account (DRIVE_CLIENT_ID / DRIVE_CLIENT_SECRET /
 * DRIVE_REFRESH_TOKEN), falling back to the service account.
 * Uploads a file buffer to DRIVE_FOLDER_ID and returns a shareable link.
 */

const { google } = require('googleapis');
const { Readable } = require('stream');
const path = require('path');
const fs = require('fs');

let driveClient = null;

async function getClient() {
  if (driveClient) return driveClient;

  const folderId = process.env.DRIVE_FOLDER_ID;
  if (!folderId || folderId === 'your_drive_folder_id') {
    console.warn('Google Drive: DRIVE_FOLDER_ID not configured.');
    return null;
  }

  let auth;
  if (process.env.DRIVE_CLIENT_ID && process.env.DRIVE_CLIENT_SECRET && process.env.DRIVE_REFRESH_TOKEN) {
    try {
      auth = new google.auth.OAuth2(
        process.env.DRIVE_CLIENT_ID,
        process.env.DRIVE_CLIENT_SECRET
      );
      auth.setCredentials({ refresh_token: process.env.DRIVE_REFRESH_TOKEN });
      console.log('Google Drive: using OAuth2 (owner Gmail account)');
    } catch (e) {
      console.error('Google Drive: failed to init OAuth2 —', e.message);
      return null;
    }
  } else if (process.env.GOOGLE_CREDENTIALS_JSON) {
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/drive.file']
      });
      console.log('Google Drive: using service account (GOOGLE_CREDENTIALS_JSON)');
    } catch (e) {
      console.error('Google Drive: failed to parse GOOGLE_CREDENTIALS_JSON —', e.message);
      return null;
    }
  } else {
    const credPath = path.resolve(process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json');
    if (!fs.existsSync(credPath)) {
      console.warn('Google Drive: credentials not found at', credPath);
      return null;
    }
    auth = new google.auth.GoogleAuth({
      keyFile: credPath,
      scopes: ['https://www.googleapis.com/auth/drive.file']
    });
    console.log('Google Drive: using credentials file at', credPath);
  }

  try {
    const isOAuth = auth instanceof google.auth.OAuth2;
    const authClient = isOAuth ? auth : await auth.getClient();
    driveClient = google.drive({ version: 'v3', auth: authClient });
    console.log('Google Drive: client initialized successfully');
    return driveClient;
  } catch (e) {
    console.error('Google Drive: auth failed —', e.message);
    return null;
  }
}

/**
 * Upload a file buffer to Google Drive.
 * @param {Buffer} buffer       - File content
 * @param {string} originalName - Original filename (e.g., "screenshot.png")
 * @param {string} mimeType     - MIME type (e.g., "image/png")
 * @param {string} personName   - Registrant name, used to prefix the filename in Drive
 * @param {string} regNumber    - Register number, used to prefix the filename in Drive
 * @returns {Promise<string>}   - Shareable Google Drive view link
 */
async function uploadFile(buffer, originalName, mimeType, personName, regNumber) {
  const client = await getClient();
  if (!client) {
    throw new Error('Google Drive not configured. Cannot upload file.');
  }

  const folderId = process.env.DRIVE_FOLDER_ID;

  const safeName = (personName || 'registrant').replace(/[^a-zA-Z0-9 _-]/g, '').trim();
  const safeReg = (regNumber || '').replace(/[^a-zA-Z0-9]/g, '').trim();
  const ext = path.extname(originalName) || '';
  const driveFileName = safeReg ? `${safeName}_${safeReg}_txn_ss${ext}` : `${safeName}_txn_ss${ext}`;

  const readableStream = new Readable();
  readableStream.push(buffer);
  readableStream.push(null);

  try {
    const response = await client.files.create({
      requestBody: {
        name: driveFileName,
        parents: [folderId]
      },
      media: {
        mimeType,
        body: readableStream
      },
      fields: 'id'
    });

    const fileId = response.data.id;

    // Make file readable by anyone with the link
    await client.permissions.create({
      fileId,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    const viewLink = `https://drive.google.com/file/d/${fileId}/view`;
    console.log(`Drive: uploaded "${driveFileName}" → ${viewLink}`);
    return viewLink;
  } catch (e) {
    console.error('Drive upload error:', e.message);
    throw e;
  }
}

module.exports = { uploadFile };
