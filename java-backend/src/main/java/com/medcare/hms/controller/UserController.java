package com.medcare.hms.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/users")
public class UserController extends BaseController {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private BCryptPasswordEncoder encoder;

    @GetMapping
    public ResponseEntity<?> list(HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        List<Map<String, Object>> users = jdbc.queryForList(
                "SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, " +
                "u.last_login_at, u.site_id, s.name as site_name " +
                "FROM users u LEFT JOIN sites s ON u.site_id = s.id ORDER BY u.created_at DESC");
        return ResponseEntity.ok(users);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable String id, HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, " +
                "u.last_login_at, u.site_id, s.name as site_name " +
                "FROM users u LEFT JOIN sites s ON u.site_id = s.id WHERE u.id = ?", id);
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        return ResponseEntity.ok(rows.get(0));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        String name     = (String) body.get("name");
        String email    = (String) body.get("email");
        String password = (String) body.get("password");
        if (name == null || email == null || password == null) {
            return ResponseEntity.status(400).body(Map.of("error", "Name, email and password required"));
        }
        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT id FROM users WHERE email = ?", email);
        if (!existing.isEmpty()) {
            return ResponseEntity.status(400).body(Map.of("error", "Email already in use"));
        }
        String newId = UUID.randomUUID().toString();
        String hash  = encoder.encode(password);
        String role  = body.getOrDefault("role", "nurse").toString();
        jdbc.update("INSERT INTO users (id, name, email, password_hash, role, site_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)",
                newId, name, email, hash, role, body.get("site_id"));
        return ResponseEntity.status(201).body(Map.of("id", newId, "message", "User created successfully"));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id,
                                    @RequestBody Map<String, Object> body,
                                    HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM users WHERE id = ?", id);
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "User not found"));
        Map<String, Object> user = rows.get(0);

        String hash = (String) user.get("password_hash");
        String password = (String) body.get("password");
        if (password != null && !password.isBlank()) {
            hash = encoder.encode(password);
        }
        String name    = body.containsKey("name")      ? (String) body.get("name")    : (String) user.get("name");
        String email   = body.containsKey("email")     ? (String) body.get("email")   : (String) user.get("email");
        String role    = body.containsKey("role")      ? (String) body.get("role")    : (String) user.get("role");
        String siteId  = body.containsKey("site_id")   ? (String) body.get("site_id") : (String) user.get("site_id");
        Object isActive = body.containsKey("is_active") ? body.get("is_active") : user.get("is_active");

        jdbc.update("UPDATE users SET name=?, email=?, password_hash=?, role=?, site_id=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                name, email, hash, role, siteId, isActive, id);
        return ResponseEntity.ok(Map.of("message", "User updated successfully"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id, HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        String currentUserId = getUser(request).id;
        if (id.equals(currentUserId)) {
            return ResponseEntity.status(400).body(Map.of("error", "Cannot delete your own account"));
        }
        jdbc.update("DELETE FROM users WHERE id = ?", id);
        return ResponseEntity.ok(Map.of("message", "User deleted successfully"));
    }
}
