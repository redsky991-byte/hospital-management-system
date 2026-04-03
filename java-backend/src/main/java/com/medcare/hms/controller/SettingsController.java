package com.medcare.hms.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ConfigurableApplicationContext;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.io.*;
import java.nio.file.*;
import java.util.*;

@RestController
@RequestMapping("/api/settings")
public class SettingsController extends BaseController {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private ConfigurableApplicationContext appContext;

    /**
     * Resolved from spring.datasource.url (e.g. jdbc:sqlite:/path/to/hospital.db).
     * Stored as a raw string so we can extract the filesystem path.
     */
    @Value("${spring.datasource.url}")
    private String datasourceUrl;

    // ── System Settings ─────────────────────────────────────────────────────

    @GetMapping("/system")
    public ResponseEntity<?> getSystem(HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT key, value FROM system_settings");
        Map<String, Object> settings = new LinkedHashMap<>();
        rows.forEach(r -> settings.put((String) r.get("key"), r.get("value")));
        return ResponseEntity.ok(settings);
    }

    @PutMapping("/system")
    public ResponseEntity<?> putSystem(@RequestBody Map<String, String> body, HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        String language = body.get("language");
        String currency = body.get("currency");
        String dateFormat = body.get("date_format");
        if (language != null)
            jdbc.update("INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('language', ?, CURRENT_TIMESTAMP)", language);
        if (currency != null)
            jdbc.update("INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('currency', ?, CURRENT_TIMESTAMP)", currency);
        if (dateFormat != null)
            jdbc.update("INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES ('date_format', ?, CURRENT_TIMESTAMP)", dateFormat);
        return ResponseEntity.ok(Map.of("message", "Settings saved successfully"));
    }

    // ── Backup ───────────────────────────────────────────────────────────────

    @GetMapping("/backup")
    public void backup(HttpServletRequest request, HttpServletResponse response) throws IOException {
        if (!isAdmin(request)) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Insufficient permissions\"}");
            return;
        }
        // Locate the database file from the datasource URL
        Path dbPath = resolveDbPath();
        if (!Files.exists(dbPath)) {
            response.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            response.setContentType("application/json");
            response.getWriter().write("{\"error\":\"Database file not found\"}");
            return;
        }
        String timestamp = java.time.LocalDateTime.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd-HH-mm-ss"));
        String filename = "hospital-backup-" + timestamp + ".db";
        response.setHeader("Content-Disposition", "attachment; filename=\"" + filename + "\"");
        response.setContentType("application/octet-stream");
        Files.copy(dbPath, response.getOutputStream());
        response.getOutputStream().flush();
    }

    // ── Restore ──────────────────────────────────────────────────────────────

    @PostMapping("/restore")
    public ResponseEntity<?> restore(@RequestBody Map<String, String> body, HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        String data = body.get("data");
        if (data == null || data.isBlank()) {
            return ResponseEntity.status(400).body(Map.of("error", "No backup data provided"));
        }

        Path dbPath  = resolveDbPath();
        Path walPath = Path.of(dbPath.toString() + "-wal");
        Path shmPath = Path.of(dbPath.toString() + "-shm");
        Path tmpPath = Path.of(dbPath.toString() + ".restore_tmp");

        try {
            byte[] buffer = Base64.getDecoder().decode(data);

            // Validate SQLite magic bytes
            String magic = new String(Arrays.copyOfRange(buffer, 0, 16), "US-ASCII");
            if (!magic.startsWith("SQLite format 3")) {
                return ResponseEntity.status(400).body(Map.of("error", "Invalid SQLite database file"));
            }

            Files.write(tmpPath, buffer);

            // Re-validate staged file
            byte[] header = new byte[16];
            try (RandomAccessFile raf = new RandomAccessFile(tmpPath.toFile(), "r")) {
                raf.readFully(header);
            }
            if (!new String(header, "US-ASCII").startsWith("SQLite format 3")) {
                Files.deleteIfExists(tmpPath);
                return ResponseEntity.status(400).body(Map.of("error", "Staged file validation failed"));
            }

            // Close existing DB connections - with JdbcTemplate/HikariCP we can't close the pool
            // here easily; we rely on the rename being atomic on Linux.
            Files.deleteIfExists(walPath);
            Files.deleteIfExists(shmPath);
            if (Files.exists(dbPath)) Files.delete(dbPath);
            Files.move(tmpPath, dbPath, StandardCopyOption.REPLACE_EXISTING);

            // Gracefully close the Spring context (triggers DataSource close) then exit
            // so a process manager (PM2, systemd) can restart the service with the new DB.
            new Thread(() -> {
                try { Thread.sleep(200); } catch (InterruptedException ignored) {}
                appContext.close();
                System.exit(0);
            }, "restore-shutdown").start();

            return ResponseEntity.ok(Map.of("message",
                    "Database restored successfully. The server is restarting — please wait a moment, then reload the page. " +
                    "(Requires a process manager such as PM2 or systemd to auto-restart.)"));
        } catch (IOException e) {
            try { Files.deleteIfExists(tmpPath); } catch (IOException ignored) {}
            return ResponseEntity.status(500).body(Map.of("error", "Restore failed: " + e.getMessage()));
        }
    }

    // ── Sites ────────────────────────────────────────────────────────────────

    @GetMapping("/sites")
    public ResponseEntity<?> getSites(HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        return ResponseEntity.ok(jdbc.queryForList("SELECT * FROM sites ORDER BY name"));
    }

    @PostMapping("/sites")
    public ResponseEntity<?> createSite(@RequestBody Map<String, String> body, HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        String name = body.get("name");
        if (name == null || name.isBlank()) return ResponseEntity.status(400).body(Map.of("error", "Site name required"));
        String newId = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO sites (id, name, address, phone) VALUES (?, ?, ?, ?)",
                newId, name, body.get("address"), body.get("phone"));
        return ResponseEntity.status(201).body(Map.of("id", newId, "message", "Site created"));
    }

    @PutMapping("/sites/{id}")
    public ResponseEntity<?> updateSite(@PathVariable String id,
                                        @RequestBody Map<String, String> body,
                                        HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        jdbc.update("UPDATE sites SET name=?, address=?, phone=? WHERE id=?",
                body.get("name"), body.get("address"), body.get("phone"), id);
        return ResponseEntity.ok(Map.of("message", "Site updated"));
    }

    @DeleteMapping("/sites/{id}")
    public ResponseEntity<?> deleteSite(@PathVariable String id, HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        jdbc.update("DELETE FROM sites WHERE id = ?", id);
        return ResponseEntity.ok(Map.of("message", "Site deleted"));
    }

    // ── Wards ────────────────────────────────────────────────────────────────

    @GetMapping("/wards")
    public ResponseEntity<?> getWards(@RequestParam(required = false) String site_id, HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        StringBuilder query = new StringBuilder(
                "SELECT w.*, s.name as site_name FROM wards w LEFT JOIN sites s ON w.site_id = s.id");
        List<Object> params = new ArrayList<>();
        if (site_id != null) { query.append(" WHERE w.site_id = ?"); params.add(site_id); }
        query.append(" ORDER BY w.name");
        return ResponseEntity.ok(jdbc.queryForList(query.toString(), params.toArray()));
    }

    @PostMapping("/wards")
    public ResponseEntity<?> createWard(@RequestBody Map<String, String> body, HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        String name = body.get("name");
        if (name == null || name.isBlank()) return ResponseEntity.status(400).body(Map.of("error", "Ward name required"));
        String newId = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO wards (id, name, site_id) VALUES (?, ?, ?)",
                newId, name, body.get("site_id"));
        return ResponseEntity.status(201).body(Map.of("id", newId, "message", "Ward created"));
    }

    @PutMapping("/wards/{id}")
    public ResponseEntity<?> updateWard(@PathVariable String id,
                                        @RequestBody Map<String, String> body,
                                        HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        jdbc.update("UPDATE wards SET name=?, site_id=? WHERE id=?",
                body.get("name"), body.get("site_id"), id);
        return ResponseEntity.ok(Map.of("message", "Ward updated"));
    }

    @DeleteMapping("/wards/{id}")
    public ResponseEntity<?> deleteWard(@PathVariable String id, HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        jdbc.update("DELETE FROM wards WHERE id = ?", id);
        return ResponseEntity.ok(Map.of("message", "Ward deleted"));
    }

    // ── Departments ──────────────────────────────────────────────────────────

    @GetMapping("/departments")
    public ResponseEntity<?> getDepartments(@RequestParam(required = false) String site_id, HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        StringBuilder query = new StringBuilder(
                "SELECT d.*, s.name as site_name FROM departments d LEFT JOIN sites s ON d.site_id = s.id");
        List<Object> params = new ArrayList<>();
        if (site_id != null) { query.append(" WHERE d.site_id = ?"); params.add(site_id); }
        query.append(" ORDER BY d.name");
        return ResponseEntity.ok(jdbc.queryForList(query.toString(), params.toArray()));
    }

    @PostMapping("/departments")
    public ResponseEntity<?> createDepartment(@RequestBody Map<String, String> body, HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        String name = body.get("name");
        if (name == null || name.isBlank()) return ResponseEntity.status(400).body(Map.of("error", "Department name required"));
        String newId = UUID.randomUUID().toString();
        jdbc.update("INSERT INTO departments (id, name, site_id) VALUES (?, ?, ?)",
                newId, name, body.get("site_id"));
        return ResponseEntity.status(201).body(Map.of("id", newId, "message", "Department created"));
    }

    @PutMapping("/departments/{id}")
    public ResponseEntity<?> updateDepartment(@PathVariable String id,
                                              @RequestBody Map<String, String> body,
                                              HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        jdbc.update("UPDATE departments SET name=?, site_id=? WHERE id=?",
                body.get("name"), body.get("site_id"), id);
        return ResponseEntity.ok(Map.of("message", "Department updated"));
    }

    @DeleteMapping("/departments/{id}")
    public ResponseEntity<?> deleteDepartment(@PathVariable String id, HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        jdbc.update("DELETE FROM departments WHERE id = ?", id);
        return ResponseEntity.ok(Map.of("message", "Department deleted"));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * Derives the filesystem path to the SQLite database from the configured
     * datasource URL (e.g. "jdbc:sqlite:/abs/path/hospital.db" or
     * "jdbc:sqlite:relative/path/hospital.db").
     */
    private Path resolveDbPath() {
        // datasourceUrl format: jdbc:sqlite:<path>
        String filePath = datasourceUrl.replaceFirst("^jdbc:sqlite:", "");
        Path p = Path.of(filePath);
        if (!p.isAbsolute()) {
            p = Path.of(System.getProperty("user.dir")).resolve(p).normalize();
        }
        return p;
    }
}
