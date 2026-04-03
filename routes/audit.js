const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

router.use(authenticate, requireRole('admin'));

router.get('/', (req, res) => {
  const { user_id, module, action, from_date, to_date, page = 1, limit = 50 } = req.query;
  let query = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];
  if (user_id) { query += ' AND user_id = ?'; params.push(user_id); }
  if (module) { query += ' AND module = ?'; params.push(module); }
  if (action) { query += ' AND action = ?'; params.push(action); }
  if (from_date) { query += ' AND created_at >= ?'; params.push(from_date); }
  if (to_date) { query += ' AND created_at <= ?'; params.push(to_date + ' 23:59:59'); }
  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const logs = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as cnt FROM audit_logs').get().cnt;
  res.json({ logs, total });
});

module.exports = router;
