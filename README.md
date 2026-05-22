# Polygen: AI Synthetic Media & Deepfake Forensic Suite

<div align="center">
  <img alt="Python" src="https://img.shields.io/badge/Python-3.8+-blue?logo=python&logoColor=white">
  <img alt="FastAPI" src="https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi&logoColor=white">
  <img alt="PyTorch" src="https://img.shields.io/badge/PyTorch-2.0+-EE4C2C?logo=pytorch&logoColor=white">
  <img alt="SDXL Turbo" src="https://img.shields.io/badge/SDXL_Turbo-Generation-8A2BE2">
  <img alt="EfficientNet" src="https://img.shields.io/badge/EfficientNet-Forensics-FF9900">
</div>

## Overview
**Polygen** is a dual-purpose AI system designed for cutting-edge synthetic media generation and robust deepfake detection. Exploring the boundary between reality and artificial intelligence, this project combines advanced diffusion models with state-of-the-art forensic analysis techniques.

##  Key Features

###  DetectCore: Advanced Deepfake Forensics
Polygen's detection engine utilizes a hybrid approach, combining deep neural networks with low-level signal processing to identify manipulated media.
- **Neural Ensembles**: Leverages an ensemble of **EfficientNet-B4** and **Xception** models trained on diverse forgery datasets.
- **Signal Processing Refinements**: Incorporates Fast Fourier Transform (FFT) analysis and Photo Response Non-Uniformity (PRNU) noise extraction to detect subtle anomalies invisible to the human eye.
- **Explainable AI (XAI)**: Generates **Grad-CAM** heatmaps, visually highlighting the specific facial regions that influenced the model's prediction.
- **Media Support**: Comprehensive analysis for both static images (JPEG, PNG) and videos (MP4), processing up to 5-crop face extractions for enhanced reliability.

###  GenCore: High-Fidelity Media Generation
The generative suite is built for speed, quality, and control, utilizing the latest in latent diffusion technologies.
- **Text-to-Image (SDXL Turbo)**: Rapid generation of photorealistic and artistic images from complex prompts using Stability AI's SDXL Turbo.
- **Image-to-Image (ControlNet)**: Structure-preserving transformations. Upload an image and dictate structural rules via Canny edge detection.
- **Precision Inpainting**: Smart masking tools allowing users to seamlessly insert, replace, or remove elements within existing images using Stable Diffusion Inpainting.
- **Real-ESRGAN Upscaling**: Integrated tiled 4x upscaling to eliminate generation artifacts and enhance output resolution for ultra-high-definition results.
- **Real-time Latent Preview**: Watch the image materialize during the sampling steps with integrated visual callbacks.


##  Architecture

- **Backend**: FastAPI (Python), serving concurrent ML pipelines asynchronously.
- **Frontend**: Vanilla HTML5, CSS3, JavaScript.
- **ML Engine**: PyTorch, Diffusers, OpenCV, timm, BasicSR/RealESRGAN.

##  Setup Instructions

### Prerequisites
- Python 3.8+
- NVIDIA GPU (Highly Recommended, optimized for >= 4GB VRAM) or CPU fallback.

### Installation
1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/polygen.git
   cd polygen
   ```
2. **Set up a Virtual Environment**:
   ```bash
   python -m venv .venv
   .\.venv\Scripts\Activate  # Windows
   # source .venv/bin/activate  # Mac/Linux
   ```
3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```
   *Note: If taking advantage of GPU acceleration, ensure you have the appropriate PyTorch with CUDA support installed.*

### Running the Application
1. **Start the FastAPI Backend**:
   Navigate to the project root and start the server:
   ```bash
   python -m backend.main
   ```
   *Note: On the first run, the system will automatically download necessary foundational models (EfficientNet weights, SDXL tokenizers/UNets) caching them in your local directory.*

2. **Access the Interface**:
   Open your preferred web browser and navigate to:
   ```
   http://localhost:8000/static/index.html
   ```

##  Project Structure

```text
poly/
├── backend/            # FastAPI core, API routers (detection, generation, stats)
├── frontend/           # Next-gen UI (HTML/CSS/JS assets)
├── ml_modules/
│   ├── detection/      # Forensics: detector ensembles, Grad-CAM, Refinements
│   └── generation/     # Generative: SDXL Turbo, ControlNet, Real-ESRGAN
├── models/             # Local checkpoint directory (checkpoints/safetensors)
├── scripts/            # Dataset prep, training, and utilities
└── requirements.txt    # Python dependencies
```

##  Future Roadmap
- Implementation of Video-to-Video generative filters (e.g., temporally consistent stylization).
- Real-time webcam manipulation detection.
- Audio deepfake analysis integration.
