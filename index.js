let pause = false
let pauseStartTime = 0
let animating = false

const CAR_GENERATION_NUMBER = 1000

let generationCount = 1
let bestBrain = null
let generationResetting = false
let lastKnownY = 0
let generationStartTime = Date.now()
const GRACE_PERIOD_MS = 3000

let canvas = document.getElementById("main-plane");
canvas.width = 280;

let networkCanvas = document.getElementById("network");
networkCanvas.width = 320;

const ROAD_WIDTH = 180
const pxM = 12.5
const secondsInHour = 3600
const mInKm = 2000

const canvasContext = canvas.getContext("2d")
const networkContext = networkCanvas.getContext("2d")

const street = new Street(canvas.width / 2, ROAD_WIDTH)
let mainCar = null

// ─── Current vehicle model (persisted) ────────────────────────────────
let currentModel = localStorage.getItem(SELECTED_MODEL_KEY) || 'car'
if (!VEHICLE_MODELS[currentModel]) currentModel = 'car'

let cars = generateCars(CAR_GENERATION_NUMBER)
let traffic = []

// Migrate legacy 'best-brain' key to 'best-brain-car' on first run
migrateLegacyBrainKey()

// ─── Load saved brain for current model ───────────────────────────────
const savedPayload = loadSavedBrain()
if (savedPayload) {
    for (let i = 0; i < cars.length; i++) {
        cars[i].brain = JSON.parse(JSON.stringify(savedPayload.brain))
        if (i !== 0) {
            NeuralNetwork.mutate(cars[i].brain, 0.1)
        }
    }
    bestBrain = JSON.parse(JSON.stringify(savedPayload.brain))
    generationCount = savedPayload.generation || 1
    document.getElementById("generation-count").textContent = generationCount
}

syncModelUI()
generationStartTime = Date.now()
animate()
generateNewTrafficCar()
removeDeathgenerations()
startStatsUpdater()

// ─── Persistence (per-model) ─────────────────────────────────────────

function migrateLegacyBrainKey() {
    const legacy = localStorage.getItem("best-brain")
    if (!legacy) return
    // Only migrate if the car-model key isn't already set
    if (!localStorage.getItem(VEHICLE_MODELS.car.storageKey)) {
        localStorage.setItem(VEHICLE_MODELS.car.storageKey, legacy)
    }
    localStorage.removeItem("best-brain")
}

function loadSavedBrain(modelId = currentModel) {
    const key = VEHICLE_MODELS[modelId].storageKey
    const raw = localStorage.getItem(key)
    if (!raw) return null
    try {
        const parsed = JSON.parse(raw)
        // Old format: brain object with `levels` array directly
        if (Array.isArray(parsed.levels)) {
            return { brain: parsed, generation: 1 }
        }
        return parsed
    } catch {
        return null
    }
}

function persistBrain(brain, generation, modelId = currentModel) {
    const key = VEHICLE_MODELS[modelId].storageKey
    localStorage.setItem(key, JSON.stringify({
        brain: brain,
        generation: generation,
        savedAt: Date.now()
    }))
}

function save() {
    const brain = mainCar ? mainCar.brain : bestBrain
    const m = VEHICLE_MODELS[currentModel]
    if (brain) {
        persistBrain(brain, generationCount)
        bestBrain = JSON.parse(JSON.stringify(brain))
        showToast(`✅ ${m.label} brain saved · Gen ${generationCount}`)
    } else {
        showToast("⚠️ No brain to save yet")
    }
}

function discard() {
    const m = VEHICLE_MODELS[currentModel]
    const confirmed = window.confirm(`Clear the ${m.label} brain? Training will restart from scratch with random brains for this vehicle.`)
    if (!confirmed) return

    localStorage.removeItem(m.storageKey)
    bestBrain = null
    generationCount = 1
    document.getElementById("generation-count").textContent = 1

    generationResetting = true
    traffic = []
    cars = generateCars(CAR_GENERATION_NUMBER)
    generationStartTime = Date.now()
    generationResetting = false

    showToast(`❌ ${m.label} brain cleared`)
}

// ─── Model switcher ──────────────────────────────────────────────────

function syncModelUI() {
    const m = VEHICLE_MODELS[currentModel]
    const nameEl = document.getElementById('current-model-name')
    if (nameEl) nameEl.textContent = m.label
    document.querySelectorAll('.model-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.model === currentModel)
    })
}

function setModel(modelId) {
    if (!VEHICLE_MODELS[modelId]) return
    if (modelId === currentModel) return
    if (generationResetting) return

    currentModel = modelId
    localStorage.setItem(SELECTED_MODEL_KEY, modelId)
    const m = VEHICLE_MODELS[modelId]

    generationResetting = true
    traffic = []
    cars = generateCars(CAR_GENERATION_NUMBER)
    generationStartTime = Date.now()

    const saved = loadSavedBrain()
    if (saved) {
        for (let i = 0; i < cars.length; i++) {
            cars[i].brain = JSON.parse(JSON.stringify(saved.brain))
            if (i !== 0) NeuralNetwork.mutate(cars[i].brain, 0.1)
        }
        bestBrain = JSON.parse(JSON.stringify(saved.brain))
        generationCount = saved.generation || 1
    } else {
        bestBrain = null
        generationCount = 1
    }

    document.getElementById("generation-count").textContent = generationCount
    syncModelUI()
    generationResetting = false

    showToast(`${m.icon} ${m.label} · Gen ${generationCount}`)
}

function showToast(message) {
    const toast = document.getElementById("toast")
    toast.textContent = message
    toast.classList.remove("visible")
    void toast.offsetWidth
    toast.classList.add("visible")
    setTimeout(() => toast.classList.remove("visible"), 2000)
}

// ─── Generation lifecycle ────────────────────────────────────────────

function generateCars(n) {
    const m = VEHICLE_MODELS[currentModel]
    const newMain = new Car(street.getLaneCenter(1), -20, m.width, m.height, "mainCar", m.maxSpeed, "green", true, m.id)
    mainCar = newMain
    const arr = [newMain]
    for (let i = 1; i <= n; i++) {
        arr.push(new Car(street.getLaneCenter(1), -20, m.width, m.height, "generations", m.maxSpeed, "green", false, m.id))
    }
    return arr
}

function updateTheBestCar() {
    if (!cars || cars.length === 0) return

    let bestY = Infinity
    let candidate = null
    for (let i = 0; i < cars.length; i++) {
        if (cars[i].y < bestY) {
            bestY = cars[i].y
            candidate = cars[i]
        }
    }

    if (candidate && candidate !== mainCar) {
        if (mainCar) {
            mainCar.type = "dummy"
            mainCar.drawSensor = false
            mainCar.color = "green"
            // Block lane-change logic on demoted brain-driven car
            mainCar.targetLane = null
            mainCar.turnSignal = null
            mainCar.nextLaneCheckTime = Infinity
        }
        mainCar = candidate
        mainCar.drawSensor = true
        mainCar.type = "mainCar"
        mainCar.color = "blue"

        // Only clone the brain on promotion — saves ~60 clones/sec
        if (mainCar.brain) {
            bestBrain = JSON.parse(JSON.stringify(mainCar.brain))
        }
    }
}

function generateNewTrafficCar() {
    setInterval(() => {
        if (!mainCar || generationResetting || pause) return
        traffic.push(
            new Car(street.getLaneCenter(getRandomNumberBetween(0, street.laneCount)), mainCar.y - getRandomNumberBetween(500, 700), 30, 50, "dummy", 1, "purple", false)
        )
    }, 2000);
}

function triggerGenerationReset() {
    if (generationResetting) return
    generationResetting = true

    generationCount++
    document.getElementById("generation-count").textContent = generationCount

    // Save brain with the newly-incremented generation number
    if (bestBrain) {
        persistBrain(bestBrain, generationCount)
    }

    showGenerationOverlay(generationCount - 1, generationCount)
    setTimeout(resetGeneration, 2500)
}

function resetGeneration() {
    traffic = []
    cars = generateCars(CAR_GENERATION_NUMBER)
    generationStartTime = Date.now()
    const payload = loadSavedBrain()
    if (payload) {
        for (let i = 0; i < cars.length; i++) {
            cars[i].brain = JSON.parse(JSON.stringify(payload.brain))
            if (i !== 0) {
                NeuralNetwork.mutate(cars[i].brain, 0.1)
            }
        }
        bestBrain = JSON.parse(JSON.stringify(payload.brain))
    } else {
        bestBrain = null
    }
    hideGenerationOverlay()
    generationResetting = false
}

function showGenerationOverlay(died, next) {
    const el = document.getElementById("generation-end-overlay")
    el.querySelector(".overlay-content").innerHTML =
        `<p>Generation <strong>${died}</strong> ended</p>` +
        `<p>Brain saved to localStorage</p>` +
        `<p>Starting generation <strong>${next}</strong>...</p>`
    el.style.display = "flex"
}

function hideGenerationOverlay() {
    document.getElementById("generation-end-overlay").style.display = "none"
}

function removeOldTraffic() {
    if (traffic && traffic.length > 0 && mainCar) {
        traffic = traffic.filter((car) => mainCar.y + (mainCar.height * 6) > car.y)
    }
}

function removeDeathgenerations() {
    setInterval(() => {
        if (pause) return
        if (Date.now() - generationStartTime < GRACE_PERIOD_MS) return
        if (generationResetting) return
        if (mainCar) {
            cars = cars.filter((c) => c.damaged == false && c.speed !== 0 && mainCar.y + (mainCar.height * 6) > c.y)
        }
        if (cars.length === 0 && !generationResetting) {
            triggerGenerationReset()
        }
    }, 2000)
}

// ─── Main render loop ────────────────────────────────────────────────

function animate(time) {
    if (pause) {
        animating = false
        return
    }
    animating = true

    canvas.height = window.innerHeight;
    networkCanvas.height = window.innerHeight;

    const refY = mainCar ? mainCar.y : lastKnownY

    canvasContext.save()
    canvasContext.translate(0, -refY + canvas.height * 0.7)

    // Road surface + lanes
    street.draw(canvasContext)

    // Roadside decoration (light posts, bushes)
    street.drawRoadside(canvasContext, refY, canvas.height)

    removeOldTraffic()

    // Update + draw traffic individually (small count, full detail)
    for (let i = 0; i < traffic.length; i++) {
        traffic[i].update(street.borders, [])
        traffic[i].draw(canvasContext)
    }

    // Update ALL cars (physics) + collect polygons for batched ghost rendering
    const cullTop    = refY - canvas.height * 0.85
    const cullBottom = refY + canvas.height * 0.45

    const liveGhosts    = []
    const damagedGhosts = []

    for (let i = 0; i < cars.length; i++) {
        const car = cars[i]
        car.update(street.borders, traffic)

        if (car === mainCar) continue
        if (car.y < cullTop || car.y > cullBottom) continue
        if (car.polygon.length < 4) continue

        if (car.damaged) damagedGhosts.push(car.polygon)
        else             liveGhosts.push(car.polygon)
    }

    // ── Batched ghost rendering ──────────────────────────────────────
    if (liveGhosts.length > 0) {
        canvasContext.globalAlpha = 0.20
        canvasContext.fillStyle   = '#3fb950'
        canvasContext.beginPath()
        for (let i = 0; i < liveGhosts.length; i++) {
            const p = liveGhosts[i]
            canvasContext.moveTo(p[0].x, p[0].y)
            canvasContext.lineTo(p[1].x, p[1].y)
            canvasContext.lineTo(p[2].x, p[2].y)
            canvasContext.lineTo(p[3].x, p[3].y)
            canvasContext.closePath()
        }
        canvasContext.fill()
    }

    if (damagedGhosts.length > 0) {
        canvasContext.globalAlpha = 0.28
        canvasContext.fillStyle   = '#f78166'
        canvasContext.beginPath()
        for (let i = 0; i < damagedGhosts.length; i++) {
            const p = damagedGhosts[i]
            canvasContext.moveTo(p[0].x, p[0].y)
            canvasContext.lineTo(p[1].x, p[1].y)
            canvasContext.lineTo(p[2].x, p[2].y)
            canvasContext.lineTo(p[3].x, p[3].y)
            canvasContext.closePath()
        }
        canvasContext.fill()
    }

    // Draw mainCar with full detail
    canvasContext.globalAlpha = 1
    if (mainCar) {
        mainCar.draw(canvasContext)
        lastKnownY = mainCar.y
        updateTheBestCar()
    }

    canvasContext.restore()

    networkContext.lineDashOffset = -time / 50
    Visualizer.drawNetwork(networkContext, mainCar ? mainCar.brain : bestBrain)

    document.getElementById("live-generations").innerHTML = cars.length
    requestAnimationFrame(animate)
}

function addObstacle() {
    if (!mainCar) return
    const lane = getRandomNumberBetween(0, street.laneCount - 1)
    const x = street.getLaneCenter(lane)
    const y = mainCar.y - getRandomNumberBetween(400, 700)
    traffic.push(Obstacle.createRandom(x, y))
}

// ─── Stats UI updater ────────────────────────────────────────────────

function startStatsUpdater() {
    const timerEl    = document.getElementById('gen-timer')
    const progressEl = document.getElementById('survivors-progress')

    setInterval(() => {
        if (pause) return

        const elapsed  = Math.floor((Date.now() - generationStartTime) / 1000)
        const minutes  = Math.floor(elapsed / 60)
        const seconds  = elapsed % 60
        if (timerEl) {
            timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`
        }

        if (progressEl && cars) {
            const pct = Math.max(0, (cars.length / CAR_GENERATION_NUMBER) * 100)
            progressEl.style.width = pct + '%'
            if (pct < 15) {
                progressEl.style.backgroundColor = 'var(--red)'
            } else if (pct < 45) {
                progressEl.style.backgroundColor = 'var(--amber)'
            } else {
                progressEl.style.backgroundColor = 'var(--green)'
            }
        }
    }, 500)
}

// ─── Pause control (single event listener — no conflicts) ────────────

document.addEventListener('keydown', (event) => {
    if (event.key !== "Escape") return
    event.preventDefault()

    if (!pause) {
        pause = true
        pauseStartTime = Date.now()
    } else {
        pause = false
        // Shift generation start so timer doesn't jump
        generationStartTime += Date.now() - pauseStartTime
        // Only restart if no animate is already in flight (prevents loop duplication)
        if (!animating) {
            animating = true
            requestAnimationFrame(animate)
        }
    }
})
