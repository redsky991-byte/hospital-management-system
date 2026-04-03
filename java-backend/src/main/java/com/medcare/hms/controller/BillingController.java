package com.medcare.hms.controller;

import com.medcare.hms.model.AuthUser;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.time.Year;
import java.util.*;

@RestController
@RequestMapping("/api/billing")
public class BillingController extends BaseController {

    @Autowired
    private JdbcTemplate jdbc;

    private String generateInvoiceNumber() {
        int year = Year.now().getValue();
        int count = jdbc.queryForObject("SELECT COUNT(*) FROM invoices", Integer.class);
        return String.format("INV-%d-%03d", year, count + 1);
    }

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(required = false) String status,
                                  @RequestParam(required = false) String patient_id,
                                  @RequestParam(required = false) String site_id,
                                  @RequestParam(defaultValue = "1") int page,
                                  @RequestParam(defaultValue = "20") int limit) {
        StringBuilder where = new StringBuilder("WHERE 1=1");
        List<Object> params = new ArrayList<>();
        if (status != null)     { where.append(" AND i.status = ?");     params.add(status); }
        if (patient_id != null) { where.append(" AND i.patient_id = ?"); params.add(patient_id); }
        if (site_id != null)    { where.append(" AND i.site_id = ?");    params.add(site_id); }

        String query = "SELECT i.*, p.first_name || ' ' || p.last_name as patient_name, " +
                "p.patient_number, s.name as site_name " +
                "FROM invoices i LEFT JOIN patients p ON i.patient_id = p.id " +
                "LEFT JOIN sites s ON i.site_id = s.id " + where +
                " ORDER BY i.created_at DESC LIMIT ? OFFSET ?";
        List<Object> allParams = new ArrayList<>(params);
        allParams.add(limit);
        allParams.add((page - 1) * limit);

        List<Map<String, Object>> invoices = jdbc.queryForList(query, allParams.toArray());
        int total = jdbc.queryForObject(
                "SELECT COUNT(*) FROM invoices i " + where, Integer.class, params.toArray());
        return ResponseEntity.ok(Map.of("invoices", invoices, "total", total));
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> get(@PathVariable String id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT i.*, p.first_name || ' ' || p.last_name as patient_name, " +
                "p.patient_number, s.name as site_name " +
                "FROM invoices i LEFT JOIN patients p ON i.patient_id = p.id " +
                "LEFT JOIN sites s ON i.site_id = s.id WHERE i.id = ?", id);
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Invoice not found"));
        List<Map<String, Object>> items = jdbc.queryForList(
                "SELECT * FROM invoice_items WHERE invoice_id = ?", id);
        Map<String, Object> result = new LinkedHashMap<>(rows.get(0));
        result.put("items", items);
        return ResponseEntity.ok(result);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        AuthUser user = getUser(request);
        String patientId = (String) body.get("patient_id");
        if (patientId == null) return ResponseEntity.status(400).body(Map.of("error", "Patient required"));

        double discount = toDouble(body.getOrDefault("discount", 0));
        double tax      = toDouble(body.getOrDefault("tax", 0));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) body.getOrDefault("items", List.of());

        double subtotal = items.stream()
                .mapToDouble(i -> toDouble(i.get("quantity")) * toDouble(i.get("unit_price")))
                .sum();
        double totalAmount = subtotal - discount + (subtotal * tax / 100);

        String newId = UUID.randomUUID().toString();
        String invoiceNumber = generateInvoiceNumber();

        jdbc.update("""
            INSERT INTO invoices (id, invoice_number, patient_id, site_id, total_amount,
              discount, tax, paid_amount, balance, status, due_date, notes, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'draft', ?, ?, ?)""",
                newId, invoiceNumber, patientId, body.get("site_id"),
                totalAmount, discount, tax, totalAmount,
                body.get("due_date"), body.get("notes"), user.id);

        for (Map<String, Object> item : items) {
            double qty   = toDouble(item.get("quantity"));
            double price = toDouble(item.get("unit_price"));
            jdbc.update("INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)",
                    UUID.randomUUID().toString(), newId,
                    item.get("description"), qty, price, qty * price);
        }
        return ResponseEntity.status(201).body(
                Map.of("id", newId, "invoice_number", invoiceNumber, "message", "Invoice created successfully"));
    }

    @PutMapping("/{id}")
    public ResponseEntity<?> update(@PathVariable String id, @RequestBody Map<String, Object> body) {
        List<Map<String, Object>> invRows = jdbc.queryForList("SELECT * FROM invoices WHERE id = ?", id);
        if (invRows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Invoice not found"));
        Map<String, Object> inv = invRows.get(0);

        double totalAmount = toDouble(inv.get("total_amount"));
        double discount = body.containsKey("discount") ? toDouble(body.get("discount")) : toDouble(inv.get("discount"));
        double tax      = body.containsKey("tax")      ? toDouble(body.get("tax"))      : toDouble(inv.get("tax"));

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> items = (List<Map<String, Object>>) body.get("items");
        if (items != null) {
            jdbc.update("DELETE FROM invoice_items WHERE invoice_id = ?", id);
            double subtotal = items.stream()
                    .mapToDouble(i -> toDouble(i.get("quantity")) * toDouble(i.get("unit_price")))
                    .sum();
            totalAmount = subtotal - discount + (subtotal * tax / 100);
            for (Map<String, Object> item : items) {
                double qty   = toDouble(item.get("quantity"));
                double price = toDouble(item.get("unit_price"));
                jdbc.update("INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)",
                        UUID.randomUUID().toString(), id, item.get("description"), qty, price, qty * price);
            }
        }
        double balance = totalAmount - toDouble(inv.get("paid_amount"));
        String status  = body.containsKey("status") ? (String) body.get("status") : (String) inv.get("status");
        String dueDate = body.containsKey("due_date") ? (String) body.get("due_date") : (String) inv.get("due_date");
        String notes   = body.containsKey("notes")    ? (String) body.get("notes")    : (String) inv.get("notes");

        jdbc.update("""
            UPDATE invoices SET status=?, discount=?, tax=?, total_amount=?, balance=?,
              due_date=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?""",
                status, discount, tax, totalAmount, balance, dueDate, notes, id);
        return ResponseEntity.ok(Map.of("message", "Invoice updated successfully"));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> delete(@PathVariable String id, HttpServletRequest request) {
        if (!isAdmin(request)) return forbidden();
        jdbc.update("DELETE FROM invoice_items WHERE invoice_id = ?", id);
        jdbc.update("DELETE FROM invoices WHERE id = ?", id);
        return ResponseEntity.ok(Map.of("message", "Invoice deleted successfully"));
    }

    @PostMapping("/{id}/payment")
    public ResponseEntity<?> payment(@PathVariable String id, @RequestBody Map<String, Object> body) {
        double amount = toDouble(body.get("amount"));
        if (amount <= 0) return ResponseEntity.status(400).body(Map.of("error", "Valid payment amount required"));

        List<Map<String, Object>> rows = jdbc.queryForList("SELECT * FROM invoices WHERE id = ?", id);
        if (rows.isEmpty()) return ResponseEntity.status(404).body(Map.of("error", "Invoice not found"));
        Map<String, Object> inv = rows.get(0);

        double newPaid    = toDouble(inv.get("paid_amount")) + amount;
        double newBalance = Math.max(0, toDouble(inv.get("total_amount")) - newPaid);
        String newStatus  = newBalance <= 0 ? "paid" : (String) inv.get("status");

        jdbc.update("UPDATE invoices SET paid_amount=?, balance=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
                newPaid, newBalance, newStatus, id);
        return ResponseEntity.ok(Map.of(
                "message", "Payment recorded successfully",
                "paid_amount", newPaid,
                "balance", newBalance));
    }

    private double toDouble(Object val) {
        if (val == null) return 0.0;
        if (val instanceof Number) return ((Number) val).doubleValue();
        try { return Double.parseDouble(val.toString()); } catch (NumberFormatException e) { return 0.0; }
    }
}
