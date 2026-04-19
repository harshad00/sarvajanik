// ===== ADMIN.JS =====

let adminUser = null;
let adminLat = null;
let adminLon = null;

// ===== LOGIN =====
async function adminLogin() {
  const id = document.getElementById('adminId').value.trim();
  const pwd = document.getElementById('adminPwd').value;
  const msg = document.getElementById('loginMsg');
  const btn = document.getElementById('loginBtn');

  if (!id || !pwd) return showMsg(msg, 'Please fill all fields.', 'error');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Logging in...';

  try {
    const result = await apiCall('adminLogin', { adminId: id, password: pwd });

    if (result.success) {
      adminUser = result.admin;
      setSession('admin', adminUser);
      showAdminDashboard();
    } else {
      showMsg(msg, result.message || 'Invalid credentials.', 'error');
    }
  } catch (e) {
    showMsg(msg, 'Error: ' + e.message, 'error');
  }

  btn.disabled = false;
  btn.innerHTML = 'Login';
}

// ===== DASHBOARD =====
function showAdminDashboard() {
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('dashSection').style.display = 'block';
  document.getElementById('adminNameDisplay').textContent = 'Logged in as: ' + adminUser.name;
  document.getElementById('adminNameField').value = adminUser.name;

  // Auto-fill date/time
  const now = new Date();
  document.getElementById('dateField').value = formatDate(now);
  document.getElementById('timeField').value = formatTime(now);

  // Update time every second
  setInterval(() => {
    const n = new Date();
    document.getElementById('timeField').value = formatTime(n);
  }, 1000);

  // Get admin location
  getAdminLocation();
  loadActiveSessions();
}

// ===== ADMIN GPS =====
function getAdminLocation() {
  const dot = document.getElementById('adminGpsDot');
  const text = document.getElementById('adminGpsText');

  getCurrentPosition()
    .then(pos => {
      adminLat = pos.coords.latitude;
      adminLon = pos.coords.longitude;
      dot.className = 'gps-dot green';
      text.textContent = `${adminLat.toFixed(4)}, ${adminLon.toFixed(4)}`;
    })
    .catch(() => {
      dot.className = 'gps-dot red';
      text.textContent = 'Location unavailable';
    });
}

// ===== YEAR SELECT =====
function selectYear(year, btn) {
  document.querySelectorAll('.year-btn').forEach(b => {
    if (b.closest('#tabCreate')) b.classList.remove('active');
  });
  btn.classList.add('active');
  document.getElementById('selectedYear').value = year;
}

// ===== CREATE SESSION =====
async function createSession() {
  const year = document.getElementById('selectedYear').value;
  const subject = document.getElementById('subjectField').value.trim();
  const timeLimit = parseInt(document.getElementById('timeLimitField').value);
  const msg = document.getElementById('createMsg');
  const btn = document.getElementById('createBtn');

  hideMsg(msg);

  if (!year) return showMsg(msg, 'Please select a year (FY / SY / TY).', 'error');
  if (!subject) return showMsg(msg, 'Please enter a subject or class name.', 'error');
  if (!timeLimit || timeLimit < 1) return showMsg(msg, 'Please set a valid time limit.', 'error');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Creating...';

  try {
    const now = new Date();
    const result = await apiCall('createSession', {
      adminId: adminUser.adminId,
      adminName: adminUser.name,
      year,
      subject,
      timeLimit,
      date: formatDate(now),
      time: formatTime(now),
      lat: adminLat,
      lon: adminLon,
      startTimestamp: now.toISOString()
    });

    if (result.success) {
      showMsg(msg, `✅ Session created for ${year} — ${subject}! Students can now mark attendance.`, 'success');
      loadActiveSessions();
    } else {
      showMsg(msg, result.message || 'Failed to create session.', 'error');
    }
  } catch (e) {
    showMsg(msg, 'Error: ' + e.message, 'error');
  }

  btn.disabled = false;
  btn.innerHTML = '🚀 Start Attendance Session';
}

// ===== LOAD ACTIVE SESSIONS =====
async function loadActiveSessions() {
  const el = document.getElementById('activeSessionsList');
  try {
    const result = await apiCall('getActiveSessions', {});
    if (result.sessions && result.sessions.length > 0) {
      let html = '<div class="table-wrap"><table><thead><tr><th>Year</th><th>Subject</th><th>Started</th><th>Time Limit</th><th>Admin</th><th>Action</th></tr></thead><tbody>';
      result.sessions.forEach(s => {
        html += `<tr>
          <td><span class="year-badge ${s.year.toLowerCase()}-badge">${s.year}</span></td>
          <td>${s.subject}</td>
          <td style="font-family:'DM Mono',monospace;font-size:12px">${s.date} ${s.time}</td>
          <td>${s.timeLimit} min</td>
          <td>${s.adminName}</td>
          <td><button class="btn btn-danger" style="padding:4px 10px;font-size:12px" onclick="endSession('${s.id}')">End</button></td>
        </tr>`;
      });
      html += '</tbody></table></div>';
      el.innerHTML = html;
    } else {
      el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;font-size:14px">No active sessions</div>';
    }
  } catch (e) {
    el.innerHTML = '<div style="color:var(--danger);font-size:13px;padding:12px">Failed to load: ' + e.message + '</div>';
  }
}

// ===== END SESSION =====
async function endSession(sessionId) {
  if (!confirm('End this attendance session?')) return;
  try {
    await apiCall('endSession', { sessionId });
    loadActiveSessions();
  } catch (e) {
    alert('Error: ' + e.message);
  }
}

// ===== LOAD RECORDS =====
async function loadRecords() {
  const year = document.getElementById('filterYear').value;
  const date = document.getElementById('filterDate').value;
  const el = document.getElementById('recordsTable');

  el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px">Loading...</div>';

  try {
    const result = await apiCall('getRecords', { year, date });
    if (result.records && result.records.length > 0) {
      let html = '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Year</th><th>Roll No</th><th>Name</th><th>Subject</th><th>Time</th></tr></thead><tbody>';
      result.records.forEach(r => {
        html += `<tr>
          <td style="font-family:'DM Mono',monospace;font-size:12px">${r.date}</td>
          <td><span class="year-badge ${r.year.toLowerCase()}-badge">${r.year}</span></td>
          <td style="font-family:'DM Mono',monospace">${r.rollNo}</td>
          <td>${r.name}</td>
          <td>${r.subject}</td>
          <td style="font-family:'DM Mono',monospace;font-size:12px">${r.time}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
      html += `<div style="text-align:right;font-size:12px;color:var(--muted);margin-top:10px">Total: ${result.records.length} records</div>`;
      el.innerHTML = html;
    } else {
      el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;font-size:14px">No records found.</div>';
    }
  } catch (e) {
    el.innerHTML = '<div style="color:var(--danger);font-size:13px;padding:12px">Error: ' + e.message + '</div>';
  }
}

// ===== LOAD STUDENTS =====
async function loadStudents(year, btn) {
  document.querySelectorAll('#tabStudents .year-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  const el = document.getElementById('studentsTable');
  el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px">Loading...</div>';

  try {
    const result = await apiCall('getStudents', { year });
    if (result.students && result.students.length > 0) {
      let html = '<div class="table-wrap"><table><thead><tr><th>#</th><th>Roll No</th><th>Name</th><th>Password Status</th></tr></thead><tbody>';
      result.students.forEach((s, i) => {
        const pwdStatus = s.isDefaultPwd
          ? '<span class="chip" style="color:var(--warn);background:rgba(251,146,60,0.12)">Default (Not Changed)</span>'
          : '<span class="chip active">Custom Password</span>';
        html += `<tr>
          <td style="color:var(--muted)">${i+1}</td>
          <td style="font-family:'DM Mono',monospace">${s.rollNo}</td>
          <td>${s.name}</td>
          <td>${pwdStatus}</td>
        </tr>`;
      });
      html += '</tbody></table></div>';
      el.innerHTML = html;
    } else {
      el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;font-size:14px">No students found in ' + year + '.</div>';
    }
  } catch (e) {
    el.innerHTML = '<div style="color:var(--danger);font-size:13px;padding:12px">Error: ' + e.message + '</div>';
  }
}

// ===== TABS =====
function switchTab(tab) {
  ['create','records','students'].forEach(t => {
    document.getElementById('tab' + t.charAt(0).toUpperCase() + t.slice(1)).style.display = t === tab ? 'block' : 'none';
  });
  document.querySelectorAll('.tab').forEach((el, i) => {
    el.classList.toggle('active', ['create','records','students'][i] === tab);
  });
}

// ===== LOGOUT =====
function adminLogout() {
  clearSession();
  adminUser = null;
  document.getElementById('dashSection').style.display = 'none';
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('adminId').value = '';
  document.getElementById('adminPwd').value = '';
}

// ===== RESTORE SESSION =====
window.addEventListener('DOMContentLoaded', () => {
  const saved = getSession('admin');
  if (saved) {
    adminUser = saved;
    showAdminDashboard();
  }
});

// Enter key
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('loginSection').style.display !== 'none') adminLogin();
});
