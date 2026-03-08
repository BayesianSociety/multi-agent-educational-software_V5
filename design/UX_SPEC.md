# Pet Vet Coding Puzzles UX Specification

## 1. Scope
- This file is the deterministic UX/UI contract for frontend implementation.
- All requirements in this file are mandatory unless explicitly marked optional.
- Source authority: `PROJECT_BRIEF.md` Layer 0-3 and `REQUIREMENTS.md`.

## 2. Global Design Tokens
### 2.1 Color tokens
- `--bg-page: #f4f7fb`
- `--bg-surface: #ffffff`
- `--bg-surface-alt: #eaf2ff`
- `--bg-scene: #dff3ea`
- `--text-primary: #1a2230`
- `--text-secondary: #394a63`
- `--text-inverse: #ffffff`
- `--accent-primary: #0a7a5a`
- `--accent-primary-hover: #09684c`
- `--accent-secondary: #1b5cb8`
- `--warning: #b36b00`
- `--error: #ad1f2d`
- `--success: #1f7a2e`
- `--focus-ring: #ffb703`
- `--border-default: #bfd0e6`

### 2.2 Typography tokens
- `--font-ui: "Atkinson Hyperlegible", "Trebuchet MS", sans-serif`
- `--font-code: "JetBrains Mono", "Consolas", monospace`
- `--text-title: 32px/40px`
- `--text-h2: 24px/32px`
- `--text-h3: 20px/28px`
- `--text-body: 18px/26px`
- `--text-small: 16px/22px`

### 2.3 Spacing and shape tokens
- Spacing scale: `4, 8, 12, 16, 20, 24, 32` px.
- `--radius-sm: 10px`
- `--radius-md: 14px`
- `--radius-lg: 20px`
- `--shadow-card: 0 6px 16px rgba(18, 44, 82, 0.12)`
- Major controls must render with minimum `48px` height.

### 2.4 Motion tokens
- `--motion-fast: 120ms`
- `--motion-base: 180ms`
- `--motion-slow: 260ms`
- Easing: `cubic-bezier(0.2, 0.7, 0.2, 1)`
- Block snap animation duration: `180ms`

## 3. Required Screen Structures
### 3.1 Landing screen
Required elements:
- Product title exactly `Pet Vet Coding Puzzles`.
- Primary action `Start`.
- Secondary action `How to Play`.
- Optional action `Continue` only when saved progress exists.

Layout rules:
- Centered surface container with max width `960px`.
- `Start` must be visually primary.
- Friendly original mentor/pet artwork placeholders are allowed.

### 3.2 Level select screen
Required elements:
- Header title and progress summary.
- Exactly 17 puzzle nodes labeled `1` to `17`.
- Lock state for unavailable puzzles.
- Completed state indicator for solved puzzles.

Interaction and signaling:
- Hover/focus state must reveal puzzle title.
- Locked state must show lock icon and the text `Locked`.
- Completed state must show check icon and the text `Completed`.
- State meaning must not rely on color only.

### 3.3 Puzzle screen
Puzzle screen must contain exactly three primary regions:
1. Top bar.
2. Scene region.
3. Workspace region.

Top bar required content:
- Product title.
- Puzzle index in format `Puzzle X of 17`.
- Progress indicator.
- Sound toggle.
- Settings button.

Scene region required content:
- Mentor story prompt.
- Goal banner.
- Grid/tile scene rendering entities and objects.
- Optional goal text-to-speech trigger.

Workspace region required content:
- Left command library.
- Right active code area.
- Fixed `On Start` root at top of active code area.
- Required controls `Play` and `Reset`.
- Optional controls `Step` and speed toggle (`Slow`, `Normal`, `Fast`).
- `Show Code` toggle with equivalent text representation (read-only permitted).

## 4. Workspace Behavior Contract
### 4.1 Command library
- Library must show only blocks listed in current puzzle `availableBlocks`.
- Block categories must include `Movement`, `Actions`, `Control`, `Logic`, and `Sensing` where applicable to puzzle scope.
- Blocks must be draggable.

### 4.2 Active code area
- `On Start` root is fixed and cannot be removed.
- Connected blocks form a vertical sequence and define execution order.
- Disconnected blocks must not execute.
- If any disconnected block exists, UI must show warning text exactly `Disconnected blocks will not run.`

### 4.3 Run controls
- `Play` must start deterministic execution from initial compiled sequence.
- `Reset` must restore deterministic initial puzzle world state.
- While a run is in progress, `Play` must be disabled.
- `Reset` must remain available during and after run.

## 5. Deterministic Feedback States
### 5.1 Failure feedback
Failure state must include all of:
- Heading text exactly `Oops!`.
- A hint text mapped from failure reason.
- Highlight of likely first incorrect block when technically feasible.

Failure reason to hint mapping contract:
- `target_not_reached` -> hint must direct learner to reach the goal tile/location.
- `wrong_item_used` -> hint must direct learner to change selected treatment/item.
- `wrong_order` -> hint must direct learner to reorder interaction sequence.
- `obstacle_collision` -> hint must direct learner to avoid obstacle before moving.
- `condition_not_handled` -> hint must direct learner to add condition check before action.

### 5.2 Success feedback
Success state must include all of:
- Celebration panel.
- Primary action `Next Puzzle`.
- Persisted completion status visible on return to level select.

## 6. Accessibility Requirements
- Major controls must be keyboard reachable.
- Visible focus ring is required on all focusable controls.
- Required keyboard flow order: top bar controls -> scene controls -> library blocks -> active code area -> run controls.
- Critical state information must include text and icon; not color alone.
- Text and controls must maintain readable contrast.
- Feedback region (`Oops!`, hints, completion) must be announced through ARIA live region.
- Drag/drop must include keyboard alternative for add/reorder actions.

## 7. Responsive Behavior
Breakpoints:
- Desktop: `>= 1100px`.
- Tablet: `700px` to `1099px`.
- Mobile: `<= 699px`.

Desktop requirements:
- Scene and workspace are visible without mode switching.
- Workspace shows left library and right code area side-by-side.

Tablet requirements:
- Scene above workspace.
- Workspace uses two columns when available width permits; otherwise stacked.

Mobile requirements:
- Top bar may wrap to two rows.
- Workspace uses tabs `Library` and `Program`.
- `Play` and `Reset` remain pinned in persistent bottom action bar.

## 8. Handoff Checklist (Frontend Verifiable)
- Puzzle view includes top bar, scene region, and workspace region.
- Workspace includes left command library and right active code area.
- Active code area includes fixed `On Start` root.
- Disconnected block warning appears with exact text `Disconnected blocks will not run.`
- Required controls `Play` and `Reset` are present and keyboard operable.
- Failure state shows exact heading `Oops!` and mapped hint text.
- Success state shows completion panel and `Next Puzzle` action.
- Keyboard focus is visible and follows required navigation flow.
- Critical states include non-color indicators.
- Desktop/tablet/mobile behavior matches Section 7.
