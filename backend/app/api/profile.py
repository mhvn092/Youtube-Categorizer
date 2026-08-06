from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional
from app.db.models import FeedbackRequest, UserProfileUpdate, ApiKeyRequest, update_video_status
from app.memory.profile_manager import get_current_user_profile, update_user_profile_data, process_user_feedback
from app.llm.client import check_ollama_status
from app.config import settings

router = APIRouter(prefix="/api/profile", tags=["Profile & System"])

@router.get("", response_model=Dict[str, Any])
def read_profile():
    return get_current_user_profile()

@router.put("", response_model=Dict[str, Any])
def update_profile(data: UserProfileUpdate):
    curr = get_current_user_profile()
    if data.known_topics is not None:
        curr["known_topics"] = data.known_topics
    if data.interests is not None:
        curr["interests"] = data.interests
    if data.avoid_topics is not None:
        curr["avoid_topics"] = data.avoid_topics
    if data.guidance_notes is not None:
        curr["guidance_notes"] = data.guidance_notes
    return update_user_profile_data(curr)

@router.post("/feedback")
async def handle_feedback(req: FeedbackRequest):
    # Update video status if skipped
    if req.action == "skip":
        update_video_status(req.video_id, "skipped")
    elif req.action == "watched":
        update_video_status(req.video_id, "watched")
        
    updated_profile = await process_user_feedback(req.video_id, req.action, req.reason)
    return {"status": "success", "profile": updated_profile}

@router.get("/status")
async def get_system_status():
    ollama_info = await check_ollama_status()
    return {
        "ollama": ollama_info,
        "current_model": settings.OLLAMA_MODEL,
        "youtube_api_key_configured": bool(settings.YOUTUBE_API_KEY)
    }

@router.post("/youtube-key")
def set_youtube_key(payload: ApiKeyRequest):
    settings.YOUTUBE_API_KEY = payload.api_key.strip()
    return {"status": "success", "youtube_api_key_configured": bool(settings.YOUTUBE_API_KEY)}
