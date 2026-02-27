
import torch
import torch.nn as nn
import timm

class DeepfakeDetector(nn.Module):
    def __init__(self, model_name='efficientnet_b0', pretrained=True, freeze_backbone=True):
        super(DeepfakeDetector, self).__init__()
        # Using timm for a wide range of pretrained models
        self.model = timm.create_model(model_name, pretrained=pretrained)
        
        # Determine the number of input features for the classifier
        if 'efficientnet' in model_name:
            n_features = self.model.classifier.in_features
            self.model.classifier = nn.Sequential(
                nn.Linear(n_features, 256),
                nn.ReLU(),
                nn.Dropout(0.3),
                nn.Linear(256, 1)
            )
        elif 'resnet' in model_name:
            n_features = self.model.fc.in_features
            self.model.fc = nn.Sequential(
                nn.Linear(n_features, 256),
                nn.ReLU(),
                nn.Dropout(0.3),
                nn.Linear(256, 1)
            )
        else:
            # Generic fallback for other timm models
            if hasattr(self.model, 'classifier'):
                n_features = self.model.classifier.in_features
                self.model.classifier = nn.Linear(n_features, 1)
            elif hasattr(self.model, 'fc'):
                n_features = self.model.fc.in_features
                self.model.fc = nn.Linear(n_features, 1)

        if freeze_backbone:
            for name, param in self.model.named_parameters():
                if 'classifier' not in name and 'fc' not in name:
                    param.requires_grad = False
        
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        x = self.model(x)
        return self.sigmoid(x)

def get_model(model_name='efficientnet_b0', device='cpu', pretrained=True, freeze_backbone=True):
    model = DeepfakeDetector(model_name=model_name, pretrained=pretrained, freeze_backbone=freeze_backbone)
    model.to(device)
    model.eval()
    return model
