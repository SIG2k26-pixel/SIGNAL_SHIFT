/**
 * Brevo (Sendinblue) API integration — sends transactional email over HTTPS.
 * No SMTP needed, works perfectly on Render.
 * Free tier: 300 emails/day, Gmail sender verification supported.
 */

async function sendConfirmation(data) {
  const BREVO_API_KEY = process.env.BREVO_API_KEY || '';
  const SENDER_NAME = 'Signal Shift';
  const SENDER_EMAIL = 'sigmas2k26@gmail.com';

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
        ${data.screenshotUrl ? `<tr><td style="color:#00d4ff;padding:8px 0;">Payment Proof</td><td style="color:#ddd;padding:8px 0;"><a href="${data.screenshotUrl}" style="color:#b347d9;">View screenshot</a></td></tr>` : ''}
      </table>
      <p style="color:#888;font-size:13px;margin-top:20px;">Keep this email as your confirmation. See you at the hackathon!</p>
    </div>
    <p style="text-align:center;color:#555;font-size:12px;margin-top:25px;">SIMATS Engineering, Saveetha University</p>
  </div>`;

  try {
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': BREVO_API_KEY
      },
      body: JSON.stringify({
        sender: { name: SENDER_NAME, email: SENDER_EMAIL },
        to: [{ email: data.email, name: data.fullName }],
        subject: '✅ Signal Shift 2026 — Registration Confirmed!',
        htmlContent: html
      })
    });

    const result = await resp.json();

    if (!resp.ok) {
      throw new Error(`Brevo ${resp.status}: ${result.message || JSON.stringify(result)}`);
    }

    console.log('Brevo email sent, MessageId:', result.messageId);
  } catch (err) {
    console.error('Brevo email error:', err.message);
  }
}

module.exports = { sendConfirmation };
