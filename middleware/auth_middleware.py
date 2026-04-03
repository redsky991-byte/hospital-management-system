import os
import jwt
from functools import wraps
from flask import request, jsonify, g
from database.db import get_db

JWT_SECRET = os.environ.get("JWT_SECRET", "medcare-secret-key-2024")


def authenticate(f):
    """Decorator: verify JWT, attach user to flask.g.user."""
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        parts = auth_header.split()
        if len(parts) != 2 or parts[0].lower() != "bearer":
            return jsonify({"error": "Access token required"}), 401
        token = parts[1]
        try:
            decoded = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return jsonify({"error": "Invalid or expired token"}), 401
        except jwt.InvalidTokenError:
            return jsonify({"error": "Invalid or expired token"}), 401

        conn = get_db()
        user = conn.execute(
            "SELECT id, name, email, role, site_id, is_active FROM users WHERE id = ?",
            (decoded["id"],),
        ).fetchone()
        conn.close()

        if not user or not user["is_active"]:
            return jsonify({"error": "User not found or inactive"}), 401

        g.user = dict(user)
        return f(*args, **kwargs)

    return decorated


def require_role(*roles):
    """Decorator factory: require one of the given roles (apply after @authenticate)."""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            if not hasattr(g, "user"):
                return jsonify({"error": "Not authenticated"}), 401
            if g.user["role"] not in roles:
                return jsonify({"error": "Insufficient permissions"}), 403
            return f(*args, **kwargs)
        return decorated
    return decorator
