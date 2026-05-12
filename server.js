require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const path = require('path');

const sheets = require('./services/sheets');
const email = require('./services/email');

const app = express();
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
    body('transactionId').trim().isLength({ min: 2 }).withMessage('Transaction ID required')
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
      transactionId: req.body.transactionId.trim()
    };

    try {
      // Check duplicates via Google Sheets
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

      // Save to Google Sheets
      await sheets.addRegistration(data);

      // Send email (non-blocking)
      email.sendConfirmation(data).catch(e => console.error('Email async error:', e.message));

      res.json({ success: true, message: 'Registration successful!' });

    } catch (err) {
      console.error('Registration error:', err);
      res.status(500).json({ success: false, message: 'Server error. Please try again.' });
    }
  }
);

// ===== GET REGISTRATIONS (Admin) =====
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

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n⚡ Signal Shift server running at http://localhost:${PORT}\n`);
});
