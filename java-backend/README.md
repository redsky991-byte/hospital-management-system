# MedCare HMS — Java / Spring Boot Backend

This directory contains a complete **Java port** of the MedCare Hospital Management System.
It is a **drop-in replacement** for the original Node.js server: it exposes the exact same
REST API and serves the same HTML/JS frontend that lives in `../public/`.

## Tech stack

| Concern | Library |
|---|---|
| Web framework | Spring Boot 3 (spring-boot-starter-web) |
| Database | SQLite via `org.xerial:sqlite-jdbc` + `JdbcTemplate` |
| Authentication | JJWT 0.11 (HS256) |
| Password hashing | Spring Security Crypto (BCrypt) |
| JSON | Jackson (bundled with Spring Boot) |

## Prerequisites

* Java 17+
* Maven 3.6+

## Running

```bash
# from this directory
mvn spring-boot:run
```

Or build a fat JAR and run it:

```bash
mvn package -DskipTests
java -jar target/hospital-management-system-1.1.0.jar
```

The server starts on **port 3000** (same as the Node.js version).
Open [http://localhost:3000](http://localhost:3000) in your browser.

Default admin credentials: `admin@hospital.com` / `Admin@123`

## Configuration

All configuration lives in `src/main/resources/application.properties`.  
The JWT secret can be overridden with the `JWT_SECRET` environment variable.

## Database

The SQLite database is created automatically at `../data/hospital.db` relative to the
working directory (i.e. the same `data/` folder the Node.js server uses — they share the
same database file).

## API endpoints

All endpoints are identical to the Node.js version:

| Prefix | Description |
|---|---|
| `POST /api/auth/login` | Login |
| `GET  /api/auth/me` | Current user |
| `PUT  /api/auth/profile` | Update own profile |
| `GET/POST/PUT/DELETE /api/patients` | Patient CRUD |
| `GET/POST/PUT/DELETE /api/appointments` | Appointment CRUD |
| `GET/POST/PUT/DELETE /api/billing` | Invoice CRUD + payment |
| `GET/POST/PUT/DELETE /api/users` | User management (admin) |
| `GET /api/audit` | Audit log (admin) |
| `GET/PUT /api/settings/system` | System settings (admin) |
| `GET /api/settings/backup` | DB backup download (admin) |
| `POST /api/settings/restore` | DB restore (admin) |
| `GET/POST/PUT/DELETE /api/settings/sites` | Sites (admin) |
| `GET/POST/PUT/DELETE /api/settings/wards` | Wards (admin) |
| `GET/POST/PUT/DELETE /api/settings/departments` | Departments (admin) |
