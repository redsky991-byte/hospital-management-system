package com.medcare.hms.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medcare.hms.config.JwtUtil;
import com.medcare.hms.model.AuthUser;
import io.jsonwebtoken.Claims;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@Component
public class JwtAuthFilter extends OncePerRequestFilter {

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private JdbcTemplate jdbc;

    private final ObjectMapper objectMapper = new ObjectMapper();

    // Paths that do NOT require authentication
    private static final List<String> PUBLIC_PATHS = List.of("/api/auth/login");

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        // Skip for public API paths and all non-API resources (static files)
        return PUBLIC_PATHS.stream().anyMatch(path::equals)
                || !path.startsWith("/api/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String authHeader = request.getHeader("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            sendUnauthorized(response, "Access token required");
            return;
        }
        String token = authHeader.substring(7);
        try {
            Claims claims = jwtUtil.parseToken(token);
            String userId = (String) claims.get("id");
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT id, name, email, role, site_id, is_active FROM users WHERE id = ?", userId);
            if (rows.isEmpty()) {
                sendUnauthorized(response, "User not found or inactive");
                return;
            }
            Map<String, Object> row = rows.get(0);
            if (row.get("is_active") == null || ((Number) row.get("is_active")).intValue() != 1) {
                sendUnauthorized(response, "User not found or inactive");
                return;
            }
            AuthUser user = new AuthUser(
                    (String) row.get("id"),
                    (String) row.get("name"),
                    (String) row.get("email"),
                    (String) row.get("role"),
                    (String) row.get("site_id")
            );
            request.setAttribute("authUser", user);
            chain.doFilter(request, response);
        } catch (Exception e) {
            sendUnauthorized(response, "Invalid or expired token");
        }
    }

    private void sendUnauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType("application/json");
        response.getWriter().write(objectMapper.writeValueAsString(Map.of("error", message)));
    }
}
