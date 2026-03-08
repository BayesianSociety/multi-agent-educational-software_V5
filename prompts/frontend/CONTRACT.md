# Frontend Prompt Contract

## Objective
Implement the browser frontend for Pet Vet Coding Puzzles using deterministic runtime behavior and backend telemetry integration.

## Mandatory outputs
- `frontend/**` complete frontend application.
- `.codex/skills/frontend/SKILL.md` reproducible frontend workflow.
- `tests/**` frontend deterministic tests as needed for runtime and data contract checks.

## Constraints
- Preserve fixed `On Start` model with left library and right active code area.
- Include required controls `Play` and `Reset`.
- Include failure behavior with exact heading `Oops!` and failure-specific hint.
- Include exactly 17 playable puzzles from data contract fields.
- Emit runtime telemetry to backend endpoint contract.
- Preserve keyboard accessibility for major controls.
- Do not modify `.orchestrator/**` or `.git/**`.
