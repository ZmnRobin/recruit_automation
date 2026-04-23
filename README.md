# Recruit Automation System

A full-stack recruiting automation system with AI-powered workflows and background job processing.

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB with Mongoose
- **Queue/ Cache**: Redis with BullMQ
- **Frontend**: React with Vite
- **Container**: Docker & Docker Compose

## Architecture

### Monorepo Structure
```
recruit-automation/
├── server/           # Express API server
│   ├── src/
│   │   ├── models/   # MongoDB schemas
│   │   ├── routes/   # API endpoints
│   │   ├── services/ # Business logic & AI integration
│   │   ├── workers/  # Background job processors
│   │   └── config/   # Database & Redis config
│   └── package.json
├── client/           # React frontend
│   ├── src/
│   │   ├── pages/    # React pages
│   │   ├── components/
│   │   └── services/ # API client
│   └── package.json
├── docker-compose.yml
└── README.md
```

### Why Monorepo?
- Simpler setup and deployment
- Single Docker Compose file manages all services
- Easier to develop both frontend and backend together
- No need for separate CI/CD pipelines

## Getting Started

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development without Docker)

### Quick Start with Docker

1. Clone the repository
2. Copy `.env.example` to `.env` and add your API keys (optional):
   ```bash
   cp .env.example .env
   ```
3. Start all services:
   ```bash
   docker-compose up --build
   ```

4. Access the application:
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:5000

### Local Development (without Docker)

**Backend:**
```bash
cd server
npm install
cp .env.example .env
# Edit .env with your MongoDB and Redis connections
npm run dev
```

**Worker (separate terminal):**
```bash
cd server
npm run worker
```

**Frontend:**
```bash
cd client
npm install
npm run dev
```

## Features

### 1. Job Management API
- `POST /api/jobs` - Create a new job
- `GET /api/jobs` - List all jobs
- `GET /api/jobs/:id` - Get job details

### 2. Candidate Sourcing
- `POST /api/jobs/:id/sourcing-tasks` - Trigger candidate sourcing
- Runs as background job using BullMQ
- Deduplicates candidates by LinkedIn URL
- Uses Serper API (or mock data fallback)

### 3. AI Candidate Scoring
- `POST /api/candidates/:id/scores` - Trigger AI scoring
- Compares candidate profile against job requirements
- Redis caching to avoid re-scoring (24-hour TTL)
- Uses Gemini API (or fallback to rule-based scoring)

### 4. Automated Outreach
- `POST /api/candidates/:id/outreach` - Send personalized outreach
- Uses AI to generate personalized messages
- Tracks message status (pending → sent → delivered)
- Background worker handles message generation

### 5. Response Handling
- `POST /api/candidates/:id/responses` - Simulate candidate response
- Classifies intent (interested/not_interested/neutral)
- Generates mock scheduling link for interested candidates

### 6. Caching Strategy
- **Score caching**: 24-hour TTL on candidate scores
- **Purpose**: Reduce AI API costs, faster page loads
- **Implementation**: Redis with key pattern `score:{candidateId}`

### 7. Admin Dashboard
- Jobs list with create functionality
- Job details with candidate sourcing trigger
- Candidate list with scores
- Candidate details with profile, score, messages, outreach

## API Endpoints Summary

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
| GET | /api/tasks/:taskId | Check task status |

## External APIs

### Optional (application works without them)
- **OpenAI**: For AI scoring and outreach message generation
- **Serper API**: For candidate sourcing/search

Without API keys, the system uses mock data and rule-based fallbacks.

## Background Jobs

The system uses BullMQ with Redis as the queue backend:

1. **Sourcing Worker**: Searches for candidates using external APIs
2. **Scoring Worker**: Scores candidates using AI
3. **Outreach Worker**: Generates and sends personalized messages

All workers run in a separate process (`npm run worker`).

## Production Improvements

If this were a production system, I'd add:

1. **Authentication**: JWT-based auth for the admin dashboard
2. **Error Handling**: More robust error handling with alerting
3. **Rate Limiting**: API rate limiting for external services
4. **Testing**: Unit and integration tests
5. **Monitoring**: Logging (Winston), metrics (Prometheus)
6. **Email Integration**: Real email sending (SendGrid, AWS SES)
7. **Webhooks**: Real-time updates via WebSockets
8. **CI/CD**: GitHub Actions for automated deployment

## License

MIT