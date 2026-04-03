import sqlite3
import os
import uuid
import bcrypt
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)

DB_PATH = DATA_DIR / "hospital.db"
SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"


def get_db():
    """Open a new database connection with row_factory for dict-like rows."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    """Initialize schema and seed default data."""
    conn = get_db()
    with open(SCHEMA_PATH, "r") as f:
        conn.executescript(f.read())

    # Seed default site
    site_row = conn.execute("SELECT id FROM sites WHERE name = ?", ("Main Hospital",)).fetchone()
    if site_row:
        default_site_id = site_row["id"]
    else:
        default_site_id = str(uuid.uuid4())
        conn.execute(
            "INSERT INTO sites (id, name, address, phone) VALUES (?, ?, ?, ?)",
            (default_site_id, "Main Hospital", "123 Medical Street, Health City", "+1-555-0100"),
        )

    # Seed default admin user
    admin_row = conn.execute("SELECT id FROM users WHERE email = ?", ("admin@hospital.com",)).fetchone()
    if not admin_row:
        password_hash = bcrypt.hashpw(b"Admin@123", bcrypt.gensalt(10)).decode("utf-8")
        conn.execute(
            "INSERT INTO users (id, name, email, password_hash, role, site_id, is_active) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), "System Administrator", "admin@hospital.com", password_hash, "admin", default_site_id, 1),
        )

    # Seed default departments
    dept_row = conn.execute("SELECT id FROM departments LIMIT 1").fetchone()
    if not dept_row:
        depts = ["General Medicine", "Surgery", "Pediatrics", "Cardiology", "Orthopedics", "Gynecology", "Emergency", "Radiology"]
        for d in depts:
            conn.execute(
                "INSERT INTO departments (id, name, site_id) VALUES (?, ?, ?)",
                (str(uuid.uuid4()), d, default_site_id),
            )

    # Seed default wards
    ward_row = conn.execute("SELECT id FROM wards LIMIT 1").fetchone()
    if not ward_row:
        wards = ["General Ward", "ICU", "Emergency Ward", "Maternity Ward", "Pediatric Ward", "Surgical Ward"]
        for w in wards:
            conn.execute(
                "INSERT INTO wards (id, name, site_id) VALUES (?, ?, ?)",
                (str(uuid.uuid4()), w, default_site_id),
            )

    # Seed default system settings
    for key, value in [("language", "en"), ("currency", "USD"), ("date_format", "YYYY-MM-DD")]:
        conn.execute("INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)", (key, value))

    # Migration: add last_login_at if missing
    try:
        conn.execute("ALTER TABLE users ADD COLUMN last_login_at DATETIME")
    except Exception:
        pass  # Column already exists

    conn.commit()
    conn.close()
