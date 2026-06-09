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
            { x: this.x - Math.sin(this.rotationAngle - alpha) * rad,           y: this.y - Math.cos(this.rotationAngle - alpha) * rad },
            { x: this.x - Math.sin(this.rotationAngle + alpha) * rad,           y: this.y - Math.cos(this.rotationAngle + alpha) * rad },
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
        } else if (this.type === CAR_TYPE.GHOST) {
            bodyColor = '#3fb950'
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

// ─── Class map ────────────────────────────────────────────────────────────────

const VEHICLE_CLASS_MAP = {
    car:  CarVehicle,
    moto: MotoVehicle,
    bus:  BusVehicle,
}
