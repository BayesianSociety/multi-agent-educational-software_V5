# Product Acceptance Gate Report

## Scope
- Source of truth: `PROJECT_BRIEF.md` Product Acceptance Gate items 1-7.
- Role: `product_acceptance_gate`.
- Date: `2026-03-08`.

## Gate Results
| Gate | Requirement | Status | Evidence |
|---|---|---|---|
| 1 | Exactly 17 playable puzzles with clear progression | PASS | `frontend/src/data/puzzles.ts` defines ids `1..17`; `frontend/src/App.tsx` uses `unlockedMax` progression and level locks. |
| 2 | Left block library and right active code area under `On Start` | PASS | `frontend/src/App.tsx` renders `.library`, `.program-area`, and fixed `On Start` root. |
| 3 | `Play` executes code and incorrect shows `Oops!` plus hint | PASS | `frontend/src/App.tsx` `playProgram()` calls `runProgram()`; failure UI renders heading `Oops!` and `runResult.hint`. |
| 4 | SQLite initializes automatically on first run | PASS | `backend/src/db.js` `createDatabase()` creates directory and executes `CREATE TABLE IF NOT EXISTS ...` for required schema. |
| 5 | Completed runs persist `attempts`, `events`, `movements` | PASS | `backend/src/db.js` `insertEventBatch()` writes `events`; maps `run.started/run.ended` to `attempts`; maps `move.step` to `movements`. Verified by `npm --prefix backend test` passing. |
| 6 | Analytics can replay movement paths from `movements` data | PASS | `backend/src/db.js` `buildMovementReplay()` + `getPuzzleAnalytics()` include `movementReplay`; exposed by `GET /api/analytics/puzzle/:id` in `backend/src/server.js`. |
| 7 | End-to-end deterministic tests exist and pass | FAIL | Tests exist (`tests/backend.integration.test.mjs`, `frontend/src/lib/engine.test.ts`, `frontend/src/data/puzzles.test.ts`). Backend test passed. Frontend dependency install/test blocked in this environment: `npm --prefix frontend install --offline` exited `1` (`ENOTCACHED`); `npm --prefix frontend test` exited `127` (`vitest: not found`). |

## Deterministic Command Evidence
- `npm --prefix backend test` -> exit `0`.
- `npm --prefix frontend test` -> exit `127` (`vitest: not found`).
- `npm --prefix frontend install --offline` -> exit `1` (`ENOTCACHED`).

## Gate Decision
- Product Acceptance Gate: `FAIL`.
- Blocking item(s): `7`.
