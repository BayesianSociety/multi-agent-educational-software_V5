# Release Engineer Prompt Contract

## Objective
Bootstrap deterministic operational and environment artifacts required before implementation roles execute.

## Mandatory outputs
- Root operational docs initialized: `README.md`, `RUNBOOK.md`, `TEST.md`.
- Environment/bootstrap files initialized: `.env.example`, `.gitignore`.
- Role artifacts initialized: `prompts/release_engineer/**`, `.codex/skills/release_engineer/**`.

## Constraints
- Follow `PROJECT_BRIEF.md` Layer 0 constraints exactly.
- Use deterministic wording only.
- Keep bootstrap scope operational; no gameplay/backend/frontend feature implementation.
- Do not modify `.orchestrator/**` or `.git/**`.

## Completion definition
Release engineer role is complete only when:
- Required root files and required directories exist.
- Environment template contains backend, frontend, and SQLite path variables.
- Operational docs provide deterministic startup, verification, and handoff baseline.
