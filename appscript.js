// ===== GOOGLE APPS SCRIPT — appscript.js =====
// Paste this entire file into: script.google.com → New Project
// Then: Deploy → New Deployment → Web App → Anyone → Deploy
// Copy the URL into your setup.html

// ============================================================
// ⚙️  FILL THESE IN WITH YOUR ACTUAL GOOGLE SHEET IDs
// ============================================================
const SHEET_IDS = {
  FY:         'YOUR_FY_SHEET_ID_HERE',
  SY:         'YOUR_SY_SHEET_ID_HERE',
  TY:         'YOUR_TY_SHEET_ID_HERE',
  Admin:      'YOUR_ADMIN_SHEET_ID_HERE',
  Attendance: 'YOUR_ATTENDANCE_SHEET_ID_HERE'  // master attendance log
};

// Sheet tab names within each spreadsheet
const TAB = {
  students:   'Students',   // in FY / SY / TY sheets: Roll No | Name | Password | Year
  admins:     'Admins',     // in Admin sheet: AdminID | Name | Password
  sessions:   'Sessions',   // in Admin sheet: ID | Year | Subject | Date | Time | TimeLimit | AdminID | AdminName | Lat | Lon | Active | StartTimestamp
  attendance: 'Attendance'  // in Attendance sheet: Date | Year | RollNo | Name | Subject | Time | SessionID | Lat | Lon
};

// ============================================================
// ROUTER
// ============================================================
function doGet(e) {
  const action  = e.parameter.action || '';
  const payload = JSON.parse(decodeURIComponent(e.parameter.payload || '{}'));

  let result;
  try {
    switch (action) {
      case 'ping':                  result = { pong: true }; break;
      case 'studentLogin':          result = studentLogin(payload); break;
      case 'changeStudentPassword': result = changeStudentPassword(payload); break;
      case 'adminLogin':            result = adminLogin(payload); break;
      case 'createSession':         result = createSession(payload); break;
      case 'endSession':            result = endSession(payload); break;
      case 'getActiveSession':      result = getActiveSession(payload); break;
      case 'getActiveSessions':     result = getActiveSessions(); break;
      case 'markAttendance':        result = markAttendance(payload); break;
      case 'getStudentAttendance':  result = getStudentAttendance(payload); break;
      case 'getRecords':            result = getRecords(payload); break;
      case 'getStudents':           result = getStudents(payload); break;
      default: result = { error: 'Unknown action: ' + action };
    }
  } catch (err) {
    result = { error: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// HELPERS
// ============================================================
function getSheet(sheetId, tabName) {
  return SpreadsheetApp.openById(sheetId).getSheetByName(tabName);
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0].map(h => String(h).trim());
  return data.slice(1).map(row =>
    Object.fromEntries(headers.map((h, i) => [h, String(row[i]).trim()]))
  );
}

function generateId() {
  return Utilities.getUuid().replace(/-/g,'').substring(0, 12);
}

// ============================================================
// STUDENT LOGIN
// Expected sheet columns: RollNo | Name | Password | Year
// Default password = Roll No
// ============================================================
function studentLogin({ rollNo, password }) {
  const years = ['FY','SY','TY'];
  for (const year of years) {
    const sheet = getSheet(SHEET_IDS[year], TAB.students);
    const rows = sheetToObjects(sheet);
    const student = rows.find(r => r.RollNo.toUpperCase() === rollNo.toUpperCase());
    if (student) {
      const storedPwd = student.Password || student.RollNo; // default = roll no
      if (storedPwd === password || (storedPwd === '' && password === rollNo)) {
        const isDefaultPassword = (storedPwd === rollNo || storedPwd === '');
        return {
          success: true,
          isDefaultPassword,
          student: { rollNo: student.RollNo, name: student.Name, year }
        };
      } else {
        return { success: false, message: 'Incorrect password.' };
      }
    }
  }
  return { success: false, message: 'Roll Number not found.' };
}

// ============================================================
// CHANGE STUDENT PASSWORD
// ============================================================
function changeStudentPassword({ rollNo, year, newPassword }) {
  const sheet = getSheet(SHEET_IDS[year], TAB.students);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const rollCol = headers.indexOf('RollNo');
  const pwdCol  = headers.indexOf('Password');

  if (rollCol === -1 || pwdCol === -1)
    return { success: false, message: 'Sheet columns not found. Ensure: RollNo, Name, Password, Year' };

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][rollCol]).trim().toUpperCase() === rollNo.toUpperCase()) {
      sheet.getRange(i+1, pwdCol+1).setValue(newPassword);
      return { success: true };
    }
  }
  return { success: false, message: 'Student not found.' };
}

// ============================================================
// ADMIN LOGIN
// Admin sheet > Admins tab: AdminID | Name | Password
// ============================================================
function adminLogin({ adminId, password }) {
  const sheet = getSheet(SHEET_IDS.Admin, TAB.admins);
  const admins = sheetToObjects(sheet);
  const admin = admins.find(a => a.AdminID === adminId && a.Password === password);
  if (admin) {
    return { success: true, admin: { adminId: admin.AdminID, name: admin.Name } };
  }
  return { success: false, message: 'Invalid Admin ID or Password.' };
}

// ============================================================
// CREATE SESSION
// Admin sheet > Sessions tab
// ============================================================
function createSession(data) {
  const sheet = getSheet(SHEET_IDS.Admin, TAB.sessions);
  const id = generateId();
  sheet.appendRow([
    id,
    data.year,
    data.subject,
    data.date,
    data.time,
    data.timeLimit,
    data.adminId,
    data.adminName,
    data.lat || '',
    data.lon || '',
    'ACTIVE',
    data.startTimestamp
  ]);

  // Auto-create year attendance sheet if it doesn't exist
  ensureYearAttendanceSheet(data.year, data.date);

  return { success: true, sessionId: id };
}

// ============================================================
// ENSURE ATTENDANCE SHEET EXISTS FOR YEAR
// ============================================================
function ensureYearAttendanceSheet(year, date) {
  const ss = SpreadsheetApp.openById(SHEET_IDS.Attendance);
  const tabName = year + ' Attendance';
  let sheet = ss.getSheetByName(tabName);
  if (!sheet) {
    sheet = ss.insertSheet(tabName);
    // Header row: Year | Date columns will be added dynamically
    sheet.appendRow([year, '', '', '', '', '', '', '']);
    sheet.getRange(1,1,1,8).setValues([[year + ' ATTENDANCE REGISTER', '', '', '', '', '', '', '']]);
    // Row 2 onwards: RollNo | Name | ... dates
    sheet.appendRow(['RollNo', 'Name']);
  }
}

// ============================================================
// END SESSION
// ============================================================
function endSession({ sessionId }) {
  const sheet = getSheet(SHEET_IDS.Admin, TAB.sessions);
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(h => String(h).trim());
  const idCol     = headers.indexOf('ID');
  const activeCol = headers.indexOf('Active');

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][idCol]).trim() === sessionId) {
      sheet.getRange(i+1, activeCol+1).setValue('ENDED');
      return { success: true };
    }
  }
  return { success: false, message: 'Session not found.' };
}

// ============================================================
// GET ACTIVE SESSION (for specific year — for students)
// ============================================================
function getActiveSession({ year }) {
  const sheet = getSheet(SHEET_IDS.Admin, TAB.sessions);
  const rows = sheetToObjects(sheet);
  const now = new Date();

  const session = rows.find(r => {
    if (r.Year !== year || r.Active !== 'ACTIVE') return false;
    // Check if within time limit
    const start = new Date(r.StartTimestamp);
    const elapsedMin = (now - start) / 60000;
    return elapsedMin <= parseInt(r.TimeLimit);
  });

  if (session) {
    return {
      session: {
        id: session.ID,
        year: session.Year,
        subject: session.Subject,
        startTime: session.Date + ' ' + session.Time,
        timeLimit: session.TimeLimit,
        adminLat: session.Lat,
        adminLon: session.Lon
      }
    };
  }

  // Auto-expire sessions past time limit
  return { session: null };
}

// ============================================================
// GET ALL ACTIVE SESSIONS (for admin dashboard)
// ============================================================
function getActiveSessions() {
  const sheet = getSheet(SHEET_IDS.Admin, TAB.sessions);
  const rows = sheetToObjects(sheet);
  const now = new Date();

  const sessions = rows.filter(r => {
    if (r.Active !== 'ACTIVE') return false;
    const start = new Date(r.StartTimestamp);
    const elapsedMin = (now - start) / 60000;
    return elapsedMin <= parseInt(r.TimeLimit);
  }).map(r => ({
    id: r.ID, year: r.Year, subject: r.Subject,
    date: r.Date, time: r.Time,
    timeLimit: r.TimeLimit, adminName: r.AdminName
  }));

  return { sessions };
}

// ============================================================
// MARK ATTENDANCE
// Attendance sheet: Date | Year | RollNo | Name | Subject | Time | SessionID | Lat | Lon
// Also adds to the year-specific columnar sheet
// ============================================================
function markAttendance(data) {
  // Check duplicate for this session
  const sheet = getSheet(SHEET_IDS.Attendance, TAB.attendance);
  const rows = sheetToObjects(sheet);
  const already = rows.find(r => r.RollNo === data.rollNo && r.SessionID === data.sessionId);
  if (already) return { success: false, message: 'You have already marked attendance for this session.' };

  const now = new Date();
  const timeStr = formatTime(now);
  const dateStr = formatDate(now);

  // Append to master log
  sheet.appendRow([
    dateStr, data.year, data.rollNo, data.name,
    data.subject, timeStr, data.sessionId, data.lat, data.lon
  ]);

  // Also add to year columnar sheet
  addToYearSheet(data.year, data.rollNo, data.name, dateStr);

  return { success: true };
}

// ============================================================
// ADD TO YEAR COLUMNAR SHEET
// Year sheet format: Row 1 = FY ATTENDANCE REGISTER | Row 2 = RollNo | Name | dd/mm/yyyy ...
// ============================================================
function addToYearSheet(year, rollNo, name, dateStr) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_IDS.Attendance);
    const tabName = year + ' Attendance';
    let sheet = ss.getSheetByName(tabName);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    const headerRow = data[1]; // Row 2 = RollNo | Name | date1 | date2 ...

    // Find or add date column
    let dateCol = headerRow.indexOf(dateStr);
    if (dateCol === -1) {
      dateCol = headerRow.length;
      sheet.getRange(2, dateCol+1).setValue(dateStr);
    }

    // Find or add student row
    let studentRow = -1;
    for (let i = 2; i < data.length; i++) {
      if (String(data[i][0]).trim() === rollNo) { studentRow = i; break; }
    }
    if (studentRow === -1) {
      sheet.appendRow([rollNo, name]);
      studentRow = sheet.getLastRow() - 1;
    }

    // Mark 'P'
    sheet.getRange(studentRow+1, dateCol+1).setValue('P');
  } catch(e) {
    // Non-critical, ignore
  }
}

// ============================================================
// GET STUDENT ATTENDANCE HISTORY
// ============================================================
function getStudentAttendance({ rollNo, year }) {
  const sheet = getSheet(SHEET_IDS.Attendance, TAB.attendance);
  const rows = sheetToObjects(sheet);
  const records = rows
    .filter(r => r.RollNo === rollNo && r.Year === year)
    .map(r => ({ date: r.Date, subject: r.Subject, time: r.Time }));
  return { records };
}

// ============================================================
// GET RECORDS (admin view)
// ============================================================
function getRecords({ year, date }) {
  const sheet = getSheet(SHEET_IDS.Attendance, TAB.attendance);
  const rows = sheetToObjects(sheet);
  let records = rows;
  if (year) records = records.filter(r => r.Year === year);
  if (date) {
    // date from input is yyyy-mm-dd, convert to dd/mm/yyyy for comparison
    const parts = date.split('-');
    const formatted = parts[2] + '/' + parts[1] + '/' + parts[0];
    records = records.filter(r => r.Date === formatted);
  }
  return { records: records.map(r => ({
    date: r.Date, year: r.Year, rollNo: r.RollNo,
    name: r.Name, subject: r.Subject, time: r.Time
  }))};
}

// ============================================================
// GET STUDENTS LIST
// ============================================================
function getStudents({ year }) {
  const sheet = getSheet(SHEET_IDS[year], TAB.students);
  const rows = sheetToObjects(sheet);
  return {
    students: rows.map(r => ({
      rollNo: r.RollNo,
      name: r.Name,
      isDefaultPwd: (!r.Password || r.Password === r.RollNo)
    }))
  };
}

// ============================================================
// DATE/TIME HELPERS
// ============================================================
function formatDate(d) {
  const dd = String(d.getDate()).padStart(2,'0');
  const mm = String(d.getMonth()+1).padStart(2,'0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function formatTime(d) {
  const hh = String(d.getHours()).padStart(2,'0');
  const min = String(d.getMinutes()).padStart(2,'0');
  return `${hh}:${min}`;
}
