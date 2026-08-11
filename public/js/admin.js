/* ===== Signal Shift — Admin Dashboard ===== */
(function () {
  'use strict';

  const loginSection = document.getElementById('admin-login');
  const dashSection = document.getElementById('admin-dash');
  const loginBtn = document.getElementById('login-btn');
  const passInput = document.getElementById('admin-pass');
  const tbody = document.getElementById('reg-tbody');
  const searchInput = document.getElementById('search');
  const exportBtn = document.getElementById('export-btn');

  let allData = [];
  let adminPassword = '';
  let currentTab = 'registrations';

  loginBtn.addEventListener('click', login);
  passInput.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });

  // ===== TAB SWITCHING =====
  window.switchTab = function (tab) {
    currentTab = tab;
    document.getElementById('panel-registrations').style.display = tab === 'registrations' ? 'block' : 'none';
    document.getElementById('panel-codes').style.display = tab === 'codes' ? 'block' : 'none';
    document.getElementById('tab-registrations').classList.toggle('active', tab === 'registrations');
    document.getElementById('tab-codes').classList.toggle('active', tab === 'codes');
    if (tab === 'codes') loadTeamCodes();
  };

  // ===== LOGIN =====
  async function login() {
    adminPassword = passInput.value;
    try {
      const res = await fetch('/api/registrations', {
        headers: { 'x-admin-password': adminPassword }
      });
      if (res.ok) {
        const data = await res.json();
        allData = data.registrations || [];
        loginSection.style.display = 'none';
        dashSection.style.display = 'block';
        renderRegistrations(allData);
        // Auto-refresh every 30s
        setInterval(refreshData, 30000);
      } else {
        alert('Invalid password');
      }
    } catch (e) { alert('Connection error'); }
  }

  async function refreshData() {
    try {
      const res = await fetch('/api/registrations', {
        headers: { 'x-admin-password': adminPassword }
      });
      if (res.ok) {
        const data = await res.json();
        allData = data.registrations || [];
        const q = searchInput.value.toLowerCase();
        renderRegistrations(q ? filterData(q) : allData);
      }
    } catch (e) {}
  }

  // ===== REGISTRATIONS =====
  function renderRegistrations(data) {
    document.getElementById('stat-total').textContent = allData.length;
    if (allData.length > 0) {
      document.getElementById('stat-latest').textContent = allData[allData.length - 1].fullName || '—';
    }
    tbody.innerHTML = '';
    data.forEach((r, i) => {
      const tr = document.createElement('tr');
      const teamCodeBadge = r.teamCode
        ? `<span class="code-badge">${r.teamCode.toUpperCase()}</span>`
        : '<span style="color:var(--text-muted)">—</span>';
      tr.innerHTML = `<td>${i + 1}</td><td>${r.timestamp || ''}</td><td>${r.fullName}</td>
        <td>${r.regNumber}</td><td>${r.email}</td><td>${r.phone}</td>
        <td>${r.department}</td><td>${r.college}</td><td>${r.teamName}</td>
        <td>${r.transactionId}</td><td>${teamCodeBadge}</td>`;
      tbody.appendChild(tr);
    });
  }

  function filterData(q) {
    return allData.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
  }

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase();
    renderRegistrations(q ? filterData(q) : allData);
  });

  exportBtn.addEventListener('click', () => {
    if (!allData.length) return;
    const headers = ['Timestamp', 'Name', 'Reg No', 'Email', 'Phone', 'Department', 'College', 'Team', 'Txn ID', 'Team Code'];
    const rows = allData.map(r => [r.timestamp, r.fullName, r.regNumber, r.email, r.phone, r.department, r.college, r.teamName, r.transactionId, r.teamCode || '']);
    let csv = headers.join(',') + '\n' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Signal_Shift_Registrations.csv';
    a.click();
  });

  // ===== TEAM CODES =====
  async function loadTeamCodes() {
    const tbody2 = document.getElementById('codes-tbody');
    tbody2.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">Loading...</td></tr>';
    try {
      const res = await fetch('/api/team-codes', {
        headers: { 'x-admin-password': adminPassword }
      });
      if (!res.ok) { tbody2.innerHTML = '<tr><td colspan="6" style="color:red">Failed to load codes</td></tr>'; return; }
      const data = await res.json();
      const codes = data.codes || [];

      document.getElementById('stat-codes-total').textContent = codes.length;
      document.getElementById('stat-codes-active').textContent = codes.filter(c => c.usageCount < c.maxUses).length;

      tbody2.innerHTML = '';
      if (codes.length === 0) {
        tbody2.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--text-muted);padding:2rem">No team codes yet. Add one above.</td></tr>';
        return;
      }
      codes.forEach((c, i) => {
        const remaining = c.maxUses - c.usageCount;
        const pct = Math.round((c.usageCount / c.maxUses) * 100);
        const barColor = remaining === 0 ? '#ff006e' : remaining <= 1 ? '#ffbe0b' : '#00d4ff';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${i + 1}</td>
          <td><span class="code-badge">${c.code}</span></td>
          <td>${c.usageCount}</td>
          <td>${c.maxUses}</td>
          <td>
            <div style="display:flex;align-items:center;gap:0.5rem">
              <div style="flex:1;height:6px;background:rgba(255,255,255,0.1);border-radius:3px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${barColor};border-radius:3px;transition:width 0.3s"></div>
              </div>
              <span style="color:${barColor};font-weight:600;min-width:1.5rem">${remaining}</span>
            </div>
          </td>
          <td style="color:var(--text-muted)">${c.createdAt || '—'}</td>`;
        tbody2.appendChild(tr);
      });
    } catch (e) {
      tbody2.innerHTML = '<tr><td colspan="6" style="color:red">Connection error</td></tr>';
    }
  }

  // Add Code button
  const addCodeBtn = document.getElementById('add-code-btn');
  addCodeBtn.addEventListener('click', async () => {
    const codeInput = document.getElementById('new-code');
    const maxUsesInput = document.getElementById('new-max-uses');
    const errEl = document.getElementById('err-new-code');
    const msgEl = document.getElementById('add-code-msg');

    const code = codeInput.value.trim();
    const maxUses = parseInt(maxUsesInput.value || '5', 10);

    errEl.textContent = '';
    msgEl.textContent = '';

    if (code.length < 2) {
      errEl.textContent = 'Code must be at least 2 characters';
      codeInput.closest('.form-group').classList.add('error');
      return;
    }
    codeInput.closest('.form-group').classList.remove('error');

    addCodeBtn.classList.add('loading');
    addCodeBtn.disabled = true;

    try {
      const res = await fetch('/api/team-codes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-password': adminPassword
        },
        body: JSON.stringify({ code, maxUses })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        msgEl.style.color = '#00d4ff';
        msgEl.textContent = `✅ Code "${code.toUpperCase()}" added with ${maxUses} max uses!`;
        codeInput.value = '';
        maxUsesInput.value = '5';
        loadTeamCodes();
      } else {
        msgEl.style.color = '#ff006e';
        msgEl.textContent = `❌ ${data.message || 'Error adding code'}`;
      }
    } catch (e) {
      msgEl.style.color = '#ff006e';
      msgEl.textContent = '❌ Network error. Please try again.';
    } finally {
      addCodeBtn.classList.remove('loading');
      addCodeBtn.disabled = false;
    }
  });

  // Enter key on new code input
  document.getElementById('new-code').addEventListener('keydown', e => {
    if (e.key === 'Enter') addCodeBtn.click();
  });

})();
