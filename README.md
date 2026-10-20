# 2-on-1 Lab

A minimal 2D top-down web app for practicing 2-on-1 rugby pass decision-making and timing.

## Quick Start

Zero build step or dependencies. Serve the static files with any local HTTP server (required for ES modules):

```bash
python3 -m http.server 8000
# or
npx serve .
```

Open `http://localhost:8000`.

## Project Structure

- `index.html` — App shell, 10-rep history bar, canvas container, and modal overlays.
- `style.css` — Sports-science lab theme, responsive layout, and color-coded state classes.
- `simulation.js` — Pure 2D physics, ball lead calculation, defender steering/momentum, and without-replacement deck shuffling.
- `renderer.js` — HTML5 Canvas pitch rendering and oriented isosceles triangle player drawing.
- `app.js` — Game state loop, 10-rep routine scoring, input debouncing, and UI updates.

## Mechanics & Scoring

Each routine consists of **10 reps** sampled without replacement from a shuffled deck:
- **3x** `COMMIT_CARRIER` — Hard press on ball carrier
- **3x** `DRIFT_SUPPORT` — Early drift to support runner
- **2x** `SOFT_SHOW` — Fake drift, late bite on carrier
- **2x** `BAIT_PASS` — Press carrier, jump pass lane

| Outcome | Points |
| :--- | :--- |
| **Try** | `+10` |
| **Tackled** | `-2` |
| **Forward / Missed Pass** | `-5` |
| **Intercepted** | `-10` |
