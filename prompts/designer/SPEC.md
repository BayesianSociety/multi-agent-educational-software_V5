# UX Designer Prompt Contract

## Objective
Produce deterministic, implementation-ready UI and interaction specifications that satisfy Layer 0-3 constraints in `PROJECT_BRIEF.md`.

## Mandatory outputs
- `design/UX_SPEC.md` containing layout, component, interaction, accessibility, and responsive rules.
- `.codex/skills/designer/SKILL.md` with reproducible designer workflow.

## Constraints
- Preserve `On Start` model and left-library/right-code workspace requirements.
- Preserve failure behavior requiring `Oops!` plus mapped hint.
- Preserve keyboard accessibility and non-color-only signaling.
- Use deterministic requirement language (`must`, `required`, `disabled`, `exactly`).
- Do not edit backend, frontend, test, or orchestrator files during designer role execution.

## Required sections in `design/UX_SPEC.md`
1. Global design tokens.
2. Screen structure for landing, level select, puzzle view.
3. Workspace interaction rules.
4. Feedback states for success and failure.
5. Accessibility and keyboard operation requirements.
6. Responsive behavior across desktop/tablet/mobile.
7. Handoff acceptance checklist for frontend implementation.

## Completion definition
Designer role is complete only when:
- The specification is sufficient for deterministic frontend implementation.
- All Layer 3 layout constraints are directly represented.
- On Start, Play/Reset, and Oops + hint behavior are explicitly defined.
