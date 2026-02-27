
import cv2
import numpy as np

class AIFilters:
    def __init__(self):
        pass

    def sketch_filter(self, img_rgb):
        # Convert to gray
        gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
        
        # Invert
        inverted = 255 - gray
        
        # Blur (stronger blur for better results)
        blurred = cv2.GaussianBlur(inverted, (21, 21), 0)
        
        # Color Dodge Blend
        # This creates the main sketch effect
        sketch = cv2.divide(gray, 255 - blurred, scale=256)
        
        # ENHANCEMENT: Increase contrast
        # Additional step to make lines darker and background whiter
        # Linear stretching: 
        # clip so that values < 240 become darker, > 240 become white?
        # A simpler way is to use adaptive thresholding mixed in or just gamma correction.
        # Let's try blending with edges for sharper lines.
        
        # Get strong edges
        edges = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 9, 9)
        
        # Combine the soft sketch with the hard edges
        # We want to darken the sketch where edges are present
        
        # sketch is 0-255 (255 is white). edges is 0 or 255.
        # Minimal value (darkest) wins
        final_sketch = cv2.min(sketch, edges)
        
        return cv2.cvtColor(final_sketch, cv2.COLOR_GRAY2RGB)

    def cartoon_filter(self, img_rgb):
        # Edges
        gray = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2GRAY)
        gray = cv2.medianBlur(gray, 5)
        edges = cv2.adaptiveThreshold(gray, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY, 9, 9)
        
        # Color
        color = cv2.bilateralFilter(img_rgb, 9, 300, 300)
        
        # Cartoon
        cartoon = cv2.bitwise_and(color, color, mask=edges)
        return cartoon

    def apply_filter(self, image_np, filter_type):
        """
        image_np: RGB numpy array
        """
        if filter_type == 'sketch':
            return self.sketch_filter(image_np)
        elif filter_type == 'cartoon':
            return self.cartoon_filter(image_np)
        else:
            return image_np
