from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import json
from app.db.database import get_db_connection

class VideoAnalysis(BaseModel):
    category: str
    one_line_summary: str
    priority: str
    what_it_gains_me: str
    why_should_i_skip_it: str
    main_takeaways: List[str]

class VideoIngestRequest(BaseModel):
    url_or_id: str

class PlaylistFetchRequest(BaseModel):
    playlist_url_or_id: str

class BatchDeleteRequest(BaseModel):
    playlist_id: str
    video_ids: List[str]
    access_token: Optional[str] = None

class FeedbackRequest(BaseModel):
    video_id: str
    action: str
    reason: Optional[str] = None

class UserProfileUpdate(BaseModel):
    known_topics: Optional[List[str]] = None
    interests: Optional[List[str]] = None
    avoid_topics: Optional[List[str]] = None
    guidance_notes: Optional[str] = None

class ApiKeyRequest(BaseModel):
    api_key: str

# DB CRUD functions

def save_playlist(pl_data: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO playlists (id, title, description, thumbnail, item_count, processed_count, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            description=excluded.description,
            thumbnail=excluded.thumbnail,
            item_count=excluded.item_count,
            updated_at=CURRENT_TIMESTAMP
    """, (
        pl_data["id"],
        pl_data.get("title", "Untitled Playlist"),
        pl_data.get("description", ""),
        pl_data.get("thumbnail", ""),
        pl_data.get("item_count", 0),
        pl_data.get("processed_count", 0)
    ))
    conn.commit()
    conn.close()

def save_playlist_item(playlist_id: str, video_id: str, playlist_item_id: str = "", position: int = 0):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO playlist_items (playlist_id, video_id, playlist_item_id, position)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(playlist_id, video_id) DO UPDATE SET
            playlist_item_id=excluded.playlist_item_id,
            position=excluded.position
    """, (playlist_id, video_id, playlist_item_id, position))
    conn.commit()
    conn.close()

def get_all_playlists() -> List[dict]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM playlists ORDER BY updated_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def get_playlist_by_id(playlist_id: str) -> Optional[dict]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM playlists WHERE id = ?", (playlist_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_playlist_videos(playlist_id: str) -> List[dict]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT v.*, pi.playlist_item_id, pi.position
        FROM videos v
        JOIN playlist_items pi ON v.id = pi.video_id
        WHERE pi.playlist_id = ?
        ORDER BY pi.position ASC, v.created_at DESC
    """, (playlist_id,))
    rows = cursor.fetchall()
    conn.close()
    
    res = []
    for r in rows:
        item = dict(r)
        try:
            item["takeaways"] = json.loads(item["takeaways"]) if item["takeaways"] else []
        except Exception:
            item["takeaways"] = []
        res.append(item)
    return res

def delete_video_from_playlist_db(playlist_id: str, video_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM playlist_items WHERE playlist_id = ? AND video_id = ?", (playlist_id, video_id))
    # Update playlist item count
    cursor.execute("UPDATE playlists SET item_count = MAX(0, item_count - 1) WHERE id = ?", (playlist_id,))
    conn.commit()
    conn.close()

def save_video(video_data: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    takeaways_str = json.dumps(video_data.get("takeaways", [])) if isinstance(video_data.get("takeaways"), list) else video_data.get("takeaways", "[]")
    
    cursor.execute("""
        INSERT INTO videos (id, url, title, channel, duration, thumbnail, transcript, category, summary, priority, what_it_gains, why_skip, takeaways, runtime_str, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            channel=excluded.channel,
            duration=excluded.duration,
            thumbnail=excluded.thumbnail,
            transcript=excluded.transcript,
            category=excluded.category,
            summary=excluded.summary,
            priority=excluded.priority,
            what_it_gains=excluded.what_it_gains,
            why_skip=excluded.why_skip,
            takeaways=excluded.takeaways,
            runtime_str=excluded.runtime_str,
            status=excluded.status
    """, (
        video_data["id"],
        video_data["url"],
        video_data.get("title", ""),
        video_data.get("channel", ""),
        video_data.get("duration", 0),
        video_data.get("thumbnail", ""),
        video_data.get("transcript", ""),
        video_data.get("category", "Uncategorized"),
        video_data.get("summary", ""),
        video_data.get("priority", "mid"),
        video_data.get("what_it_gains", ""),
        video_data.get("why_skip", "none"),
        takeaways_str,
        video_data.get("runtime_str", ""),
        video_data.get("status", "pending")
    ))
    conn.commit()
    conn.close()

def get_all_videos() -> List[dict]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM videos ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    
    res = []
    for r in rows:
        item = dict(r)
        try:
            item["takeaways"] = json.loads(item["takeaways"]) if item["takeaways"] else []
        except Exception:
            item["takeaways"] = []
        res.append(item)
    return res

def get_video_by_id(video_id: str) -> Optional[dict]:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM videos WHERE id = ?", (video_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    item = dict(row)
    try:
        item["takeaways"] = json.loads(item["takeaways"]) if item["takeaways"] else []
    except Exception:
        item["takeaways"] = []
    return item

def update_video_status(video_id: str, status: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE videos SET status = ? WHERE id = ?", (status, video_id))
    conn.commit()
    conn.close()

def get_user_profile() -> dict:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM user_profile")
    rows = cursor.fetchall()
    conn.close()
    
    profile = {}
    for r in rows:
        k, v = r["key"], r["value"]
        try:
            profile[k] = json.loads(v)
        except Exception:
            profile[k] = v
    return profile

def save_user_profile(profile: dict):
    conn = get_db_connection()
    cursor = conn.cursor()
    for k, v in profile.items():
        val_str = json.dumps(v) if isinstance(v, (list, dict)) else str(v)
        cursor.execute("""
            INSERT INTO user_profile (key, value) VALUES (?, ?)
            ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP
        """, (k, val_str))
    conn.commit()
    conn.close()

def record_feedback(video_id: str, action: str, reason: Optional[str]):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO feedback_history (video_id, action, reason) VALUES (?, ?, ?)", (video_id, action, reason or ""))
    conn.commit()
    conn.close()
