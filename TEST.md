# TEST.md

## Deterministic QA Test Commands
```bash
npm --prefix backend test
npm --prefix frontend install
npm --prefix frontend test
```

## Coverage Contract
- `npm --prefix backend test` must validate deterministic telemetry write, API readback, required endpoint contract, SQLite schema table contract, and persistence across server reload.
- `npm --prefix frontend test` must validate deterministic puzzle data and runtime engine behavior.

## Pass Criteria
- All commands exit with code `0`.
- Backend test assertions must pass for:
  - `GET /health`
  - `GET /api/levels`
  - `GET /api/levels/:id`
  - `POST /api/session/start`
  - `POST /api/session/end`
  - `POST /api/events/batch`
  - `GET /api/analytics/dashboard`
  - `GET /api/analytics/puzzle/:id`
  - `GET /api/analytics/events`
- Backend tests must prove write -> server restart -> readback for `attempts`, `events`, and `movements`-derived replay data.
