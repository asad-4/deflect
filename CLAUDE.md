# CLAUDE.md — standing rules for this project

## Stack
- 3D browser game in JavaScript (ES modules).
- Three.js for rendering, Vite for the dev server and build, Vitest for tests.

## Architecture
- All game rules live in plain JS modules in `src/logic/` (combat, posture,
  health, enemy AI state machine, game state, input mapping).
- `src/logic/` must have **no Three.js imports** (and no DOM access) so it can be
  tested in Node.
- The 3D scene (`src/render/`) and HUD (`src/hud/`) only **read** logic state and
  draw it. They never change game rules.
- Exact numbers come from `spec.md` and live in `src/logic/constants.js`.

## Tests
- Tests live in `tests/` and use Vitest.
- Every test name starts with the requirement ID it checks,
  e.g. `"R2: perfect deflect inside window"`.
- Test logic only; do not test rendering.

## Commits
- Run `npm test` before every commit. Never commit failing tests.
- Never edit `problem.md`.
- Never amend or undo a commit (no `--amend`, no reset/revert of history).
- Never track `node_modules`, `dist` or `.jsonl` files.
- Small commits whose messages say what changed and why.

## Assets
- No external URLs, CDNs or online assets at runtime; everything is bundled
  locally (including Three.js addons such as postprocessing, imported from the
  `three` package).
- Any 3D models or textures added later must be CC0 and credited in `CREDITS.md`.
