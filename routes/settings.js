const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const db = require('../database/db');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { auditLog } = require('../middleware/auditMiddleware');

router.use(authenticate, requireRole('admin'), auditLog);

// System Settings
router.get('/system', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM system_settings').all();
  const settings = {};
  rows.forEach(r => { settings[r.key] = r.value; });
  res.json(settings);
});

router.put('/system', (req, res) => {
  const { language, currency, date_format } = req.body;
  const stmt = db.prepare('INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)');
  if (language) stmt.run('language', language);
  if (currency) stmt.run('currency', currency);
  if (date_format) stmt.run('date_format', date_format);
  res.json({ message: 'Settings saved successfully' });
});

// Database Backup
router.get('/backup', (req, res) => {
  const dbPath = path.join(__dirname, '..', 'data', 'hospital.db');
  if (!fs.existsSync(dbPath)) return res.status(404).json({ error: 'Database file not found' });
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `hospital-backup-${date}.db`;
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  fs.createReadStream(dbPath).pipe(res);
});

// Database Restore (accepts JSON body with base64-encoded DB)
router.post('/restore', (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'No backup data provided' });
  try {
    const buffer = Buffer.from(data, 'base64');
    // Validate SQLite magic bytes
    const magic = buffer.slice(0, 16).toString('ascii');
    if (!magic.startsWith('SQLite format 3')) {
      return res.status(400).json({ error: 'Invalid SQLite database file' });
    }
    const dbPath = path.join(__dirname, '..', 'data', 'hospital.db');
    const tmpPath = dbPath + '.restore_tmp';
    fs.writeFileSync(tmpPath, buffer);
    fs.renameSync(tmpPath, dbPath);
    res.json({ message: 'Database restored successfully. Please restart the server.' });
  } catch (e) {
    res.status(500).json({ error: 'Restore failed: ' + e.message });
  }
});

// Sites
router.get('/sites', (req, res) => { res.json(db.prepare('SELECT * FROM sites ORDER BY name').all()); });
router.post('/sites', (req, res) => {
  const { name, address, phone } = req.body;
  if (!name) return res.status(400).json({ error: 'Site name required' });
  const id = uuidv4();
  db.prepare('INSERT INTO sites (id, name, address, phone) VALUES (?, ?, ?, ?)').run(id, name, address, phone);
  res.status(201).json({ id, message: 'Site created' });
});
router.put('/sites/:id', (req, res) => {
  const { name, address, phone } = req.body;
  db.prepare('UPDATE sites SET name=?, address=?, phone=? WHERE id=?').run(name, address, phone, req.params.id);
  res.json({ message: 'Site updated' });
});
router.delete('/sites/:id', (req, res) => {
  db.prepare('DELETE FROM sites WHERE id = ?').run(req.params.id);
  res.json({ message: 'Site deleted' });
});

// Wards
router.get('/wards', (req, res) => {
  const { site_id } = req.query;
  let query = 'SELECT w.*, s.name as site_name FROM wards w LEFT JOIN sites s ON w.site_id = s.id';
  const params = [];
  if (site_id) { query += ' WHERE w.site_id = ?'; params.push(site_id); }
  query += ' ORDER BY w.name';
  res.json(db.prepare(query).all(...params));
});
router.post('/wards', (req, res) => {
  const { name, site_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Ward name required' });
  const id = uuidv4();
  db.prepare('INSERT INTO wards (id, name, site_id) VALUES (?, ?, ?)').run(id, name, site_id);
  res.status(201).json({ id, message: 'Ward created' });
});
router.put('/wards/:id', (req, res) => {
  const { name, site_id } = req.body;
  db.prepare('UPDATE wards SET name=?, site_id=? WHERE id=?').run(name, site_id, req.params.id);
  res.json({ message: 'Ward updated' });
});
router.delete('/wards/:id', (req, res) => {
  db.prepare('DELETE FROM wards WHERE id = ?').run(req.params.id);
  res.json({ message: 'Ward deleted' });
});

// Departments
router.get('/departments', (req, res) => {
  const { site_id } = req.query;
  let query = 'SELECT d.*, s.name as site_name FROM departments d LEFT JOIN sites s ON d.site_id = s.id';
  const params = [];
  if (site_id) { query += ' WHERE d.site_id = ?'; params.push(site_id); }
  query += ' ORDER BY d.name';
  res.json(db.prepare(query).all(...params));
});
router.post('/departments', (req, res) => {
  const { name, site_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Department name required' });
  const id = uuidv4();
  db.prepare('INSERT INTO departments (id, name, site_id) VALUES (?, ?, ?)').run(id, name, site_id);
  res.status(201).json({ id, message: 'Department created' });
});
router.put('/departments/:id', (req, res) => {
  const { name, site_id } = req.body;
  db.prepare('UPDATE departments SET name=?, site_id=? WHERE id=?').run(name, site_id, req.params.id);
  res.json({ message: 'Department updated' });
});
router.delete('/departments/:id', (req, res) => {
  db.prepare('DELETE FROM departments WHERE id = ?').run(req.params.id);
  res.json({ message: 'Department deleted' });
});

module.exports = router;
