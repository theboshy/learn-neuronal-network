class Sensors {
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
            // 0.1 more close to first number and 0.9 more close to second number, 0.5 the half
            const rayAngle = lerp( 
                this.raySpread / 2,
                -this.raySpread / 2,
                this.rayCount === 1 ? 0.5 : i/(this.rayCount - 1) 
            ) + this.car.rotationAngle
            
            const start = {x: this.car.x, y: this.car.y}
            const end = {
                x: this.car.x - Math.sin(rayAngle) * this.rayLength, 
                y: this.car.y - Math.cos(rayAngle) * this.rayLength
            }
            this.rays.push([start, end])
        }
    }
    
     #getReading(ray,roadBorders, traffic){
        let touches=[];

        for(let i=0;i<roadBorders.length;i++){
            const touch=getIntersection(
                ray[0],
                ray[1],
                roadBorders[i][0],
                roadBorders[i][1]
            );
            if(touch){
                touches.push(touch);
            }
        }

        for(let i=0;i<traffic.length;i++){
            const polygon = traffic[i].polygon
            for (let j = 0; j < polygon.length; j++) {
                const touch = getIntersection(
                    ray[0],
                    ray[1],
                    polygon[j],
                    polygon[(j + 1) % polygon.length]
                )
                if(touch){
                    touches.push(touch);
                }
            }
        }

        if(touches.length==0){
            return null;
        }else{
            const offsets=touches.map(e=>e.offset);
            const minOffset=Math.min(...offsets);
            return touches.find(e=>e.offset==minOffset);
        }
    }
    
    update(streetBorders, traffic) {
       this.#castRays()
       this.readings = []
        for(let i = 0; i < this.rays.length; i++) {
            this.readings.push(
                this.#getReading(this.rays[i], streetBorders, traffic)
            )
        }
    }
    
    draw(context) {
        if (this.rays !== undefined && this.rays.length > 0) {
             for(let i = 0; i < this.rayCount; i++) {

                let end = this.rays[i][1]
                if (this.readings[i]) {
                    end = this.readings[i]
                }
                context.beginPath()
                context.lineWidth = 2
                context.strokeStyle = "yellow"
                context.moveTo(
                    this.rays[i][0].x,
                    this.rays[i][0].y
                )
                context.lineTo(
                    end.x,
                    end.y
                )

                context.stroke()

                context.beginPath()
                context.lineWidth = 2
                context.strokeStyle = "black"
                context.moveTo(
                    this.rays[i][1].x,
                    this.rays[i][1].y
                )
                context.lineTo(
                    end.x,
                    end.y
                )

                context.stroke()
            }   
        }
    }
}