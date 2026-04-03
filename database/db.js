const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(path.join(dataDir, 'hospital.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

// Seed default site
const siteExists = db.prepare('SELECT id FROM sites WHERE name = ?').get('Main Hospital');
let defaultSiteId;
if (!siteExists) {
  defaultSiteId = uuidv4();
  db.prepare('INSERT INTO sites (id, name, address, phone) VALUES (?, ?, ?, ?)').run(
    defaultSiteId, 'Main Hospital', '123 Medical Street, Health City', '+1-555-0100'
  );
} else {
  defaultSiteId = siteExists.id;
}

// Seed default admin user
const adminExists = db.prepare('SELECT id FROM users WHERE email = ?').get('admin@hospital.com');
if (!adminExists) {
  const passwordHash = bcrypt.hashSync('Admin@123', 10);
  db.prepare('INSERT INTO users (id, name, email, password_hash, role, site_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
    uuidv4(), 'System Administrator', 'admin@hospital.com', passwordHash, 'admin', defaultSiteId, 1
  );
}

// Seed default departments
const deptExists = db.prepare('SELECT id FROM departments LIMIT 1').get();
if (!deptExists) {
  const depts = ['General Medicine', 'Surgery', 'Pediatrics', 'Cardiology', 'Orthopedics', 'Gynecology', 'Emergency', 'Radiology'];
  const insertDept = db.prepare('INSERT INTO departments (id, name, site_id) VALUES (?, ?, ?)');
  for (const d of depts) {
    insertDept.run(uuidv4(), d, defaultSiteId);
  }
}

// Seed default wards
const wardExists = db.prepare('SELECT id FROM wards LIMIT 1').get();
if (!wardExists) {
  const wards = ['General Ward', 'ICU', 'Emergency Ward', 'Maternity Ward', 'Pediatric Ward', 'Surgical Ward'];
  const insertWard = db.prepare('INSERT INTO wards (id, name, site_id) VALUES (?, ?, ?)');
  for (const w of wards) {
    insertWard.run(uuidv4(), w, defaultSiteId);
  }
}

module.exports = db;
