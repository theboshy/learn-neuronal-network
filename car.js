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
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(-this.rotationAngle);

        const w = this.width;
        const h = this.height;

        // Glow only for the best car
        if (this.type === 'mainCar' && !this.damaged) {
            ctx.shadowBlur = 20;
            ctx.shadowColor = '#58a6ff';
        }

        // Body color by role
        let bodyColor;
        if (this.damaged) {
            bodyColor = '#f78166';
        } else if (this.type === 'mainCar') {
            bodyColor = '#58a6ff';
        } else if (this.type === 'dummy') {
            // Hard-stop obstacles keep red; regular traffic is amber
            bodyColor = this.color === 'red' ? '#f78166' : '#d29922';
        } else {
            bodyColor = '#3fb950';
        }

        // Car body
        ctx.fillStyle = bodyColor;
        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, 4);
        ctx.fill();

        ctx.shadowBlur = 0;

        if (this.damaged) {
            // X mark for wrecked cars
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(-w / 3.5, -h / 3.5);
            ctx.lineTo( w / 3.5,  h / 3.5);
            ctx.moveTo( w / 3.5, -h / 3.5);
            ctx.lineTo(-w / 3.5,  h / 3.5);
            ctx.stroke();
        } else {
            // Windshield
            ctx.fillStyle = 'rgba(0, 0, 0, 0.48)';
            ctx.beginPath();
            ctx.roundRect(-w / 2 + 3, -h / 2 + 5, w - 6, h * 0.27, 2);
            ctx.fill();

            // Rear window
            ctx.fillStyle = 'rgba(0, 0, 0, 0.36)';
            ctx.beginPath();
            ctx.roundRect(-w / 2 + 3, h / 2 - h * 0.22, w - 6, h * 0.17, 2);
            ctx.fill();

            // Roof panel (subtle highlight)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.beginPath();
            ctx.roundRect(-w / 2 + 4, -h / 2 + h * 0.27 + 7, w - 8, h * 0.34, 1);
            ctx.fill();
        }

        // Wheels — all four in one path batch
        const ww = 5;
        const wh = 9;
        ctx.fillStyle = '#0a0d10';
        ctx.beginPath();
        ctx.roundRect(-w / 2 - ww + 1, -h / 2 + 5,      ww, wh, 1); // front-left
        ctx.roundRect( w / 2 - 1,       -h / 2 + 5,      ww, wh, 1); // front-right
        ctx.roundRect(-w / 2 - ww + 1,   h / 2 - 5 - wh, ww, wh, 1); // rear-left
        ctx.roundRect( w / 2 - 1,         h / 2 - 5 - wh, ww, wh, 1); // rear-right
        ctx.fill();

        ctx.restore();

        // Sensor rays drawn in world space (after restore)
        if (this.sensor && this.sensor.car.drawSensor) {
            this.sensor.draw(ctx);
        }
    }
}