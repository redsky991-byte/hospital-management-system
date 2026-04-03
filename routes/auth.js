const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');
const { authenticate } = require('../middleware/authMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'medcare-secret-key-2024';

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
  const user = db.prepare('SELECT * FROM users WHERE email = ? AND is_active = 1').get(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  const site = user.site_id ? db.prepare('SELECT name FROM sites WHERE id = ?').get(user.site_id) : null;
  res.json({
    token,
    user: { id: user.id, name: user.name, email: user.email, role: user.role, site_id: user.site_id, site_name: site ? site.name : 'N/A' }
  });
});

router.get('/me', authenticate, (req, res) => {
  const site = req.user.site_id ? db.prepare('SELECT name FROM sites WHERE id = ?').get(req.user.site_id) : null;
  res.json({ ...req.user, site_name: site ? site.name : 'N/A' });
});

router.put('/profile', authenticate, (req, res) => {
  const { name, email, password } = req.body;
  let query = 'UPDATE users SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
  let params = [name || req.user.name, email || req.user.email, req.user.id];
  if (password) {
    const hash = bcrypt.hashSync(password, 10);
    query = 'UPDATE users SET name = ?, email = ?, password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?';
    params = [name || req.user.name, email || req.user.email, hash, req.user.id];
  }
  db.prepare(query).run(...params);
  res.json({ message: 'Profile updated successfully' });
});

module.exports = router;
