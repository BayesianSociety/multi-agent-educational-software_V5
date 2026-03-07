# PROJECT_BRIEF.md

This document is the authoritative human-readable project contract for this repository.

Contract precedence rules:
- This file is normative for Layer 0 through Layer 3 project constraints.
- If two clauses conflict, the more restrictive clause governs.
- No appendix in this file is optional context; all requirements below are active contract requirements.

# Layer 0
## Product identity
- Product name: Pet Vet Coding Puzzles.
- Product category: browser-based educational coding puzzle game.
- Product intent: recreate the interaction style of a beginner Hour-of-Code puzzle activity with original assets and characters.

## Role and output obligations
You are expected to deliver:
1. A complete working application (frontend + backend).
2. A SQLite schema and telemetry pipeline that records all required movements and events.
3. A polished, professional, accessible UI.
4. Local teacher/observer analytics pages backed by SQLite queries.

## Users, safety, and privacy
- Primary users are beginner learners with reading ability.
- Core gameplay must not require account creation.
- Avoid unnecessary personal data collection for core gameplay.
- Do not use proprietary logos or branded characters; use original mentor and pet characters.

## Accessibility baseline
- Major controls must support keyboard navigation.
- Text and controls must keep readable contrast.
- Essential information must not be conveyed by color only.
- Optional text-to-speech for goal text is supported.

## Platform constraints
- Must run in a modern browser with low friction.
- Large buttons, clear labels, and friendly wording are required.

# Layer 1
## Learning goals
The game must teach and assess:
- Sequencing.
- Loops.
- Conditionals.

## Game summary and thematic scope
- The player is an assistant vet in a busy clinic day.
- Puzzle scenes may include waiting area, hallway, exam room, and treatment corner.
- Puzzle objectives include navigation, pickup, treatment actions, and condition-driven treatment decisions.

## Core gameplay loop
1. Player opens a puzzle.
2. Player reads story and goal.
3. Player drags blocks into a connected sequence below `On Start`.
4. Player presses `Play`.
5. Program executes and animates.
6. If incorrect, user receives `Oops!` and a helpful failure-specific hint.
7. If correct, puzzle is marked complete and next puzzle unlocks.

## Puzzle structure requirements
Each puzzle must define:
- Scene background.
- Pet character(s) and optional mentor.
- Objects and target locations.
- Goal statement.
- Limited command library for that puzzle.
- A coding area starting at fixed `On Start` root.

Success requires:
- Reaching required location(s).
- Completing required interactions.
- Completing execution without runtime failure.

## Workspace behavior requirements
### Command library
- Show only blocks available in current puzzle.
- Block categories include:
  - Movement
  - Actions
  - Control (loops)
  - Logic (conditionals)
  - Sensing
- Blocks are draggable.

### Active code area
- Must include fixed `On Start` root.
- Blocks connect in an explicit vertical sequence.
- Disconnected blocks do not execute.
- UI must warn when disconnected blocks exist.

### Controls
- Required: `Play`, `Reset`.
- Optional: `Step` debug execution.
- Optional: speed toggle (slow/normal/fast).

### Feedback
On incorrect result:
- Show `Oops!` message.
- Show failure-specific hint.
- Highlight likely first incorrect block where feasible.

## Block language requirement
- Visual blocks are primary programming interface.
- A Show Code toggle must exist and display equivalent text representation (read-only acceptable).

## Level pack specification
- Exactly 17 puzzles.
- Typical learner runtime target: about 30 minutes.

### Difficulty progression
- Puzzles 1 to 5: sequencing basics, short pathing, introduce pickup by puzzle 4 or 5.
- Puzzles 6 to 10: loops with repeat counts and repeated actions.
- Puzzles 11 to 17: conditionals and mixed loops + conditionals using symptom checks.

### Data-driven puzzle contract
Puzzle definitions must be data-driven JSON with fields:
- `id` (1..17)
- `title`
- `storyText`
- `goalText`
- `scene`
- `grid`
- `entities`
- `availableBlocks`
- `constraints`
- `successCriteria`
- `hintRules`

## Runtime execution model
- Compile connected graph under `On Start` to instruction list or AST.
- Execute deterministically.
- Wait for animation completion between actions or use deterministic queue.
- Evaluate conditions from current world state.
- Enforce strict max-iteration safety cap on loops.

## Movement and world rules
- Use grid/tile movement.
- `walk()` advances one tile in facing direction.
- `turnLeft()` and `turnRight()` are optional but recommended in later levels.
- Collision with obstacle must stop movement and fail run with explicit reason.

Track runtime world state:
- Pet position, facing, animation state.
- Symptom booleans such as itchy/sniffles/injured.
- Inventory state.
- Station interaction state (exam, medicine, bandage, etc.).

## Failure model and hint mapping
Failure reasons include at least:
- Target not reached.
- Wrong item used.
- Wrong order.
- Obstacle collision.
- Condition not handled.

Failure UX must show:
- `Oops!`
- Hint mapped from failure reason.

## Deterministic user flow contract
1. Landing screen with title, start button, optional how-to-play.
2. Level select with 17 nodes and lock/unlock progression.
3. Puzzle screen with scene, goal, and scoped workspace blocks.
4. Author program via drag/drop.
5. Press Play.
6. Runtime executes and animates.
7. Success path shows celebration + next puzzle and persists progress.
8. Failure path shows `Oops!` + hint + retry/reset.

## Event logging requirements (gameplay level)
Log all of:
- Puzzle opened/closed.
- Block added/removed/reordered/parameter changed.
- Play clicked.
- Run start/end.
- Every block execution start/finish.
- Every movement step.
- Every collision.
- Every pickup.
- Every treatment action.
- Hint shown (with reason/id).
- Puzzle completed.

At Play time, store complete `code_snapshot_json` in attempts data.

## Layer 1 acceptance outcomes
- All 17 puzzles are playable with progression.
- Workspace behavior matches left-library/right-code/On-Start model.
- Incorrect solution must show `Oops!` and contextual hint.
- Puzzle success persists and unlock behavior advances.

## Source-grounded constraints
Treat these as explicit constraints:
- Self-directed puzzle progression with increasing complexity.
- Left command library and right active code area under `On Start` model.
- Incorrect runs trigger `Oops!` and helpful hint.
- Core concepts are sequencing, loops, and conditionals.
- Theme includes helping pets with sniffles, injuries, and itches using original characters.

# Layer 2
## Architecture decisions
- Frontend and backend are both required.
- Backend persistence source of truth is SQLite.
- Frontend must call backend in runtime flow.
- SQLite must initialize automatically on first run.

## Backend endpoint contract
Required endpoints:
- `GET /health`
- `GET /api/levels`
- `GET /api/levels/:id`
- `POST /api/session/start`
- `POST /api/session/end`
- `POST /api/events/batch`
- `GET /api/analytics/dashboard`
- `GET /api/analytics/puzzle/:id`
- `GET /api/analytics/events`

## Telemetry transport behavior
- Frontend sends events to backend endpoint(s) for persistence.
- Critical events flush immediately (e.g., run start/end).
- High-volume UI events may be debounced.
- Movement steps and execution-step events must never be dropped.
- Backend should batch transaction writes for performance.

## Persistence schema contract
Required SQLite tables:
- `users`
- `sessions`
- `puzzles`
- `attempts`
- `events`
- `movements`
- `puzzle_progress`

### `users`
- `id` TEXT PRIMARY KEY
- `created_at` INTEGER NOT NULL
- `display_name` TEXT

### `sessions`
- `id` TEXT PRIMARY KEY
- `user_id` TEXT REFERENCES `users(id)`
- `started_at` INTEGER NOT NULL
- `ended_at` INTEGER
- `user_agent` TEXT
- `locale` TEXT

### `puzzles`
- `id` INTEGER PRIMARY KEY
- `title` TEXT NOT NULL
- `concepts` TEXT NOT NULL

### `attempts`
- `id` TEXT PRIMARY KEY
- `session_id` TEXT REFERENCES `sessions(id)`
- `user_id` TEXT REFERENCES `users(id)`
- `puzzle_id` INTEGER REFERENCES `puzzles(id)`
- `started_at` INTEGER NOT NULL
- `ended_at` INTEGER
- `result` TEXT CHECK(result IN ('success','failure','aborted')) NOT NULL
- `failure_reason` TEXT
- `code_snapshot_json` TEXT NOT NULL
- `block_count` INTEGER NOT NULL
- `execution_steps` INTEGER NOT NULL
- `client_version` TEXT

### `events`
- `id` TEXT PRIMARY KEY
- `session_id` TEXT NOT NULL
- `user_id` TEXT
- `attempt_id` TEXT
- `puzzle_id` INTEGER
- `ts` INTEGER NOT NULL
- `type` TEXT NOT NULL
- `payload_json` TEXT NOT NULL

Minimum event type set:
- `ui.play_clicked`
- `ui.reset_clicked`
- `ui.hint_shown`
- `ui.block_added`
- `ui.block_removed`
- `ui.block_reordered`
- `run.started`
- `run.ended`
- `exec.block_started`
- `exec.block_finished`
- `move.step`
- `move.turn`
- `world.pickup`
- `world.treat_applied`
- `world.collision`
- `puzzle.completed`

### `movements`
- `id` TEXT PRIMARY KEY
- `attempt_id` TEXT NOT NULL REFERENCES `attempts(id)`
- `ts` INTEGER NOT NULL
- `entity` TEXT NOT NULL
- `from_x` INTEGER NOT NULL
- `from_y` INTEGER NOT NULL
- `to_x` INTEGER NOT NULL
- `to_y` INTEGER NOT NULL
- `direction` TEXT
- `cause` TEXT NOT NULL
- `blocked` INTEGER NOT NULL DEFAULT 0

### `puzzle_progress`
- `user_id` TEXT NOT NULL
- `puzzle_id` INTEGER NOT NULL
- `completed_at` INTEGER
- `best_attempt_id` TEXT
- PRIMARY KEY (`user_id`, `puzzle_id`)

## Analytics contract
Build local/protected analytics pages backed by SQLite:

### Dashboard
- Total sessions.
- Total attempts.
- Success rate.
- Average attempts per puzzle.
- Average time per puzzle.

### Puzzle detail
- Attempt timeline per puzzle.
- Read-only code snapshot rendering per attempt.
- Attempt result and failure reason.
- Execution step counts.
- Movement replay reconstructed from `movements`.

### Event stream viewer
- Filter by session, puzzle, and attempt.
- Show event type and payload JSON clearly.

## Tech stack constraints
Recommended but replaceable with equivalent quality:
- Frontend: TypeScript + React + Canvas/PixiJS or equivalent.
- Block UI: custom or Blockly with substantial visual integration.
- Backend: Node.js + TypeScript + Express/Fastify.
- SQLite driver: reliable library (`better-sqlite3` or `sqlite3`).

## Test and determinism constraints
- Tests must run deterministically and pass with exit code zero.
- At least one deterministic flow must verify write, reload/refetch, and persisted readback.
- Persistence and integration checks must verify backend is actually used in runtime flow.

# Layer 3
## Layout and visual structure
Three primary interface regions are required:
1. Top bar with title, puzzle index (`Puzzle X of 17`), progress indicator, sound toggle, settings.
2. Main canvas scene with mentor story prompt and goal banner.
3. Workspace overlay with left command library, right assembly area, and clear primary Play action.

## Visual style requirements
- Polished, friendly, cohesive presentation.
- Consistent spacing, corner radius style, and typography hierarchy.
- Clear button hierarchy and strong affordances.
- Friendly iconography and subtle motion/micro-interactions.
- Smooth block snap animations and meaningful hover/feedback states.

## Accessibility and usability
- Large, beginner-friendly controls and readable labels.
- Colorblind-safe contrast checks.
- No critical color-only signaling.
- Keyboard-friendly operation for major controls.

## UX feedback quality bar
- Smooth animation flow without obvious jank.
- Failure and success feedback should be immediate and understandable.
- Hints should guide without fully giving away solutions.
- Disconnected code and invalid logic must be clearly surfaced.

# Required Outputs
## Required root files
- `REQUIREMENTS.md`
- `TEST.md`
- `AGENT_TASKS.md`
- `README.md`
- `RUNBOOK.md`

## Required directories
- `design/`
- `frontend/`
- `backend/`
- `tests/`
- `prompts/<agent>/`
- `.codex/skills/<agent>/`

# Product Acceptance Gate
A run passes only when all are true:
1. The game contains exactly 17 playable puzzles with clear progression.
2. Each puzzle has left block library and right active code area under `On Start`.
3. `Play` executes code and incorrect solutions show `Oops!` plus hint.
4. SQLite database initializes automatically on first run.
5. Completed runs persist `attempts`, `events`, and `movements`.
6. Analytics can replay movement paths from `movements` data.
7. End-to-end deterministic tests exist and pass.

# Role Targets
- `release_engineer`: bootstrap operational documents and environment files.
- `planner`: deterministic dependency plan and sequencing.
- `requirements_analyst`: measurable requirement and acceptance contract.
- `ux_designer`: actionable interface and interaction specification.
- `frontend_dev`: puzzle experience and telemetry emission.
- `backend_dev`: SQLite schema, persistence, and analytics endpoints.
- `qa_tester`: deterministic tests for gameplay and persistence.
- `docs_writer`: startup, test, troubleshooting, and recovery documentation.
