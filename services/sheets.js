const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

let sheetsClient = null;
let spreadsheetId = null;
const RANGE = 'Sheet1';

// Column mapping (matches Sheet1 header row)
// A: Timestamp, B: Name, C: Reg No, D: Email, E: Phone, F: Department, G: College, H: Team, I: Txn ID
const FIELD_COL = {
  regNumber: 2,   // Column C (0-indexed in row array)
  email: 3,
  transactionId: 8
};

async function getClient() {
  if (sheetsClient) return sheetsClient;

  spreadsheetId = process.env.SPREADSHEET_ID;
  if (!spreadsheetId || spreadsheetId === 'your_spreadsheet_id_here') {
    console.warn('Google Sheets: SPREADSHEET_ID not configured.');
    return null;
  }

  // Support credentials from env variable (for deployment) or file path
  let auth;
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
  } else {
    const credPath = path.resolve(process.env.GOOGLE_CREDENTIALS_PATH || './credentials.json');
    if (!fs.existsSync(credPath)) {
      console.warn('Google Sheets: credentials not found at', credPath);
      return null;
    }
    auth = new google.auth.GoogleAuth({
      keyFile: credPath,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
  }

  const authClient = await auth.getClient();
  sheetsClient = google.sheets({ version: 'v4', auth: authClient });
  return sheetsClient;
}

// Fetch all rows from the sheet (cached for 5 seconds to avoid excessive API calls)
let rowsCache = null;
let cacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds

async function fetchAllRows() {
  const now = Date.now();
  if (rowsCache && (now - cacheTime) < CACHE_TTL) return rowsCache;

  const client = await getClient();
  if (!client) return [];

  try {
    const res = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `${RANGE}!A:I`
    });
    const rows = res.data.values || [];
    // Skip header row (first row)
    rowsCache = rows.length > 1 ? rows.slice(1) : [];
    cacheTime = now;
    return rowsCache;
  } catch (e) {
    console.error('Sheets fetch error:', e.message);
    return [];
  }
}

// Invalidate cache after writes
function invalidateCache() {
  rowsCache = null;
  cacheTime = 0;
}

// Check for duplicate value in a specific field
async function checkDuplicate(field, value) {
  const colIndex = FIELD_COL[field];
  if (colIndex === undefined) return false;

  const rows = await fetchAllRows();
  return rows.some(row =>
    row[colIndex] && String(row[colIndex]).toLowerCase() === String(value).toLowerCase()
  );
}

// Add a new registration row
async function addRegistration(data) {
  const client = await getClient();
  if (!client) {
    throw new Error('Google Sheets not configured. Cannot save registration.');
  }

  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const values = [[
    timestamp,
    data.fullName,
    data.regNumber,
    data.email,
    data.phone,
    data.department,
    data.college,
    data.teamName,
    data.transactionId
  ]];

  try {
    await client.spreadsheets.values.append({
      spreadsheetId,
      range: `${RANGE}!A:I`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values }
    });
    invalidateCache();
    console.log('Sheets: registration saved for', data.fullName);
  } catch (e) {
    console.error('Sheets append error:', e.message);
    throw e;
  }
}

// Get all registrations for admin dashboard
async function getAllRegistrations() {
  const rows = await fetchAllRows();
  return rows.map(row => ({
    timestamp: row[0] || '',
    fullName: row[1] || '',
    regNumber: row[2] || '',
    email: row[3] || '',
    phone: row[4] || '',
    department: row[5] || '',
    college: row[6] || '',
    teamName: row[7] || '',
    transactionId: row[8] || ''
  }));
}

module.exports = { addRegistration, checkDuplicate, getAllRegistrations };
