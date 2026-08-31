from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
from app.config import settings
from app.db.models import (
    PlaylistFetchRequest, BatchDeleteRequest, save_playlist, save_playlist_item,
    get_all_playlists, get_playlist_by_id, get_playlist_videos,
    delete_video_from_playlist_db, save_video, get_user_profile, save_user_profile
)
from app.db.database import get_db_connection, get_setting, set_setting, get_valid_youtube_access_token
from app.extractors.youtube import (
    fetch_playlist_data_ytdlp, delete_youtube_playlist_item,
    resolve_channel_id, fetch_all_playlists_api, fetch_all_playlist_items_api, fetch_all_subscriptions_api
)
from app.api.videos import process_single_video_pipeline
from app.llm.client import train_profile_from_playlist_videos

router = APIRouter(prefix="/api/playlists", tags=["Playlists"])

class AccountSyncRequest(BaseModel):
    api_key: Optional[str] = ""
    access_token: Optional[str] = ""
    channel_handle_or_url: Optional[str] = ""

@router.get("", response_model=List[dict])
def list_playlists():
    return get_all_playlists()

@router.post("/sync-account")
def sync_youtube_account(req: AccountSyncRequest):
    api_key = req.api_key.strip() if req.api_key else get_setting("youtube_api_key", settings.YOUTUBE_API_KEY)
    access_token = req.access_token.strip() if req.access_token else get_valid_youtube_access_token()
    target = req.channel_handle_or_url.strip() if req.channel_handle_or_url else get_setting("youtube_channel_handle", "")
    
    if access_token:
        settings.YOUTUBE_OAUTH_TOKEN = access_token
        set_setting("youtube_oauth_token", access_token)
    if api_key:
        settings.YOUTUBE_API_KEY = api_key
        set_setting("youtube_api_key", api_key)
    if target:
        set_setting("youtube_channel_handle", target)

    channel_id = resolve_channel_id(target, api_key) if target else "UC_mine"
    print(f"[Sync Started] Target channel_id: {channel_id}, Has Access Token: {bool(access_token)}, Has API Key: {bool(api_key)}", flush=True)
    
    # 1. Fetch all playlists (uses mine=true if access_token present to fetch private/unlisted!)
    playlists_list = fetch_all_playlists_api(channel_id, api_key, access_token)
    print(f"[Sync Playlists] Retrieved {len(playlists_list)} playlists. Fetching items for each...", flush=True)
    total_videos_synced = 0
    
    for idx, pl in enumerate(playlists_list):
        print(f"[Syncing Playlist {idx+1}/{len(playlists_list)}] {pl['title']} ({pl['id']})...", flush=True)
        save_playlist(pl)
        items = fetch_all_playlist_items_api(pl["id"], api_key, access_token)
        total_videos_synced += len(items)
        for item in items:
            save_video({
                "id": item["id"],
                "url": item["url"],
                "title": item["title"],
                "channel": item["channel"],
                "duration": item["duration"],
                "thumbnail": item["thumbnail"],
                "status": "pending"
            })
            save_playlist_item(pl["id"], item["id"], item.get("playlist_item_id", ""), item.get("position", 0))

    # 2. Fetch all subscriptions
    print(f"[Sync Subscriptions] Fetching channel subscriptions...", flush=True)
    subscriptions = fetch_all_subscriptions_api(channel_id, api_key, access_token)
    conn = get_db_connection()
    cursor = conn.cursor()
    for sub in subscriptions:
        cursor.execute("""
            INSERT INTO channels (channel_id, title, rss_url, last_checked)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(channel_id) DO UPDATE SET title=excluded.title, rss_url=excluded.rss_url
        """, (sub["channel_id"], sub["title"], sub["rss_url"]))
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "channel_id": channel_id,
        "playlists_synced": len(playlists_list),
        "videos_synced": total_videos_synced,
        "subscriptions_synced": len(subscriptions)
    }

@router.post("/fetch")
def fetch_and_save_playlist(req: PlaylistFetchRequest):
    try:
        pl_data = fetch_playlist_data_ytdlp(req.playlist_url_or_id)
        if not pl_data or pl_data.get("item_count") == 0:
            raise HTTPException(status_code=400, detail="Playlist is empty or could not be fetched.")
            
        save_playlist(pl_data)
        
        for item in pl_data["videos"]:
            save_video({
                "id": item["id"],
                "url": item["url"],
                "title": item["title"],
                "channel": item["channel"],
                "duration": item["duration"],
                "thumbnail": item["thumbnail"],
                "status": "pending"
            })
            save_playlist_item(pl_data["id"], item["id"], item.get("playlist_item_id", ""), item.get("position", 0))
            
        return {"status": "success", "playlist": get_playlist_by_id(pl_data["id"])}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch playlist: {str(e)}")

@router.get("/{playlist_id}", response_model=dict)
def get_playlist_details(playlist_id: str):
    pl = get_playlist_by_id(playlist_id)
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
    videos = get_playlist_videos(playlist_id)
    return {
        "playlist": pl,
        "videos": videos
    }

@router.post("/{playlist_id}/process")
async def process_playlist_videos(playlist_id: str):
    pl = get_playlist_by_id(playlist_id)
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
        
    videos = get_playlist_videos(playlist_id)
    processed = []
    
    for v in videos[:10]:
        try:
            res = await process_single_video_pipeline(v["id"])
            processed.append(res)
        except Exception as e:
            print(f"Error processing video {v['id']} in playlist {playlist_id}: {e}")
            
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE playlists
        SET processed_count = (
            SELECT COUNT(*) FROM videos v
            JOIN playlist_items pi ON v.id = pi.video_id
            WHERE pi.playlist_id = ? AND v.category != 'Uncategorized'
        )
        WHERE id = ?
    """, (playlist_id, playlist_id))
    conn.commit()
    conn.close()

    return {"status": "success", "processed_count": len(processed), "videos": get_playlist_videos(playlist_id)}

@router.post("/{playlist_id}/train-profile")
async def train_ai_from_playlist(playlist_id: str):
    pl = get_playlist_by_id(playlist_id)
    if not pl:
        raise HTTPException(status_code=404, detail="Playlist not found")
        
    videos = get_playlist_videos(playlist_id)
    if not videos:
        raise HTTPException(status_code=400, detail="Playlist contains no videos to train on.")
        
    current_profile = get_user_profile()
    updated_profile = await train_profile_from_playlist_videos(videos, current_profile)
    save_user_profile(updated_profile)
    
    return {
        "status": "success",
        "message": f"AI successfully trained and updated your profile using {len(videos)} video(s) from '{pl['title']}'!",
        "profile": updated_profile
    }

@router.delete("/{playlist_id}/items")
def batch_delete_playlist_items(playlist_id: str, req: BatchDeleteRequest):
    token = req.access_token or get_valid_youtube_access_token()
    deleted_ids = []
    failed_api = []
    
    for vid in req.video_ids:
        if token:
            videos = get_playlist_videos(playlist_id)
            match = next((v for v in videos if v["id"] == vid), None)
            if match and match.get("playlist_item_id"):
                api_success = delete_youtube_playlist_item(match["playlist_item_id"], token)
                if not api_success:
                    failed_api.append(vid)
                    
        delete_video_from_playlist_db(playlist_id, vid)
        deleted_ids.append(vid)
        
    return {
        "status": "success",
        "deleted_count": len(deleted_ids),
        "deleted_video_ids": deleted_ids,
        "failed_api_video_ids": failed_api
    }
