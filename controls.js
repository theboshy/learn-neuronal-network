class Controls {
    constructor(type) {
        this.forward = false
        this.left    = false
        this.right   = false
        this.reverse = false

        if (type === CAR_TYPE.TRAFFIC) {
            this.forward = true
        }
    }
}
