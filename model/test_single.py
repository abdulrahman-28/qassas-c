import os
import argparse
import torch
import numpy as np
import joblib
import json
import cv2
from PIL import Image
from diffusers import StableDiffusionImg2ImgPipeline
from peft import PeftModel
from metrics_factory import MetricsFactory
from config import CATEGORIES, FEATURES
import time

def create_anomaly_map(orig_img, recon_img):
    orig_np = np.array(orig_img).astype(np.float32)
    recon_np = np.array(recon_img).astype(np.float32)
    
    diff = np.abs(orig_np - recon_np)
    gray_diff = np.mean(diff, axis=2)
    
    gray_diff = (gray_diff - gray_diff.min()) / (gray_diff.max() - gray_diff.min() + 1e-8)
    gray_diff = (gray_diff * 255).astype(np.uint8)
    
    heatmap = cv2.applyColorMap(gray_diff, cv2.COLORMAP_JET)
    heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
    
    overlay = cv2.addWeighted(np.array(orig_img), 0.5, heatmap, 0.5, 0)
    return Image.fromarray(overlay)

def test_single_image(image_path, category, output_dir="single_test_outputs"):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    
    # تحديد مسار النماذج
    model_path = f"trained_models/model_{category}"
    config_file = os.path.join(model_path, 'model_config.json')
    if_model_path = os.path.join(model_path, 'iforest_model.pkl')

    if not os.path.exists(config_file) or not os.path.exists(if_model_path):
        print(f"Error: Trained models for category '{category}' not found in '{model_path}'.")
        return

    with open(config_file, 'r') as f:
        cfg = json.load(f)
        
    opt_strength = cfg.get('strength', CATEGORIES.get(category, {}).get('strength', 0.40))
    opt_guidance = cfg.get('guidance', CATEGORIES.get(category, {}).get('guidance', 7.5))
    threshold = cfg['optimal_threshold']

    print(f"Loading Generative Engine and Adapters for '{category}'...")
    pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
        "runwayml/stable-diffusion-v1-5", torch_dtype=torch.float16, safety_checker=None, local_files_only=True).to(device)
    pipe.unet = PeftModel.from_pretrained(pipe.unet, model_path)
    
    print("Loading Statistical Classifier...")
    if_model = joblib.load(if_model_path)
    metrics_gen = MetricsFactory(device=device)

    try:
        img = Image.open(image_path).convert("RGB")
    except Exception as e:
        print(f"Error loading image: {e}")
        return

    prompt_text = f"a high quality photo of a perfect {category}"
    use_patch_mode = category in ["capsule", "pill"]

    print(f"Analyzing image using {'Patch' if use_patch_mode else 'Full Image'} architecture...")
    
    if use_patch_mode:
        img_1024 = img.resize((1024, 1024))
        patches = [
            img_1024.crop((0, 0, 512, 512)), img_1024.crop((512, 0, 1024, 512)),
            img_1024.crop((0, 512, 512, 1024)), img_1024.crop((512, 512, 1024, 1024))
        ]
        patch_metrics, recons = [], []
        
        for patch in patches:
            with torch.no_grad():
                recon = pipe(prompt=prompt_text, image=patch, strength=opt_strength, guidance_scale=opt_guidance, num_inference_steps=30, generator=torch.Generator(device=device).manual_seed(999)).images[0]
            sc = metrics_gen.calculate_metrics(patch, recon)
            patch_metrics.append(sc)
            recons.append(recon)
            
        scores = {
            'L1': max(s['L1'] for s in patch_metrics), 'L2': max(s['L2'] for s in patch_metrics),
            'MS_SSIM': min(s['MS_SSIM'] for s in patch_metrics), 'LPIPS': max(s['LPIPS'] for s in patch_metrics),
            'Max_Patch': max(s['Max_Patch'] for s in patch_metrics)
        }
        
        final_recon = Image.new('RGB', (1024, 1024))
        final_recon.paste(recons[0], (0, 0)); final_recon.paste(recons[1], (512, 0))
        final_recon.paste(recons[2], (0, 512)); final_recon.paste(recons[3], (512, 512))
        
        anomaly_map_img = create_anomaly_map(img_1024, final_recon)
        comparison = Image.new('RGB', (3072, 1024))
        comparison.paste(img_1024, (0, 0))
        comparison.paste(final_recon, (1024, 0))
        comparison.paste(anomaly_map_img, (2048, 0))

    else:
        img_512 = img.resize((512, 512))
        with torch.no_grad():
            recon = pipe(prompt=prompt_text, image=img_512, strength=opt_strength, guidance_scale=opt_guidance, num_inference_steps=30, generator=torch.Generator(device=device).manual_seed(999)).images[0]
        
        scores = metrics_gen.calculate_metrics(img_512, recon)
        anomaly_map_img = create_anomaly_map(img_512, recon)
        
        comparison = Image.new('RGB', (1536, 512))
        comparison.paste(img_512, (0, 0))
        comparison.paste(recon, (512, 0))
        comparison.paste(anomaly_map_img, (1024, 0))

    feat = np.array([[scores[feat_name] for feat_name in FEATURES]])
    score = -if_model.decision_function(feat)[0]
    
    is_anomaly = score >= threshold
    
    os.makedirs(output_dir, exist_ok=True)
    base_name = os.path.basename(image_path)
    output_path = os.path.join(output_dir, f"tested_{base_name}")
    comparison.save(output_path)
    
    print("\n" + "="*40)
    print("           INSPECTION REPORT")
    print("="*40)
    print(f"File: {image_path}")
    print(f"Category: {category.capitalize()}")
    print(f"Anomaly Score: {score:.4f}")
    print(f"Threshold limit: {threshold:.4f}")
    print("-" * 40)
    
    if is_anomaly:
        print("Final Decision: [ DEFECTIVE / AFFECTED ]")
    else:
        print("Final Decision: [ NORMAL / GOOD ]")
        
    print("="*40)
    print(f"Visual heatmap saved to: {output_path}")

if __name__ == "__main__":
    start_time = time.time()
    parser = argparse.ArgumentParser(description="Test a single image for defects.")
    parser.add_argument("image_path", help="Path to the image you want to test")
    parser.add_argument("category", help="Category of the product (e.g., bottle, pill, capsule, toothbrush)")
    args = parser.parse_args()
    test_single_image(args.image_path, args.category)
    end_time = time.time()
    print(f"Total execution time: {end_time - start_time:.2f} seconds")