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
        this.#startObstacleInterval()
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
                this.#street.getLaneCenter(getRandomNumberBetween(0, this.#street.laneCount - 1)),
                this.#mainCar.y - getRandomNumberBetween(500, 700),
                CAR_TYPE.TRAFFIC, 1, 'purple', false
            ))
        }, 2000)
    }

    #startObstacleInterval() {
        const schedule = () => {
            setTimeout(() => {
                if (!this.#mainCar || this.#generationResetting || this.#pause) {
                    schedule()
                    return
                }
                this.addObstacle()
                schedule()
            }, getRandomNumberBetween(5000, 10000))
        }
        schedule()
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

        document.getElementById('live-generations').textContent = this.#cars.length
        requestAnimationFrame((t) => this.#animate(t))
    }
}
