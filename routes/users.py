import uuid
import bcrypt
from flask import Blueprint, request, jsonify, g

from database.db import get_db
from middleware.auth_middleware import authenticate, require_role
from middleware.audit_middleware import audit_log_after

users_bp = Blueprint("users", __name__)


@users_bp.after_request
def after(response):
    return audit_log_after(response)


@users_bp.route("/", methods=["GET"])
@authenticate
@require_role("admin")
def list_users():
    conn = get_db()
    rows = conn.execute(
        """SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.last_login_at, u.site_id, s.name as site_name
           FROM users u LEFT JOIN sites s ON u.site_id = s.id ORDER BY u.created_at DESC"""
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@users_bp.route("/<uid>", methods=["GET"])
@authenticate
@require_role("admin")
def get_user(uid):
    conn = get_db()
    row = conn.execute(
        """SELECT u.id, u.name, u.email, u.role, u.is_active, u.created_at, u.last_login_at, u.site_id, s.name as site_name
           FROM users u LEFT JOIN sites s ON u.site_id = s.id WHERE u.id = ?""",
        (uid,),
    ).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "User not found"}), 404
    return jsonify(dict(row))


@users_bp.route("/", methods=["POST"])
@authenticate
@require_role("admin")
def create_user():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    password = data.get("password", "")
    if not name or not email or not password:
        return jsonify({"error": "Name, email and password required"}), 400

    conn = get_db()
    if conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone():
        conn.close()
        return jsonify({"error": "Email already in use"}), 400

    uid = str(uuid.uuid4())
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(10)).decode("utf-8")
    conn.execute(
        "INSERT INTO users (id, name, email, password_hash, role, site_id, is_active) VALUES (?, ?, ?, ?, ?, ?, 1)",
        (uid, name, email, password_hash, data.get("role", "nurse"), data.get("site_id")),
    )
    conn.commit()
    conn.close()
    return jsonify({"id": uid, "message": "User created successfully"}), 201


@users_bp.route("/<uid>", methods=["PUT"])
@authenticate
@require_role("admin")
def update_user(uid):
    data = request.get_json() or {}
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (uid,)).fetchone()
    if not user:
        conn.close()
        return jsonify({"error": "User not found"}), 404

    user = dict(user)
    password = data.get("password")
    password_hash = user["password_hash"]
    if password:
        password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(10)).decode("utf-8")

    is_active = data.get("is_active")
    if is_active is None:
        is_active = user["is_active"]

    conn.execute(
        "UPDATE users SET name=?, email=?, password_hash=?, role=?, site_id=?, is_active=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (
            data.get("name") or user["name"],
            data.get("email") or user["email"],
            password_hash,
            data.get("role") or user["role"],
            data.get("site_id") or user["site_id"],
            is_active,
            uid,
        ),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "User updated successfully"})


@users_bp.route("/<uid>", methods=["DELETE"])
@authenticate
@require_role("admin")
def delete_user(uid):
    if uid == g.user["id"]:
        return jsonify({"error": "Cannot delete your own account"}), 400
    conn = get_db()
    conn.execute("DELETE FROM users WHERE id = ?", (uid,))
    conn.commit()
    conn.close()
    return jsonify({"message": "User deleted successfully"})
