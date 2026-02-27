import cv2
import numpy as np
from PIL import Image

def detect_face(image):
    """
    Detects faces in an image and returns the bounding box of the largest face.
    Args:
        image: PIL Image or numpy array (RGB)
    Returns:
        tuple: (x, y, w, h) of the largest face or None if no face detected
    """
    if isinstance(image, Image.Image):
        image_np = np.array(image)
    else:
        image_np = image

    # Convert to grayscale for OpenCV
    gray = cv2.cvtColor(image_np, cv2.COLOR_RGB2GRAY)
    
    # Load the pre-trained Haar Cascade classifier for face detection
    face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    
    # Detect faces
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30))
    
    if len(faces) == 0:
        return None
    
    # Find the largest face by area
    largest_face = max(faces, key=lambda f: f[2] * f[3])
    return largest_face

def crop_face(image, margin=0.2):
    """
    Crops the face from the image with an optional margin.
    Args:
        image: PIL Image or numpy array (RGB)
        margin: percentage to extend the bounding box
    Returns:
        cropped_image: PIL Image or numpy array (same as input)
    """
    face_box = detect_face(image)
    if face_box is None:
        return image # Return original if no face detected
    
    x, y, w, h = face_box
    
    # Add margin
    mx = int(w * margin)
    my = int(h * margin)
    
    img_h, img_w = (image.height, image.width) if isinstance(image, Image.Image) else image.shape[:2]
    
    x1 = max(0, x - mx)
    y1 = max(0, y - my)
    x2 = min(img_w, x + w + mx)
    y2 = min(img_h, y + h + my)
    
    if isinstance(image, Image.Image):
        return image.crop((x1, y1, x2, y2))
    else:
        return image[y1:y2, x1:x2]
