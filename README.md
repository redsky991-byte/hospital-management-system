# MedCare Hospital Management System

A complete, production-ready, multi-site Hospital Management System (HMS) built with Node.js, Express, SQLite, and Bootstrap 5.

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
- **Offline / PWA** – Service Worker caches assets for offline availability
- **Print Support** – Clean print stylesheets on every procedure page

---

## System Requirements

- Node.js 18 or later
- npm 8 or later
- Any OS: Linux, macOS, Windows

---

## Installation

```bash
# 1. Clone the repository
git clone <repo-url>
cd hospital-management-system

# 2. Install dependencies
npm install

# 3. (Optional) Configure environment
cp .env.example .env   # edit PORT, JWT_SECRET as needed

# 4. Start the server
npm start
```

Open **http://localhost:3000** in your browser.

---

## Default Credentials

| Field    | Value                  |
|----------|------------------------|
| Email    | admin@hospital.com     |
| Password | Admin@123              |
| Role     | Admin                  |

> **Change the admin password immediately after first login via the Users page.**

---

## Configuration

All configuration is done through the **Settings** page (Admin only) — no code changes required:

- **Sites** – Add hospital branches/facilities
- **Wards** – Add wards per site
- **Departments** – Add clinical departments per site

Environment variables (`.env`):

```
PORT=3000
JWT_SECRET=your-strong-secret-here
```

---

## Project Structure

```
├── server.js              # Express application entry point
├── package.json
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
│   ├── css/style.css
│   ├── js/                # Frontend JavaScript modules
│   └── sw.js              # Service Worker (PWA/offline)
└── data/                  # SQLite database (auto-created, git-ignored)
```

---

## API Endpoints

| Method | Endpoint                   | Description              | Roles        |
|--------|----------------------------|--------------------------|--------------|
| POST   | /api/auth/login            | Login, returns JWT       | Public       |
| GET    | /api/auth/me               | Current user profile     | All          |
| GET    | /api/patients              | List patients            | All          |
| POST   | /api/patients              | Create patient           | All          |
| PUT    | /api/patients/:id          | Update patient           | All          |
| DELETE | /api/patients/:id          | Delete patient           | Admin        |
| GET    | /api/appointments          | List appointments        | All          |
| POST   | /api/appointments          | Create appointment       | All          |
| GET    | /api/billing               | List invoices            | All          |
| POST   | /api/billing               | Create invoice           | All          |
| POST   | /api/billing/:id/payment   | Record payment           | Admin        |
| GET    | /api/users                 | List users               | Admin        |
| POST   | /api/users                 | Create user              | Admin        |
| GET    | /api/audit                 | View audit logs          | Admin        |
| GET    | /api/settings/sites        | List sites               | Admin        |
| POST   | /api/settings/sites        | Add site                 | Admin        |

---

## Deployment

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

## Developer

**Zulfiqar Ali**  
Full Stack Developer  
🌐 [www.maxtechfix.com](http://www.maxtechfix.com)

---

## License

MIT

