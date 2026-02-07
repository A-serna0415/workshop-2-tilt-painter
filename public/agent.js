class Agent {
    constructor(x, y) {
        this.position = createVector(x, y);
        this.prevPosition = this.position.copy();

        this.velocity = createVector(0, 0);
        this.maxSpeed = 3.5;
        this.friction = 0.92;

        this.headSize = 18;
    }

    applyInput(inputVec) {
        this.velocity.add(inputVec);
        if (this.velocity.mag() > this.maxSpeed) this.velocity.setMag(this.maxSpeed);
    }

    update() {
        this.velocity.mult(this.friction);
        if (this.velocity.mag() < 0.02) this.velocity.set(0, 0);

        this.prevPosition.set(this.position);

        this.position.add(this.velocity);
        this.position.x = constrain(this.position.x, 0, width);
        this.position.y = constrain(this.position.y, 0, height);

        // Only send a stroke if it actually moved
        if (this.prevPosition.x !== this.position.x || this.prevPosition.y !== this.position.y) {
            sendStrokeSegment(this.prevPosition, this.position);
        }
    }

    displayHead() {
        push();
        noStroke();
        fill(0, 40);
        circle(this.position.x, this.position.y, this.headSize);
        pop();
    }
}

// helper used by Agent (lives in global scope)
function sendStrokeSegment(p1, p2) {
    if (!socket || socket.readyState !== 1) return;

    const seg = {
        x1: p1.x, y1: p1.y,
        x2: p2.x, y2: p2.y,
        c: userColor,
        w: brushWeight
    };

    socket.send(JSON.stringify({ t: "stroke", s: seg }));
}