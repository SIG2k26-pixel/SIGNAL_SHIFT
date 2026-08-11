require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const path = require('path');

const sheets = require('./services/sheets');
const email = require('./services/email');

const app = express();
app.set('trust proxy', true); // Trust Render's proxy
const PORT = process.env.PORT || 3000;


// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));


app.set('trust proxy', 1);

// Rate limit for registration
const regLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 min
  max: 20,
  message: { success: false, message: 'Too many requests. Please try later.' }
});

// ===== REGISTER =====
app.post('/api/register',
  regLimiter,
  [
    body('fullName').trim().isLength({ min: 2 }).withMessage('Name required'),
    body('regNumber').trim().isLength({ min: 2 }).withMessage('Register number required'),
    body('email').isEmail().normalizeEmail().withMessage('Valid email required'),
    body('phone').matches(/^\d{10}$/).withMessage('10-digit phone required'),
    body('department').trim().notEmpty().withMessage('Department required'),
    body('college').trim().isLength({ min: 2 }).withMessage('College required'),
    body('teamName').trim().isLength({ min: 2 }).withMessage('Team name required'),
    body('transactionId').trim().isLength({ min: 2 }).withMessage('Transaction ID required'),
    body('teamCode').trim().isLength({ min: 2, max: 30 }).withMessage('Team code is required')
  ],
  async (req, res) => {
    // Validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: errors.array()[0].msg
      });
    }

    const data = {
      fullName: req.body.fullName.trim(),
      regNumber: req.body.regNumber.trim(),
      email: req.body.email.trim(),
      phone: req.body.phone.trim(),
      department: req.body.department.trim(),
      college: req.body.college.trim(),
      teamName: req.body.teamName.trim(),
      transactionId: req.body.transactionId.trim(),
      teamCode: (req.body.teamCode || '').trim()
    };

    try {
      // Check duplicates via Google Sheets (checks both Sheet1 + Sheet2)
      const dupReg = await sheets.checkDuplicate('regNumber', data.regNumber);
      if (dupReg) {
        return res.status(409).json({
          success: false,
          message: 'This Register Number is already registered.'
        });
      }
      const dupTxn = await sheets.checkDuplicate('transactionId', data.transactionId);
      if (dupTxn) {
        return res.status(409).json({
          success: false,
          message: 'This Transaction ID has already been used.'
        });
      }

      // Validate team code if provided
      if (data.teamCode) {
        const codeResult = await sheets.checkAndUseTeamCode(data.teamCode);
        if (!codeResult.valid) {
          return res.status(400).json({
            success: false,
            message: codeResult.reason
          });
        }
      }

      // Save to Sheet2 (Sheet1 is never modified)
      await sheets.addRegistration(data);

      // Send email (blocking so it completes on serverless; sendConfirmation never throws)
      await email.sendConfirmation(data);

      res.json({ success: true, message: 'Registration successful!' });

    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
  }
);

// ===== GET REGISTRATIONS (Admin) — reads from Sheet2 =====
app.get('/api/registrations', async (req, res) => {
  const password = req.headers['x-admin-password'];
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  try {
    const registrations = await sheets.getAllRegistrations();
    res.json({ success: true, registrations });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error reading data' });
  }
});

// ===== CHECK DUPLICATE =====
app.get('/api/check-duplicate', async (req, res) => {
  const { field, value } = req.query;
  if (!field || !value) return res.json({ duplicate: false });
  const dup = await sheets.checkDuplicate(field, value);
  res.json({ duplicate: dup });
});

// ===== TEAM CODES (Admin) =====

// GET all team codes
app.get('/api/team-codes', async (req, res) => {
  const password = req.headers['x-admin-password'];
  if (password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  try {
    const codes = await sheets.getAllTeamCodes();
    res.json({ success: true, codes });
  } catch (err) {
    console.error('Team codes fetch error:', err);
    res.status(500).json({ success: false, message: 'Error reading team codes' });
  }
});

// POST add a new team code
app.post('/api/team-codes',
  [
    body('code').trim().isLength({ min: 2, max: 30 }).withMessage('Code must be 2–30 characters'),
    body('maxUses').optional().isInt({ min: 1, max: 1000 }).withMessage('Max uses must be 1–1000')
  ],
  async (req, res) => {
    const password = req.headers['x-admin-password'];
    if (password !== process.env.ADMIN_PASSWORD) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }
    try {
      const maxUses = parseInt(req.body.maxUses || '5', 10);
      await sheets.addTeamCode(req.body.code.trim(), maxUses);
      res.json({ success: true, message: 'Team code added successfully.' });
    } catch (err) {
      console.error('Add team code error:', err);
      res.status(400).json({ success: false, message: err.message || 'Error adding team code' });
    }
  }
);

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n⚡ Signal Shift server running at http://localhost:${PORT}\n`);
});
