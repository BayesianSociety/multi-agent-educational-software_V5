# Pet Vet Coding Puzzles

Browser-based educational coding puzzle game with a React frontend and Node.js + SQLite backend.

## Implemented Scope
- 17 data-driven puzzles (`id` 1..17) with progression.
- `On Start` programming area with connected/disconnected block behavior.
- `Play`/`Reset` controls, optional `Step`, speed toggle, and Show Code panel.
- Deterministic runtime with sequencing, loops, conditionals, movement collision handling, and failure hints (`Oops!`).
- Telemetry pipeline to SQLite for attempts, events, and movement steps.
- Analytics API endpoints for dashboard, puzzle detail (with movement replay), and event stream.

## Prerequisites
- Node.js 20+
- npm 10+

## Setup
```bash
cp .env.example .env
npm --prefix backend install
npm --prefix frontend install
```

## Run Locally
Terminal 1:
```bash
npm --prefix backend start
```

Terminal 2:
```bash
VITE_API_BASE=http://localhost:3000 npm --prefix frontend dev
```

Open the frontend URL printed by Vite (default `http://localhost:5173`).

## Backend API Contract
- `GET /health`
- `GET /api/levels`
- `GET /api/levels/:id`
- `POST /api/session/start`
- `POST /api/session/end`
- `POST /api/events/batch`
- `GET /api/analytics/dashboard`
- `GET /api/analytics/puzzle/:id`
- `GET /api/analytics/events`

## Test Commands
```bash
npm --prefix backend test
npm --prefix frontend test
```

## Data Location
Default SQLite path:
- `backend/data/pet_vet_puzzles.sqlite`

Override with:
- `SQLITE_PATH` in `.env`.

## Required Root Outputs
- `REQUIREMENTS.md`
- `TEST.md`
- `AGENT_TASKS.md`
- `README.md`
- `RUNBOOK.md`
