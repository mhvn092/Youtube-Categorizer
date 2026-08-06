from fastapi import APIRouter, HTTPException, BackgroundTasks
from typing import List, Optional
from app.db.models import (
    VideoIngestRequest, get_all_videos, get_video_by_id, 
    save_video, update_video_status, get_user_profile
)
from app.extractors.youtube import get_video_info_and_transcript, extract_video_id
from app.extractors.audio import transcribe_audio_with_whisper
from app.llm.client import analyze_video_with_ollama

router = APIRouter(prefix="/api/videos", tags=["Videos"])

async def process_single_video_pipeline(url_or_id: str) -> dict:
    # 1. Fetch metadata and transcript
    info = get_video_info_and_transcript(url_or_id)
    
    # 2. If missing native transcript, try faster-whisper fallback
    if not info.get("transcript"):
        whisper_text = transcribe_audio_with_whisper(info["url"])
        if whisper_text:
            info["transcript"] = whisper_text
            
    # 3. Get user knowledge profile for LLM context
    profile = get_user_profile()
    
    # 4. Analyze video with Ollama (Gemma 14b)
    analysis = await analyze_video_with_ollama(info, profile)
    
    # 5. Save into DB
    video_record = {
        "id": info["id"],
        "url": info["url"],
        "title": info["title"],
        "channel": info["channel"],
        "duration": info["duration"],
        "runtime_str": info["runtime_str"],
        "thumbnail": info["thumbnail"],
        "transcript": info.get("transcript", ""),
        "category": analysis.get("category", "Uncategorized"),
        "summary": analysis.get("one_line_summary", ""),
        "priority": analysis.get("priority", "mid"),
        "what_it_gains": analysis.get("what_it_gains_me", ""),
        "why_skip": analysis.get("why_should_i_skip_it", "none"),
        "takeaways": analysis.get("main_takeaways", []),
        "status": "pending"
    }
    
    save_video(video_record)
    return video_record

@router.get("", response_model=List[dict])
def list_videos():
    return get_all_videos()

@router.get("/{video_id}", response_model=dict)
def get_video(video_id: str):
    v = get_video_by_id(video_id)
    if not v:
        raise HTTPException(status_code=404, detail="Video not found")
    return v

@router.post("/ingest")
async def ingest_video(req: VideoIngestRequest):
    video_id = extract_video_id(req.url_or_id)
    if not video_id:
        raise HTTPException(status_code=400, detail="Invalid YouTube URL or Video ID")
    try:
        res = await process_single_video_pipeline(req.url_or_id)
        return {"status": "success", "video": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process video: {str(e)}")

@router.patch("/{video_id}/status")
def change_video_status(video_id: str, payload: dict):
    new_status = payload.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Missing status field")
    update_video_status(video_id, new_status)
    return {"status": "updated", "video_id": video_id, "new_status": new_status}
