
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()
from backend.routers import detection, generation, stats

app = FastAPI(title="AI Synthetic Media & Deepfake Detection System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="frontend"), name="static")

@app.get("/")
async def root():
    from fastapi.responses import RedirectResponse
    return RedirectResponse(url="/static/index.html")

app.include_router(detection.router, prefix="/api/detection", tags=["Detection"])
app.include_router(generation.router, prefix="/api/generation", tags=["Generation"])
app.include_router(stats.router, prefix="/api", tags=["Stats"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
