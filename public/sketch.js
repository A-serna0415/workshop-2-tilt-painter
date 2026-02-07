let agent;
let askButton;

// orientation
let frontToBack = 0;
let leftToRight = 0;
let hasOrientation = false;

// calibration
let beta0 = 0;
let gamma0 = 0;
let isCalibrated = false;

// input shaping
const DEADZONE_DEG = 3;
const MAX_TILT_DEG = 30;
const INPUT_GAIN = 0.12;

// painting
let startedPainting = false;
let userColor;          // [r,g,b,a]
let brushWeight = 8;

// persistence layer
let paintLayer;

// multiplayer
let socket = null;
let playersOnline = 1;

function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);

  // offscreen buffer that holds the “forever” painting
  paintLayer = createGraphics(width, height);
  paintLayer.background(255);

  // per-user random color (stays for their session)
  userColor = [
    floor(random(40, 255)),
    floor(random(40, 255)),
    floor(random(40, 255)),
    220
  ];

  connectSocket();

  if (
    typeof DeviceMotionEvent.requestPermission === "function" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    askButton = createButton("Enable Motion");
    askButton.position(width / 3, 16);
    askButton.style("font-size", "45px");
    askButton.style("padding", "32px 48px");
    askButton.mousePressed(handlePermissionButtonPressed);
  } else {
    window.addEventListener("deviceorientation", deviceTurnedHandler, true);
  }
}

function draw() {
  // draw the persistent layer (no clearing)
  image(paintLayer, 0, 0);

  if (agent && startedPainting && hasOrientation) {
    if (!isCalibrated) calibrateTilt();
    agent.applyInput(getTiltInputVector());
    agent.update(); // movement only (painting is sent via socket)
  }

  // draw agent head on top
  if (agent && startedPainting) agent.displayHead();

  drawHUD();
}

function connectSocket() {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${protocol}://${location.host}`);

  socket.addEventListener("open", () => {
    // connected
  });

  socket.addEventListener("message", (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }

    if (msg.t === "init" && Array.isArray(msg.strokes)) {
      // redraw entire history into paintLayer
      paintLayer.background(255);
      for (const s of msg.strokes) drawStrokeToLayer(s);
    }

    if (msg.t === "stroke" && msg.s) {
      drawStrokeToLayer(msg.s);
    }

    if (msg.t === "clear") {
      paintLayer.background(255);
    }

    if (msg.t === "players") {
      playersOnline = msg.n || 1;
    }
  });
}

function drawStrokeToLayer(s) {
  paintLayer.push();
  paintLayer.stroke(s.c[0], s.c[1], s.c[2], s.c[3]);
  paintLayer.strokeWeight(s.w);
  paintLayer.strokeCap(ROUND);
  paintLayer.line(s.x1, s.y1, s.x2, s.y2);
  paintLayer.pop();
}

function handlePermissionButtonPressed() {
  DeviceOrientationEvent.requestPermission()
    .then((response) => {
      if (response === "granted") {
        window.addEventListener("deviceorientation", deviceTurnedHandler, true);
        if (askButton) askButton.html("Motion Enabled");
      }
    })
    .catch(console.error);
}

function deviceTurnedHandler(event) {
  frontToBack = event.beta ?? 0;
  leftToRight = event.gamma ?? 0;
  hasOrientation = true;
}

function calibrateTilt() {
  beta0 = frontToBack;
  gamma0 = leftToRight;
  isCalibrated = true;
}

function getTiltInputVector() {
  let tiltY = frontToBack - beta0;
  let tiltX = leftToRight - gamma0;

  tiltX = applyDeadzone(tiltX, DEADZONE_DEG);
  tiltY = applyDeadzone(tiltY, DEADZONE_DEG);

  tiltX = constrain(tiltX, -MAX_TILT_DEG, MAX_TILT_DEG);
  tiltY = constrain(tiltY, -MAX_TILT_DEG, MAX_TILT_DEG);

  const nx = tiltX / MAX_TILT_DEG;
  const ny = tiltY / MAX_TILT_DEG;

  return createVector(nx, ny).mult(INPUT_GAIN);
}

function applyDeadzone(v, dz) {
  return Math.abs(v) < dz ? 0 : v;
}

// Start painting: agent appears in the CENTER (your request)
function touchStarted() {
  if (!agent) {
    agent = new Agent(width / 2, height / 2);
    startedPainting = true;
    if (hasOrientation) calibrateTilt();
  } else {
    if (hasOrientation) calibrateTilt();
  }
  return false;
}

function mousePressed() {
  if (!agent) {
    agent = new Agent(width / 2, height / 2);
    startedPainting = true;
    if (hasOrientation) calibrateTilt();
  } else {
    if (hasOrientation) calibrateTilt();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  // NOTE: resizing a persistent canvas is tricky because it wipes buffers.
  // Keep it simple: recreate layer and request full init again.
  paintLayer = createGraphics(width, height);
  paintLayer.background(255);
  if (socket && socket.readyState === 1) {
    // force re-init by reconnecting
    socket.close();
  }
  connectSocket();
}

function drawHUD() {
  push();
  noStroke();
  fill(0, 140);
  rect(12, 12, 360, 108, 10);

  fill(255);
  textSize(14);
  textAlign(LEFT, TOP);

  const state = agent ? "Painting" : "Tap to start (spawns center)";
  text(`State: ${state}`, 22, 20);
  text(`Players online: ${playersOnline}`, 22, 40);
  text(`beta: ${frontToBack.toFixed(1)}  gamma: ${leftToRight.toFixed(1)}`, 22, 60);
  text(`Color: rgba(${userColor.join(",")})`, 22, 80);
  pop();
}