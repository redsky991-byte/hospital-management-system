const express = require('express');
const router = express.Router();
const db = require('../database/db');
const { authenticate, requireRole } = require('../middleware/authMiddleware');

router.use(authenticate, requireRole('admin'));

router.get('/', (req, res) => {
  const { user_id, module, action, from_date, to_date, page = 1, limit = 50 } = req.query;
  let whereClause = 'WHERE 1=1';
  const filterParams = [];
  if (user_id) { whereClause += ' AND user_id = ?'; filterParams.push(user_id); }
  if (module) { whereClause += ' AND module = ?'; filterParams.push(module); }
  if (action) { whereClause += ' AND action = ?'; filterParams.push(action); }
  if (from_date) { whereClause += ' AND created_at >= ?'; filterParams.push(from_date); }
  if (to_date) { whereClause += ' AND created_at <= ?'; filterParams.push(to_date + ' 23:59:59'); }
  const query = `SELECT * FROM audit_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  const logs = db.prepare(query).all(...filterParams, parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const total = db.prepare(`SELECT COUNT(*) as cnt FROM audit_logs ${whereClause}`).get(...filterParams).cnt;
  res.json({ logs, total });
});

module.exports = router;
