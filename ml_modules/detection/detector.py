print("DEBUG: Importing ml_modules.detection.detector...")
import cv2
import torch
import numpy as np
from PIL import Image
from torchvision import transforms
from .model import get_model
from .face_utils import crop_face
import os

class InferenceDetector:
    def __init__(self, model_name='efficientnet_b0', model_path=None, device='cuda' if torch.cuda.is_available() else 'cpu', threshold=0.5):
        self.device = device
        self.model = None
        self.model_name = model_name
        self.threshold = threshold
        
        # Default model path
        if model_path is None:
            model_path = os.path.join(os.path.dirname(__file__), 'weights', 'deepfake_model.pth')
            
        print(f"Loading Local Detection Model ({model_name}) from {model_path}...")
        self.model = get_model(model_name=model_name, device=self.device, pretrained=False)
        
        if os.path.exists(model_path):
            try:
                self.model.load_state_dict(torch.load(model_path, map_location=self.device))
                print("Model loaded successfully.")
            except Exception as e:
                print(f"Error loading model state dict: {e}")
        else:
            print(f"Warning: Model weights not found at {model_path}. Using base model.")
        
        self.model.eval()
        
        self.transform = transforms.Compose([
            transforms.Resize((224, 224)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])

    def preprocess_image(self, image, use_face_crop=True):
        if isinstance(image, np.ndarray):
            image = Image.fromarray(image)
        
        if use_face_crop:
            image = crop_face(image)
            
        return self.transform(image).unsqueeze(0).to(self.device)

    def predict_image(self, image, use_face_crop=True):
        if self.model:
            img_tensor = self.preprocess_image(image, use_face_crop=use_face_crop)
            with torch.no_grad():
                fake_prob = self.model(img_tensor).item()
            
            real_prob = 1.0 - fake_prob
            label = "Fake" if fake_prob >= self.threshold else "Real"
            # Confidence is the distance from the threshold, normalized
            confidence = abs(fake_prob - self.threshold) / max(self.threshold, 1.0 - self.threshold)
            
            return {
                "label": label,
                "fake_probability": fake_prob,
                "real_probability": real_prob,
                "confidence": confidence
            }
        return {"label": "Real", "fake_probability": 0.5, "real_probability": 0.5, "confidence": 0.0}

    def process_video(self, video_path, frame_count=10, use_face_crop=True):
        cap = cv2.VideoCapture(video_path)
        fake_probs = []
        
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        if total_frames <= 0: return 0.5
        
        step = max(1, total_frames // frame_count)
        
        count = 0
        extracted = 0
        while cap.isOpened() and extracted < frame_count:
            ret, frame = cap.read()
            if not ret: break
            
            if count % step == 0:
                # Convert BGR to RGB
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                res = self.predict_image(rgb_frame, use_face_crop=use_face_crop)
                fake_probs.append(res["fake_probability"])
                extracted += 1
            count += 1
            
        cap.release()
        
        if not fake_probs: return self.predict_image(np.zeros((224, 224, 3)))
        
        # Simple averaging
        avg_fake_prob = sum(fake_probs) / len(fake_probs)
        avg_real_prob = 1.0 - avg_fake_prob
        label = "Fake" if avg_fake_prob >= self.threshold else "Real"
        confidence = abs(avg_fake_prob - self.threshold) / max(self.threshold, 1.0 - self.threshold)

        return {
            "label": label,
            "fake_probability": avg_fake_prob,
            "real_probability": avg_real_prob,
            "confidence": confidence
        }
