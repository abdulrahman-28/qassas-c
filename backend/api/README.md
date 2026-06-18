# Qassas — Backend API

FastAPI inference server for the Qassas anomaly detection system.

See the [root README](../../README.md) for full setup and run instructions.

## Quick start

```bash
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn api_server:app --host 0.0.0.0 --port 8000
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Returns `{"status": "ok"}` |
| POST | `/predict` | Accepts `file` (image) + optional `product_type` form fields; returns anomaly score, heatmap, and reconstructed image |
