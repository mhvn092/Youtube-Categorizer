from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.db.database import init_db
from app.api import videos, subscriptions, profile, playlists

app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.VERSION
)

# Enable CORS for Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()
    print("Database initialized successfully.")

@app.get("/")
def root():
    return {
        "message": "YouTube Video Categorizer API is running",
        "version": settings.VERSION,
        "docs": "/docs"
    }

app.include_router(videos.router)
app.include_router(subscriptions.router)
app.include_router(profile.router)
app.include_router(playlists.router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
