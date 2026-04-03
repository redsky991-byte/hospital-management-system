package com.medcare.hms.controller;

import com.medcare.hms.model.AuthUser;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.Year;
import java.util.*;

@RestController
@RequestMapping("/api/patients")
public class PatientController extends BaseController {

    @Autowired
    private JdbcTemplate jdbc;

    private synchronized String generatePatientNumber() {
        int year = Year.now().getValue();
        int count = jdbc.queryForObject("SELECT COUNT(*) FROM patients", Integer.class);
        return String.format("PAT-%d-%03d", year, count + 1);
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required = false) String search,
                                  @RequestParam(required = false) String site_id,
                                  @RequestParam(defaultValue = "1") int page,
                                  @RequestParam(defaultValue = "20") int limit) {
        StringBuilder where = new StringBuilder("WHERE 1=1");
        List<Object> params = new ArrayList<>();

        if (search != null && !search.isBlank()) {
            String s = "%" + search + "%";
            where.append(" AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.patient_number LIKE ? OR p.phone LIKE ?)");
            params.add(s); params.add(s); params.add(s); params.add(s);
        }
        if (site_id != null) {
            where.append(" AND p.site_id = ?");
            params.add(site_id);
        }

        String base = "FROM patients p LEFT JOIN sites s ON p.site_id = s.id LEFT JOIN wards w ON p.ward_id = w.id " + where;
        String query = "SELECT p.*, s.name as site_name, w.name as ward_name " + base +
                " ORDER BY p.created_at DESC LIMIT ? OFFSET ?";

        List<Object> queryParams = new ArrayList<>(params);
        queryParams.add(limit);
        queryParams.add((page - 1) * limit);

        List<Map<String, Object>> patients = jdbc.queryForList(query, queryParams.toArray());
        int total = jdbc.queryForObject("SELECT COUNT(*) " + base, Integer.class, params.toArray());

        return ResponseEntity.ok(Map.of("patients", patients, "total", total,
                "page", page, "limit", limit));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable String id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.*, s.name as site_name, w.name as ward_name " +
                "FROM patients p LEFT JOIN sites s ON p.site_id = s.id LEFT JOIN wards w ON p.ward_id = w.id " +
                "WHERE p.id = ?", id);
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Patient not found"));
        return ResponseEntity.ok(rows.get(0));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        AuthUser user = getUser(request);
        String firstName = (String) body.get("first_name");
        String lastName = (String) body.get("last_name");
        if (firstName == null || firstName.isBlank() || lastName == null || lastName.isBlank()) {
            return ResponseEntity.status(400).body(Map.of("error", "First and last name required"));
        }
        String newId = UUID.randomUUID().toString();
        String patientNumber = generatePatientNumber();
        jdbc.update("""
            INSERT INTO patients (id, patient_number, first_name, last_name, date_of_birth,
              gender, phone, email, address, blood_group, allergies, site_id, ward_id, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                newId, patientNumber,
                firstName, lastName,
                body.get("date_of_birth"), body.get("gender"),
                body.get("phone"), body.get("email"),
                body.get("address"), body.get("blood_group"),
                body.get("allergies"), body.get("site_id"),
                body.get("ward_id"), user.id);
        return ResponseEntity.status(201).body(
                Map.of("id", newId, "patient_number", patientNumber, "message", "Patient created successfully"));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id,
                                    @RequestBody Map<String, Object> body) {
        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT id FROM patients WHERE id = ?", id);
        if (existing.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Patient not found"));
        jdbc.update("""
            UPDATE patients SET first_name=?, last_name=?, date_of_birth=?, gender=?,
              phone=?, email=?, address=?, blood_group=?, allergies=?,
              site_id=?, ward_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?""",
                body.get("first_name"), body.get("last_name"),
                body.get("date_of_birth"), body.get("gender"),
                body.get("phone"), body.get("email"),
                body.get("address"), body.get("blood_group"),
                body.get("allergies"), body.get("site_id"),
                body.get("ward_id"), id);
        return ResponseEntity.ok(Map.of("message", "Patient updated successfully"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id, HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        jdbc.update("DELETE FROM patients WHERE id = ?", id);
        return ResponseEntity.ok(Map.of("message", "Patient deleted successfully"));
    }
}
