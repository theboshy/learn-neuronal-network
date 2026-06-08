class Street {
    constructor(x, width, laneCount = 4) {
        this.x = x
        this.width = width
        this.laneCount = laneCount
        
        this.left = x - width / 2
        this.right = x + width / 2
        
        this.top = -INFINITY
        this.bottom = INFINITY
        
        const topLeft = {x: this.left, y: this.top}
        const topRight = {x: this.right, y: this.top}
        const bottomLeft = {x: this.left, y: this.bottom}
        const bottomRight = {x: this.right, y: this.bottom}
        
        this.borders = [
            [topLeft, bottomLeft],
            [topRight, bottomRight]
        ]
        
    }

    getLaneCenter(laneIndex){
        const laneWidth=this.width/this.laneCount;
        return this.left+laneWidth/2+
            Math.min(laneIndex,this.laneCount-1)*laneWidth;
    }
    
    draw(context) {
        // Road surface — large finite rect avoids Infinity fillRect issues
        context.fillStyle = '#1c2128';
        context.fillRect(this.left, -100000, this.width, 200000);

        // Lane dividers
        context.lineWidth = 2;
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
        context.lineWidth = 4;
        context.strokeStyle = 'rgba(230, 237, 243, 0.8)';
        this.borders.forEach((border) => {
            context.beginPath();
            context.moveTo(border[0].x, border[0].y);
            context.lineTo(border[1].x, border[1].y);
            context.stroke();
        });
    }
}

