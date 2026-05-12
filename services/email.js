const nodemailer = require('nodemailer');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const { SMTP_USER, SMTP_PASS, SMTP_HOST, SMTP_PORT } = process.env;
  if (!SMTP_USER || SMTP_USER === 'your-email@gmail.com') return null;

  const port = Number(SMTP_PORT) || 587;
  transporter = nodemailer.createTransport({
    host: SMTP_HOST || 'smtp.gmail.com',
    port: port,
    secure: port === 465,  // true for 465 (SSL), false for 587 (STARTTLS)
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    },
    connectionTimeout: 10000, // 10 second timeout
  });
  return transporter;
}

async function sendConfirmation(data) {
  const t = getTransporter();
  if (!t) {
    console.warn('Email: SMTP not configured, skipping.');
    return;
  }

  const html = `
  <div style="background:#0a0a0f;color:#f0f0f0;font-family:Arial,sans-serif;padding:40px 20px;max-width:600px;margin:0 auto;">
    <div style="text-align:center;margin-bottom:30px;">
      <h1 style="color:#00d4ff;font-size:36px;letter-spacing:6px;margin:0;">Signal Shift</h1>
      <p style="color:#b347d9;font-size:14px;margin-top:5px;">National Level Hackathon 2026</p>
    </div>
    <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:30px;">
      <h2 style="color:#00d4ff;font-size:20px;margin-top:0;">Registration Confirmed! 🎉</h2>
      <p style="color:#ccc;line-height:1.6;">Hello <strong>${data.fullName}</strong>, your registration has been received.</p>
      <table style="width:100%;margin:20px 0;border-collapse:collapse;">
        <tr><td style="color:#00d4ff;padding:8px 0;width:140px;">Register No</td><td style="color:#ddd;padding:8px 0;">${data.regNumber}</td></tr>
        <tr><td style="color:#00d4ff;padding:8px 0;">Email</td><td style="color:#ddd;padding:8px 0;">${data.email}</td></tr>
        <tr><td style="color:#00d4ff;padding:8px 0;">Phone</td><td style="color:#ddd;padding:8px 0;">${data.phone}</td></tr>
        <tr><td style="color:#00d4ff;padding:8px 0;">Department</td><td style="color:#ddd;padding:8px 0;">${data.department}</td></tr>
        <tr><td style="color:#00d4ff;padding:8px 0;">College</td><td style="color:#ddd;padding:8px 0;">${data.college}</td></tr>
        <tr><td style="color:#00d4ff;padding:8px 0;">Team</td><td style="color:#ddd;padding:8px 0;">${data.teamName}</td></tr>
        <tr><td style="color:#00d4ff;padding:8px 0;">Transaction ID</td><td style="color:#ddd;padding:8px 0;">${data.transactionId}</td></tr>
      </table>
      <p style="color:#888;font-size:13px;margin-top:20px;">Keep this email as your confirmation. See you at the hackathon!</p>
    </div>
    <p style="text-align:center;color:#555;font-size:12px;margin-top:25px;">SIMATS Engineering, Saveetha University</p>
  </div>`;

  try {
    const info = await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: data.email,
      subject: '✅ Signal Shift 2026 — Registration Confirmed!',
      html
    });
    console.log('Email sent to:', data.email, '| MessageId:', info.messageId);
  } catch (e) {
    console.error('Email error:', e.message);
  }
}

module.exports = { sendConfirmation };
