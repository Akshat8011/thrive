import os
import sqlite3
import json
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

basedir = os.path.abspath(os.path.dirname(__file__))
app = Flask(__name__, static_folder=basedir)
CORS(app)

# Register Vita (Voice Assistant) Blueprint
from vita_routes import vita_bp
app.register_blueprint(vita_bp)

# Register RSS Proxy (Knowledge Hub) Blueprint
from rss_proxy import rss_bp
app.register_blueprint(rss_bp)

# Fetch Supabase REST API credentials
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

def get_supabase_client():
    if SUPABASE_URL and SUPABASE_KEY:
        from supabase import create_client
        return create_client(SUPABASE_URL, SUPABASE_KEY)
    return None

def init_db():
    # Only initialize SQLite if we are NOT using Supabase (local fallback)
    if not SUPABASE_URL:
        DB_PATH = os.path.join('/tmp', 'thrive.db')
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS sync_data (
                user_id TEXT PRIMARY KEY,
                data TEXT NOT NULL
            )
        ''')
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS push_subs (
                user_id TEXT PRIMARY KEY,
                subscription TEXT NOT NULL
            )
        ''')
        conn.commit()
        conn.close()

init_db()

@app.route('/')
def serve_index():
    response = send_from_directory(basedir, 'index.html')
    response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
    response.headers['Pragma'] = 'no-cache'
    return response

@app.route('/<path:path>')
def serve_static(path):
    target = os.path.join(basedir, path)
    if os.path.exists(target):
        response = send_from_directory(basedir, path)
        if path.endswith(('.js', '.css', '.html')):
            response.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate'
            response.headers['Pragma'] = 'no-cache'
        return response
    return "Not found", 404

@app.route('/api/sync', methods=['POST'])
def sync_data():
    req = request.json
    user_id = req.get('userId', 'Akshat')
    client_data = req.get('data', {})

    supabase = get_supabase_client()
    server_data = {}

    if supabase:
        # Fetch from Supabase via REST
        try:
            response = supabase.table('sync_data').select('data').eq('user_id', user_id).execute()
            if response.data and len(response.data) > 0:
                server_data = json.loads(response.data[0]['data'])
        except Exception as e:
            print(f"Supabase fetch error: {e}")
    else:
        # Local SQLite Fallback
        DB_PATH = os.path.join('/tmp', 'thrive.db')
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT data FROM sync_data WHERE user_id = ?', (user_id,))
        row = cursor.fetchone()
        server_data = json.loads(row[0]) if row else {}
        conn.close()

    # Smart Merge Server and Client
    merged_data = {"goals": [], "milestones": [], "journal": [], "ideas": [], "finances": []}
    for key in merged_data.keys():
        server_arr = server_data.get(key, [])
        client_arr = client_data.get(key, [])
        merged_dict = {item.get('id', item.get('date', item.get('description'))): item for item in server_arr}
        for item in client_arr:
            identifier = item.get('id', item.get('date', item.get('description')))
            merged_dict[identifier] = item 
        merged_data[key] = list(merged_dict.values())

    merged_json = json.dumps(merged_data)

    if supabase:
        # Upsert to Supabase via REST
        try:
            supabase.table('sync_data').upsert({'user_id': user_id, 'data': merged_json}).execute()
        except Exception as e:
            print(f"Supabase upsert error: {e}")
            return jsonify({"status": "error", "message": str(e)}), 500
    else:
        # Local SQLite Fallback
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO sync_data (user_id, data) 
            VALUES (?, ?) 
            ON CONFLICT(user_id) DO UPDATE SET data=excluded.data
        ''', (user_id, merged_json))
        conn.commit()
        conn.close()

    return jsonify({"status": "success", "message": "synced", "data": merged_data})

@app.route('/api/sync/<user_id>', methods=['GET'])
def get_sync_data(user_id):
    supabase = get_supabase_client()
    
    if supabase:
        try:
            response = supabase.table('sync_data').select('data').eq('user_id', user_id).execute()
            if response.data and len(response.data) > 0:
                return jsonify({"status": "success", "data": json.loads(response.data[0]['data'])})
        except Exception as e:
            print(f"Supabase fetch error: {e}")
    else:
        DB_PATH = os.path.join('/tmp', 'thrive.db')
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('SELECT data FROM sync_data WHERE user_id = ?', (user_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return jsonify({"status": "success", "data": json.loads(row[0])})

    return jsonify({"status": "empty", "data": {}})

@app.route('/api/vapid_public_key', methods=['GET'])
def get_vapid_key():
    try:
        from py_vapid import Vapid
        vapid_file = os.path.join('/tmp', 'private_key.pem')
        if not os.path.exists(vapid_file):
            v = Vapid()
            v.generate_keys()
            v.save_keys(vapid_file)
        v = Vapid.from_file(vapid_file)
        return jsonify({"public_key": v.public_key.to_b64()})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/subscribe', methods=['POST'])
def subscribe():
    req = request.json
    user_id = req.get('userId', 'Akshat')
    sub_data = json.dumps(req.get('subscription'))

    supabase = get_supabase_client()
    
    if supabase:
        supabase.table('push_subs').upsert({'user_id': user_id, 'subscription': sub_data}).execute()
    else:
        DB_PATH = os.path.join('/tmp', 'thrive.db')
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO push_subs (user_id, subscription) 
            VALUES (?, ?) 
            ON CONFLICT(user_id) DO UPDATE SET subscription=excluded.subscription
        ''', (user_id, sub_data))
        conn.commit()
        conn.close()
        
    return jsonify({"status": "subscribed"})

@app.route('/api/trigger_push', methods=['POST'])
def trigger_push():
    try:
        from pywebpush import webpush, WebPushException
        supabase = get_supabase_client()
        subs = []
        
        if supabase:
            response = supabase.table('push_subs').select('subscription').execute()
            if response.data:
                subs = [(row['subscription'],) for row in response.data]
        else:
            DB_PATH = os.path.join('/tmp', 'thrive.db')
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute('SELECT subscription FROM push_subs')
            subs = cursor.fetchall()
            conn.close()
            
        vapid_file = os.path.join('/tmp', 'private_key.pem')
        if not subs or not os.path.exists(vapid_file):
            return jsonify({"status": "no subs or keys"})

        payload = json.dumps({"title": "Thrive ☀️", "body": "Did you record your expenses and complete your goals today?"})
        
        for (sub_str,) in subs:
            sub = json.loads(sub_str)
            try:
                webpush(
                    subscription_info=sub,
                    data=payload,
                    vapid_private_key=vapid_file,
                    vapid_claims={"sub": "mailto:admin@thrive-os.com"}
                )
            except WebPushException as ex:
                print("Push failed", repr(ex))
        
        return jsonify({"status": "sent"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 3000))
    app.run(host='0.0.0.0', port=port, debug=True)
