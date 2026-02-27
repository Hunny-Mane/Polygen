
import cv2
import os
import shutil
import numpy as np
from .filters import AIFilters

class VideoProcessor:
    def __init__(self):
        self.filters = AIFilters()

    def process_video(self, video_path, output_path, filter_type='cartoon'):
        # Create temp folder for frames
        temp_dir = 'temp_frames'
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        os.makedirs(temp_dir)

        cap = cv2.VideoCapture(video_path)
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        
        # Output Video Writer
        # FourCC code for WebM (VP8) - highly compatible with web browsers
        fourcc = cv2.VideoWriter_fourcc(*'vp80')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        if not out.isOpened():
             print("Warning: vp80 codec failed to initialize, falling back to mp4v")
             fourcc = cv2.VideoWriter_fourcc(*'mp4v')
             out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))
        
        frame_idx = 0
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                break
            
            # Open CV reads in BGR, convert to RGB for processing
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            
            # Apply Filter
            processed_frame_rgb = self.filters.apply_filter(frame_rgb, filter_type)
            
            # Convert back to BGR for saving
            processed_frame_bgr = cv2.cvtColor(processed_frame_rgb, cv2.COLOR_RGB2BGR)
            
            out.write(processed_frame_bgr)
            frame_idx += 1
            
        cap.release()
        out.release()
        shutil.rmtree(temp_dir)
        
        return output_path
