# MedCare Hospital Management System

A complete, production-ready, multi-site Hospital Management System (HMS) built with **Java (Spring Boot 3)** and SQLite, with a Bootstrap 5 frontend.

> **The primary backend is now Java/Spring Boot**, located in the `java-backend/` directory.  
> The original Node.js (`server.js`) and Python (`app.py`) backends are kept for reference only.

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

- **Java 17 or later** (recommended: Java 21 LTS)
- **Maven 3.6 or later** (or use the included `mvnw` wrapper)
- Any OS: Linux, macOS, Windows

---

## Step-by-Step Installation & Configuration Guide

### Step 1 — Install Java

Download and install **Java 17+** from <https://adoptium.net> (Temurin) or any distribution.

Verify:

```bash
java -version   # should print 17 or higher
```

Install **Maven 3.6+** from <https://maven.apache.org/download.cgi> or use `mvnw` (included in `java-backend/`).

Verify:

```bash
mvn -version
```

---

### Step 2 — Clone the Repository

```bash
git clone https://github.com/redsky991-byte/hospital-management-system.git
cd hospital-management-system
```

---

### Step 3 — Configure the Application

All configuration lives in `java-backend/src/main/resources/application.properties`.  
For production, override settings with environment variables or a local properties file.

Key settings:

| Property | Default | Description |
|---|---|---|
| `server.port` | `3000` | TCP port the server listens on |
| `app.jwt.secret` | `medcare-secret-key-2024` | **Change in production.** Secret used to sign JWT tokens (override via `JWT_SECRET` env var) |
| `spring.datasource.url` | `jdbc:sqlite:../data/hospital.db` | Path to the SQLite database file |
| `app.jwt.expiration-ms` | `86400000` | JWT token lifetime in milliseconds (default: 24 hours) |

To override the JWT secret without editing the file, set an environment variable:

```bash
# Linux / macOS
export JWT_SECRET=replace-this-with-a-long-random-string

# Windows (Command Prompt)
set JWT_SECRET=replace-this-with-a-long-random-string

# Windows (PowerShell)
$env:JWT_SECRET="replace-this-with-a-long-random-string"
```

> **Tip:** Generate a secure secret with:
> ```bash
> # Linux / macOS
> openssl rand -hex 32
> ```

---

### Step 4 — Build and Start the Server

```bash
cd java-backend
mvn spring-boot:run
```

Or build a self-contained JAR first, then run it:

```bash
cd java-backend
mvn package -DskipTests
java -jar target/hospital-management-system-1.1.0.jar
```

You should see Spring Boot's startup log ending with:

```
Started HmsApplication in X.XXX seconds
```

Open **http://localhost:3000** in your browser.

---

### Step 5 — First Login

| Field    | Value              |
|----------|--------------------|
| Email    | admin@hospital.com |
| Password | Admin@123          |
| Role     | Admin              |

> ⚠️ **Change the admin password immediately** after first login via **Users → Edit**.

---

### Step 6 — Initial Application Configuration (Admin UI)

All post-install configuration is done inside the app under **Settings** (Admin only).

#### 6a — Add a Hospital Site

1. Go to **Settings → Sites**.
2. Click **Add Site**.
3. Enter the site name (e.g., *Main Hospital*) and click **Save**.

#### 6b — Add Wards

1. Go to **Settings → Wards**.
2. Select the site, enter a ward name (e.g., *General Ward*), and click **Save**.

#### 6c — Add Departments

1. Go to **Settings → Departments**.
2. Select the site, enter a department name (e.g., *Cardiology*), and click **Save**.

#### 6d — Create Staff Accounts

1. Go to **Users → Add User**.
2. Fill in name, email, password, select a role (**Admin / Doctor / Nurse**) and assign a site.
3. Click **Save**.

#### 6e — Configure System Settings

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

## Configuration Reference

### `java-backend/src/main/resources/application.properties`

| Property | Required | Default | Description |
|---|---|---|---|
| `server.port` | No | `3000` | HTTP port to listen on |
| `app.jwt.secret` | **Yes** | `medcare-secret-key-2024` | Secret for signing JWT tokens. Set via `JWT_SECRET` env var in production |
| `app.jwt.expiration-ms` | No | `86400000` | Token lifetime in ms (24 h) |
| `spring.datasource.url` | No | `jdbc:sqlite:../data/hospital.db` | SQLite database path (JDBC URL) |
| `spring.servlet.multipart.max-file-size` | No | `50MB` | Max upload size for backup restore |

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
├── java-backend/                   # ✅ PRIMARY backend — Java / Spring Boot 3
│   ├── pom.xml                     # Maven build descriptor
│   ├── src/main/
│   │   ├── java/com/medcare/hms/
│   │   │   ├── HmsApplication.java         # Application entry point
│   │   │   ├── config/
│   │   │   │   ├── DatabaseInitializer.java # Schema creation + seeding
│   │   │   │   ├── JwtUtil.java             # JWT sign/verify helpers
│   │   │   │   ├── SecurityConfig.java      # Spring Security filter chain
│   │   │   │   └── WebConfig.java           # CORS + static resource mapping
│   │   │   ├── controller/
│   │   │   │   ├── AuthController.java
│   │   │   │   ├── PatientController.java
│   │   │   │   ├── AppointmentController.java
│   │   │   │   ├── BillingController.java
│   │   │   │   ├── UserController.java
│   │   │   │   ├── AuditController.java
│   │   │   │   └── SettingsController.java
│   │   │   ├── filter/
│   │   │   │   └── JwtAuthFilter.java       # JWT request filter
│   │   │   ├── interceptor/
│   │   │   │   └── AuditInterceptor.java    # Automatic action logging
│   │   │   └── model/
│   │   │       └── AuthUser.java            # Authenticated user principal
│   │   └── resources/
│   │       └── application.properties       # All app configuration
├── public/                         # Static frontend (shared by all backends)
│   ├── index.html                  # Login page
│   ├── dashboard.html
│   ├── patients.html
│   ├── appointments.html
│   ├── billing.html
│   ├── users.html
│   ├── audit.html
│   ├── settings.html
│   ├── about.html
│   ├── help.html                   # User manual & shortcut reference
│   ├── css/style.css
│   ├── js/
│   │   ├── api.js
│   │   ├── auth.js
│   │   ├── shortcuts.js            # Global keyboard shortcut handler
│   │   └── ...
│   └── sw.js                       # Service Worker (PWA/offline)
├── database/
│   └── schema.sql                  # Reference SQL schema
├── data/                           # SQLite database (auto-created, git-ignored)
├── server.js                       # (Legacy) Node.js/Express backend
├── app.py                          # (Legacy) Python/Flask backend
└── requirements.txt                # (Legacy) Python dependencies
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

> The backup streams the live SQLite file as a safe, byte-for-byte snapshot served directly by the Spring Boot backend.

### Restore from Backup

1. Go to **Settings → Backup & Restore**.
2. Click **Choose Backup File** and select a previously downloaded `.db` file.
3. Click **Restore Database**.
4. The server validates the file, replaces the live database, and exits so a process manager (systemd, etc.) can restart it automatically.
5. Wait a few seconds, then reload the page.

> ⚠️ **Restoring replaces ALL current data.** Always download a fresh backup before restoring.

---



### Production checklist

1. Set a strong `JWT_SECRET` environment variable (or update `app.jwt.secret` in `application.properties`)
2. Change the default admin password immediately after first login
3. Build a fat JAR for deployment:

```bash
cd java-backend
mvn package -DskipTests
java -jar target/hospital-management-system-1.1.0.jar
```

4. Use a process manager such as [systemd](https://systemd.io/) or run as a service:

```ini
# /etc/systemd/system/medcare-hms.service
[Unit]
Description=MedCare Hospital Management System
After=network.target

[Service]
User=medcare
WorkingDirectory=/opt/medcare
ExecStart=/usr/bin/java -jar /opt/medcare/hospital-management-system-1.1.0.jar
Environment=JWT_SECRET=your-strong-secret-here
Restart=on-failure

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now medcare-hms
```

5. Place behind a reverse proxy (Nginx/Apache) for HTTPS
6. Back up the `data/hospital.db` file regularly

### Docker (optional)

```dockerfile
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY java-backend/target/hospital-management-system-1.1.0.jar app.jar
COPY public/ public/
EXPOSE 3000
ENTRYPOINT ["java", "-jar", "app.jar"]
```

Build and run:

```bash
# Build JAR first
cd java-backend && mvn package -DskipTests && cd ..

docker build -t medcare-hms .
docker run -p 3000:3000 -e JWT_SECRET=your-secret medcare-hms
```

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| *Port already in use* | Change `server.port` in `application.properties` or set `-Dserver.port=XXXX` on the command line |
| *`java: command not found`* | Install Java 17+ and ensure it is on your `PATH` |
| *`mvn: command not found`* | Install Maven 3.6+ or use `./mvnw` (Maven wrapper) inside `java-backend/` |
| *JWT errors / "Unauthorized"* | Ensure `JWT_SECRET` env var is set and consistent across restarts; do not change it while users are logged in |
| *Database locked* | Only one process should access the SQLite file; stop any other server instance |
| *SQLite file not found* | The database is auto-created at `data/hospital.db` relative to the working directory; run from the `java-backend/` folder or adjust `spring.datasource.url` |
| *PWA not updating* | Clear browser cache or unregister the service worker in DevTools → Application |
| *`OutOfMemoryError` on startup* | Increase heap: `java -Xmx512m -jar app.jar` |

---

## Developer

**Zulfiqar Ali**  
Full Stack Developer  
🌐 [www.maxtechfix.com](http://www.maxtechfix.com)

---

## License

MIT

