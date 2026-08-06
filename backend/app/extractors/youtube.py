import re
import requests
from typing import Optional, Dict, Any, Tuple, List
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound
import yt_dlp
from app.config import settings
from app.extractors.rss import fetch_channel_rss_feed

def extract_video_id(url_or_id: str) -> Optional[str]:
    url_or_id = url_or_id.strip()
    if len(url_or_id) == 11 and re.match(r'^[a-zA-Z0-9_-]{11}$', url_or_id):
        return url_or_id
    
    patterns = [
        r'(?:v=|\/vi\/|v%3D|embed\/|youtu\.be\/|\/v\/|shorts\/|\/e\/)([^#\&\?]*).*',
    ]
    for pattern in patterns:
        match = re.search(pattern, url_or_id)
        if match:
            vid = match.group(1)
            if len(vid) == 11:
                return vid
    return None

def extract_playlist_id(url_or_id: str) -> Optional[str]:
    url_or_id = url_or_id.strip()
    if url_or_id.startswith(("PL", "FL", "LL", "RD", "UL", "UU", "WL")) and len(url_or_id) >= 2:
        return url_or_id
    match = re.search(r'[&?]list=([a-zA-Z0-9_-]+)', url_or_id)
    if match:
        return match.group(1)
    return None

def resolve_channel_id(channel_handle_or_url: str, api_key: str = "") -> Optional[str]:
    channel_handle_or_url = channel_handle_or_url.strip()
    if channel_handle_or_url.startswith("UC") and len(channel_handle_or_url) == 24:
        return channel_handle_or_url

    match = re.search(r'channel\/(UC[a-zA-Z0-9_-]{22})', channel_handle_or_url)
    if match:
        return match.group(1)

    if api_key and channel_handle_or_url.startswith("@"):
        handle = channel_handle_or_url.lstrip("@")
        url = f"https://www.googleapis.com/youtube/v3/channels?part=id&forHandle={handle}&key={api_key}"
        try:
            res = requests.get(url, timeout=10)
            if res.status_code == 200:
                items = res.json().get("items", [])
                if items:
                    return items[0]["id"]
        except Exception:
            pass

    ydl_opts = {'quiet': True, 'extract_flat': True}
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(channel_handle_or_url, download=False)
            return info.get('channel_id') or info.get('id')
    except Exception:
        pass

    return None

def fetch_all_playlists_api(channel_id: str, api_key: str, access_token: str = "") -> List[Dict[str, Any]]:
    playlists = []
    page_token = ""
    
    headers = {}
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
        base_url = "https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails,status&mine=true&maxResults=50"
    else:
        base_url = f"https://www.googleapis.com/youtube/v3/playlists?part=snippet,contentDetails,status&channelId={channel_id}&maxResults=50"
        if api_key:
            base_url += f"&key={api_key}"

    # 1. Fetch user created playlists (Mine / Channel)
    while True:
        url = base_url
        if page_token:
            url += f"&pageToken={page_token}"
        try:
            res = requests.get(url, headers=headers, timeout=10)
            if res.status_code != 200:
                if res.status_code == 403 and "quotaExceeded" in res.text:
                    print("[YouTube API Notice] Shared OAuth Playground quota exceeded. Switching to Zero-Quota scraper...")
                else:
                    print(f"[YouTube API Error] Playlists fetch status: {res.status_code}, response: {res.text}")
                break
            data = res.json()
            for item in data.get("items", []):
                snippet = item.get("snippet", {})
                content = item.get("contentDetails", {})
                status_info = item.get("status", {})
                pl_id = item["id"]
                privacy = status_info.get("privacyStatus", "public")
                title = snippet.get("title", f"Playlist {pl_id}")
                if privacy != "public":
                    title += f" ({privacy.capitalize()})"
                    
                playlists.append({
                    "id": pl_id,
                    "title": title,
                    "description": snippet.get("description", ""),
                    "thumbnail": snippet.get("thumbnails", {}).get("high", {}).get("url", ""),
                    "item_count": content.get("itemCount", 0)
                })
            page_token = data.get("nextPageToken")
            if not page_token:
                break
        except Exception as e:
            print(f"Error fetching playlists API: {e}")
            break

    # Fallback Uploads playlist
    if channel_id and channel_id.startswith("UC"):
        uploads_pl_id = "UU" + channel_id[2:]
        if not any(p["id"] == uploads_pl_id for p in playlists):
            playlists.insert(0, {
                "id": uploads_pl_id,
                "title": "Channel Uploads / Backlog",
                "description": "All uploads from your channel",
                "thumbnail": "",
                "item_count": 0
            })

    return playlists

def fetch_all_playlist_items_api(playlist_id: str, api_key: str, access_token: str = "") -> List[Dict[str, Any]]:
    videos = []
    page_token = ""
    headers = {}
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
        base_url = f"https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId={playlist_id}&maxResults=50"
    else:
        base_url = f"https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&playlistId={playlist_id}&maxResults=50"
        if api_key:
            base_url += f"&key={api_key}"

    while True:
        url = base_url
        if page_token:
            url += f"&pageToken={page_token}"
        try:
            res = requests.get(url, headers=headers, timeout=10)
            if res.status_code != 200:
                print(f"[YouTube API Info] PlaylistItems status {res.status_code} for {playlist_id}. Falling back to yt-dlp zero-quota scraper...")
                fallback = fetch_playlist_data_ytdlp(playlist_id)
                return fallback.get("videos", [])
            data = res.json()
            for idx, item in enumerate(data.get("items", [])):
                snippet = item.get("snippet", {})
                vid = snippet.get("resourceId", {}).get("videoId")
                if not vid:
                    continue
                videos.append({
                    "id": vid,
                    "url": f"https://www.youtube.com/watch?v={vid}",
                    "title": snippet.get("title", f"Video {vid}"),
                    "channel": snippet.get("videoOwnerChannelTitle") or snippet.get("channelTitle") or "YouTube",
                    "duration": 0,
                    "thumbnail": snippet.get("thumbnails", {}).get("high", {}).get("url") or f"https://img.youtube.com/vi/{vid}/hqdefault.jpg",
                    "position": snippet.get("position", idx),
                    "playlist_item_id": item["id"]
                })
            page_token = data.get("nextPageToken")
            if not page_token:
                break
        except Exception as e:
            print(f"Error fetching playlist items API: {e}")
            break
    return videos

def fetch_all_subscriptions_api(channel_id: str, api_key: str, access_token: str = "") -> List[Dict[str, Any]]:
    subscriptions = []
    page_token = ""
    headers = {}
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
        base_url = "https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&mine=true&maxResults=50"
    else:
        base_url = f"https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&channelId={channel_id}&maxResults=50"
        if api_key:
            base_url += f"&key={api_key}"

    while True:
        url = base_url
        if page_token:
            url += f"&pageToken={page_token}"
        try:
            res = requests.get(url, headers=headers, timeout=10)
            if res.status_code != 200:
                print(f"[YouTube API Info] Subscriptions API status {res.status_code}.")
                break
            data = res.json()
            for item in data.get("items", []):
                snippet = item.get("snippet", {})
                sub_channel_id = snippet.get("resourceId", {}).get("channelId")
                if sub_channel_id:
                    subscriptions.append({
                        "channel_id": sub_channel_id,
                        "title": snippet.get("title", "Channel"),
                        "rss_url": f"https://www.youtube.com/feeds/videos.xml?channel_id={sub_channel_id}"
                    })
            page_token = data.get("nextPageToken")
            if not page_token:
                break
        except Exception as e:
            print(f"Error fetching subscriptions API: {e}")
            break
    return subscriptions

def fetch_playlist_data_ytdlp(playlist_url_or_id: str) -> Dict[str, Any]:
    playlist_id = extract_playlist_id(playlist_url_or_id) or playlist_url_or_id
    url = f"https://www.youtube.com/playlist?list={playlist_id}" if not playlist_url_or_id.startswith("http") else playlist_url_or_id

    ydl_opts = {
        'extract_flat': True,
        'quiet': True,
        'skip_download': True
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            playlist_title = info.get('title', f"Playlist {playlist_id}")
            entries = info.get('entries', [])
            
            videos = []
            for idx, entry in enumerate(entries):
                if not entry:
                    continue
                vid = entry.get('id')
                if not vid:
                    continue
                videos.append({
                    "id": vid,
                    "url": f"https://www.youtube.com/watch?v={vid}",
                    "title": entry.get('title', f"Video {vid}"),
                    "channel": entry.get('uploader') or entry.get('channel') or "YouTube",
                    "duration": entry.get('duration', 0),
                    "thumbnail": entry.get('thumbnail') or f"https://img.youtube.com/vi/{vid}/hqdefault.jpg",
                    "position": idx,
                    "playlist_item_id": entry.get('playlist_item_id') or f"item_{playlist_id}_{vid}"
                })

            return {
                "id": playlist_id,
                "title": playlist_title,
                "description": info.get('description', ''),
                "thumbnail": videos[0]["thumbnail"] if videos else "",
                "item_count": len(videos),
                "videos": videos
            }
    except Exception as e:
        print(f"Error fetching playlist with yt-dlp: {e}")
        return {
            "id": playlist_id,
            "title": f"Playlist {playlist_id}",
            "description": "",
            "thumbnail": "",
            "item_count": 0,
            "videos": []
        }

def delete_youtube_playlist_item(playlist_item_id: str, access_token: str) -> bool:
    if not access_token:
        return False
    try:
        url = f"https://www.googleapis.com/youtube/v3/playlistItems?id={playlist_item_id}"
        headers = {"Authorization": f"Bearer {access_token}"}
        res = requests.delete(url, headers=headers, timeout=10)
        return res.status_code == 204
    except Exception as e:
        print(f"Failed to delete playlist item via API: {e}")
        return False

def fetch_youtube_metadata_api_key(video_id: str, api_key: str) -> Optional[Dict[str, Any]]:
    try:
        url = f"https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id={video_id}&key={api_key}"
        res = requests.get(url, timeout=10)
        if res.status_code == 200:
            data = res.json()
            items = data.get("items", [])
            if items:
                snippet = items[0]["snippet"]
                return {
                    "title": snippet.get("title", ""),
                    "channel": snippet.get("channelTitle", ""),
                    "thumbnail": snippet.get("thumbnails", {}).get("high", {}).get("url", f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"),
                    "description": snippet.get("description", "")
                }
    except Exception as e:
        print(f"YouTube Data API error: {e}")
    return None

def fetch_youtube_metadata_ytdlp(video_url: str) -> Dict[str, Any]:
    ydl_opts = {
        'skip_download': True,
        'quiet': True,
        'no_warnings': True,
        'extract_flat': False
    }
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            duration = info.get('duration', 0)
            mins = duration // 60
            secs = duration % 60
            runtime_str = f"{mins}m {secs}s" if mins > 0 else f"{secs}s"
            
            return {
                "title": info.get('title', 'Unknown Title'),
                "channel": info.get('uploader', 'Unknown Channel'),
                "duration": duration,
                "runtime_str": runtime_str,
                "thumbnail": info.get('thumbnail') or f"https://img.youtube.com/vi/{info.get('id')}/hqdefault.jpg",
                "description": info.get('description', '')
            }
    except Exception as e:
        print(f"yt-dlp metadata extraction failed: {e}")
        return {
            "title": "YouTube Video",
            "channel": "Channel",
            "duration": 0,
            "runtime_str": "Unknown",
            "thumbnail": f"https://img.youtube.com/vi/{extract_video_id(video_url)}/hqdefault.jpg",
            "description": ""
        }

def fetch_youtube_transcript(video_id: str) -> Tuple[Optional[str], bool]:
    try:
        transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=['en', 'en-US', 'en-GB'])
        text = " ".join([item['text'] for item in transcript_list])
        text = re.sub(r'\s+', ' ', text).strip()
        return text, True
    except (TranscriptsDisabled, NoTranscriptFound) as e:
        print(f"No native transcript found for {video_id}: {e}")
        return None, False
    except Exception as e:
        print(f"Error fetching transcript via youtube-transcript-api: {e}")
        return None, False

def get_video_info_and_transcript(url_or_id: str) -> Dict[str, Any]:
    video_id = extract_video_id(url_or_id)
    if not video_id:
        raise ValueError("Invalid YouTube URL or Video ID")
    
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    
    metadata = {}
    if settings.YOUTUBE_API_KEY:
        api_meta = fetch_youtube_metadata_api_key(video_id, settings.YOUTUBE_API_KEY)
        if api_meta:
            metadata.update(api_meta)
            
    if not metadata.get("title"):
        ytdlp_meta = fetch_youtube_metadata_ytdlp(video_url)
        metadata.update(ytdlp_meta)
        
    transcript_text, has_native_sub = fetch_youtube_transcript(video_id)
    
    mins = metadata.get("duration", 0) // 60
    secs = metadata.get("duration", 0) % 60
    runtime_str = metadata.get("runtime_str") or (f"{mins}m {secs}s" if mins > 0 else f"{secs}s")

    return {
        "id": video_id,
        "url": video_url,
        "title": metadata.get("title", f"Video {video_id}"),
        "channel": metadata.get("channel", "Unknown Channel"),
        "duration": metadata.get("duration", 0),
        "runtime_str": runtime_str,
        "thumbnail": metadata.get("thumbnail", f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg"),
        "transcript": transcript_text or "",
        "has_native_transcript": has_native_sub
    }
