import uuid
from flask import Blueprint, request, jsonify, g

from database.db import get_db
from middleware.auth_middleware import authenticate, require_role
from middleware.audit_middleware import audit_log_after

patients_bp = Blueprint("patients", __name__)


def _generate_patient_number(conn):
    year = __import__("datetime").date.today().year
    count = conn.execute("SELECT COUNT(*) FROM patients").fetchone()[0]
    return f"PAT-{year}-{str(count + 1).zfill(3)}"


@patients_bp.after_request
def after(response):
    return audit_log_after(response)


@patients_bp.route("/", methods=["GET"])
@authenticate
def list_patients():
    search = request.args.get("search", "")
    site_id = request.args.get("site_id")
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 20))
    offset = (page - 1) * limit

    where = "WHERE 1=1"
    params = []
    if search:
        s = f"%{search}%"
        where += " AND (p.first_name LIKE ? OR p.last_name LIKE ? OR p.patient_number LIKE ? OR p.phone LIKE ?)"
        params += [s, s, s, s]
    if site_id:
        where += " AND p.site_id = ?"
        params.append(site_id)

    conn = get_db()
    query = f"""
        SELECT p.*, s.name as site_name, w.name as ward_name
        FROM patients p
        LEFT JOIN sites s ON p.site_id = s.id
        LEFT JOIN wards w ON p.ward_id = w.id
        {where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?
    """
    patients = [dict(r) for r in conn.execute(query, params + [limit, offset]).fetchall()]
    total = conn.execute(f"SELECT COUNT(*) FROM patients p {where}", params).fetchone()[0]
    conn.close()
    return jsonify({"patients": patients, "total": total, "page": page, "limit": limit})


@patients_bp.route("/<pid>", methods=["GET"])
@authenticate
def get_patient(pid):
    conn = get_db()
    row = conn.execute(
        """SELECT p.*, s.name as site_name, w.name as ward_name
           FROM patients p LEFT JOIN sites s ON p.site_id = s.id
           LEFT JOIN wards w ON p.ward_id = w.id WHERE p.id = ?""",
        (pid,),
    ).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Patient not found"}), 404
    return jsonify(dict(row))


@patients_bp.route("/", methods=["POST"])
@authenticate
def create_patient():
    data = request.get_json() or {}
    first_name = data.get("first_name", "").strip()
    last_name = data.get("last_name", "").strip()
    if not first_name or not last_name:
        return jsonify({"error": "First and last name required"}), 400

    pid = str(uuid.uuid4())
    conn = get_db()
    patient_number = _generate_patient_number(conn)
    conn.execute(
        """INSERT INTO patients (id, patient_number, first_name, last_name, date_of_birth, gender,
           phone, email, address, blood_group, allergies, site_id, ward_id, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            pid, patient_number, first_name, last_name,
            data.get("date_of_birth"), data.get("gender"), data.get("phone"),
            data.get("email"), data.get("address"), data.get("blood_group"),
            data.get("allergies"), data.get("site_id"), data.get("ward_id"),
            g.user["id"],
        ),
    )
    conn.commit()
    conn.close()
    return jsonify({"id": pid, "patient_number": patient_number, "message": "Patient created successfully"}), 201


@patients_bp.route("/<pid>", methods=["PUT"])
@authenticate
def update_patient(pid):
    data = request.get_json() or {}
    conn = get_db()
    existing = conn.execute("SELECT * FROM patients WHERE id = ?", (pid,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Patient not found"}), 404
    existing = dict(existing)
    conn.execute(
        """UPDATE patients SET first_name=?, last_name=?, date_of_birth=?, gender=?, phone=?,
           email=?, address=?, blood_group=?, allergies=?, site_id=?, ward_id=?,
           updated_at=CURRENT_TIMESTAMP WHERE id=?""",
        (
            data.get("first_name") or existing["first_name"],
            data.get("last_name") or existing["last_name"],
            data.get("date_of_birth") if "date_of_birth" in data else existing["date_of_birth"],
            data.get("gender") if "gender" in data else existing["gender"],
            data.get("phone") if "phone" in data else existing["phone"],
            data.get("email") if "email" in data else existing["email"],
            data.get("address") if "address" in data else existing["address"],
            data.get("blood_group") if "blood_group" in data else existing["blood_group"],
            data.get("allergies") if "allergies" in data else existing["allergies"],
            data.get("site_id") if "site_id" in data else existing["site_id"],
            data.get("ward_id") if "ward_id" in data else existing["ward_id"],
            pid,
        ),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Patient updated successfully"})


@patients_bp.route("/<pid>", methods=["DELETE"])
@authenticate
@require_role("admin")
def delete_patient(pid):
    conn = get_db()
    conn.execute("DELETE FROM patients WHERE id = ?", (pid,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Patient deleted successfully"})
