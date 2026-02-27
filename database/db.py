"""
database/db.py
SQLite database for PolyGen — stores detected fake images and generated media metadata.
Physical files go to:
  - database/detection_storage/  (fake detections)
  - database/generation_storage/ (generated images/videos)
"""

import sqlite3
import os
import shutil
import base64
from datetime import datetime

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "polygen.db")
DETECTION_STORAGE = os.path.join(BASE_DIR, "detection_storage")
GENERATION_STORAGE = os.path.join(BASE_DIR, "generation_storage")

# Ensure folders exist
os.makedirs(DETECTION_STORAGE, exist_ok=True)
os.makedirs(GENERATION_STORAGE, exist_ok=True)


# ── DB Init ──────────────────────────────────────────────────────────────────
def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_connection()
    cur = conn.cursor()
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS fake_detections (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            filename      TEXT NOT NULL,
            file_path     TEXT NOT NULL,
            fake_prob     REAL NOT NULL,
            confidence    REAL NOT NULL,
            media_type    TEXT NOT NULL DEFAULT 'image',
            timestamp     TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS generated_media (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            filename      TEXT NOT NULL,
            file_path     TEXT NOT NULL,
            prompt        TEXT DEFAULT '',
            media_type    TEXT NOT NULL DEFAULT 'image',
            timestamp     TEXT NOT NULL
        );
    """)
    conn.commit()
    conn.close()


# ── Detection Storage ─────────────────────────────────────────────────────────
def save_detection(image_bytes: bytes, fake_prob: float, confidence: float,
                   media_type: str = "image", ext: str = ".jpg") -> dict:
    """
    Save a detected fake image/frame to detection_storage and record metadata.
    Returns the new DB row as a dict.
    """
    ts = datetime.now()
    filename = f"fake_{ts.strftime('%Y%m%d_%H%M%S_%f')}{ext}"
    file_path = os.path.join(DETECTION_STORAGE, filename)

    with open(file_path, "wb") as f:
        f.write(image_bytes)

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO fake_detections (filename, file_path, fake_prob, confidence, media_type, timestamp) "
        "VALUES (?, ?, ?, ?, ?, ?)",
        (filename, file_path, fake_prob, confidence, media_type, ts.isoformat())
    )
    conn.commit()
    row_id = cur.lastrowid
    conn.close()

    return {
        "id": row_id,
        "filename": filename,
        "file_path": file_path,
        "fake_prob": fake_prob,
        "confidence": confidence,
        "media_type": media_type,
        "timestamp": ts.isoformat()
    }


def get_all_detections() -> list:
    """Return all fake detection records, newest first, with base64 image data."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM fake_detections ORDER BY id DESC")
    rows = cur.fetchall()
    conn.close()

    results = []
    for row in rows:
        rec = dict(row)
        # Embed base64 for easy frontend display
        try:
            with open(rec["file_path"], "rb") as f:
                rec["image_b64"] = base64.b64encode(f.read()).decode("utf-8")
        except Exception:
            rec["image_b64"] = ""
        results.append(rec)
    return results


def get_detection_count() -> dict:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) as total FROM fake_detections")
    total = cur.fetchone()["total"]
    cur.execute("SELECT COUNT(*) as img FROM fake_detections WHERE media_type='image'")
    images = cur.fetchone()["img"]
    cur.execute("SELECT COUNT(*) as vid FROM fake_detections WHERE media_type='video'")
    videos = cur.fetchone()["vid"]
    conn.close()
    return {"total": total, "images": images, "videos": videos}


# ── Generation Storage ────────────────────────────────────────────────────────
def save_generated(image_bytes: bytes, prompt: str = "",
                   media_type: str = "image", ext: str = ".png") -> dict:
    """
    Save a generated image/video to generation_storage and record metadata.
    """
    ts = datetime.now()
    filename = f"gen_{ts.strftime('%Y%m%d_%H%M%S_%f')}{ext}"
    file_path = os.path.join(GENERATION_STORAGE, filename)

    with open(file_path, "wb") as f:
        f.write(image_bytes)

    conn = get_connection()
    cur = conn.cursor()
    cur.execute(
        "INSERT INTO generated_media (filename, file_path, prompt, media_type, timestamp) "
        "VALUES (?, ?, ?, ?, ?)",
        (filename, file_path, prompt[:500], media_type, ts.isoformat())
    )
    conn.commit()
    row_id = cur.lastrowid
    conn.close()

    return {
        "id": row_id,
        "filename": filename,
        "file_path": file_path,
        "prompt": prompt,
        "media_type": media_type,
        "timestamp": ts.isoformat()
    }


def get_all_generated() -> list:
    """Return all generated media records, newest first, with base64 data for images."""
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT * FROM generated_media ORDER BY id DESC")
    rows = cur.fetchall()
    conn.close()

    results = []
    for row in rows:
        rec = dict(row)
        if rec["media_type"] == "image":
            try:
                with open(rec["file_path"], "rb") as f:
                    rec["image_b64"] = base64.b64encode(f.read()).decode("utf-8")
            except Exception:
                rec["image_b64"] = ""
        else:
            rec["image_b64"] = ""
        results.append(rec)
    return results


def get_generation_count() -> dict:
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) as total FROM generated_media")
    total = cur.fetchone()["total"]
    cur.execute("SELECT COUNT(*) as img FROM generated_media WHERE media_type='image'")
    images = cur.fetchone()["img"]
    cur.execute("SELECT COUNT(*) as vid FROM generated_media WHERE media_type='video'")
    videos = cur.fetchone()["vid"]
    conn.close()
    return {"total": total, "images": images, "videos": videos}


# Initialise immediately on import
init_db()
