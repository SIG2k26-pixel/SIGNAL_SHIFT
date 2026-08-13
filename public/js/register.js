/* ===== Signal Shift — Registration Form Logic ===== */
(function () {
  'use strict';

  const form = document.getElementById('reg-form');
  const submitBtn = document.getElementById('submit-btn');
  const successModal = document.getElementById('success-modal');
  const errorModal = document.getElementById('error-modal');
  const successMsg = document.getElementById('success-msg');
  const errorMsg = document.getElementById('error-msg');
  const downloadBtn = document.getElementById('download-receipt');

  let lastSubmission = null;

  const validators = {
    fullName: v => v.trim().length >= 2 ? '' : 'Name must be at least 2 characters',
    regNumber: v => v.trim().length >= 2 ? '' : 'Register number is required',
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'Enter a valid email address',
    phone: v => /^\d{10}$/.test(v.trim()) ? '' : 'Phone must be exactly 10 digits',
    department: v => v ? '' : 'Select a department',
    college: v => v.trim().length >= 2 ? '' : 'College name is required',
    teamName: v => v.trim().length >= 2 ? '' : 'Team name is required',
    teamCode: v => v.trim().length >= 2 ? '' : 'Team code is required',
    transactionId: v => v.trim().length >= 2 ? '' : 'Transaction ID is required'
  };

  // All fields are required (including teamCode)
  const requiredFields = ['fullName', 'regNumber', 'email', 'phone', 'department', 'college', 'teamName', 'teamCode', 'transactionId'];

  // ===== SCREENSHOT FILE VALIDATION =====
  const screenshotInput = document.getElementById('screenshot');
  const ALLOWED_SCREENSHOT_EXTS = ['.png', '.jpg', '.jpeg', '.webp'];
  const MAX_FILE_SIZE = 4 * 1024 * 1024; // 4 MB

  function validateScreenshot() {
    const errEl = document.getElementById('err-screenshot');
    const group = screenshotInput.closest('.form-group');
    const file = screenshotInput.files[0];

    if (!file) {
      group.classList.add('error');
      errEl.textContent = 'Please upload a screenshot of your transaction.';
      return false;
    }
    const ext = '.' + file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_SCREENSHOT_EXTS.includes(ext)) {
      group.classList.add('error');
      errEl.textContent = 'Only PNG, JPG, or WEBP images are allowed.';
      return false;
    }
    if (file.size > MAX_FILE_SIZE) {
      group.classList.add('error');
      errEl.textContent = 'File too large. Max size is 4 MB.';
      return false;
    }
    group.classList.remove('error');
    errEl.textContent = '';
    return true;
  }

  screenshotInput.addEventListener('change', validateScreenshot);

  // Real-time validation (required fields only)
  requiredFields.forEach(field => {
    const el = document.getElementById(field);
    if (!el) return;
    el.addEventListener('input', () => validateField(field));
    el.addEventListener('blur', () => validateField(field));
  });

  function validateField(field) {
    const el = document.getElementById(field);
    const errEl = document.getElementById('err-' + field);
    const group = el.closest('.form-group');
    const msg = validators[field](el.value);
    if (msg) {
      group.classList.add('error');
      errEl.textContent = msg;
    } else {
      group.classList.remove('error');
      errEl.textContent = '';
    }
    return !msg;
  }

  function validateAll() {
    let valid = true;
    requiredFields.forEach(field => {
      if (!validateField(field)) valid = false;
    });
    if (!validateScreenshot()) valid = false;
    return valid;
  }

  function getFormData() {
    const fd = new FormData();
    requiredFields.forEach(field => {
      fd.append(field, document.getElementById(field).value.trim());
    });
    fd.append('screenshot', screenshotInput.files[0]);
    return fd;
  }

  // Submit
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateAll()) {
      form.classList.add('shake');
      setTimeout(() => form.classList.remove('shake'), 500);
      return;
    }
    const fd = getFormData();
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        // No Content-Type header — browser sets it with multipart boundary automatically
        body: fd
      });
      const result = await res.json();

      if (res.ok && result.success) {
        lastSubmission = {
          fullName: fd.get('fullName'),
          regNumber: fd.get('regNumber'),
          email: fd.get('email'),
          phone: fd.get('phone'),
          department: fd.get('department'),
          college: fd.get('college'),
          teamName: fd.get('teamName'),
          transactionId: fd.get('transactionId'),
          teamCode: fd.get('teamCode')
        };
        successMsg.textContent = `Welcome, ${fd.get('fullName')}! Your registration is confirmed. Team: ${fd.get('teamName')}`;
        successModal.classList.add('active');
        form.reset();
        screenshotInput.value = '';
        // Confetti
        if (typeof confetti !== 'undefined') {
          confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors: ['#00d4ff', '#b347d9', '#ff006e', '#fff'] });
          setTimeout(() => confetti({ particleCount: 80, spread: 100, origin: { y: 0.5 } }), 300);
        }
      } else {
        // Show inline error for team code issues
        const msg = result.message || 'Registration failed. Please try again.';
        if (msg.toLowerCase().includes('team code') || msg.toLowerCase().includes('code')) {
          const errEl = document.getElementById('err-teamCode');
          const group = document.getElementById('teamCode').closest('.form-group');
          if (errEl && group) {
            group.classList.add('error');
            errEl.textContent = msg;
            document.getElementById('teamCode').scrollIntoView({ behavior: 'smooth', block: 'center' });
          } else {
            errorMsg.textContent = msg;
            errorModal.classList.add('active');
          }
        } else {
          errorMsg.textContent = msg;
          errorModal.classList.add('active');
        }
      }
    } catch (err) {
      errorMsg.textContent = 'Network error. Please check your connection.';
      errorModal.classList.add('active');
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });

  // Download receipt PDF
  downloadBtn.addEventListener('click', () => {
    if (!lastSubmission || typeof jspdf === 'undefined') return;
    const { jsPDF } = jspdf;
    const doc = new jsPDF();
    const d = lastSubmission;

    // Header
    doc.setFillColor(10, 10, 15);
    doc.rect(0, 0, 210, 297, 'F');
    doc.setTextColor(0, 212, 255);
    doc.setFontSize(28);
    doc.text('Signal Shift', 105, 35, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(179, 71, 217);
    doc.text('National Level Hackathon 2026', 105, 45, { align: 'center' });

    doc.setDrawColor(0, 212, 255);
    doc.line(30, 55, 180, 55);

    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('Registration Receipt', 105, 70, { align: 'center' });

    const fields = [
      ['Name', d.fullName],
      ['Register No', d.regNumber],
      ['Email', d.email],
      ['Phone', d.phone],
      ['Department', d.department],
      ['College', d.college],
      ['Team', d.teamName],
      ['Transaction ID', d.transactionId],
      ...(d.teamCode ? [['Team Code', d.teamCode.toUpperCase()]] : []),
      ['Date', new Date().toLocaleString('en-IN')]
    ];

    let y = 85;
    doc.setFontSize(11);
    fields.forEach(([label, value]) => {
      doc.setTextColor(0, 212, 255);
      doc.text(label + ':', 35, y);
      doc.setTextColor(220, 220, 220);
      doc.text(value, 90, y);
      y += 10;
    });

    doc.setDrawColor(0, 212, 255);
    doc.line(30, y + 5, 180, y + 5);
    doc.setFontSize(9);
    doc.setTextColor(100, 100, 130);
    doc.text('SIMATS Engineering, Saveetha University', 105, y + 15, { align: 'center' });

    doc.save(`Signal_Shift_Receipt_${d.regNumber}.pdf`);
  });

})();
