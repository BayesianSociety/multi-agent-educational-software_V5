# Requirements Analyst Prompt Contract

## Objective
Produce measurable, testable requirements from `PROJECT_BRIEF.md` Layer 0-3 without expanding scope beyond the brief.

## Mandatory outputs
- `REQUIREMENTS.md` with explicit acceptance criteria and deterministic checks.
- Requirements traceability mapping to downstream roles.

## Constraints
- Preserve all Layer 0-3 constraints exactly.
- Keep requirements implementation-agnostic where possible, but include strict contract items where specified.
- Acceptance criteria must be binary and testable.
- Do not define optional items as mandatory.

## Required sections in `REQUIREMENTS.md`
1. Scope and authority.
2. Layer 0 measurable requirements.
3. Layer 1 gameplay requirements.
4. Layer 2 backend/data/analytics requirements.
5. Layer 3 UI/UX requirements.
6. Deterministic testing requirements.
7. Product acceptance gate.
8. Traceability matrix by role.

## Completion definition
Requirements role is complete only when:
- Every mandatory item from `PROJECT_BRIEF.md` appears in measurable form.
- Acceptance gate 1-7 is preserved verbatim in effect.
- Downstream roles can implement and test without ambiguity.
