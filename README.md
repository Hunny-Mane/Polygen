
# AI-Based Synthetic Media Generation & Deepfake Detection System

## Overview
This project is a comprehensive Machine Learning system designed for:
1.  **Deepfake Detection**: Classifying images and videos as "Real" or "Fake" using EfficientNet and providing explainability via Grad-CAM maps.
2.  **AI Media Generation**: Generating high-quality images from text prompts (Stable Diffusion) and applying AI-based stylistic filters to videos.

## Features
- **Deepfake Detection**:
    - Support for Images (JPEG, PNG) and Videos (MP4).
    - Confidence score and Probability.
    - **Grad-CAM Visualization**: Highlights the regions where the model detects manipulation.
- **Media Generation**:
    - **Text-to-Image**: Generate artistic images from text descriptions.
    - **Video Filters**: Apply "Cartoon" or "Sketch" effects to uploaded videos.
- **Premium Web Interface**:
    - Glassmorphism design.
    - Dark mode aesthetics.
    - Responsive dashboard.

## Architecture
- **Backend**: FastAPI (Python).
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla).
- **ML Engine**: PyTorch, Diffusers, OpenCV, timm.

## Setup Instructions

### Prerequisites
- Python 3.8+
- NVIDIA GPU (Recommended for fast inference) or CPU (Slower).

### Installation
1.  Clone the repository or download the project folder.
2.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

### Running the Application
1.  Navigate to the `backend` directory (ensure you are in the project root):
    ```bash
    python -m backend.main
    ```
    *Note: The first run might take time to download the Machine Learning models (EfficientNet, Stable Diffusion).*
2.  Open your browser and visit:
    `http://localhost:8000/static/index.html`

## Folder Structure
- `backend/`: FastAPI server and API routers.
- `frontend/`: Static web files (HTML/CSS/JS).
- `ml_modules/`:
    - `detection/`: Deepfake detection logic (EfficientNet, Grad-CAM).
    - `generation/`: Generation logic (Stable Diffusion, Filters).
- `scripts/`: Training scripts for deepfake detection.

## Future Scope
- Integration with more advanced GANs (StyleGAN).
- Real-time video detection.
- Audio deepfake detection.

## Terminal
- .\.venv\Scripts\Activate
- python -m backend.main
- http://localhost:8000/static/index.html
