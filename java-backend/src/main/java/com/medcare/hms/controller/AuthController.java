package com.medcare.hms.controller;

import com.medcare.hms.config.JwtUtil;
import com.medcare.hms.model.AuthUser;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController extends BaseController {

    @Autowired
    private JdbcTemplate jdbc;

    @Autowired
    private JwtUtil jwtUtil;

    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder(10);

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String password = body.get("password");
        if (email == null || password == null || email.isBlank() || password.isBlank()) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body(Map.of("error", "Email and password required"));
        }

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM users WHERE email = ? AND is_active = 1", email);
        if (rows.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid credentials"));
        }

        Map<String, Object> user = rows.get(0);
        String hash = (String) user.get("password_hash");
        if (!encoder.matches(password, hash)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("error", "Invalid credentials"));
        }

        String id = (String) user.get("id");
        jdbc.update("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", id);

        String token = jwtUtil.generateToken(id, (String) user.get("email"), (String) user.get("role"));

        String siteId = (String) user.get("site_id");
        String siteName = getSiteName(siteId);

        Map<String, Object> userInfo = new LinkedHashMap<>();
        userInfo.put("id", id);
        userInfo.put("name", user.get("name"));
        userInfo.put("email", user.get("email"));
        userInfo.put("role", user.get("role"));
        userInfo.put("site_id", siteId);
        userInfo.put("site_name", siteName);

        return ResponseEntity.ok(Map.of("token", token, "user", userInfo));
    }

    @GetMapping("/me")
    public ResponseEntity<?> me(HttpServletRequest request) {
        AuthUser user = getUser(request);
        String siteName = getSiteName(user.site_id);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("id", user.id);
        result.put("name", user.name);
        result.put("email", user.email);
        result.put("role", user.role);
        result.put("site_id", user.site_id);
        result.put("site_name", siteName);
        return ResponseEntity.ok(result);
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(@RequestBody Map<String, String> body,
                                           HttpServletRequest request) {
        AuthUser user = getUser(request);
        String name = body.getOrDefault("name", user.name);
        String email = body.getOrDefault("email", user.email);
        String password = body.get("password");

        if (password != null && !password.isBlank()) {
            String newHash = encoder.encode(password);
            jdbc.update("UPDATE users SET name=?, email=?, password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                    name, email, newHash, user.id);
        } else {
            jdbc.update("UPDATE users SET name=?, email=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                    name, email, user.id);
        }
        return ResponseEntity.ok(Map.of("message", "Profile updated successfully"));
    }

    private String getSiteName(String siteId) {
        if (siteId == null) return "N/A";
        List<Map<String, Object>> sites = jdbc.queryForList(
                "SELECT name FROM sites WHERE id = ?", siteId);
        return sites.isEmpty() ? "N/A" : (String) sites.get(0).get("name");
    }
}
