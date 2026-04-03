const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { authenticate } = require('../middleware/authMiddleware');
const { auditLog } = require('../middleware/auditMiddleware');

router.use(authenticate);
router.use(auditLog);

const appointmentQuery = `SELECT a.*, 
  p.first_name || ' ' || p.last_name as patient_name, p.patient_number,
  u.name as doctor_name, d.name as department_name, s.name as site_name
  FROM appointments a
  LEFT JOIN patients p ON a.patient_id = p.id
  LEFT JOIN users u ON a.doctor_id = u.id
  LEFT JOIN departments d ON a.department_id = d.id
  LEFT JOIN sites s ON a.site_id = s.id`;

// IMPORTANT: /today must be before /:id
router.get('/today', (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  const appointments = db.prepare(appointmentQuery + ` WHERE a.appointment_date = ? ORDER BY a.appointment_time ASC`).all(today);
  res.json(appointments);
});

router.get('/', (req, res) => {
  const { date, doctor_id, status, site_id, page = 1, limit = 20 } = req.query;
  let whereClause = ` WHERE 1=1`;
  const filterParams = [];
  if (date) { whereClause += ` AND a.appointment_date = ?`; filterParams.push(date); }
  if (doctor_id) { whereClause += ` AND a.doctor_id = ?`; filterParams.push(doctor_id); }
  if (status) { whereClause += ` AND a.status = ?`; filterParams.push(status); }
  if (site_id) { whereClause += ` AND a.site_id = ?`; filterParams.push(site_id); }
  const query = appointmentQuery + whereClause + ` ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT ? OFFSET ?`;
  const appointments = db.prepare(query).all(...filterParams, parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM appointments a${whereClause}`).get(...filterParams).cnt;
  res.json({ appointments, total });
});

router.get('/:id', (req, res) => {
  const appt = db.prepare(appointmentQuery + ` WHERE a.id = ?`).get(req.params.id);
  if (!appt) return res.status(404).json({ error: 'Appointment not found' });
  res.json(appt);
});

router.post('/', (req, res) => {
  const { patient_id, doctor_id, department_id, site_id, appointment_date, appointment_time, status, notes } = req.body;
  if (!patient_id || !appointment_date || !appointment_time) return res.status(400).json({ error: 'Patient, date and time required' });
  const id = uuidv4();
  db.prepare(`INSERT INTO appointments (id, patient_id, doctor_id, department_id, site_id, appointment_date, appointment_time, status, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(id, patient_id, doctor_id, department_id, site_id, appointment_date, appointment_time, status || 'scheduled', notes, req.user.id);
  res.status(201).json({ id, message: 'Appointment created successfully' });
});

router.put('/:id', (req, res) => {
  const { patient_id, doctor_id, department_id, site_id, appointment_date, appointment_time, status, notes } = req.body;
  const existing = db.prepare('SELECT id FROM appointments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Appointment not found' });
  db.prepare(`UPDATE appointments SET patient_id=?, doctor_id=?, department_id=?, site_id=?, appointment_date=?, appointment_time=?, status=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(patient_id, doctor_id, department_id, site_id, appointment_date, appointment_time, status, notes, req.params.id);
  res.json({ message: 'Appointment updated successfully' });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
  res.json({ message: 'Appointment deleted successfully' });
});

module.exports = router;
