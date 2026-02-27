
import sys
import os
sys.path.append(os.getcwd())

print("Verifying Imports...")
try:
    print("Checking Backend...")
    from backend.main import app
    print(" - Backend OK")

    print("Checking Detection Module...")
    from ml_modules.detection.model import DeepfakeDetector
    from ml_modules.detection.detector import InferenceDetector
    # Note: GradCAM might warn if no CUDA, that's fine
    print(" - Detection OK")

    print("Checking Generation Module...")
    # We won't instantiate StableDiffusionPipeline here as it downloads GBs
    from ml_modules.generation.generator import ImageGenerator
    from ml_modules.generation.filters import AIFilters
    print(" - Generation OK")

    print("\nSUCCESS: All modules are structurally sound.")

except Exception as e:
    print(f"\nFAILURE: {e}")
    import traceback
    traceback.print_exc()
