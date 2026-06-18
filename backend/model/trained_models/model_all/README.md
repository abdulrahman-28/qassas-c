# model_all

OFT/LoRA adapter fine-tuned on **all** MVTec product categories combined (bottle, capsule, pill, toothbrush) using Stable Diffusion v1.5 as the base model.

| File | Description |
|------|-------------|
| `adapter_model.safetensors` | Fine-tuned UNet adapter weights (PEFT 0.18.1) |
| `adapter_config.json` | PEFT adapter configuration |
| `iforest_model.pkl` | Isolation Forest anomaly scorer |
| `model_config.json` | Inference parameters (strength, guidance scale) |
| `metrics_report.json` | Evaluation metrics on the test split |

Used as the fallback model when a camera has no specific product type assigned. Load via the `api_server.py` in `backend/api/`.
