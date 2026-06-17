# VeriAI — AI Content Detection Platform

Detect AI-generated text, images, and video using a transparent, fully self-hosted heuristic detection engine. Secured with Google sign-in, backed by Supabase, open-source under MIT.

**Live Site →** _add your deployed frontend URL here once hosted_
**Repo →** https://github.com/NinadVeer/VeriAi

## Overview

VeriAI is a full-stack content authenticity checker. Users sign in with Google (Firebase Authentication), submit text, an image, or a video, and the Express backend runs deterministic signal-based heuristics to return a confidence score and verdict. Every analysis is saved to a Supabase/Postgres database so users can review their history.

## Features

- **Text Detection** — Scores writing on filler-phrase density, sentence-length uniformity, vocabulary variety, burstiness, and hedging language.
- **Image Detection** — Scores uploaded images on byte entropy, color-channel balance, compression density, and file-header anomalies.
- **Video Detection** — Scores uploaded video on bitrate density, container-structure anomalies, compression patterns, and stream uniformity.
- **Analysis History** — Paginated record of every past analysis per user.
- **Google Authentication** — Firebase-backed sign-in; every analysis is tied to a verified user.
- **Deterministic Results** — No randomness anywhere in scoring — the same input always produces the same output.
- **Hardened API** — Helmet headers, CORS allow-listing, per-route rate limiting, and strict input/file validation.

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, vanilla JavaScript (no build step) |
| Auth | Firebase Authentication (modular SDK, via CDN) |
| Backend | Node.js, Express |
| Detection Engine | Custom deterministic heuristics (see [Detection Method](#detection-method)) |
| Database | PostgreSQL via Supabase |
| Security Middleware | Helmet, CORS, express-rate-limit, express-validator, Multer |
| Logging | Winston |

## Project Structure

```
VeriAI/
├── index.html               # Main detection tool (auth + analysis UI)
├── homepage.html             # Landing page
├── login.html                 # Google sign-in page
├── script.js                   # Frontend analysis & Supabase logic
├── style.css                   # Global styling
└── backend/
    ├── server.js                 # Express app entry point
    ├── package.json
    ├── .env.example                # Template for required environment variables
    ├── supabase_schema.sql         # Database schema (users, analysis_results)
    ├── config/
    │   ├── env.js                    # Validates/loads environment variables
    │   ├── firebase.js               # Firebase Admin SDK initialization
    │   └── supabase.js               # Supabase client initialization
    ├── controllers/
    │   ├── analyzeController.js
    │   ├── historyController.js
    │   └── profileController.js
    ├── middleware/
    │   ├── auth.js                    # Firebase ID-token verification
    │   ├── errorHandler.js
    │   ├── logger.js
    │   ├── upload.js                   # Multer config for image/video uploads
    │   └── validate.js
    ├── models/
    │   ├── analysisModel.js
    │   └── userModel.js
    ├── routes/
    │   ├── analyze.js
    │   ├── history.js
    │   └── profile.js
    ├── services/
    │   ├── textDetector.js
    │   ├── imageDetector.js
    │   └── videoDetector.js
    └── utils/
        ├── confidenceCalculator.js
        └── responseFormatter.js
```

> `config/firebase-service-account.json` and `.env` are intentionally excluded via `.gitignore` since they hold private credentials.

## Local Setup

### Prerequisites
- Node.js v18+
- A [Firebase](https://console.firebase.google.com/) project (Authentication)
- A [Supabase](https://app.supabase.com/) project (database)

### Backend
```bash
cd backend
npm install
cp .env.example .env     # then fill in your real values
npm run dev               # auto-reload via nodemon, or `npm start` for production
```
API → `http://localhost:3001` · Health check → `http://localhost:3001/health`

Download your Firebase service account key (Console → Project Settings → Service Accounts → Generate new private key) and save it to `backend/config/firebase-service-account.json`. Then run the schema in `backend/supabase_schema.sql` against your Supabase project (Dashboard → SQL Editor).

### Frontend
Because `index.html` loads Firebase as an ES module, serve it through a local server rather than opening the file directly:
```bash
npx serve .
```
Add your own credentials before running: Firebase web config inside `index.html`, and your Supabase project URL + anon key inside `script.js`. Then open `homepage.html`.

## API Reference

All `/api/*` routes require a verified Firebase ID token: `Authorization: Bearer <idToken>`.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server health check |
| `GET` | `/api` | Lists available endpoints |
| `POST` | `/api/analyze/text` | Analyze text (50–50,000 characters) |
| `POST` | `/api/analyze/image` | Analyze an image (JPEG/PNG/WebP/GIF, max 20 MB) |
| `POST` | `/api/analyze/video` | Analyze a video (MP4/WebM/MOV/AVI, max 200 MB) |
| `GET` | `/api/history?page=1&limit=20` | Paginated analysis history |
| `GET` | `/api/profile` | Authenticated user's profile |

**POST /api/analyze/text**
```bash
curl -X POST http://localhost:3001/api/analyze/text \
  -H "Authorization: Bearer <firebase-id-token>" \
  -H "Content-Type: application/json" \
  -d '{"text": "Your text content here, at least fifty characters long..."}'
```

**POST /api/analyze/image / video** (multipart, field name must be `file`)
```bash
curl -X POST http://localhost:3001/api/analyze/image \
  -H "Authorization: Bearer <firebase-id-token>" \
  -F "file=@photo.jpg"
```

**Example response**
```json
{
  "success": true,
  "data": {
    "confidence": 78,
    "verdict": "AI-Generated",
    "signals": {
      "fillerPhrases": 82,
      "sentenceUniform": 75,
      "lowWordVariety": 60,
      "lowBurstiness": 55,
      "hedgingLanguage": 40
    },
    "processingTime": "12ms",
    "wordCount": 214
  },
  "timestamp": "2026-06-17T10:30:00.000Z"
}
```

## Detection Method

| Modality | Approach | Signals |
|---|---|---|
| Text | Deterministic heuristic scoring | Filler-phrase density (30%), sentence uniformity (25%), vocabulary variety (20%), burstiness (15%), hedging language (10%) |
| Image | Deterministic heuristic scoring | Byte entropy, color-channel balance, compression density, file-header anomalies |
| Video | Deterministic heuristic scoring | Bitrate density, container-structure anomalies, compression patterns, stream uniformity |

A confidence score of 65%+ is flagged AI/deepfake, 35–64% is ambiguous/inconclusive, and below 35% is human/authentic. These are currently rule-based heuristics rather than trained ML models — see Roadmap below for the model-integration points already scoped out in the codebase.

## Security

- File-type allowlists enforced on both the upload and validation middleware
- File size limits — 20 MB (images), 200 MB (video)
- Text length limits — 50 to 50,000 characters
- Rate limiting — 120 req/min globally on `/api`, plus a stricter configurable limit on `/api/analyze`
- Every protected route requires a Firebase ID token, verified server-side via Firebase Admin SDK
- Helmet sets secure HTTP response headers; CORS is restricted to an explicit allow-list
- Secrets (`.env`, Firebase service account key) are excluded from version control

## Database

Schema lives in [`backend/supabase_schema.sql`](backend/supabase_schema.sql) and defines two tables: `users` (mirrors Firebase Auth users by `firebase_id`) and `analysis_results` (one row per analysis, with `content_type`, `confidence_score`, and a `details` JSONB column holding the full signal breakdown). Row Level Security is enabled on both tables.

## Roadmap

- [ ] Replace the text heuristic with a real model (e.g. HuggingFace `roberta-base-openai-detector`)
- [ ] Replace the image heuristic with a dedicated AI-image detector (e.g. Hive Moderation, Sightengine, or a local ONNX classifier)
- [ ] Replace the video heuristic with real deepfake detection (e.g. FaceForensics++, Microsoft Video Authenticator, or a frame-level CNN)
- [ ] Deploy frontend and backend and add live links to this README

## License

MIT — free to use, fork, and build on.

## Author

**Ninad Veer**

---
Results are probabilistic estimates from heuristic analysis, not forensic-grade or legal evidence of AI generation.
