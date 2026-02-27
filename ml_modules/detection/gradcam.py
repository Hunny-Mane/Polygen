# gradcam.py - Proper Grad-CAM implementation using PyTorch hooks

import torch
import torch.nn.functional as F
import numpy as np
import cv2


class GradCAM:
    """
    Grad-CAM implementation that works with the DeepfakeDetector (EfficientNet-based) model.
    Uses forward and backward hooks on the last convolutional block.
    """

    def __init__(self, model):
        self.model = model
        self.gradients = None
        self.activations = None
        self._hook_handles = []
        self._register_hooks()

    def _find_target_layer(self):
        """Find the last convolutional / batch-norm block in the model."""
        inner = self.model.model  # The timm EfficientNet
        # timm EfficientNet has `blocks` attribute with sequential conv layers
        if hasattr(inner, 'blocks'):
            return inner.blocks[-1]
        # Fallback: last child module that has parameters
        target = None
        for child in inner.children():
            target = child
        return target

    def _register_hooks(self):
        target = self._find_target_layer()

        def forward_hook(module, input, output):
            self.activations = output.detach()

        def backward_hook(module, grad_in, grad_out):
            self.gradients = grad_out[0].detach()

        h1 = target.register_forward_hook(forward_hook)
        h2 = target.register_full_backward_hook(backward_hook)
        self._hook_handles = [h1, h2]

    def remove_hooks(self):
        for h in self._hook_handles:
            h.remove()

    def generate_heatmap(self, input_tensor, original_image_rgb):
        """
        Generate Grad-CAM heatmap overlay.

        Args:
            input_tensor: preprocessed [1, 3, H, W] tensor
            original_image_rgb: HxWx3 float32 numpy array (0–1 range) or PIL Image

        Returns:
            heatmap_overlay: HxWx3 uint8 numpy array (colored overlay on original image)
        """
        import numpy as np

        # Convert PIL to numpy if needed
        if not isinstance(original_image_rgb, np.ndarray):
            original_image_rgb = np.array(original_image_rgb).astype(np.float32) / 255.0

        self.model.eval()
        self.gradients = None
        self.activations = None

        # Require grad for backprop
        inp = input_tensor.clone().requires_grad_(True)

        try:
            output = self.model(inp)  # shape: [1, 1]
            self.model.zero_grad()
            output.backward(torch.ones_like(output))

            if self.gradients is None or self.activations is None:
                return self._fallback_heatmap(original_image_rgb)

            # Pool gradients across spatial dims
            pooled_grads = self.gradients.mean(dim=[0, 2, 3])  # [C]

            # Weight activations
            activations = self.activations[0]  # [C, H, W]
            for i, w in enumerate(pooled_grads):
                activations[i] *= w

            heatmap = activations.mean(dim=0).cpu().numpy()  # [H, W]
            heatmap = np.maximum(heatmap, 0)

            # Normalize
            if heatmap.max() > 0:
                heatmap /= heatmap.max()

            # Resize heatmap to original image size
            h, w = original_image_rgb.shape[:2]
            heatmap_resized = cv2.resize(heatmap, (w, h))

            # Apply colormap
            heatmap_colored = cv2.applyColorMap(
                np.uint8(255 * heatmap_resized), cv2.COLORMAP_JET
            )
            heatmap_colored = cv2.cvtColor(heatmap_colored, cv2.COLOR_BGR2RGB)

            # Overlay on original image
            orig_uint8 = np.uint8(255 * np.clip(original_image_rgb, 0, 1))
            overlay = cv2.addWeighted(orig_uint8, 0.5, heatmap_colored, 0.5, 0)
            return overlay

        except Exception as e:
            print(f"Grad-CAM generation error: {e}")
            return self._fallback_heatmap(original_image_rgb)

    def _fallback_heatmap(self, original_image_rgb):
        """Return a blue-tinted version of the original if Grad-CAM fails."""
        orig_uint8 = np.uint8(255 * np.clip(original_image_rgb, 0, 1))
        blue_overlay = np.zeros_like(orig_uint8)
        blue_overlay[:, :, 2] = 180  # blue channel
        return cv2.addWeighted(orig_uint8, 0.7, blue_overlay, 0.3, 0)


# Keep backward-compatible alias
class ExplainabilityGB(GradCAM):
    """Legacy alias kept for backward compatibility."""

    def generate(self, input_tensor):
        """Legacy method — use generate_heatmap() instead."""
        return None
