# 📺 YouTube Backlog & Subscription Triage Assistant

An AI-powered web application designed to conquer YouTube video backlog overload and triage subscription feeds. Driven by **Ollama (`gemma:12b`)**, **faster-whisper** audio fallback, and an **adaptive user knowledge memory engine**, the app categorizes videos, extracts actionable key takeaways, and helps you skip low-value fluff without spending hours watching videos.

---

## ✨ Key Features

- **📑 Playlists Hub & Dedicated Playlist Pages**:
  - Automatically fetches all your public, private, and unlisted YouTube playlists.
  - Dedicated per-playlist pages with scoped triage recommendations.
  - **Batch Video Cleanup UI**: Select videos (or click *"Select All Recommended Skips"*) to delete items directly from your YouTube playlists.

- **🤖 1-Click YouTube Account Auto-Sync**:
  - Automatically imports all your account playlists, playlist items, and subscribed channel RSS feeds in one click.

- **📡 Subscriptions Feed & AI Recommendations Matrix**:
  - Automatically checks recent uploads from your subscribed channels.
  - Generates priority ratings (*High, Mid, Low, Life Changing, Skip*), 1-line executive summaries, and *Why Skip* alerts.
  - **Unsubscribe Advisor**: Highlights channels that consistently produce low-value fluff.

- **🧠 Adaptive AI Memory Profile (Continuous Learning)**:
  - Dynamic user profile tracking *Known Topics*, *High-Value Interests*, and *Avoid Topics*.
  - When you skip a video with feedback (e.g., *"I already know basic state management"*), Ollama learns your skills and refines future recommendations.

- **📝 Main Takeaways Reader**:
  - Expandable drawer/modal displaying bulleted key learnings so you get the main takeaways without watching the full video.

---

## 🛠 Tech Stack

- **Backend**: Python 3.12, FastAPI, SQLite, `yt-dlp`, `youtube-transcript-api`, `faster-whisper`, `httpx`, `feedparser`.
- **AI Core**: Ollama (`gemma:12b` default).
- **Frontend**: React 18, Vite, Lucide Icons, Glassmorphism Dark Theme CSS.

---

## 🚀 Quickstart Setup

### Prerequisites
1. **Ollama**: Ensure [Ollama](https://ollama.com/) is installed and running with `gemma:12b`:
   ```bash
   ollama run gemma:12b
   ```
2. **Python**: Python 3.10+ installed.
3. **Node.js**: Node 18+ and npm installed.

---

### 1. Backend Setup
In the project root directory:

```powershell
# Create Python virtual environment
python -m venv backend\venv

# Install requirements
.\backend\venv\Scripts\pip install -r backend\requirements.txt

# Start FastAPI backend server
.\backend\venv\Scripts\python -m uvicorn app.main:app --reload --app-dir backend
```
> Backend runs at `http://localhost:8000` (API documentation at `http://localhost:8000/docs`).

---

### 2. Frontend Setup
In a separate terminal:

```powershell
cd frontend
npm install
npm run dev
```
> Web Application dashboard runs at `http://localhost:5173`.

---

## 🔑 YouTube API & OAuth Setup

The app works out-of-the-box using `yt-dlp` and `youtube-transcript-api` without needing any API keys. 

To fetch private/unlisted playlists and delete items directly from YouTube:
1. Open the web app at `http://localhost:5173` and click **YouTube API** in the top navigation bar.
2. Generate a 30-second OAuth Access Token via [Google OAuth Playground](https://developers.google.com/oauthplayground):
   - Select scope `https://www.googleapis.com/auth/youtube`.
   - Click **Authorize APIs** -> **Exchange authorization code for tokens**.
3. Paste the **Access Token** (`ya29...`) and click **Save & Auto-Sync Account**.

---

## 📁 Project Structure

```
youtube-video-categorizer/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI entrypoint
│   │   ├── config.py                # Configuration & settings
│   │   ├── extractors/              # YouTube metadata, transcript, & RSS fetchers
│   │   │   ├── youtube.py
│   │   │   ├── rss.py
│   │   │   └── audio.py             # faster-whisper fallback
│   │   ├── llm/                     # Ollama client & triage prompts
│   │   │   ├── client.py
│   │   │   └── prompts.py
│   │   ├── memory/                  # User profile memory manager
│   │   │   └── profile_manager.py
│   │   ├── db/                      # SQLite schema & database models
│   │   │   ├── database.py
│   │   │   └── models.py
│   │   └── api/                     # REST API routers
│   │       ├── videos.py
│   │       ├── playlists.py
│   │       ├── subscriptions.py
│   │       └── profile.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/              # UI components (Navbar, TriageTable, PlaylistsView, etc.)
│   │   ├── App.jsx
│   │   ├── index.css                # Glassmorphism design system
│   │   └── main.jsx
│   ├── package.json
│   └── vite.config.js
├── .gitignore
└── README.md
```

---

## 📄 License
MIT License.
