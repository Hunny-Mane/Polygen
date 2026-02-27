import torch
import torch.nn as nn
import torch.optim as optim
from torch.utils.data import DataLoader, Subset
from torchvision import transforms
import os
import sys
import copy
import time
import argparse
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import precision_score, recall_score, confusion_matrix, accuracy_score

# Ensure project root is in path
sys.path.append(os.getcwd())

from ml_modules.detection.model import get_model
from ml_modules.detection.data_loader import DeepfakeDataset, get_transforms

def train_model(data_dir='database', model_name='efficientnet_b0', epochs=10, 
                batch_size=16, learning_rate=0.001, freeze_backbone=True, 
                use_face_crop=True, save_path=None, quick_mode=False, limit=None):
    
    if save_path is None:
        save_dir = os.path.join('ml_modules', 'detection', 'weights')
        os.makedirs(save_dir, exist_ok=True)
        save_path = os.path.join(save_dir, 'deepfake_model.pth')
        
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    print(f"Using device: {device}")
    print(f"Model: {model_name}, Freeze Backbone: {freeze_backbone}, Face Crop: {use_face_crop}")

    # Load Full Dataset
    full_dataset = DeepfakeDataset(root_dir=data_dir, mode='train', use_face_crop=use_face_crop)
    
    if len(full_dataset) == 0:
        print("Error: No data found in", data_dir)
        return

    # Split into train and validation
    train_idx, val_idx = train_test_split(
        list(range(len(full_dataset))), 
        test_size=0.2, 
        random_state=42,
        stratify=full_dataset.labels
    )
    
    if quick_mode:
        print("Quick mode: Slicing dataset for rapid verification (8 train, 4 val)...")
        train_idx = train_idx[:8]
        val_idx = val_idx[:4]
    elif limit:
        # Limit both train and val proportionally
        val_limit = int(limit * 0.2)
        train_limit = limit - val_limit
        print(f"Limiting dataset to approximately {limit} samples ({train_limit} train, {val_limit} val)...")
        train_idx = train_idx[:train_limit]
        val_idx = val_idx[:val_limit]

    # Optimized Loading: Create separate dataset objects using the SAME base data paths to avoid re-scanning
    train_data = DeepfakeDataset(root_dir=data_dir, transform=get_transforms('train'), 
                                 mode='val', use_face_crop=use_face_crop)
    train_data.data_paths = [full_dataset.data_paths[i] for i in train_idx]
    train_data.labels = [full_dataset.labels[i] for i in train_idx]
    
    val_data = DeepfakeDataset(root_dir=data_dir, transform=get_transforms('val'), 
                               mode='val', use_face_crop=use_face_crop)
    val_data.data_paths = [full_dataset.data_paths[i] for i in val_idx]
    val_data.labels = [full_dataset.labels[i] for i in val_idx]

    train_loader = DataLoader(train_data, batch_size=batch_size, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_data, batch_size=batch_size, shuffle=False, num_workers=0)

    # Model
    model = get_model(model_name=model_name, device=device, pretrained=True, freeze_backbone=freeze_backbone)
    
    # Calculate pos_weight for BCEWithLogitsLoss if labels are imbalanced (rare if balanced dataset used)
    # However, since we balanced it, weights should be 1.0. 
    # We'll use BCELoss for simplicity as the model already has Sigmoid.
    criterion = nn.BCELoss()
    optimizer = optim.Adam(filter(lambda p: p.requires_grad, model.parameters()), lr=learning_rate)

    best_val_loss = float('inf')
    best_model_wts = copy.deepcopy(model.state_dict())
    patience = 5
    counter = 0

    print("Starting training...")
    for epoch in range(epochs):
        since = time.time()
        
        # Training phase
        model.train()
        train_loss = 0.0
        train_all_labels = []
        train_all_preds = []
        
        for inputs, labels in train_loader:
            inputs = inputs.to(device)
            labels = labels.to(device).float().unsqueeze(1)

            optimizer.zero_grad()
            outputs = model(inputs)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            train_loss += loss.item() * inputs.size(0)
            preds = (outputs > 0.5).float()
            
            train_all_labels.extend(labels.cpu().numpy())
            train_all_preds.extend(preds.cpu().numpy())

        epoch_train_loss = train_loss / len(train_data)
        epoch_train_acc = accuracy_score(train_all_labels, train_all_preds)

        # Validation phase
        model.eval()
        val_loss = 0.0
        val_all_labels = []
        val_all_preds = []
        
        with torch.no_grad():
            for inputs, labels in val_loader:
                inputs = inputs.to(device)
                labels = labels.to(device).float().unsqueeze(1)
                outputs = model(inputs)
                loss = criterion(outputs, labels)
                
                val_loss += loss.item() * inputs.size(0)
                preds = (outputs > 0.5).float()
                
                val_all_labels.extend(labels.cpu().numpy())
                val_all_preds.extend(preds.cpu().numpy())

        epoch_val_loss = val_loss / len(val_data)
        epoch_val_acc = accuracy_score(val_all_labels, val_all_preds)
        epoch_val_prec = precision_score(val_all_labels, val_all_preds, zero_division=0)
        epoch_val_rec = recall_score(val_all_labels, val_all_preds, zero_division=0)

        time_elapsed = time.time() - since
        print(f'Epoch {epoch+1}/{epochs} - Train Loss: {epoch_train_loss:.4f} Acc: {epoch_train_acc:.4f} | '
              f'Val Loss: {epoch_val_loss:.4f} Acc: {epoch_val_acc:.4f} Prec: {epoch_val_prec:.4f} Rec: {epoch_val_rec:.4f} | {time_elapsed:.0f}s')

        # Check for early stopping
        if epoch_val_loss < best_val_loss:
            best_val_loss = epoch_val_loss
            best_model_wts = copy.deepcopy(model.state_dict())
            torch.save(model.state_dict(), save_path)
            print(f" --> Best model saved to {save_path}")
            counter = 0
        else:
            counter += 1
            if counter >= patience:
                print(f"Early stopping triggered.")
                break

    # Final Evaluation & Confusion Matrix
    model.load_state_dict(best_model_wts)
    model.eval()
    all_labels = []
    all_preds = []
    with torch.no_grad():
        for inputs, labels in val_loader:
            inputs = inputs.to(device)
            outputs = model(inputs)
            preds = (outputs > 0.5).float()
            all_labels.extend(labels.numpy())
            all_preds.extend(preds.cpu().numpy())
            
    cm = confusion_matrix(all_labels, all_preds)
    print("\nFinal Confusion Matrix (Validation):")
    print(cm)
    print(f"True Real: {cm[0][0]}, False Fake: {cm[0][1]}")
    print(f"False Real: {cm[1][0]}, True Fake: {cm[1][1]}")
    
    print("\nTraining complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--data', type=str, default='database', help='Path to dataset root')
    parser.add_argument('--model', type=str, default='efficientnet_b0', choices=['efficientnet_b0', 'resnet50'])
    parser.add_argument('--epochs', type=int, default=10)
    parser.add_argument('--batch_size', type=int, default=16)
    parser.add_argument('--lr', type=float, default=0.001)
    parser.add_argument('--no_freeze', action='store_false', dest='freeze', help='Do not freeze backbone')
    parser.add_argument('--no_crop', action='store_false', dest='crop', help='Do not use face cropping')
    parser.set_defaults(freeze=True, crop=True)
    parser.add_argument('--limit', type=int, help='Limit the total number of samples used for training')
    parser.add_argument('--quick', action='store_true', help='Train for 1 epoch on tiny subset')
    
    args = parser.parse_args()
    
    if args.quick:
        train_model(args.data, model_name=args.model, epochs=1, batch_size=4, quick_mode=True)
    else:
        train_model(args.data, model_name=args.model, epochs=args.epochs, 
                    batch_size=args.batch_size, learning_rate=args.lr, 
                    freeze_backbone=args.freeze, use_face_crop=args.crop, limit=args.limit)
