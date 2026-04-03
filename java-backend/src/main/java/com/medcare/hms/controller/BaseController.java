package com.medcare.hms.controller;

import com.medcare.hms.model.AuthUser;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.util.Map;

public abstract class BaseController {

    protected AuthUser getUser(HttpServletRequest request) {
        return (AuthUser) request.getAttribute("authUser");
    }

    protected ResponseEntity<?> forbidden() {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Insufficient permissions"));
    }

    protected boolean isAdmin(HttpServletRequest request) {
        AuthUser u = getUser(request);
        return u != null && "admin".equals(u.role);
    }
}
