"""
Test: Fix 429 on timedtext URLs by passing cookies + adding delay.
"""
import sys, os, re, json, time, hashlib
sys.path.insert(0, os.path.dirname(__file__))

from app.config import BASE_DIR, settings
from app.db.database import init_db, load_settings_into_config
import http.cookiejar
import requests

init_db()
load_settings_into_config()

VIDEO_ID = "ak6rI-j07QU"
ORIGIN = "https://www.youtube.com"

def load_cookies():
    cookie_path = os.path.join(BASE_DIR, "cookies.txt")
    if not os.path.exists(cookie_path):
        cookie_path = "cookies.txt"
    cj = http.cookiejar.MozillaCookieJar(cookie_path)
    cj.load(ignore_discard=True, ignore_expires=True)
    cookies_dict = {}
    for cookie in cj:
        cookies_dict[cookie.name] = cookie.value
    return cookies_dict, cj

def generate_sapisidhash(sapisid, origin=ORIGIN):
    timestamp = str(int(time.time()))
    hash_input = f"{timestamp} {sapisid} {origin}"
    hash_value = hashlib.sha1(hash_input.encode('utf-8')).hexdigest()
    return f"SAPISIDHASH {timestamp}_{hash_value}"

def _parse_json3(data):
    texts = []
    for ev in data.get('events', []):
        for seg in ev.get('segs', []):
            utf8 = seg.get('utf8', '')
            if utf8:
                texts.append(utf8)
    return re.sub(r'\s+', ' ', " ".join(texts)).strip()

def _parse_xml(xml_text):
    import xml.etree.ElementTree as ET
    try:
        root = ET.fromstring(xml_text)
        texts = [elem.text for elem in root.findall('.//text') if elem.text]
        return re.sub(r'\s+', ' ', " ".join(texts)).strip()
    except:
        return ""


def test_with_auth_subtitle_fetch(video_id):
    print(f"\n{'='*60}")
    print(f"Testing for: {video_id}")
    print(f"{'='*60}")

    cookies_dict, cj = load_cookies()
    sapisid = cookies_dict.get("SAPISID")
    if not sapisid:
        print("ERROR: No SAPISID cookie!")
        return

    sapisidhash = generate_sapisidhash(sapisid)

    session = requests.Session()
    session.cookies = cj
    session.headers.update({
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
    })

    # Step 1: Get caption tracks from /player
    print(f"\nStep 1: Getting caption tracks from /player...")
    headers = {
        "Content-Type": "application/json",
        "Authorization": sapisidhash,
        "X-Origin": ORIGIN,
        "Origin": ORIGIN,
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
    
    res = session.post("https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
                       json=payload, headers=headers, timeout=15)
    print(f"  Status: {res.status_code}")
    
    if res.status_code != 200:
        print(f"  Error: {res.text[:300]}")
        return
    
    data = res.json()
    playability = data.get("playabilityStatus", {})
    print(f"  Playability: {playability.get('status')}")
    
    tracks = (data.get("captions", {})
              .get("playerCaptionsTracklistRenderer", {})
              .get("captionTracks", []))
    print(f"  Caption tracks: {len(tracks)}")
    
    if not tracks:
        return
    
    # Step 2: Fetch subtitle text from baseUrl WITH cookies and proper headers
    print(f"\nStep 2: Fetching subtitle text (with cookies, delays)...")
    
    for i, track in enumerate(tracks):
        lang = track.get("languageCode", "?")
        kind = track.get("kind", "manual")
        base_url = track.get("baseUrl", "")
        name_obj = track.get("name", {})
        name = name_obj.get("simpleText", lang) if isinstance(name_obj, dict) else str(name_obj)
        
        print(f"\n  Track {i+1}: {name} ({kind})")
        
        if not base_url:
            print("    No baseUrl!")
            continue
        
        # Small delay to avoid 429
        time.sleep(1.5)
        
        # Try different formats with full auth
        for fmt_name, fmt_param in [("json3", "&fmt=json3"), ("srv1", "&fmt=srv1"), ("xml", "")]:
            fetch_url = f"{base_url}{fmt_param}"
            
            # Use cookies + referer in the subtitle fetch
            sub_headers = {
                "Referer": f"https://www.youtube.com/watch?v={video_id}",
                "Accept": "*/*",
            }
            
            sub_res = session.get(fetch_url, headers=sub_headers, timeout=10)
            print(f"    {fmt_name}: HTTP {sub_res.status_code} ({len(sub_res.content)} bytes)")
            
            if sub_res.status_code == 200 and sub_res.text.strip():
                if fmt_name == "json3":
                    try:
                        text = _parse_json3(sub_res.json())
                    except:
                        text = ""
                elif fmt_name == "xml" or fmt_name == "srv1":
                    text = _parse_xml(sub_res.text)
                else:
                    text = ""
                
                if text:
                    print(f"    SUCCESS! Words: {len(text.split())}")
                    print(f"    Preview: {text[:200]}...")
                    break  # Got text, skip other formats
            elif sub_res.status_code == 429:
                print(f"    Rate limited, waiting 3s...")
                time.sleep(3)
                # Retry once
                sub_res2 = session.get(fetch_url, headers=sub_headers, timeout=10)
                print(f"    Retry {fmt_name}: HTTP {sub_res2.status_code}")
                if sub_res2.status_code == 200 and sub_res2.text.strip():
                    if fmt_name == "json3":
                        try:
                            text = _parse_json3(sub_res2.json())
                        except:
                            text = ""
                    else:
                        text = _parse_xml(sub_res2.text)
                    if text:
                        print(f"    SUCCESS on retry! Words: {len(text.split())}")
                        print(f"    Preview: {text[:200]}...")
                        break


if __name__ == "__main__":
    test_with_auth_subtitle_fetch(VIDEO_ID)
    print("\n\n")
    test_with_auth_subtitle_fetch("dQw4w9WgXcQ")
