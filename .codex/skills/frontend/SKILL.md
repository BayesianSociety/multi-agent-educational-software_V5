# Frontend Implementation Skill

## Purpose
Implement deterministic frontend gameplay for Pet Vet Coding Puzzles.

## Workflow
1. Load puzzle data definitions and validate exactly 17 puzzle objects with required fields.
2. Implement three-screen flow: landing, level select, puzzle.
3. Implement workspace model:
- Left command library by category.
- Right program area under fixed `On Start`.
- Connected and disconnected block handling.
4. Implement runtime engine with deterministic sequencing, loop safety cap, collision failure, and condition evaluation.
5. Implement required feedback states:
- Success panel with next progression.
- Failure panel with exact `Oops!` and hint mapping.
6. Implement backend API client and telemetry batching:
- Immediate flush for run/execution/movement/treatment/collision/completion events.
- Debounced flush for non-critical UI events.
7. Add deterministic frontend tests for puzzle count/data contract and runtime semantics.
