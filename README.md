# Qassas — AI-Powered Manufacturing Quality Control

Qassas detects defects in pharmaceutical/industrial products (bottles, capsules, pills, toothbrushes) using a diffusion-based anomaly detection pipeline. A fine-tuned Stable Diffusion model reconstructs what a normal product should look like, then compares it against the real image using five image quality metrics scored by an Isolation Forest model.

**Performance:** 97% recall · 88% F1 · 78.3% accuracy

---

## Project Structure

```
GraduationProject/
├── final-copy/
│   └── model/
│       ├── api/              ← FastAPI inference server  ← start here
│       │   ├── api_server.py
│       │   ├── requirements.txt
│       │   └── config.py
│       └── model/            ← Training scripts + trained models
│           └── trained_models/
│               ├── model_bottle/
│               ├── model_capsule/
│               ├── model_pill/
│               ├── model_toothbrush/
│               └── model_all/
└── webapp/
    └── graduationprojectwebapp/  ← Next.js web application
```

---

## Prerequisites

| Tool | Minimum version | Notes |
|------|----------------|-------|
| Python | 3.10 | 3.11 recommended |
| Node.js | 18 | 20 LTS recommended |
| npm | 9 | bundled with Node.js |
| GPU (CUDA) | optional | CPU works but inference is slow (~30s/image) |
| ngrok | optional | needed if web app and Python server run on different machines |

---

## Part 1 — Python ML Backend

### 1. Create a virtual environment

```bash
cd final-copy/model/api

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

Create a `.env` file in `final-copy/model/api/` or set these in your shell:

| Variable | Default | Description |
|----------|---------|-------------|
| `ALLOW_ORIGIN` | `http://localhost:3000` | CORS origin for the web app |
| `MODEL_DIR_BASE` | auto-detected | Path to the directory containing `model_bottle/`, `model_capsule/`, etc. Only needed if models are not in the default location (`model/model/trained_models/`) |
| `SD_CACHE_DIR` | HuggingFace default | Custom directory to cache the downloaded Stable Diffusion weights |

### 4. Start the server

```bash
uvicorn api_server:app --host 0.0.0.0 --port 8000
```

The server will print which product models it found at startup. You should see lines like:

```
[STARTUP] FOUND     model_bottle  →  ...
[STARTUP] FOUND     model_capsule →  ...
```

Verify it is running:

```
GET http://localhost:8000/health
```

---

## Part 2 — Next.js Web App

### 1. Install dependencies

```bash
cd webapp/graduationprojectwebapp
npm install
```

### 2. Configure environment variables

Create a `.env` file in `webapp/graduationprojectwebapp/`:

```env
# Neon PostgreSQL connection string
DATABASE_URL="postgresql://<user>:<password>@<host>/neondb?sslmode=require&channel_binding=require"

# Neon Auth endpoints
NEON_AUTH_BASE_URL="https://<your-neon-auth-endpoint>/auth"
NEON_AUTH_COOKIE_SECRET="<random-32-byte-base64-secret>"

# URL of the running Python backend (see "Connecting the two parts" below)
PYTHON_API_URL="http://localhost:8000"
```

**Getting these values:**
- `DATABASE_URL` and `NEON_AUTH_BASE_URL` — from your [Neon Console](https://console.neon.tech) project settings.
- `NEON_AUTH_COOKIE_SECRET` — generate a random secret: `openssl rand -base64 32`
- `PYTHON_API_URL` — the address of your running Python server (see below).

### 3. Set up the database

Generate the Prisma client and push the schema to your database:

```bash
npx prisma generate
npx prisma db push
```

To seed initial data (if a seed script exists):

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
cd final-copy/model/api
venv\Scripts\activate          # Windows
uvicorn api_server:app --host 0.0.0.0 --port 8000

# Terminal 2 — Web app
cd webapp/graduationprojectwebapp
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

---

## Troubleshooting

**"No trained models found"** — The server cannot locate the `trained_models/` directory. Set `MODEL_DIR_BASE` to the folder that contains `model_bottle/`, `model_capsule/`, etc.

**"Could not reach the model API"** — The `PYTHON_API_URL` in the webapp `.env` is wrong or the Python server is not running. Check that `http://<PYTHON_API_URL>/health` responds.

**Inference is very slow** — You are running on CPU. A CUDA-capable GPU reduces inference from ~30s to ~2s per image.

**SD model download fails** — Set `SD_CACHE_DIR` to a writable directory with at least 6 GB free and retry.

**Prisma client not found** — Run `npx prisma generate` after `npm install`.
