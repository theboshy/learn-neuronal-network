const OBSTACLE_TYPES = ['pothole', 'wreck', 'burning-trash']

const OBSTACLE_SIZES = {
    'pothole':       { w: 26, h: 20 },
    'wreck':         { w: 38, h: 52 },
    'burning-trash': { w: 22, h: 24 }
}

class Obstacle {
    constructor(x, y, type) {
        this.x = x
        this.y = y
        this.type = type
        this.speed = 0           // satisfies traffic cleanup that touches .speed
        this.damaged = false     // never crashes — it IS the crash
        this.spawnTime = Date.now()

        const s = OBSTACLE_SIZES[type] || OBSTACLE_SIZES.pothole
        this.width  = s.w
        this.height = s.h

        // Axis-aligned bounding box polygon (sensors + collision)
        this.polygon = this.#createPolygon()
    }

    static createRandom(x, y) {
        const type = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)]
        return new Obstacle(x, y, type)
    }

    #createPolygon() {
        const hw = this.width / 2
        const hh = this.height / 2
        return [
            { x: this.x - hw, y: this.y - hh },
            { x: this.x + hw, y: this.y - hh },
            { x: this.x + hw, y: this.y + hh },
            { x: this.x - hw, y: this.y + hh }
        ]
    }

    // No-op — obstacles don't move
    update(_borders, _traffic) {}

    draw(ctx) {
        switch (this.type) {
            case 'pothole':       this.#drawPothole(ctx); break
            case 'wreck':         this.#drawWreck(ctx); break
            case 'burning-trash': this.#drawBurningTrash(ctx); break
        }
    }

    // ── Pothole ───────────────────────────────────────────────────────
    #drawPothole(ctx) {
        const x = this.x, y = this.y

        // Outer rough edge (slightly tilted ellipse)
        ctx.fillStyle = '#0a0a0c'
        ctx.beginPath()
        ctx.ellipse(x, y, 12, 9, 0.3, 0, Math.PI * 2)
        ctx.fill()

        // Solid black hole
        ctx.fillStyle = '#000'
        ctx.beginPath()
        ctx.ellipse(x, y, 9, 6.5, 0.3, 0, Math.PI * 2)
        ctx.fill()

        // 3D inner shadow gradient
        const grad = ctx.createRadialGradient(x - 2, y - 1, 0, x, y, 8)
        grad.addColorStop(0, 'rgba(70, 60, 50, 0.35)')
        grad.addColorStop(1, 'rgba(0, 0, 0, 0.95)')
        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.ellipse(x, y, 8.5, 6, 0.3, 0, Math.PI * 2)
        ctx.fill()

        // Loose asphalt chunks scattered around
        ctx.fillStyle = '#2a2f36'
        const chunks = [[-13, -7, 1.4], [11, -9, 1.2], [-12, 10, 1.5], [13, 8, 1.3], [-14, 1, 0.9]]
        for (const [dx, dy, r] of chunks) {
            ctx.beginPath()
            ctx.arc(x + dx, y + dy, r, 0, Math.PI * 2)
            ctx.fill()
        }
    }

    // ── Wreck + cones ────────────────────────────────────────────────
    #drawWreck(ctx) {
        const x = this.x, y = this.y

        // Crashed car body (slightly askew)
        ctx.save()
        ctx.translate(x, y - 2)
        ctx.rotate(-0.22)

        // Body
        ctx.fillStyle = '#5a3a1f'
        ctx.beginPath()
        ctx.roundRect(-13, -22, 26, 44, 3)
        ctx.fill()

        // Crumpled hood
        ctx.fillStyle = '#3a2410'
        ctx.beginPath()
        ctx.roundRect(-11, -20, 22, 6, 2)
        ctx.fill()

        // Blown-out windows
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        ctx.beginPath()
        ctx.roundRect(-9, -12, 18, 10, 2)
        ctx.roundRect(-9,   4, 18, 12, 2)
        ctx.fill()

        // Damage marks
        ctx.strokeStyle = 'rgba(180, 50, 30, 0.55)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(-6, -8); ctx.lineTo( 6,  8)
        ctx.moveTo( 6, -8); ctx.lineTo(-6,  8)
        ctx.stroke()

        ctx.restore()

        // Surrounding traffic cones
        this.#drawCone(ctx, x - 17, y - 22)
        this.#drawCone(ctx, x + 17, y - 22)
        this.#drawCone(ctx, x - 17, y + 22)
        this.#drawCone(ctx, x + 17, y + 22)
    }

    #drawCone(ctx, cx, cy) {
        // Base shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
        ctx.beginPath()
        ctx.ellipse(cx + 1, cy + 1, 4, 1.5, 0, 0, Math.PI * 2)
        ctx.fill()

        // Black base
        ctx.fillStyle = '#1a1a1a'
        ctx.beginPath()
        ctx.ellipse(cx, cy, 3.5, 1.2, 0, 0, Math.PI * 2)
        ctx.fill()

        // Orange cone body (triangle)
        ctx.fillStyle = '#ff7a00'
        ctx.beginPath()
        ctx.moveTo(cx,     cy - 5)
        ctx.lineTo(cx + 3, cy + 1)
        ctx.lineTo(cx - 3, cy + 1)
        ctx.closePath()
        ctx.fill()

        // White reflective stripe
        ctx.fillStyle = '#fff'
        ctx.fillRect(cx - 2.2, cy - 1.5, 4.4, 1)
    }

    // ── Burning trash ────────────────────────────────────────────────
    #drawBurningTrash(ctx) {
        const x = this.x, y = this.y
        const t = (Date.now() - this.spawnTime) / 180
        const pulse  = Math.sin(t)        * 0.18 + 1
        const pulse2 = Math.sin(t * 1.7)  * 0.22 + 1

        // Outer warm glow (radial gradient, no shadowBlur cost)
        const halo = ctx.createRadialGradient(x, y, 0, x, y, 28 * pulse)
        halo.addColorStop(0,    'rgba(255, 140, 0, 0.50)')
        halo.addColorStop(0.4,  'rgba(255,  80, 0, 0.22)')
        halo.addColorStop(1,    'rgba(255,  80, 0, 0)')
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(x, y, 28 * pulse, 0, Math.PI * 2)
        ctx.fill()

        // Dark pile of trash
        ctx.fillStyle = '#1a1614'
        ctx.beginPath()
        ctx.arc(x - 3, y - 2, 5,   0, Math.PI * 2)
        ctx.arc(x + 4, y + 1, 4,   0, Math.PI * 2)
        ctx.arc(x - 1, y + 4, 4,   0, Math.PI * 2)
        ctx.arc(x + 3, y - 3, 3,   0, Math.PI * 2)
        ctx.fill()

        // Hot core (yellow-orange) with glow
        ctx.shadowBlur  = 14
        ctx.shadowColor = '#ffaa00'
        ctx.fillStyle   = `rgba(255, 200, 50, ${0.85 * pulse2})`
        ctx.beginPath()
        ctx.arc(x, y, 4 * pulse2, 0, Math.PI * 2)
        ctx.fill()

        // White-hot center
        ctx.shadowBlur = 0
        ctx.fillStyle  = 'rgba(255, 245, 200, 0.75)'
        ctx.beginPath()
        ctx.arc(x, y, 2, 0, Math.PI * 2)
        ctx.fill()
    }
}
