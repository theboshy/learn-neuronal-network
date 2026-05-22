let pause = false

const CAR_GENERATION_NUMBER = 2000

let generationCount = 1
let bestBrain = null
let generationResetting = false
let lastKnownY = 0
let generationStartTime = Date.now()
const GRACE_PERIOD_MS = 3000

let canvas = document.getElementById("main-plane");
canvas.width = 200;

let networkCanvas = document.getElementById("network");
networkCanvas.width = 300;

const pxM = 12.5
const secondsInHour = 3600
const mInKm = 2000

const canvasContext = canvas.getContext("2d")
const networkContext = networkCanvas.getContext("2d")

const street = new Street(canvas.width / 2, canvas.width * 0.9)
let mainCar = null

let cars = generateCars(CAR_GENERATION_NUMBER)
let traffic = []

const savedBrainInit = localStorage.getItem("best-brain")
if (savedBrainInit) {
    for (let i = 0; i < cars.length; i++) {
        cars[i].brain = JSON.parse(savedBrainInit)
        if (i !== 0) {
            NeuralNetwork.mutate(cars[i].brain, 0.1)
        }
    }
    bestBrain = JSON.parse(savedBrainInit)
}

generationStartTime = Date.now()
animate()
generateNewTrafficCar()
removeDeathgenerations()

function save() {
    const brain = mainCar ? mainCar.brain : bestBrain
    if (brain) {
        localStorage.setItem("best-brain", JSON.stringify(brain))
        bestBrain = JSON.parse(JSON.stringify(brain))
        showToast("✅ Cerebro guardado correctamente")
    } else {
        showToast("⚠️ No hay cerebro para guardar aún")
    }
}

function discard() {
    const confirmed = window.confirm("¿Estás seguro? Esto borrará el mejor cerebro guardado y reiniciará las generaciones desde cero con cerebros aleatorios.")
    if (!confirmed) return

    localStorage.removeItem("best-brain")
    bestBrain = null
    generationCount = 1
    document.getElementById("generation-count").textContent = 1

    generationResetting = true
    traffic = []
    cars = generateCars(CAR_GENERATION_NUMBER)
    generationStartTime = Date.now()
    generationResetting = false

    showToast("❌ Cerebro reiniciado — nueva generación con cerebros aleatorios")
}

function showToast(message) {
    const toast = document.getElementById("toast")
    toast.textContent = message
    toast.classList.remove("visible")
    void toast.offsetWidth
    toast.classList.add("visible")
    setTimeout(() => toast.classList.remove("visible"), 2000)
}

function generateCars(n) {
    const newMain = new Car(street.getLaneCenter(1), -20, 30, 50, "mainCar", 3, "green", true)
    mainCar = newMain
    const arr = [newMain]
    for (let i = 1; i <= n; i++) {
        arr.push(new Car(street.getLaneCenter(1), -20, 30, 50, "generations", 3, "green", false))
    }
    return arr
}

function updateTheBestCar() {
    if (cars && cars.length > 0) {
        const candidate = cars.find(c => c.y === Math.min(...cars.map(c => c.y)))
        if (candidate && candidate !== mainCar) {
            if (mainCar) {
                mainCar.type = "dummy"
                mainCar.drawSensor = false
                mainCar.color = "green"
            }
            mainCar = candidate
            mainCar.drawSensor = true
            mainCar.type = "mainCar"
            mainCar.color = "blue"
        }
        if (mainCar && mainCar.brain) {
            bestBrain = JSON.parse(JSON.stringify(mainCar.brain))
        }
    }
}

function generateNewTrafficCar() {
    setInterval(() => {
        if (!mainCar || generationResetting) return
        traffic.push(
            new Car(street.getLaneCenter(getRandomNumberBetween(0, street.laneCount)), mainCar.y - getRandomNumberBetween(500, 700), 30, 50, "dummy", 1, "purple", false)
        )
    }, 2000);
}

function triggerGenerationReset() {
    if (generationResetting) return
    generationResetting = true
    if (bestBrain) {
        localStorage.setItem("best-brain", JSON.stringify(bestBrain))
    }
    generationCount++
    document.getElementById("generation-count").textContent = generationCount
    showGenerationOverlay(generationCount - 1, generationCount)
    setTimeout(resetGeneration, 2500)
}

function resetGeneration() {
    traffic = []
    cars = generateCars(CAR_GENERATION_NUMBER)
    generationStartTime = Date.now()
    const saved = localStorage.getItem("best-brain")
    if (saved) {
        for (let i = 0; i < cars.length; i++) {
            cars[i].brain = JSON.parse(saved)
            if (i !== 0) {
                NeuralNetwork.mutate(cars[i].brain, 0.1)
            }
        }
        bestBrain = JSON.parse(saved)
    }
    hideGenerationOverlay()
    generationResetting = false
}

function showGenerationOverlay(died, next) {
    const el = document.getElementById("generation-end-overlay")
    el.querySelector(".overlay-content").innerHTML =
        `<p>Generación <strong>${died}</strong> terminada</p>` +
        `<p>Cerebro guardado en localStorage</p>` +
        `<p>Iniciando generación <strong>${next}</strong>...</p>`
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

function animate(time) {
    if (!pause) {
        canvas.height = window.innerHeight;
        networkCanvas.height = window.innerHeight;

        const refY = mainCar ? mainCar.y : lastKnownY

        canvasContext.save()
        canvasContext.translate(0, -refY + canvas.height * 0.7)
        street.draw(canvasContext)
        removeOldTraffic()

        for (let i = 0; i < traffic.length; i++) {
            traffic[i].update(street.borders, [])
            traffic[i].draw(canvasContext)
        }

        for (let i = 0; i < cars.length; i++) {
            canvasContext.globalAlpha = cars[i].type === "mainCar" ? 1 : 0.2
            cars[i].update(street.borders, traffic)
            cars[i].draw(canvasContext)
        }

        if (mainCar) {
            lastKnownY = mainCar.y
            updateTheBestCar()
        }

        canvasContext.restore()

        networkContext.lineDashOffset = -time / 50
        Visualizer.drawNetwork(networkContext, mainCar ? mainCar.brain : bestBrain)

        document.getElementById("live-generations").innerHTML = cars.length
        requestAnimationFrame(animate)
    }
}

function addHardStopObstacle() {
    if (!mainCar) return
    let newCar = new Car(mainCar.x, mainCar.y - 500, 30, 50, "dummy", 1, "red", false)
    traffic.push(newCar)
}

document.onkeydown = (event) => {
    if (event.key === "Escape") {
        pause = !pause
        animate()
    }
}
