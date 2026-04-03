from flask import Blueprint, request, jsonify

from database.db import get_db
from middleware.auth_middleware import authenticate, require_role

audit_bp = Blueprint("audit", __name__)


@audit_bp.route("/", methods=["GET"])
@authenticate
@require_role("admin")
def list_audit_logs():
    user_id = request.args.get("user_id")
    module = request.args.get("module")
    action = request.args.get("action")
    from_date = request.args.get("from_date")
    to_date = request.args.get("to_date")
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 50))
    offset = (page - 1) * limit

    where = "WHERE 1=1"
    params = []
    if user_id:
        where += " AND user_id = ?"
        params.append(user_id)
    if module:
        where += " AND module = ?"
        params.append(module)
    if action:
        where += " AND action = ?"
        params.append(action)
    if from_date:
        where += " AND created_at >= ?"
        params.append(from_date)
    if to_date:
        where += " AND created_at <= ?"
        params.append(f"{to_date} 23:59:59")

    conn = get_db()
    logs = [
        dict(r)
        for r in conn.execute(
            f"SELECT * FROM audit_logs {where} ORDER BY created_at DESC LIMIT ? OFFSET ?",
            params + [limit, offset],
        ).fetchall()
    ]
    total = conn.execute(f"SELECT COUNT(*) FROM audit_logs {where}", params).fetchone()[0]
    conn.close()
    return jsonify({"logs": logs, "total": total})
