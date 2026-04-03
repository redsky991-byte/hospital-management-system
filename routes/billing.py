import uuid
from flask import Blueprint, request, jsonify, g

from database.db import get_db
from middleware.auth_middleware import authenticate, require_role
from middleware.audit_middleware import audit_log_after

billing_bp = Blueprint("billing", __name__)


def _generate_invoice_number(conn):
    year = __import__("datetime").date.today().year
    count = conn.execute("SELECT COUNT(*) FROM invoices").fetchone()[0]
    return f"INV-{year}-{str(count + 1).zfill(3)}"


@billing_bp.after_request
def after(response):
    return audit_log_after(response)


@billing_bp.route("/", methods=["GET"])
@authenticate
def list_invoices():
    status = request.args.get("status")
    patient_id = request.args.get("patient_id")
    site_id = request.args.get("site_id")
    page = int(request.args.get("page", 1))
    limit = int(request.args.get("limit", 20))
    offset = (page - 1) * limit

    where = "WHERE 1=1"
    params = []
    if status:
        where += " AND i.status = ?"
        params.append(status)
    if patient_id:
        where += " AND i.patient_id = ?"
        params.append(patient_id)
    if site_id:
        where += " AND i.site_id = ?"
        params.append(site_id)

    conn = get_db()
    query = f"""
        SELECT i.*, p.first_name || ' ' || p.last_name as patient_name, p.patient_number, s.name as site_name
        FROM invoices i LEFT JOIN patients p ON i.patient_id = p.id LEFT JOIN sites s ON i.site_id = s.id
        {where} ORDER BY i.created_at DESC LIMIT ? OFFSET ?
    """
    invoices = [dict(r) for r in conn.execute(query, params + [limit, offset]).fetchall()]
    total = conn.execute(f"SELECT COUNT(*) FROM invoices i {where}", params).fetchone()[0]
    conn.close()
    return jsonify({"invoices": invoices, "total": total})


@billing_bp.route("/<iid>", methods=["GET"])
@authenticate
def get_invoice(iid):
    conn = get_db()
    row = conn.execute(
        """SELECT i.*, p.first_name || ' ' || p.last_name as patient_name, p.patient_number, s.name as site_name
           FROM invoices i LEFT JOIN patients p ON i.patient_id = p.id
           LEFT JOIN sites s ON i.site_id = s.id WHERE i.id = ?""",
        (iid,),
    ).fetchone()
    if not row:
        conn.close()
        return jsonify({"error": "Invoice not found"}), 404
    items = [dict(r) for r in conn.execute("SELECT * FROM invoice_items WHERE invoice_id = ?", (iid,)).fetchall()]
    conn.close()
    return jsonify({**dict(row), "items": items})


@billing_bp.route("/", methods=["POST"])
@authenticate
def create_invoice():
    data = request.get_json() or {}
    patient_id = data.get("patient_id")
    if not patient_id:
        return jsonify({"error": "Patient required"}), 400

    items = data.get("items") or []
    discount = float(data.get("discount") or 0)
    tax = float(data.get("tax") or 0)
    subtotal = sum(float(item["quantity"]) * float(item["unit_price"]) for item in items)
    total_amount = subtotal - discount + (subtotal * tax / 100)

    iid = str(uuid.uuid4())
    conn = get_db()
    invoice_number = _generate_invoice_number(conn)
    conn.execute(
        """INSERT INTO invoices (id, invoice_number, patient_id, site_id, total_amount, discount, tax,
           paid_amount, balance, status, due_date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'draft', ?, ?, ?)""",
        (iid, invoice_number, patient_id, data.get("site_id"), total_amount, discount, tax,
         total_amount, data.get("due_date"), data.get("notes"), g.user["id"]),
    )
    for item in items:
        conn.execute(
            "INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)",
            (str(uuid.uuid4()), iid, item["description"],
             float(item["quantity"]), float(item["unit_price"]),
             float(item["quantity"]) * float(item["unit_price"])),
        )
    conn.commit()
    conn.close()
    return jsonify({"id": iid, "invoice_number": invoice_number, "message": "Invoice created successfully"}), 201


@billing_bp.route("/<iid>", methods=["PUT"])
@authenticate
def update_invoice(iid):
    data = request.get_json() or {}
    conn = get_db()
    inv = conn.execute("SELECT * FROM invoices WHERE id = ?", (iid,)).fetchone()
    if not inv:
        conn.close()
        return jsonify({"error": "Invoice not found"}), 404

    inv = dict(inv)
    total_amount = inv["total_amount"]
    items = data.get("items")
    discount = data.get("discount")
    tax = data.get("tax")

    if items is not None:
        conn.execute("DELETE FROM invoice_items WHERE invoice_id = ?", (iid,))
        d = float(discount) if discount is not None else 0.0
        t = float(tax) if tax is not None else 0.0
        subtotal = sum(float(item["quantity"]) * float(item["unit_price"]) for item in items)
        total_amount = subtotal - d + (subtotal * t / 100)
        for item in items:
            conn.execute(
                "INSERT INTO invoice_items (id, invoice_id, description, quantity, unit_price, total) VALUES (?, ?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), iid, item["description"],
                 float(item["quantity"]), float(item["unit_price"]),
                 float(item["quantity"]) * float(item["unit_price"])),
            )

    balance = total_amount - inv["paid_amount"]
    conn.execute(
        """UPDATE invoices SET status=?, discount=?, tax=?, total_amount=?, balance=?,
           due_date=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?""",
        (
            data.get("status") or inv["status"],
            discount if discount is not None else inv["discount"],
            tax if tax is not None else inv["tax"],
            total_amount, balance,
            data.get("due_date") or inv["due_date"],
            data.get("notes") or inv["notes"],
            iid,
        ),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Invoice updated successfully"})


@billing_bp.route("/<iid>", methods=["DELETE"])
@authenticate
@require_role("admin")
def delete_invoice(iid):
    conn = get_db()
    conn.execute("DELETE FROM invoice_items WHERE invoice_id = ?", (iid,))
    conn.execute("DELETE FROM invoices WHERE id = ?", (iid,))
    conn.commit()
    conn.close()
    return jsonify({"message": "Invoice deleted successfully"})


@billing_bp.route("/<iid>/payment", methods=["POST"])
@authenticate
def record_payment(iid):
    data = request.get_json() or {}
    amount = data.get("amount")
    if not amount or float(amount) <= 0:
        return jsonify({"error": "Valid payment amount required"}), 400

    conn = get_db()
    inv = conn.execute("SELECT * FROM invoices WHERE id = ?", (iid,)).fetchone()
    if not inv:
        conn.close()
        return jsonify({"error": "Invoice not found"}), 404

    inv = dict(inv)
    new_paid = inv["paid_amount"] + float(amount)
    new_balance = max(0, inv["total_amount"] - new_paid)
    new_status = "paid" if new_balance <= 0 else inv["status"]
    conn.execute(
        "UPDATE invoices SET paid_amount=?, balance=?, status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?",
        (new_paid, new_balance, new_status, iid),
    )
    conn.commit()
    conn.close()
    return jsonify({"message": "Payment recorded successfully", "paid_amount": new_paid, "balance": new_balance})
