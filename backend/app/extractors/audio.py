import os
import tempfile
from pathlib import Path
from typing import Optional
import yt_dlp
from app.config import settings

LOCAL_WHISPER_MODEL = r"D:\Faster Whisper\bin\_models\faster-whisper-large-v3-turbo"
LOCAL_FFMPEG_DIR = r"D:\Faster Whisper\bin"

def transcribe_audio_with_whisper(video_url: str) -> Optional[str]:
    """
    Downloads temporary low-bitrate audio with yt-dlp and transcribes using faster-whisper.
    Automatically uses local D:\\Faster Whisper model and ffmpeg binaries.
    """
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        print("faster-whisper package not installed or model unavailable.")
        return None

    temp_dir = tempfile.mkdtemp()
    audio_path = os.path.join(temp_dir, "audio.mp3")

    ydl_opts = {
        'format': 'm4a/bestaudio/best',
        'outtmpl': os.path.join(temp_dir, 'audio.%(ext)s'),
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '96',
        }],
        'quiet': True,
        'extractor_args': {'youtube': {'player_client': ['mweb', 'android', 'ios']}},
        'nocheckcertificate': True
    }

    if os.path.exists(LOCAL_FFMPEG_DIR):
        ydl_opts['ffmpeg_location'] = LOCAL_FFMPEG_DIR

    if settings.YOUTUBE_OAUTH_TOKEN:
        ydl_opts['http_headers'] = {'Authorization': f'Bearer {settings.YOUTUBE_OAUTH_TOKEN}'}

    try:
        print(f"Downloading audio for Whisper fallback: {video_url}", flush=True)
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])

        if not os.path.exists(audio_path):
            # Find whatever audio file yt-dlp generated
            files = list(Path(temp_dir).glob("audio.*"))
            if files:
                audio_path = str(files[0])
            else:
                return None

        model_target = LOCAL_WHISPER_MODEL if os.path.exists(LOCAL_WHISPER_MODEL) else settings.WHISPER_MODEL_SIZE
        print(f"Transcribing audio with faster-whisper local model ({model_target})...", flush=True)
        
        model = WhisperModel(model_target, device="cpu", compute_type="int8")
        segments, info = model.transcribe(audio_path, beam_size=5)

        full_text = " ".join([segment.text for segment in segments]).strip()
        
        # Cleanup
        try:
            os.remove(audio_path)
            os.rmdir(temp_dir)
        except Exception:
            pass

        return full_text
    except Exception as e:
        print(f"Faster-whisper fallback transcription failed: {e}", flush=True)
        return None
