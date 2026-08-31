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
    # 1. Fetch metadata and text transcript (Executes Tiers 1-4)
    info = get_video_info_and_transcript(url_or_id)
    
    # 2. If missing text transcript from Tiers 1-4, try Tier 5 (Faster-Whisper audio fallback)
    if not info.get("transcript"):
        print(f"[Transcript] No text transcript found via Tiers 1-4 for {info['id']}. Attempting Tier 5 (Faster-Whisper local audio fallback)...", flush=True)
        whisper_text = transcribe_audio_with_whisper(info["url"])
        if whisper_text:
            info["transcript"] = whisper_text
            print(f"[Transcript] Successfully generated transcript via Tier 5 (Faster-Whisper) for {info['id']}", flush=True)
        else:
            print(f"[Transcript Warning] All 5 transcript extraction tiers failed for {info['id']}. Proceeding with available metadata.", flush=True)
            
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
        "available_transcripts": info.get("available_transcripts", []),
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

@router.post("/{video_id}/reanalyze-transcript")
async def reanalyze_video_with_selected_transcript(video_id: str, payload: dict):
    v = get_video_by_id(video_id)
    if not v:
        raise HTTPException(status_code=404, detail="Video not found")
    
    selected_text = payload.get("transcript")
    if not selected_text:
        raise HTTPException(status_code=400, detail="Missing transcript text in payload")
    
    v["transcript"] = selected_text
    profile = get_user_profile()
    analysis = await analyze_video_with_ollama(v, profile)
    
    v["category"] = analysis.get("category", v.get("category", "Uncategorized"))
    v["summary"] = analysis.get("one_line_summary", v.get("summary", ""))
    v["priority"] = analysis.get("priority", v.get("priority", "mid"))
    v["what_it_gains"] = analysis.get("what_it_gains_me", v.get("what_it_gains", ""))
    v["why_skip"] = analysis.get("why_should_i_skip_it", v.get("why_skip", "none"))
    v["takeaways"] = analysis.get("main_takeaways", v.get("takeaways", []))
    
    save_video(v)
    return {"status": "success", "video": v}

@router.patch("/{video_id}/status")
def change_video_status(video_id: str, payload: dict):
    new_status = payload.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Missing status field")
    update_video_status(video_id, new_status)
    return {"status": "updated", "video_id": video_id, "new_status": new_status}

@router.post("/{video_id}/retry")
async def retry_single_video(video_id: str):
    v = get_video_by_id(video_id)
    if not v:
        raise HTTPException(status_code=404, detail="Video not found")
    try:
        updated = await process_single_video_pipeline(v.get("url") or video_id)
        return {"status": "success", "video": updated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to retry video: {str(e)}")

@router.post("/retry-placeholders")
async def retry_all_placeholders():
    all_vids = get_all_videos()
    placeholders = [
        v for v in all_vids 
        if v.get("title") == "YouTube Video" 
        or v.get("channel") == "Channel"
        or (v.get("title") or "").startswith("Video ")
        or "placeholder" in (v.get("summary") or "").lower()
        or "no actual video content" in (v.get("summary") or "").lower()
    ]
    reprocessed = []
    errors = []
    for v in placeholders:
        try:
            res = await process_single_video_pipeline(v.get("url") or v.get("id"))
            reprocessed.append(res)
        except Exception as e:
            errors.append({"id": v.get("id"), "error": str(e)})
            
    return {"status": "success", "reprocessed_count": len(reprocessed), "errors": errors}
