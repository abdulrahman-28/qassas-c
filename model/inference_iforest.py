import os
import torch
import numpy as np
import joblib
import json
import pandas as pd
import gc
import cv2  # 🔥 تمت إضافة مكتبة OpenCV لخرائط الشذوذ
from PIL import Image
from diffusers import StableDiffusionImg2ImgPipeline
from peft import PeftModel
from sklearn.metrics import precision_score, recall_score, f1_score, accuracy_score
from metrics_factory import MetricsFactory
from tqdm import tqdm
from sklearn.model_selection import train_test_split
from config import CATEGORIES, FEATURES

FORCE_RUN = True 
device = "cuda" if torch.cuda.is_available() else "cpu"

def clean_memory():
    gc.collect()
    torch.cuda.empty_cache()

# 🔥 دالة جديدة لإنشاء خريطة الشذوذ الحرارية (Heatmap)
def create_anomaly_map(orig_img, recon_img):
    orig_np = np.array(orig_img).astype(np.float32)
    recon_np = np.array(recon_img).astype(np.float32)
    
    # حساب الفروقات البكسلية المطلقة
    diff = np.abs(orig_np - recon_np)
    gray_diff = np.mean(diff, axis=2)
    
    # تطبيع القيم (Normalization) لتناسب خريطة الألوان
    gray_diff = (gray_diff - gray_diff.min()) / (gray_diff.max() - gray_diff.min() + 1e-8)
    gray_diff = (gray_diff * 255).astype(np.uint8)
    
    # تطبيق خريطة الحرارة (أزرق للسليم، أحمر للعيب)
    heatmap = cv2.applyColorMap(gray_diff, cv2.COLORMAP_JET)
    heatmap = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
    
    # دمج خريطة الحرارة مع الصورة الأصلية بنسبة 50/50
    overlay = cv2.addWeighted(np.array(orig_img), 0.5, heatmap, 0.5, 0)
    return Image.fromarray(overlay)

def inference_full_image(img, category, pipe, strength, guidance, metrics_gen, filename):
    img_512 = img.resize((512, 512))
    actual_item = os.path.basename(filename).split('_')[0] if category == "all" else category
    prompt_text = f"a high quality photo of a perfect {actual_item}"
    
    with torch.no_grad():
        recon = pipe(prompt=prompt_text, image=img_512, 
                     strength=strength, guidance_scale=guidance, num_inference_steps=30,
                     generator=torch.Generator(device=device).manual_seed(999)).images[0]
    
    sc = metrics_gen.calculate_metrics(img_512, recon)
    
    # 🔥 إنشاء خريطة الشذوذ
    anomaly_map_img = create_anomaly_map(img_512, recon)
    
    # 🔥 دمج الصور الثلاث في لوحة واحدة (Original | Reconstructed | Anomaly Map)
    comparison = Image.new('RGB', (1536, 512))
    comparison.paste(img_512, (0, 0))
    comparison.paste(recon, (512, 0))
    comparison.paste(anomaly_map_img, (1024, 0))
    return sc, comparison

def inference_with_patches(img, category, pipe, strength, guidance, metrics_gen, filename):
    img_1024 = img.resize((1024, 1024))
    patches = [
        img_1024.crop((0, 0, 512, 512)), img_1024.crop((512, 0, 1024, 512)),
        img_1024.crop((0, 512, 512, 1024)), img_1024.crop((512, 512, 1024, 1024))
    ]
    patch_metrics, recons = [], []
    
    actual_item = os.path.basename(filename).split('_')[0] if category == "all" else category
    prompt_text = f"a high quality photo of a perfect {actual_item}"
    
    for patch in patches:
        with torch.no_grad():
            recon = pipe(prompt=prompt_text, image=patch, 
                         strength=strength, guidance_scale=guidance, num_inference_steps=30,
                         generator=torch.Generator(device=device).manual_seed(999)).images[0]
        sc = metrics_gen.calculate_metrics(patch, recon)
        patch_metrics.append(sc)
        recons.append(recon)
        
    final_scores = {
        'L1': max(s['L1'] for s in patch_metrics), 'L2': max(s['L2'] for s in patch_metrics),
        'MS_SSIM': min(s['MS_SSIM'] for s in patch_metrics), 'LPIPS': max(s['LPIPS'] for s in patch_metrics),
        'Max_Patch': max(s['Max_Patch'] for s in patch_metrics)
    }
    
    final_recon = Image.new('RGB', (1024, 1024))
    final_recon.paste(recons[0], (0, 0)); final_recon.paste(recons[1], (512, 0))
    final_recon.paste(recons[2], (0, 512)); final_recon.paste(recons[3], (512, 512))
    
    # 🔥 إنشاء خريطة الشذوذ للصورة المجمعة (1024x1024)
    anomaly_map_img = create_anomaly_map(img_1024, final_recon)
    
    # 🔥 دمج الصور الثلاث في لوحة واحدة (Original | Reconstructed | Anomaly Map)
    comparison = Image.new('RGB', (3072, 1024))
    comparison.paste(img_1024, (0, 0))
    comparison.paste(final_recon, (1024, 0))
    comparison.paste(anomaly_map_img, (2048, 0))
    return final_scores, comparison

def run_final_inference(category):
    path = f"trained_models/model_{category}"
    config_file = os.path.join(path, 'model_config.json')
    report_file = os.path.join(path, 'metrics_report.json')
    csv_file = os.path.join(path, "pure_results_database.csv")

    if os.path.exists(report_file) and not FORCE_RUN:
        with open(report_file, 'r') as f: return json.load(f) 

    if not os.path.exists(config_file) or not os.path.exists(csv_file): return None

    with open(config_file, 'r') as f: cfg = json.load(f)
        
    opt_strength = cfg.get('strength', CATEGORIES[category]['strength'])
    opt_guidance = cfg.get('guidance', CATEGORIES[category]['guidance'])
        
    df = pd.read_csv(csv_file).dropna()
    df_test_csv = df[df['Split'] == 'Test']
    _, df_blind_test = train_test_split(df_test_csv, test_size=0.5, stratify=df_test_csv['Label'], random_state=42)
    blind_test_filenames = set(df_blind_test['Filename'].tolist())
        
    print(f"\n--- Testing (BLIND HYBRID MODE) {category.upper()} [S: {opt_strength} | G: {opt_guidance}] ---")
    pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
        "runwayml/stable-diffusion-v1-5", torch_dtype=torch.float16, safety_checker=None, local_files_only=True).to(device)
    pipe.unet = PeftModel.from_pretrained(pipe.unet, path)
    if_model = joblib.load(os.path.join(path, 'iforest_model.pkl'))
    metrics_gen = MetricsFactory(device=device)
    
    test_path = "test" if os.path.exists("test") else "data/test"
    files = [f for f in os.listdir(test_path) if f in blind_test_filenames]
    
    y_true, y_pred = [], []
    
    # 🔥 تغيير مجلد الحفظ ليتوافق مع طلبك
    report_img_dir = f"anomaly_maps_output/{category}"
    os.makedirs(report_img_dir, exist_ok=True)

    saved_anomalies_count = 0

    for f in tqdm(files, desc=f"Inference: {category}"):
        if not f.lower().endswith(('.png', '.jpg')): continue
        
        with Image.open(os.path.join(test_path, f)) as img_file:
            img = img_file.convert("RGB")
            
            actual_item = os.path.basename(f).split('_')[0] if category == "all" else category
            use_patch_mode = actual_item in ["capsule", "pill"]
            
            if use_patch_mode:
                scores, comparison_img = inference_with_patches(img, category, pipe, opt_strength, opt_guidance, metrics_gen, f)
            else:
                scores, comparison_img = inference_full_image(img, category, pipe, opt_strength, opt_guidance, metrics_gen, f)
                
            feat = np.array([[scores[feat_name] for feat_name in FEATURES]]) 
            
            score = -if_model.decision_function(feat)[0]
            pred = 1 if score >= cfg['optimal_threshold'] else 0
            
            y_true.append(0 if "good" in f.lower() else 1)
            y_pred.append(pred)

            # 🔥 سيقوم بحفظ 20 عينة معيبة بدلاً من 10 ليكون لديك صور كافية للتقرير
            if pred == 1 and saved_anomalies_count < 20:
                comparison_img.save(os.path.join(report_img_dir, f"heatmap_{f}"))
                saved_anomalies_count += 1

    results = {
        "Category": category, "Accuracy": accuracy_score(y_true, y_pred),
        "F1": f1_score(y_true, y_pred, zero_division=0),
        "Recall": recall_score(y_true, y_pred, zero_division=0),
        "Precision": precision_score(y_true, y_pred, zero_division=0)
    }

    with open(report_file, 'w') as f: json.dump(results, f, indent=4)
    print(f" {category.upper()} Tested. Accuracy: {results['Accuracy']*100:.2f}%")
    del pipe, if_model, metrics_gen
    clean_memory()
    return results

final_stats = []
for cat in CATEGORIES.keys():
    res = run_final_inference(cat)
    if res: final_stats.append(res)

if final_stats:
    pd.DataFrame(final_stats).to_csv("FINAL_QASSAS_REPORT_BLIND.csv", index=False)
    print("\nBlind Master report saved as 'FINAL_QASSAS_REPORT_BLIND.csv'")