let pause = false

const CAR_GENERATION_NUMBER = 2000

let canvas = document.getElementById("main-plane");
canvas.width= 200;

let networkCanvas = document.getElementById("network");
networkCanvas.width= 300;

const pxM = 12.5
const secondsInHour = 3600
const mInKm = 2000

const canvasContext = canvas.getContext("2d")
const networkContext = networkCanvas.getContext("2d")

const street = new Street(canvas.width / 2, canvas.width * 0.9)
let mainCar = new Car(street.getLaneCenter(1), -20, 30, 50, "mainCar", 3 , "green", true)

let cars = generateCars(CAR_GENERATION_NUMBER)

let traffic = []
                    
animate();
generateNewTrafficCar()
removeDeathgenerations()

if (localStorage.getItem("best-brain")) {
    if (cars.length > 0) {
        for (let i = 0; i < cars.length; i++) {
            cars[i].brain = JSON.parse(localStorage.getItem("best-brain"))
            if (i != 0) {
                NeuralNetwork.mutate(cars[i].brain, 0.1)
            }
        }
    }
}

function save() {
    localStorage.setItem("best-brain", JSON.stringify(mainCar.brain))
}

function discard() {
    localStorage.removeItem("best-brain")
}

function generateCars(n) {
    const cars = [mainCar]
    for (let i = 0; i <= n; i++) {
        cars.push(new Car(street.getLaneCenter(1), -20, 30, 50, "generations", 3, "green", false))
    }
    return cars
}

function updateTheBestCar() {
    if (cars !== undefined && cars.length > 0) {
        mainCar = cars.find((c) => c.y == Math.min(...cars.map(c => c.y)))
        let lastMainCar = cars.find((c) => c.type === "mainCar")
        if (lastMainCar) {
            lastMainCar.type = "dummy"
            lastMainCar.drawSensor = false
            lastMainCar.color = "green"   
        }

        mainCar.drawSensor = true
        mainCar.type = "mainCar"
        mainCar.color = "blue"   
    }
}

function generateNewTrafficCar() {
    setInterval(() => {
        traffic.push(
            new Car(street.getLaneCenter(getRandomNumberBetween(0, street.laneCount)), mainCar.y - getRandomNumberBetween(500, 700), 30, 50, "dummy", 1, "purple", false)
        )
    }, 2000);
}

function saveLastSurvivorbrain() {
    if (cars.length === 0) {
        save()
        location.reload()
    }
}

function removeOldTraffic() {
    if (traffic && traffic.length > 0) {
        traffic = traffic.filter((car) => mainCar.y + (mainCar.height * 6) > car.y)   
    }
}

function removeDeathgenerations() {
    setInterval(() => {
        cars = cars.filter((c) => c.damaged == false && c.speed !== 0 && mainCar.y + (mainCar.height * 6) > c.y)
    }, 2000)
}

function animate(time) {
    if (!pause) {
        canvas.height = window.innerHeight;
        networkCanvas.height = window.innerHeight;
        canvasContext.save()
        canvasContext.translate(0, -mainCar.y + canvas.height * 0.7)
        street.draw(canvasContext)
        removeOldTraffic()
        
        for (let i = 0; i < traffic.length;i++) {
            traffic[i].update(street.borders, [])
            traffic[i].draw(canvasContext)
        }
        
        for (let i = 0; i < cars.length;i++) {
            if (cars[i].type === "mainCar") {
                canvasContext.globalAlpha = 1
            } else {
                canvasContext.globalAlpha = 0.2
            }
            cars[i].update(street.borders, traffic)
            cars[i].draw(canvasContext)
        }
        
        updateTheBestCar()
        saveLastSurvivorbrain()
        canvasContext.restore()

        networkContext.lineDashOffset = -time / 50
        Visualizer.drawNetwork(networkContext, mainCar.brain)
        updateInfo()
        requestAnimationFrame(animate)
    }
}


function updateInfo() {
    document.getElementById("live-generations").innerHTML = cars.length
}

function addHardStopObstacle() {
    let newCar  = new Car(mainCar.x, mainCar.y - 500, 30, 50, "dummy", 1, "red", false)
    traffic.push(newCar)
}


document.onkeydown=(event)=> { 
    if (event.key === "Escape") {
        pause = !pause
        animate()
    }
}