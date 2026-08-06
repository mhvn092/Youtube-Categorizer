import feedparser
import re
from typing import List, Dict, Any, Optional

def get_channel_id_from_url(channel_url: str) -> Optional[str]:
    """Helper to extract or find YouTube channel ID"""
    match = re.search(r'channel\/(UC[a-zA-Z0-9_-]{22})', channel_url)
    if match:
        return match.group(1)
    return None

def fetch_channel_rss_feed(channel_id_or_url: str) -> List[Dict[str, Any]]:
    """
    Fetches public YouTube Channel RSS feed without any API keys!
    URL format: https://www.youtube.com/feeds/videos.xml?channel_id=UC...
    """
    channel_id = get_channel_id_from_url(channel_id_or_url) or channel_id_or_url
    if not channel_id.startswith("UC"):
        # If passed custom handle like @Username or URL, we fallback to yt-dlp to get channel_id
        import yt_dlp
        ydl_opts = {'quiet': True, 'extract_flat': True}
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(channel_id_or_url, download=False)
                channel_id = info.get('channel_id') or channel_id
        except Exception:
            pass

    rss_url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
    feed = feedparser.parse(rss_url)
    
    videos = []
    for entry in feed.entries:
        video_id = entry.yt_videoid if hasattr(entry, 'yt_videoid') else entry.id.split(':')[-1]
        videos.append({
            "id": video_id,
            "url": entry.link,
            "title": entry.title,
            "channel": entry.author if hasattr(entry, 'author') else "Unknown Channel",
            "published": entry.published if hasattr(entry, 'published') else "",
            "thumbnail": f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"
        })
    return videos
