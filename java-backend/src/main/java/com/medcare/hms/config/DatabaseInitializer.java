package com.medcare.hms.config;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Component
public class DatabaseInitializer {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private BCryptPasswordEncoder encoder;

    @PostConstruct
    public void init() {
        createSchema();
        seedData();
    }

    private void createSchema() {
        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS sites (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              address TEXT,
              phone TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )""");

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS wards (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              site_id TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (site_id) REFERENCES sites(id)
            )""");

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS departments (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              site_id TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (site_id) REFERENCES sites(id)
            )""");

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS users (
              id TEXT PRIMARY KEY,
              name TEXT NOT NULL,
              email TEXT UNIQUE NOT NULL,
              password_hash TEXT NOT NULL,
              role TEXT NOT NULL DEFAULT 'nurse',
              site_id TEXT,
              is_active INTEGER DEFAULT 1,
              last_login_at DATETIME,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (site_id) REFERENCES sites(id)
            )""");

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS system_settings (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )""");

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS patients (
              id TEXT PRIMARY KEY,
              patient_number TEXT UNIQUE NOT NULL,
              first_name TEXT NOT NULL,
              last_name TEXT NOT NULL,
              date_of_birth TEXT,
              gender TEXT,
              phone TEXT,
              email TEXT,
              address TEXT,
              blood_group TEXT,
              allergies TEXT,
              site_id TEXT,
              ward_id TEXT,
              created_by TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (site_id) REFERENCES sites(id),
              FOREIGN KEY (ward_id) REFERENCES wards(id),
              FOREIGN KEY (created_by) REFERENCES users(id)
            )""");

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS appointments (
              id TEXT PRIMARY KEY,
              patient_id TEXT NOT NULL,
              doctor_id TEXT,
              department_id TEXT,
              site_id TEXT,
              appointment_date TEXT NOT NULL,
              appointment_time TEXT NOT NULL,
              status TEXT DEFAULT 'scheduled',
              notes TEXT,
              created_by TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (patient_id) REFERENCES patients(id),
              FOREIGN KEY (doctor_id) REFERENCES users(id),
              FOREIGN KEY (department_id) REFERENCES departments(id),
              FOREIGN KEY (site_id) REFERENCES sites(id)
            )""");

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS invoices (
              id TEXT PRIMARY KEY,
              invoice_number TEXT UNIQUE NOT NULL,
              patient_id TEXT NOT NULL,
              site_id TEXT,
              total_amount REAL DEFAULT 0,
              discount REAL DEFAULT 0,
              tax REAL DEFAULT 0,
              paid_amount REAL DEFAULT 0,
              balance REAL DEFAULT 0,
              status TEXT DEFAULT 'draft',
              due_date TEXT,
              notes TEXT,
              created_by TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (patient_id) REFERENCES patients(id),
              FOREIGN KEY (site_id) REFERENCES sites(id)
            )""");

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS invoice_items (
              id TEXT PRIMARY KEY,
              invoice_id TEXT NOT NULL,
              description TEXT NOT NULL,
              quantity REAL DEFAULT 1,
              unit_price REAL DEFAULT 0,
              total REAL DEFAULT 0,
              FOREIGN KEY (invoice_id) REFERENCES invoices(id)
            )""");

        jdbc.execute("""
            CREATE TABLE IF NOT EXISTS audit_logs (
              id TEXT PRIMARY KEY,
              user_id TEXT,
              user_name TEXT,
              action TEXT,
              module TEXT,
              record_id TEXT,
              details TEXT,
              ip_address TEXT,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )""");

        // Migration: add last_login_at if missing (for existing DBs)
        try {
            jdbc.execute("ALTER TABLE users ADD COLUMN last_login_at DATETIME");
        } catch (Exception ignored) {
            // Column already exists
        }
    }

    private void seedData() {
        // Seed default site
        List<Map<String, Object>> sites = jdbc.queryForList(
                "SELECT id FROM sites WHERE name = 'Main Hospital'");
        String defaultSiteId;
        if (sites.isEmpty()) {
            defaultSiteId = UUID.randomUUID().toString();
            jdbc.update("INSERT INTO sites (id, name, address, phone) VALUES (?, ?, ?, ?)",
                    defaultSiteId, "Main Hospital", "123 Medical Street, Health City", "+1-555-0100");
        } else {
            defaultSiteId = (String) sites.get(0).get("id");
        }

        // Seed default admin user
        List<Map<String, Object>> admins = jdbc.queryForList(
                "SELECT id FROM users WHERE email = 'admin@hospital.com'");
        if (admins.isEmpty()) {
            jdbc.update(
                    "INSERT INTO users (id, name, email, password_hash, role, site_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID().toString(),
                    "System Administrator",
                    "admin@hospital.com",
                    encoder.encode("Admin@123"),
                    "admin",
                    defaultSiteId,
                    1);
        }

        // Seed default departments
        List<Map<String, Object>> depts = jdbc.queryForList("SELECT id FROM departments LIMIT 1");
        if (depts.isEmpty()) {
            String[] deptNames = {"General Medicine", "Surgery", "Pediatrics", "Cardiology",
                    "Orthopedics", "Gynecology", "Emergency", "Radiology"};
            for (String name : deptNames) {
                jdbc.update("INSERT INTO departments (id, name, site_id) VALUES (?, ?, ?)",
                        UUID.randomUUID().toString(), name, defaultSiteId);
            }
        }

        // Seed default wards
        List<Map<String, Object>> wards = jdbc.queryForList("SELECT id FROM wards LIMIT 1");
        if (wards.isEmpty()) {
            String[] wardNames = {"General Ward", "ICU", "Emergency Ward",
                    "Maternity Ward", "Pediatric Ward", "Surgical Ward"};
            for (String name : wardNames) {
                jdbc.update("INSERT INTO wards (id, name, site_id) VALUES (?, ?, ?)",
                        UUID.randomUUID().toString(), name, defaultSiteId);
            }
        }

        // Seed system settings (INSERT OR IGNORE equivalent)
        jdbc.update("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('language', 'en')");
        jdbc.update("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('currency', 'USD')");
        jdbc.update("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('date_format', 'YYYY-MM-DD')");
    }
}
