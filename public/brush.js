class Brush {
    constructor(x, y) {
        this.position = createVector(x, y);
        this.prevPosition = this.position.copy();

        this.velocity = createVector(0, 0);
        this.maxSpeed = 4.2;
        this.friction = 0.95;

        this.headSize = 28;
    }

    applyInput(inputVec) {
        this.velocity.add(inputVec);
        if (this.velocity.mag() > this.maxSpeed) this.velocity.setMag(this.maxSpeed);
    }

    // Updates movement and returns a stroke segment when it moved
    update() {
        this.velocity.mult(this.friction);
        if (this.velocity.mag() < 0.02) this.velocity.set(0, 0);

        this.prevPosition.set(this.position);

        this.position.add(this.velocity);
        this.position.x = constrain(this.position.x, 0, width);
        this.position.y = constrain(this.position.y, 0, height);

        const moved =
            this.prevPosition.x !== this.position.x ||
            this.prevPosition.y !== this.position.y;

        if (!moved) return null;

        return {
            x1: this.prevPosition.x,
            y1: this.prevPosition.y,
            x2: this.position.x,
            y2: this.position.y
        };
    }

    displayHead() {
        push();
        noStroke();
        fill(userRGBA[0], userRGBA[1], userRGBA[2], 85);
        circle(this.position.x, this.position.y, this.headSize);
        pop();
    }
}