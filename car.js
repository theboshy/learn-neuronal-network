class Car {
    constructor(x, y, width, height, type="dummy", maxSpeed = 3, color = "green", drawSensor = false) {
        this.x = x
        this.y = y
        this.color = color
        this.width = width
        this.height = height
        this.speed = 0
        this.acceleration = 0.2
        this.maxSpeed = maxSpeed
        this.friction = 0.4 / DELTA_TIME
        this.rotationAngle = 0
        this.polygon = []
        this.type = type
        this.brainConected = false
        this.drawSensor = drawSensor
        this.damaged = false
        this.controls = new Controls(this.type);
        this.sensor = new Sensors(this)   
        this.brainConected = this.type != "dummy"
        this.brain = new NeuralNetwork(
            [this.sensor.rayCount,  6, 4]
        )
    }
    
    #assessDamage(borders, traffic) {
        for (let i = 0; i < borders.length; i++) {
            if (polygonsIntersect(this.polygon, borders[i])) {
                return true
            }
        }
        for (let i = 0; i < traffic.length; i++) {
            if (polygonsIntersect(this.polygon, traffic[i].polygon)) {
                  return true
             }
        }
        return false
    }
    
    #createPolygon() {
        const points = []
        const rad = Math.hypot(this.width, this.height) / 2
        const alpha = Math.atan2(this.width, this.height)
        points.push({
            x: this.x - Math.sin(this.rotationAngle - alpha) * rad,
            y: this.y - Math.cos(this.rotationAngle  - alpha) * rad
        })

        points.push({
            x: this.x - Math.sin(this.rotationAngle + alpha) * rad,
            y: this.y - Math.cos(this.rotationAngle + alpha) * rad
        })

        points.push({
            x: this.x - Math.sin(Math.PI + this.rotationAngle - alpha) * rad,
            y: this.y - Math.cos(Math.PI + this.rotationAngle - alpha) * rad
        })

        points.push({
            x: this.x - Math.sin(Math.PI + this.rotationAngle + alpha) * rad,
            y: this.y - Math.cos(Math.PI + this.rotationAngle + alpha) * rad
        })

    return points
    }
    
    #directionControl() {
        if (this.controls) {
            if (this.controls.forward) {
                this.speed+=this.acceleration
            }
            if (this.controls.reverse) {
                this.speed-=this.acceleration
            }
            if (this.speed!=0) {
                const flip = this.speed > 0 ? 1 : -1
                if (this.controls.left) {
                    this.rotationAngle+=0.03 * flip
                }
                if (this.controls.right) {
                    this.rotationAngle-=0.03 * flip
                }   
            }
        }
    }
    
    #speedControl() {
        if (this.speed > this.maxSpeed) {
            this.speed = this.maxSpeed
        }
        if (this.speed < -this.maxSpeed/2) {
            this.speed=-this.maxSpeed/2
        }
        if (this.speed > 0) {
            this.speed-=this.friction * this.speed
        }
        if (this.speed < 0) {
           this.speed+=this.friction * Math.abs(this.speed)
        }
        if (Math.abs(this.speed) < this.friction) {
            this.speed = 0
        }
    }
    
    #move() {
         this.x-=Math.sin(this.rotationAngle) * this.speed
         this.y-=Math.cos(this.rotationAngle) * this.speed
    }
    
    update(streetBorders, traffic) {
        if (!this.damaged) {
            this.#directionControl()
            this.#speedControl()
            this.#move()
            this.polygon = this.#createPolygon()
            this.damaged = this.#assessDamage(streetBorders, traffic)
            //this.y-=this.speed   
        }
        if (this.sensor) {
            this.sensor.update(streetBorders, traffic)   
            if (this.sensor.readings.length > 0) {
                const offsets = this.sensor.readings.map(
                    s => s == null ? 0 : 1 - s.offset
                )
                const outputs = NeuralNetwork.feedForward(offsets, this.brain);
                if (this.brainConected) {
                    this.controls.forward = outputs[0]
                    this.controls.left = outputs[1]
                    this.controls.right = outputs[2]
                    this.controls.reverse = outputs[3]
                }
            }                                                                   
        }
    }
    
    draw(context) {
        if (this.damaged) {
            context.fillStyle ="red"
        } else {
            context.fillStyle = this.color
        }
        if (this.polygon.length > 0) {
            context.beginPath()
            context.moveTo(this.polygon[0].x, this.polygon[0].y)
            for (let i = 1; i < this.polygon.length; i++) {
                context.lineTo(this.polygon[i].x, this.polygon[i].y)
            }
            context.fill() 
            if (this.sensor) {
                if (this.sensor.car.drawSensor) {
                    this.sensor.draw(context)
                }
            }
        }
    }
}