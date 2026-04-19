# 🎓 College Attendance System

GPS-verified attendance system for colleges. Free to deploy on GitHub Pages.

---

## 📦 Files

| File | Purpose |
|------|---------|
| `index.html` | Landing page |
| `student.html` | Student login + attendance |
| `admin.html` | Admin dashboard |
| `setup.html` | First-time configuration |
| `style.css` | All styles |
| `config.js` | Shared JS utilities |
| `student.js` | Student logic |
| `admin.js` | Admin logic |
| `appscript.js` | Paste into Google Apps Script |

---

## 🚀 Step-by-Step Setup

### Step 1 — Create Google Sheets

Create **5 separate Google Sheets** (or 5 tabs in one):

#### FY Sheet (repeat same for SY and TY)
Tab name: `Students`
| RollNo | Name | Password | Year |
|--------|------|----------|------|
| FY001 | Rohan Mehta | _(leave blank = default is roll no)_ | FY |
| FY002 | Priya Shah | | FY |

> **Password column**: Leave blank OR put the roll no. On first login, students are forced to change it.

#### Admin Sheet
Tab name: `Admins`
| AdminID | Name | Password |
|---------|------|----------|
| admin1 | Prof. Sharma | yourpassword |

Tab name: `Sessions`
Headers (row 1):
`ID | Year | Subject | Date | Time | TimeLimit | AdminID | AdminName | Lat | Lon | Active | StartTimestamp`

#### Attendance Sheet
Tab name: `Attendance`
Headers (row 1):
`Date | Year | RollNo | Name | Subject | Time | SessionID | Lat | Lon`

---

### Step 2 — Google Apps Script

1. Go to [script.google.com](https://script.google.com)
2. Click **New Project**
3. Delete default code, paste contents of `appscript.js`
4. Fill in your Sheet IDs at the top of the file:
   ```js
   const SHEET_IDS = {
     FY:         'your-fy-sheet-id',
     SY:         'your-sy-sheet-id',
     TY:         'your-ty-sheet-id',
     Admin:      'your-admin-sheet-id',
     Attendance: 'your-attendance-sheet-id'
   };
   ```
   > Get Sheet ID from URL: `docs.google.com/spreadsheets/d/**THIS_PART**/edit`
5. Click **Deploy → New Deployment**
6. Type: **Web App**
7. Execute as: **Me**
8. Who has access: **Anyone**
9. Click **Deploy** → Copy the URL

---

### Step 3 — Configure the Website

1. Open `setup.html` in your browser (or after deploying to GitHub)
2. Enter College Name
3. Click "Auto-detect" to set campus location (or type lat/lon manually)
4. Paste the Apps Script URL
5. Click **Save** → Test Connection

---

### Step 4 — Deploy to GitHub Pages (Free)

1. Create a GitHub account at [github.com](https://github.com)
2. Click **New Repository** → name it `college-attendance`
3. Upload all 9 files
4. Go to **Settings → Pages → Source: main branch → Save**
5. Your site: `https://yourusername.github.io/college-attendance/`

---

## 🔐 Login System

### Students
- **Username**: Roll Number (e.g. `FY001`)
- **Default Password**: Same as Roll Number
- **First Login**: Popup forces password change
- After changing, uses new password forever

### Admin
- Username + Password from the Admin sheet

---

## 📍 GPS Logic

When a student marks attendance:
1. Browser gets their GPS coordinates
2. System calculates distance to campus (Haversine formula)
3. If within radius (default 200m) → ✅ Allowed
4. If outside → ❌ "You are not in Campus!" message

---

## 📊 Attendance Sheets Auto-Created

When admin creates a session for FY, a sheet tab `FY Attendance` is auto-created:

| RollNo | Name | 16/04/2025 | 17/04/2025 | ... |
|--------|------|-----------|-----------|-----|
| FY001 | Rohan | P | P | |
| FY002 | Priya | | P | |

---

## 🆘 Troubleshooting

| Problem | Fix |
|---------|-----|
| "Apps Script URL not set" | Run setup.html first |
| GPS not working | Allow location in browser settings |
| Login fails | Check sheet column names match exactly |
| CORS error | Make sure Apps Script is deployed as "Anyone" |

Deployment ID
AKfycbxKGi4Mr6wU92Xz2YP07pgZw5dgTgKIcYHoY1r5QbXHuJjun6Gq5jYCtLED0dD0q4IhIQ
Web app
URL
https://script.google.com/macros/s/AKfycbxKGi4Mr6wU92Xz2YP07pgZw5dgTgKIcYHoY1r5QbXHuJjun6Gq5jYCtLED0dD0q4IhIQ/exec
