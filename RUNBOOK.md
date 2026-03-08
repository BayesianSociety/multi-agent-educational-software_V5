# RUNBOOK.md

## Environment
`.env.example` defines runtime defaults:
- `PORT=3000`
- `SQLITE_PATH=./backend/data/pet_vet_puzzles.sqlite`
- `FRONTEND_API_BASE_URL=http://localhost:3000`
- `APP_ENV=development`
- `APP_VERSION=0.1.0`

Frontend API target is read from `VITE_API_BASE` at dev runtime.

## First-Time Setup
1. Create local env file.
```bash
cp .env.example .env
```
2. Install backend dependencies.
```bash
npm --prefix backend install
```
3. Install frontend dependencies.
```bash
npm --prefix frontend install
```

## Start Services
1. Start backend.
```bash
npm --prefix backend start
```
Expected startup line:
```text
backend_listening:3000
```

2. Start frontend.
```bash
VITE_API_BASE=http://localhost:3000 npm --prefix frontend dev
```

## Health and Contract Checks
1. Backend health:
```bash
curl -s http://localhost:3000/health
```
Expected JSON:
```json
{"status":"ok"}
```

2. Level pack count:
```bash
curl -s http://localhost:3000/api/levels | jq 'length'
```
Expected value:
```text
17
```

## Deterministic Verification
```bash
npm --prefix backend test
npm --prefix frontend test
```

## Troubleshooting
- `vitest: not found`: run `npm --prefix frontend install` before frontend tests.
- Frontend cannot reach backend: start backend and run frontend with `VITE_API_BASE=http://localhost:3000`.
- SQLite file missing: start backend once; DB and required tables auto-initialize.

## Recovery
1. Stop backend/frontend processes.
2. Optional clean database reset:
```bash
rm -f backend/data/pet_vet_puzzles.sqlite
```
3. Start backend again to reinitialize schema and puzzle seed data.
