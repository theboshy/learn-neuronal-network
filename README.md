# Neural Self-Driving

A neural-network-powered self-driving car simulation that learns by trial and error. 1000 cars per generation evolve their brains through mutation — the best one is saved and seeds the next generation.

Built with vanilla HTML, CSS and JavaScript — no frameworks, no build step.

## Run it

Open `index.html` in any modern browser. That's it.

```bash
xdg-open index.html   # Linux
open index.html       # macOS
start index.html      # Windows
```

Or serve it locally if you prefer:

```bash
python3 -m http.server 8000
```

## How it works

Each car has a feed-forward neural network with three layers:

- **Sensors** — 10 raycast distances (90° forward arc)
- **Hidden** — 6 neurons
- **Drive** — 4 outputs (forward, left, right, reverse)

Every generation, 1000 cars start at the same position with mutated copies of the previous best brain. The one that travels furthest before crashing becomes the new best. Its brain is saved to `localStorage` together with the generation number.

## Controls

| Action            | How                          |
|-------------------|------------------------------|
| Save best brain   | Sidebar → **Save Brain**     |
| Reset training    | Sidebar → **Reset Brain**    |
| Drop obstacle     | Sidebar → **Add Obstacle**   |
| Pause / resume    | `ESC`                        |

## Project layout

```
index.html               page + panel markup
style.css                dark terminal theme
index.js                 main loop, generation lifecycle
car.js                   car shape, physics, lane changes
sensors.js               raycast sensors
street.js                road, lanes, roadside decoration
neural-network.js        feed-forward + mutation
network-visualizer.js    live network diagram
controls.js              input flags
utils.js / consts.js     helpers
```

## Tech notes

- Ghost cars are batch-rendered as polygons in two single fills (alive / damaged) — no per-car draw calls.
- Off-screen cars skip rendering; physics keeps running so brains stay comparable.
- Saved brains include their generation number with backwards compatibility for older saves.
