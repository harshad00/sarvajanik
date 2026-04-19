// ===== CONFIG.JS =====
// !! FILL IN YOUR VALUES BELOW — then you never need setup.html again !!

const HARDCODED_CONFIG = {
  collegeName: 'BCA College Ahmedabad',
  scriptUrl: 'https://script.google.com/macros/s/AKfycbyuJ2m3Gy0qpcT8KtfRccumLM-csysITP_i814N12oNHBUwqTEP1CivcN-EIn5ggP-NPQ/exec',
  campusLat: '23.6008',   // ← already correct from your screenshot
  campusLon: '72.3953',   // ← already correct
  campusRadius: '150'
};

// ============================================================
// DO NOT EDIT BELOW THIS LINE
// ============================================================

function getConfig() {
  // Always return hardcoded config — no setup.html needed
  return HARDCODED_CONFIG;
}

// ===== API HELPER =====
async function apiCall(action, payload = {}) {
  const cfg = getConfig();
  if (!cfg.scriptUrl || cfg.scriptUrl.includes('YOUR_APPS_SCRIPT')) {
    throw new Error('Please fill in your scriptUrl in config.js');
  }

  const res = await fetch(cfg.scriptUrl, {
    method: 'POST',
    body: JSON.stringify({ action, payload }),
  });

  if (!res.ok) throw new Error('Server error: ' + res.status);
  const data = await res.json();
  if (data && data.error) throw new Error(data.error);
  return data;
}

// ===== GPS HELPERS =====
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported in this browser.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    });
  });
}

// Haversine formula — returns distance in meters
function getDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ===== DATE/TIME =====
function formatDate(d) {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return dd + '/' + mm + '/' + yyyy;
}

function formatTime(d) {
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(d) {
  return formatDate(d) + ' ' + formatTime(d);
}

// ===== SESSION STORAGE HELPERS =====
function setSession(key, val) {
  sessionStorage.setItem(key, JSON.stringify(val));
}
function getSession(key) {
  const v = sessionStorage.getItem(key);
  return v ? JSON.parse(v) : null;
}
function clearSession() {
  sessionStorage.clear();
}

// ===== SHOW/HIDE MESSAGES =====
function showMsg(el, text, type) {
  if (!el) return;
  el.textContent = text;
  el.className = 'msg msg-' + (type || 'info') + ' show';
}
function hideMsg(el) {
  if (el) el.className = 'msg';
}