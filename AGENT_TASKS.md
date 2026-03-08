# AGENT_TASKS.md

## Role Targets
- `release_engineer`: bootstrap operational documents and environment files.
- `planner`: deterministic dependency plan and sequencing.
- `requirements_analyst`: measurable requirement and acceptance contract.
- `ux_designer`: actionable interface and interaction specification.
- `frontend_dev`: puzzle experience and telemetry emission.
- `backend_dev`: SQLite schema, persistence, and analytics endpoints.
- `qa_tester`: deterministic tests for gameplay and persistence.
- `docs_writer`: startup, test, troubleshooting, and recovery documentation.

## Deterministic Role Sequence
| Order | Role | Explicit Prerequisites | Completion Artifacts | Verification Owner |
|---|---|---|---|---|
| 0 | `release_engineer` | none | Required root files/directories present; role prompt/skill directories present | `planner` |
| 1 | `requirements_analyst` | `release_engineer` complete | Measurable Layer 0-3 + Product Acceptance Gate requirements in `REQUIREMENTS.md` | `planner` |
| 2 | `ux_designer` | `requirements_analyst` complete | `design/` specification for layout, interaction model, accessibility, feedback states | `planner` |
| 3 | `backend_dev` | `requirements_analyst` complete | SQLite auto-init, required schema, required API endpoints, analytics query surfaces | `qa_tester` |
| 4 | `frontend_dev` | `requirements_analyst` + `ux_designer` + `backend_dev` complete | 17-puzzle gameplay UI/runtime, backend-integrated telemetry emission, progression UX | `qa_tester` |
| 5 | `qa_tester` | `frontend_dev` + `backend_dev` complete | Deterministic integration and persistence tests, `TEST.md` execution contract | `product_acceptance_gate` |
| 6 | `docs_writer` | `qa_tester` complete | `README.md` + `RUNBOOK.md` aligned to final commands and behaviors | `product_acceptance_gate` |
| 7 | `product_acceptance_gate` | roles 0-6 complete | Gate checks 1-7 all true | final human/orchestrator decision |

## Layer Obligation Mapping (Producer -> Verifier)
| Contract Obligation | Producer Role | Verifier Role |
|---|---|---|
| Complete working application (frontend + backend) | `frontend_dev` + `backend_dev` | `qa_tester` |
| SQLite schema + telemetry pipeline for required movements/events | `backend_dev` + `frontend_dev` | `qa_tester` |
| Polished, professional, accessible UI | `ux_designer` + `frontend_dev` | `qa_tester` |
| Local teacher/observer analytics pages backed by SQLite queries | `backend_dev` + `frontend_dev` | `qa_tester` |
| Beginner-safe, privacy-minimal gameplay without account requirement | `requirements_analyst` + `frontend_dev` + `backend_dev` | `qa_tester` |
| Keyboard navigation, contrast, no color-only critical signaling, optional TTS support path | `ux_designer` + `frontend_dev` | `qa_tester` |
| Modern-browser low-friction UX with large clear controls | `ux_designer` + `frontend_dev` | `qa_tester` |
| Learning goals: sequencing, loops, conditionals | `requirements_analyst` + `frontend_dev` | `qa_tester` |
| Core loop with `On Start`, Play/execute, `Oops!` + hint on failure, progression unlock on success | `frontend_dev` | `qa_tester` |
| Data-driven puzzle JSON contract with ids 1..17 and required fields | `frontend_dev` | `qa_tester` |
| Deterministic runtime execution with loop safety cap and world-state evaluation | `frontend_dev` | `qa_tester` |
| Required failure reason coverage and hint mapping | `frontend_dev` | `qa_tester` |
| Deterministic user flow: landing -> level select -> puzzle -> run -> success/failure | `frontend_dev` | `qa_tester` |
| Gameplay event logging set + play-time `code_snapshot_json` persistence | `frontend_dev` + `backend_dev` | `qa_tester` |
| Backend required endpoints contract | `backend_dev` | `qa_tester` |
| Telemetry transport guarantees and persistence durability for execution/movement events | `frontend_dev` + `backend_dev` | `qa_tester` |
| SQLite table contract: `users`, `sessions`, `puzzles`, `attempts`, `events`, `movements`, `puzzle_progress` | `backend_dev` | `qa_tester` |
| Analytics dashboard/puzzle detail/event viewer contract including movement replay from `movements` | `backend_dev` + `frontend_dev` | `qa_tester` |
| Deterministic tests with write -> reload/refetch -> persisted readback | `qa_tester` | `product_acceptance_gate` |
| Required top bar / scene / workspace three-region layout and visual quality bar | `ux_designer` + `frontend_dev` | `qa_tester` |

## Required Handoff Artifacts
| From Role | To Role | Required Handoff Artifact |
|---|---|---|
| `requirements_analyst` | `ux_designer` | Measurable UI and accessibility acceptance clauses for Layer 0/1/3 |
| `requirements_analyst` | `backend_dev` | Measurable schema, endpoint, telemetry durability, analytics obligations |
| `requirements_analyst` | `frontend_dev` | Measurable gameplay/runtime/telemetry obligations and puzzle contract |
| `ux_designer` | `frontend_dev` | Screen-region layout, interaction states, feedback states, accessibility behavior |
| `backend_dev` | `frontend_dev` | Stable endpoint payload contracts for levels, sessions, events, analytics |
| `frontend_dev` | `qa_tester` | Runtime behaviors, event emission behavior, persistence touchpoints |
| `backend_dev` | `qa_tester` | SQLite schema, query behavior, movement replay data contract |
| `qa_tester` | `docs_writer` | Final deterministic test commands and pass criteria |
| `docs_writer` | `product_acceptance_gate` | Operator documentation synchronized to verified implementation |

## Product Acceptance Gate Mapping
| Gate Item | Producer Role(s) | Required Pre-Gate Dependency |
|---|---|---|
| 1. Exactly 17 playable puzzles with clear progression | `frontend_dev` | `requirements_analyst`, `ux_designer`, `backend_dev` complete |
| 2. Left block library and right active code area under `On Start` | `frontend_dev` | `requirements_analyst`, `ux_designer` complete |
| 3. `Play` executes code and incorrect shows `Oops!` + hint | `frontend_dev` | `requirements_analyst`, `ux_designer` complete |
| 4. SQLite initializes automatically on first run | `backend_dev` | `requirements_analyst` complete |
| 5. Completed runs persist `attempts`, `events`, `movements` | `backend_dev` + `frontend_dev` | `backend_dev` and `frontend_dev` integration complete |
| 6. Analytics replay movement paths from `movements` | `backend_dev` + `frontend_dev` | `backend_dev` analytics + `frontend_dev` analytics surfaces complete |
| 7. Deterministic end-to-end tests exist and pass | `qa_tester` | `frontend_dev` + `backend_dev` complete |

## Deterministic Completion Checklist
- [x] Sequence includes all required downstream roles before `product_acceptance_gate`.
- [x] Dependencies require frontend/backend integration before QA execution.
- [x] Layer 0-3 and Product Acceptance Gate obligations mapped to producer and verifier roles.
- [x] Required role handoff artifacts are explicitly defined.
- [x] Planner edits constrained to planner allowlist files only.
