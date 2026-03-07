PROJECT PROMPT 5 (REPLACEABLE PROJECT INPUT)

Purpose:
This file is the project input specification for the engine.
It tells the system what product to build for this specific project.
This file is replaceable between projects.
This file is not the runtime source of truth. It is the source used to generate and maintain the runtime brief.

Project identity:
- Product name: Pet Vet Coding Puzzles
- Product type: browser educational coding puzzle game
- Domain: child friendly puzzle based programming learning

Layer 0 requirements (non negotiable):
- Platform: modern web browser
- Audience: beginner learners who can read instructions
- Safety and privacy: no required personal account for core gameplay
- Accessibility: keyboard support for major controls, readable contrast, no color only meaning

Layer 1 requirements (minimum viable product loop):
- Exactly seventeen playable puzzles
- Puzzle progression with unlock behavior
- Story theme: veterinary clinic day with original characters
- Learning concepts: sequencing, loops, conditionals
- Core loop: arrange blocks under On Start, run, observe result, receive success or Oops plus hint

Layer 2 requirements (architecture):
- Frontend and backend are both required
- Backend persistence uses SQLite as source of truth
- Frontend must use backend endpoints in runtime flow
- Required backend endpoints:
  - GET /health
  - GET /api/levels
  - GET /api/levels/:id
  - POST /api/session/start
  - POST /api/session/end
  - POST /api/events/batch
  - GET /api/analytics/*
- Required telemetry behavior:
  - persist all movement steps
  - persist all block execution start and finish events
  - persist run start and end
  - persist interactions and outcome reasons

Layer 3 requirements (content and user experience):
- Workspace structure:
  - left panel command library
  - right panel active code area
  - fixed On Start root
- Controls:
  - Play
  - Reset
  - optional Step
  - speed control
- Failure feedback:
  - show Oops
  - show failure specific hint
- Visual direction:
  - polished, friendly, consistent spacing and typography
  - clear progress indicators

Data contract requirements:
- Puzzle data must be data driven JavaScript Object Notation
- Each puzzle includes:
  - id
  - title
  - storyText
  - goalText
  - scene
  - grid
  - entities
  - availableBlocks
  - constraints
  - successCriteria
  - hintRules

Telemetry and database contract requirements:
- SQLite tables required:
  - users
  - sessions
  - puzzles
  - attempts
  - events
  - movements
  - puzzle_progress
- Analytics pages required:
  - dashboard
  - puzzle detail with movement replay
  - event stream viewer

Acceptance targets for this project:
- Seventeen puzzles are playable
- Incorrect solution shows Oops and hint
- SQLite initializes automatically on first run
- Completed run persists attempts, events, and movements
- Analytics can replay movement path from movements table

Role specific targets:
- release_engineer: bootstrap operational documents and environment files
- planner: produce deterministic step dependency plan
- requirements_analyst: produce measurable requirements and acceptance criteria
- ux_designer: produce detailed layout and interaction design
- frontend_dev: implement puzzle experience and telemetry emission
- backend_dev: implement SQLite schema, persistence, and analytics endpoints
- qa_tester: implement deterministic tests for gameplay and persistence
- docs_writer: document startup, tests, troubleshooting, and recovery

Output requirement for this prompt:
- Generate and maintain PROJECT_BRIEF_5 as the normalized runtime contract.
