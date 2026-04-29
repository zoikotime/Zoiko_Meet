import asyncio
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.config import get_settings
from app.core.database import init_db
from app.core.middleware import RateLimitMiddleware, SecurityHeadersMiddleware
from app.core.recording_cleanup import recording_cleanup_loop
from app.api import auth, users, chat, meetings, recordings, organizations, notifications, invites, dashboard, ai, admin, calls
from app.websocket import chat as chat_ws, signaling as meeting_ws
from app.connect import router as connect_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    cleanup_task = asyncio.create_task(recording_cleanup_loop())
    try:
        yield
    finally:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Zoiko sema API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware, max_requests=10, window=60)


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(auth.router)
app.include_router(users.router)
app.include_router(chat.router)
app.include_router(meetings.router)
app.include_router(recordings.router)
app.include_router(organizations.router)
app.include_router(notifications.router)
app.include_router(invites.router)
app.include_router(dashboard.router)
app.include_router(ai.router)
app.include_router(admin.router)
app.include_router(calls.router)
app.include_router(chat_ws.router)
app.include_router(meeting_ws.router)

# Zoiko Connect v3 — new bounded services mounted alongside legacy routers.
# Strangler-fig: legacy paths keep working; new features consume /api/connect/*.
app.include_router(connect_router)

# Serve uploaded files
_upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(_upload_dir, exist_ok=True)
app.mount("/api/uploads", StaticFiles(directory=_upload_dir), name="uploads")

# Serve recording files
_rec_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "recordings")
os.makedirs(_rec_dir, exist_ok=True)
app.mount("/api/recordings/files", StaticFiles(directory=_rec_dir), name="recordings")
