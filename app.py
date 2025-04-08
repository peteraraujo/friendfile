from flask import Flask, jsonify, request, render_template, Blueprint
from waitress import serve
from werkzeug.exceptions import BadRequest
from functools import wraps
from datetime import datetime
import sqlite3
import os
import json
import re
import logging
from logging.handlers import RotatingFileHandler

# Configuration
DEBUG = True if os.getenv('DEBUG', 'True').lower() == 'true' else False
CLIENT_BASE_PATH = os.getenv('CLIENT_BASE_PATH', '/friendfile')
API_BASE_PATH = os.getenv('API_BASE_PATH', '/friendfile/api')

# Static folder
app = Flask(__name__, static_folder='static', static_url_path=f'{CLIENT_BASE_PATH}/static')

# DB
app.config['DB_PATH'] = os.getenv('DB_PATH', 'database.db' if DEBUG else '/data/database.db')

# Blueprints
client_bp = Blueprint('client', __name__, url_prefix=CLIENT_BASE_PATH)
api_bp = Blueprint('api', __name__, url_prefix=API_BASE_PATH)

# Logging setup
logging.basicConfig(level=logging.DEBUG if DEBUG else logging.INFO)
log_dir = os.path.dirname(app.config['DB_PATH'])
if log_dir:
    os.makedirs(log_dir, exist_ok=True)
log_path = os.path.join(log_dir, 'app.log' if DEBUG else '/data/app.log')
handler = RotatingFileHandler(log_path, maxBytes=10000, backupCount=3)
handler.setLevel(logging.DEBUG if DEBUG else logging.INFO)
app.logger.addHandler(handler)

# Database Initialization
def init_db():
    with sqlite3.connect(app.config['DB_PATH']) as conn:
        conn.row_factory = sqlite3.Row
        cur = conn.cursor()
        cur.execute('''
            CREATE TABLE IF NOT EXISTS contacts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                firstName TEXT NOT NULL,
                lastName TEXT NOT NULL,
                emails TEXT,
                phoneNumbers TEXT,
                addresses TEXT,
                birthdate TEXT,
                occupation TEXT,
                notes TEXT
            )
        ''')
        cur.execute('CREATE INDEX IF NOT EXISTS idx_name ON contacts (lastName, firstName)')
        conn.commit()

# Database Connection
def get_db():
    conn = sqlite3.connect(app.config['DB_PATH'])
    conn.row_factory = sqlite3.Row
    return conn

def db_call(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        conn = get_db()
        try:
            cur = conn.cursor()
            result = func(cur, *args, **kwargs)
            conn.commit()
            return result
        except sqlite3.Error as e:
            app.logger.error(f"Database error: {e}")
            return jsonify({"status": "error", "message": "Server error"}), 500
        except Exception as e:
            app.logger.error(f"Unexpected error: {e}")
            return jsonify({"status": "error", "message": "Internal server error"}), 500
        finally:
            conn.close()
    return wrapper

# Validation and Sanitization
def sanitize_string(value, max_length):
    cleaned = re.sub(r'<[^>]+>|[\(\)\'\';]', '', value)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned[:max_length] if cleaned else ''

def validate_birthdate(birthdate):
    if not birthdate:
        return ""
    try:
        datetime.strptime(birthdate, '%Y-%m-%d')
        return birthdate
    except ValueError:
        raise ValueError("Invalid birthdate")

def validate_email(email):
    return re.match(r'''^[a-zA-Z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$''', email) is not None

def validate_phone_number(phone):
    return isinstance(phone, dict) and 'type' in phone and 'number' in phone and isinstance(phone['type'], str) and isinstance(phone['number'], str)

def validate_address(address):
    return isinstance(address, dict) and 'type' in address and 'address' in address and isinstance(address['type'], str) and isinstance(address['address'], str)

def row_to_contact(row):
    try:
        return {
            "id": row["id"],
            "firstName": row["firstName"],
            "lastName": row["lastName"],
            "emails": json.loads(row["emails"]) if row["emails"] else [],
            "phoneNumbers": json.loads(row["phoneNumbers"]) if row["phoneNumbers"] else [],
            "addresses": json.loads(row["addresses"]) if row["addresses"] else [],
            "birthdate": row["birthdate"] or "",
            "occupation": row["occupation"] or "",
            "notes": row["notes"] or ""
        }
    except json.JSONDecodeError as e:
        app.logger.error(f"JSON decode error for row {row['id']}: {e}")
        return None

# Client Routes
@client_bp.route('/', defaults={'path': ''}, strict_slashes=False)
@client_bp.route('/<path:path>', strict_slashes=False)
def serve_client(path):
    # Serve index.html for all paths under CLIENT_BASE_PATH, passing both base paths
    return render_template('index.html', client_base_path=CLIENT_BASE_PATH, api_base_path=API_BASE_PATH)

# API Routes
@api_bp.route('/contacts', methods=['GET'])
@db_call
def get_contacts(cur):
    page = max(1, request.args.get('page', 1, type=int))
    page_count = max(1, min(100, request.args.get('pageCount', 10, type=int)))
    query = sanitize_string(request.args.get('query', '').lower(), 50)
    desc_order = request.args.get('descOrder', 'false').lower() == 'true'

    where_clause = "WHERE firstName LIKE ? OR lastName LIKE ?" if query else ""
    order_by = "ORDER BY lastName DESC, firstName DESC" if desc_order else "ORDER BY lastName, firstName"
    params = [f"%{query}%", f"%{query}%"] if query else []

    cur.execute(f"SELECT COUNT(*) as total FROM contacts {where_clause}", params)
    total = cur.fetchone()['total']

    offset = (page - 1) * page_count
    cur.execute(f"SELECT * FROM contacts {where_clause} {order_by} LIMIT ? OFFSET ?", params + [page_count, offset])
    contacts = [row_to_contact(row) for row in cur.fetchall() if row_to_contact(row)]

    return jsonify({
        "status": "success",
        "data": contacts,
        "meta": {
            "total": total,
            "page": page,
            "pageSize": page_count,
            "totalPages": (total + page_count - 1) // page_count
        }
    })

@api_bp.route('/contacts/<int:id>', methods=['GET'])
@db_call
def get_contact(cur, id):
    cur.execute("SELECT * FROM contacts WHERE id = ?", (id,))
    row = cur.fetchone()
    if not row:
        return jsonify({"status": "error", "message": "Contact not found"}), 404
    contact = row_to_contact(row)
    if not contact:
        return jsonify({"status": "error", "message": "Invalid contact data"}), 500
    return jsonify({"status": "success", "data": contact})

@api_bp.route('/contacts', methods=['POST'])
@db_call
def create_contact(cur):
    try:
        data = request.get_json()
        if not data or 'firstName' not in data or not data['firstName'].strip() or 'lastName' not in data or not data['lastName'].strip():
            raise ValueError("First and last name are required")

        first_name = sanitize_string(data['firstName'].strip(), 50)
        last_name = sanitize_string(data['lastName'].strip(), 50)
        emails = data.get('emails', [])
        phone_numbers = data.get('phoneNumbers', [])
        addresses = data.get('addresses', [])
        birthdate = validate_birthdate(sanitize_string(data.get('birthdate', ''), 10))
        occupation = sanitize_string(data.get('occupation', ''), 50)
        notes = sanitize_string(data.get('notes', ''), 500)

        if not isinstance(emails, list) or not all(isinstance(e, str) and validate_email(e) for e in emails):
            raise ValueError("Invalid emails")
        if not isinstance(phone_numbers, list) or not all(validate_phone_number(p) for p in phone_numbers):
            raise ValueError("Invalid phone numbers")
        if not isinstance(addresses, list) or not all(validate_address(a) for a in addresses):
            raise ValueError("Invalid addresses")

        cur.execute("""
            INSERT INTO contacts (firstName, lastName, emails, phoneNumbers, addresses, birthdate, occupation, notes) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (first_name, last_name, json.dumps(emails), json.dumps(phone_numbers), json.dumps(addresses), birthdate, occupation, notes))
        new_id = cur.lastrowid
        contact = {
            "id": new_id, "firstName": first_name, "lastName": last_name, "emails": emails,
            "phoneNumbers": phone_numbers, "addresses": addresses, "birthdate": birthdate,
            "occupation": occupation, "notes": notes
        }
        return jsonify({"status": "success", "data": contact}), 201
    except (ValueError, KeyError, BadRequest) as e:
        return jsonify({"status": "error", "message": str(e) or "Invalid request"}), 400
    except Exception as e:
        app.logger.error(f"Unexpected error: {e}")
        return jsonify({"status": "error", "message": "Internal server error"}), 500

@api_bp.route('/contacts/<int:id>', methods=['PUT'])
@db_call
def update_contact(cur, id):
    try:
        data = request.get_json()
        if not data or 'firstName' not in data or not data['firstName'].strip() or 'lastName' not in data or not data['lastName'].strip():
            raise ValueError("First and last name are required")

        first_name = sanitize_string(data['firstName'].strip(), 50)
        last_name = sanitize_string(data['lastName'].strip(), 50)
        emails = data.get('emails', [])
        phone_numbers = data.get('phoneNumbers', [])
        addresses = data.get('addresses', [])
        birthdate = validate_birthdate(sanitize_string(data.get('birthdate', ''), 10))
        occupation = sanitize_string(data.get('occupation', ''), 50)
        notes = sanitize_string(data.get('notes', ''), 500)

        if not isinstance(emails, list) or not all(isinstance(e, str) and validate_email(e) for e in emails):
            raise ValueError("Invalid emails")
        if not isinstance(phone_numbers, list) or not all(validate_phone_number(p) for p in phone_numbers):
            raise ValueError("Invalid phone numbers")
        if not isinstance(addresses, list) or not all(validate_address(a) for a in addresses):
            raise ValueError("Invalid addresses")

        cur.execute("SELECT id FROM contacts WHERE id = ?", (id,))
        if not cur.fetchone():
            return jsonify({"status": "error", "message": "Contact not found"}), 404

        cur.execute("""
            UPDATE contacts 
            SET firstName = ?, lastName = ?, emails = ?, phoneNumbers = ?, addresses = ?, birthdate = ?, occupation = ?, notes = ? 
            WHERE id = ?
        """, (first_name, last_name, json.dumps(emails), json.dumps(phone_numbers), json.dumps(addresses), birthdate, occupation, notes, id))
        contact = {
            "id": id, "firstName": first_name, "lastName": last_name, "emails": emails,
            "phoneNumbers": phone_numbers, "addresses": addresses, "birthdate": birthdate,
            "occupation": occupation, "notes": notes
        }
        return jsonify({"status": "success", "data": contact})
    except (ValueError, KeyError, BadRequest) as e:
        return jsonify({"status": "error", "message": str(e) or "Invalid request"}), 400
    except Exception as e:
        app.logger.error(f"Unexpected error: {e}")
        return jsonify({"status": "error", "message": "Internal server error"}), 500

@api_bp.route('/contacts/<int:id>', methods=['DELETE'])
@db_call
def delete_contact(cur, id):
    cur.execute("DELETE FROM contacts WHERE id = ?", (id,))
    if cur.rowcount == 0:
        return jsonify({"status": "error", "message": "Contact not found"}), 404
    return '', 204

# Register Blueprints
app.register_blueprint(client_bp)
app.register_blueprint(api_bp)

# Startup
if __name__ == '__main__':
    db_dir = os.path.dirname(app.config['DB_PATH'])
    if db_dir and not os.path.exists(db_dir):
        os.makedirs(db_dir, exist_ok=True)
    if not os.path.exists(app.config['DB_PATH']):
        init_db()
    if DEBUG:
        app.run(host='localhost', port=5000, debug=True)
    else:
        serve(app, host='0.0.0.0', port=5000, threads=4)
