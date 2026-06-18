import os
import torch
import pandas as pd
import gc
from PIL import Image
from diffusers import StableDiffusionImg2ImgPipeline
from peft import PeftModel
from tqdm import tqdm
from metrics_factory import MetricsFactory
from config import CATEGORIES

FORCE_RUN = True 
device = "cuda" if torch.cuda.is_available() else "cpu"
metrics_gen = MetricsFactory(device=device)

def clean_memory():
    gc.collect()
    torch.cuda.empty_cache()

def process_full_image(img, category, pipe, strength, guidance, filename):
    img_512 = img.resize((512, 512))
    actual_item = os.path.basename(filename).split('_')[0] if category == "all" else category
    prompt_text = f"a high quality photo of a perfect {actual_item}"
    
    with torch.no_grad():
        recon = pipe(prompt=prompt_text, image=img_512, 
                     strength=strength, guidance_scale=guidance, num_inference_steps=30,
                     generator=torch.Generator(device=device).manual_seed(999)).images[0]
    
    sc = metrics_gen.calculate_metrics(img_512, recon)
    return sc

def process_image_with_patches(img, category, pipe, strength, guidance, filename):
    img_1024 = img.resize((1024, 1024))
    patches = [
        img_1024.crop((0, 0, 512, 512)), img_1024.crop((512, 0, 1024, 512)),
        img_1024.crop((0, 512, 512, 1024)), img_1024.crop((512, 512, 1024, 1024))
    ]
    patch_metrics = []
    
    actual_item = os.path.basename(filename).split('_')[0] if category == "all" else category
    prompt_text = f"a high quality photo of a perfect {actual_item}"
    
    for patch in patches:
        with torch.no_grad():
            recon = pipe(prompt=prompt_text, image=patch, 
                         strength=strength, guidance_scale=guidance, num_inference_steps=30,
                         generator=torch.Generator(device=device).manual_seed(999)).images[0]
        sc = metrics_gen.calculate_metrics(patch, recon)
        patch_metrics.append(sc)
        
    final_scores = {
        'L1': max(s['L1'] for s in patch_metrics), 'L2': max(s['L2'] for s in patch_metrics),
        'MS_SSIM': min(s['MS_SSIM'] for s in patch_metrics), 'LPIPS': max(s['LPIPS'] for s in patch_metrics),
        'Max_Patch': max(s['Max_Patch'] for s in patch_metrics)
    }
    return final_scores

def run_extraction(category):
    model_dir = f"trained_models/model_{category}"
    csv_path = os.path.join(model_dir, "pure_results_database.csv")

    if os.path.exists(csv_path) and not FORCE_RUN:
        print(f"\nSKIPPING {category.upper()}: Features already extracted.")
        return

    if not os.path.exists(model_dir): return

    print(f"\n--- Extracting Features (HYBRID MODE): {category.upper()} ---")
    pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
        "runwayml/stable-diffusion-v1-5", torch_dtype=torch.float16, safety_checker=None, local_files_only=True).to(device)
    pipe.unet = PeftModel.from_pretrained(pipe.unet, model_dir)
    
    results = []
    
    for split in ["train", "test"]:
        path = split if os.path.exists(split) else os.path.join("data", split)
        if not os.path.exists(path): continue
        files = [f for f in os.listdir(path) if f.startswith(f"{category}_") or category == "all"]

        for f in tqdm(files, desc=f"Split: {split.capitalize()}"):
            if not f.lower().endswith(('.png', '.jpg')): continue
            
            with Image.open(os.path.join(path, f)) as img_file:
                img = img_file.convert("RGB")
                label = 0 if "good" in f.lower() or split == "train" else 1
                
                actual_item = os.path.basename(f).split('_')[0] if category == "all" else category
                use_patch_mode = actual_item in ["capsule", "pill"]
                
                if use_patch_mode:
                    scores = process_image_with_patches(img, category, pipe, CATEGORIES[category]["strength"], CATEGORIES[category]["guidance"], f)
                else:
                    scores = process_full_image(img, category, pipe, CATEGORIES[category]["strength"], CATEGORIES[category]["guidance"], f)
                    
                scores.update({'Category': category, 'Label': label, 'Split': split.capitalize(), 'Filename': f})
                results.append(scores)
            
    pd.DataFrame(results).to_csv(csv_path, index=False)
    del pipe
    clean_memory()

for cat in CATEGORIES.keys():
    run_extraction(cat)