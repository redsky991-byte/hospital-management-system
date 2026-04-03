import uuid
import shutil
import base64
import tempfile
import os
from pathlib import Path
from flask import Blueprint, request, jsonify, send_file

from database.db import get_db, DB_PATH
from middleware.auth_middleware import authenticate, require_role
from middleware.audit_middleware import audit_log_after

settings_bp = Blueprint("settings", __name__)


@settings_bp.after_request
def after(response):
    return audit_log_after(response)


# ── System Settings ───────────────────────────────────────────────────────────

@settings_bp.route("/system", methods=["GET"])
@authenticate
@require_role("admin")
def get_system_settings():
    conn = get_db()
    rows = conn.execute("SELECT key, value FROM system_settings").fetchall()
    conn.close()
    return jsonify({r["key"]: r["value"] for r in rows})


@settings_bp.route("/system", methods=["PUT"])
@authenticate
@require_role("admin")
def update_system_settings():
    data = request.get_json() or {}
    conn = get_db()
    for key in ("language", "currency", "date_format"):
        if key in data:
            conn.execute(
                "INSERT OR REPLACE INTO system_settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
                (key, data[key]),
            )
    conn.commit()
    conn.close()
    return jsonify({"message": "Settings saved successfully"})


# ── Backup / Restore ──────────────────────────────────────────────────────────

@settings_bp.route("/backup", methods=["GET"])
@authenticate
@require_role("admin")
def backup_db():
    from datetime import datetime
    date_str = datetime.utcnow().strftime("%Y-%m-%dT%H-%M-%S")
    filename = f"hospital-backup-{date_str}.db"
    tmp = Path(tempfile.mkdtemp()) / filename
    try:
        shutil.copy2(str(DB_PATH), str(tmp))
        return send_file(
            str(tmp),
            as_attachment=True,
            download_name=filename,
            mimetype="application/octet-stream",
        )
    except Exception as e:
        return jsonify({"error": f"Backup failed: {e}"}), 500


@settings_bp.route("/restore", methods=["POST"])
@authenticate
@require_role("admin")
def restore_db():
    data = request.get_json() or {}
    b64 = data.get("data")
    if not b64:
        return jsonify({"error": "No backup data provided"}), 400

    wal_path = Path(str(DB_PATH) + "-wal")
    shm_path = Path(str(DB_PATH) + "-shm")
    tmp_path = Path(str(DB_PATH) + ".restore_tmp")

    try:
        buffer = base64.b64decode(b64)

        # Validate SQLite magic bytes
        if not buffer[:16].startswith(b"SQLite format 3"):
            return jsonify({"error": "Invalid SQLite database file"}), 400

        tmp_path.write_bytes(buffer)

        # Re-validate staged file
        with open(str(tmp_path), "rb") as f:
            header = f.read(16)
        if not header.startswith(b"SQLite format 3"):
            tmp_path.unlink(missing_ok=True)
            return jsonify({"error": "Staged file validation failed"}), 400

        # Remove WAL/SHM sidecars
        wal_path.unlink(missing_ok=True)
        shm_path.unlink(missing_ok=True)

        # Replace DB file
        if DB_PATH.exists():
            DB_PATH.unlink()
        tmp_path.rename(DB_PATH)

        import threading
        def _exit():
            import time, sys
            time.sleep(0.2)
            os._exit(0)
        threading.Thread(target=_exit, daemon=True).start()

        return jsonify({
            "message": (
                "Database restored successfully. The server is restarting — "
                "please wait a moment, then reload the page. "
                "(Requires a process manager such as PM2 or systemd to auto-restart.)"
            )
        })
    except Exception as e:
        tmp_path.unlink(missing_ok=True)
        return jsonify({"error": f"Restore failed: {e}"}), 500


# ── Sites ─────────────────────────────────────────────────────────────────────

@settings_bp.route("/sites", methods=["GET"])
@authenticate
@require_role("admin")
def list_sites():
    conn = get_db()
    rows = conn.execute("SELECT * FROM sites ORDER BY name").fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@settings_bp.route("/sites", methods=["POST"])
@authenticate
@require_role("admin")
def create_site():
    data = request.get_json() or {}
    if not data.get("name"):
        return jsonify({"error": "Site name required"}), 400
    sid = str(uuid.uuid4())
    conn = get_db()
    conn.execute(
        "INSERT INTO sites (id, name, address, phone) VALUES (?, ?, ?, ?)",
        (sid, data["name"], data.get("address"), data.get("phone")),
    )
    conn.commit()
    conn.close()
    return jsonify({"id": sid, "message": "Site created"}), 201


@settings_bp.route("/sites/<sid>", methods=["PUT"])
@authenticate
@require_role("admin")
def update_site(sid):
    data = request.get_json() or {}
    conn = get_db()
    conn.execute(
        "UPDATE sites SET name=?, address=?, phone=? WHERE id=?",
        (data.get("name"), data.get("address"), data.get("phone"), sid),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Site updated"})


@settings_bp.route("/sites/<sid>", methods=["DELETE"])
@authenticate
@require_role("admin")
def delete_site(sid):
    conn = get_db()
    conn.execute("DELETE FROM sites WHERE id = ?", (sid,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Site deleted"})


# ── Wards ─────────────────────────────────────────────────────────────────────

@settings_bp.route("/wards", methods=["GET"])
@authenticate
@require_role("admin")
def list_wards():
    site_id = request.args.get("site_id")
    query = "SELECT w.*, s.name as site_name FROM wards w LEFT JOIN sites s ON w.site_id = s.id"
    params = []
    if site_id:
        query += " WHERE w.site_id = ?"
        params.append(site_id)
    query += " ORDER BY w.name"
    conn = get_db()
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@settings_bp.route("/wards", methods=["POST"])
@authenticate
@require_role("admin")
def create_ward():
    data = request.get_json() or {}
    if not data.get("name"):
        return jsonify({"error": "Ward name required"}), 400
    wid = str(uuid.uuid4())
    conn = get_db()
    conn.execute(
        "INSERT INTO wards (id, name, site_id) VALUES (?, ?, ?)",
        (wid, data["name"], data.get("site_id")),
    )
    conn.commit()
    conn.close()
    return jsonify({"id": wid, "message": "Ward created"}), 201


@settings_bp.route("/wards/<wid>", methods=["PUT"])
@authenticate
@require_role("admin")
def update_ward(wid):
    data = request.get_json() or {}
    conn = get_db()
    conn.execute(
        "UPDATE wards SET name=?, site_id=? WHERE id=?",
        (data.get("name"), data.get("site_id"), wid),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Ward updated"})


@settings_bp.route("/wards/<wid>", methods=["DELETE"])
@authenticate
@require_role("admin")
def delete_ward(wid):
    conn = get_db()
    conn.execute("DELETE FROM wards WHERE id = ?", (wid,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Ward deleted"})


# ── Departments ───────────────────────────────────────────────────────────────

@settings_bp.route("/departments", methods=["GET"])
@authenticate
@require_role("admin")
def list_departments():
    site_id = request.args.get("site_id")
    query = "SELECT d.*, s.name as site_name FROM departments d LEFT JOIN sites s ON d.site_id = s.id"
    params = []
    if site_id:
        query += " WHERE d.site_id = ?"
        params.append(site_id)
    query += " ORDER BY d.name"
    conn = get_db()
    rows = conn.execute(query, params).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@settings_bp.route("/departments", methods=["POST"])
@authenticate
@require_role("admin")
def create_department():
    data = request.get_json() or {}
    if not data.get("name"):
        return jsonify({"error": "Department name required"}), 400
    did = str(uuid.uuid4())
    conn = get_db()
    conn.execute(
        "INSERT INTO departments (id, name, site_id) VALUES (?, ?, ?)",
        (did, data["name"], data.get("site_id")),
    )
    conn.commit()
    conn.close()
    return jsonify({"id": did, "message": "Department created"}), 201


@settings_bp.route("/departments/<did>", methods=["PUT"])
@authenticate
@require_role("admin")
def update_department(did):
    data = request.get_json() or {}
    conn = get_db()
    conn.execute(
        "UPDATE departments SET name=?, site_id=? WHERE id=?",
        (data.get("name"), data.get("site_id"), did),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Department updated"})


@settings_bp.route("/departments/<did>", methods=["DELETE"])
@authenticate
@require_role("admin")
def delete_department(did):
    conn = get_db()
    conn.execute("DELETE FROM departments WHERE id = ?", (did,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Department deleted"})
