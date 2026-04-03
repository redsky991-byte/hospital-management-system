const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const db = require('../database/db');
const { authenticate, requireRole } = require('../middleware/authMiddleware');
const { auditLog } = require('../middleware/auditMiddleware');

router.use(authenticate);
router.use(auditLog);

function generateInvoiceNumber() {
  const year = new Date().getFullYear();
  const count = db.prepare('SELECT COUNT(*) as cnt FROM invoices').get().cnt;
  return `INV-${year}-${String(count + 1).padStart(3, '0')}`;
}

router.get('/', (req, res) => {
  const { status, patient_id, site_id, page = 1, limit = 20 } = req.query;
  let query = `SELECT i.*, p.first_name || ' ' || p.last_name as patient_name, p.patient_number, s.name as site_name
    FROM invoices i LEFT JOIN patients p ON i.patient_id = p.id LEFT JOIN sites s ON i.site_id = s.id WHERE 1=1`;
  const params = [];
  if (status) { query += ` AND i.status = ?`; params.push(status); }
  if (patient_id) { query += ` AND i.patient_id = ?`; params.push(patient_id); }
  if (site_id) { query += ` AND i.site_id = ?`; params.push(site_id); }
  query += ` ORDER BY i.created_at DESC LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), (parseInt(page) - 1) * parseInt(limit));
  const invoices = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as cnt FROM invoices').get().cnt;
  res.json({ invoices, total });
});

router.get('/:id', (req, res) => {
  const invoice = db.prepare(`SELECT i.*, p.first_name || ' ' || p.last_name as patient_name, p.patient_number, s.name as site_name
    FROM invoices i LEFT JOIN patients p ON i.patient_id = p.id LEFT JOIN sites s ON i.site_id = s.id WHERE i.id = ?`).get(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  const items = db.prepare('SELECT * FROM invoice_items WHERE invoice_id = ?').all(req.params.id);
  res.json({ ...invoice, items });
});

router.post('/', (req, res) => {
  const { patient_id, site_id, items, discount = 0, tax = 0, due_date, notes } = req.body;
  if (!patient_id) return res.status(400).json({ error: 'Patient required' });
  const id = uuidv4();
  const invoice_number = generateInvoiceNumber();
  const subtotal = (items || []).reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
  const total_amount = subtotal - discount + (subtotal * tax / 100);
  const balance = total_amount;
  db.prepare(`INSERT INTO invoices (id, invoice_number, patient_id, site_id, total_amount, discount, tax, paid_amount, balance, status, due_date, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'draft', ?, ?, ?)`).run(id, invoice_number, patient_id, site_id, total_amount, discount, tax, balance, due_date, notes, req.user.id);
  const insertItem = db.prepare('INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)');
  for (const item of (items || [])) {
    insertItem.run(uuidv4(), id, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price);
  }
  res.status(201).json({ id, invoice_number, message: 'Invoice created successfully' });
});

router.put('/:id', (req, res) => {
  const { status, discount, tax, due_date, notes, items } = req.body;
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  let total_amount = inv.total_amount;
  if (items) {
    db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(req.params.id);
    const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    total_amount = subtotal - (discount || 0) + (subtotal * (tax || 0) / 100);
    const insertItem = db.prepare('INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)');
    for (const item of items) {
      insertItem.run(uuidv4(), req.params.id, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price);
    }
  }
  const balance = total_amount - inv.paid_amount;
  db.prepare(`UPDATE invoices SET status=?, discount=?, tax=?, total_amount=?, balance=?, due_date=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(status || inv.status, discount ?? inv.discount, tax ?? inv.tax, total_amount, balance, due_date || inv.due_date, notes || inv.notes, req.params.id);
  res.json({ message: 'Invoice updated successfully' });
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM invoice_items WHERE invoice_id = ?').run(req.params.id);
  db.prepare('DELETE FROM invoices WHERE id = ?').run(req.params.id);
  res.json({ message: 'Invoice deleted successfully' });
});

router.post('/:id/payment', (req, res) => {
  const { amount } = req.body;
  if (!amount || amount <= 0) return res.status(400).json({ error: 'Valid payment amount required' });
  const inv = db.prepare('SELECT * FROM invoices WHERE id = ?').get(req.params.id);
  if (!inv) return res.status(404).json({ error: 'Invoice not found' });
  const new_paid = inv.paid_amount + parseFloat(amount);
  const new_balance = inv.total_amount - new_paid;
  const new_status = new_balance <= 0 ? 'paid' : inv.status;
  db.prepare('UPDATE invoices SET paid_amount=?, balance=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(new_paid, Math.max(0, new_balance), new_status, req.params.id);
  res.json({ message: 'Payment recorded successfully', paid_amount: new_paid, balance: Math.max(0, new_balance) });
});

module.exports = router;
