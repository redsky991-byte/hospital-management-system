# MedCare HMS — Java / Spring Boot Backend

This directory contains the **primary Java backend** of the MedCare Hospital Management System.  
It is a **drop-in replacement** for the original Node.js server: it exposes the exact same
REST API and serves the same HTML/JS frontend that lives in `../public/`.

---

## Tech Stack

| Concern | Library / Version |
|---|---|
| Web framework | Spring Boot 3.2 (`spring-boot-starter-web`) |
| Database | SQLite via `org.xerial:sqlite-jdbc 3.45` + `JdbcTemplate` |
| Authentication | JJWT 0.11 (HS256 JWT) |
| Password hashing | Spring Security Crypto (BCrypt) |
| JSON | Jackson (bundled with Spring Boot) |
| Build tool | Maven 3.6+ |
| Minimum Java | 17 (Java 21 LTS recommended) |

---

## Prerequisites

* **Java 17+** — <https://adoptium.net>
* **Maven 3.6+** — <https://maven.apache.org/download.cgi>
  * Or use the Maven wrapper (`./mvnw`) included in this directory.

Verify:

```bash
java -version   # 17 or higher
mvn -version    # 3.6 or higher
```

---

## Quick Start

```bash
# from this directory
mvn spring-boot:run
```

Or build a self-contained JAR and run it:

```bash
mvn package -DskipTests
java -jar target/hospital-management-system-1.1.0.jar
```

The server starts on **port 3000** by default.  
Open [http://localhost:3000](http://localhost:3000) in your browser.

Default admin credentials: `admin@hospital.com` / `Admin@123`  
> ⚠️ **Change the admin password immediately** after first login via **Users → Edit**.

---

## Configuration

All configuration is in `src/main/resources/application.properties`.  
Any property can be overridden with an environment variable or a JVM system property (`-D`).

### Full Property Reference

```properties
# ─── Server ───────────────────────────────────────────────────────────────────
server.port=3000

# ─── SQLite DataSource ────────────────────────────────────────────────────────
# Path is relative to the JVM working directory (i.e. the java-backend/ folder).
# Adjust if you run the JAR from a different directory.
spring.datasource.url=jdbc:sqlite:${user.dir}/../data/hospital.db
spring.datasource.driver-class-name=org.sqlite.JDBC
spring.datasource.username=
spring.datasource.password=

# Disable Spring Boot auto DDL — schema is managed by DatabaseInitializer.java
spring.sql.init.mode=never

# ─── JWT ──────────────────────────────────────────────────────────────────────
# Override via the JWT_SECRET environment variable in production.
app.jwt.secret=${JWT_SECRET:medcare-secret-key-2024}
app.jwt.expiration-ms=86400000

# ─── File Uploads ─────────────────────────────────────────────────────────────
spring.servlet.multipart.max-file-size=50MB
spring.servlet.multipart.max-request-size=50MB
```

### Overriding Configuration

**Environment variable (recommended for production):**

```bash
export JWT_SECRET=your-strong-secret-here
export SERVER_PORT=8080
```

**JVM system property:**

```bash
java -Dapp.jwt.secret=your-secret -Dserver.port=8080 -jar target/hospital-management-system-1.1.0.jar
```

**External `application.properties` file** (placed in the same directory as the JAR):

Spring Boot automatically picks up an `application.properties` file next to the JAR, allowing you to override any setting without rebuilding.

---

## Database

The SQLite database is created automatically at `../data/hospital.db` relative to the working directory.  
The schema and default admin seed are applied at startup by `DatabaseInitializer.java` — no manual migration steps are needed.

To use a different database location:

```properties
spring.datasource.url=jdbc:sqlite:/absolute/path/to/hospital.db
```

---

## Building for Production

```bash
# Clean build, skip tests
mvn package -DskipTests

# The fat JAR includes all dependencies and the ../public/ frontend
ls -lh target/hospital-management-system-1.1.0.jar
```

Run the JAR from the project root (one level above `java-backend/`) so that the relative database path resolves correctly:

```bash
cd /opt/medcare          # your deployment directory
java -jar java-backend/target/hospital-management-system-1.1.0.jar
```

---

## Running as a systemd Service (Linux)

Create `/etc/systemd/system/medcare-hms.service`:

```ini
[Unit]
Description=MedCare Hospital Management System
After=network.target

[Service]
User=medcare
WorkingDirectory=/opt/medcare
ExecStart=/usr/bin/java -jar /opt/medcare/java-backend/target/hospital-management-system-1.1.0.jar
Environment=JWT_SECRET=your-strong-secret-here
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now medcare-hms
sudo journalctl -u medcare-hms -f   # view live logs
```

---

## Docker

```dockerfile
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY java-backend/target/hospital-management-system-1.1.0.jar app.jar
COPY public/ public/
EXPOSE 3000
ENTRYPOINT ["java", "-jar", "app.jar"]
```

Build and run from the repository root:

```bash
cd java-backend && mvn package -DskipTests && cd ..
docker build -t medcare-hms .
docker run -p 3000:3000 \
  -e JWT_SECRET=your-secret \
  -v "$(pwd)/data:/app/../data" \
  medcare-hms
```

---

## API Endpoints

All endpoints are identical to the original Node.js version:

| Method | Endpoint | Description | Roles |
|---|---|---|---|
| `POST` | `/api/auth/login` | Login, returns JWT | Public |
| `GET` | `/api/auth/me` | Current user profile | All |
| `PUT` | `/api/auth/profile` | Update own profile | All |
| `GET/POST` | `/api/patients` | List / create patients | All |
| `PUT/DELETE` | `/api/patients/:id` | Update / delete patient | All / Admin |
| `GET/POST` | `/api/appointments` | List / create appointments | All |
| `PUT/DELETE` | `/api/appointments/:id` | Update / delete appointment | All / Admin |
| `GET/POST` | `/api/billing` | List / create invoices | All |
| `PUT` | `/api/billing/:id` | Update invoice | Admin |
| `POST` | `/api/billing/:id/payment` | Record payment | Admin |
| `GET/POST/PUT/DELETE` | `/api/users` | User management | Admin |
| `GET` | `/api/audit` | Audit log | Admin |
| `GET/PUT` | `/api/settings/system` | System settings | Admin |
| `GET` | `/api/settings/backup` | Download DB backup | Admin |
| `POST` | `/api/settings/restore` | Restore DB from backup | Admin |
| `GET/POST/PUT/DELETE` | `/api/settings/sites` | Sites | Admin |
| `GET/POST/PUT/DELETE` | `/api/settings/wards` | Wards | Admin |
| `GET/POST/PUT/DELETE` | `/api/settings/departments` | Departments | Admin |

---

## Troubleshooting

| Problem | Solution |
|---|---|
| *`java: command not found`* | Install Java 17+ and add it to `PATH` |
| *`mvn: command not found`* | Install Maven or use `./mvnw spring-boot:run` |
| *Port already in use* | Set `server.port=XXXX` in `application.properties` or pass `-Dserver.port=XXXX` |
| *JWT "Unauthorized" errors* | Ensure `JWT_SECRET` is consistent across restarts |
| *Database locked* | Stop all other server instances accessing the same `.db` file |
| *SQLite file not found* | Run from `java-backend/` or set an absolute path in `spring.datasource.url` |
| *`OutOfMemoryError`* | Add `-Xmx512m` (or higher) to the `java` command |
