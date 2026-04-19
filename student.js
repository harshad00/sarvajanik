// ===== STUDENT.JS =====

let currentStudent = null;
let sessionData = null;
let studentLat = null;
let studentLon = null;

// ===== LOGIN =====
async function studentLogin() {
  const rollNo = document.getElementById('rollNo').value.trim().toUpperCase();
  const password = document.getElementById('password').value;
  const msg = document.getElementById('loginMsg');
  const btn = document.getElementById('loginBtn');

  if (!rollNo || !password) {
    return showMsg(msg, 'Please enter Roll Number and Password.', 'error');
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span> Logging in...';

  try {
    const result = await apiCall('studentLogin', { rollNo, password });

    if (result.success) {
      currentStudent = result.student;
      setSession('student', currentStudent);

      if (result.isDefaultPassword) {
        showPasswordModal();
      } else {
        showDashboard();
      }
    } else {
      showMsg(msg, result.message || 'Invalid Roll Number or Password.', 'error');
    }
  } catch (e) {
    showMsg(msg, 'Error: ' + e.message, 'error');
  }

  btn.disabled = false;
  btn.innerHTML = 'Login';
}

// ===== PASSWORD MODAL =====
function showPasswordModal() {
  document.getElementById('changePwdModal').classList.add('show');
}

async function submitPasswordChange() {
  const newPwd = document.getElementById('newPwd').value;
  const confirmPwd = document.getElementById('confirmPwd').value;
  const msg = document.getElementById('cpMsg');
  const btn = document.getElementById('cpBtnText');

  hideMsg(msg);

  if (newPwd.length < 6) {
    return showMsg(msg, 'Password must be at least 6 characters.', 'error');
  }
  if (newPwd !== confirmPwd) {
    return showMsg(msg, 'Passwords do not match.', 'error');
  }
  if (newPwd === currentStudent.rollNo) {
    return showMsg(msg, 'New password cannot be the same as your Roll Number.', 'error');
  }

  btn.innerHTML = '<span class="spinner"></span>';

  try {
    const result = await apiCall('changeStudentPassword', {
      rollNo: currentStudent.rollNo,
      year: currentStudent.year,
      newPassword: newPwd
    });

    if (result.success) {
      document.getElementById('changePwdModal').classList.remove('show');
      showDashboard();
    } else {
      showMsg(msg, result.message || 'Failed to change password.', 'error');
    }
  } catch (e) {
    showMsg(msg, 'Error: ' + e.message, 'error');
  }

  btn.innerHTML = 'Set Password';
}

// ===== DASHBOARD =====
function showDashboard() {
  document.getElementById('loginSection').style.display = 'none';
  document.getElementById('dashSection').style.display = 'block';

  const s = currentStudent;
  document.getElementById('studentName').textContent = 'Hi, ' + s.name + '!';
  document.getElementById('studentRoll').textContent = s.rollNo;

  const badge = document.getElementById('yearBadge');
  badge.textContent = s.year;
  badge.className = 'year-badge ' + s.year.toLowerCase() + '-badge';

  checkActiveSession();
  loadMyAttendance();
}

// ===== CHECK ACTIVE SESSION =====
async function checkActiveSession() {
  try {
    const result = await apiCall('getActiveSession', { year: currentStudent.year });

    if (result.session) {
      sessionData = result.session;
      document.getElementById('sessionCard').style.display = 'block';
      document.getElementById('noSessionCard').style.display = 'none';

      document.getElementById('sessSubject').textContent = sessionData.subject || '—';
      document.getElementById('sessYear').textContent = sessionData.year;
      document.getElementById('sessLimit').textContent = sessionData.timeLimit + ' minutes';

      // FIX: Parse startTime properly — comes as "dd/mm/yyyy hh:mm" from sheet
      document.getElementById('sessTime').textContent = sessionData.startTime || '—';

      startGPS();
    } else {
      document.getElementById('sessionCard').style.display = 'none';
      document.getElementById('noSessionCard').style.display = 'block';
    }
  } catch (e) {
    document.getElementById('noSessionCard').style.display = 'block';
    console.error('Session check error:', e);
  }
}

// ===== GPS =====
function startGPS() {
  const dot = document.getElementById('gpsDot');
  const text = document.getElementById('gpsText');
  const markBtn = document.getElementById('markBtn');
  const markBtnText = document.getElementById('markBtnText');
  const distEl = document.getElementById('sessDist');
  const dashMsg = document.getElementById('dashMsg');

  dot.className = 'gps-dot orange';
  text.textContent = 'Getting your location...';
  markBtn.disabled = true;
  markBtnText.textContent = '📡 Verifying Location...';

  getCurrentPosition()
    .then(pos => {
      studentLat = pos.coords.latitude;
      studentLon = pos.coords.longitude;
      const accuracy = Math.round(pos.coords.accuracy);

      const cfg = getConfig();
      const campusLat = parseFloat(cfg.campusLat);
      const campusLon = parseFloat(cfg.campusLon);

      // FIX: minimum radius is 100m because phone GPS has 10-30m natural error
      // Whatever admin set, we use at least 100m
      const configRadius = parseFloat(cfg.campusRadius) || 200;
      const radius = Math.max(configRadius, 100);

      if (!campusLat || !campusLon) {
        dot.className = 'gps-dot orange';
        text.textContent = 'Campus location not set. Ask admin to run setup.';
        return;
      }

      const dist = Math.round(getDistance(studentLat, studentLon, campusLat, campusLon));
      distEl.textContent = dist + ' meters (GPS accuracy: ±' + accuracy + 'm)';

      if (dist <= radius) {
        dot.className = 'gps-dot green';
        text.textContent = 'You are on campus ✓ (' + dist + 'm away)';
        markBtn.disabled = false;
        markBtnText.textContent = '✅ Mark Attendance';
        hideMsg(dashMsg);
      } else {
        dot.className = 'gps-dot red';
        text.textContent = 'You are NOT on campus (' + dist + 'm away, limit: ' + radius + 'm)';
        markBtn.disabled = true;
        markBtnText.textContent = '🚫 Not on Campus';
        showMsg(dashMsg, 'You are not in Campus! Must be within ' + radius + 'm. You are ' + dist + 'm away.', 'error');
      }
    })
    .catch(err => {
      dot.className = 'gps-dot red';
      text.textContent = 'Location access denied — please allow in browser settings.';
      showMsg(dashMsg, 'Please allow location access to mark attendance.', 'error');
    });
}

// ===== MARK ATTENDANCE =====
async function markAttendance() {
  const btn = document.getElementById('markBtn');
  const markBtnText = document.getElementById('markBtnText');
  const dashMsg = document.getElementById('dashMsg');

  if (!sessionData || !studentLat) return;

  btn.disabled = true;
  markBtnText.innerHTML = '<span class="spinner"></span> Marking...';

  try {
    const result = await apiCall('markAttendance', {
      rollNo: currentStudent.rollNo,
      name: currentStudent.name,
      year: currentStudent.year,
      sessionId: sessionData.id,
      subject: sessionData.subject,
      lat: studentLat,
      lon: studentLon,
      timestamp: new Date().toISOString()
    });

    if (result.success) {
      showMsg(dashMsg, '✅ Attendance marked successfully! ' + formatDateTime(new Date()), 'success');
      btn.disabled = true;
      markBtnText.textContent = '✓ Marked';
      loadMyAttendance();
    } else {
      showMsg(dashMsg, result.message || 'Failed to mark attendance.', 'error');
      btn.disabled = false;
      markBtnText.textContent = '✅ Mark Attendance';
    }
  } catch (e) {
    showMsg(dashMsg, 'Error: ' + e.message, 'error');
    btn.disabled = false;
    markBtnText.textContent = '✅ Mark Attendance';
  }
}

// ===== MY ATTENDANCE =====
async function loadMyAttendance() {
  const el = document.getElementById('attendanceTable');
  el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:16px;font-size:13px">Loading...</div>';

  try {
    const result = await apiCall('getStudentAttendance', {
      rollNo: currentStudent.rollNo,
      year: currentStudent.year
    });

    if (result.records && result.records.length > 0) {
      let html = '<div class="table-wrap"><table><thead><tr><th>Date</th><th>Subject</th><th>Time</th><th>Status</th></tr></thead><tbody>';
      result.records.forEach(r => {
        html += '<tr>' +
          '<td style="font-family:\'DM Mono\',monospace">' + r.date + '</td>' +
          '<td>' + r.subject + '</td>' +
          '<td style="font-family:\'DM Mono\',monospace">' + r.time + '</td>' +
          '<td><span class="chip active">Present</span></td>' +
          '</tr>';
      });
      html += '</tbody></table></div>';
      html += '<div style="text-align:right;font-size:12px;color:var(--muted);margin-top:10px">Total: ' + result.records.length + ' session(s)</div>';
      el.innerHTML = html;
    } else {
      el.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;font-size:13px">No attendance records yet.</div>';
    }
  } catch (e) {
    el.innerHTML = '<div style="color:var(--danger);padding:16px;font-size:13px">Failed to load: ' + e.message + '</div>';
  }
}

// ===== LOGOUT =====
function logout() {
  clearSession();
  currentStudent = null;
  sessionData = null;
  studentLat = null;
  studentLon = null;
  document.getElementById('dashSection').style.display = 'none';
  document.getElementById('loginSection').style.display = 'block';
  document.getElementById('rollNo').value = '';
  document.getElementById('password').value = '';
  hideMsg(document.getElementById('loginMsg'));
}

// ===== RESTORE SESSION =====
window.addEventListener('DOMContentLoaded', () => {
  const saved = getSession('student');
  if (saved) {
    currentStudent = saved;
    showDashboard();
  }
});

document.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    if (document.getElementById('loginSection').style.display !== 'none') studentLogin();
  }
});