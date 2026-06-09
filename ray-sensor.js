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
