# OOP Refactor — Design Spec
**Date:** 2026-06-08  
**Project:** learn-neuronal-network  
**Status:** Approved

---

## Goal

Refactor the codebase to apply OOP, SOLID, and DRY principles without changing any runtime behavior or visual output. The simulation must work identically before and after.

---

## 1. Vehicle Hierarchy

### Problem
`car.js` has a single `Car` class that handles physics, brain feeding, collision detection, lane-change AI, and rendering. The `draw()` method contains an `if/else` branch per vehicle model — adding a new vehicle requires modifying `Car` (OCP violation).

### Solution: `vehicles.js`

Replace `car.js` with `vehicles.js` containing:

**`Vehicle` — abstract base class**
- Owns all logic shared across models: physics, polygon, collision, sensors, brain, lane-change.
- `draw(ctx)` renders the shared parts (body color by role, glow on main, X on damaged, wheels, turn signal) then calls `this._drawDetails(ctx)` — a "protected-by-convention" hook subclasses override.
- Base implementation of `_drawDetails(ctx)` throws `Error('_drawDetails must be implemented')` so missing overrides fail loudly at runtime. JS private methods (`#`) can't be overridden by subclasses, so underscore convention is used instead.

**Three subclasses — each only implements `#drawDetails(ctx)`:**

| Class | Details drawn |
|---|---|
| `CarVehicle extends Vehicle` | Windshield, rear window, roof strip |
| `MotoVehicle extends Vehicle` | Seat stripe, handlebar, headlight |
| `BusVehicle extends Vehicle` | Front windshield, side window strips, rear bumper |

`consts.js` loads before `vehicles.js` in script order, so class references can't live in `consts.js`. Instead, the bottom of `vehicles.js` defines:
```js
const VEHICLE_CLASS_MAP = {
    car:  CarVehicle,
    moto: MotoVehicle,
    bus:  BusVehicle,
}
```

`Simulation#generateCars()` uses `VEHICLE_CLASS_MAP[id]` to instantiate the right subclass. No `if/else` on model anywhere.

### Invariants preserved
- Network shape `[sensor.rayCount, 6, 4]` stays identical across all models — brains remain cross-compatible.
- Traffic cars always instantiate `CarVehicle`.
- Performance contract (batch ghost rendering, off-screen culling) is unchanged — `Simulation` owns that logic, not `Vehicle`.

---

## 2. Simulation Class

### Problem
`index.js` is a ~465-line God module: global state, render loop, generation lifecycle, persistence, UI toasts, stats, obstacle spawning — all flat globals and free functions.

### Solution: `simulation.js` + slim `index.js`

**`simulation.js`** — class `Simulation` encapsulates all runtime state as private fields:

```
Private state:
  #cars, #traffic, #mainCar, #bestBrain
  #generationCount, #generationStartTime
  #pause, #pauseStartTime, #animating, #generationResetting
  #currentModel, #canvas, #networkCanvas, #street

Public API (called from HTML buttons / index.js):
  start()           — initializes intervals + requestAnimationFrame
  save()            — persist best brain
  discard()         — clear brain, restart generation
  setModel(id)      — switch vehicle model
  addObstacle()     — spawn random hazard

Private methods:
  #animate(time)
  #generateCars(n)
  #updateBestCar()
  #triggerGenerationReset()
  #resetGeneration()
  #applyBrainToFleet(brain)   ← DRY consolidation (see §3)
  #showGenerationOverlay(died, next)
  #hideGenerationOverlay()
  #removeOldTraffic()
  #showToast(message)
  #syncModelUI()
  #startTrafficInterval()
  #startCleanupInterval()
  #startStatsInterval()
  #handlePause(event)         ← registered once in start()
```

**`index.js`** — bootstrap only (~10 lines):
```js
const sim = new Simulation(
    document.getElementById('main-plane'),
    document.getElementById('network')
)
sim.start()
```

**`index.html`** button `onclick` attributes update to `sim.save()`, `sim.discard()`, `sim.setModel(id)`, `sim.addObstacle()`.

---

## 3. Naming & DRY

### CAR_TYPE enum (`consts.js`)

Replace all magic strings with a constant object:

```js
const CAR_TYPE = {
    MAIN:    'main',     // was 'mainCar'
    GHOST:   'ghost',    // was 'generations'
    TRAFFIC: 'traffic',  // was 'dummy'
}
```

Every `type === 'dummy'` / `type === 'mainCar'` / `type === 'generations'` across all files becomes `=== CAR_TYPE.TRAFFIC` / `=== CAR_TYPE.MAIN` / `=== CAR_TYPE.GHOST`.

### Typo fix

`this.brainConected` → `this.brainConnected` in `Vehicle`.

### Class rename

`Sensors` → `RaySensor`. File `sensors.js` → `ray-sensor.js`.

### `#applyBrainToFleet(brain)` — DRY extraction

This block currently appears 3 times (initial load, `resetGeneration`, `setModel`):
```js
for (let i = 0; i < cars.length; i++) {
    cars[i].brain = JSON.parse(JSON.stringify(brain))
    if (i !== 0) NeuralNetwork.mutate(cars[i].brain, 0.1)
}
bestBrain = JSON.parse(JSON.stringify(brain))
```

Extracted as `Simulation#applyBrainToFleet(brain)`. All three call sites replaced with one call.

---

## 4. File Map

| Old | New | Change |
|---|---|---|
| `car.js` | `vehicles.js` | Vehicle base + CarVehicle, MotoVehicle, BusVehicle |
| `sensors.js` | `ray-sensor.js` | Rename class to RaySensor |
| `index.js` | `simulation.js` + `index.js` | Simulation class + bootstrap |
| `consts.js` | `consts.js` | Add CAR_TYPE, add `class` field to VEHICLE_MODELS |
| `obstacle.js` | `obstacle.js` | No change |
| `street.js` | `street.js` | No change |
| `controls.js` | `controls.js` | No change |
| `neural-network.js` | `neural-network.js` | No change |
| `network-visualizer.js` | `network-visualizer.js` | No change |
| `utils.js` | `utils.js` | No change |
| `index.html` | `index.html` | Update script tags + button onclick attrs |

---

## 5. What Does NOT Change

- No build system, no modules, no TypeScript — plain ES6 classes loaded via `<script>` tags.
- Road geometry, canvas dimensions, network shape `[10, 6, 4]` — untouched.
- All performance contracts from the design system memory (batch ghost render, culling, single-pass best car detection).
- localStorage keys and payload format — no migration needed.
- Visual output — pixel-identical before and after.
- `Obstacle` duck-type contract — still works as a traffic array member.

---

## 6. Success Criteria

- [ ] All three vehicle models render correctly.
- [ ] Switching models, saving, and discarding brains work.
- [ ] Obstacles spawn and collide correctly.
- [ ] ESC pause/resume works without loop duplication.
- [ ] Generation lifecycle (reset, overlay, auto-save) works.
- [ ] No `type === 'dummy'` or `type === 'mainCar'` strings anywhere in source.
- [ ] No `brainConected` typo anywhere in source.
- [ ] `Car` class does not exist anywhere in source.
