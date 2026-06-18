# model_bottle

OFT/LoRA adapter fine-tuned on the MVTec **bottle** category using Stable Diffusion v1.5 as the base model.

| File | Description |
|------|-------------|
| `adapter_model.safetensors` | Fine-tuned UNet adapter weights (PEFT 0.18.1) |
| `adapter_config.json` | PEFT adapter configuration |
| `iforest_model.pkl` | Isolation Forest anomaly scorer |
| `model_config.json` | Inference parameters (strength, guidance scale) |
| `metrics_report.json` | Evaluation metrics on the test split |

Load via the `api_server.py` in `backend/api/`.
