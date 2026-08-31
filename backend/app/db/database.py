import sqlite3
import json
import time
import requests
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from app.config import settings

def get_db_connection():
    db_path = settings.DB_PATH
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Table: playlists
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        thumbnail TEXT,
        item_count INTEGER DEFAULT 0,
        processed_count INTEGER DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # Table: videos
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS videos (
        id TEXT PRIMARY KEY,
        url TEXT UNIQUE NOT NULL,
        title TEXT,
        channel TEXT,
        duration INTEGER,
        thumbnail TEXT,
        transcript TEXT,
        category TEXT,
        summary TEXT,
        priority TEXT,
        what_it_gains TEXT,
        why_skip TEXT,
        takeaways TEXT,
        runtime_str TEXT,
        status TEXT DEFAULT 'pending',
        available_transcripts TEXT DEFAULT '[]',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    try:
        cursor.execute("ALTER TABLE videos ADD COLUMN available_transcripts TEXT DEFAULT '[]'")
    except Exception:
        pass

    # Table: playlist_items (maps playlist -> video + YouTube playlist_item_id)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS playlist_items (
        playlist_id TEXT,
        video_id TEXT,
        playlist_item_id TEXT, -- Required for YouTube API deletion
        position INTEGER DEFAULT 0,
        PRIMARY KEY (playlist_id, video_id),
        FOREIGN KEY(playlist_id) REFERENCES playlists(id),
        FOREIGN KEY(video_id) REFERENCES videos(id)
    );
    """)
    
    # Table: user_profile (AI memory of user)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_profile (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # Table: feedback_history
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS feedback_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id TEXT,
        action TEXT,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(video_id) REFERENCES videos(id)
    );
    """)
    
    # Table: channels (for subscription tracking)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS channels (
        channel_id TEXT PRIMARY KEY,
        title TEXT,
        rss_url TEXT,
        total_scanned INTEGER DEFAULT 0,
        total_skipped INTEGER DEFAULT 0,
        last_checked TEXT,
        status TEXT DEFAULT 'active'
    );
    """)

    # Table: app_settings (key-value store for app configuration and credentials)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)
    
    # Seed default user profile if empty
    cursor.execute("SELECT COUNT(*) FROM user_profile")
    if cursor.fetchone()[0] == 0:
        default_profile = {
            "known_topics": ["Basic Python", "General Web Browsing", "Standard Smartphone Specs"],
            "interests": ["Career Development", "Software Engineering", "AI Systems", "Productivity"],
            "avoid_topics": ["Clickbait News", "Celebrity Drama", "Pure Reaction Videos"],
            "guidance_notes": "Prefer concise summaries. Focus on technical depth and actionable advice."
        }
        for k, v in default_profile.items():
            cursor.execute(
                "INSERT INTO user_profile (key, value) VALUES (?, ?)",
                (k, json.dumps(v) if isinstance(v, list) else v)
            )
            
    conn.commit()
    conn.close()

    load_settings_into_config()

def get_setting(key: str, default: str = "") -> str:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM app_settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    return row["value"] if row else default

def set_setting(key: str, value: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO app_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
    """, (key, value))
    conn.commit()
    conn.close()

def get_all_settings() -> Dict[str, str]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM app_settings")
    rows = cursor.fetchall()
    conn.close()
    return {r["key"]: r["value"] for r in rows}

def refresh_youtube_oauth_token() -> Tuple[bool, str, Optional[str]]:
    """
    Exchanges refresh_token, client_id, client_secret with Google OAuth endpoint (https://oauth2.googleapis.com/token).
    Returns (success, message, new_access_token)
    """
    client_id = get_setting("youtube_client_id")
    client_secret = get_setting("youtube_client_secret")
    refresh_token = get_setting("youtube_refresh_token")

    if not refresh_token:
        return False, "No refresh token configured. Please provide a refresh token.", None

    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "refresh_token": refresh_token,
        "grant_type": "refresh_token"
    }

    try:
        res = requests.post(token_url, data=payload, timeout=15)
        data = res.json()
        if res.status_code == 200 and "access_token" in data:
            new_token = data["access_token"]
            expires_in = data.get("expires_in", 3600)
            expires_at = time.time() + expires_in - 60

            set_setting("youtube_oauth_token", new_token)
            set_setting("youtube_token_expires_at", str(expires_at))
            settings.YOUTUBE_OAUTH_TOKEN = new_token
            print(f"[OAuth Token Refresh] Successfully renewed YouTube access token! Expires in {expires_in}s.", flush=True)
            return True, f"Token renewed successfully! (Valid for {round(expires_in / 60)} min)", new_token
        else:
            error_desc = data.get("error_description") or data.get("error") or res.text
            print(f"[OAuth Token Refresh Error] {res.status_code}: {error_desc}", flush=True)
            return False, f"Google OAuth error: {error_desc}", None
    except Exception as e:
        print(f"[OAuth Token Refresh Exception] {e}", flush=True)
        return False, f"Failed to reach Google token endpoint: {str(e)}", None

def get_valid_youtube_access_token() -> str:
    """
    Returns an active, valid YouTube access token.
    If current token is expired or missing and a refresh token is present, automatically renews it.
    """
    access_token = get_setting("youtube_oauth_token", settings.YOUTUBE_OAUTH_TOKEN)
    expires_at_str = get_setting("youtube_token_expires_at", "0")
    refresh_token = get_setting("youtube_refresh_token", "")

    try:
        expires_at = float(expires_at_str)
    except Exception:
        expires_at = 0

    now = time.time()
    if refresh_token and (not access_token or now >= (expires_at - 120)):
        print("[OAuth Auto-Refresh] Token expired or nearing expiration. Triggering auto-renewal...", flush=True)
        success, msg, new_tok = refresh_youtube_oauth_token()
        if success and new_tok:
            return new_tok

    return access_token

def load_settings_into_config():
    saved_key = get_setting("youtube_api_key")
    if saved_key:
        settings.YOUTUBE_API_KEY = saved_key

    saved_token = get_setting("youtube_oauth_token")
    if saved_token:
        settings.YOUTUBE_OAUTH_TOKEN = saved_token

    refresh_token = get_setting("youtube_refresh_token")
    if refresh_token:
        get_valid_youtube_access_token()


