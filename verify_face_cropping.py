import os
import sys
import numpy as np
from PIL import Image
import cv2

# Add project root to path
sys.path.append(os.getcwd())

from ml_modules.detection.face_utils import detect_face, crop_face

def verify_face_utils():
    print("Verifying face detection and cropping...")
    
    # Create a dummy image with a red square representing a "face"
    # Note: Haar Cascade won't detect this, but we can at least check the functions don't crash
    img = Image.new('RGB', (400, 400), color = (200, 200, 200))
    img_np = np.array(img)
    
    print("Testing detect_face on dummy image (expect None)...")
    face = detect_face(img)
    print(f"Detected: {face}")
    
    print("Testing crop_face (should return original image if no face)...")
    cropped = crop_face(img)
    if isinstance(cropped, Image.Image):
        print(f"Original size: {img.size}, Cropped size: {cropped.size}")
    
    print("\nNote: Real face detection requires an image with a face.")
    print("Success: Functions executed without errors.")

if __name__ == "__main__":
    verify_face_utils()
