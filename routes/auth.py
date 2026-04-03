import os
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from flask import Blueprint, request, jsonify, g

from database.db import get_db
from middleware.auth_middleware import authenticate

auth_bp = Blueprint("auth", __name__)

JWT_SECRET = os.environ.get("JWT_SECRET", "medcare-secret-key-2024")


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip()
    password = data.get("password", "")
    if not email or not password:
        return jsonify({"error": "Email and password required"}), 400

    conn = get_db()
    user = conn.execute(
        "SELECT * FROM users WHERE email = ? AND is_active = 1", (email,)
    ).fetchone()

    if not user:
        conn.close()
        return jsonify({"error": "Invalid credentials"}), 401

    if not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        conn.close()
        return jsonify({"error": "Invalid credentials"}), 401

    conn.execute(
        "UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", (user["id"],)
    )
    conn.commit()

    expires = datetime.now(tz=timezone.utc) + timedelta(hours=24)
    token = jwt.encode(
        {"id": user["id"], "email": user["email"], "role": user["role"], "exp": expires},
        JWT_SECRET,
        algorithm="HS256",
    )

    site = None
    if user["site_id"]:
        site = conn.execute("SELECT name FROM sites WHERE id = ?", (user["site_id"],)).fetchone()
    conn.close()

    return jsonify({
        "token": token,
        "user": {
            "id": user["id"],
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
            "site_id": user["site_id"],
            "site_name": site["name"] if site else "N/A",
        },
    })


@auth_bp.route("/me", methods=["GET"])
@authenticate
def me():
    conn = get_db()
    site = None
    if g.user["site_id"]:
        site = conn.execute("SELECT name FROM sites WHERE id = ?", (g.user["site_id"],)).fetchone()
    conn.close()
    return jsonify({**g.user, "site_name": site["name"] if site else "N/A"})


@auth_bp.route("/profile", methods=["PUT"])
@authenticate
def update_profile():
    data = request.get_json() or {}
    name = data.get("name") or g.user["name"]
    email = data.get("email") or g.user["email"]
    password = data.get("password")

    conn = get_db()
    if email != g.user["email"]:
        conflict = conn.execute(
            "SELECT id FROM users WHERE email = ? AND id != ?", (email, g.user["id"])
        ).fetchone()
        if conflict:
            conn.close()
            return jsonify({"error": "Email already in use"}), 400

    if password:
        password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(10)).decode("utf-8")
        conn.execute(
            "UPDATE users SET name=?, email=?, password_hash=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (name, email, password_hash, g.user["id"]),
        )
    else:
        conn.execute(
            "UPDATE users SET name=?, email=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
            (name, email, g.user["id"]),
        )
    conn.commit()
    conn.close()
    return jsonify({"message": "Profile updated successfully"})
