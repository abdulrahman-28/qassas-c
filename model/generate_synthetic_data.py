import json
import logging
import os
import random
from datetime import datetime
from typing import Dict, List, Tuple
import numpy as np
import torch
from diffusers import StableDiffusionImg2ImgPipeline
from PIL import Image
from tqdm import tqdm

# استيراد الدالة المحسنة من ملف سايثون
from fast_utils import stable_int

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler("synthetic_data_generation.log"),
        logging.StreamHandler(),
    ],
)
logger = logging.getLogger(__name__)


MODEL_ID = "runwayml/stable-diffusion-v1-5"
CATEGORY_PROMPTS = {
    "toothbrush": (
        "High resolution studio photo of a brand new intact toothbrush, perfect straight bristles, "
        "flawless plastic handle, ergonomic design, industrial product photography, "
        "uniform lighting, clean professional background"
    ),
}
NEGATIVE_PROMPT = (
    "defect, broken, crack, scratch, contamination, dent, squeeze, deformed, blurry, "
    "low quality, distorted, watermark, text, grainy, out of focus, artifacts, malformed, "
    "dusty, dirty, low resolution, cartoon, painting, sketch, cgi, 3d render, "
    "unrealistic, shadows, multiple objects"
)
DEFAULT_CONFIG = {
    "train_dir": "data/train",
    "output_dir": "data/train",
    "min_blur_score": 8.0,
    "max_tries_multiplier": 3,
    "image_size": 512,
    "num_steps": 35,
    "guidance_scale": 8.5,
    "strength": 0.35,
    "strength_min": 0.25,
    "strength_max": 0.35,
    "lighting_variants": [
        "soft studio lighting",
        "bright professional lighting",
        "clean cinematic lighting",
        "top-down lighting",
    ],
    "seed": 999,
    "IMAGES_PER_CATEGORY": 400,
    "deterministic": False,
    "num_images_per_call": 2,
    "enable_xformers": True,
    "enable_attention_slicing": False,
    "enable_vae_slicing": False,
}


def set_randomness(seed: int, deterministic: bool) -> None:
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)

    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True

    try:
        torch.set_float32_matmul_precision("high")
    except Exception:
        pass

    if deterministic:
        torch.backends.cudnn.deterministic = True
        torch.backends.cudnn.benchmark = False
        os.environ.setdefault("CUBLAS_WORKSPACE_CONFIG", ":4096:8")
        try:
            torch.use_deterministic_algorithms(True)
        except Exception:
            pass
    else:
        torch.backends.cudnn.deterministic = False
        torch.backends.cudnn.benchmark = True
        try:
            torch.use_deterministic_algorithms(False)
        except Exception:
            pass


def extract_category_and_index(filename: str) -> Tuple[str, int] | Tuple[None, None]:
    if not filename.lower().endswith(".png"):
        return None, None

    stem = filename[:-4]
    parts = stem.rsplit("_", 1)
    if len(parts) != 2:
        return None, None

    category, idx_text = parts
    if not idx_text.isdigit():
        return None, None

    return category, int(idx_text)


def scan_train_dir(train_dir: str) -> Tuple[Dict[str, int], Dict[str, int]]:
    category_counts: Dict[str, int] = {}
    category_max_idx: Dict[str, int] = {}

    for filename in os.listdir(train_dir):
        category, idx = extract_category_and_index(filename)
        if category is None:
            continue

        category_counts[category] = category_counts.get(category, 0) + 1
        category_max_idx[category] = max(category_max_idx.get(category, 0), idx)

    return category_counts, category_max_idx


def blur_score(image: Image.Image) -> float:
    gray = np.asarray(image.convert("L"), dtype=np.float32)
    gx = np.diff(gray, axis=1)
    gy = np.diff(gray, axis=0)
    return float(np.var(gx) + np.var(gy))


def is_bad_image(image: Image.Image, min_size: int = 512) -> bool:
    if image.width < min_size or image.height < min_size:
        return True
    arr = np.array(image)
    if arr.std() < 2.0:
        return True
    if np.mean(arr) < 10 or np.mean(arr) > 245:
        return True
    return False


def brightness_ok(
    image: Image.Image, min_mean: float = 25.0, max_mean: float = 230.0
) -> bool:
    gray = np.asarray(image.convert("L"), dtype=np.float32)
    mean_val = float(gray.mean())
    return min_mean <= mean_val <= max_mean


def build_prompt(category: str) -> str:
    if category in CATEGORY_PROMPTS:
        return CATEGORY_PROMPTS[category]
    return (
        f"a high quality studio photo of a perfect {category}, "
        "same shape and features, isolated object, plain background"
    )


def collect_category_training_images(
    train_dir: str, categories: List[str]
) -> Dict[str, List[str]]:
    category_images: Dict[str, List[str]] = {c: [] for c in categories}
    for filename in os.listdir(train_dir):
        category, _ = extract_category_and_index(filename)
        if category is None or category not in category_images:
            continue
        category_images[category].append(os.path.join(train_dir, filename))

    for category in category_images:
        category_images[category].sort()

    return category_images


def load_img2img_pipeline(
    target_device: str, local_only: bool, config: dict
) -> StableDiffusionImg2ImgPipeline:
    model_pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
        MODEL_ID,
        torch_dtype=torch.float16 if target_device == "cuda" else torch.float32,
        safety_checker=None,
        requires_safety_checker=False,
        local_files_only=local_only,
    ).to(target_device)

    if target_device == "cuda" and config.get("enable_xformers", True):
        try:
            model_pipe.enable_xformers_memory_efficient_attention()
            logger.info("xFormers memory-efficient attention enabled.")
        except Exception as exc:
            logger.warning(f"xFormers not enabled ({exc}). Continuing without it.")

    if config.get("enable_attention_slicing", False):
        model_pipe.enable_attention_slicing()
    if config.get("enable_vae_slicing", False):
        model_pipe.enable_vae_slicing()

    return model_pipe


def load_pipeline_with_fallback(
    config: dict,
) -> tuple[StableDiffusionImg2ImgPipeline, str]:
    device = "cuda" if torch.cuda.is_available() else "cpu"
    logger.info("Loading Stable Diffusion Img2Img pipeline...")
    logger.info(
        f"Runtime config | deterministic={config.get('deterministic', False)} "
        f"| num_images_per_call={config.get('num_images_per_call', 1)}"
    )

    try:
        pipe = load_img2img_pipeline(device, local_only=True, config=config)
        return pipe, device
    except Exception as exc:
        is_oom = "out of memory" in str(exc).lower()
        if device == "cuda" and is_oom:
            logger.warning(
                f"GPU OOM while loading pipeline ({exc}). Falling back to CPU generation."
            )
            torch.cuda.empty_cache()
            device = "cpu"
            pipe = load_img2img_pipeline(device, local_only=True, config=config)
            return pipe, device

        logger.warning(f"Offline load failed ({exc}), trying online mode...")
        pipe = load_img2img_pipeline(device, local_only=False, config=config)
        return pipe, device


def generate_for_category(
    category: str,
    config: dict,
    pipe: StableDiffusionImg2ImgPipeline,
    device: str,
    source_images: List[str],
    current_idx: int,
    desired_count: int,
    max_tries: int,
    rejected_category_dir: str,
):
    generated = 0
    attempted = 0
    rejected_blur = 0
    rejected_brightness = 0
    rejected_saved = 0
    category_out = []

    progress = tqdm(total=desired_count, desc=f"Generating {category}")

    while generated < desired_count and attempted < max_tries:
        attempt_seed = config["seed"] + attempted + (stable_int(category) % 10000)
        attempt_rng = random.Random(attempt_seed)

        base_prompt = build_prompt(category)
        lighting_variants = config.get("lighting_variants", [])
        selected_lighting = (
            attempt_rng.choice(lighting_variants) if lighting_variants else ""
        )
        prompt = (
            f"{base_prompt}, {selected_lighting}" if selected_lighting else base_prompt
        )

        strength_min = float(config.get("strength_min", config["strength"]))
        strength_max = float(config.get("strength_max", config["strength"]))
        dynamic_strength = attempt_rng.uniform(
            min(strength_min, strength_max), max(strength_min, strength_max)
        )

        source_image_path = attempt_rng.choice(source_images)

        try:
            with Image.open(source_image_path).convert("RGB") as raw_image:
                source_image = raw_image.resize(
                    (config["image_size"], config["image_size"]),
                    Image.Resampling.BILINEAR,
                )

            if config.get("add_noise", True):
                noise_sigma = 0.05
                source_image_array = np.array(source_image).astype(np.float32) / 255.0
                noise = np.random.normal(0, noise_sigma, source_image_array.shape)
                source_image_array = np.clip(source_image_array + noise, 0, 1)
                source_image = Image.fromarray(
                    (source_image_array * 255).astype(np.uint8)
                )
        except Exception as exc:
            logger.warning(f"Failed to open source image {source_image_path}: {exc}")
            continue

        try:
            batch_size = max(1, int(config.get("num_images_per_call", 1)))
            batch_size = min(batch_size, max_tries - attempted)

            generators = []
            for batch_idx in range(batch_size):
                generator = torch.Generator(device=device)
                generator.manual_seed(
                    config["seed"]
                    + attempted
                    + batch_idx
                    + (stable_int(category) % 10000)
                )
                generators.append(generator)

            result = pipe(
                prompt=prompt,
                negative_prompt=NEGATIVE_PROMPT,
                image=source_image,
                strength=dynamic_strength,
                num_inference_steps=config["num_steps"],
                guidance_scale=config["guidance_scale"],
                num_images_per_prompt=batch_size,
                generator=generators,
            )
        except Exception as exc:
            logger.warning(
                f"Generation failed for {category} at try {attempted + 1}: {exc}"
            )
            continue

        for image in result.images:
            attempted += 1
            sharpness = blur_score(image)
            image_bad = (
                sharpness < config["min_blur_score"]
                or not brightness_ok(image)
                or is_bad_image(image, min_size=config.get("image_size", 512))
            )

            if sharpness < config["min_blur_score"]:
                rejected_blur += 1
            if not brightness_ok(image):
                rejected_brightness += 1

            if image_bad:
                rejected_name = f"{category}_rejected_{attempted:05d}.png"
                rejected_path = os.path.join(rejected_category_dir, rejected_name)
                image.save(rejected_path)
                rejected_saved += 1
            else:
                current_idx += 1
                filename = f"{category}_{current_idx:03d}.png"
                save_path = os.path.join(config["output_dir"], filename)
                image.save(save_path)
                generated += 1
                progress.update(1)
                category_out.append(
                    {
                        "file": filename,
                        "prompt": prompt,
                        "lighting_variant": selected_lighting,
                        "strength": dynamic_strength,
                        "source_image": os.path.basename(source_image_path),
                        "sharpness": sharpness,
                    }
                )

            if generated >= desired_count or attempted >= max_tries:
                break

    progress.close()

    return {
        "generated": generated,
        "attempted": attempted,
        "rejected_blur": rejected_blur,
        "rejected_brightness": rejected_brightness,
        "rejected_saved": rejected_saved,
        "files": category_out,
    }


def main() -> None:
    config = dict(DEFAULT_CONFIG)
    config["seed"] = config.get("seed", random.randint(0, 1_000_000_000))
    set_randomness(config["seed"], deterministic=config.get("deterministic", False))

    train_dir = config["train_dir"]
    output_dir = config["output_dir"]

    if not os.path.exists(train_dir):
        raise FileNotFoundError(f"Train directory not found: {train_dir}")

    os.makedirs(output_dir, exist_ok=True)
    rejected_root = os.path.join(train_dir, "rejected")
    os.makedirs(rejected_root, exist_ok=True)

    category_counts, category_max_idx = scan_train_dir(train_dir)

    # 🔥 التصحيح هنا: إجبار الكود على تجاهل الفئات الأخرى واعتماد فرشاة الأسنان فقط
    categories = ["toothbrush"]

    logger.info("Detected category counts from train dir:")
    for category in categories:
        logger.info(
            f"  {category}: {category_counts.get(category, 0)} real/total images"
        )

    pipe, device = load_pipeline_with_fallback(config)
    category_training_images = collect_category_training_images(train_dir, categories)

    run_summary = {
        "timestamp": datetime.now().isoformat(),
        "config": config,
        "categories": {},
    }

    for category in categories:
        real_count = category_counts.get(category, 0)
        desired_count = int(
            config.get("images_per_category", config.get("IMAGES_PER_CATEGORY", 400))
        )
        max_tries = max(
            desired_count * config["max_tries_multiplier"], desired_count + 10
        )
        current_idx = category_max_idx.get(category, 0)

        logger.info("=" * 64)
        logger.info(
            f"Category: {category} | real={real_count} | target_synthetic={desired_count} | max_tries={max_tries}"
        )

        source_images = category_training_images.get(category, [])
        if not source_images:
            logger.warning(f"No source training images found for {category}. Skipping.")
            run_summary["categories"][category] = {
                "real_count": real_count,
                "target_synthetic": desired_count,
                "generated": 0,
                "attempted": 0,
                "rejected_blur": 0,
                "rejected_brightness": 0,
                "rejected_saved": 0,
                "files": [],
                "skipped": "no_source_training_images",
            }
            continue

        rejected_category_dir = os.path.join(rejected_root, category)
        os.makedirs(rejected_category_dir, exist_ok=True)

        category_result = generate_for_category(
            category=category,
            config=config,
            pipe=pipe,
            device=device,
            source_images=source_images,
            current_idx=current_idx,
            desired_count=desired_count,
            max_tries=max_tries,
            rejected_category_dir=rejected_category_dir,
        )

        logger.info(
            f"Finished {category}: generated={category_result['generated']}, "
            f"attempts={category_result['attempted']}, rejected_blur={category_result['rejected_blur']}, "
            f"rejected_brightness={category_result['rejected_brightness']}, "
            f"rejected_saved={category_result['rejected_saved']}"
        )

        run_summary["categories"][category] = {
            "real_count": real_count,
            "target_synthetic": desired_count,
            **category_result,
        }

    summary_name = (
        f"synthetic_generation_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    )
    summary_path = os.path.join(output_dir, summary_name)
    with open(summary_path, "w", encoding="utf-8") as file_obj:
        json.dump(run_summary, file_obj, indent=2)

    logger.info("=" * 64)
    logger.info(f"Synthetic data generation complete. Summary: {summary_path}")


if __name__ == "__main__":
    main()

