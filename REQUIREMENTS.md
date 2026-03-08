# REQUIREMENTS.md

## 1. Contract Authority
- This file is required to implement `PROJECT_BRIEF.md` constraints deterministically.
- Layer 0 through Layer 3 constraints are mandatory.
- If constraints conflict, the more restrictive constraint is required.

## 2. Layer 0 Requirements

### 2.1 Product Identity
- Product name must be `Pet Vet Coding Puzzles`.
- Product category must be a browser-based educational coding puzzle game.
- Product intent must recreate the interaction style of a beginner Hour-of-Code puzzle activity using only original assets and characters.

### 2.2 Delivery Obligations
Release is blocked unless the repository delivers all of the following:
- Complete working frontend and backend application.
- SQLite schema and telemetry pipeline that records all required movements and events.
- Polished, professional, accessible UI.
- Local teacher/observer analytics pages backed by SQLite queries.

### 2.3 Users, Safety, Privacy
- Primary audience must be beginner learners with reading ability.
- Core gameplay must not require account creation.
- Core gameplay telemetry and persistence must avoid unnecessary personal data collection.
- UI and content must not use proprietary logos or branded characters.
- UI and content must use original mentor and pet characters.

### 2.4 Accessibility Baseline
- Major controls must support keyboard navigation.
- Text and controls must maintain readable contrast.
- Essential information must not be conveyed by color only.
- Optional text-to-speech for goal text must be supported.

### 2.5 Platform Baseline
- Application must run in a modern browser with low-friction startup.
- UI must provide large buttons, clear labels, and friendly wording.

## 3. Layer 1 Requirements

### 3.1 Learning Goals
- Gameplay must teach and assess sequencing.
- Gameplay must teach and assess loops.
- Gameplay must teach and assess conditionals.

### 3.2 Theme and Scene Scope
- Player role must be assistant vet in a busy clinic day.
- Puzzle scenes must support clinic contexts, including waiting area, hallway, exam room, and treatment corner.
- Puzzle objectives must include navigation, pickup, treatment actions, and condition-driven treatment decisions.

### 3.3 Core Gameplay Loop
The runtime flow must implement all steps below:
1. Player opens a puzzle.
2. Player reads story and goal.
3. Player drags blocks into a connected sequence below fixed `On Start`.
4. Player presses `Play`.
5. Program executes and animates.
6. Incorrect result shows `Oops!` and a failure-specific hint.
7. Correct result marks puzzle complete and unlocks next puzzle.

### 3.4 Puzzle Structure
Each puzzle definition must include:
- Scene background.
- Pet character(s) and optional mentor.
- Objects and target locations.
- Goal statement.
- Limited command library for that puzzle.
- Coding area rooted at fixed `On Start`.

Puzzle success is valid only when all are true:
- Required location(s) are reached.
- Required interactions are completed.
- Execution completes without runtime failure.

### 3.5 Workspace Behavior
Command library requirements:
- Show only blocks available for current puzzle.
- Block categories must include `Movement`, `Actions`, `Control (loops)`, `Logic (conditionals)`, and `Sensing`.
- Blocks must be draggable.

Active code area requirements:
- Must include fixed `On Start` root.
- Blocks must connect in explicit vertical sequence.
- Disconnected blocks must not execute.
- UI must warn when disconnected blocks exist.

Control requirements:
- Required controls: `Play`, `Reset`.
- Optional controls allowed: `Step` debug execution, speed toggle (`slow`/`normal`/`fast`).

Feedback requirements:
- Incorrect results must show `Oops!`.
- Incorrect results must show failure-specific hint.
- Likely first incorrect block must be highlighted where feasible.

### 3.6 Block Language
- Visual blocks must be the primary programming interface.
- A `Show Code` toggle must exist.
- `Show Code` must display equivalent text representation.
- Text representation may be read-only.

### 3.7 Level Pack
- Exactly 17 puzzles are required.
- Puzzle IDs must cover `1..17`.
- Product must target typical learner completion time of about 30 minutes for the full pack.

Difficulty progression is required:
- Puzzles 1-5: sequencing basics, short pathing, pickup introduced by puzzle 4 or 5.
- Puzzles 6-10: loops with repeat counts and repeated actions.
- Puzzles 11-17: conditionals and mixed loops + conditionals with symptom checks.

### 3.8 Data-Driven Puzzle Contract
Puzzle definitions must be data-driven JSON and include all fields exactly:
- `id`
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

Field constraints:
- `id` must be integer in range `1..17`.

### 3.9 Runtime Execution Model
- Connected graph under `On Start` must compile to instruction list or AST before execution.
- Execution must be deterministic.
- Runtime must wait for animation completion between actions or use an equivalent deterministic queue.
- Conditions must evaluate from current world state.
- Loops must enforce strict max-iteration safety cap.

### 3.10 Movement and World Rules
- Movement model must be grid/tile based.
- `walk()` must advance exactly one tile in current facing direction.
- `turnLeft()` and `turnRight()` are optional but recommended for later levels.
- Obstacle collision must stop movement and fail the run with explicit reason.

Runtime state tracking is required for:
- Pet position, facing, animation state.
- Symptom booleans (including itchy, sniffles, injured).
- Inventory state.
- Station interaction state (including exam, medicine, bandage).

### 3.11 Failure Model and Hint Mapping
Minimum failure reasons that must be representable and mappable to hints:
- Target not reached.
- Wrong item used.
- Wrong order.
- Obstacle collision.
- Condition not handled.

Failure UX is blocked unless both are shown:
- `Oops!`
- Hint mapped from failure reason.

### 3.12 Deterministic User Flow Contract
Application flow must implement all stages:
1. Landing screen with title, start button, optional how-to-play.
2. Level select with 17 nodes and lock/unlock progression.
3. Puzzle screen with scene, goal, and scoped workspace blocks.
4. Drag/drop program authoring.
5. `Play` execution start.
6. Deterministic runtime execution and animation.
7. Success: celebration + next puzzle + persisted progress.
8. Failure: `Oops!` + hint + retry/reset path.

### 3.13 Gameplay Event Logging
The system must log all of the following:
- Puzzle opened/closed.
- Block added/removed/reordered/parameter changed.
- `Play` clicked.
- Run start/end.
- Every block execution start/finish.
- Every movement step.
- Every collision.
- Every pickup.
- Every treatment action.
- Hint shown (with reason/id).
- Puzzle completed.

At `Play` time, the corresponding attempt record must store complete `code_snapshot_json`.

### 3.14 Layer 1 Acceptance Outcomes
Release is blocked unless all are true:
- All 17 puzzles are playable with progression.
- Workspace behavior matches left-library/right-code/`On Start` model.
- Incorrect solution shows `Oops!` and contextual hint.
- Puzzle success persists and unlock progression advances.

### 3.15 Source-Grounded Constraints
The following are mandatory, not optional:
- Self-directed puzzle progression with increasing complexity.
- Left command library and right active code area under `On Start`.
- Incorrect runs trigger `Oops!` and helpful hint.
- Core concepts are sequencing, loops, and conditionals.
- Theme includes helping pets with sniffles, injuries, and itches using original characters.

## 4. Layer 2 Requirements

### 4.1 Architecture
- Frontend and backend are both required.
- Backend persistence source of truth must be SQLite.
- Frontend runtime flow must call backend for persistence.
- SQLite must initialize automatically on first run.

### 4.2 Backend Endpoint Contract
All endpoints below are required and path/method must match exactly:
- `GET /health`
- `GET /api/levels`
- `GET /api/levels/:id`
- `POST /api/session/start`
- `POST /api/session/end`
- `POST /api/events/batch`
- `GET /api/analytics/dashboard`
- `GET /api/analytics/puzzle/:id`
- `GET /api/analytics/events`

### 4.3 Telemetry Transport
- Frontend must send events to backend endpoint(s) for persistence.
- Critical events (including run start/end) must flush immediately.
- High-volume UI events may be debounced.
- Movement-step events must never be dropped.
- Execution-step events must never be dropped.
- Backend should batch transaction writes for performance.

### 4.4 SQLite Schema Contract
Required tables:
- `users`
- `sessions`
- `puzzles`
- `attempts`
- `events`
- `movements`
- `puzzle_progress`

Required columns and constraints:

`users`
- `id` TEXT PRIMARY KEY
- `created_at` INTEGER NOT NULL
- `display_name` TEXT

`sessions`
- `id` TEXT PRIMARY KEY
- `user_id` TEXT REFERENCES `users(id)`
- `started_at` INTEGER NOT NULL
- `ended_at` INTEGER
- `user_agent` TEXT
- `locale` TEXT

`puzzles`
- `id` INTEGER PRIMARY KEY
- `title` TEXT NOT NULL
- `concepts` TEXT NOT NULL

`attempts`
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

`events`
- `id` TEXT PRIMARY KEY
- `session_id` TEXT NOT NULL
- `user_id` TEXT
- `attempt_id` TEXT
- `puzzle_id` INTEGER
- `ts` INTEGER NOT NULL
- `type` TEXT NOT NULL
- `payload_json` TEXT NOT NULL

Minimum event type set required:
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

`movements`
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

`puzzle_progress`
- `user_id` TEXT NOT NULL
- `puzzle_id` INTEGER NOT NULL
- `completed_at` INTEGER
- `best_attempt_id` TEXT
- PRIMARY KEY (`user_id`, `puzzle_id`)

### 4.5 Analytics Contract
Local/protected analytics pages backed by SQLite are required.

Dashboard must include:
- Total sessions.
- Total attempts.
- Success rate.
- Average attempts per puzzle.
- Average time per puzzle.

Puzzle detail must include:
- Attempt timeline per puzzle.
- Read-only code snapshot rendering per attempt.
- Attempt result and failure reason.
- Execution step counts.
- Movement replay reconstructed from `movements`.

Event stream viewer must include:
- Filter by session, puzzle, and attempt.
- Clear display of event type and payload JSON.

### 4.6 Tech Stack Constraint
- Recommended stack may be replaced, but replacement quality must be equivalent.
- Any replacement must preserve all fixed interfaces and schema contracts defined in this file.

### 4.7 Deterministic Test and Integration Constraints
- Tests must run deterministically and pass with exit code `0`.
- At least one deterministic flow must verify write, reload/refetch, and persisted readback.
- Persistence and integration checks must verify backend is used in runtime flow.

## 5. Layer 3 Requirements

### 5.1 Layout and Visual Structure
Puzzle interface must include all three regions:
1. Top bar with title, `Puzzle X of 17`, progress indicator, sound toggle, settings.
2. Main canvas scene with mentor story prompt and goal banner.
3. Workspace overlay with left command library, right assembly area, and clear primary `Play` action.

### 5.2 Visual Style
- Presentation must be polished, friendly, and cohesive.
- Spacing, corner radius style, and typography hierarchy must be consistent.
- Button hierarchy and affordances must be clear.
- Iconography and micro-interactions must be friendly and subtle.
- Block snap animations and hover/feedback states must be smooth and meaningful.

### 5.3 Accessibility and Usability
- Controls and labels must remain large and beginner-friendly.
- Colorblind-safe contrast checks are required.
- Critical signals must not rely on color only.
- Major controls must be keyboard-friendly.

### 5.4 UX Feedback Quality Bar
- Animation flow must be smooth and free of obvious jank.
- Failure and success feedback must be immediate and understandable.
- Hints must guide without fully giving away solutions.
- Disconnected code and invalid logic must be clearly surfaced.

## 6. Product Acceptance Gate (Release Blockers)
Release is blocked unless all are true:
1. Game contains exactly 17 playable puzzles with clear progression.
2. Each puzzle has left block library and right active code area under `On Start`.
3. `Play` executes code and incorrect solutions show `Oops!` plus hint.
4. SQLite database initializes automatically on first run.
5. Completed runs persist `attempts`, `events`, and `movements`.
6. Analytics can replay movement paths from `movements` data.
7. End-to-end deterministic tests exist and pass.

## 7. Role Traceability Matrix
| Requirement Area | Implementation Owner | QA Owner | Required Evidence |
|---|---|---|---|
| Puzzle pack size, progression, and learning-concept coverage | `frontend_dev` | `qa_tester` | Deterministic puzzle data tests and progression tests |
| Workspace contract (`On Start`, left library/right code, disconnected warning) | `frontend_dev` | `qa_tester` | UI interaction tests with deterministic assertions |
| Runtime determinism, failure mapping, and hint behavior | `frontend_dev` | `qa_tester` | Engine tests + failure-path tests |
| Backend endpoint contract and SQLite auto-init | `backend_dev` | `qa_tester` | API integration tests + first-run DB init verification |
| Schema contract (`users`, `sessions`, `puzzles`, `attempts`, `events`, `movements`, `puzzle_progress`) | `backend_dev` | `qa_tester` | Schema verification tests/migrations checks |
| Telemetry persistence (`attempts`, `events`, `movements`) and no-drop step events | `frontend_dev` + `backend_dev` | `qa_tester` | End-to-end telemetry persistence tests |
| Analytics dashboard, puzzle detail, and event stream filtering | `backend_dev` + `frontend_dev` | `qa_tester` | Analytics endpoint tests + UI readback checks |
| Accessibility baseline and Layer 3 UI quality constraints | `ux_designer` + `frontend_dev` | `qa_tester` | Keyboard/contrast checks + UX acceptance checklist |
| Acceptance gate enforcement | `release_engineer` | `qa_tester` | Release checklist blocked unless all gate items pass |

## 8. Change Control
- Requirement changes must preserve all Layer 0-3 constraints.
- Acceptance gate constraints must not be weakened.
- Contract items with fixed endpoint paths, table names, field names, and minimum event types must remain exact.
