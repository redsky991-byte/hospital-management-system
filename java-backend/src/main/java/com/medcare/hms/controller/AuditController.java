package com.medcare.hms.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/audit")
public class AuditController extends BaseController {

    @Autowired
    private JdbcTemplate jdbc;

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required = false) String user_id,
                                  @RequestParam(required = false) String module,
                                  @RequestParam(required = false) String action,
                                  @RequestParam(required = false) String from_date,
                                  @RequestParam(required = false) String to_date,
                                  @RequestParam(defaultValue = "1") int page,
                                  @RequestParam(defaultValue = "50") int limit,
                                  HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();

        StringBuilder where = new StringBuilder("WHERE 1=1");
        List<Object> params = new ArrayList<>();
        if (user_id != null)   { where.append(" AND user_id = ?");                    params.add(user_id); }
        if (module != null)    { where.append(" AND module = ?");                      params.add(module); }
        if (action != null)    { where.append(" AND action = ?");                      params.add(action); }
        if (from_date != null) { where.append(" AND created_at >= ?");                 params.add(from_date); }
        if (to_date != null)   { where.append(" AND created_at <= ?");                 params.add(to_date + " 23:59:59"); }

        String query = "SELECT * FROM audit_logs " + where + " ORDER BY created_at DESC LIMIT ? OFFSET ?";
        List<Object> allParams = new ArrayList<>(params);
        allParams.add(limit);
        allParams.add((page - 1) * limit);

        List<Map<String, Object>> logs = jdbc.queryForList(query, allParams.toArray());
        int total = jdbc.queryForObject("SELECT COUNT(*) FROM audit_logs " + where, Integer.class, params.toArray());
        return ResponseEntity.ok(Map.of("logs", logs, "total", total));
    }
}
