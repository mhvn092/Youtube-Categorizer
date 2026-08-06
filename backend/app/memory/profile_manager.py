from typing import Dict, Any, Optional
from app.db.models import get_user_profile, save_user_profile, record_feedback, get_video_by_id
from app.llm.client import update_profile_with_feedback

def get_current_user_profile() -> Dict[str, Any]:
    return get_user_profile()

def update_user_profile_data(new_profile_data: Dict[str, Any]) -> Dict[str, Any]:
    save_user_profile(new_profile_data)
    return get_user_profile()

async def process_user_feedback(video_id: str, action: str, reason: Optional[str]) -> Dict[str, Any]:
    # Record feedback log
    record_feedback(video_id, action, reason)
    
    video = get_video_by_id(video_id)
    video_title = video.get("title", "Video") if video else "Video"
    
    current_profile = get_user_profile()
    
    # If user provided a reason (e.g. "I already know this basic React stuff"), ask LLM to synthesize new rules
    if reason:
        updated_profile = await update_profile_with_feedback(video_title, action, reason, current_profile)
        save_user_profile(updated_profile)
        return updated_profile
    else:
        # Simple rule update if no explicit text reason given
        if action == "skip":
            avoid_list = current_profile.get("avoid_topics", [])
            if video and video.get("category") and video.get("category") not in avoid_list:
                avoid_list.append(f"Low-value {video.get('category')} videos")
                current_profile["avoid_topics"] = avoid_list
                save_user_profile(current_profile)
        return current_profile
