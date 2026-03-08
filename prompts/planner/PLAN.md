# Planner Deterministic Plan Reference

## Authoritative Inputs
- `PROJECT_BRIEF.md`
- `AGENT_TASKS.md`

## Role Execution Order
1. `release_engineer`
2. `requirements_analyst`
3. `ux_designer`
4. `backend_dev`
5. `frontend_dev`
6. `qa_tester`
7. `docs_writer`
8. `product_acceptance_gate`

## Hard Prerequisites
- `requirements_analyst` starts only after `release_engineer` bootstrap artifacts exist.
- `ux_designer` starts only after measurable requirements are committed.
- `backend_dev` starts only after measurable requirements are committed.
- `frontend_dev` starts only after requirements + UX spec + backend contracts are committed.
- `qa_tester` starts only after frontend/backend integration is complete.
- `docs_writer` starts only after deterministic tests and commands are finalized.
- `product_acceptance_gate` runs only after roles 0-6 complete.

## Deterministic Handoff Requirements
- `requirements_analyst` provides measurable clauses for gameplay, telemetry, persistence, analytics, accessibility.
- `ux_designer` provides implementable layout/interaction/accessibility/feedback specification.
- `backend_dev` provides SQLite schema, auto-init behavior, endpoint contracts, analytics query behavior.
- `frontend_dev` provides 17-puzzle runtime behavior, `On Start` workspace, `Oops!` + hint flow, telemetry emission.
- `qa_tester` provides deterministic write -> reload/refetch -> readback evidence and pass command(s).
- `docs_writer` provides operator docs synchronized to tested implementation.

## Product Acceptance Gate Ownership
- Gate 1-3: `frontend_dev` producer, `qa_tester` verifier.
- Gate 4: `backend_dev` producer, `qa_tester` verifier.
- Gate 5-6: `backend_dev` + `frontend_dev` producers, `qa_tester` verifier.
- Gate 7: `qa_tester` producer, `product_acceptance_gate` verifier.

## Constraints
- Use deterministic statements only.
- Do not modify `.orchestrator/**` or `.git/**`.
- Planner write scope: `AGENT_TASKS.md`, `prompts/planner/**`, `.codex/skills/planner/**`.
