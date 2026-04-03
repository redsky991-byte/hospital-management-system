const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');

function auditLog(req, res, next) {
  const originalJson = res.json.bind(res);
  res.json = function(data) {
    if (req.user && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
      try {
        const parts = req.path.split('/').filter(Boolean);
        const module = parts[0] || 'unknown';
        const recordId = parts[1] || null;
        const action = req.method === 'POST' ? 'CREATE' : req.method === 'PUT' ? 'UPDATE' : req.method === 'DELETE' ? 'DELETE' : 'PATCH';
        db.prepare('INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
          uuidv4(),
          req.user.id,
          req.user.name,
          action,
          module,
          recordId,
          JSON.stringify({ method: req.method, path: req.path, body: req.body }),
          req.ip || req.socket.remoteAddress
        );
      } catch (e) {
        // Audit log errors should not break the response
        console.error('Audit log error:', e.message);
      }
    }
    return originalJson(data);
  };
  next();
}

module.exports = { auditLog };
