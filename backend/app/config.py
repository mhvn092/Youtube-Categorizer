import os
from pathlib import Path
from pydantic import BaseModel

BASE_DIR = Path(__file__).resolve().parent.parent

class Settings(BaseModel):
    APP_TITLE: str = "YouTube Video Categorizer API"
    VERSION: str = "1.0.0"
    
    # LLM Settings
    OLLAMA_BASE_URL: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    OLLAMA_MODEL: str = os.getenv("OLLAMA_MODEL", "gemma:12b")
    
    # YouTube API (Optional)
    YOUTUBE_API_KEY: str = os.getenv("YOUTUBE_API_KEY", "")
    YOUTUBE_OAUTH_TOKEN: str = os.getenv("YOUTUBE_OAUTH_TOKEN", "")
    
    # Audio Transcription Settings
    WHISPER_MODEL_SIZE: str = os.getenv("WHISPER_MODEL_SIZE", "base")
    
    # Database
    DB_PATH: Path = BASE_DIR / "data" / "categorizer.db"
    
    class Config:
        env_file = ".env"

settings = Settings()
