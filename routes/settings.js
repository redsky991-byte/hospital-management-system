const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const os = require('os');
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

// Database Backup — uses db.backup() for a WAL-safe consistent snapshot
router.get('/backup', async (req, res) => {
  const date = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `hospital-backup-${date}.db`;
  const tmpPath = path.join(os.tmpdir(), filename);
  try {
    await db.backup(tmpPath);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/octet-stream');
    const stream = fs.createReadStream(tmpPath);
    stream.on('error', (err) => {
      if (!res.headersSent) res.status(500).json({ error: 'Backup read failed: ' + err.message });
    });
    stream.on('close', () => {
      fs.unlink(tmpPath, () => {}); // clean up temp file after streaming
    });
    stream.pipe(res);
  } catch (e) {
    try { fs.unlinkSync(tmpPath); } catch {}
    res.status(500).json({ error: 'Backup failed: ' + e.message });
  }
});

// Database Restore — validates, closes connection, removes WAL/SHM, then restarts
// Uses a high per-route body limit (50mb base64 ≈ ~37MB raw DB)
router.post('/restore', express.json({ limit: '50mb' }), (req, res) => {
  const { data } = req.body;
  if (!data) return res.status(400).json({ error: 'No backup data provided' });

  const dbPath = path.join(__dirname, '..', 'data', 'hospital.db');
  const walPath = dbPath + '-wal';
  const shmPath = dbPath + '-shm';
  const tmpPath = dbPath + '.restore_tmp';

  try {
    const buffer = Buffer.from(data, 'base64');

    // Validate SQLite magic bytes from the uploaded content
    const magic = buffer.slice(0, 16).toString('ascii');
    if (!magic.startsWith('SQLite format 3')) {
      return res.status(400).json({ error: 'Invalid SQLite database file' });
    }

    fs.writeFileSync(tmpPath, buffer, { flag: 'w' });

    // Re-validate the staged file before replacing the live database
    const stagedMagic = fs.readFileSync(tmpPath).slice(0, 16).toString('ascii');
    if (!stagedMagic.startsWith('SQLite format 3')) {
      fs.unlinkSync(tmpPath);
      return res.status(400).json({ error: 'Staged file validation failed' });
    }

    // Stop access through the current connection before replacing the database files
    if (db && typeof db.close === 'function') {
      db.close();
    }

    // Remove stale WAL/SHM sidecar files so they do not conflict with the restored DB
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath);
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath);

    // Replace the main DB file with the validated staged file
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    fs.renameSync(tmpPath, dbPath);

    res.json({ message: 'Database restored successfully. Server will now restart.' });
    res.on('finish', () => {
      process.nextTick(() => process.exit(0));
    });
  } catch (e) {
    try { if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath); } catch {}
    if (!res.headersSent) res.status(500).json({ error: 'Restore failed: ' + e.message });
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
