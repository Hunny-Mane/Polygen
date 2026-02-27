import cv2
import numpy as np
import os

def create_assets():
    output_dir = r"d:\Work\FinalYearProject\demo_assets"
    os.makedirs(output_dir, exist_ok=True)
    
    # Create sample image
    img = np.zeros((512, 512, 3), dtype=np.uint8)
    cv2.putText(img, "Sample Image", (50, 256), cv2.FONT_HERSHEY_SIMPLEX, 2, (255, 255, 255), 3)
    cv2.circle(img, (256, 100), 50, (0, 0, 255), -1)
    cv2.rectangle(img, (100, 400), (400, 450), (0, 255, 0), -1)
    img_path = os.path.join(output_dir, "sample_image.png")
    cv2.imwrite(img_path, img)
    print(f"Created {img_path}")

    # Create sample video
    width, height = 640, 480
    video_path = os.path.join(output_dir, "sample_video.mp4")
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter(video_path, fourcc, 20.0, (width, height))

    for i in range(60): # 3 seconds
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        # Moving circle
        cx = int(i * (width / 60))
        cy = height // 2
        cv2.circle(frame, (cx, cy), 50, (255, 0, 0), -1)
        cv2.putText(frame, f"Frame {i}", (50, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
        out.write(frame)

    out.release()
    print(f"Created {video_path}")

if __name__ == "__main__":
    create_assets()
