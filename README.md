# ⚡ Signal Shift — National Level Hackathon 2026

Premium futuristic 3D registration portal for Signal Shift hackathon at SIMATS Engineering, Saveetha University.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start

# 3. Open in browser
# http://localhost:3000
```

## Features

- 🎨 Cyberpunk-themed UI with glassmorphism, neon glows, and 3D effects
- 🌐 Vanta.js animated network background with mouse reactivity
- ✨ GSAP scroll animations and parallax effects
- 🎯 Floating particle system with cursor interaction
- ⏱️ Live countdown timer to event date
- 📝 Full registration form with real-time validation
- 🎉 Confetti explosion on successful registration
- 📄 PDF receipt download (client-side generation)
- 📊 Excel (.xlsx) data storage
- 📋 Google Sheets integration (optional)
- 📧 Email confirmation (optional)
- 🔐 Admin dashboard with search, stats, and CSV export
- 🎵 Background music toggle
- 📱 Fully responsive design

## Configuration

Edit `.env` to customize:

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `ADMIN_PASSWORD` | Admin dashboard password |
| `EVENT_DATE` | Countdown target date |
| `SPREADSHEET_ID` | Google Sheet ID (optional) |
| `GOOGLE_CREDENTIALS_PATH` | Path to service account JSON (optional) |
| `SMTP_HOST/PORT/USER/PASS` | Email SMTP settings (optional) |

## Google Sheets Setup (Optional)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project → Enable **Google Sheets API**
3. Create a **Service Account** → Download JSON key
4. Place the JSON file in `credentials/service-account.json`
5. Create a Google Sheet → Share it with the service account email
6. Copy the Sheet ID from the URL → paste into `.env`

## Admin Dashboard

Visit `http://localhost:3000/admin.html` and enter the admin password.

## Tech Stack

**Frontend:** HTML5, CSS3, JavaScript, Three.js, Vanta.js, GSAP, canvas-confetti, jsPDF
**Backend:** Node.js, Express
**Storage:** Excel (exceljs), Google Sheets API, Nodemailer
