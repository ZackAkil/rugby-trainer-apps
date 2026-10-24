# Rugby Lab

A collection of minimal 2D top-down web apps for practicing rugby decision-making and timing.

## Quick Start

Zero build step or dependencies. Serve the root folder with any local HTTP server:

```bash
python3 -m http.server 8000
# or
npx serve .
```

Open `http://localhost:8000` to view the drill launcher.

## Drills

- [`2-on-1-lab/`](./2-on-1-lab/) — 10-rep 2-on-1 pass timing vs randomized defender behaviors (`COMMIT_CARRIER`, `DRIFT_SUPPORT`, `SOFT_SHOW`, `BAIT_PASS`).
- [`scrum-half-lab/`](./scrum-half-lab/) — 10-rep 3v3 tag rugby scrum-half swipe passing onto a moving line runner (scored `/10` per rep for a `/100` routine score).

## Shared Foundation (`shared/`)

All drills share reusable, dependency-free ES modules and base styles:

- [`shared/math.js`](./shared/math.js) — 2D clamping, interpolation, angle blending, deck shuffling, bone constraints, and 2-bone inverse kinematics (`solveTwoBoneIK`).
- [`shared/physics.js`](./shared/physics.js) — Pitch dimensions, inertia steering (`steerEntityWithInertia`), ball flight/bounce physics, and ragdoll detached-arm physics (`createRippedArmsState`, `stepRippedArmsPhysics`).
- [`shared/canvas.js`](./shared/canvas.js) — Shared 2D lab canvas primitives (calibration grid, try zone, reference lines, player triangles, ball, IK arms, ragdoll arms, countdown badge, swipe vector).
- [`shared/ui.js`](./shared/ui.js) — Cooldown debouncing, pointer-to-canvas coordinate mapping, 10-rep history chips, color-coded breakdown bullets, and summary cards.
- [`shared/lab.css`](./shared/lab.css) — Shared monochrome/accent Lab UI stylesheet.
