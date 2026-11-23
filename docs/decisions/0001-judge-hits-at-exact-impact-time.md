# 0001 — Judge deflects at the exact impact time with fixed-size logic sub-steps

- Status: accepted
- Date: 2026-11-22
- Requirements: R2 (deflect window), R5 (dodge i-frames), R4 (attack timing)

## Context

The perfect deflect is the core of the game. Its window is 180 ms, and dodge
invulnerability is 300 ms. Browsers deliver frames at uneven intervals
(16 ms at 60 Hz, 7 ms at 144 Hz, 100 ms+ during a hitch or a background tab).
If an attack is judged "whenever the frame happens to notice it", the effective
window changes with frame rate. Hitches then turn a deflect into a hit, or a
hit into a deflect, and the rule can't be tested exactly.

Alternatives considered:

1. **Per-frame check with the frame's variable `dt`.** The impact is judged on
   the first frame where `now >= impactAt`, compared with `now`. This is the
   simplest option, but accuracy depends on frame timing and tests would need
   tolerances.
2. **Fixed-timestep accumulator (e.g. 60 Hz ticks).** Deterministic, but every
   timing becomes a multiple of 16.67 ms (a 180 ms window is really 183.3 ms).
   Tests would need to reason in ticks, not the milliseconds in the spec.
3. **Variable sub-steps of at most 50 ms, but judge each event at its exact
   scheduled time.** Every strike carries its own `impactAt`. Block presses
   are timestamped at the start of the step they arrive in. The deflect check
   compares those two timestamps, not the frame time.

## Decision (Y-statement)

In the context of **a timing-based deflect system that must behave the same at
any frame rate and be unit-testable to the millisecond**, facing **uneven
browser frame intervals and frame hitches**, we decided for **variable logic
sub-steps capped at 50 ms, with every strike, deflect and dodge judged at its
exact scheduled impact timestamp**, and neglected **per-frame checks against
`now` and a fixed-tick accumulator**, to achieve **frame-rate-independent,
exactly-specified windows (0–180 ms deflect, 0–300 ms i-frames) that tests can
check at their boundaries**, accepting **that input timestamps are only as fine
as the step they arrive in, and that `update()` needs a small sub-stepping
loop**.

## Consequences

- Tests such as "R2: perfect deflect at exactly 180 ms before impact" and
  "R5: i-frames cover 0 to 300 ms of the dodge only" assert exact boundaries.
- A 100 ms frame hitch can't skip a combo strike (strikes are 350 ms apart and
  steps are at most 50 ms), and it can't move a strike's judged time.
- Input precision is limited to the frame the key event arrives in (about
  16 ms at 60 Hz). That is well inside the 180 ms window.
