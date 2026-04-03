package com.medcare.hms.controller;

import com.medcare.hms.model.AuthUser;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.*;

@RestController
@RequestMapping("/api/appointments")
public class AppointmentController extends BaseController {

    @Autowired
    private JdbcTemplate jdbc;

    private static final String APPT_QUERY =
            "SELECT a.*, " +
            "  p.first_name || ' ' || p.last_name as patient_name, p.patient_number, " +
            "  u.name as doctor_name, d.name as department_name, s.name as site_name " +
            "FROM appointments a " +
            "LEFT JOIN patients p ON a.patient_id = p.id " +
            "LEFT JOIN users u ON a.doctor_id = u.id " +
            "LEFT JOIN departments d ON a.department_id = d.id " +
            "LEFT JOIN sites s ON a.site_id = s.id";

    @GetMapping("/today")
    public ResponseEntity<?> today() {
        String today = LocalDate.now().toString();
        List<Map<String, Object>> rows = jdbc.queryForList(
                APPT_QUERY + " WHERE a.appointment_date = ? ORDER BY a.appointment_time ASC", today);
        return ResponseEntity.ok(rows);
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required = false) String date,
                                  @RequestParam(required = false) String doctor_id,
                                  @RequestParam(required = false) String status,
                                  @RequestParam(required = false) String site_id,
                                  @RequestParam(defaultValue = "1") int page,
                                  @RequestParam(defaultValue = "20") int limit) {
        StringBuilder where = new StringBuilder(" WHERE 1=1");
        List<Object> params = new ArrayList<>();
        if (date != null)      { where.append(" AND a.appointment_date = ?"); params.add(date); }
        if (doctor_id != null) { where.append(" AND a.doctor_id = ?");        params.add(doctor_id); }
        if (status != null)    { where.append(" AND a.status = ?");           params.add(status); }
        if (site_id != null)   { where.append(" AND a.site_id = ?");          params.add(site_id); }

        String query = APPT_QUERY + where + " ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT ? OFFSET ?";
        List<Object> allParams = new ArrayList<>(params);
        allParams.add(limit);
        allParams.add((page - 1) * limit);

        List<Map<String, Object>> appointments = jdbc.queryForList(query, allParams.toArray());
        int total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM appointments a" + where, Integer.class, params.toArray());
        return ResponseEntity.ok(Map.of("appointments", appointments, "total", total));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable String id) {
        List<Map<String, Object>> rows = jdbc.queryForList(APPT_QUERY + " WHERE a.id = ?", id);
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Appointment not found"));
        return ResponseEntity.ok(rows.get(0));
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        AuthUser user = getUser(request);
        String patientId = (String) body.get("patient_id");
        String appointmentDate = (String) body.get("appointment_date");
        String appointmentTime = (String) body.get("appointment_time");
        if (patientId == null || appointmentDate == null || appointmentTime == null) {
            return ResponseEntity.status(400).body(Map.of("error", "Patient, date and time required"));
        }
        String newId = UUID.randomUUID().toString();
        String status = body.getOrDefault("status", "scheduled").toString();
        jdbc.update("""
            INSERT INTO appointments (id, patient_id, doctor_id, department_id, site_id,
              appointment_date, appointment_time, status, notes, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                newId,
                patientId,
                body.get("doctor_id"),
                body.get("department_id"),
                body.get("site_id"),
                appointmentDate,
                appointmentTime,
                status,
                body.get("notes"),
                user.id);
        return ResponseEntity.status(201).body(Map.of("id", newId, "message", "Appointment created successfully"));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT id FROM appointments WHERE id = ?", id);
        if (existing.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Appointment not found"));
        jdbc.update("""
            UPDATE appointments SET patient_id=?, doctor_id=?, department_id=?, site_id=?,
              appointment_date=?, appointment_time=?, status=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?""",
                body.get("patient_id"),
                body.get("doctor_id"),
                body.get("department_id"),
                body.get("site_id"),
                body.get("appointment_date"),
                body.get("appointment_time"),
                body.get("status"),
                body.get("notes"),
                id);
        return ResponseEntity.ok(Map.of("message", "Appointment updated successfully"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id) {
        jdbc.update("DELETE FROM appointments WHERE id = ?", id);
        return ResponseEntity.ok(Map.of("message", "Appointment deleted successfully"));
    }
}
