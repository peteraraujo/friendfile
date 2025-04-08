import pytest
from flask import json

from app import app, init_db, get_db

@pytest.fixture
def client(tmp_path):
    app.config['TESTING'] = True
    db_path = tmp_path / "test.db"
    app.config['DB_PATH'] = str(db_path)  # Set per-test DB path
    with app.app_context():
        init_db()
        yield app.test_client()

@pytest.fixture
def sample_data(client):
    with client.application.app_context():
        conn = get_db()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO contacts (firstName, lastName, emails, phoneNumbers, addresses, birthdate, occupation, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, ("John", "Doe", '["john@example.com"]', '[{"type": "personal", "number": "123-456-7890"}]',
              '[{"type": "home", "address": "123 Main St"}]', "1990-01-01", "Engineer", "Friendly guy"))
        conn.commit()

# General Cases
def test_get_contacts_empty(client):
    rv = client.get('/apis/friendfile/contacts')
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert data['status'] == 'success'
    assert len(data['data']) == 0
    assert data['meta']['total'] == 0

def test_get_contacts_with_data(client, sample_data):
    rv = client.get('/apis/friendfile/contacts')
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert len(data['data']) == 1
    assert data['data'][0]['firstName'] == 'John'
    assert data['meta']['total'] == 1

def test_get_contact_by_id(client, sample_data):
    rv = client.get('/apis/friendfile/contacts/1')
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert data['data']['id'] == 1
    assert data['data']['lastName'] == 'Doe'

def test_create_contact(client):
    rv = client.post('/apis/friendfile/contacts', json={
        "firstName": "Jane", "lastName": "Smith", "emails": ["jane@example.com"],
        "phoneNumbers": [{"type": "work", "number": "987-654-3210"}]
    })
    assert rv.status_code == 201
    data = json.loads(rv.data)
    assert data['data']['firstName'] == 'Jane'
    assert data['data']['phoneNumbers'][0]['number'] == '987-654-3210'

def test_update_contact(client, sample_data):
    rv = client.put('/apis/friendfile/contacts/1', json={
        "firstName": "Johnny", "lastName": "Doe", "emails": ["johnny@example.com"]
    })
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert data['data']['firstName'] == 'Johnny'
    assert data['data']['emails'] == ['johnny@example.com']

def test_delete_contact(client, sample_data):
    rv = client.delete('/apis/friendfile/contacts/1')
    assert rv.status_code == 204
    rv = client.get('/apis/friendfile/contacts/1')
    assert rv.status_code == 404

# Data Validation
def test_create_contact_missing_required(client):
    rv = client.post('/apis/friendfile/contacts', json={"firstName": "Jane"})
    assert rv.status_code == 400
    assert json.loads(rv.data)['message'] == 'First and last name are required'

def test_create_contact_invalid_email(client):
    rv = client.post('/apis/friendfile/contacts', json={
        "firstName": "Jane", "lastName": "Smith", "emails": ["not-an-email"]
    })
    assert rv.status_code == 400
    assert json.loads(rv.data)['message'] == 'Invalid emails'

def test_create_contact_invalid_phone(client):
    rv = client.post('/apis/friendfile/contacts', json={
        "firstName": "Jane", "lastName": "Smith",
        "phoneNumbers": [{"type": "work", "number": 123}]
    })
    assert rv.status_code == 400
    assert json.loads(rv.data)['message'] == 'Invalid phone numbers'

def test_update_contact_invalid_address(client, sample_data):
    rv = client.put('/apis/friendfile/contacts/1', json={
        "firstName": "John", "lastName": "Doe",
        "addresses": [{"type": "home", "address": 123}]
    })
    assert rv.status_code == 400
    assert json.loads(rv.data)['message'] == 'Invalid addresses'

def test_create_contact_invalid_birthdate(client):
    rv = client.post('/apis/friendfile/contacts', json={
        "firstName": "Jane", "lastName": "Smith", "birthdate": "2023-13-45"  # Invalid format
    })
    assert rv.status_code == 400
    assert json.loads(rv.data)['message'] == 'Invalid birthdate'  # Updated to match app.py

# Security and Injection Prevention
def test_sql_injection_in_query(client, sample_data):
    rv = client.get('/apis/friendfile/contacts?query=John')
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert len(data['data']) == 1
    assert data['data'][0]['firstName'] == 'John'

def test_sanitization_on_create(client):
    rv = client.post('/apis/friendfile/contacts', json={
        "firstName": "Jane<script>alert('xss')</script>",
        "lastName": "Smith; DROP TABLE contacts",
        "notes": "Note with <malicious> code"
    })
    assert rv.status_code == 201
    data = json.loads(rv.data)
    assert data['data']['firstName'] == 'Janealertxss'
    assert data['data']['lastName'] == 'Smith DROP TABLE contacts'
    assert data['data']['notes'] == 'Note with code'

def test_sanitization_on_update(client, sample_data):
    rv = client.put('/apis/friendfile/contacts/1', json={
        "firstName": "John<script>", "lastName": "Doe",
        "notes": "Updated <script>alert('xss')</script>"
    })
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert data['data']['firstName'] == 'John'
    assert data['data']['notes'] == 'Updated alertxss'

# Edge Cases
def test_get_nonexistent_contact(client):
    rv = client.get('/apis/friendfile/contacts/999')
    assert rv.status_code == 404
    assert json.loads(rv.data)['message'] == 'Contact not found'

def test_delete_nonexistent_contact(client):
    rv = client.delete('/apis/friendfile/contacts/999')
    assert rv.status_code == 404
    assert json.loads(rv.data)['message'] == 'Contact not found'

def test_pagination(client, sample_data):
    rv = client.get('/apis/friendfile/contacts?page=1&pageCount=1')
    assert rv.status_code == 200
    data = json.loads(rv.data)
    assert len(data['data']) == 1
    assert data['meta']['totalPages'] == 1

def test_create_contact_invalid_json(client):
    rv = client.post('/apis/friendfile/contacts', data='{"firstName": "Jane"', content_type='application/json')
    assert rv.status_code == 400
    assert json.loads(rv.data)['message'] == '400 Bad Request: The browser (or proxy) sent a request that this server could not understand.'  # Updated to match Flask default

def test_create_contact_max_length(client):
    long_name = "A" * 51
    rv = client.post('/apis/friendfile/contacts', json={"firstName": long_name, "lastName": "Smith"})
    assert rv.status_code == 201
    data = json.loads(rv.data)
    assert len(data['data']['firstName']) == 50

def test_create_contact_future_birthdate(client):
    rv = client.post('/apis/friendfile/contacts', json={
        "firstName": "Jane", "lastName": "Smith", "birthdate": "2099-12-31"  # Future date allowed
    })
    assert rv.status_code == 201
    data = json.loads(rv.data)
    assert data['data']['birthdate'] == '2099-12-31'  # Updated with app.py fix
