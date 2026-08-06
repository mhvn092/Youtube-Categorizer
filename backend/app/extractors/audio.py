import os
import tempfile
from pathlib import Path
from typing import Optional
import yt_dlp
from app.config import settings

def transcribe_audio_with_whisper(video_url: str) -> Optional[str]:
    """
    Downloads temporary low-bitrate audio with yt-dlp and transcribes using faster-whisper.
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
        'quiet': True
    }

    try:
        print(f"Downloading audio for Whisper fallback: {video_url}")
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.download([video_url])

        if not os.path.exists(audio_path):
            # Find whatever audio file yt-dlp generated
            files = list(Path(temp_dir).glob("audio.*"))
            if files:
                audio_path = str(files[0])
            else:
                return None

        print(f"Transcribing audio with faster-whisper ({settings.WHISPER_MODEL_SIZE})...")
        model = WhisperModel(settings.WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
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
        print(f"Faster-whisper fallback transcription failed: {e}")
        return None
