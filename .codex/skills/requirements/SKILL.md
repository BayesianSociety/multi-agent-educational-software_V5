# requirements

## Purpose
Convert `PROJECT_BRIEF.md` into deterministic, testable requirement artifacts for implementation roles.

## Workflow
1. Read `PROJECT_BRIEF.md` and extract mandatory constraints from Layer 0-3.
2. Encode each constraint as measurable requirements in `REQUIREMENTS.md`.
3. Preserve endpoint/table/event contracts exactly where explicitly defined.
4. Preserve Product Acceptance Gate as release blockers.
5. Add role traceability so implementation and QA ownership is unambiguous.

## Output rules
- Use deterministic language (`must`, `required`, `blocked unless`).
- Avoid narrative, aspirational, or unverifiable statements.
- Keep requirements technology-neutral except where contract fixes specific interfaces or schemas.

## Done criteria
- `REQUIREMENTS.md` includes all Layer 0-3 mandatory constraints in testable form.
- Acceptance gate items remain complete and enforceable.
- No edits outside requirements-owned artifacts for this step.
