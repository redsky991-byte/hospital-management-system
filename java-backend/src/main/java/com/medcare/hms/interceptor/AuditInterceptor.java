package com.medcare.hms.interceptor;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.medcare.hms.model.AuthUser;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;

import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Component
public class AuditInterceptor implements HandlerInterceptor {

    @Autowired
    private JdbcTemplate jdbc;

    private static final Set<String> AUDITED_METHODS = Set.of("POST", "PUT", "DELETE", "PATCH");

    @Override
    public void afterCompletion(HttpServletRequest request,
                                HttpServletResponse response,
                                Object handler,
                                Exception ex) {
        AuthUser user = (AuthUser) request.getAttribute("authUser");
        if (user == null) return;
        if (!AUDITED_METHODS.contains(request.getMethod())) return;

        try {
            String[] parts = request.getRequestURI().replaceFirst("^/api/", "").split("/");
            String module = parts.length > 0 ? parts[0] : "unknown";
            String recordId = parts.length > 1 ? parts[1] : null;
            String action = switch (request.getMethod()) {
                case "POST" -> "CREATE";
                case "PUT" -> "UPDATE";
                case "DELETE" -> "DELETE";
                default -> "PATCH";
            };
            String details = new ObjectMapper().writeValueAsString(
                    Map.of("method", request.getMethod(), "path", request.getRequestURI()));
            String ip = request.getRemoteAddr();

            jdbc.update(
                    "INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details, ip_address) " +
                    "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID().toString(),
                    user.id, user.name, action, module, recordId, details, ip);
        } catch (Exception ignored) {
            // Audit errors must not break the response
        }
    }
}
