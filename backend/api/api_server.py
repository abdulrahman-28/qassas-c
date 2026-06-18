import sys
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

import json
import base64
import joblib
import numpy as np
import cv2
import torch
from io import BytesIO
from contextlib import asynccontextmanager
from threading import Lock

from fastapi import FastAPI, File, Form, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
from diffusers import StableDiffusionImg2ImgPipeline
from peft import PeftModel

from metrics_factory import MetricsFactory
from config import CATEGORIES, FEATURES

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

state: dict = {}

# Serializes inference calls so LoRA adapter swaps don't race
_inference_lock = Lock()


def _model_base_dir() -> str:
    override = os.environ.get("MODEL_DIR_OVERRIDE")
    if override:
        base = os.path.dirname(os.path.normpath(override))
        print(f"[path] Using MODEL_DIR_OVERRIDE parent: {base}")
        return base

    explicit = os.environ.get("MODEL_DIR_BASE")
    if explicit:
        base = os.path.normpath(explicit)
        print(f"[path] Using MODEL_DIR_BASE env var: {base}")
        return base

    # Auto-detect: try both known candidate locations.
    # Pick the one that has the most valid model_{category} subdirectories.
    candidates = [
        os.path.normpath(os.path.join(BASE_DIR, "..", "model", "trained_models")),
        os.path.normpath(os.path.join(BASE_DIR, "..", "..", "model_test",
                                      "qassas_backend_release", "trained_models")),
    ]
    best_path, best_count = candidates[0], -1
    for c in candidates:
        if not os.path.isdir(c):
            print(f"[path] Candidate not found: {c}")
            continue
        count = sum(
            1 for cat in CATEGORIES
            if os.path.isdir(os.path.join(c, f"model_{cat}"))
            and os.path.exists(os.path.join(c, f"model_{cat}", "model_config.json"))
            and os.path.exists(os.path.join(c, f"model_{cat}", "iforest_model.pkl"))
        )
        print(f"[path] Candidate {c}: {count} valid model(s)")
        if count > best_count:
            best_count = count
            best_path = c

    print(f"[path] Selected: {best_path} ({best_count} model(s) found)")
    return best_path


@asynccontextmanager
async def lifespan(app: FastAPI):
    base_dir = _model_base_dir()
    print(f"\n{'='*60}")
    print(f"[STARTUP] Model base dir : {base_dir}")
    print(f"[STARTUP] Device         : {DEVICE}")
    print(f"[STARTUP] torch dtype    : {'float16' if DEVICE == 'cuda' else 'float32'}")
    print(f"[STARTUP] Looking for    : {list(CATEGORIES.keys())}")
    print(f"{'='*60}")

    found: dict[str, str] = {}
    for cat in CATEGORIES:
        d          = os.path.join(base_dir, f"model_{cat}")
        has_dir    = os.path.isdir(d)
        has_config = os.path.exists(os.path.join(d, "model_config.json"))
        has_pkl    = os.path.exists(os.path.join(d, "iforest_model.pkl"))
        if has_dir and has_config and has_pkl:
            found[cat] = d
            print(f"[STARTUP] FOUND     model_{cat}  →  {d}")
        else:
            missing = []
            if not has_dir:    missing.append("dir missing")
            if not has_config: missing.append("model_config.json missing")
            if not has_pkl:    missing.append("iforest_model.pkl missing")
            print(f"[STARTUP] NOT FOUND model_{cat}  →  {d}  [{', '.join(missing)}]")

    if not found:
        raise RuntimeError(
            f"No trained models found under {base_dir}. "
            "Set MODEL_DIR_BASE to the directory containing model_<category> subdirectories."
        )

    # Load Stable Diffusion base pipeline once
    torch_dtype = torch.float16 if DEVICE == "cuda" else torch.float32
    sd_cache    = os.environ.get("SD_CACHE_DIR")  # e.g. /content/drive/MyDrive/sd_cache
    print(f"\n[STARTUP] Loading SD pipeline (dtype={torch_dtype}, cache={sd_cache or 'default'})...")
    try:
        pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            torch_dtype=torch_dtype,
            safety_checker=None,
            cache_dir=sd_cache,
            local_files_only=True,
        ).to(DEVICE)
    except Exception:
        print("[STARTUP] SD model not cached locally — downloading now...")
        pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
            "runwayml/stable-diffusion-v1-5",
            torch_dtype=torch_dtype,
            safety_checker=None,
            cache_dir=sd_cache,
        ).to(DEVICE)
    pipe.set_progress_bar_config(disable=True)

    cat_models: dict[str, dict] = {}
    peft_unet = None

    for i, (cat, model_dir) in enumerate(found.items()):
        print(f"\n[STARTUP] Loading '{cat}' from {model_dir} ...")
        with open(os.path.join(model_dir, "model_config.json")) as f:
            cfg = json.load(f)

        strength  = cfg.get("strength",  CATEGORIES.get(cat, CATEGORIES["all"])["strength"])
        guidance  = cfg.get("guidance",  CATEGORIES.get(cat, CATEGORIES["all"])["guidance"])
        threshold = float(cfg["optimal_threshold"])

        print(f"[STARTUP]   optimal_threshold : {threshold:.6f}  "
              f"(anomaly_score space — same as test_single.py: score = -decision_function(feat))")
        print(f"[STARTUP]   strength          : {strength}")
        print(f"[STARTUP]   guidance          : {guidance}")
        print(f"[STARTUP]   decision rule     : is_anomaly = (score >= {threshold:.6f})")

        cat_models[cat] = {
            "iforest":   joblib.load(os.path.join(model_dir, "iforest_model.pkl")),
            "threshold": threshold,
            "strength":  strength,
            "guidance":  guidance,
            "model_dir": model_dir,
        }

        # LoRA loading mirrors test_single.py per category; all share one base UNet via
        # PEFT multi-adapter. set_adapter(cat) at inference time isolates each adapter.
        if i == 0:
            peft_unet = PeftModel.from_pretrained(pipe.unet, model_dir, adapter_name=cat)
            print(f"[STARTUP]   LoRA: PeftModel.from_pretrained(unet, ..., adapter_name='{cat}')")
        else:
            peft_unet.load_adapter(model_dir, adapter_name=cat)
            print(f"[STARTUP]   LoRA: load_adapter(..., adapter_name='{cat}')")

    pipe.unet = peft_unet

    state["pipe"]       = pipe
    state["peft_unet"]  = peft_unet
    state["cat_models"] = cat_models
    state["metrics"]    = MetricsFactory(device=DEVICE)

    print(f"\n{'='*60}")
    print(f"[STARTUP] Ready. Loaded models: {sorted(cat_models)}")
    print(f"{'='*60}\n")
    yield
    state.clear()


app = FastAPI(title="Qassas Anomaly Detection API", lifespan=lifespan)

_allow_origin = os.environ.get("ALLOW_ORIGIN", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_allow_origin],
    allow_methods=["*"],
    allow_headers=["*"],
)


def create_anomaly_map(orig_img: Image.Image, recon_img: Image.Image) -> Image.Image:
    orig_np   = np.array(orig_img).astype(np.float32)
    recon_np  = np.array(recon_img).astype(np.float32)
    diff      = np.abs(orig_np - recon_np)
    gray_diff = np.mean(diff, axis=2)
    gray_diff = (gray_diff - gray_diff.min()) / (gray_diff.max() - gray_diff.min() + 1e-8)
    gray_diff = (gray_diff * 255).astype(np.uint8)
    heatmap   = cv2.applyColorMap(gray_diff, cv2.COLORMAP_JET)
    heatmap   = cv2.cvtColor(heatmap, cv2.COLOR_BGR2RGB)
    overlay   = cv2.addWeighted(np.array(orig_img), 0.5, heatmap, 0.5, 0)
    return Image.fromarray(overlay)


def image_to_base64(img: Image.Image) -> str:
    buf = BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()


@app.get("/health")
def health():
    cat_models = state.get("cat_models", {})
    return {
        "status": "ok",
        "loaded_models": sorted(cat_models.keys()),
        "model_configs": {
            cat: {
                "threshold": info["threshold"],
                "strength":  info["strength"],
                "guidance":  info["guidance"],
                "model_dir": info["model_dir"],
            }
            for cat, info in cat_models.items()
        },
    }


@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    product_type: str = Form(default="all"),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image.")

    requested_cat = product_type.lower().strip()
    cat_models    = state["cat_models"]

    print(f"\n{'='*60}")
    print(f"[PREDICT] product_type received : '{product_type}'")
    print(f"[PREDICT] normalized            : '{requested_cat}'")
    print(f"[PREDICT] loaded models         : {sorted(cat_models)}")

    # Resolve which model to use
    if requested_cat in cat_models:
        cat = requested_cat
        print(f"[PREDICT] resolved category     : '{cat}'  (exact match)")
    elif "all" in cat_models:
        cat = "all"
        print(f"[PREDICT] resolved category     : '{cat}'  "
              f"(FALLBACK — no model for '{requested_cat}')")
        print(f"[PREDICT] WARNING: 'all' model has threshold "
              f"{cat_models['all']['threshold']:.6f} which differs from per-category "
              f"thresholds. Results will NOT match test_single.py run with '{requested_cat}'.")
    else:
        raise HTTPException(
            status_code=400,
            detail=(
                f"No model loaded for product_type='{requested_cat}' "
                f"and no 'all' fallback available. "
                f"Loaded models: {sorted(cat_models)}. "
                f"Check MODEL_DIR_BASE environment variable."
            ),
        )

    model_info = cat_models[cat]
    iforest    = model_info["iforest"]
    threshold  = model_info["threshold"]
    strength   = model_info["strength"]
    guidance   = model_info["guidance"]
    model_dir  = model_info["model_dir"]

    print(f"[PREDICT] model_dir             : {model_dir}")
    print(f"[PREDICT] threshold             : {threshold:.6f}")
    print(f"[PREDICT] strength              : {strength}")
    print(f"[PREDICT] guidance              : {guidance}")

    # Use resolved `cat` for both prompt and patch_mode — matches test_single.py
    # (test_single.py: prompt_text = f"a high quality photo of a perfect {category}"
    #                  use_patch_mode = category in ["capsule", "pill"])
    prompt         = f"a high quality photo of a perfect {cat}"
    use_patch_mode = cat in ("capsule", "pill")

    print(f"[PREDICT] prompt                : '{prompt}'")
    print(f"[PREDICT] patch_mode            : {use_patch_mode}")

    contents = await file.read()
    print(f"[PREDICT] image bytes           : {len(contents)}")
    try:
        img = Image.open(BytesIO(contents)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Could not read image file.")
    print(f"[PREDICT] image size (original) : {img.size}")

    print(f"[PREDICT] Running inference on {DEVICE} ...")

    with _inference_lock:
        print(f"[PREDICT] set_adapter('{cat}')")
        state["peft_unet"].set_adapter(cat)

        if use_patch_mode:
            img_1024 = img.resize((1024, 1024))
            patches  = [
                img_1024.crop((0,   0,   512,  512)),
                img_1024.crop((512, 0,  1024,  512)),
                img_1024.crop((0,   512, 512, 1024)),
                img_1024.crop((512, 512, 1024, 1024)),
            ]
            patch_metrics_list: list[dict] = []
            recons: list[Image.Image] = []

            for pi, patch in enumerate(patches):
                with torch.no_grad():
                    recon_patch = state["pipe"](
                        prompt=prompt,
                        image=patch,
                        strength=strength,
                        guidance_scale=guidance,
                        num_inference_steps=30,
                        generator=torch.Generator(device=DEVICE).manual_seed(999),
                    ).images[0]
                pm = state["metrics"].calculate_metrics(patch, recon_patch)
                print(f"[PREDICT] patch[{pi}] metrics: {pm}")
                patch_metrics_list.append(pm)
                recons.append(recon_patch)

            scores = {
                "L1":        max(s["L1"]        for s in patch_metrics_list),
                "L2":        max(s["L2"]        for s in patch_metrics_list),
                "MS_SSIM":   min(s["MS_SSIM"]   for s in patch_metrics_list),
                "LPIPS":     max(s["LPIPS"]     for s in patch_metrics_list),
                "Max_Patch": max(s["Max_Patch"] for s in patch_metrics_list),
            }

            final_recon = Image.new("RGB", (1024, 1024))
            final_recon.paste(recons[0], (0,   0))
            final_recon.paste(recons[1], (512, 0))
            final_recon.paste(recons[2], (0,   512))
            final_recon.paste(recons[3], (512, 512))

            input_for_map      = img_1024
            recon_for_response = final_recon

        else:
            img_512 = img.resize((512, 512))
            with torch.no_grad():
                recon = state["pipe"](
                    prompt=prompt,
                    image=img_512,
                    strength=strength,
                    guidance_scale=guidance,
                    num_inference_steps=30,
                    generator=torch.Generator(device=DEVICE).manual_seed(999),
                ).images[0]
            scores             = state["metrics"].calculate_metrics(img_512, recon)
            input_for_map      = img_512
            recon_for_response = recon

    print(f"[PREDICT] aggregated metrics    : {scores}")

    feat = np.array([[scores[feat_name] for feat_name in FEATURES]])
    print(f"[PREDICT] FEATURES order        : {FEATURES}")
    print(f"[PREDICT] feat vector           : {feat[0].tolist()}")

    # Defect coverage
    orig_np   = np.array(input_for_map).astype(np.float32)
    recon_np  = np.array(recon_for_response).astype(np.float32)
    diff_gray = np.mean(np.abs(orig_np - recon_np), axis=2)
    diff_max  = diff_gray.max()
    coverage  = (
        float((diff_gray > diff_max * 0.3).sum() / diff_gray.size * 100)
        if diff_max > 0 else 0.0
    )

    # ── Decision logic — identical to test_single.py ──────────────────────
    # test_single.py:
    #   score = -if_model.decision_function(feat)[0]
    #   is_anomaly = score >= threshold
    raw_score     = float(iforest.decision_function(feat)[0])
    anomaly_score = -raw_score
    is_anomalous  = anomaly_score >= threshold

    print(f"\n[PREDICT] ── DECISION (test_single.py logic) ──────────────────")
    print(f"[PREDICT] raw_score     = iforest.decision_function(feat)[0] = {raw_score:.6f}")
    print(f"[PREDICT] anomaly_score = -raw_score                         = {anomaly_score:.6f}")
    print(f"[PREDICT] threshold     (from model_config.json)             = {threshold:.6f}")
    print(f"[PREDICT] is_anomalous  = anomaly_score >= threshold         "
          f"= {anomaly_score:.6f} >= {threshold:.6f} = {is_anomalous}")
    print(f"[PREDICT] coverage                                           = {coverage:.2f}%")
    print(f"{'='*60}\n")

    heatmap_img = create_anomaly_map(input_for_map, recon_for_response)

    return {
        "is_anomalous":  bool(is_anomalous),
        "score":         float(anomaly_score),
        "threshold":     float(threshold),
        "coverage":      round(coverage, 2),
        "metrics":       {f: float(scores[f]) for f in FEATURES},
        "heatmap":       image_to_base64(heatmap_img),
        "reconstructed": image_to_base64(recon_for_response),
    }
