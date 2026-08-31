import os
import re
import time
import hashlib
import requests
import http.cookiejar
import xml.etree.ElementTree as ET
from typing import Optional, Dict, Any, Tuple, List
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound
import yt_dlp
from app.config import BASE_DIR, settings
from app.extractors.rss import fetch_channel_rss_feed

def _get_cookie_path() -> Optional[str]:
    cookie_candidates = [
        settings.YOUTUBE_COOKIES_FILE,
        "cookies.txt",
        os.path.join(BASE_DIR, "cookies.txt"),
        os.path.join(BASE_DIR, "data", "cookies.txt"),
        os.path.join(os.path.dirname(BASE_DIR), "cookies.txt")
    ]
    for path in cookie_candidates:
        if path and os.path.exists(path) and os.path.getsize(path) > 0:
            return path
    return None

def _get_ytt_instance() -> YouTubeTranscriptApi:
    proxy_url = settings.TRANSCRIPT_PROXY_URL or os.getenv("HTTPS_PROXY") or os.getenv("HTTP_PROXY")
    if proxy_url:
        session = requests.Session()
        session.proxies = {"http": proxy_url, "https": proxy_url}
        return YouTubeTranscriptApi(http_client=session)
    return YouTubeTranscriptApi()

def _get_configured_session() -> requests.Session:
    session = requests.Session()
    proxy_url = settings.TRANSCRIPT_PROXY_URL or os.getenv("HTTPS_PROXY") or os.getenv("HTTP_PROXY")
    if proxy_url:
        session.proxies = {"http": proxy_url, "https": proxy_url}
        
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9"
    })
    
    cookie_path = _get_cookie_path()
    if cookie_path:
        try:
            cj = http.cookiejar.MozillaCookieJar(cookie_path)
            cj.load(ignore_discard=True, ignore_expires=True)
            session.cookies = cj
        except Exception:
            pass
    return session

def _generate_sapisidhash(sapisid: str, origin: str = "https://www.youtube.com") -> str:
    """Generate the SAPISIDHASH authorization header YouTube expects for authenticated InnerTube requests."""
    timestamp = str(int(time.time()))
    hash_input = f"{timestamp} {sapisid} {origin}"
    hash_value = hashlib.sha1(hash_input.encode('utf-8')).hexdigest()
    return f"SAPISIDHASH {timestamp}_{hash_value}"

def _get_authenticated_session() -> Optional[Tuple[requests.Session, Dict[str, str]]]:
    """
    Build a requests.Session with cookies from cookies.txt and SAPISIDHASH auth headers.
    Returns (session, cookies_dict) or None if SAPISID cookie is not available.
    """
    cookie_path = _get_cookie_path()
    if not cookie_path:
        return None
    try:
        cj = http.cookiejar.MozillaCookieJar(cookie_path)
        cj.load(ignore_discard=True, ignore_expires=True)
    except Exception as e:
        print(f"[SAPISIDHASH] Failed to load cookies: {e}", flush=True)
        return None

    cookies_dict = {cookie.name: cookie.value for cookie in cj}
    sapisid = cookies_dict.get("SAPISID")
    if not sapisid:
        return None

    sapisidhash = _generate_sapisidhash(sapisid)

    session = requests.Session()
    session.cookies = cj
    proxy_url = settings.TRANSCRIPT_PROXY_URL or os.getenv("HTTPS_PROXY") or os.getenv("HTTP_PROXY")
    if proxy_url:
        session.proxies = {"http": proxy_url, "https": proxy_url}
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Authorization": sapisidhash,
        "X-Origin": "https://www.youtube.com",
        "Origin": "https://www.youtube.com",
    })
    return session, cookies_dict

def _parse_xml_subtitle(xml_text: str) -> str:
    """Parse XML/srv1 subtitle format returned by YouTube timedtext endpoint."""
    try:
        root = ET.fromstring(xml_text)
        texts = [elem.text for elem in root.findall('.//text') if elem.text]
        return re.sub(r'\s+', ' ', " ".join(texts)).strip()
    except Exception:
        return ""

def _get_ytdlp_opts(base_opts: Optional[dict] = None) -> dict:
    opts = {
        'quiet': True,
        'no_warnings': True,
        'ignore_no_formats_error': True,
        'extractor_args': {'youtube': {'player_client': ['android', 'ios', 'mweb', 'web']}}
    }
    if base_opts:
        opts.update(base_opts)
        
    cookie_path = _get_cookie_path()
    if cookie_path:
        opts['cookiefile'] = cookie_path
            
    return opts

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

    ydl_opts = _get_ytdlp_opts({'extract_flat': True})
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
    if not access_token and (not channel_id or channel_id == "UC_mine"):
        print("[YouTube Sync] No OAuth token or valid Channel ID provided. Skipping YouTube Data API playlists fetch.", flush=True)
        return playlists

    while True:
        url = base_url
        if page_token:
            url += f"&pageToken={page_token}"
        try:
            print(f"[YouTube API Request] Fetching playlists... PageToken: '{page_token}'", flush=True)
            res = requests.get(url, headers=headers, timeout=10)
            if res.status_code != 200:
                print(f"[YouTube API Error] Playlists fetch status: {res.status_code}, response: {res.text}", flush=True)
                break
            data = res.json()
            items_found = data.get("items", [])
            print(f"[YouTube API Success] Found {len(items_found)} playlists on current page.", flush=True)
            for item in items_found:
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
            print(f"[YouTube API Exception] Error fetching playlists API: {e}", flush=True)
            break

    # Fallback Uploads playlist
    if channel_id and channel_id.startswith("UC") and len(channel_id) == 24:
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
            print(f"[YouTube API Request] Fetching items for playlist {playlist_id}...", flush=True)
            res = requests.get(url, headers=headers, timeout=10)
            if res.status_code != 200:
                print(f"[YouTube API Info] PlaylistItems status {res.status_code} for {playlist_id}.", flush=True)
                if res.status_code in (401, 403):
                    print(f"[YouTube API Warning] Auth or quota issue (HTTP {res.status_code}). Skipping yt-dlp fallback for {playlist_id}.", flush=True)
                    return []
                print(f"[YouTube API Info] Falling back to yt-dlp zero-quota scraper for public playlist {playlist_id}...", flush=True)
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
            print(f"[YouTube API Exception] Error fetching playlist items API: {e}", flush=True)
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
        if not channel_id or channel_id == "UC_mine":
            print("[YouTube Sync] No OAuth token or valid Channel ID provided. Skipping subscriptions fetch.", flush=True)
            return subscriptions
        base_url = f"https://www.googleapis.com/youtube/v3/subscriptions?part=snippet&channelId={channel_id}&maxResults=50"
        if api_key:
            base_url += f"&key={api_key}"

    while True:
        url = base_url
        if page_token:
            url += f"&pageToken={page_token}"
        try:
            print(f"[YouTube API Request] Fetching channel subscriptions...", flush=True)
            res = requests.get(url, headers=headers, timeout=10)
            if res.status_code != 200:
                print(f"[YouTube API Info] Subscriptions API status {res.status_code}: {res.text}", flush=True)
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
            print(f"[YouTube API Exception] Error fetching subscriptions API: {e}", flush=True)
            break
    return subscriptions

def fetch_playlist_data_ytdlp(playlist_url_or_id: str) -> Dict[str, Any]:
    playlist_id = extract_playlist_id(playlist_url_or_id) or playlist_url_or_id
    url = f"https://www.youtube.com/playlist?list={playlist_id}" if not playlist_url_or_id.startswith("http") else playlist_url_or_id

    ydl_opts = _get_ytdlp_opts({
        'extract_flat': True,
        'skip_download': True
    })

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
                
                title = entry.get('title')
                channel = entry.get('uploader') or entry.get('channel') or "YouTube"
                thumbnail = entry.get('thumbnail') or f"https://img.youtube.com/vi/{vid}/hqdefault.jpg"

                if not title or title in (f"Video {vid}", "YouTube Video", "[Private video]", "[Deleted video]"):
                    oembed = fetch_youtube_metadata_oembed(vid)
                    if oembed:
                        title = oembed["title"]
                        channel = oembed["channel"]
                        thumbnail = oembed["thumbnail"]
                    else:
                        title = title or f"Video {vid}"

                videos.append({
                    "id": vid,
                    "url": f"https://www.youtube.com/watch?v={vid}",
                    "title": title,
                    "channel": channel,
                    "duration": entry.get('duration', 0),
                    "thumbnail": thumbnail,
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

def fetch_youtube_metadata_oembed(video_url_or_id: str) -> Optional[Dict[str, Any]]:
    video_id = extract_video_id(video_url_or_id) or video_url_or_id
    url = f"https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v={video_id}&format=json"
    try:
        res = requests.get(url, timeout=5)
        if res.status_code == 200:
            data = res.json()
            title = data.get("title")
            if title and title != "YouTube Video":
                return {
                    "title": title,
                    "channel": data.get("author_name", "YouTube Channel"),
                    "thumbnail": data.get("thumbnail_url") or f"https://img.youtube.com/vi/{video_id}/hqdefault.jpg",
                    "description": f"Video by {data.get('author_name', 'YouTube Channel')}"
                }
    except Exception as e:
        print(f"[oEmbed Metadata Error] {video_id}: {e}", flush=True)
    return None

def fetch_youtube_metadata_ytdlp(video_url: str) -> Dict[str, Any]:
    ydl_opts = _get_ytdlp_opts({
        'skip_download': True,
        'extract_flat': False
    })
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

def _parse_json3_subtitle(data: dict) -> str:
    texts = []
    for ev in data.get('events', []):
        for seg in ev.get('segs', []):
            utf8 = seg.get('utf8', '')
            if utf8:
                texts.append(utf8)
    full_text = " ".join(texts)
    return re.sub(r'\s+', ' ', full_text).strip()

def _parse_vtt_subtitle(vtt_text: str) -> str:
    lines = vtt_text.splitlines()
    clean_lines = []
    for line in lines:
        line = line.strip()
        if not line or line.startswith('WEBVTT') or line.startswith('NOTE') or '-->' in line:
            continue
        line = re.sub(r'<[^>]+>', '', line)
        if line and (not clean_lines or clean_lines[-1] != line):
            clean_lines.append(line)
    full_text = " ".join(clean_lines)
    return re.sub(r'\s+', ' ', full_text).strip()

def fetch_transcript_youtube_transcript_api(video_id: str) -> Optional[str]:
    print(f"[Tier 3: youtube-transcript-api] Attempting fetch for {video_id}...", flush=True)
    try:
        # 1. Modern instance API: YouTubeTranscriptApi().list(video_id)
        try:
            ytt = _get_ytt_instance()
            if hasattr(ytt, 'list'):
                t_list = ytt.list(video_id)
                try:
                    t = t_list.find_transcript(['en', 'en-US', 'en-GB', 'en-CA'])
                except Exception:
                    all_transcripts = list(t_list)
                    t = all_transcripts[0] if all_transcripts else None
                if t:
                    snippets = t.fetch()
                    texts = []
                    for s in snippets:
                        if hasattr(s, 'text'):
                            texts.append(s.text)
                        elif isinstance(s, dict):
                            texts.append(s.get('text', ''))
                        elif hasattr(s, '__getitem__') and 'text' in s:
                            texts.append(s['text'])
                        else:
                            texts.append(str(s))
                    full_text = re.sub(r'\s+', ' ', " ".join(texts)).strip()
                    if full_text:
                        return full_text
        except Exception as inst_err:
            print(f"[Tier 3: youtube-transcript-api] Instance method note: {inst_err}", flush=True)

        # 2. Legacy classmethod API fallback
        if hasattr(YouTubeTranscriptApi, 'get_transcript'):
            try:
                transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=['en', 'en-US', 'en-GB'])
            except Exception:
                transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
            texts = [s.get('text', '') for s in transcript_list if isinstance(s, dict)]
            full_text = re.sub(r'\s+', ' ', " ".join(texts)).strip()
            if full_text:
                return full_text
    except Exception as e:
        print(f"[Tier 3: youtube-transcript-api] Failed for {video_id}: {e}", flush=True)
    return None

def fetch_transcript_ytdlp_subtitles(video_id: str) -> Optional[str]:
    print(f"[Tier 4: yt-dlp subtitles] Attempting fetch for {video_id}...", flush=True)
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    ydl_opts = _get_ytdlp_opts({
        'skip_download': True,
        'writesubtitles': True,
        'writeautomaticsub': True,
        'subtitleslangs': ['en.*', 'en']
    })
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(video_url, download=False)
            captions_dict = info.get('subtitles') or info.get('automatic_captions') or {}
            
            # Look for English or best available language track
            selected_track = None
            for lang in ['en', 'en-US', 'en-GB', 'en-CA', 'en-AU']:
                if lang in captions_dict:
                    selected_track = captions_dict[lang]
                    break
            if not selected_track and captions_dict:
                selected_track = list(captions_dict.values())[0]

            if not selected_track:
                print(f"[Tier 4: yt-dlp subtitles] Failed for {video_id}: No subtitle tracks found.", flush=True)
                return None

            # Try json3 format first, then vtt / srv formats
            fmt_json3 = next((f for f in selected_track if f.get('ext') == 'json3'), None)
            if fmt_json3 and fmt_json3.get('url'):
                res = requests.get(fmt_json3['url'], timeout=10)
                if res.status_code == 200:
                    text = _parse_json3_subtitle(res.json())
                    if text:
                        return text

            fmt_vtt = next((f for f in selected_track if f.get('ext') in ('vtt', 'srv1', 'srv2', 'srv3')), None)
            if fmt_vtt and fmt_vtt.get('url'):
                res = requests.get(fmt_vtt['url'], timeout=10)
                if res.status_code == 200:
                    text = _parse_vtt_subtitle(res.text)
                    if text:
                        return text

            print(f"[Tier 4: yt-dlp subtitles] Failed for {video_id}: Subtitle track URL request failed.", flush=True)
    except Exception as e:
        print(f"[Tier 4: yt-dlp subtitles] Failed for {video_id}: {e}", flush=True)
    return None

def _select_best_transcript_track(options: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not options:
        return {}
    manual_options = [o for o in options if not o.get("is_generated")]
    auto_options = [o for o in options if o.get("is_generated")]

    # If both manual and auto exist:
    if manual_options and auto_options:
        best_manual = max(manual_options, key=lambda x: x.get("word_count", 0))
        best_auto = max(auto_options, key=lambda x: x.get("word_count", 0))
        # If manual is a rich transcript (at least 40% words of auto or >= 300 words), prefer manual
        if best_manual.get("word_count", 0) >= max(300, int(best_auto.get("word_count", 0) * 0.4)):
            return best_manual
        else:
            # Manual is likely just movie titles / chapters / stubs, so prefer auto for rich dialogue
            return best_auto
    elif manual_options:
        return max(manual_options, key=lambda x: x.get("word_count", 0))
    else:
        return max(options, key=lambda x: x.get("word_count", 0))

def fetch_transcript_innertube_options(video_id: str) -> List[Dict[str, Any]]:
    """
    Tier 1 Authenticated Multi-Track Caption Discovery:
    Uses SAPISIDHASH authentication (derived from cookies.txt SAPISID cookie) to call
    the InnerTube /player endpoint and downloads ALL available caption tracks
    (manual, auto-generated, movie titles, translations, etc.).
    Bypasses YouTube bot detection / IP blocking completely.
    """
    print(f"[Tier 1: InnerTube SAPISIDHASH] Attempting authenticated multi-track fetch for {video_id}...", flush=True)
    auth_result = _get_authenticated_session()
    if auth_result is None:
        print(f"[Tier 1: InnerTube SAPISIDHASH] Skipped for {video_id}: No cookies.txt or SAPISID cookie not found.", flush=True)
        return []

    session, cookies_dict = auth_result

    player_headers = {
        "Content-Type": "application/json",
        "Referer": f"https://www.youtube.com/watch?v={video_id}",
        "X-Youtube-Client-Name": "1",
        "X-Youtube-Client-Version": "2.20240801.00.00",
        "X-Goog-Visitor-Id": cookies_dict.get("VISITOR_INFO1_LIVE", ""),
    }
    payload = {
        "context": {
            "client": {
                "clientName": "WEB",
                "clientVersion": "2.20240801.00.00",
                "hl": "en",
                "gl": "US",
                "visitorData": cookies_dict.get("VISITOR_INFO1_LIVE", ""),
            }
        },
        "videoId": video_id
    }

    options = []
    seen_texts = set()

    try:
        res = session.post(
            "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
            json=payload, headers=player_headers, timeout=25
        )
        if res.status_code != 200:
            print(f"[Tier 1: InnerTube SAPISIDHASH] /player HTTP {res.status_code} for {video_id}", flush=True)
            return []

        data = res.json()
        playability = data.get("playabilityStatus", {}).get("status")
        if playability != "OK":
            print(f"[Tier 1: InnerTube SAPISIDHASH] Playability '{playability}' for {video_id} (not OK)", flush=True)
            return []

        tracks = (data.get("captions", {})
                  .get("playerCaptionsTracklistRenderer", {})
                  .get("captionTracks", []))
        if not tracks:
            print(f"[Tier 1: InnerTube SAPISIDHASH] No caption tracks for {video_id}", flush=True)
            return []

        print(f"[Tier 1: InnerTube SAPISIDHASH] Found {len(tracks)} caption track(s) for {video_id}. Downloading all available tracks...", flush=True)

        sub_headers = {
            "Referer": f"https://www.youtube.com/watch?v={video_id}",
            "Accept": "*/*",
        }

        for idx, track in enumerate(tracks):
            base_url = track.get("baseUrl", "")
            if not base_url:
                continue

            name_dict = track.get("name", {})
            raw_name = ""
            if isinstance(name_dict, dict):
                if "runs" in name_dict and name_dict["runs"]:
                    raw_name = name_dict["runs"][0].get("text", "")
                elif "simpleText" in name_dict:
                    raw_name = name_dict.get("simpleText", "")
            if not raw_name:
                raw_name = track.get("languageCode", "English")

            is_generated = (track.get("kind") == "asr" or track.get("vssId", "").startswith("a."))
            kind_label = "Auto-generated" if is_generated else "Manual Spoken"

            if "auto-generated" in raw_name.lower() or "manual" in raw_name.lower():
                display_name = raw_name
            else:
                display_name = f"{raw_name} ({kind_label})"

            # Download subtitle format (try json3 first, then srv1/xml)
            text = ""
            for fmt_name, fmt_param in [("json3", "&fmt=json3"), ("srv1", "&fmt=srv1"), ("xml", "")]:
                try:
                    fetch_url = f"{base_url}{fmt_param}"
                    sub_res = session.get(fetch_url, headers=sub_headers, timeout=15)
                    if sub_res.status_code == 200 and sub_res.text.strip():
                        if fmt_name == "json3":
                            try:
                                text = _parse_json3_subtitle(sub_res.json())
                            except Exception:
                                pass
                        else:
                            text = _parse_xml_subtitle(sub_res.text)

                        if text:
                            break
                except Exception:
                    pass

            if text and text not in seen_texts:
                seen_texts.add(text)
                words = len(text.split())
                options.append({
                    "id": f"innertube_{track.get('languageCode', 'en')}_{'auto' if is_generated else 'manual'}_{len(options)+1}",
                    "name": display_name,
                    "language": track.get("languageCode", "en"),
                    "is_generated": is_generated,
                    "word_count": words,
                    "text": text
                })
                print(f"[Tier 1: InnerTube SAPISIDHASH] Downloaded track '{display_name}' ({words} words)", flush=True)

        return options
    except Exception as e:
        print(f"[Tier 1: InnerTube SAPISIDHASH] Failed for {video_id}: {e}", flush=True)
        return []

def fetch_transcript_innertube_authenticated(video_id: str) -> Optional[str]:
    options = fetch_transcript_innertube_options(video_id)
    if not options:
        return None
    best = _select_best_transcript_track(options)
    return best.get("text") if best else None

def fetch_transcript_youtube_data_api(video_id: str) -> Optional[str]:
    """
    Tier 2: Uses YouTube Data API v3 with OAuth token or API Key.
    Note: Google limits captions.download to videos owned by the authenticated channel.
    For 3rd party public videos, Google returns 403 Forbidden by design.
    """
    print(f"[Tier 2: YouTube Data API Captions] Attempting fetch for {video_id}...", flush=True)
    if not settings.YOUTUBE_OAUTH_TOKEN and not settings.YOUTUBE_API_KEY:
        print(f"[Tier 2: YouTube Data API Captions] Skipped for {video_id}: No OAuth token or API key configured.", flush=True)
        return None
    try:
        headers = {}
        if settings.YOUTUBE_OAUTH_TOKEN:
            headers["Authorization"] = f"Bearer {settings.YOUTUBE_OAUTH_TOKEN}"
            list_url = f"https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId={video_id}"
        else:
            list_url = f"https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId={video_id}&key={settings.YOUTUBE_API_KEY}"
            
        res = requests.get(list_url, headers=headers, timeout=10)
        if res.status_code == 200:
            items = res.json().get("items", [])
            if items:
                caption_id = items[0]["id"]
                if settings.YOUTUBE_OAUTH_TOKEN:
                    dl_url = f"https://www.googleapis.com/youtube/v3/captions/{caption_id}"
                else:
                    dl_url = f"https://www.googleapis.com/youtube/v3/captions/{caption_id}?key={settings.YOUTUBE_API_KEY}"
                dl_res = requests.get(dl_url, headers=headers, timeout=10)
                if dl_res.status_code == 200:
                    text = _parse_vtt_subtitle(dl_res.text)
                    if text:
                        return text
                else:
                    print(f"[Tier 2: YouTube Data API Captions] HTTP {dl_res.status_code} on download (Google caption download is restricted to video owners).", flush=True)
            else:
                print(f"[Tier 2: YouTube Data API Captions] No caption tracks found for {video_id}.", flush=True)
        elif res.status_code == 403:
            print(f"[Tier 2: YouTube Data API Captions] HTTP 403 Forbidden for {video_id} (Google Data API restricts captions to videos owned by caller; proceeding to public scrapers).", flush=True)
        else:
            print(f"[Tier 2: YouTube Data API Captions] Failed for {video_id}: API status {res.status_code}", flush=True)
    except Exception as e:
        print(f"[Tier 2: YouTube Data API Captions] Failed for {video_id}: {e}", flush=True)
    return None

def fetch_transcript_downsub_free_scraper(video_id: str) -> Optional[str]:
    """
    Tier 3: Free Public Subtitle / DownSub Web Scraper (No Paid API Key required).
    """
    print(f"[Tier 3: Free DownSub Scraper] Attempting fetch for {video_id}...", flush=True)
    free_endpoints = [
        f"https://downsub.com/api/subs?url=https://www.youtube.com/watch?v={video_id}",
        f"https://subdl.org/api/youtube/{video_id}",
    ]
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": "https://downsub.com/"
    }
    for ep in free_endpoints:
        try:
            res = requests.get(ep, headers=headers, timeout=8)
            if res.status_code == 200:
                try:
                    data = res.json()
                    sub_url = None
                    if isinstance(data, list) and data:
                        sub_url = data[0].get("url") or data[0].get("file")
                    elif isinstance(data, dict):
                        sub_url = data.get("url") or data.get("file") or (data.get("subtitles", [{}])[0].get("url") if data.get("subtitles") else None)

                    if sub_url:
                        sub_res = requests.get(sub_url, timeout=10)
                        if sub_res.status_code == 200:
                            if "json" in sub_url or sub_res.text.startswith("{"):
                                text = _parse_json3_subtitle(sub_res.json())
                            else:
                                text = _parse_vtt_subtitle(sub_res.text)
                            if text:
                                return text
                except Exception:
                    pass
        except Exception as e:
            pass

    # 2. Check third-party API keys if configured (Supadata or Custom)
    res_third_party = fetch_transcript_third_party_api(video_id)
    if not res_third_party:
        print(f"[Tier 3: Free DownSub Scraper] No subtitles from web scraper endpoints for {video_id}.", flush=True)
    return res_third_party

def fetch_transcript_third_party_api(video_id: str) -> Optional[str]:
    # Supadata API Support
    if settings.SUPADATA_API_KEY:
        try:
            url = f"https://api.supadata.ai/v1/youtube/transcript?videoId={video_id}"
            headers = {"x-api-key": settings.SUPADATA_API_KEY}
            res = requests.get(url, headers=headers, timeout=15)
            if res.status_code == 200:
                data = res.json()
                content = data.get("content")
                if isinstance(content, str) and content.strip():
                    return content.strip()
                elif isinstance(content, list):
                    texts = [item.get("text", "") for item in content if isinstance(item, dict)]
                    text = " ".join(texts).strip()
                    if text:
                        return text
        except Exception as e:
            print(f"[Third-Party: Supadata API] Failed for {video_id}: {e}", flush=True)

    # Generic Third-Party API Support
    if settings.TRANSCRIPT_API_URL:
        try:
            url = settings.TRANSCRIPT_API_URL.format(video_id=video_id)
            headers = {}
            if settings.TRANSCRIPT_API_KEY:
                headers["Authorization"] = f"Bearer {settings.TRANSCRIPT_API_KEY}"
            res = requests.get(url, headers=headers, timeout=15)
            if res.status_code == 200:
                data = res.json()
                text = data.get("transcript") or data.get("text") or data.get("full_text")
                if text:
                    return str(text).strip()
        except Exception as e:
            print(f"[Third-Party: Custom API] Failed for {video_id}: {e}", flush=True)

    return None

def fetch_all_transcript_options(video_id: str) -> List[Dict[str, Any]]:
    """
    Scrapes and fetches all available caption tracks (manual, auto-generated, multiple English tracks).
    Prioritizes authenticated InnerTube SAPISIDHASH first to download all tracks cleanly without IP blocking.
    """
    # 1. InnerTube SAPISIDHASH Multi-Track Authenticated (Prioritized #1: 100% bypasses bot/IP detection & downloads all caption tracks)
    innertube_options = fetch_transcript_innertube_options(video_id)
    if innertube_options:
        return innertube_options

    options = []
    seen_texts = set()

    # 2. YouTubeTranscriptApi multi-track discovery (Modern & Legacy fallback)
    try:
        transcript_list = None
        try:
            ytt = _get_ytt_instance()
            if hasattr(ytt, 'list'):
                transcript_list = ytt.list(video_id)
        except Exception:
            pass

        if transcript_list is None and hasattr(YouTubeTranscriptApi, 'list_transcripts'):
            try:
                transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            except Exception:
                pass

        if transcript_list:
            for tr in transcript_list:
                try:
                    snippets = tr.fetch()
                    texts = []
                    for s in snippets:
                        if hasattr(s, 'text'):
                            texts.append(s.text)
                        elif isinstance(s, dict):
                            texts.append(s.get('text', ''))
                        elif hasattr(s, '__getitem__') and 'text' in s:
                            texts.append(s['text'])
                        else:
                            texts.append(str(s))
                    full_text = " ".join(texts)
                    full_text = re.sub(r'\s+', ' ', full_text).strip()
                    if full_text and full_text not in seen_texts:
                        seen_texts.add(full_text)
                        tr_type = "Auto-generated" if tr.is_generated else "Manual Spoken"
                        track_name = f"{tr.language} ({tr_type})"
                        options.append({
                            "id": f"ytt_{tr.language_code}_{'auto' if tr.is_generated else 'manual'}_{len(options)+1}",
                            "name": track_name,
                            "language": tr.language,
                            "is_generated": tr.is_generated,
                            "word_count": len(full_text.split()),
                            "text": full_text
                        })
                except Exception:
                    pass
    except Exception:
        pass

    # 3. yt-dlp subtitles (only fallback if prior steps found no tracks)
    if not options:
        try:
            video_url = f"https://www.youtube.com/watch?v={video_id}"
            ydl_opts = _get_ytdlp_opts({
                'skip_download': True,
                'writesubtitles': True,
                'writeautomaticsub': True,
            })
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)
                all_captions = {}
                if info.get('subtitles'):
                    for lang, tracks in info['subtitles'].items():
                        all_captions[f"{lang} (Manual)"] = tracks
                if info.get('automatic_captions'):
                    for lang, tracks in info['automatic_captions'].items():
                        all_captions[f"{lang} (Auto-generated)"] = tracks

                for track_label, track_formats in all_captions.items():
                    fmt = next((f for f in track_formats if f.get('ext') == 'json3'), None) or \
                          next((f for f in track_formats if f.get('ext') in ('vtt', 'srv1', 'srv2', 'srv3')), None)
                    if fmt and fmt.get('url'):
                        try:
                            res = requests.get(fmt['url'], timeout=10)
                            if res.status_code == 200:
                                if fmt.get('ext') == 'json3':
                                    text = _parse_json3_subtitle(res.json())
                                else:
                                    text = _parse_vtt_subtitle(res.text)
                                if text and text not in seen_texts:
                                    seen_texts.add(text)
                                    options.append({
                                        "id": f"ytdlp_{len(options)+1}",
                                        "name": f"yt-dlp {track_label}",
                                        "language": track_label,
                                        "is_generated": "Auto-generated" in track_label,
                                        "word_count": len(text.split()),
                                        "text": text
                                    })
                        except Exception:
                            pass
        except Exception as e:
            print(f"[yt-dlp list_subtitles Info] {video_id}: {e}", flush=True)

    return options

def fetch_youtube_transcript_tiered(video_id: str) -> Tuple[Optional[str], str, bool, List[Dict[str, Any]]]:
    """
    Executes multi-track extraction & 5-tier transcript pipeline.
    Returns: (transcript_text, tier_name, has_native_transcript, available_transcripts)
    """
    print(f"[Transcript Extractor] Starting multi-track caption discovery for video {video_id}...", flush=True)

    options = fetch_all_transcript_options(video_id)
    if options:
        best_option = _select_best_transcript_track(options)
        print(f"[Transcript] Discovered and downloaded {len(options)} caption track(s). Defaulting to '{best_option.get('name')}' ({best_option.get('word_count')} words)", flush=True)
        return best_option.get("text"), best_option.get("id", "innertube_selected"), True, options

    # Tier 2: YouTube Data API v3 (OAuth & Key)
    text = fetch_transcript_youtube_data_api(video_id)
    if text:
        print(f"[Transcript] Successfully retrieved via Tier 2 (YouTube Data API / OAuth) for {video_id}", flush=True)
        opt = [{"id": "youtube-data-api", "name": "YouTube Data API", "language": "English", "is_generated": False, "word_count": len(text.split()), "text": text}]
        return text, "youtube-data-api", True, opt

    # Tier 3: Free DownSub / Web Subtitle Scraper
    text = fetch_transcript_downsub_free_scraper(video_id)
    if text:
        print(f"[Transcript] Successfully retrieved via Tier 3 (Free DownSub / Web Scraper) for {video_id}", flush=True)
        opt = [{"id": "downsub-free-scraper", "name": "Free Subtitle Scraper", "language": "English", "is_generated": False, "word_count": len(text.split()), "text": text}]
        return text, "downsub-free-scraper", True, opt

    # Tier 4: youtube-transcript-api
    text = fetch_transcript_youtube_transcript_api(video_id)
    if text:
        print(f"[Transcript] Successfully retrieved via Tier 4 (youtube-transcript-api) for {video_id}", flush=True)
        opt = [{"id": "youtube-transcript-api", "name": "youtube-transcript-api", "language": "English", "is_generated": False, "word_count": len(text.split()), "text": text}]
        return text, "youtube-transcript-api", True, opt

    # Tier 5: yt-dlp direct subtitle extraction
    text = fetch_transcript_ytdlp_subtitles(video_id)
    if text:
        print(f"[Transcript] Successfully retrieved via Tier 5 (yt-dlp subtitles) for {video_id}", flush=True)
        opt = [{"id": "yt-dlp-subtitles", "name": "yt-dlp subtitles", "language": "English", "is_generated": False, "word_count": len(text.split()), "text": text}]
        return text, "yt-dlp-subtitles", True, opt

    return None, "none", False, []

def fetch_youtube_transcript(video_id: str) -> Tuple[Optional[str], bool, List[Dict[str, Any]]]:
    text, tier_name, has_sub, options = fetch_youtube_transcript_tiered(video_id)
    return text, has_sub, options

def get_video_info_and_transcript(url_or_id: str) -> Dict[str, Any]:
    video_id = extract_video_id(url_or_id)
    if not video_id:
        raise ValueError("Invalid YouTube URL or Video ID")
    
    video_url = f"https://www.youtube.com/watch?v={video_id}"
    
    metadata = {}
    
    # 1. Check YouTube Data API Key if provided
    if settings.YOUTUBE_API_KEY:
        api_meta = fetch_youtube_metadata_api_key(video_id, settings.YOUTUBE_API_KEY)
        if api_meta:
            metadata.update(api_meta)
            
    # 2. Check YouTube official oEmbed API (Never blocked, 100% reliable)
    if not metadata.get("title") or metadata.get("title") == "YouTube Video":
        oembed_meta = fetch_youtube_metadata_oembed(video_id)
        if oembed_meta:
            metadata.update(oembed_meta)
            
    # 3. Try yt-dlp to enrich duration/description if possible
    if not metadata.get("title") or metadata.get("title") == "YouTube Video":
        ytdlp_meta = fetch_youtube_metadata_ytdlp(video_url)
        if ytdlp_meta and ytdlp_meta.get("title") != "YouTube Video":
            metadata.update(ytdlp_meta)
        
    transcript_text, has_native_sub, avail_options = fetch_youtube_transcript(video_id)
    
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
        "has_native_transcript": has_native_sub,
        "available_transcripts": avail_options
    }

