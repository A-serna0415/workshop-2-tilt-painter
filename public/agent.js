// Agent class (as a brush)

class Agent {
    constructor(x, y, brushColor) {
        this.position = createVector(x, y);
        this.prevPosition = this.position.copy();

        this.velocity = createVector(0, 0);
        this.maxSpeed = 3.5;

        this.friction = 0.92;

        this.baseSize = 18; // smaller feels more like a brush head
        this.brushColor = brushColor;

        this.brushWeight = 8;
    }

    applyInput(inputVec) {
        this.velocity.add(inputVec);

        if (this.velocity.mag() > this.maxSpeed) {
            this.velocity.setMag(this.maxSpeed);
        }
    }

    updateAndPaint() {
        this.velocity.mult(this.friction);
        if (this.velocity.mag() < 0.02) this.velocity.set(0, 0);

        this.prevPosition.set(this.position);
        this.position.add(this.velocity);

        // keep inside canvas (painting feels better than bouncing)
        this.position.x = constrain(this.position.x, 0, width);
        this.position.y = constrain(this.position.y, 0, height);

        this.paint();
        this.displayHead();
    }

    paint() {
        push();
        stroke(this.brushColor);
        strokeWeight(this.brushWeight);
        strokeCap(ROUND);
        line(this.prevPosition.x, this.prevPosition.y, this.position.x, this.position.y);
        pop();
    }

    displayHead() {
        push();
        noStroke();
        fill(0, 40);
        circle(this.position.x, this.position.y, this.baseSize);
        pop();
    }
}