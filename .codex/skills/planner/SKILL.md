# planner skill

## Purpose
Produce deterministic dependency sequencing and role handoff constraints aligned to `PROJECT_BRIEF.md`.

## Required Inputs
- `PROJECT_BRIEF.md`
- Current `AGENT_TASKS.md`
- Current repository role directories under `prompts/` and `.codex/skills/`

## Write Scope
- `AGENT_TASKS.md`
- `prompts/planner/**`
- `.codex/skills/planner/**`

## Workflow
1. Extract Layer 0-3 and Product Acceptance Gate obligations from `PROJECT_BRIEF.md`.
2. Map each obligation to producer role and verifier role.
3. Define strict role ordering with explicit prerequisites.
4. Record required handoff artifacts between roles.
5. Update `AGENT_TASKS.md` with sequencing table and completion checklist.
6. Update `prompts/planner/**` with deterministic plan reference.

## Validation Checklist
- Sequence includes all required downstream roles before `product_acceptance_gate`.
- Dependencies include frontend/backend integration before QA.
- Acceptance Gate items are mapped to producers.
- No edits outside planner allowlist.
