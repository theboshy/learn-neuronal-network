class Controls {
    constructor(type) {
        this.forward = false;
        this.left    = false;
        this.right   = false;
        this.reverse = false;

        // Dummy traffic always goes forward
        if (type === "dummy") {
            this.forward = true;
        }
    }
}
