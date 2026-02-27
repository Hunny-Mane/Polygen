import os
import sys
# Add project root to path
sys.path.append(os.getcwd())

from ml_modules.detection.detector import InferenceDetector
from PIL import Image
import numpy as np

def test_detection():
    # Load detector
    print("Initializing detector...")
    
    # detector.py now defaults to local model and doesn't require API key
    detector = InferenceDetector()
    
    # Create a dummy image (black square)
    print("Creating dummy image...")
    img = Image.new('RGB', (224, 224), color = (73, 109, 137))
    img_np = np.array(img)
    
    # Run prediction
    print("Running prediction...")
    try:
        res = detector.predict_image(img_np)
        print(f"Prediction success!")
        print(f" - Label: {res['label']}")
        print(f" - Real Prob: {res['real_probability']:.4f}")
        print(f" - Fake Prob: {res['fake_probability']:.4f}")
        print(f" - Confidence: {res['confidence']:.4f}")
        
    except Exception as e:
        print(f"Prediction failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_detection()
