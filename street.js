class Street {
    constructor(x, width, laneCount = 4) {
        this.x = x;
        this.width = width;
        this.laneCount = laneCount;

        this.left  = x - width / 2;
        this.right = x + width / 2;

        this.top    = -INFINITY;
        this.bottom =  INFINITY;

        const topLeft     = { x: this.left,  y: this.top    };
        const topRight    = { x: this.right, y: this.top    };
        const bottomLeft  = { x: this.left,  y: this.bottom };
        const bottomRight = { x: this.right, y: this.bottom };

        this.borders = [
            [topLeft, bottomLeft],
            [topRight, bottomRight]
        ];
    }

    getLaneCenter(laneIndex) {
        const laneWidth = this.width / this.laneCount;
        return this.left + laneWidth / 2 +
            Math.min(laneIndex, this.laneCount - 1) * laneWidth;
    }

    getLaneFromX(x) {
        const laneWidth = this.width / this.laneCount;
        const offset = x - this.left;
        return Math.max(0, Math.min(this.laneCount - 1, Math.floor(offset / laneWidth)));
    }

    draw(context) {
        // Asphalt — large finite rect avoids Infinity issues
        context.fillStyle = '#1c2128';
        context.fillRect(this.left, -100000, this.width, 200000);

        // Lane dividers
        context.lineWidth   = 2;
        context.strokeStyle = 'rgba(255, 255, 255, 0.28)';
        context.setLineDash([24, 18]);

        for (let i = 1; i <= this.laneCount - 1; i++) {
            const x = lerp(this.left, this.right, i / this.laneCount);
            context.beginPath();
            context.moveTo(x, this.top);
            context.lineTo(x, this.bottom);
            context.stroke();
        }

        // Solid edge borders
        context.setLineDash([]);
        context.lineWidth   = 4;
        context.strokeStyle = 'rgba(230, 237, 243, 0.8)';
        this.borders.forEach((border) => {
            context.beginPath();
            context.moveTo(border[0].x, border[0].y);
            context.lineTo(border[1].x, border[1].y);
            context.stroke();
        });
    }

    drawRoadside(ctx, refY, viewHeight) {
        const visibleTop    = refY - viewHeight * 0.85;
        const visibleBottom = refY + viewHeight * 0.45;

        // ─── Bushes (deterministic) ──────────────────────────────────
        const bushSpacing = 55;
        const bushStart = Math.floor(visibleTop / bushSpacing);
        const bushEnd   = Math.ceil(visibleBottom / bushSpacing);
        for (let i = bushStart; i <= bushEnd; i++) {
            const r1 = Street.#rand(i, 11);
            if (r1 < 0.55) continue;

            const side  = Street.#rand(i, 47) > 0.5 ? -1 : 1;
            const xOff  = (Street.#rand(i, 89) - 0.5) * 14;
            const yOff  = (Street.#rand(i, 131) - 0.5) * 28;
            const baseX = side < 0 ? this.left - 28 : this.right + 28;
            const y     = i * bushSpacing + yOff;

            Street.#drawBush(ctx, baseX + xOff, y, r1);
        }

        // ─── Light posts (every postSpacing, alternating sides) ──────
        const postSpacing = 260;
        const postStart = Math.floor(visibleTop / postSpacing);
        const postEnd   = Math.ceil(visibleBottom / postSpacing);
        for (let i = postStart; i <= postEnd; i++) {
            const y = i * postSpacing;
            const side = i % 2 === 0 ? -1 : 1;
            const x = side < 0 ? this.left - 18 : this.right + 18;
            Street.#drawLightPost(ctx, x, y);
        }
    }

    // ─── Deterministic pseudo-random ─────────────────────────────────
    static #rand(n, salt = 0) {
        const x = Math.sin(n * 12.9898 + salt * 78.233) * 43758.5453;
        return x - Math.floor(x);
    }

    static #drawBush(ctx, x, y, seed) {
        const sz = 4 + Math.floor(seed * 4); // 4-7

        ctx.fillStyle = '#1a4524';
        ctx.beginPath();
        ctx.arc(x,                y,                  sz,       0, Math.PI * 2);
        ctx.arc(x + sz * 0.5, y - sz * 0.3, sz * 0.7, 0, Math.PI * 2);
        ctx.arc(x - sz * 0.4, y + sz * 0.4, sz * 0.6, 0, Math.PI * 2);
        ctx.arc(x + sz * 0.2, y + sz * 0.5, sz * 0.5, 0, Math.PI * 2);
        ctx.fill();

        // Subtle highlight
        ctx.fillStyle = '#2d6b3a';
        ctx.beginPath();
        ctx.arc(x - sz * 0.25, y - sz * 0.35, sz * 0.4, 0, Math.PI * 2);
        ctx.fill();
    }

    static #drawLightPost(ctx, x, y) {
        // Drop shadow on asphalt
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.beginPath();
        ctx.ellipse(x + 1.5, y + 2, 5, 3, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pole base ring
        ctx.fillStyle = '#3a3f47';
        ctx.beginPath();
        ctx.arc(x, y, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#1c2128';
        ctx.lineWidth = 0.8;
        ctx.stroke();

        // Glow halo on the asphalt
        const halo = ctx.createRadialGradient(x, y, 0, x, y, 22);
        halo.addColorStop(0,   'rgba(240, 198, 116, 0.20)');
        halo.addColorStop(0.4, 'rgba(240, 198, 116, 0.07)');
        halo.addColorStop(1,   'rgba(240, 198, 116, 0)');
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, 22, 0, Math.PI * 2);
        ctx.fill();

        // Lamp itself
        ctx.shadowBlur  = 10;
        ctx.shadowColor = '#f0c674';
        ctx.fillStyle   = '#f0c674';
        ctx.beginPath();
        ctx.arc(x, y, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
    }
}
