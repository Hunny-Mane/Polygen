"""
backend/routers/stats.py
In-memory + JSON-persisted stats tracking for detection and generation events.
"""

import json
import os
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from pydantic import BaseModel

router = APIRouter()

STATS_FILE = os.path.join(os.path.dirname(__file__), "..", "..", "database", "stats.json")

_DEFAULT_STATS = {
    "detection": {
        "images": {"total": 0, "real": 0, "fake": 0},
        "videos": {"total": 0, "real": 0, "fake": 0},
    },
    "generation": {
        "images": {"total": 0},
        "videos": {"total": 0},
    },
}


def _load_stats() -> dict:
    if os.path.exists(STATS_FILE):
        try:
            with open(STATS_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass
    return json.loads(json.dumps(_DEFAULT_STATS))  # deep copy


def _save_stats(stats: dict):
    os.makedirs(os.path.dirname(STATS_FILE), exist_ok=True)
    with open(STATS_FILE, "w") as f:
        json.dump(stats, f, indent=2)


# In-memory cache (loaded once on startup)
_stats: dict = _load_stats()


class IncrementPayload(BaseModel):
    module: str   # "detection" | "generation"
    media_type: str  # "image" | "video"
    label: str = ""  # "real" | "fake" | "" (for generation)


@router.get("/stats")
async def get_stats():
    return _stats


@router.post("/stats/increment")
async def increment_stat(payload: IncrementPayload):
    global _stats
    module = payload.module.lower()
    media_type = payload.media_type.lower()
    label = payload.label.lower()

    key = "images" if media_type == "image" else "videos"

    if module == "detection":
        if key in _stats["detection"]:
            _stats["detection"][key]["total"] += 1
            if label in ("real", "fake"):
                _stats["detection"][key][label] += 1

    elif module == "generation":
        if key in _stats["generation"]:
            _stats["generation"][key]["total"] += 1

    _save_stats(_stats)
    return {"status": "ok", "stats": _stats}
