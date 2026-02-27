
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse, JSONResponse
import shutil
import os
import base64
import io
import sys
from ml_modules.generation.generator import ImageGenerator
from ml_modules.generation.video_processor import VideoProcessor

# Database import
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from database.db import save_generated, get_all_generated, get_generation_count

router = APIRouter()

img_gen = None
vid_proc = None


def get_img_gen():
    global img_gen
    if img_gen is None:
        try:
            provider = os.getenv("GENERATION_PROVIDER", "local")
            api_key = os.getenv("GOOGLE_API_KEY")
            img_gen = ImageGenerator(provider=provider, api_key=api_key)
        except Exception as e:
            print(f"Error loading img gen: {e}")
    return img_gen


def get_vid_proc():
    global vid_proc
    if vid_proc is None:
        vid_proc = VideoProcessor()
    return vid_proc


@router.post("/generate/image")
async def generate_image(prompt: str = Form(...)):
    gen = get_img_gen()
    if not gen:
        return JSONResponse(content={"error": "Generator not loaded"}, status_code=500)

    image = gen.generate(prompt)
    if not image:
        return JSONResponse(content={"error": "Generation failed"}, status_code=500)

    # Convert to base64
    buffered = io.BytesIO()
    image.save(buffered, format="PNG")
    img_bytes = buffered.getvalue()
    img_str = base64.b64encode(img_bytes).decode("utf-8")

    # ── Save to generation_storage ────────────────────────────────────────────
    try:
        save_generated(
            image_bytes=img_bytes,
            prompt=prompt,
            media_type="image",
            ext=".png"
        )
    except Exception as e:
        print(f"DB generation save error: {e}")

    return {"image": img_str}


@router.post("/filter/video")
async def filter_video(file: UploadFile = File(...), filter_type: str = Form(...)):
    temp_path = f"temp_upload_{file.filename}"
    output_filename = f"processed_{os.path.splitext(file.filename)[0]}.webm"
    output_path = os.path.join("frontend/assets", output_filename)

    # Ensure assets folder exists
    os.makedirs("frontend/assets", exist_ok=True)

    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    proc = get_vid_proc()
    try:
        proc.process_video(temp_path, output_path, filter_type=filter_type)
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    # ── Save copy to generation_storage ──────────────────────────────────────
    try:
        if os.path.exists(output_path):
            with open(output_path, "rb") as vf:
                video_bytes = vf.read()
            ext = os.path.splitext(output_filename)[1] or ".webm"
            save_generated(
                image_bytes=video_bytes,
                prompt=f"filter:{filter_type} on {file.filename}",
                media_type="video",
                ext=ext
            )
    except Exception as e:
        print(f"DB video generation save error: {e}")

    return {"video_url": f"/static/assets/{output_filename}"}


@router.get("/records")
async def get_generation_records():
    """Return all saved generated media from the database."""
    try:
        records = get_all_generated()
        return {"records": records, "count": len(records)}
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@router.get("/records/count")
async def get_generation_count_api():
    try:
        return get_generation_count()
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
