import os
import pandas as pd
import numpy as np
import joblib
import json
import gc
from sklearn.ensemble import IsolationForest
from sklearn.metrics import roc_curve
from sklearn.model_selection import train_test_split, StratifiedKFold
from config import CATEGORIES, FEATURES

FORCE_RUN = True 

def train_if(category):
    path = f"trained_models/model_{category}"
    csv_file = os.path.join(path, "pure_results_database.csv")
    model_file = os.path.join(path, 'iforest_model.pkl')
    config_file = os.path.join(path, 'model_config.json')

    if os.path.exists(model_file) and os.path.exists(config_file) and not FORCE_RUN:
        print(f"\nSKIPPING {category.upper()}: IForest model already trained.")
        return

    if not os.path.exists(csv_file): return

    print(f"\n--- Training IForest: {category.upper()} (Robust K-Fold CV Mode) ---")
    df = pd.read_csv(csv_file).dropna()
    
    X_train = df[df['Split'] == 'Train'][FEATURES].values
    df_test = df[df['Split'] == 'Test']
    
    if len(X_train) == 0 or len(df_test) == 0: return

    df_val, _ = train_test_split(df_test, test_size=0.5, stratify=df_test['Label'], random_state=42)
    model = IsolationForest(n_estimators=200, random_state=999).fit(X_train)
    
    y_val_labels = df_val['Label'].values
    X_val_features = df_val[FEATURES].values
    v_scores_val = -model.decision_function(X_val_features)
    
    min_class_count = np.min(np.bincount(y_val_labels))
    n_splits = min(5, min_class_count)
    
    fold_thresholds = []
    target_recall = 0.90
    
    if n_splits >= 2:
        skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        for train_idx, val_idx in skf.split(X_val_features, y_val_labels):
            fold_y = y_val_labels[val_idx]
            fold_scores = v_scores_val[val_idx]
            
            if len(np.unique(fold_y)) > 1:
                fpr, tpr, thresholds = roc_curve(fold_y, fold_scores)
                valid_indices = np.where(tpr >= target_recall)[0]
                
                if len(valid_indices) > 0:
                    best_idx = valid_indices[np.argmin(fpr[valid_indices])]
                    fold_thresholds.append(thresholds[best_idx])
                else:
                    fold_thresholds.append(thresholds[np.argmax(tpr - fpr)])
                    
        if fold_thresholds:
            final_thresh = np.mean(fold_thresholds)
            print(f"Validated Threshold via {n_splits}-Fold CV: {final_thresh:.4f}")
        else:
            final_thresh = 0.0
    else:
        fpr, tpr, thresholds = roc_curve(y_val_labels, v_scores_val)
        valid_indices = np.where(tpr >= target_recall)[0]
        if len(valid_indices) > 0:
            best_idx = valid_indices[np.argmin(fpr[valid_indices])]
            final_thresh = thresholds[best_idx]
        else:
            final_thresh = thresholds[np.argmax(tpr - fpr)]
        print(f"Fallback Threshold without CV: {final_thresh:.4f}")
    
    with open(config_file, 'w') as f:
        json.dump({"optimal_threshold": float(final_thresh), "category": category}, f)
        
    joblib.dump(model, model_file)
    del model, df, X_train, df_test, df_val
    gc.collect()

for cat in CATEGORIES.keys():
    train_if(cat)