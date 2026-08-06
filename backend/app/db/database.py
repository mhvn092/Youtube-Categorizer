import sqlite3
import json
from pathlib import Path
from typing import List, Dict, Any, Optional
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

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
