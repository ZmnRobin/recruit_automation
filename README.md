# Recruit Automation System

A full-stack recruiting automation system with AI-powered workflows, real-time background job processing, and live status streaming.

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Queue / Cache**: Redis with BullMQ
- **Realtime**: Server-Sent Events (SSE) + Redis Pub/Sub
- **Frontend**: React with Vite
- **Container**: Docker & Docker Compose

## Architecture

### Monorepo Structure
```
recruit-automation/
├── server/
│   └── src/
│       ├── models/         # MongoDB schemas
│       ├── routes/         # API endpoints
│       │   ├── jobs.js
│       │   ├── candidates.js
│       │   └── tasks.js    # SSE streaming endpoint
│       ├── services/       # Business logic & AI integration
│       │   ├── scoringService.js
│       │   ├── outreachService.js
│       │   ├── sourcingService.js
│       │   ├── taskPublisher.js   # Redis pub — used by workers
│       │   └── taskSubscriber.js  # Redis sub — used by Express
│       ├── workers/        # Background job processors
│       │   ├── index.js
│       │   ├── sourcingWorker.js
│       │   ├── scoringWorker.js
│       │   └── outreachWorker.js
│       └── config/         # Database & Redis config
├── client/
│   └── src/
│       ├── pages/
│       │   ├── JobDetails.jsx
│       │   └── CandidateDetails.jsx
│       ├── components/
│       │   └── Toast.jsx          # Real-time toast notification system
│       ├── hooks/
│       │   └── useTaskStream.js   # SSE client hook
│       └── services/
│           └── api.js
├── docker-compose.yml
└── README.md
```

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development without Docker)

### Quick Start with Docker

```bash
cp .env.example .env   # add your API keys (optional)
docker-compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000

### Local Development (without Docker)

**Backend:**
```bash
cd server && npm install
cp .env.example .env
npm run dev
```

**Worker (separate terminal):**
```bash
cd server && npm run worker
```

**Frontend:**
```bash
cd client && npm install && npm run dev
```

## Features

### 1. Job Management
- `POST /api/jobs` — Create a new job posting
- `GET /api/jobs` — List all jobs
- `GET /api/jobs/:id` — Get job details with candidate count

### 2. Candidate Sourcing
- `POST /api/jobs/:id/sourcing-tasks` — Trigger sourcing for a job
- Runs as a BullMQ background job
- Deduplicates candidates by LinkedIn URL
- Uses Serper API for real search, or mock data as fallback

### 3. AI Candidate Scoring
- `POST /api/candidates/:id/scores` — Trigger AI scoring
- Uses Gemini to compare candidate profile against job requirements
- Returns a 0–100 score with reasoning
- **AI scores cached in Redis for 24 hours** to avoid redundant API calls
- **Fallback scores cached for only 1 hour** so they get re-evaluated by AI when quota resets
- Fallback scoring is rule-based (skills match, title relevance, experience, location) — clearly labeled `[Rule-based]` in the reasoning so you know when AI wasn't used

### 4. Automated Outreach
- `POST /api/candidates/:id/outreach` — Send personalized outreach
- Uses Gemini to write a message tailored to the candidate's background
- Fallback message varies structure and wording per candidate (not the same template every time)
- Tracks message source (`ai` vs `fallback`) in the database

### 5. Response Handling
- `POST /api/candidates/:id/responses` — Simulate candidate response
- Classifies intent: `interested` / `not_interested` / `neutral`
- Generates a mock Calendly scheduling link for interested candidates

### 6. Real-Time Task Streaming (SSE)
- `GET /api/tasks/:taskId/stream` — Subscribe to live task updates
- Uses **Server-Sent Events** so the frontend receives push updates without polling
- Progress updates at meaningful milestones (10% → 30% → 60% → 100%)
- Automatically closes the connection when a task reaches a terminal state
- Falls back gracefully — sends the current DB snapshot immediately on connect, so clients that join late still get the latest state

### 7. Cross-Process Event Bus (Redis Pub/Sub)
Workers and the Express server run as separate OS processes. A Node.js `EventEmitter` only works within a single process, so a dedicated Redis pub/sub channel bridges them:

```
Worker process                     Express process
──────────────                     ───────────────
updateTask()                       SSE route
  └─ publishTaskUpdate()             └─ taskBus.on('task:<id>')
       └─ redis.publish()                 └─ triggered by:
                                               redis.subscribe()
                                               (taskSubscriber.js)
```

`taskPublisher.js` — imported only by workers. Publishes to the `task-updates` Redis channel on every status/progress change.

`taskSubscriber.js` — imported only by the Express server. Subscribes once at startup and re-emits received messages as local `EventEmitter` events that SSE route handlers listen to.

This means every worker progress update — regardless of which process handles it — reliably reaches every connected browser client.

### 8. Toast Notification System
Replaces all `alert()` calls with a non-blocking, dark-themed toast system:
- **Loading toasts** with animated progress bars that update in real time as the worker progresses
- **Success / error toasts** that replace the loading state when the task completes
- Toasts auto-dismiss after 4–5 seconds
- Built as a React context (`ToastProvider` + `useToast` hook) — no external library required

### 9. Candidate Details UI
Redesigned with a two-column layout:
- **Left sidebar**: avatar, animated SVG score ring, profile stats, skills, outreach button
- **Right panel**: full-height chat view with messenger-style bubbles, quick-reply chips for simulating responses, Enter-to-send input, and auto-scroll to latest message
- Buttons disable while tasks are in-flight to prevent double-submissions
- All task results (score, message) appear automatically without any page reload

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/jobs | Create job |
| GET | /api/jobs | List jobs |
| GET | /api/jobs/:id | Get job |
| POST | /api/jobs/:id/sourcing-tasks | Source candidates |
| GET | /api/jobs/:id/candidates | List candidates for job |
| GET | /api/candidates | List all candidates |
| GET | /api/candidates/:id | Get candidate |
| POST | /api/candidates/:id/scores | Score candidate |
| POST | /api/candidates/:id/outreach | Send outreach |
| POST | /api/candidates/:id/responses | Submit response |
| GET | /api/candidates/:id/messages | Get messages |
| GET | /api/tasks/:taskId | Get task status (polling) |
| GET | /api/tasks/:taskId/stream | Stream task status (SSE) |

## External APIs

Both are optional — the system runs fully without them using fallbacks.

| API | Purpose | Fallback |
|-----|---------|----------|
| Gemini (Google AI) | Candidate scoring, outreach message generation | Rule-based scoring + varied template messages |
| Serper | Candidate sourcing via LinkedIn search | Mock candidate data |

### Quota handling
When Gemini returns a 429 (quota exceeded), the system catches the error, logs a clear warning, and uses the fallback immediately — no crash, no hang. Fallback scores are labeled `[Rule-based]` in their reasoning text and cached for only 1 hour (vs 24 hours for AI scores) so they get re-evaluated by AI once quota resets.

## Background Jobs

Three BullMQ workers run in a separate process (`npm run worker`):

| Worker | Queue | What it does |
|--------|-------|-------------|
| sourcingWorker | `sourcing` | Searches for candidates, deduplicates, saves to DB |
| scoringWorker | `scoring` | Calls Gemini (or fallback), saves score, publishes progress |
| outreachWorker | `outreach` | Generates personalized message, saves to DB, publishes progress |

All workers publish progress updates to Redis. The Express server subscribes and forwards them to browser clients over SSE.

## Environment Variables

```env
MONGODB_URI=mongodb://localhost:27017/recruit-automation
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=          # optional
GEMINI_API_KEY=          # optional — enables AI scoring and outreach
SERPER_API_KEY=          # optional — enables real candidate sourcing
```

## License

MIT