# MedCare Hospital Management System

A complete, production-ready, multi-site Hospital Management System (HMS) built with **Python (Flask)** and SQLite, with a Bootstrap 5 frontend.

> **The backend has been converted from Node.js/Express to Python/Flask.** The original Node.js files are still present for reference. Use `app.py` (Python) as the primary server.

---

## Screenshots

| Login | Dashboard |
|-------|-----------|
| ![Login](https://github.com/user-attachments/assets/c6e48797-e5e0-4d9a-991b-ea062c7e70bb) | ![Dashboard](https://github.com/user-attachments/assets/9037bf2e-1b07-415a-86be-7e62bb3a65b4) |

| Patients | About |
|----------|-------|
| ![Patients](https://github.com/user-attachments/assets/9ce5ccc9-4f11-4bc9-aa76-6248698e20b2) | ![About](https://github.com/user-attachments/assets/d8ea51bd-a1c2-4747-aec2-c04596ac4555) |

---

## Features

- **Patient Records** – Full CRUD, search, pagination, print patient record
- **Appointment Scheduling** – Calendar/list views, doctor & department assignment, print slips
- **Billing & Invoicing** – Line items, discounts, tax, payment recording, print invoices
- **Role-Based Access** – Admin, Doctor, Nurse roles with distinct dashboards
- **User Management** – Admin-only user CRUD, activate/deactivate accounts
- **Audit Logs** – Compliance-ready activity trail for all create/update/delete actions
- **Site Configuration** – Add sites, wards, departments via UI — no code changes needed
- **Multi-Site SaaS** – Single instance manages multiple hospital facilities
- **Multi-Language** – 9 languages: English, German, French, Dutch, Urdu, Hindi, Arabic, Chinese (Simplified), Japanese; RTL auto-applied for Arabic & Urdu
- **Multi-Currency** – 12 currencies (USD, EUR, GBP, AED, PKR, INR, CNY, JPY, SAR, TRY, CAD, AUD)
- **Backup & Restore** – One-click database backup download and restore via the Settings UI
- **Offline / PWA** – Service Worker caches assets for offline availability
- **Print Support** – Clean print stylesheets on every procedure page
- **Keyboard Shortcuts** – Global hotkeys for fast navigation and actions

---

## System Requirements

- **Python 3.9 or later** (recommended: Python 3.11+)
- pip (bundled with Python)
- Any OS: Linux, macOS, Windows

---

## Step-by-Step Installation & Configuration Guide

### Step 1 — Install Python

Download and install Python **3.9 or later** from <https://python.org>.

Verify:

```bash
python --version   # should print 3.9 or higher
pip --version
```

---

### Step 2 — Clone the Repository

```bash
git clone https://github.com/redsky991-byte/hospital-management-system.git
cd hospital-management-system
```

---

### Step 3 — Install Dependencies

```bash
pip install -r requirements.txt
```

This installs Flask, flask-cors, PyJWT, bcrypt, and python-dotenv.

---

### Step 4 — Configure Environment Variables

Create a `.env` file in the project root:

```bash
# Windows
copy .env.example .env

# Linux / macOS
cp .env.example .env
```

Open `.env` and set the following values:

```env
PORT=3000
JWT_SECRET=replace-this-with-a-long-random-string
```

| Variable     | Default       | Description                                              |
|--------------|---------------|----------------------------------------------------------|
| `PORT`       | `3000`        | TCP port the server listens on                           |
| `JWT_SECRET` | —             | **Required.** Secret key used to sign authentication tokens. Use a random string of at least 32 characters. |

> **Tip:** Generate a secure secret with:
> ```bash
> python -c "import secrets; print(secrets.token_hex(32))"
> ```

---

### Step 5 — Start the Server

```bash
python app.py
```

You should see:

```
MedCare HMS running on http://localhost:3000
```

Open **http://localhost:3000** in your browser.

---

### Step 6 — First Login

| Field    | Value              |
|----------|--------------------|
| Email    | admin@hospital.com |
| Password | Admin@123          |
| Role     | Admin              |

> ⚠️ **Change the admin password immediately** after first login via **Users → Edit**.

---

### Step 7 — Initial Application Configuration (Admin UI)

All post-install configuration is done inside the app under **Settings** (Admin only).

#### 7a — Add a Hospital Site

1. Go to **Settings → Sites**.
2. Click **Add Site**.
3. Enter the site name (e.g., *Main Hospital*) and click **Save**.

#### 7b — Add Wards

1. Go to **Settings → Wards**.
2. Select the site, enter a ward name (e.g., *General Ward*), and click **Save**.

#### 7c — Add Departments

1. Go to **Settings → Departments**.
2. Select the site, enter a department name (e.g., *Cardiology*), and click **Save**.

#### 7d — Create Staff Accounts

1. Go to **Users → Add User**.
2. Fill in name, email, password, select a role (**Admin / Doctor / Nurse**) and assign a site.
3. Click **Save**.

#### 7e — Configure System Settings

1. Go to **Settings → Language & Region**.
2. Choose the **Language** (English, German, French, Dutch, Urdu, Hindi, Arabic, Chinese, Japanese).
3. Choose the **Currency** (USD, EUR, GBP, AED, PKR, INR, CNY, JPY, SAR, TRY, CAD, AUD).
4. Choose the **Date Format** (YYYY-MM-DD, DD/MM/YYYY, MM/DD/YYYY).
5. Click **Save Settings**.

> Language and currency preferences are stored per-browser (localStorage). The system-wide defaults are saved in the database under `Settings → Language & Region`.

---

### Step 8 — Daily Workflow

| Task                      | Where to go                   |
|---------------------------|-------------------------------|
| Register a new patient    | Patients → Add Patient        |
| Book an appointment       | Appointments → New Appointment|
| Issue a bill              | Billing → Create Invoice      |
| Record a payment          | Billing → View → Record Payment |
| Review activity           | Audit Logs                    |

---

## Default Credentials

| Field    | Value                  |
|----------|------------------------|
| Email    | admin@hospital.com     |
| Password | Admin@123              |
| Role     | Admin                  |

> **Change the admin password immediately after first login via the Users page.**

---

## Environment Variables Reference

| Variable     | Required | Default       | Description                        |
|--------------|----------|---------------|------------------------------------|
| `PORT`       | No       | `3000`        | HTTP port to listen on             |
| `JWT_SECRET` | Yes      | —             | Secret for signing JWT tokens      |
| `NODE_ENV`   | No       | `development` | Set to `production` for live deployments |

---

## Keyboard Shortcuts

All shortcut keys work on any page once you are logged in. Press `?` at any time to open the in-app shortcut reference.

### Navigation

| Shortcut | Action             |
|----------|--------------------|
| `G` then `D` | Go to Dashboard    |
| `G` then `P` | Go to Patients     |
| `G` then `A` | Go to Appointments |
| `G` then `B` | Go to Billing      |
| `G` then `U` | Go to Users        |
| `G` then `L` | Go to Audit Logs   |
| `G` then `S` | Go to Settings     |
| `G` then `H` | Go to Help         |

### Actions

| Shortcut       | Action                              |
|----------------|-------------------------------------|
| `N`            | Open "New / Add" modal on current page |
| `/` or `F`     | Focus the search box           |
| `Escape`       | Close any open modal                |
| `Ctrl + P`     | Print current view                  |
| `?`            | Show / hide keyboard shortcut help  |

---

## Project Structure

```
├── server.js              # Express application entry point
├── package.json
├── .env                   # Environment config (create from .env.example)
├── database/
│   ├── db.js              # SQLite connection + seeding
│   └── schema.sql         # Database schema
├── routes/                # API route handlers
│   ├── auth.js
│   ├── patients.js
│   ├── appointments.js
│   ├── billing.js
│   ├── users.js
│   ├── audit.js
│   └── settings.js
├── middleware/
│   ├── authMiddleware.js  # JWT verification + role guard
│   └── auditMiddleware.js # Automatic action logging
├── public/                # Static frontend files
│   ├── index.html         # Login page
│   ├── dashboard.html
│   ├── patients.html
│   ├── appointments.html
│   ├── billing.html
│   ├── users.html
│   ├── audit.html
│   ├── settings.html
│   ├── about.html
│   ├── help.html          # User manual & shortcut reference
│   ├── css/style.css
│   ├── js/
│   │   ├── api.js
│   │   ├── auth.js
│   │   ├── shortcuts.js   # Global keyboard shortcut handler
│   │   └── ...
│   └── sw.js              # Service Worker (PWA/offline)
└── data/                  # SQLite database (auto-created, git-ignored)
```

---

## API Endpoints

| Method | Endpoint                        | Description                    | Roles        |
|--------|---------------------------------|--------------------------------|--------------|
| POST   | /api/auth/login                 | Login, returns JWT             | Public       |
| GET    | /api/auth/me                    | Current user profile           | All          |
| GET    | /api/patients                   | List patients                  | All          |
| POST   | /api/patients                   | Create patient                 | All          |
| PUT    | /api/patients/:id               | Update patient                 | All          |
| DELETE | /api/patients/:id               | Delete patient                 | Admin        |
| GET    | /api/appointments               | List appointments              | All          |
| POST   | /api/appointments               | Create appointment             | All          |
| PUT    | /api/appointments/:id           | Update appointment             | All          |
| DELETE | /api/appointments/:id           | Delete appointment             | Admin        |
| GET    | /api/billing                    | List invoices                  | All          |
| POST   | /api/billing                    | Create invoice                 | All          |
| PUT    | /api/billing/:id                | Update invoice                 | Admin        |
| POST   | /api/billing/:id/payment        | Record payment                 | Admin        |
| GET    | /api/users                      | List users                     | Admin        |
| POST   | /api/users                      | Create user                    | Admin        |
| PUT    | /api/users/:id                  | Update user                    | Admin        |
| DELETE | /api/users/:id                  | Delete user                    | Admin        |
| GET    | /api/audit                      | View audit logs                | Admin        |
| GET    | /api/settings/system            | Get system settings            | Admin        |
| PUT    | /api/settings/system            | Update language/currency/date  | Admin        |
| GET    | /api/settings/backup            | Download database backup file  | Admin        |
| POST   | /api/settings/restore           | Restore database from backup   | Admin        |
| GET    | /api/settings/sites             | List sites                     | Admin        |
| POST   | /api/settings/sites             | Add site                       | Admin        |
| PUT    | /api/settings/sites/:id         | Update site                    | Admin        |
| DELETE | /api/settings/sites/:id         | Delete site                    | Admin        |
| GET    | /api/settings/wards             | List wards                     | Admin        |
| POST   | /api/settings/wards             | Add ward                       | Admin        |
| PUT    | /api/settings/wards/:id         | Update ward                    | Admin        |
| DELETE | /api/settings/wards/:id         | Delete ward                    | Admin        |
| GET    | /api/settings/departments       | List departments               | Admin        |
| POST   | /api/settings/departments       | Add department                 | Admin        |
| PUT    | /api/settings/departments/:id   | Update department              | Admin        |
| DELETE | /api/settings/departments/:id   | Delete department              | Admin        |

---

## Multi-Language & Multi-Currency

### Languages

MedCare HMS ships with 9 built-in UI languages. Switch at any time using the language picker in the top-right corner, or via **Settings → Language & Region**.

| Code | Language            | RTL |
|------|---------------------|-----|
| `en` | English             | No  |
| `de` | German              | No  |
| `fr` | French              | No  |
| `nl` | Dutch               | No  |
| `ur` | Urdu                | Yes |
| `hi` | Hindi               | No  |
| `ar` | Arabic              | Yes |
| `zh` | Chinese (Simplified)| No  |
| `ja` | Japanese            | No  |

> RTL layout is automatically applied for Arabic and Urdu.

### Currencies

12 currencies are supported. The currency symbol is shown on all billing amounts.

| Code  | Currency            | Symbol |
|-------|---------------------|--------|
| `USD` | US Dollar           | $      |
| `EUR` | Euro                | €      |
| `GBP` | British Pound       | £      |
| `AED` | UAE Dirham          | د.إ    |
| `PKR` | Pakistani Rupee     | ₨      |
| `INR` | Indian Rupee        | ₹      |
| `CNY` | Chinese Yuan        | ¥      |
| `JPY` | Japanese Yen        | ¥      |
| `SAR` | Saudi Riyal         | ﷼      |
| `TRY` | Turkish Lira        | ₺      |
| `CAD` | Canadian Dollar     | C$     |
| `AUD` | Australian Dollar   | A$     |

Language and currency selections are stored in the browser (`localStorage`) and are also saved as system defaults in the database via **Settings → Language & Region**.

---

## Backup & Restore

MedCare HMS provides a one-click backup and restore interface under **Settings → Backup & Restore** (Admin only).

### Download a Backup

1. Go to **Settings → Backup & Restore**.
2. Click **Download Backup**.
3. A `.db` file (e.g. `hospital-backup-2025-06-01T12-00-00.db`) is downloaded to your machine.

> The backup uses `better-sqlite3`'s `db.backup()` API for a WAL-safe, consistent snapshot — no data is missed even under write load.

### Restore from Backup

1. Go to **Settings → Backup & Restore**.
2. Click **Choose Backup File** and select a previously downloaded `.db` file.
3. Click **Restore Database**.
4. The server validates the file, replaces the live database, and exits so a process manager (PM2 or systemd) can restart it automatically.
5. Wait a few seconds, then reload the page.

> ⚠️ **Restoring replaces ALL current data.** Always download a fresh backup before restoring.

---



### Production checklist

1. Set a strong `JWT_SECRET` in `.env`
2. Change the default admin password
3. Use a process manager such as [PM2](https://pm2.keymetrics.io/):

```bash
npm install -g pm2
pm2 start server.js --name medcare-hms
pm2 save
pm2 startup
```

4. Place behind a reverse proxy (Nginx/Apache) for HTTPS
5. Back up the `data/hospital.db` file regularly

### Docker (optional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| *Port already in use* | Change `PORT` in `.env` or stop the conflicting process |
| *Cannot find module 'better-sqlite3'* | Run `npm install` again; on Windows ensure build tools are installed (`npm install --global windows-build-tools`) |
| *JWT errors / "Unauthorized"* | Ensure `JWT_SECRET` is set in `.env` and matches across restarts |
| *Database locked* | Only one process should access the SQLite file; restart the server |
| *PWA not updating* | Clear browser cache or unregister the service worker in DevTools → Application |

---

## Developer

**Zulfiqar Ali**  
Full Stack Developer  
🌐 [www.maxtechfix.com](http://www.maxtechfix.com)

---

## License

MIT

