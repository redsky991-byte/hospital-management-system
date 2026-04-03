const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { auditLog } = require('../middleware/auditMiddleware');

router.use(authenticate);
router.use(auditLog);

function generatePatientNumber() {
  const year = new Date().getFullYear();
  const count = db.prepare('SELECT COUNT(*) as cnt FROM patients').get().cnt;
  return `PAT-${year}-${String(count + 1).padStart(3, '0')}`;
}

router.get('/', (req, res) => {
  const { search, site_id, page = 1, limit = 20 } = req.query;
  let query = `SELECT p.*, s.name as site_name, w.name as ward_name
    FROM patients p
    LEFT JOIN sites s ON p.site_id = s.id
    LEFT JOIN wards w ON p.ward_id = w.id
    WHERE 1=1`;
  const params = [];
  if (search) {
    query += ` AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.patient_number LIKE ? OR p.phone LIKE ?)`;
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }
  if (site_id) { query += ` AND p.site_id = ?`; params.push(site_id); }
  query += ` ORDER BY p.created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const patients = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as cnt FROM patients').get().cnt;
  res.json({ patients, total, page: parseInt(page), limit: parseInt(limit) });
});

router.get('/:id', (req, res) => {
  const patient = db.prepare(`SELECT p.*, s.name as site_name, w.name as ward_name
    FROM patients p LEFT JOIN sites s ON p.site_id = s.id LEFT JOIN wards w ON p.ward_id = w.id
    WHERE p.id = ?`).get(req.params.id);
  if (!patient) return res.status(404).json({ error: 'Patient not found' });
  res.json(patient);
});

router.post('/', (req, res) => {
  const { first_name, last_name, date_of_birth, gender, phone, email, address, blood_group, allergies, site_id, ward_id } = req.body;
  if (!first_name || !last_name) return res.status(400).json({ error: 'First and last name required' });
  const id = uuidv4();
  const patient_number = generatePatientNumber();
  db.prepare(`INSERT INTO patients (id, patient_number, first_name, last_name, date_of_birth, gender, phone, email, address, blood_group, allergies, site_id, ward_id, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, patient_number, first_name, last_name, date_of_birth, gender, phone, email, address, blood_group, allergies, site_id, ward_id, req.user.id);
  res.status(201).json({ id, patient_number, message: 'Patient created successfully' });
});

router.put('/:id', (req, res) => {
  const { first_name, last_name, date_of_birth, gender, phone, email, address, blood_group, allergies, site_id, ward_id } = req.body;
  db.prepare(`UPDATE patients SET first_name=?, last_name=?, date_of_birth=?, gender=?, phone=?, email=?, address=?, blood_group=?, allergies=?, site_id=?, ward_id=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(first_name, last_name, date_of_birth, gender, phone, email, address, blood_group, allergies, site_id, ward_id, req.params.id);
  res.json({ message: 'Patient updated successfully' });
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM patients WHERE id = ?').run(req.params.id);
  res.json({ message: 'Patient deleted successfully' });
});

module.exports = router;
