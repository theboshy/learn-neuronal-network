# Neural Self-Driving

A neural-network-powered self-driving car simulation that learns by trial and error. 1000 cars per generation evolve their brains through mutation — the best one is saved and seeds the next generation.

Built with vanilla HTML, CSS and JavaScript — no frameworks, no build step.

**[▶ Open simulation](https://theboshy.github.io/learn-neuronal-network/) · [📄 Documentation](https://theboshy.github.io/learn-neuronal-network/docs/)**

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

| Action               | How                          |
|----------------------|------------------------------|
| Switch vehicle model | Sidebar → **Vehicle** tabs   |
| Save best brain      | Sidebar → **Save Brain**     |
| Reset training       | Sidebar → **Reset Brain**    |
| Spawn random hazard  | Sidebar → **Add Obstacle**   |
| Pause / resume       | `ESC`                        |

## Vehicle models

Three trainable vehicles, each with its own brain stored separately. Switching the tab resets the simulation and loads that vehicle's saved brain (or starts fresh).

| Model    | Size      | Max speed |
|----------|-----------|-----------|
| 🚗 Car   | 30 × 50   | 3.0       |
| 🏍 Moto  | 16 × 38   | 3.6       |
| 🚌 Bus   | 38 × 95   | 2.4       |

## Hazards

**Add Obstacle** spawns a random hazard in a random lane ahead of the best car:
- **Pothole** — small dark crater (26 × 20 hitbox)
- **Wreck + cones** — crashed car with traffic cones (38 × 52 hitbox)
- **Burning trash** — pile with animated flames (22 × 24 hitbox)

All hazards expose a polygon, so raycast sensors detect them just like other vehicles.

## Project layout

```
index.html               page + panel markup
style.css                dark terminal theme
index.js                 bootstrap — creates Simulation and calls start()
simulation.js            game loop, generation lifecycle, model switcher
vehicles.js              Vehicle base class + CarVehicle, MotoVehicle, BusVehicle
ray-sensor.js            raycast sensors
obstacle.js              pothole / wreck / burning-trash hazards
street.js                road, lanes, roadside decoration
neural-network.js        feed-forward + mutation
network-visualizer.js    live network diagram
controls.js              input flags
utils.js                 lerp, intersection, polygon collision
consts.js                CAR_TYPE, VEHICLE_MODELS, shared constants
```

## Tech notes

- Ghost cars are batch-rendered as polygons in two single fills (alive / damaged) — no per-car draw calls.
- Off-screen cars skip rendering; physics keeps running so brains stay comparable.
- Saved brains include their generation number with backwards compatibility for older saves.
