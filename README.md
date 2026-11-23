# Deflect

A first-person sword duel that runs in the browser. You face one armored boss,
the **Ashen Warden**, in a ruined castle courtyard at night. You win by reading
its attacks, timing deflects and filling its posture bar, not by mashing
buttons. Once its posture breaks, you land the finishing blow.

Everything is built in code with Three.js (the knight, the sword, the
courtyard, fire, embers and sparks). Nothing is loaded from the network at
runtime.

## How to play

| Action          | Keys                         |
|-----------------|------------------------------|
| Move / strafe   | `W` `A` `S` `D` or arrow keys |
| Attack          | `J` or left mouse button     |
| Block / deflect | `K` (hold) or right mouse button |
| Dodge           | `Space` (with `A`/`D` to sidestep, otherwise back-step) |
| Ember Strike    | `J` `J` `L` in quick succession (needs a full Focus meter) |
| Execute         | `F` (boss at 30% health or less, not mid-attack) |
| Restart         | `R` or `Enter` on the end screen, or click **Restart** |

- **Deflect:** press block within **180 ms** of a hit landing. A white glint
  flashes on the boss's blade 300 ms before each blockable strike. A deflect
  costs you no health, adds a lot of posture to the boss, and adds very little
  to you.
- **Block:** if you hold block too early you still stop the damage, but your
  own posture goes up. If your posture bar fills, your guard breaks and you
  are stunned for 1.5 s. Mashing block gives you no deflects: a press less than
  300 ms after the previous one can't deflect.
- **Red warning:** the lunge is **unblockable**. When the red diamond appears,
  dodge.
- **Posture:** posture recovers after 1.2 s without new pressure. Each perfect
  deflect also freezes the boss's posture for 1.8 s, so chained deflects can
  break it on their own; a normal block or taking a hit ends the freeze. The
  more the boss is hurt, the slower its posture recovers, so hit it while it
  recovers from its attacks.
- **Finishing blow:** when the boss's posture breaks, or its health hits zero,
  press attack within 3 m to win.
- **Ember Strike:** every perfect deflect lights one of three Focus pips above
  your health bar. With all three lit, press `J` `J` `L` within 0.8 s for a
  heavy cut that breaks through the boss's guard (20 damage, +20 posture).
- **Execute:** once the boss is down to 30% health, press `F` within 3 m while
  it is not winding up an attack to finish it on the spot.

Exact numbers for every rule are in [spec.md](spec.md).

## Running it

Requires Node.js 22.12+ (the minimum Vite 8 and Vitest 5 support).

```sh
npm install
npm run dev
```

Then open the URL Vite prints (usually http://localhost:5173).

`npm run build` produces a static bundle in `dist/` and `npm run preview`
serves it.

## Testing

```sh
npm test
```

Vitest runs the logic tests in `tests/`. Each test name starts with the
requirement it checks (R1–R8 in [problem.md](problem.md), R9–R10 in [spec.md](spec.md)), for example
`R2: perfect deflect inside window`. `tests/full-fight.test.js` also plays whole
fights with a seeded random number generator.

## Project layout

```
src/logic/    game rules as plain JS, with no Three.js or DOM (this is what the tests cover)
  constants.js  every number from spec.md
  input.js      key/mouse -> action mapping, per-frame intent
  health.js, posture.js
  combat.js     deflect / block / hit / dodge resolution, finishing blow
  enemyAI.js    boss state machine, attack choice, telegraphs
  game.js       game state, player actions, win/lose/restart
src/render/   Three.js scene: courtyard, knight model, first-person sword, effects
src/hud/      HTML/CSS HUD (bars, warning, end screen)
tests/        Vitest tests named by requirement ID
docs/decisions/  architecture decision records
```

The renderer and HUD only read logic state. The knight model lives in its own
module (`src/render/enemyModel.js`) behind a small interface, so a CC0
animated glTF can replace it later. Any such asset must be credited in
`CREDITS.md`.
