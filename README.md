# Qassas — AI-Powered Manufacturing Quality Control

Qassas detects defects in pharmaceutical/industrial products (bottles, capsules, pills, toothbrushes) using a diffusion-based anomaly detection pipeline. A fine-tuned Stable Diffusion model reconstructs what a normal product should look like, then compares it against the real image using five image quality metrics scored by an Isolation Forest model.

**Performance:** 97% recall · 88% F1 · 78.3% accuracy

---

## Project Structure

```
qassas/
├── backend/
│   ├── api/                      ← FastAPI inference server  ← start here
│   │   ├── api_server.py
│   │   ├── metrics_factory.py
│   │   ├── config.py
│   │   └── requirements.txt
│   ├── model
│   │   ├── anomal_score.py
│   │   ├── config.py
│   │   ├── fast_utils.c
│   │   ├── fast_utils.cpython-312-x86_64-linux-gnu.so
│   │   ├── fast_utils.pyx
│   │   ├── generate_synthetic_data.py
│   │   ├── inference_iforest.py
│   │   ├── main.py
│   │   ├── metrics_factory.py
│   │   ├── optimize_omni.py
│   │   ├── setup.py
│   │   ├── test.py
│   │   ├── test_single.py
│   │   └── train_iforest.py
└── webapp/                       ← Next.js 16 web application
    ├── app/
    │   ├── dashboard/            ← Admin & operator dashboards
    │   ├── monitor/[cameraId]/   ← Live camera inspection view
    │   ├── history/              ← Inspection history & detail pages
    │   ├── lines/                ← Production line management
    │   ├── my-lines/             ← Operator's assigned lines
    │   ├── operators/            ← Operator management (admin only)
    │   ├── api/detect/           ← Next.js route that proxies to Python backend
    │   └── api/notifications/    ← Notifications API route
    ├── components/               ← Shared UI components
    ├── prisma/
    │   └── schema.prisma         ← PostgreSQL schema (Neon)
    └── lib/
        ├── client.ts
        └── server.ts
```

---

## How It Works

1. An operator opens a camera's live monitor page and uploads a product image.
2. The Next.js app forwards the image to the Python FastAPI backend (`/predict`).
3. The backend uses a **Stable Diffusion v1.5** model fine-tuned with **OFT (Orthogonal Fine-Tuning)** adapters (one per product category) to reconstruct what a defect-free version should look like.
4. Five metrics are computed between the original and reconstructed image: **L1, L2, MS-SSIM, LPIPS, Max_Patch**.
5. An **Isolation Forest** model scores the metric vector and compares it against a per-category optimal threshold.
6. The result (`is_anomalous`, anomaly score, coverage %, heatmap, reconstructed image) is stored in the database and a notification is sent if a defect is found.

---

## Prerequisites

| Tool       | Minimum version | Notes                                                        |
| ---------- | --------------- | ------------------------------------------------------------ |
| Python     | 3.10            | 3.11 recommended                                             |
| Node.js    | 18              | 20 LTS recommended                                           |
| npm        | 9               | bundled with Node.js                                         |
| GPU (CUDA) | optional        | CPU works but inference is slow (~30 s/image vs ~2 s on GPU) |
| ngrok      | optional        | needed if webapp and Python server run on different machines |

---

## Part 1 — Python ML Backend

### 1. Create a virtual environment

```bash
cd backend/api

python -m venv venv

# Windows
venv\Scripts\activate

# macOS / Linux
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

> **First run:** on startup the server downloads the Stable Diffusion v1.5 base model from HuggingFace (~4 GB). This only happens once; subsequent starts load from the local cache.

### 3. Environment variables (optional)

Create a `.env` file in `backend/api/` or set these in your shell:

| Variable             | Default                 | Description                                                                                                                                                      |
| -------------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ALLOW_ORIGIN`       | `http://localhost:3000` | CORS origin for the web app                                                                                                                                      |
| `MODEL_DIR_BASE`     | auto-detected           | Path to the directory containing `model_bottle/`, `model_capsule/`, etc. Only needed if models are not in the default location (`backend/model/trained_models/`) |
| `MODEL_DIR_OVERRIDE` | —                       | Full path to a single model directory; the parent is used as `MODEL_DIR_BASE`                                                                                    |
| `SD_CACHE_DIR`       | HuggingFace default     | Custom directory to cache the downloaded Stable Diffusion weights                                                                                                |

### 4. Start the server

```bash
uvicorn api_server:app --host 0.0.0.0 --port 8000
```

The server prints which product models it found at startup:

```
[STARTUP] FOUND     model_bottle  →  ...
[STARTUP] FOUND     model_capsule →  ...
```

Verify it is running:

```
GET http://localhost:8000/health
```

#### API endpoints

| Method | Path       | Description                                                                                                                                                                      |
| ------ | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET`  | `/health`  | Returns loaded models and their thresholds                                                                                                                                       |
| `POST` | `/predict` | Accepts `file` (image) + `product_type` form fields; returns JSON with `is_anomalous`, `score`, `threshold`, `coverage`, `metrics`, `heatmap` (base64), `reconstructed` (base64) |

---

## Part 2 — Next.js Web App

### 1. Install dependencies

```bash
cd webapp
npm install
```

`prisma generate` runs automatically via the `postinstall` script.

### 2. Configure environment variables

Create a `.env` file in `webapp/`:

```env
# Neon PostgreSQL connection string
DATABASE_URL="postgresql://<user>:<password>@<host>/neondb?sslmode=require&channel_binding=require"

# Neon Auth endpoints
NEON_AUTH_BASE_URL="https://<your-neon-auth-endpoint>/neondb/auth"
NEON_AUTH_COOKIE_SECRET="<random-32-byte-base64-secret>"

# URL of the running Python backend (see "Connecting the two parts" below)
PYTHON_API_URL="http://localhost:8000"
```

**Getting these values:**

- `DATABASE_URL` and `NEON_AUTH_BASE_URL` — from your [Neon Console](https://console.neon.tech) project settings.
- `NEON_AUTH_COOKIE_SECRET` — generate a random secret: `openssl rand -base64 32`
- `PYTHON_API_URL` — the address of your running Python server (see below).

### 3. Set up the database

Push the Prisma schema to your Neon database:

```bash
npx prisma db push
```

To seed initial data:

```bash
npx prisma db seed
```

### 4. Start the web app

```bash
# Development
npm run dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

```bash
# Production build
npm run build
npm start
```

### Web App Features

| Page                  | Role             | Description                                                               |
| --------------------- | ---------------- | ------------------------------------------------------------------------- |
| `/dashboard`          | Admin / Operator | Overview metrics and recent inspection results                            |
| `/monitor/[cameraId]` | Operator         | Live inspection: upload image, view heatmap & reconstruction side-by-side |
| `/history`            | Admin / Operator | Filterable history of all inspection results                              |
| `/history/[id]`       | Admin / Operator | Detailed view of a single inspection result                               |
| `/lines`              | Admin            | Manage production lines / cameras                                         |
| `/my-lines`           | Operator         | View the operator's assigned cameras                                      |
| `/operators`          | Admin            | Add, edit, and remove operator accounts                                   |

---

## Connecting the Two Parts

The web app calls the Python backend via the `PYTHON_API_URL` environment variable.

### Option A — Both running locally

Set `PYTHON_API_URL=http://localhost:8000` in the webapp `.env`. No extra steps needed.

### Option B — Python server on a different machine or exposed via ngrok

1. Install [ngrok](https://ngrok.com/) and authenticate it.
2. Start ngrok to expose the Python server:

   ```bash
   ngrok http 8000
   ```

3. Copy the HTTPS URL ngrok gives you (e.g. `https://xxxx.ngrok-free.app`).
4. Set that URL as `PYTHON_API_URL` in the webapp `.env`:

   ```env
   PYTHON_API_URL="https://xxxx.ngrok-free.app"
   ```

5. Restart the Next.js server so it picks up the new value.

> The `ALLOW_ORIGIN` variable on the Python side must match the URL where your web app is hosted (e.g. `http://localhost:3000` for local dev).

---

## Running Both Together (summary)

```bash
# Terminal 1 — Python backend
cd backend/api
venv\Scripts\activate          # Windows
uvicorn api_server:app --host 0.0.0.0 --port 8000

# Terminal 2 — Web app
cd webapp
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

---

## Trained Models

Each product category has its own directory under `backend/model/trained_models/`:

| Directory           | Contents                                     |
| ------------------- | -------------------------------------------- |
| `model_bottle/`     | OFT LoRA adapter + Isolation Forest + config |
| `model_capsule/`    | OFT LoRA adapter + Isolation Forest + config |
| `model_pill/`       | OFT LoRA adapter + Isolation Forest + config |
| `model_toothbrush/` | OFT LoRA adapter + Isolation Forest + config |
| `model_all/`        | Combined adapter trained on all categories   |

Each model directory contains:

- `adapter_config.json` / `adapter_model.safetensors` — OFT LoRA weights
- `iforest_model.pkl` — trained Isolation Forest
- `model_config.json` — optimal threshold, strength, guidance scale
- `metrics_report.json` — evaluation results

---

## Troubleshooting

**"No trained models found"** — The server cannot locate the `trained_models/` directory. Set `MODEL_DIR_BASE` to the folder that contains `model_bottle/`, `model_capsule/`, etc.

**"Could not reach the model API"** — The `PYTHON_API_URL` in the webapp `.env` is wrong or the Python server is not running. Check that `http://<PYTHON_API_URL>/health` responds.

**Inference is very slow** — You are running on CPU. A CUDA-capable GPU reduces inference from ~30 s to ~2 s per image.

**SD model download fails** — Set `SD_CACHE_DIR` to a writable directory with at least 6 GB free and retry.

**Prisma client not found** — Run `npx prisma generate` (or `npm install` which runs it automatically via `postinstall`).

**Capsule/pill results differ from bottle/toothbrush** — This is expected: capsules and pills use **patch mode** (the image is split into four 512×512 patches and the worst-case metric across patches is used), while bottles and toothbrushes use a single 512×512 resize.

## License

This project is licensed under the GNU General Public License v3.0.
