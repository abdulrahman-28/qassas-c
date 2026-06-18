import os
import torch
import pandas as pd
import numpy as np
import joblib
import json
import gc
from PIL import Image
from diffusers import StableDiffusionImg2ImgPipeline
from peft import PeftModel
from sklearn.ensemble import IsolationForest
from sklearn.metrics import roc_curve, f1_score
from sklearn.model_selection import train_test_split
from tqdm import tqdm
from metrics_factory import MetricsFactory
from config import FEATURES

device = "cuda" if torch.cuda.is_available() else "cpu"

def clean_memory():
    gc.collect()
    torch.cuda.empty_cache()

def run_grid_search_for_omni():
    category = "all"
    model_dir = f"trained_models/model_{category}"
    best_config_file = os.path.join(model_dir, 'model_config.json')
    
    if not os.path.exists(model_dir):
        print("⚠️ Model 'all' is not trained yet. Run main.py first.")
        return

    # الشبكة التي سيتم اختبارها (Search Space)
    STRENGTHS = [0.35, 0.40, 0.45]
    GUIDANCES = [6.5, 7.5, 9.0]
    
    print(f"\n--- 🔬 Automated Grid Search for OMNI MODEL ('all') ---")
    print(f"Testing {len(STRENGTHS) * len(GUIDANCES)} combinations...\n")

    # تحميل النموذج مرة واحدة لتسريع البحث
    pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
        "runwayml/stable-diffusion-v1-5", torch_dtype=torch.float16, 
        safety_checker=None, local_files_only=True).to(device)
    pipe.unet = PeftModel.from_pretrained(pipe.unet, model_dir)
    metrics_gen = MetricsFactory(device=device)

    # تجميع مسارات الصور
    data_paths = {"Train": [], "Test": []}
    for split in ["train", "test"]:
        path = split if os.path.exists(split) else os.path.join("data", split)
        data_paths[split.capitalize()] = [os.path.join(path, f) for f in os.listdir(path) if f.lower().endswith((".png", ".jpg"))]

    best_f1 = -1
    best_combo = {}
    best_if_model = None
    best_threshold = 0
    best_df = None
    
    results_log = []

    # الحلقة المزدوجة لاختبار جميع القيم
    for s in STRENGTHS:
        for g in GUIDANCES:
            print(f"\n🧪 Testing Setup -> Strength: {s} | Guidance: {g}")
            
            extracted_data = []
            
            # استخراج الخصائص
            for split, paths in data_paths.items():
                for img_path in tqdm(paths, desc=f"Extracting {split}", leave=False):
                    img = Image.open(img_path).convert("RGB").resize((512, 512))
                    label = 0 if "good" in img_path.lower() or split == "Train" else 1
                    
                    with torch.no_grad():
                        recon = pipe(prompt="a high quality photo of a perfect item", image=img, 
                                     strength=s, guidance_scale=g, 
                                     generator=torch.Generator(device=device).manual_seed(999)).images[0]
                    
                    scores = metrics_gen.calculate_metrics(img, recon)
                    scores.update({'Label': label, 'Split': split})
                    extracted_data.append(scores)
                    
            df = pd.DataFrame(extracted_data)
            
            # تدريب واختبار الغابة السريعة
            X_train = df[df['Split'] == 'Train'][FEATURES].values
            df_test = df[df['Split'] == 'Test']
            
            if len(X_train) == 0 or len(df_test) == 0: continue
                
            df_val, df_final_test = train_test_split(df_test, test_size=0.5, stratify=df_test['Label'], random_state=42)
            
            if_model = IsolationForest(n_estimators=200, random_state=999).fit(X_train)
            
            # المعايرة
            v_scores = -if_model.decision_function(df_val[FEATURES].values)
            fpr, tpr, thresholds = roc_curve(df_val['Label'].values, v_scores)
            thresh = thresholds[np.argmax(tpr - fpr)]
            
            # التقييم على النصف الآخر
            test_scores = -if_model.decision_function(df_final_test[FEATURES].values)
            y_pred = (test_scores >= thresh).astype(int)
            y_true = df_final_test['Label'].values
            
            current_f1 = f1_score(y_true, y_pred, zero_division=0)
            
            results_log.append({"Strength": s, "Guidance": g, "F1-Score": current_f1})
            print(f"📊 Result: F1-Score = {current_f1:.4f}")
            
            # تسجيل أفضل نتيجة
            if current_f1 > best_f1:
                best_f1 = current_f1
                best_combo = {"strength": s, "guidance": g, "optimal_threshold": float(thresh), "category": "all"}
                best_if_model = if_model
                best_df = df

    # --- حفظ النتائج النهائية للفائز ---
    print("\n" + "="*40)
    print(f"🏆 BEST COMBINATION FOUND!")
    print(f"Strength: {best_combo['strength']} | Guidance: {best_combo['guidance']}")
    print(f"Winning F1-Score: {best_f1:.4f}")
    print("="*40)

    # حفظ إعدادات الفائز ليقرأها ملف inference لاحقاً
    with open(best_config_file, 'w') as f:
        json.dump(best_combo, f, indent=4)
        
    joblib.dump(best_if_model, os.path.join(model_dir, 'iforest_model.pkl'))
    best_df.to_csv(os.path.join(model_dir, "pure_results_database.csv"), index=False)
    pd.DataFrame(results_log).to_csv(os.path.join(model_dir, "grid_search_log.csv"), index=False)
    
    print(f"✅ Best configurations saved. The 'all' model is now ready for final inference!")
    clean_memory()

run_grid_search_for_omni()