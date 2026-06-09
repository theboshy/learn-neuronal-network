# OOP Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the codebase to apply OOP, SOLID, and DRY without changing runtime behavior — vehicle hierarchy via inheritance, simulation state encapsulated in a `Simulation` class, magic strings replaced with `CAR_TYPE` enum, typo fixed, `Sensors` renamed to `RaySensor`.

**Architecture:** `Vehicle` is an abstract base class (physics, brain, sensors, collision); three subclasses (`CarVehicle`, `MotoVehicle`, `BusVehicle`) each implement `_drawDetails` and `_drawWheels`. `Simulation` owns all global state and exposes a small public API that `index.html` buttons call via `sim.method()`.

**Tech Stack:** Plain ES6 classes, no build tools, no modules — loaded via `<script>` tags in `index.html`.

**Spec:** `docs/superpowers/specs/2026-06-08-oop-refactor-design.md`

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `consts.js` | Add `CAR_TYPE` enum |
| Create | `ray-sensor.js` | `RaySensor` class (renamed from `Sensors`) |
| Create | `vehicles.js` | `Vehicle` base + `CarVehicle`, `MotoVehicle`, `BusVehicle` + `VEHICLE_CLASS_MAP` |
| Create | `simulation.js` | `Simulation` class (all runtime state + game loop) |
| Modify | `index.js` | Bootstrap only (~3 lines) |
| Modify | `controls.js` | Use `CAR_TYPE.TRAFFIC` instead of magic string `'dummy'` |
| Modify | `index.html` | Update script tags + all `onclick` attrs |
| Delete | `car.js` | Replaced by `vehicles.js` |
| Delete | `sensors.js` | Replaced by `ray-sensor.js` |

---

## Task 1: Add CAR_TYPE enum to consts.js

**Files:**
- Modify: `consts.js`

- [ ] **Step 1: Add the enum**

Open `consts.js` and add the following block after the existing constants (after `SELECTED_MODEL_KEY`):

```js
const CAR_TYPE = {
    MAIN:    'main',
    GHOST:   'ghost',
    TRAFFIC: 'traffic',
}
```

Full file after edit:
```js
const DELTA_TIME = 60
const INFINITY = 10000000

const VEHICLE_MODELS = {
    car: {
        id: 'car',
        label: 'Car',
        icon: '🚗',
        width: 30,
        height: 50,
        maxSpeed: 2,
        storageKey: 'best-brain-car'
    },
    moto: {
        id: 'moto',
        label: 'Moto',
        icon: '🏍️',
        width: 16,
        height: 38,
        maxSpeed: 3.6,
        storageKey: 'best-brain-moto'
    },
    bus: {
        id: 'bus',
        label: 'Bus',
        icon: '🚌',
        width: 38,
        height: 95,
        maxSpeed: 2.4,
        storageKey: 'best-brain-bus'
    }
}

const SELECTED_MODEL_KEY = 'selected-model'

const CAR_TYPE = {
    MAIN:    'main',
    GHOST:   'ghost',
    TRAFFIC: 'traffic',
}
```

- [ ] **Step 2: Verify — open browser, check console**

Open `index.html` in a browser. The simulation should load and run exactly as before. Check the browser DevTools console — no errors. `CAR_TYPE` is additive; nothing uses it yet.

- [ ] **Step 3: Commit**

```bash
git add consts.js
git commit -m "refactor: add CAR_TYPE enum to consts.js"
```

---

## Task 2: Create ray-sensor.js

**Files:**
- Create: `ray-sensor.js`
- Modify: `index.html` (add script tag — keep `sensors.js` for now)

- [ ] **Step 1: Create ray-sensor.js**

Create `/home/nised/projects/learn-neuronal-network/ray-sensor.js` with this content — it is `sensors.js` with `Sensors` renamed to `RaySensor` everywhere:

```js
class RaySensor {
    constructor(car) {
        this.car = car
        this.rayCount = 10
        this.rayLength = 250
        this.raySpread = Math.PI / 2

        this.rays = []
        this.readings = []
    }

    #castRays() {
        this.rays = []
        for (let i = 0; i < this.rayCount; i++) {
            const rayAngle = lerp(
                this.raySpread / 2,
                -this.raySpread / 2,
                this.rayCount === 1 ? 0.5 : i / (this.rayCount - 1)
            ) + this.car.rotationAngle

            const start = { x: this.car.x, y: this.car.y }
            const end = {
                x: this.car.x - Math.sin(rayAngle) * this.rayLength,
                y: this.car.y - Math.cos(rayAngle) * this.rayLength
            }
            this.rays.push([start, end])
        }
    }

    #getReading(ray, roadBorders, traffic) {
        let touches = []

        for (let i = 0; i < roadBorders.length; i++) {
            const touch = getIntersection(ray[0], ray[1], roadBorders[i][0], roadBorders[i][1])
            if (touch) touches.push(touch)
        }

        for (let i = 0; i < traffic.length; i++) {
            const polygon = traffic[i].polygon
            for (let j = 0; j < polygon.length; j++) {
                const touch = getIntersection(
                    ray[0], ray[1],
                    polygon[j], polygon[(j + 1) % polygon.length]
                )
                if (touch) touches.push(touch)
            }
        }

        if (touches.length === 0) return null
        const offsets = touches.map(e => e.offset)
        const minOffset = Math.min(...offsets)
        return touches.find(e => e.offset === minOffset)
    }

    update(streetBorders, traffic) {
        this.#castRays()
        this.readings = []
        for (let i = 0; i < this.rays.length; i++) {
            this.readings.push(this.#getReading(this.rays[i], streetBorders, traffic))
        }
    }

    draw(context) {
        if (!this.rays || this.rays.length === 0) return

        for (let i = 0; i < this.rayCount; i++) {
            const reading = this.readings[i]
            const end = reading ? reading : this.rays[i][1]

            context.beginPath()
            context.lineWidth   = 1.5
            context.strokeStyle = 'rgba(255, 240, 70, 0.85)'
            context.moveTo(this.rays[i][0].x, this.rays[i][0].y)
            context.lineTo(end.x, end.y)
            context.stroke()

            if (reading) {
                context.beginPath()
                context.fillStyle = 'rgba(247, 129, 102, 0.95)'
                context.arc(end.x, end.y, 2.5, 0, Math.PI * 2)
                context.fill()
            }
        }
    }
}
```

- [ ] **Step 2: Add ray-sensor.js to index.html (keep sensors.js)**

In `index.html`, add `ray-sensor.js` right after `sensors.js`. Do NOT remove `sensors.js` yet — `car.js` still depends on `Sensors`:

```html
<script src="./utils.js" charset="utf-8"></script>
<script src="./controls.js" charset="utf-8"></script>
<script src="./sensors.js" charset="utf-8"></script>
<script src="./ray-sensor.js" charset="utf-8"></script>
<script src="./street.js" charset="utf-8"></script>
<script src="./consts.js" charset="utf-8"></script>
<script src="./car.js" charset="utf-8"></script>
<script src="./obstacle.js" charset="utf-8"></script>
<script src="./neural-network.js" charset="utf-8"></script>
<script src="./network-visualizer.js" charset="utf-8"></script>
<script src="./index.js" charset="utf-8"></script>
```

- [ ] **Step 3: Verify**

Open `index.html` in browser. Console must be error-free. `RaySensor` is defined but unused — that's fine.

- [ ] **Step 4: Commit**

```bash
git add ray-sensor.js index.html
git commit -m "refactor: add RaySensor class (renamed from Sensors)"
```

---

## Task 3: Create vehicles.js

**Files:**
- Create: `vehicles.js`
- Modify: `index.html` (add script tag after consts.js — keep car.js)

- [ ] **Step 1: Create vehicles.js**

Create `/home/nised/projects/learn-neuronal-network/vehicles.js` with this content:

```js
// ─── Abstract base ────────────────────────────────────────────────────────────

class Vehicle {
    constructor(x, y, width, height, type = CAR_TYPE.TRAFFIC, maxSpeed = 3, color = 'green', drawSensor = false, model = 'car') {
        this.x = x
        this.y = y
        this.color = color
        this.width = width
        this.height = height
        this.model = model
        this.speed = 0
        this.acceleration = 0.2
        this.maxSpeed = maxSpeed
        this.friction = 0.4 / DELTA_TIME
        this.rotationAngle = 0
        this.polygon = []
        this.type = type
        this.drawSensor = drawSensor
        this.damaged = false
        this.controls = new Controls(this.type)
        this.sensor = new RaySensor(this)
        this.brainConnected = this.type !== CAR_TYPE.TRAFFIC
        this.brain = new NeuralNetwork([this.sensor.rayCount, 6, 4])

        this.targetLane = null
        this.turnSignal = null
        this.nextLaneCheckTime = (type === CAR_TYPE.TRAFFIC && color !== 'red')
            ? Date.now() + getRandomNumberBetween(400, 2000)
            : Infinity
    }

    // ── Abstract hooks — subclasses must override both ───────────────────────

    _drawDetails(ctx) {
        throw new Error(`${this.constructor.name} must implement _drawDetails(ctx)`)
    }

    _drawWheels(ctx, w, h) {
        throw new Error(`${this.constructor.name} must implement _drawWheels(ctx, w, h)`)
    }

    // ── Private physics ───────────────────────────────────────────────────────

    #assessDamage(borders, traffic) {
        for (let i = 0; i < borders.length; i++) {
            if (polygonsIntersect(this.polygon, borders[i])) return true
        }
        for (let i = 0; i < traffic.length; i++) {
            if (polygonsIntersect(this.polygon, traffic[i].polygon)) return true
        }
        return false
    }

    #createPolygon() {
        const rad   = Math.hypot(this.width, this.height) / 2
        const alpha = Math.atan2(this.width, this.height)
        return [
            { x: this.x - Math.sin(this.rotationAngle - alpha) * rad,          y: this.y - Math.cos(this.rotationAngle - alpha) * rad },
            { x: this.x - Math.sin(this.rotationAngle + alpha) * rad,          y: this.y - Math.cos(this.rotationAngle + alpha) * rad },
            { x: this.x - Math.sin(Math.PI + this.rotationAngle - alpha) * rad, y: this.y - Math.cos(Math.PI + this.rotationAngle - alpha) * rad },
            { x: this.x - Math.sin(Math.PI + this.rotationAngle + alpha) * rad, y: this.y - Math.cos(Math.PI + this.rotationAngle + alpha) * rad },
        ]
    }

    #directionControl() {
        if (!this.controls) return
        if (this.controls.forward) this.speed += this.acceleration
        if (this.controls.reverse) this.speed -= this.acceleration
        if (this.speed !== 0) {
            const flip = this.speed > 0 ? 1 : -1
            if (this.controls.left)  this.rotationAngle += 0.03 * flip
            if (this.controls.right) this.rotationAngle -= 0.03 * flip
        }
    }

    #speedControl() {
        if (this.speed >  this.maxSpeed)       this.speed =  this.maxSpeed
        if (this.speed < -this.maxSpeed / 2)   this.speed = -this.maxSpeed / 2
        if (this.speed > 0) this.speed -= this.friction * this.speed
        if (this.speed < 0) this.speed += this.friction * Math.abs(this.speed)
        if (Math.abs(this.speed) < this.friction) this.speed = 0
    }

    #move() {
        this.x -= Math.sin(this.rotationAngle) * this.speed
        this.y -= Math.cos(this.rotationAngle) * this.speed
    }

    #maybeChangeLane() {
        if (this.type !== CAR_TYPE.TRAFFIC) return
        if (this.brainConnected) return
        if (this.color === 'red') return
        if (this.targetLane !== null) return
        if (Date.now() < this.nextLaneCheckTime) return
        if (typeof street === 'undefined') return

        this.nextLaneCheckTime = Date.now() + getRandomNumberBetween(2500, 6000)
        if (Math.random() > 0.5) return

        const currentLane = street.getLaneFromX(this.x)
        const dir    = Math.random() > 0.5 ? 1 : -1
        const target = currentLane + dir
        if (target < 0 || target >= street.laneCount) return

        this.targetLane = target
        this.turnSignal = dir < 0 ? 'left' : 'right'
    }

    #steerToTarget() {
        if (this.targetLane === null) return
        if (typeof street === 'undefined') return

        const targetX = street.getLaneCenter(this.targetLane)
        const dx = targetX - this.x

        if (Math.abs(dx) < 1.5 && Math.abs(this.rotationAngle) < 0.03) {
            this.targetLane  = null
            this.turnSignal  = null
            this.controls.left  = false
            this.controls.right = false
            this.rotationAngle  = 0
            return
        }

        const maxAngle   = 0.32
        const desired    = Math.max(-maxAngle, Math.min(maxAngle, -Math.atan(dx * 0.04)))
        const angleError = desired - this.rotationAngle

        if (angleError > 0.01) {
            this.controls.left  = true
            this.controls.right = false
        } else if (angleError < -0.01) {
            this.controls.right = true
            this.controls.left  = false
        } else {
            this.controls.left  = false
            this.controls.right = false
        }
    }

    // ── Public interface ──────────────────────────────────────────────────────

    update(streetBorders, traffic) {
        if (!this.damaged) {
            this.#maybeChangeLane()
            this.#steerToTarget()
            this.#directionControl()
            this.#speedControl()
            this.#move()
            this.polygon = this.#createPolygon()
            this.damaged = this.#assessDamage(streetBorders, traffic)
        }
        if (this.sensor) {
            this.sensor.update(streetBorders, traffic)
            if (this.sensor.readings.length > 0) {
                const offsets = this.sensor.readings.map(s => s == null ? 0 : 1 - s.offset)
                const outputs = NeuralNetwork.feedForward(offsets, this.brain)
                if (this.brainConnected) {
                    this.controls.forward = outputs[0]
                    this.controls.left    = outputs[1]
                    this.controls.right   = outputs[2]
                    this.controls.reverse = outputs[3]
                }
            }
        }
    }

    draw(ctx) {
        ctx.save()
        ctx.translate(this.x, this.y)
        ctx.rotate(-this.rotationAngle)

        const w = this.width
        const h = this.height

        if (this.type === CAR_TYPE.MAIN && !this.damaged) {
            ctx.shadowBlur  = 20
            ctx.shadowColor = '#58a6ff'
        }

        let bodyColor
        if (this.damaged) {
            bodyColor = '#f78166'
        } else if (this.type === CAR_TYPE.MAIN) {
            bodyColor = '#58a6ff'
        } else if (this.type === CAR_TYPE.TRAFFIC) {
            bodyColor = this.color === 'red' ? '#f78166' : '#d29922'
        } else {
            bodyColor = '#3fb950'
        }

        ctx.fillStyle = bodyColor
        ctx.beginPath()
        ctx.roundRect(-w / 2, -h / 2, w, h, 4)
        ctx.fill()
        ctx.shadowBlur = 0

        if (this.damaged) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)'
            ctx.lineWidth   = 2.5
            ctx.beginPath()
            ctx.moveTo(-w / 3.5, -h / 3.5)
            ctx.lineTo( w / 3.5,  h / 3.5)
            ctx.moveTo( w / 3.5, -h / 3.5)
            ctx.lineTo(-w / 3.5,  h / 3.5)
            ctx.stroke()
        } else {
            this._drawDetails(ctx)
        }

        ctx.fillStyle = '#0a0d10'
        ctx.beginPath()
        this._drawWheels(ctx, w, h)
        ctx.fill()

        if (this.turnSignal && !this.damaged) {
            const blinkOn = (Math.floor(Date.now() / 280) % 2) === 0
            if (blinkOn) {
                const sx = this.turnSignal === 'left' ? -w / 2 - 1 : w / 2 + 1
                ctx.shadowBlur  = 10
                ctx.shadowColor = '#ffb547'
                ctx.fillStyle   = '#ffb547'
                ctx.beginPath()
                ctx.arc(sx, -h / 2 + 7, 2, 0, Math.PI * 2)
                ctx.fill()
                ctx.shadowBlur = 0
            }
        }

        ctx.restore()

        if (this.sensor && this.sensor.car.drawSensor) {
            this.sensor.draw(ctx)
        }
    }
}

// ─── Subclasses ───────────────────────────────────────────────────────────────

class CarVehicle extends Vehicle {
    constructor(x, y, type, maxSpeed, color, drawSensor) {
        super(x, y, 30, 50, type, maxSpeed, color, drawSensor, 'car')
    }

    _drawDetails(ctx) {
        const w = this.width, h = this.height
        ctx.fillStyle = 'rgba(0, 0, 0, 0.48)'
        ctx.beginPath()
        ctx.roundRect(-w / 2 + 3, -h / 2 + 5, w - 6, h * 0.27, 2)
        ctx.fill()

        ctx.fillStyle = 'rgba(0, 0, 0, 0.36)'
        ctx.beginPath()
        ctx.roundRect(-w / 2 + 3, h / 2 - h * 0.22, w - 6, h * 0.17, 2)
        ctx.fill()

        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)'
        ctx.beginPath()
        ctx.roundRect(-w / 2 + 4, -h / 2 + h * 0.27 + 7, w - 8, h * 0.34, 1)
        ctx.fill()
    }

    _drawWheels(ctx, w, h) {
        const ww = 5, wh = 9
        ctx.roundRect(-w / 2 - ww + 1, -h / 2 + 5,       ww, wh, 1)
        ctx.roundRect( w / 2 - 1,       -h / 2 + 5,       ww, wh, 1)
        ctx.roundRect(-w / 2 - ww + 1,   h / 2 - 5 - wh,  ww, wh, 1)
        ctx.roundRect( w / 2 - 1,         h / 2 - 5 - wh,  ww, wh, 1)
    }
}

class MotoVehicle extends Vehicle {
    constructor(x, y, type, maxSpeed, color, drawSensor) {
        super(x, y, 16, 38, type, maxSpeed, color, drawSensor, 'moto')
    }

    _drawDetails(ctx) {
        const w = this.width, h = this.height
        ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
        ctx.beginPath()
        ctx.roundRect(-w / 2 + 2, -h * 0.18, w - 4, h * 0.45, 2)
        ctx.fill()

        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)'
        ctx.beginPath()
        ctx.roundRect(-w / 2 - 1.5, -h / 2 + 4, w + 3, 2, 1)
        ctx.fill()

        ctx.fillStyle = 'rgba(255, 240, 180, 0.4)'
        ctx.beginPath()
        ctx.arc(0, -h / 2 + 2, 1.5, 0, Math.PI * 2)
        ctx.fill()
    }

    _drawWheels(ctx, w, h) {
        const ww = 4, wh = 7
        ctx.roundRect(-ww / 2, -h / 2 + 1,      ww, wh, 1.5)
        ctx.roundRect(-ww / 2,  h / 2 - 1 - wh, ww, wh, 1.5)
    }
}

class BusVehicle extends Vehicle {
    constructor(x, y, type, maxSpeed, color, drawSensor) {
        super(x, y, 38, 95, type, maxSpeed, color, drawSensor, 'bus')
    }

    _drawDetails(ctx) {
        const w = this.width, h = this.height
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
        ctx.beginPath()
        ctx.roundRect(-w / 2 + 3, -h / 2 + 5, w - 6, h * 0.10, 2)
        ctx.fill()

        const windowCount = 5
        const stripTop    = -h / 2 + h * 0.18
        const stripBottom =  h / 2 - h * 0.18
        const stripH = (stripBottom - stripTop) / windowCount
        for (let i = 0; i < windowCount; i++) {
            const y = stripTop + i * stripH + 1
            ctx.fillStyle = 'rgba(0, 0, 0, 0.42)'
            ctx.beginPath()
            ctx.roundRect(-w / 2 + 2, y, 4, stripH - 2, 1)
            ctx.roundRect( w / 2 - 6, y, 4, stripH - 2, 1)
            ctx.fill()
        }

        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'
        ctx.beginPath()
        ctx.roundRect(-w / 2 + 4, h / 2 - 6, w - 8, 3, 1)
        ctx.fill()
    }

    _drawWheels(ctx, w, h) {
        const ww = 5, wh = 11
        ctx.roundRect(-w / 2 - ww + 1, -h / 2 + 8,  ww, wh, 1)
        ctx.roundRect( w / 2 - 1,       -h / 2 + 8,  ww, wh, 1)
        ctx.roundRect(-w / 2 - ww + 1,  h / 2 - 26, ww, wh, 1)
        ctx.roundRect( w / 2 - 1,        h / 2 - 26, ww, wh, 1)
        ctx.roundRect(-w / 2 - ww + 1,  h / 2 - 11, ww, wh, 1)
        ctx.roundRect( w / 2 - 1,        h / 2 - 11, ww, wh, 1)
    }
}

// ─── Class map (used by Simulation#generateCars) ──────────────────────────────

const VEHICLE_CLASS_MAP = {
    car:  CarVehicle,
    moto: MotoVehicle,
    bus:  BusVehicle,
}
```

- [ ] **Step 2: Add vehicles.js to index.html (keep car.js)**

In `index.html`, add `vehicles.js` right after `car.js`. Both are loaded for now — no conflict since names differ (`Car` vs `Vehicle`/`CarVehicle`):

```html
<script src="./utils.js" charset="utf-8"></script>
<script src="./controls.js" charset="utf-8"></script>
<script src="./sensors.js" charset="utf-8"></script>
<script src="./ray-sensor.js" charset="utf-8"></script>
<script src="./street.js" charset="utf-8"></script>
<script src="./consts.js" charset="utf-8"></script>
<script src="./car.js" charset="utf-8"></script>
<script src="./vehicles.js" charset="utf-8"></script>
<script src="./obstacle.js" charset="utf-8"></script>
<script src="./neural-network.js" charset="utf-8"></script>
<script src="./network-visualizer.js" charset="utf-8"></script>
<script src="./index.js" charset="utf-8"></script>
```

- [ ] **Step 3: Verify**

Open `index.html` in browser. Console must be error-free. `Vehicle`, `CarVehicle`, `MotoVehicle`, `BusVehicle`, and `VEHICLE_CLASS_MAP` are now defined but unused. The simulation still runs via the old `Car` + `index.js` path.

- [ ] **Step 4: Commit**

```bash
git add vehicles.js index.html
git commit -m "refactor: add Vehicle base class and CarVehicle/MotoVehicle/BusVehicle subclasses"
```

---

## Task 4: Create simulation.js

**Files:**
- Create: `simulation.js`
- Modify: `index.html` (add script tag — keep index.js unchanged)

- [ ] **Step 1: Create simulation.js**

Create `/home/nised/projects/learn-neuronal-network/simulation.js` with this content:

```js
// Vehicle.#maybeChangeLane and #steerToTarget reference `street` as a free variable.
// This module-level declaration makes it available globally (same as the old index.js did).
let street

class Simulation {
    static #CAR_GENERATION_NUMBER = 1000
    static #GRACE_PERIOD_MS = 3000

    #pause = false
    #pauseStartTime = 0
    #animating = false
    #generationCount = 1
    #bestBrain = null
    #generationResetting = false
    #lastKnownY = 0
    #generationStartTime = Date.now()
    #cars = []
    #traffic = []
    #mainCar = null
    #currentModel = 'car'
    #canvas
    #networkCanvas
    #canvasCtx
    #networkCtx
    #street

    constructor(canvas, networkCanvas) {
        this.#canvas = canvas
        this.#networkCanvas = networkCanvas
        this.#canvas.width = 280
        this.#networkCanvas.width = 320
        this.#canvasCtx = canvas.getContext('2d')
        this.#networkCtx = networkCanvas.getContext('2d')
        this.#street = new Street(canvas.width / 2, 180)
        street = this.#street  // expose for Vehicle lane-change methods
        this.#currentModel = localStorage.getItem(SELECTED_MODEL_KEY) || 'car'
        if (!VEHICLE_MODELS[this.#currentModel]) this.#currentModel = 'car'
    }

    // ── Public API ────────────────────────────────────────────────────────────

    start() {
        Simulation.#migrateLegacyBrainKey()
        this.#cars   = this.#generateCars(Simulation.#CAR_GENERATION_NUMBER)
        this.#traffic = []

        const savedPayload = this.#loadSavedBrain()
        if (savedPayload) {
            this.#applyBrainToFleet(savedPayload.brain)
            this.#generationCount = savedPayload.generation || 1
            document.getElementById('generation-count').textContent = this.#generationCount
        }

        this.#syncModelUI()
        this.#generationStartTime = Date.now()
        this.#startTrafficInterval()
        this.#startCleanupInterval()
        this.#startStatsInterval()
        document.addEventListener('keydown', (e) => this.#handlePause(e))
        requestAnimationFrame((t) => this.#animate(t))
    }

    save() {
        const brain = this.#mainCar ? this.#mainCar.brain : this.#bestBrain
        const m = VEHICLE_MODELS[this.#currentModel]
        if (brain) {
            this.#persistBrain(brain, this.#generationCount)
            this.#bestBrain = JSON.parse(JSON.stringify(brain))
            this.#showToast(`✅ ${m.label} brain saved · Gen ${this.#generationCount}`)
        } else {
            this.#showToast('⚠️ No brain to save yet')
        }
    }

    discard() {
        const m = VEHICLE_MODELS[this.#currentModel]
        const confirmed = window.confirm(
            `Clear the ${m.label} brain? Training will restart from scratch with random brains for this vehicle.`
        )
        if (!confirmed) return

        localStorage.removeItem(m.storageKey)
        this.#bestBrain = null
        this.#generationCount = 1
        document.getElementById('generation-count').textContent = 1

        this.#generationResetting = true
        this.#traffic = []
        this.#cars = this.#generateCars(Simulation.#CAR_GENERATION_NUMBER)
        this.#generationStartTime = Date.now()
        this.#generationResetting = false

        this.#showToast(`❌ ${m.label} brain cleared`)
    }

    setModel(modelId) {
        if (!VEHICLE_MODELS[modelId]) return
        if (modelId === this.#currentModel) return
        if (this.#generationResetting) return

        this.#currentModel = modelId
        localStorage.setItem(SELECTED_MODEL_KEY, modelId)
        const m = VEHICLE_MODELS[modelId]

        this.#generationResetting = true
        this.#traffic = []
        this.#cars = this.#generateCars(Simulation.#CAR_GENERATION_NUMBER)
        this.#generationStartTime = Date.now()

        const saved = this.#loadSavedBrain()
        if (saved) {
            this.#applyBrainToFleet(saved.brain)
            this.#generationCount = saved.generation || 1
        } else {
            this.#bestBrain = null
            this.#generationCount = 1
        }

        document.getElementById('generation-count').textContent = this.#generationCount
        this.#syncModelUI()
        this.#generationResetting = false
        this.#showToast(`${m.icon} ${m.label} · Gen ${this.#generationCount}`)
    }

    addObstacle() {
        if (!this.#mainCar) return
        const lane = getRandomNumberBetween(0, this.#street.laneCount - 1)
        const x    = this.#street.getLaneCenter(lane)
        const y    = this.#mainCar.y - getRandomNumberBetween(400, 700)
        this.#traffic.push(Obstacle.createRandom(x, y))
    }

    // ── Private: generation lifecycle ─────────────────────────────────────────

    #generateCars(n) {
        const m = VEHICLE_MODELS[this.#currentModel]
        const VehicleClass = VEHICLE_CLASS_MAP[m.id]
        const newMain = new VehicleClass(
            this.#street.getLaneCenter(1), -20,
            CAR_TYPE.MAIN, m.maxSpeed, 'green', true
        )
        this.#mainCar = newMain
        const arr = [newMain]
        for (let i = 1; i <= n; i++) {
            arr.push(new VehicleClass(
                this.#street.getLaneCenter(1), -20,
                CAR_TYPE.GHOST, m.maxSpeed, 'green', false
            ))
        }
        return arr
    }

    #applyBrainToFleet(brain) {
        for (let i = 0; i < this.#cars.length; i++) {
            this.#cars[i].brain = JSON.parse(JSON.stringify(brain))
            if (i !== 0) NeuralNetwork.mutate(this.#cars[i].brain, 0.1)
        }
        this.#bestBrain = JSON.parse(JSON.stringify(brain))
    }

    #updateBestCar() {
        if (!this.#cars || this.#cars.length === 0) return

        let bestY = Infinity
        let candidate = null
        for (let i = 0; i < this.#cars.length; i++) {
            if (this.#cars[i].y < bestY) {
                bestY = this.#cars[i].y
                candidate = this.#cars[i]
            }
        }

        if (candidate && candidate !== this.#mainCar) {
            if (this.#mainCar) {
                this.#mainCar.type = CAR_TYPE.TRAFFIC
                this.#mainCar.drawSensor = false
                this.#mainCar.color = 'green'
                this.#mainCar.targetLane = null
                this.#mainCar.turnSignal = null
                this.#mainCar.nextLaneCheckTime = Infinity
            }
            this.#mainCar = candidate
            this.#mainCar.drawSensor = true
            this.#mainCar.type  = CAR_TYPE.MAIN
            this.#mainCar.color = 'blue'
            if (this.#mainCar.brain) {
                this.#bestBrain = JSON.parse(JSON.stringify(this.#mainCar.brain))
            }
        }
    }

    #triggerGenerationReset() {
        if (this.#generationResetting) return
        this.#generationResetting = true
        this.#generationCount++
        document.getElementById('generation-count').textContent = this.#generationCount
        if (this.#bestBrain) this.#persistBrain(this.#bestBrain, this.#generationCount)
        this.#showGenerationOverlay(this.#generationCount - 1, this.#generationCount)
        setTimeout(() => this.#resetGeneration(), 2500)
    }

    #resetGeneration() {
        this.#traffic = []
        this.#cars = this.#generateCars(Simulation.#CAR_GENERATION_NUMBER)
        this.#generationStartTime = Date.now()
        const payload = this.#loadSavedBrain()
        if (payload) {
            this.#applyBrainToFleet(payload.brain)
        } else {
            this.#bestBrain = null
        }
        this.#hideGenerationOverlay()
        this.#generationResetting = false
    }

    #removeOldTraffic() {
        if (this.#traffic.length > 0 && this.#mainCar) {
            this.#traffic = this.#traffic.filter(
                car => this.#mainCar.y + (this.#mainCar.height * 6) > car.y
            )
        }
    }

    // ── Private: persistence ─────────────────────────────────────────────────

    static #migrateLegacyBrainKey() {
        const legacy = localStorage.getItem('best-brain')
        if (!legacy) return
        if (!localStorage.getItem(VEHICLE_MODELS.car.storageKey)) {
            localStorage.setItem(VEHICLE_MODELS.car.storageKey, legacy)
        }
        localStorage.removeItem('best-brain')
    }

    #loadSavedBrain(modelId = this.#currentModel) {
        const key = VEHICLE_MODELS[modelId].storageKey
        const raw = localStorage.getItem(key)
        if (!raw) return null
        try {
            const parsed = JSON.parse(raw)
            if (Array.isArray(parsed.levels)) return { brain: parsed, generation: 1 }
            return parsed
        } catch {
            return null
        }
    }

    #persistBrain(brain, generation, modelId = this.#currentModel) {
        const key = VEHICLE_MODELS[modelId].storageKey
        localStorage.setItem(key, JSON.stringify({ brain, generation, savedAt: Date.now() }))
    }

    // ── Private: UI ───────────────────────────────────────────────────────────

    #showGenerationOverlay(died, next) {
        const el = document.getElementById('generation-end-overlay')
        el.querySelector('.overlay-content').innerHTML =
            `<p>Generation <strong>${died}</strong> ended</p>` +
            `<p>Brain saved to localStorage</p>` +
            `<p>Starting generation <strong>${next}</strong>...</p>`
        el.style.display = 'flex'
    }

    #hideGenerationOverlay() {
        document.getElementById('generation-end-overlay').style.display = 'none'
    }

    #showToast(message) {
        const toast = document.getElementById('toast')
        toast.textContent = message
        toast.classList.remove('visible')
        void toast.offsetWidth
        toast.classList.add('visible')
        setTimeout(() => toast.classList.remove('visible'), 2000)
    }

    #syncModelUI() {
        const m = VEHICLE_MODELS[this.#currentModel]
        const nameEl = document.getElementById('current-model-name')
        if (nameEl) nameEl.textContent = m.label
        document.querySelectorAll('.model-tab').forEach(t => {
            t.classList.toggle('active', t.dataset.model === this.#currentModel)
        })
    }

    // ── Private: intervals ────────────────────────────────────────────────────

    #startTrafficInterval() {
        setInterval(() => {
            if (!this.#mainCar || this.#generationResetting || this.#pause) return
            this.#traffic.push(new CarVehicle(
                this.#street.getLaneCenter(getRandomNumberBetween(0, this.#street.laneCount)),
                this.#mainCar.y - getRandomNumberBetween(500, 700),
                CAR_TYPE.TRAFFIC, 1, 'purple', false
            ))
        }, 2000)
    }

    #startCleanupInterval() {
        setInterval(() => {
            if (this.#pause) return
            if (Date.now() - this.#generationStartTime < Simulation.#GRACE_PERIOD_MS) return
            if (this.#generationResetting) return
            if (this.#mainCar) {
                this.#cars = this.#cars.filter(c =>
                    c.damaged === false &&
                    c.speed !== 0 &&
                    this.#mainCar.y + (this.#mainCar.height * 6) > c.y
                )
            }
            if (this.#cars.length === 0 && !this.#generationResetting) {
                this.#triggerGenerationReset()
            }
        }, 2000)
    }

    #startStatsInterval() {
        const timerEl    = document.getElementById('gen-timer')
        const progressEl = document.getElementById('survivors-progress')
        setInterval(() => {
            if (this.#pause) return
            const elapsed = Math.floor((Date.now() - this.#generationStartTime) / 1000)
            const minutes = Math.floor(elapsed / 60)
            const seconds = elapsed % 60
            if (timerEl) timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`
            if (progressEl && this.#cars) {
                const pct = Math.max(0, (this.#cars.length / Simulation.#CAR_GENERATION_NUMBER) * 100)
                progressEl.style.width = pct + '%'
                progressEl.style.backgroundColor =
                    pct < 15 ? 'var(--red)' :
                    pct < 45 ? 'var(--amber)' :
                    'var(--green)'
            }
        }, 500)
    }

    #handlePause(event) {
        if (event.key !== 'Escape') return
        event.preventDefault()
        if (!this.#pause) {
            this.#pause = true
            this.#pauseStartTime = Date.now()
        } else {
            this.#pause = false
            this.#generationStartTime += Date.now() - this.#pauseStartTime
            if (!this.#animating) {
                this.#animating = true
                requestAnimationFrame((t) => this.#animate(t))
            }
        }
    }

    // ── Private: render loop ──────────────────────────────────────────────────

    #animate(time) {
        if (this.#pause) {
            this.#animating = false
            return
        }
        this.#animating = true

        this.#canvas.height = window.innerHeight
        this.#networkCanvas.height = window.innerHeight

        const refY = this.#mainCar ? this.#mainCar.y : this.#lastKnownY

        this.#canvasCtx.save()
        this.#canvasCtx.translate(0, -refY + this.#canvas.height * 0.7)

        this.#street.draw(this.#canvasCtx)
        this.#street.drawRoadside(this.#canvasCtx, refY, this.#canvas.height)
        this.#removeOldTraffic()

        for (let i = 0; i < this.#traffic.length; i++) {
            this.#traffic[i].update(this.#street.borders, [])
            this.#traffic[i].draw(this.#canvasCtx)
        }

        const cullTop    = refY - this.#canvas.height * 0.85
        const cullBottom = refY + this.#canvas.height * 0.45
        const liveGhosts    = []
        const damagedGhosts = []

        for (let i = 0; i < this.#cars.length; i++) {
            const car = this.#cars[i]
            car.update(this.#street.borders, this.#traffic)
            if (car === this.#mainCar) continue
            if (car.y < cullTop || car.y > cullBottom) continue
            if (car.polygon.length < 4) continue
            if (car.damaged) damagedGhosts.push(car.polygon)
            else             liveGhosts.push(car.polygon)
        }

        if (liveGhosts.length > 0) {
            this.#canvasCtx.globalAlpha = 0.20
            this.#canvasCtx.fillStyle   = '#3fb950'
            this.#canvasCtx.beginPath()
            for (let i = 0; i < liveGhosts.length; i++) {
                const p = liveGhosts[i]
                this.#canvasCtx.moveTo(p[0].x, p[0].y)
                this.#canvasCtx.lineTo(p[1].x, p[1].y)
                this.#canvasCtx.lineTo(p[2].x, p[2].y)
                this.#canvasCtx.lineTo(p[3].x, p[3].y)
                this.#canvasCtx.closePath()
            }
            this.#canvasCtx.fill()
        }

        if (damagedGhosts.length > 0) {
            this.#canvasCtx.globalAlpha = 0.28
            this.#canvasCtx.fillStyle   = '#f78166'
            this.#canvasCtx.beginPath()
            for (let i = 0; i < damagedGhosts.length; i++) {
                const p = damagedGhosts[i]
                this.#canvasCtx.moveTo(p[0].x, p[0].y)
                this.#canvasCtx.lineTo(p[1].x, p[1].y)
                this.#canvasCtx.lineTo(p[2].x, p[2].y)
                this.#canvasCtx.lineTo(p[3].x, p[3].y)
                this.#canvasCtx.closePath()
            }
            this.#canvasCtx.fill()
        }

        this.#canvasCtx.globalAlpha = 1
        if (this.#mainCar) {
            this.#mainCar.draw(this.#canvasCtx)
            this.#lastKnownY = this.#mainCar.y
            this.#updateBestCar()
        }

        this.#canvasCtx.restore()

        this.#networkCtx.lineDashOffset = -time / 50
        Visualizer.drawNetwork(
            this.#networkCtx,
            this.#mainCar ? this.#mainCar.brain : this.#bestBrain
        )

        document.getElementById('live-generations').innerHTML = this.#cars.length
        requestAnimationFrame((t) => this.#animate(t))
    }
}
```

- [ ] **Step 2: Add simulation.js to index.html (after network-visualizer.js, before index.js)**

```html
<script src="./utils.js" charset="utf-8"></script>
<script src="./controls.js" charset="utf-8"></script>
<script src="./sensors.js" charset="utf-8"></script>
<script src="./ray-sensor.js" charset="utf-8"></script>
<script src="./street.js" charset="utf-8"></script>
<script src="./consts.js" charset="utf-8"></script>
<script src="./car.js" charset="utf-8"></script>
<script src="./vehicles.js" charset="utf-8"></script>
<script src="./obstacle.js" charset="utf-8"></script>
<script src="./neural-network.js" charset="utf-8"></script>
<script src="./network-visualizer.js" charset="utf-8"></script>
<script src="./simulation.js" charset="utf-8"></script>
<script src="./index.js" charset="utf-8"></script>
```

- [ ] **Step 3: Verify**

Open `index.html` in browser. Console must be error-free. `Simulation` is now defined but `sim` is not instantiated yet — the old `index.js` still drives the simulation.

- [ ] **Step 4: Commit**

```bash
git add simulation.js index.html
git commit -m "refactor: add Simulation class"
```

---

## Task 5: Wire everything together — bootstrap index.js + final index.html

This is the switchover task. The old `Car` + global `index.js` is replaced by `Simulation`. **Test carefully after this step.**

**Files:**
- Modify: `index.js` (replace with bootstrap)
- Modify: `controls.js` (use `CAR_TYPE.TRAFFIC`)
- Modify: `index.html` (final script order + button onclicks)

- [ ] **Step 1: Update controls.js to use CAR_TYPE**

Replace the entire content of `controls.js`:

```js
class Controls {
    constructor(type) {
        this.forward = false
        this.left    = false
        this.right   = false
        this.reverse = false

        if (type === CAR_TYPE.TRAFFIC) {
            this.forward = true
        }
    }
}
```

- [ ] **Step 2: Replace index.js with bootstrap**

Replace the entire content of `index.js`:

```js
const sim = new Simulation(
    document.getElementById('main-plane'),
    document.getElementById('network')
)
sim.start()
```

- [ ] **Step 3: Replace index.html with final version**

Replace the entire content of `index.html`:

```html
<!DOCTYPE html>
<html lang="en" dir="ltr">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Neural Self-Driving</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="style.css">
  </head>
  <body>
    <canvas id="main-plane"></canvas>
    <canvas id="network"></canvas>

    <div id="panel">
      <div class="panel-header">
        <span class="panel-logo">◈ NEURAL AI</span>
        <span class="panel-version">self-driving simulation</span>
      </div>

      <div class="panel-section">
        <div class="section-title">Vehicle</div>
        <div class="model-tabs">
          <button class="model-tab" data-model="car"  onclick="sim.setModel('car')">🚗</button>
          <button class="model-tab" data-model="moto" onclick="sim.setModel('moto')">🏍️</button>
          <button class="model-tab" data-model="bus"  onclick="sim.setModel('bus')">🚌</button>
        </div>
        <div class="stat-row" style="margin-top:4px">
          <span class="stat-label">USING</span>
          <span class="stat-value" id="current-model-name" style="font-size:11px">Car</span>
        </div>
      </div>

      <div class="panel-section">
        <div class="section-title">Simulation</div>
        <div class="stat-row">
          <span class="stat-label">GENERATION</span>
          <span class="stat-value" id="generation-count">1</span>
        </div>
        <div class="stat-row">
          <span class="stat-label">ALIVE</span>
          <span class="stat-value" id="live-generations">0</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" id="survivors-progress"></div>
        </div>
        <div class="stat-row">
          <span class="stat-label">TIME</span>
          <span class="stat-value" id="gen-timer">0:00</span>
        </div>
      </div>

      <div class="panel-section">
        <div class="section-title">Controls</div>
        <button onclick="sim.save()">
          <span class="btn-icon">▶</span>Save Brain
        </button>
        <button onclick="sim.discard()">
          <span class="btn-icon">↺</span>Reset Brain
        </button>
        <button onclick="sim.addObstacle()">
          <span class="btn-icon">+</span>Add Obstacle
        </button>
      </div>

      <span class="panel-hint">ESC → pause / resume</span>
    </div>

    <div id="generation-end-overlay">
      <div class="overlay-content"></div>
    </div>
    <div id="toast"></div>

    <script src="./utils.js" charset="utf-8"></script>
    <script src="./ray-sensor.js" charset="utf-8"></script>
    <script src="./street.js" charset="utf-8"></script>
    <script src="./consts.js" charset="utf-8"></script>
    <script src="./controls.js" charset="utf-8"></script>
    <script src="./vehicles.js" charset="utf-8"></script>
    <script src="./obstacle.js" charset="utf-8"></script>
    <script src="./neural-network.js" charset="utf-8"></script>
    <script src="./network-visualizer.js" charset="utf-8"></script>
    <script src="./simulation.js" charset="utf-8"></script>
    <script src="./index.js" charset="utf-8"></script>
  </body>
</html>
```

Note what changed in the script order:
- `sensors.js` and `car.js` removed
- `controls.js` moved to after `consts.js` (so `CAR_TYPE` is available)
- `ray-sensor.js` replaces `sensors.js`
- `vehicles.js` replaces `car.js`
- `simulation.js` added before `index.js`

- [ ] **Step 4: Verify — full smoke test**

Open `index.html` in browser and check each of these in order:

1. Console: **zero errors**
2. Simulation starts: cars appear and move upward
3. Sensor rays visible on the best car
4. Network visualizer updates in the right panel
5. Switch to Moto tab → moto-shaped fleet appears, sensor rays still work
6. Switch to Bus tab → bus-shaped fleet appears
7. Click "Add Obstacle" → hazard appears ahead
8. Click "Save Brain" → toast appears: `✅ Car brain saved · Gen 1`
9. Press ESC → simulation freezes (pause)
10. Press ESC again → simulation resumes, timer continues without jump
11. Wait for all cars to crash → generation overlay appears → generation 2 starts automatically

- [ ] **Step 5: Commit**

```bash
git add index.js controls.js index.html
git commit -m "refactor: wire Simulation class as entrypoint, update Controls to use CAR_TYPE"
```

---

## Task 6: Delete old files + final verification

**Files:**
- Delete: `car.js`
- Delete: `sensors.js`

- [ ] **Step 1: Delete the replaced files**

```bash
rm /home/nised/projects/learn-neuronal-network/car.js
rm /home/nised/projects/learn-neuronal-network/sensors.js
```

- [ ] **Step 2: Verify**

Open `index.html` in browser. The deleted files are no longer referenced in `index.html` so nothing should change. Console must be error-free. Run the same smoke test as Task 5 Step 4.

- [ ] **Step 3: Verify no old names remain in source**

```bash
grep -rn "type === 'dummy'\|type === \"dummy\"\|type === 'mainCar'\|type === \"mainCar\"\|type === 'generations'\|brainConected\|new Sensors\|new Car(" \
  --include="*.js" /home/nised/projects/learn-neuronal-network/
```

Expected output: **no matches**. If any match is found, fix it before committing.

- [ ] **Step 4: Verify no Car class exists**

```bash
grep -rn "class Car\b" --include="*.js" /home/nised/projects/learn-neuronal-network/
```

Expected output: **no matches**.

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "refactor: delete car.js and sensors.js (replaced by vehicles.js and ray-sensor.js)"
```

---

## Success Checklist

After all tasks are complete, verify against the spec:

- [ ] All three vehicle models render correctly with correct shapes
- [ ] Switching models, saving, and discarding brains work
- [ ] Obstacles spawn and collide correctly
- [ ] ESC pause/resume works without loop duplication
- [ ] Generation lifecycle (reset, overlay, auto-save) works
- [ ] No `type === 'dummy'` or `type === 'mainCar'` strings anywhere in source
- [ ] No `brainConected` typo anywhere in source
- [ ] `Car` class does not exist anywhere in source
- [ ] `Sensors` class does not exist anywhere in source
