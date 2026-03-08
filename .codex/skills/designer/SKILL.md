# designer

## Purpose
Create deterministic UX/UI specifications for `Pet Vet Coding Puzzles` aligned to `PROJECT_BRIEF.md` Layer 0-3.

## Required Inputs
- `PROJECT_BRIEF.md`
- `REQUIREMENTS.md`
- `AGENT_TASKS.md`

## Write Scope
- `design/**`
- `prompts/designer/**`
- `.codex/skills/designer/**`

## Workflow
1. Extract mandatory UI behavior from Layer 0, Layer 1 workspace model, and Layer 3 layout constraints.
2. Define required screen structures for landing, level select, and puzzle workspace.
3. Specify block workspace behavior with fixed `On Start`, disconnected warning, `Play`, and `Reset`.
4. Define deterministic feedback behavior for success and failure with `Oops!` and hint mapping.
5. Define accessibility requirements for keyboard operation, focus visibility, and non-color signaling.
6. Define responsive behavior for desktop, tablet, and mobile.
7. Publish a handoff checklist that frontend implementation can validate directly.

## Validation Checklist
- Puzzle screen requires top bar, scene, and workspace regions.
- Workspace requires left command library and right active code sequence area.
- Required controls include `Play` and `Reset`.
- Failure state includes exact `Oops!` heading and hint message requirement.
- Accessibility rules cover keyboard navigation and readable contrast.
- No edits outside designer write scope.
