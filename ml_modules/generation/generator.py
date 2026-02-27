
import torch
from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
from PIL import Image
import os
import io

class ImageGenerator:
    def __init__(self, model_id="runwayml/stable-diffusion-v1-5", device=None, provider="local", api_key=None):
        self.provider = provider
        self.api_key = api_key
        self.device = device if device else ('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Local model is default and preferred due to library constraints on generation (Imagen API access varies)
        if self.provider == "local":
            print(f"Loading Local Image Generation Model ({model_id}) on {self.device}...")
            # We use float32 for CPU and float16 for CUDA to save memory
            dtype = torch.float16 if self.device == 'cuda' else torch.float32
            
            try:
                self.txt2img = StableDiffusionPipeline.from_pretrained(model_id, torch_dtype=dtype)
                # Optimization: Use DPMSolverMultistepScheduler for faster generation (20 steps instead of 50)
                self.txt2img.scheduler = DPMSolverMultistepScheduler.from_config(self.txt2img.scheduler.config)
                self.txt2img.to(self.device)
                
                # Enable attention slicing to save memory on smaller GPUs
                self.txt2img.enable_attention_slicing()
                
            except Exception as e:
                print(f"Error loading model: {e}")
                self.txt2img = None
        else:
            print(f"Provider {self.provider} not fully supported for generation in this version. Using Local Fallback if possible.")
            # Fallback to local init if 'google' is passed but we don't implement Imagen yet (complex auth)
            if not hasattr(self, 'txt2img'):
                # Try init local anyway? No, let's just warn.
                self.txt2img = None

    def generate(self, prompt, negative_prompt=None, steps=20):
        # LOCAL GENERATION
        if self.txt2img:
            image = self.txt2img(prompt=prompt, negative_prompt=negative_prompt, num_inference_steps=steps).images[0]
            return image
            
        print("No valid generator loaded.")
        return None
