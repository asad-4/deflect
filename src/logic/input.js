// Maps raw keyboard/mouse input to game actions (R1, R9). No DOM access here:
// the browser layer forwards event.code / event.button into these functions.

export const KEY_BINDINGS = Object.freeze({
  KeyW: 'forward',
  ArrowUp: 'forward',
  KeyS: 'back',
  ArrowDown: 'back',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyJ: 'attack',
  KeyL: 'special',
  KeyK: 'block',
  Space: 'dodge',
  KeyR: 'restart',
  Enter: 'restart',
});

export const MOUSE_BINDINGS = Object.freeze({
  0: 'attack',
  2: 'block',
});

export function mapKey(code) {
  return KEY_BINDINGS[code] ?? null;
}

export function mapMouseButton(button) {
  return MOUSE_BINDINGS[button] ?? null;
}

/** Tracks held actions plus press edges since the last frame. */
export function createInputState() {
  return { held: new Set(), pressed: new Set() };
}

export function pressAction(input, action) {
  if (!action) return;
  if (!input.held.has(action)) input.pressed.add(action);
  input.held.add(action);
}

export function releaseAction(input, action) {
  if (!action) return;
  input.held.delete(action);
}

export function releaseAll(input) {
  input.held.clear();
}

/**
 * Builds this frame's intent and clears press edges.
 * forward/right are in [-1, 1].
 */
export function consumeIntent(input) {
  const h = input.held;
  const p = input.pressed;
  const intent = {
    forward: (h.has('forward') ? 1 : 0) - (h.has('back') ? 1 : 0),
    right: (h.has('right') ? 1 : 0) - (h.has('left') ? 1 : 0),
    attack: p.has('attack'),
    blockHeld: h.has('block'),
    blockPressed: p.has('block'),
    dodge: p.has('dodge'),
    special: p.has('special'),
    restart: p.has('restart'),
  };
  p.clear();
  return intent;
}

export function emptyIntent(overrides = {}) {
  return {
    forward: 0,
    right: 0,
    attack: false,
    blockHeld: false,
    blockPressed: false,
    dodge: false,
    special: false,
    restart: false,
    ...overrides,
  };
}
