// Agent class

class Agent {
    constructor(x, y) {
        this.position = createVector(x, y);

        // Start still (tilt will drive it)
        this.velocity = createVector(0, 0);

        this.maxSpeed = 3.5;
        this.baseSize = 45;

        // Movement feel
        this.friction = 0.92;  // closer to 1 = more slippery
    }

    applyInput(inputVec) {
        // inputVec is a small acceleration-like vector
        this.velocity.add(inputVec);

        // cap speed
        if (this.velocity.mag() > this.maxSpeed) {
            this.velocity.setMag(this.maxSpeed);
        }
    }

    update() {
        // apply friction so it slows when you stop tilting
        this.velocity.mult(this.friction);

        // tiny cutoff so it can fully stop
        if (this.velocity.mag() < 0.02) this.velocity.set(0, 0);

        // move
        this.position.add(this.velocity);

        this.display();
    }

    display() {
        push();
        translate(this.position.x, this.position.y);
        fill(0);
        stroke(255);
        strokeWeight(3);
        ellipse(0, 0, this.baseSize, this.baseSize);
        pop();
    }

    edgeAvoid() {
        // Same as your baseline bounce behavior
        if (this.position.x < 20 || this.position.x > width - 20) {
            this.velocity.x *= -1;
        }
        if (this.position.y < 20 || this.position.y > height - 20) {
            this.velocity.y *= -1;
        }
    }
}