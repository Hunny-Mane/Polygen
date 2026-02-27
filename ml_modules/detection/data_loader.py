import os
import cv2
import glob
import torch
import random
import numpy as np
from torch.utils.data import Dataset
from PIL import Image, ImageFilter
from torchvision import transforms
from .face_utils import crop_face

class GaussianNoise:
    def __init__(self, mean=0., std=1.):
        self.std = std
        self.mean = mean
        
    def __call__(self, tensor):
        return tensor + torch.randn(tensor.size()) * self.std + self.mean
    
    def __repr__(self):
        return self.__class__.__name__ + f'(mean={self.mean}, std={self.std})'

class JPEGCompression:
    def __init__(self, quality_range=(30, 90)):
        self.quality_range = quality_range
        
    def __call__(self, img):
        if not isinstance(img, Image.Image):
            img = transforms.ToPILImage()(img)
        
        quality = random.randint(self.quality_range[0], self.quality_range[1])
        import io
        buffer = io.BytesIO()
        img.save(buffer, "JPEG", quality=quality)
        buffer.seek(0)
        return Image.open(buffer)

def get_transforms(mode='train', size=224):
    if mode == 'train':
        return transforms.Compose([
            transforms.Resize((size + 32, size + 32)),
            transforms.RandomCrop((size, size)),
            transforms.RandomHorizontalFlip(),
            transforms.ColorJitter(brightness=0.2, contrast=0.2, saturation=0.2),
            transforms.RandomApply([transforms.GaussianBlur(kernel_size=3)], p=0.3),
            JPEGCompression(quality_range=(40, 90)),
            transforms.ToTensor(),
            transforms.RandomApply([GaussianNoise(0, 0.05)], p=0.3),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])
    else:
        return transforms.Compose([
            transforms.Resize((size, size)),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
        ])

class DeepfakeDataset(Dataset):
    def __init__(self, root_dir, transform=None, mode='train', use_face_crop=True):
        """
        Args:
            root_dir (string): Directory with all the images.
            transform (callable, optional): Optional transform to be applied on a sample.
            mode (string): 'train' or 'val'
            use_face_crop (bool): Whether to crop face region
        """
        self.root_dir = root_dir
        self.transform = transform if transform else get_transforms(mode)
        self.mode = mode
        self.use_face_crop = use_face_crop
        self.cache = {} # In-memory cache for processed (cropped) images
        
        self.real_paths = []
        for ext in ['*.jpg', '*.jpeg', '*.png', '*.webp']:
            self.real_paths.extend(glob.glob(os.path.join(root_dir, 'training_real', ext)))
            self.real_paths.extend(glob.glob(os.path.join(root_dir, 'training_real', ext.upper())))
            
        self.fake_paths = []
        for ext in ['*.jpg', '*.jpeg', '*.png', '*.webp']:
            self.fake_paths.extend(glob.glob(os.path.join(root_dir, 'training_fake', ext)))
            self.fake_paths.extend(glob.glob(os.path.join(root_dir, 'training_fake', ext.upper())))
        
        # Balance dataset if needed (for training)
        if mode == 'train':
            min_len = min(len(self.real_paths), len(self.fake_paths))
            if min_len > 0:
                print(f"Balancing dataset to {min_len} samples per class.")
                random.seed(42) # Consistent balancing
                random.shuffle(self.real_paths)
                random.shuffle(self.fake_paths)
                self.real_paths = self.real_paths[:min_len]
                self.fake_paths = self.fake_paths[:min_len]

        self.data_paths = self.real_paths + self.fake_paths
        self.labels = [0.0] * len(self.real_paths) + [1.0] * len(self.fake_paths)
        print(f"Dataset {mode}: Loaded {len(self.real_paths)} real and {len(self.fake_paths)} fake images.")
        
    def __len__(self):
        return len(self.data_paths)

    def __getitem__(self, idx):
        img_path = self.data_paths[idx]
        label = self.labels[idx]
        
        # Check cache first
        if img_path in self.cache:
            image = self.cache[img_path]
        else:
            try:
                image = Image.open(img_path).convert('RGB')
                if self.use_face_crop:
                    image = crop_face(image)
                # Cache the PIL image (pre-transform but post-crop)
                self.cache[img_path] = image
            except Exception as e:
                print(f"Error loading {img_path}: {e}")
                return torch.zeros(3, 224, 224), label

        if self.transform:
            image = self.transform(image)

        return image, label
