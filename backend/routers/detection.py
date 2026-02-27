
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
import shutil
import os
import cv2
import numpy as np
import base64
import sys
from ml_modules.detection.detector import InferenceDetector
from ml_modules.detection.gradcam import GradCAM
from PIL import Image
import io

# Add project root to path for database import
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from database.db import save_detection, get_all_detections, get_detection_count

router = APIRouter()

detector = None
explainer = None


def get_detector():
    global detector
    if detector is None:
        try:
            detector = InferenceDetector()
        except Exception as e:
            print(f"Error loading detector: {e}")
    return detector


def get_explainer():
    global explainer
    if explainer is None:
        try:
            model = get_detector()
            if model and model.model:
                explainer = GradCAM(model.model)
        except Exception as e:
            print(f"Error loading explainer: {e}")
    return explainer


@router.post("/predict/image")
async def predict_image(file: UploadFile = File(...)):
    if not file.content_type.startswith('image/'):
        raise HTTPException(status_code=400, detail="Invalid file type")

    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img_np = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    img_rgb = cv2.cvtColor(img_np, cv2.COLOR_BGR2RGB)

    model = get_detector()
    if not model:
        return JSONResponse(content={"error": "Model not loaded"}, status_code=500)

    res = model.predict_image(img_rgb)

    # ── Grad-CAM ──────────────────────────────────────────────────────────────
    cam_b64 = ""
    try:
        ex = get_explainer()
        if ex:
            img_float = img_rgb.astype(np.float32) / 255.0
            tensor = model.preprocess_image(img_rgb)
            overlay = ex.generate_heatmap(tensor, img_float)
            if overlay is not None:
                overlay_bgr = cv2.cvtColor(overlay, cv2.COLOR_RGB2BGR)
                _, buffer = cv2.imencode('.jpg', overlay_bgr)
                cam_b64 = base64.b64encode(buffer).decode('utf-8')
    except Exception as e:
        print(f"GradCAM Error: {e}")

    # ── Auto-save fake images to database/detection_storage ───────────────────
    if res["label"] == "Fake":
        try:
            # Re-encode original image to JPEG bytes
            _, img_buf = cv2.imencode('.jpg', img_np)
            save_detection(
                image_bytes=img_buf.tobytes(),
                fake_prob=float(res["fake_probability"]),
                confidence=float(res["confidence"]),
                media_type="image",
                ext=".jpg"
            )
        except Exception as e:
            print(f"DB save error: {e}")

    return {
        "label": res["label"],
        "probability": float(res["fake_probability"]),
        "real_probability": float(res["real_probability"]),
        "fake_probability": float(res["fake_probability"]),
        "confidence": float(res["confidence"]),
        "heatmap": cam_b64
    }


@router.post("/predict/video")
async def predict_video(file: UploadFile = File(...)):
    if not file.content_type.startswith('video/'):
        raise HTTPException(status_code=400, detail="Invalid file type")

    temp_path = f"temp_{file.filename}"
    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    model = get_detector()
    if not model:
        return JSONResponse(content={"error": "Model not loaded"}, status_code=500)

    try:
        res = model.process_video(temp_path)

        # ── Auto-save fake video thumbnail to detection_storage ───────────────
        if res["label"] == "Fake":
            try:
                cap = cv2.VideoCapture(temp_path)
                ret, frame = cap.read()
                cap.release()
                if ret:
                    _, img_buf = cv2.imencode('.jpg', frame)
                    save_detection(
                        image_bytes=img_buf.tobytes(),
                        fake_prob=float(res["fake_probability"]),
                        confidence=float(res["confidence"]),
                        media_type="video",
                        ext=".jpg"
                    )
            except Exception as e:
                print(f"DB video save error: {e}")
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

    return {
        "label": res["label"],
        "probability": float(res["fake_probability"]),
        "real_probability": float(res["real_probability"]),
        "fake_probability": float(res["fake_probability"]),
        "confidence": float(res["confidence"])
    }


@router.get("/records")
async def get_detection_records():
    """Return all saved fake detections from the database."""
    try:
        records = get_all_detections()
        return {"records": records, "count": len(records)}
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)


@router.get("/records/count")
async def get_records_count():
    try:
        return get_detection_count()
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
