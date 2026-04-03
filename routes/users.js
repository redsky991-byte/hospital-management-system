const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { auditLog } = require('../middleware/auditMiddleware');

router.use(authenticate, requireRole('admin'), auditLog);

router.get('/', (req, res) => {
  const users = db.prepare(`SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.site_id, s.name as site_name
    FROM users u LEFT JOIN sites s ON u.site_id = s.id ORDER BY u.created_at DESC`).all();
  res.json(users);
});

router.get('/:id', (req, res) => {
  const user = db.prepare(`SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.site_id, s.name as site_name
    FROM users u LEFT JOIN sites s ON u.site_id = s.id WHERE u.id = ?`).get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

router.post('/', (req, res) => {
  const { name, email, password, role, site_id } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(400).json({ error: 'Email already in use' });
  const id = uuidv4();
  const hash = bcrypt.hashSync(password, 10);
  db.prepare('INSERT INTO users (id, name, email, password_hash, role, site_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)')
    .run(id, name, email, hash, role || 'nurse', site_id);
  res.status(201).json({ id, message: 'User created successfully' });
});

router.put('/:id', (req, res) => {
  const { name, email, password, role, site_id, is_active } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  let hash = user.password_hash;
  if (password) hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET name=?, email=?, password_hash=?, role=?, site_id=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?')
    .run(name || user.name, email || user.email, hash, role || user.role, site_id || user.site_id, is_active !== undefined ? is_active : user.is_active, req.params.id);
  res.json({ message: 'User updated successfully' });
});

router.delete('/:id', (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ message: 'User deleted successfully' });
});

module.exports = router;
