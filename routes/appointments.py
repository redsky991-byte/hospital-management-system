import uuid
from datetime import date
from flask import Blueprint, request, jsonify, g

from database.db import get_db
from middleware.auth_middleware import authenticate
from middleware.audit_middleware import audit_log_after

appointments_bp = Blueprint("appointments", __name__)

APPT_QUERY = """
    SELECT a.*,
      p.first_name || ' ' || p.last_name as patient_name, p.patient_number,
      u.name as doctor_name, d.name as department_name, s.name as site_name
    FROM appointments a
    LEFT JOIN patients p ON a.patient_id = p.id
    LEFT JOIN users u ON a.doctor_id = u.id
    LEFT JOIN departments d ON a.department_id = d.id
    LEFT JOIN sites s ON a.site_id = s.id
"""


@appointments_bp.after_request
def after(response):
    return audit_log_after(response)


@appointments_bp.route("/today", methods=["GET"])
@authenticate
def today_appointments():
    today = date.today().isoformat()
    conn = get_db()
    rows = conn.execute(
        APPT_QUERY + " WHERE a.appointment_date = ? ORDER BY a.appointment_time ASC", (today,)
    ).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])


@appointments_bp.route("/", methods=["GET"])
@authenticate
def list_appointments():
    appt_date = request.args.get("date")
    doctor_id = request.args.get("doctor_id")
    status = request.args.get("status")
    site_id = request.args.get("site_id")
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 20))
    offset = (page - 1) * limit

    where = " WHERE 1=1"
    params = []
    if appt_date:
        where += " AND a.appointment_date = ?"
        params.append(appt_date)
    if doctor_id:
        where += " AND a.doctor_id = ?"
        params.append(doctor_id)
    if status:
        where += " AND a.status = ?"
        params.append(status)
    if site_id:
        where += " AND a.site_id = ?"
        params.append(site_id)

    conn = get_db()
    rows = conn.execute(
        APPT_QUERY + where + " ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT ? OFFSET ?",
        params + [limit, offset],
    ).fetchall()
    total = conn.execute(
        f"SELECT COUNT(*) FROM appointments a{where}", params
    ).fetchone()[0]
    conn.close()
    return jsonify({"appointments": [dict(r) for r in rows], "total": total})


@appointments_bp.route("/<aid>", methods=["GET"])
@authenticate
def get_appointment(aid):
    conn = get_db()
    row = conn.execute(APPT_QUERY + " WHERE a.id = ?", (aid,)).fetchone()
    conn.close()
    if not row:
        return jsonify({"error": "Appointment not found"}), 404
    return jsonify(dict(row))


@appointments_bp.route("/", methods=["POST"])
@authenticate
def create_appointment():
    data = request.get_json() or {}
    patient_id = data.get("patient_id")
    appointment_date = data.get("appointment_date")
    appointment_time = data.get("appointment_time")
    if not patient_id or not appointment_date or not appointment_time:
        return jsonify({"error": "Patient, date and time required"}), 400

    aid = str(uuid.uuid4())
    conn = get_db()
    conn.execute(
        """INSERT INTO appointments (id, patient_id, doctor_id, department_id, site_id,
           appointment_date, appointment_time, status, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        (
            aid, patient_id, data.get("doctor_id"), data.get("department_id"),
            data.get("site_id"), appointment_date, appointment_time,
            data.get("status", "scheduled"), data.get("notes"), g.user["id"],
        ),
    )
    conn.commit()
    conn.close()
    return jsonify({"id": aid, "message": "Appointment created successfully"}), 201


@appointments_bp.route("/<aid>", methods=["PUT"])
@authenticate
def update_appointment(aid):
    data = request.get_json() or {}
    conn = get_db()
    existing = conn.execute("SELECT * FROM appointments WHERE id = ?", (aid,)).fetchone()
    if not existing:
        conn.close()
        return jsonify({"error": "Appointment not found"}), 404
    existing = dict(existing)
    conn.execute(
        """UPDATE appointments SET patient_id=?, doctor_id=?, department_id=?, site_id=?,
           appointment_date=?, appointment_time=?, status=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?""",
        (
            data.get("patient_id") or existing["patient_id"],
            data.get("doctor_id") if "doctor_id" in data else existing["doctor_id"],
            data.get("department_id") if "department_id" in data else existing["department_id"],
            data.get("site_id") if "site_id" in data else existing["site_id"],
            data.get("appointment_date") or existing["appointment_date"],
            data.get("appointment_time") or existing["appointment_time"],
            data.get("status") or existing["status"],
            data.get("notes") if "notes" in data else existing["notes"],
            aid,
        ),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Appointment updated successfully"})


@appointments_bp.route("/<aid>", methods=["DELETE"])
@authenticate
def delete_appointment(aid):
    conn = get_db()
    conn.execute("DELETE FROM appointments WHERE id = ?", (aid,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Appointment deleted successfully"})
