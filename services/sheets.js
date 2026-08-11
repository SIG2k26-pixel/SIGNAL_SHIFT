const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

let sheetsClient = null;
let spreadsheetId = null;
const SHEET1 = 'Sheet1';       // Existing sheet — READ ONLY (duplicate checks only)
const SHEET2 = 'Sheet2';       // New sheet — all form submissions are written here
const TEAM_CODE_SHEET = 'TeamCodes';

// Column mapping for Sheet1 duplicate checks (0-indexed in row array)
// Sheet1: A: Timestamp, B: Name, C: Reg No, D: Email, E: Phone, F: Department, G: College, H: Team, I: Txn ID
const SHEET1_FIELD_COL = {
  regNumber: 2,     // Column C
  email: 3,         // Column D
  transactionId: 8  // Column I
};

// Sheet2 columns (0-indexed) — same layout + Team Code in column J
// A: Timestamp, B: Name, C: Reg No, D: Email, E: Phone, F: Department, G: College, H: Team, I: Txn ID, J: Team Code
const SHEET2_FIELD_COL = {
  regNumber: 2,
  email: 3,
  transactionId: 8
};

// TeamCodes sheet columns (0-indexed)
// A: Code, B: UsageCount, C: MaxUses, D: CreatedAt
const TC_CODE_COL = 0;
const TC_USAGE_COL = 1;
const TC_MAX_COL = 2;
const TC_CREATED_COL = 3;

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
    try {
      const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
      // Fix: Render env vars turn \n into literal \\n in private_key — fix it back
      if (credentials.private_key) {
        credentials.private_key = credentials.private_key.replace(/\\n/g, '\n');
      }
      auth = new google.auth.GoogleAuth({
        credentials,
        scopes: ['https://www.googleapis.com/auth/spreadsheets']
      });
      console.log('Google Sheets: using GOOGLE_CREDENTIALS_JSON env var');
    } catch (e) {
      console.error('Google Sheets: failed to parse GOOGLE_CREDENTIALS_JSON —', e.message);
      return null;
    }
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
    console.log('Google Sheets: using credentials file at', credPath);
  }

  try {
    const authClient = await auth.getClient();
    sheetsClient = google.sheets({ version: 'v4', auth: authClient });
    console.log('Google Sheets: client initialized successfully');
    return sheetsClient;
  } catch (e) {
    console.error('Google Sheets: auth failed —', e.message);
    return null;
  }
}


// ===== CACHES =====
let sheet1Cache = null; // Cache for Sheet1 (existing data — read-only)
let sheet1CacheTime = 0;
let sheet2Cache = null; // Cache for Sheet2 (new registrations)
let sheet2CacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds

// Helper: skip header row if detected
function skipHeader(rows) {
  if (rows.length === 0) return rows;
  const firstCell = String(rows[0][0] || '').toLowerCase();
  const isHeader = firstCell.includes('timestamp') || firstCell.includes('date') ||
                   firstCell.includes('name') || firstCell === 'a' || firstCell === '#';
  return isHeader ? rows.slice(1) : rows;
}

// Fetch all rows from Sheet1 (read-only — existing data, used for duplicate checks)
async function fetchSheet1Rows() {
  const now = Date.now();
  if (sheet1Cache && (now - sheet1CacheTime) < CACHE_TTL) return sheet1Cache;

  const client = await getClient();
  if (!client) return [];

  try {
    const res = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET1}!A:I`  // Only columns A-I (no Team Code in Sheet1)
    });
    sheet1Cache = skipHeader(res.data.values || []);
    sheet1CacheTime = now;
    return sheet1Cache;
  } catch (e) {
    console.error('Sheet1 fetch error:', e.message);
    return [];
  }
}

// Fetch all rows from Sheet2 (new registrations written by this app)
async function fetchSheet2Rows() {
  const now = Date.now();
  if (sheet2Cache && (now - sheet2CacheTime) < CACHE_TTL) return sheet2Cache;

  const client = await getClient();
  if (!client) return [];

  try {
    const res = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET2}!A:J`
    });
    sheet2Cache = skipHeader(res.data.values || []);
    sheet2CacheTime = now;
    return sheet2Cache;
  } catch (e) {
    // Sheet2 may not exist yet — that's fine
    console.warn('Sheet2 fetch warning (may not exist yet):', e.message);
    return [];
  }
}

// Invalidate both caches after writes
function invalidateCache() {
  sheet1Cache = null;
  sheet1CacheTime = 0;
  sheet2Cache = null;
  sheet2CacheTime = 0;
}

// Auto-initialize Sheet2 with a header row if it doesn't exist
async function initSheet2() {
  const client = await getClient();
  if (!client) return false;

  try {
    const res = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `${SHEET2}!A1:J1`
    });
    const rows = res.data.values || [];
    if (rows.length === 0) {
      // Sheet2 exists but empty — write header
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `${SHEET2}!A1:J1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['Timestamp', 'Full Name', 'Reg Number', 'Email', 'Phone', 'Department', 'College', 'Team Name', 'Transaction ID', 'Team Code']] }
      });
      console.log('Sheet2: header row initialized');
    }
    return true;
  } catch (e) {
    // Sheet2 doesn't exist — create it
    if (e.message && (e.message.includes('Unable to parse range') || e.message.includes('not found'))) {
      try {
        await client.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{ addSheet: { properties: { title: SHEET2 } } }]
          }
        });
        await client.spreadsheets.values.update({
          spreadsheetId,
          range: `${SHEET2}!A1:J1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [['Timestamp', 'Full Name', 'Reg Number', 'Email', 'Phone', 'Department', 'College', 'Team Name', 'Transaction ID', 'Team Code']] }
        });
        console.log('Sheet2: created and initialized with header row');
        return true;
      } catch (createErr) {
        console.error('Sheet2: failed to create —', createErr.message);
        return false;
      }
    }
    console.error('Sheet2: init error —', e.message);
    return false;
  }
}

// Check for duplicate value — checks BOTH Sheet1 (existing) and Sheet2 (new)
async function checkDuplicate(field, value) {
  // Check Sheet1 (existing data)
  const s1ColIndex = SHEET1_FIELD_COL[field];
  // Check Sheet2 (newly submitted data)
  const s2ColIndex = SHEET2_FIELD_COL[field];

  invalidateCache();

  const [sheet1Rows, sheet2Rows] = await Promise.all([fetchSheet1Rows(), fetchSheet2Rows()]);

  const normalizedValue = String(value).trim().toLowerCase();

  const inSheet1 = s1ColIndex !== undefined && sheet1Rows.some(row =>
    row[s1ColIndex] && String(row[s1ColIndex]).trim().toLowerCase() === normalizedValue
  );
  const inSheet2 = s2ColIndex !== undefined && sheet2Rows.some(row =>
    row[s2ColIndex] && String(row[s2ColIndex]).trim().toLowerCase() === normalizedValue
  );

  const isDup = inSheet1 || inSheet2;
  if (isDup) console.log(`Duplicate found: ${field} = ${value} (Sheet1: ${inSheet1}, Sheet2: ${inSheet2})`);
  return isDup;
}

// ===== TEAM CODES SHEET =====

// Auto-initialize TeamCodes sheet with header row if not already present
async function initTeamCodesSheet() {
  const client = await getClient();
  if (!client) return false;

  try {
    // Try to read the sheet — if it works, it exists
    const res = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `${TEAM_CODE_SHEET}!A1:D1`
    });
    const rows = res.data.values || [];
    if (rows.length === 0) {
      // Sheet exists but has no header — add it
      await client.spreadsheets.values.update({
        spreadsheetId,
        range: `${TEAM_CODE_SHEET}!A1:D1`,
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [['Code', 'UsageCount', 'MaxUses', 'CreatedAt']] }
      });
      console.log('TeamCodes: header row initialized');
    }
    return true;
  } catch (e) {
    // Sheet doesn't exist — create it
    if (e.message && (e.message.includes('Unable to parse range') || e.message.includes('not found'))) {
      try {
        await client.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [{
              addSheet: {
                properties: { title: TEAM_CODE_SHEET }
              }
            }]
          }
        });
        // Add header row
        await client.spreadsheets.values.update({
          spreadsheetId,
          range: `${TEAM_CODE_SHEET}!A1:D1`,
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [['Code', 'UsageCount', 'MaxUses', 'CreatedAt']] }
        });
        console.log('TeamCodes: sheet created and initialized');
        return true;
      } catch (createErr) {
        console.error('TeamCodes: failed to create sheet —', createErr.message);
        return false;
      }
    }
    console.error('TeamCodes: init error —', e.message);
    return false;
  }
}

// Fetch all rows from TeamCodes sheet (fresh — no cache for codes)
async function fetchTeamCodeRows() {
  const client = await getClient();
  if (!client) return [];

  try {
    const res = await client.spreadsheets.values.get({
      spreadsheetId,
      range: `${TEAM_CODE_SHEET}!A:D`
    });
    const rows = res.data.values || [];
    if (rows.length === 0) return [];
    // Skip header row
    const firstCell = String(rows[0][TC_CODE_COL] || '').toLowerCase();
    return firstCell === 'code' ? rows.slice(1) : rows;
  } catch (e) {
    console.error('TeamCodes fetch error:', e.message);
    return [];
  }
}

// Check team code validity and increment usage count if valid
// Returns { valid: true } or { valid: false, reason: '...' }
async function checkAndUseTeamCode(code) {
  if (!code || !code.trim()) return { valid: false, reason: 'No code provided' };

  const client = await getClient();
  if (!client) {
    // If sheets not configured, allow the code silently
    return { valid: true };
  }

  await initTeamCodesSheet();

  const rows = await fetchTeamCodeRows();
  const normalizedInput = code.trim().toLowerCase();

  // Find matching row (1-indexed in sheet, accounting for header)
  let matchRowIndex = -1;
  let matchRow = null;

  for (let i = 0; i < rows.length; i++) {
    const rowCode = String(rows[i][TC_CODE_COL] || '').trim().toLowerCase();
    if (rowCode === normalizedInput) {
      matchRowIndex = i;
      matchRow = rows[i];
      break;
    }
  }

  if (!matchRow) {
    return { valid: false, reason: 'Invalid team code. Please check and try again.' };
  }

  const usageCount = parseInt(matchRow[TC_USAGE_COL] || '0', 10);
  const maxUses = parseInt(matchRow[TC_MAX_COL] || '5', 10);

  if (usageCount >= maxUses) {
    return { valid: false, reason: `Team code "${code.trim().toUpperCase()}" has reached its maximum usage limit (${maxUses} uses).` };
  }

  // Increment usage count — sheet row number = matchRowIndex + 2 (1 for header + 1 for 1-indexing)
  const sheetRowNum = matchRowIndex + 2;
  try {
    await client.spreadsheets.values.update({
      spreadsheetId,
      range: `${TEAM_CODE_SHEET}!B${sheetRowNum}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[usageCount + 1]] }
    });
    console.log(`TeamCodes: code "${code.trim()}" used — count now ${usageCount + 1}/${maxUses}`);
    return { valid: true };
  } catch (e) {
    console.error('TeamCodes: failed to update usage count —', e.message);
    // Still allow registration if we can't update
    return { valid: true };
  }
}

// Get all team codes for admin dashboard
async function getAllTeamCodes() {
  await initTeamCodesSheet();
  const rows = await fetchTeamCodeRows();
  return rows.map(row => ({
    code: row[TC_CODE_COL] || '',
    usageCount: parseInt(row[TC_USAGE_COL] || '0', 10),
    maxUses: parseInt(row[TC_MAX_COL] || '5', 10),
    createdAt: row[TC_CREATED_COL] || ''
  }));
}

// Add a new team code to the TeamCodes sheet
async function addTeamCode(code, maxUses = 5) {
  const client = await getClient();
  if (!client) throw new Error('Google Sheets not configured.');

  await initTeamCodesSheet();

  // Check if code already exists
  const rows = await fetchTeamCodeRows();
  const exists = rows.some(r => String(r[TC_CODE_COL] || '').trim().toLowerCase() === code.trim().toLowerCase());
  if (exists) throw new Error('Team code already exists.');

  const createdAt = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  try {
    await client.spreadsheets.values.append({
      spreadsheetId,
      range: `${TEAM_CODE_SHEET}!A:D`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: [[code.trim().toUpperCase(), 0, maxUses, createdAt]] }
    });
    console.log(`TeamCodes: added code "${code.trim().toUpperCase()}" with max ${maxUses} uses`);
  } catch (e) {
    console.error('TeamCodes: append error —', e.message);
    throw e;
  }
}

// Add a new registration row — writes ONLY to Sheet2, Sheet1 is never touched
async function addRegistration(data) {
  const client = await getClient();
  if (!client) {
    throw new Error('Google Sheets not configured. Cannot save registration.');
  }

  // Ensure Sheet2 exists and has a header row before writing
  await initSheet2();

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
    data.transactionId,
    data.teamCode || ''  // Column J — optional team code
  ]];

  try {
    // ✅ Write to Sheet2 only — Sheet1 is never modified
    await client.spreadsheets.values.append({
      spreadsheetId,
      range: `${SHEET2}!A:J`,
      valueInputOption: 'USER_ENTERED',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values }
    });
    invalidateCache();
    console.log('Sheet2: registration saved for', data.fullName);
  } catch (e) {
    console.error('Sheet2 append error:', e.message);
    throw e;
  }
}

// Get all registrations for admin dashboard — reads from Sheet2 only
async function getAllRegistrations() {
  const rows = await fetchSheet2Rows();
  return rows.map(row => ({
    timestamp: row[0] || '',
    fullName: row[1] || '',
    regNumber: row[2] || '',
    email: row[3] || '',
    phone: row[4] || '',
    department: row[5] || '',
    college: row[6] || '',
    teamName: row[7] || '',
    transactionId: row[8] || '',
    teamCode: row[9] || ''
  }));
}

module.exports = {
  addRegistration,
  checkDuplicate,
  getAllRegistrations,
  checkAndUseTeamCode,
  getAllTeamCodes,
  addTeamCode,
  initTeamCodesSheet,
  initSheet2
};
