# Deflect — Specification (Round 1)

A first-person, single-arena sword duel in the browser. One player against one
AI boss, the **Ashen Warden**. This spec makes requirements R1–R8 from
`problem.md`, and the Round 2 requirements R9–R10, exact enough to test.

All times are in **milliseconds (ms)**, distances in **metres (m)**, speeds in
**m/s**. Health and posture are integers on a 0–100 scale unless noted.
Every number below lives in `src/logic/constants.js`; tests read the same constants.

## Conventions

- The game advances in fixed logic steps. `update(game, intent, dt)` advances
  time by `dt` ms; any `dt` larger than **50 ms** is split into sub-steps of at
  most 50 ms so no event is skipped.
- An attack's **impact moment** is the instant its wind-up ends. Hits, blocks,
  deflects and dodges are all judged at that instant.
- The player always faces the boss (automatic lock-on). The boss always faces
  the player.
- The arena is a circle of radius **11 m** centred on the origin. The player
  starts at (0, 4), the boss at (0, 0).

---

## R1 — Movement, attack, block, dodge (keyboard)

### Key mapping (`KeyboardEvent.code`)

| Action          | Keys                    | Type            |
|-----------------|-------------------------|-----------------|
| Move forward    | `KeyW`, `ArrowUp`       | held            |
| Move back       | `KeyS`, `ArrowDown`     | held            |
| Strafe left     | `KeyA`, `ArrowLeft`     | held            |
| Strafe right    | `KeyD`, `ArrowRight`    | held            |
| Attack          | `KeyJ`                  | press (edge)    |
| Block / deflect | `KeyK`                  | held; press edge matters for deflect |
| Dodge           | `Space`                 | press (edge)    |
| Restart         | `KeyR`, `Enter`         | press, only on win/lose screen |

Mouse is an optional extra: left button = attack, right button = block.
Any other key maps to no action.

### Movement

- Forward/back moves along the line to the boss at **3.0 m/s**.
- Strafe moves perpendicular to that line at **3.0 m/s** (circles the boss).
- While blocking, movement speed is **×0.5** (1.5 m/s).
- The player cannot move during an attack, a dodge (the dodge has its own
  motion), hit-stun or posture-break stun.
- The player can never get closer than **1.2 m** to the boss and never leave
  the arena radius (11 m).

### Attack

- Wind-up **250 ms**, then the hit is judged, then recovery **300 ms**
  (total 550 ms). Reach **3.0 m**.
- A new attack, block or dodge cannot start during the wind-up. During
  recovery, block and dodge may start (cancelling the recovery); another
  attack may not.

### Block

- Holding the block key raises the guard. Releasing lowers it immediately.
- Cannot start during attack wind-up, dodge, hit-stun or posture-break stun.

### Dodge

- Pressing dodge starts a **400 ms** dodge. Direction: left if a left key is
  held, right if a right key is held, otherwise backwards.
- The dodge moves the player **1.6 m** (4.0 m/s for 400 ms).
- **Invulnerability (i-frames): from 0 ms up to (not including) 300 ms** after
  the dodge starts. The last 100 ms is vulnerable.
- Cooldown: a new dodge may start **700 ms** after the previous one started.
- Cannot start during attack wind-up, hit-stun or posture-break stun.

---

## R2 — Perfect deflect vs normal block

Let `p` be the time the block key was last **pressed** (edge, not held) and
`t` the impact moment of an incoming blockable attack, with the guard still up.

| Condition at impact                                       | Result            |
|-----------------------------------------------------------|-------------------|
| Guard up and `0 ≤ t − p ≤ 180` and press was eligible     | **Perfect deflect** |
| Guard up otherwise (pressed early / held / ineligible)    | **Normal block**  |
| Guard down                                                | **Hit**           |

- **Deflect window: 180 ms** before impact.
- **Anti-mash rule:** a block press is *ineligible* for deflect if it comes
  less than **300 ms** after the previous block press. Mashing therefore only
  gives normal blocks.
- **Reward (deflect):** player takes 0 damage; boss gains the attack's
  *deflect posture* (large); player gains a small posture amount; spark effect.
  It also **pauses the boss's posture recovery for 1800 ms** from the impact
  (R3), so a chain of perfect deflects can break the boss on its own.
- **Penalty (normal block):** player takes 0 health damage but gains the
  attack's full *block posture*, which can break the player's guard (R3).
- **Penalty (no guard / late press):** full health damage (R7).

## R3 — Posture

Both fighters have a posture bar from **0** to **100**. 100 = broken.

### Posture gain

Per boss attack (also listed in R4):

| Boss attack | Player posture on block | Player posture on deflect | Boss posture on deflect |
|-------------|------------------------:|--------------------------:|------------------------:|
| Slash       | 15 | 5 | 15 |
| Overhead    | 25 | 6 | 22 |
| Combo (each strike) | 10 | 3 | 12 |
| Lunge (unblockable) | — | — | — |

Player attacks on the boss:

| Boss state when hit           | Boss health | Boss posture |
|-------------------------------|------------:|-------------:|
| Idle (guarding)               | 0 (blocked) | +8 |
| Wind-up                       | −10 | +4 |
| Recovery                      | −10 | +6 |

### Posture recovery

- Recovery starts **1200 ms** after the last posture gain.
- Player recovers **15 per second**.
- Boss recovers **12 per second × (boss health ÷ 100)**, but never less than
  **3 per second**. (Damaging the boss slows its posture recovery.)
- Nobody recovers while broken.
- **Deflect chain:** each perfect deflect (R2) stops boss posture recovery
  until **1800 ms** after its impact (a later deflect extends the pause; it
  never shortens it). Recovery still also waits the normal 1200 ms after the
  last posture gain. A **normal block** or a **hit** on the player (including
  the unblockable Lunge) ends the pause at once, and so does the end of a
  boss posture break. Only a well-timed chain therefore keeps the boss's
  posture climbing; normal blocks alone never break it.

### Posture break

- **Player:** when a block pushes posture to 100 the guard breaks. The player
  is stunned for **1500 ms** (cannot move, attack, block or dodge; hits deal
  full damage). When the stun ends, player posture is set to **50**.
  A *deflect* never breaks the player's guard: posture gained from a deflect
  stops at **99**.
- **Boss:** when posture reaches 100 the boss is **broken** for **3000 ms**:
  any attack in progress is cancelled, it cannot attack or guard, and the
  player may perform the finishing blow (R6). If the window passes, boss
  posture is set to **50** and it returns to idle.

## R4 — Boss AI, attack patterns and visual warnings

### States

`idle → windup → (strike) → recovery → idle`, plus `broken` and `dead`.
For combos, `windup` repeats for each strike before `recovery`.

- **Idle:** guarding. If farther than **2.5 m** from the player it walks
  toward the player at **2.2 m/s**. Idle lasts **800 + rng × 600 ms**
  (800–1400 ms; `rng` is injectable for tests).
- When idle time is up, the boss picks an attack:
  - distance ≤ 3.0 m: weighted random — Slash **35 %**, Overhead **25 %**,
    Combo **25 %**, Lunge **15 %**. Lunge is never chosen twice in a row
    (it becomes Slash instead).
  - 3.0 m < distance ≤ 5.0 m: Lunge, unless the previous attack was Lunge.
  - otherwise: stays idle (keeps walking) and checks again next step.

### Attacks

| Attack   | Wind-up(s) ms | Recovery ms | Damage | Reach | Blockable | Visual warning |
|----------|---------------|------------:|-------:|------:|-----------|----------------|
| Slash    | 700           | 700  | 15 | 3.0 m | yes | Sword drawn back over the right shoulder |
| Overhead | 1100          | 900  | 25 | 3.0 m | yes | Sword raised high with both hands, slow |
| Combo    | 600, 350, 350 | 1000 | 10 per strike | 3.0 m | yes | Sword held low-left, knight leans in; three quick strikes |
| Lunge    | 900           | 1200 | 30 | 5.0 m | **no** | **Red warning symbol** for the whole wind-up, crouch with sword at hip, red glow on blade |

- Combo wind-ups are measured from the previous strike's impact.
- **Glint:** every blockable strike shows a white glint on the blade when
  **≤ 300 ms** remain before impact — the cue for timing a deflect.
- The boss exposes a `telegraph` object during wind-up:
  `{ attack, strike, msToImpact, unblockable, glint }`. `null` otherwise.
- If the player is out of the attack's reach at the impact moment, the strike
  misses (no effect).

## R5 — Unblockable attack

- The **Lunge** is unblockable. Blocking or deflecting it does nothing: the
  player takes the full **30** damage.
- A dodge whose i-frames cover the impact moment avoids it completely.
- Being out of reach (> 5.0 m) also avoids it.
- The red warning symbol is shown from the start of its wind-up until impact.

## R6 — Finishing blow

- While the boss is **broken** (R3) and the player is within attack reach
  (**3.0 m**), pressing attack performs the finishing blow instead of a normal
  attack. It is instant, the boss dies and the player **wins**.
- If the boss's health reaches 0 from normal hits, it becomes broken with
  **no time limit**; the finishing blow is still required to win.

## R7 — Health

- Player and boss both start at **100** health.
- A hit lowers health by the attack's damage (table in R4 for boss attacks;
  **10** per player hit). Health never goes below 0.
- An unblocked boss hit puts the player in **300 ms** hit-stun (no actions).
- When player health reaches **0** the player **loses** immediately.

## R8 — Win / lose screen and restart

- On a win the screen shows "VICTORY" (after a **1500 ms** delay for the
  finishing-blow animation); on a loss "YOU DIED" (same delay).
- Both screens show a **Restart** button and the hint "Press R or Enter".
- Restart resets everything to the initial state: health 100/100, posture 0/0,
  starting positions, boss idle.
- While the fight is over, gameplay input is ignored.

---

# Round 2 — additional requirements

- **R9:** Let the player perform a special combo attack by pressing **J, J, L
  in a row**, which deals **extra damage and posture damage**, with **a Focus
  meter that fills when you deflect**, so that **skilled players who time their
  deflects well earn a powerful move that rewards good timing**.
- **R10:** Let the player perform a finishing move by pressing **F** once the
  boss has lost 70% or more of its health, which instantly kills the boss **as
  long as the boss is not mid-attack**, so that **players get a satisfying
  cinematic finish after wearing the boss down**.

## R9 — Special combo: Ember Strike

### Input

| Action  | Key    | Type         |
|---------|--------|--------------|
| Special | `KeyL` | press (edge) |

- The game remembers the times of the player's recent attack (`J`) presses.
  Every `J` press counts, even one that cannot start an attack (e.g. pressed
  during the wind-up of the previous swing).
- Pressing `L` triggers the Ember Strike when the two most recent remembered
  presses are both `J` and the first of them was at most **800 ms** before the
  `L` press (the whole J, J, L sequence fits in 800 ms).
- A block press, a dodge press or any `L` press clears the remembered presses,
  so each Ember Strike needs a fresh J, J, L.

### Focus meter

- The player has a **Focus** meter from **0** to **3**, starting at 0.
- Each **perfect deflect** (R2) adds **1**. Normal blocks, hits and dodges add
  nothing. Focus never exceeds 3.
- The Ember Strike needs a **full** meter (3) and uses all of it. With less
  than 3, J, J, L does nothing extra (the J presses still act as normal attacks).
- Restart resets Focus to 0.

### The strike

- It can start whenever the player is free to act **or is in its own attack
  (wind-up or recovery)**; it replaces the swing in progress. It cannot start
  during a dodge, hit-stun or posture-break stun.
- Wind-up **300 ms**, then the hit is judged, then recovery **500 ms**.
  Reach **3.0 m**. If the boss is out of reach at the hit, it misses (Focus is
  still spent).
- On a hit the boss takes **20** health damage and **+20** posture, **whether
  or not it is guarding** (the Ember Strike breaks through the boss's guard).
- If the boss reaches 0 health it is broken with no time limit (as R6); if its
  posture fills, it is broken for 3000 ms (as R3).
- If the boss is already broken when the Ember Strike lands, it is the
  finishing blow (R6) and the player wins.
- Like a normal attack, block and dodge may cancel its recovery.

## R10 — Execution

| Action  | Key    | Type         |
|---------|--------|--------------|
| Execute | `KeyF` | press (edge) |

- Pressing `F` performs the execution when **all** of these hold:
  - boss health is **30 or less** (it has lost 70 % or more of its 100 health);
  - the boss is **not mid-attack**: its state is idle, recovery or broken
    (never during any wind-up, including between combo strikes);
  - the player is within **3.0 m** of the boss;
  - the player is free to act (ready, or in attack recovery).
- The execution is instant: the boss dies and the player **wins** (end screen
  after the same 1500 ms delay as R8).
- Otherwise pressing `F` does nothing. It can be tried any number of times.
- The HUD shows an "F — Execute" prompt while the execution is available.

---

## Presentation (not unit-tested)

- First-person camera at eye height **1.65 m**. Sword held in the lower right,
  animated for attacks, blocks, deflects and dodges (camera sidesteps too).
- Armored knight boss built from primitive shapes in its own module
  (swappable later for a CC0 glTF model).
- Ruined castle courtyard at night with fires, embers, fog, moon, bloom.
- HUD: health and posture bars for both fighters, red unblockable warning,
  deflect sparks, camera shake on hits.
