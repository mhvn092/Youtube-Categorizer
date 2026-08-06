from fastapi import APIRouter, HTTPException
from typing import List, Dict, Any
from app.extractors.rss import fetch_channel_rss_feed
from app.db.database import get_db_connection
from app.db.models import get_all_videos
from app.api.videos import process_single_video_pipeline

router = APIRouter(prefix="/api/subscriptions", tags=["Subscriptions"])

@router.post("/sync-all-feeds")
async def sync_all_subscriptions_feeds():
    """Scrapes all subscribed channels for new uploads and processes them with Gemma 12B"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT channel_id, title, rss_url FROM channels")
    channels = cursor.fetchall()
    conn.close()
    
    total_new_videos = []
    
    for ch in channels:
        try:
            feed_videos = fetch_channel_rss_feed(ch["channel_id"])
            # Process top 2 latest uploads per channel
            for vid in feed_videos[:2]:
                try:
                    res = await process_single_video_pipeline(vid["url"])
                    total_new_videos.append(res)
                except Exception as e:
                    print(f"Feed item error: {e}")
        except Exception as e:
            print(f"Error syncing feed for channel {ch['title']}: {e}")
            
    return {
        "status": "success",
        "new_videos_processed": len(total_new_videos),
        "videos": total_new_videos
    }

@router.get("/feed", response_model=List[dict])
def get_subscription_feed_recommendations():
    """Returns all processed subscription feed videos with Gemma 12B ratings"""
    videos = get_all_videos()
    return videos

@router.post("/scan")
async def scan_channel_feed(channel_url_or_id: dict):
    target = channel_url_or_id.get("channel")
    if not target:
        raise HTTPException(status_code=400, detail="Missing channel parameter")
        
    try:
        videos = fetch_channel_rss_feed(target)
        processed = []
        for vid in videos[:3]:
            try:
                res = await process_single_video_pipeline(vid["url"])
                processed.append(res)
            except Exception as e:
                print(f"Skipping video scan error for {vid['id']}: {e}")
                
        conn = get_db_connection()
        cursor = conn.cursor()
        channel_name = videos[0]["channel"] if videos else target
        cursor.execute("""
            INSERT INTO channels (channel_id, title, rss_url, total_scanned, last_checked)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(channel_id) DO UPDATE SET
                total_scanned = total_scanned + ?,
                last_checked = CURRENT_TIMESTAMP
        """, (target, channel_name, f"https://www.youtube.com/feeds/videos.xml?channel_id={target}", len(processed), len(processed)))
        conn.commit()
        conn.close()
        
        return {"status": "success", "count": len(processed), "videos": processed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to scan channel feed: {str(e)}")

@router.get("/channels", response_model=List[dict])
def get_channels_summary():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            channel,
            COUNT(*) as total_videos,
            SUM(CASE WHEN priority IN ('skip', 'low') THEN 1 ELSE 0 END) as skip_videos
        FROM videos
        GROUP BY channel
    """)
    rows = cursor.fetchall()
    conn.close()
    
    res = []
    for r in rows:
        total = r["total_videos"]
        skips = r["skip_videos"]
        ratio = round((skips / total) * 100, 1) if total > 0 else 0
        recommend_unsubscribe = ratio >= 70.0 and total >= 3
        
        res.append({
            "channel": r["channel"],
            "total_videos": total,
            "skip_videos": skips,
            "skip_ratio_percent": ratio,
            "recommend_unsubscribe": recommend_unsubscribe
        })
    return res
