import uuid
import json
from flask import request, g
from database.db import get_db


def audit_log_after(response):
    """Call this after each mutating request to record an audit entry."""
    if not hasattr(g, "user"):
        return response
    if request.method not in ("POST", "PUT", "DELETE", "PATCH"):
        return response

    try:
        parts = [p for p in request.path.split("/") if p]
        module = parts[1] if len(parts) > 1 else "unknown"  # skip 'api' prefix
        record_id = parts[2] if len(parts) > 2 else None
        action_map = {"POST": "CREATE", "PUT": "UPDATE", "DELETE": "DELETE", "PATCH": "PATCH"}
        action = action_map.get(request.method, request.method)

        body = {}
        try:
            body = request.get_json(silent=True) or {}
        except Exception:
            pass

        ip = request.headers.get("X-Forwarded-For", request.remote_addr)

        conn = get_db()
        conn.execute(
            "INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (
                str(uuid.uuid4()),
                g.user["id"],
                g.user["name"],
                action,
                module,
                record_id,
                json.dumps({"method": request.method, "path": request.path, "body": body}),
                ip,
            ),
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Audit log error: {e}")

    return response
