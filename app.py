import os
from pathlib import Path
from dotenv import load_dotenv
from flask import Flask, send_from_directory
from flask_cors import CORS

load_dotenv()

app = Flask(__name__, static_folder="public", static_url_path="")
CORS(app)
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MB

# Initialize database
from database.db import init_db
init_db()

# Register blueprints
from routes.auth import auth_bp
from routes.patients import patients_bp
from routes.appointments import appointments_bp
from routes.billing import billing_bp
from routes.users import users_bp
from routes.audit import audit_bp
from routes.settings import settings_bp

app.register_blueprint(auth_bp, url_prefix="/api/auth")
app.register_blueprint(patients_bp, url_prefix="/api/patients")
app.register_blueprint(appointments_bp, url_prefix="/api/appointments")
app.register_blueprint(billing_bp, url_prefix="/api/billing")
app.register_blueprint(users_bp, url_prefix="/api/users")
app.register_blueprint(audit_bp, url_prefix="/api/audit")
app.register_blueprint(settings_bp, url_prefix="/api/settings")


@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_frontend(path):
    public = Path(app.static_folder)
    target = public / path
    if path and target.exists():
        return send_from_directory(str(public), path)
    return send_from_directory(str(public), "index.html")


@app.errorhandler(Exception)
def handle_error(err):
    app.logger.error(str(err))
    return {"error": "Internal server error", "message": str(err)}, 500


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    print(f"MedCare HMS running on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
