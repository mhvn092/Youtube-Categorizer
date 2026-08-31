import httpx
import json
import re
from typing import Dict, Any, Optional, List
from app.config import settings
from app.llm.prompts import (
    SYSTEM_TRIAGE_PROMPT, USER_TRIAGE_PROMPT,
    FEEDBACK_LEARNING_PROMPT, PLAYLIST_PROFILE_TRAINING_PROMPT
)

def clean_json_response(raw_text: str) -> Dict[str, Any]:
    """Cleans markdown syntax or extra output around JSON response"""
    raw_text = raw_text.strip()
    if "```json" in raw_text:
        raw_text = raw_text.split("```json")[1].split("```")[0].strip()
    elif "```" in raw_text:
        raw_text = raw_text.split("```")[1].split("```")[0].strip()
        
    # Find JSON object
    match = re.search(r'\{.*\}', raw_text, re.DOTALL)
    if match:
        raw_text = match.group(0)
        
    return json.loads(raw_text)

async def check_ollama_status() -> Dict[str, Any]:
    """Checks if Ollama service is reachable and lists available models"""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            res = await client.get(f"{settings.OLLAMA_BASE_URL}/api/tags")
            if res.status_code == 200:
                models_data = res.json()
                models = [m.get("name") for m in models_data.get("models", [])]
                return {"online": True, "models": models}
    except Exception as e:
        print(f"Ollama check failed: {e}")
    return {"online": False, "models": []}

async def analyze_video_with_ollama(video_meta: Dict[str, Any], user_profile: Dict[str, Any], model_override: Optional[str] = None) -> Dict[str, Any]:
    model_name = model_override or settings.OLLAMA_MODEL
    
    # Format system prompt with user profile
    known = ", ".join(user_profile.get("known_topics", []))
    interests = ", ".join(user_profile.get("interests", []))
    avoid = ", ".join(user_profile.get("avoid_topics", []))
    notes = user_profile.get("guidance_notes", "")
    
    system_prompt = SYSTEM_TRIAGE_PROMPT.format(
        known_topics=known,
        interests=interests,
        avoid_topics=avoid,
        guidance_notes=notes
    )
    
    # Truncate transcript to first ~12,000 characters if too long to fit prompt window cleanly
    transcript_sample = video_meta.get("transcript", "")
    if len(transcript_sample) > 12000:
        transcript_sample = transcript_sample[:12000] + "\n...[Transcript truncated for analysis]..."
        
    user_prompt = USER_TRIAGE_PROMPT.format(
        title=video_meta.get("title", ""),
        channel=video_meta.get("channel", ""),
        runtime_str=video_meta.get("runtime_str", ""),
        description=video_meta.get("description", "")[:500],
        transcript=transcript_sample if transcript_sample else "No transcript available. Analyze based on title and description."
    )
    
    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt}
        ],
        "stream": False,
        "format": "json",
        "options": {
            "temperature": 0.2
        }
    }
    
    try:
        async with httpx.AsyncClient(timeout=120.0) as client:
            res = await client.post(f"{settings.OLLAMA_BASE_URL}/api/chat", json=payload)
            if res.status_code == 200:
                data = res.json()
                content = data.get("message", {}).get("content", "")
                parsed = clean_json_response(content)
                return parsed
            else:
                print(f"Ollama API returned HTTP {res.status_code}: {res.text}")
    except BaseException as e:
        print(f"Error calling Ollama API: {e}")
        # Return sensible fallback if Ollama fails or isn't running
        return {
            "category": "Uncategorized",
            "one_line_summary": f"Video title: {video_meta.get('title')}",
            "priority": "mid",
            "what_it_gains_me": "Information from video title",
            "why_should_i_skip_it": "Ollama connection unavailable or model error",
            "main_takeaways": [
                f"Video title: {video_meta.get('title')}",
                f"Channel: {video_meta.get('channel')}",
                "Start Ollama with 'ollama run hf.co/bartowski/gemma-4-12B-it-GGUF:Q4_K_M' to analyze transcripts."
            ]
        }

async def update_profile_with_feedback(video_title: str, action: str, reason: str, current_profile: Dict[str, Any]) -> Dict[str, Any]:
    prompt = FEEDBACK_LEARNING_PROMPT.format(
        known_topics=", ".join(current_profile.get("known_topics", [])),
        interests=", ".join(current_profile.get("interests", [])),
        avoid_topics=", ".join(current_profile.get("avoid_topics", [])),
        title=video_title,
        action=action,
        reason=reason or "User skipped or marked video"
    )
    
    payload = {
        "model": settings.OLLAMA_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.3}
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            res = await client.post(f"{settings.OLLAMA_BASE_URL}/api/chat", json=payload)
            if res.status_code == 200:
                data = res.json()
                content = data.get("message", {}).get("content", "")
                return clean_json_response(content)
    except Exception as e:
        print(f"Error updating profile with LLM: {e}")
        
    return current_profile

async def train_profile_from_playlist_videos(videos_data: List[Dict[str, Any]], current_profile: Dict[str, Any]) -> Dict[str, Any]:
    """
    Analyzes a collection of user favorite/curated videos and extracts an in-depth
    Knowledge & Preference Profile (interests, art/cinema/tech themes, rules).
    """
    lines = []
    for idx, v in enumerate(videos_data[:30]):
        title = v.get("title", "")
        channel = v.get("channel", "")
        summary = v.get("summary") or v.get("description", "")[:200]
        category = v.get("category", "")
        lines.append(f"{idx+1}. \"{title}\" by {channel} (Category: {category}) - {summary}")
    
    videos_summary = "\n".join(lines) if lines else "No video details available."
    
    prompt = PLAYLIST_PROFILE_TRAINING_PROMPT.format(
        videos_summary=videos_summary,
        known_topics=", ".join(current_profile.get("known_topics", [])),
        interests=", ".join(current_profile.get("interests", [])),
        avoid_topics=", ".join(current_profile.get("avoid_topics", []))
    )
    
    payload = {
        "model": settings.OLLAMA_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
        "format": "json",
        "options": {"temperature": 0.3}
    }
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post(f"{settings.OLLAMA_BASE_URL}/api/chat", json=payload)
            if res.status_code == 200:
                data = res.json()
                content = data.get("message", {}).get("content", "")
                parsed = clean_json_response(content)
                if isinstance(parsed, dict) and "interests" in parsed:
                    # Merge any previous tags cleanly
                    return parsed
    except Exception as e:
        print(f"Error training profile from playlist videos with Ollama: {e}")
        
    return current_profile
