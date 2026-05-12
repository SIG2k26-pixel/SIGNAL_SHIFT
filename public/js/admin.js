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

  loginBtn.addEventListener('click', login);
  passInput.addEventListener('keydown', e => { if (e.key === 'Enter') login(); });

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
        render(allData);
        // Auto-refresh
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
        render(q ? filterData(q) : allData);
      }
    } catch (e) {}
  }

  function render(data) {
    document.getElementById('stat-total').textContent = allData.length;
    if (allData.length > 0) {
      document.getElementById('stat-latest').textContent = allData[allData.length - 1].timestamp || '—';
    }
    tbody.innerHTML = '';
    data.forEach((r, i) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${i + 1}</td><td>${r.timestamp || ''}</td><td>${r.fullName}</td>
        <td>${r.regNumber}</td><td>${r.email}</td><td>${r.phone}</td>
        <td>${r.department}</td><td>${r.college}</td><td>${r.teamName}</td>
        <td>${r.transactionId}</td>`;
      tbody.appendChild(tr);
    });
  }

  function filterData(q) {
    return allData.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(q)));
  }

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.toLowerCase();
    render(q ? filterData(q) : allData);
  });

  exportBtn.addEventListener('click', () => {
    if (!allData.length) return;
    const headers = ['Timestamp','Name','Reg No','Email','Phone','Department','College','Team','Txn ID'];
    const rows = allData.map(r => [r.timestamp, r.fullName, r.regNumber, r.email, r.phone, r.department, r.college, r.teamName, r.transactionId]);
    let csv = headers.join(',') + '\n' + rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'Signal_Shift_Registrations.csv';
    a.click();
  });
})();
