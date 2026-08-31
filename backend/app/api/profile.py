from fastapi import APIRouter, HTTPException
from typing import Dict, Any, Optional
from app.db.models import (
    FeedbackRequest, UserProfileUpdate, ApiKeyRequest,
    YouTubeCredentialsRequest, update_video_status
)
from app.db.database import get_setting, set_setting, refresh_youtube_oauth_token, get_valid_youtube_access_token
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
    refresh_token = get_setting("youtube_refresh_token", "")
    expires_at_str = get_setting("youtube_token_expires_at", "0")
    try:
        expires_at = float(expires_at_str)
    except Exception:
        expires_at = 0

    return {
        "ollama": ollama_info,
        "current_model": settings.OLLAMA_MODEL,
        "youtube_api_key_configured": bool(settings.YOUTUBE_API_KEY),
        "youtube_oauth_token_configured": bool(settings.YOUTUBE_OAUTH_TOKEN),
        "youtube_has_refresh_token": bool(refresh_token),
        "youtube_token_expires_at": expires_at,
        "youtube_channel_handle": get_setting("youtube_channel_handle", "")
    }

@router.get("/youtube-credentials")
def get_youtube_credentials():
    api_key = get_setting("youtube_api_key", settings.YOUTUBE_API_KEY)
    access_token = get_setting("youtube_oauth_token", settings.YOUTUBE_OAUTH_TOKEN)
    refresh_token = get_setting("youtube_refresh_token", "")
    client_id = get_setting("youtube_client_id", "")
    client_secret = get_setting("youtube_client_secret", "")
    channel_handle = get_setting("youtube_channel_handle", "")
    expires_at_str = get_setting("youtube_token_expires_at", "0")
    try:
        expires_at = float(expires_at_str)
    except Exception:
        expires_at = 0

    return {
        "api_key": api_key,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "client_id": client_id,
        "client_secret": client_secret,
        "channel_handle": channel_handle,
        "has_api_key": bool(api_key),
        "has_oauth_token": bool(access_token),
        "has_refresh_token": bool(refresh_token),
        "token_expires_at": expires_at
    }

@router.post("/youtube-credentials")
def save_youtube_credentials(payload: YouTubeCredentialsRequest):
    if payload.api_key is not None:
        key_val = payload.api_key.strip()
        set_setting("youtube_api_key", key_val)
        settings.YOUTUBE_API_KEY = key_val

    if payload.access_token is not None:
        token_val = payload.access_token.strip()
        set_setting("youtube_oauth_token", token_val)
        settings.YOUTUBE_OAUTH_TOKEN = token_val

    if payload.refresh_token is not None:
        ref_val = payload.refresh_token.strip()
        set_setting("youtube_refresh_token", ref_val)

    if payload.client_id is not None:
        cid_val = payload.client_id.strip()
        set_setting("youtube_client_id", cid_val)

    if payload.client_secret is not None:
        sec_val = payload.client_secret.strip()
        set_setting("youtube_client_secret", sec_val)

    if payload.channel_handle is not None:
        handle_val = payload.channel_handle.strip()
        set_setting("youtube_channel_handle", handle_val)

    # If refresh token was supplied, attempt an immediate renewal test
    refresh_msg = None
    if payload.refresh_token and payload.refresh_token.strip():
        success, msg, new_tok = refresh_youtube_oauth_token()
        if success:
            refresh_msg = msg

    return {
        "status": "success",
        "message": refresh_msg or "YouTube credentials saved successfully",
        "has_api_key": bool(settings.YOUTUBE_API_KEY),
        "has_oauth_token": bool(settings.YOUTUBE_OAUTH_TOKEN),
        "has_refresh_token": bool(get_setting("youtube_refresh_token")),
        "api_key": settings.YOUTUBE_API_KEY,
        "access_token": settings.YOUTUBE_OAUTH_TOKEN,
        "refresh_token": get_setting("youtube_refresh_token", ""),
        "client_id": get_setting("youtube_client_id", ""),
        "client_secret": get_setting("youtube_client_secret", ""),
        "channel_handle": get_setting("youtube_channel_handle", "")
    }

@router.post("/youtube-credentials/renew-token")
def renew_oauth_token():
    success, message, new_token = refresh_youtube_oauth_token()
    if not success:
        raise HTTPException(status_code=400, detail=message)
    return {
        "status": "success",
        "message": message,
        "access_token": new_token,
        "token_expires_at": float(get_setting("youtube_token_expires_at", "0"))
    }

@router.post("/youtube-key")
def set_youtube_key(payload: ApiKeyRequest):
    key_val = payload.api_key.strip()
    settings.YOUTUBE_API_KEY = key_val
    set_setting("youtube_api_key", key_val)
    return {"status": "success", "youtube_api_key_configured": bool(settings.YOUTUBE_API_KEY)}


