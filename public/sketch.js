/* 
Workshop_02: Tilt Painter (Multiplayer)
By Andres Serna
*/

let brush;
let askButton;

// Device motion (keep defined so handler won't crash if used)
let accX = 0, accY = 0, accZ = 0;
let rrateX = 0, rrateY = 0, rrateZ = 0;

// Device orientation
let rotateDegrees = 0;
let frontToBack = 0;
let leftToRight = 0;

let hasOrientation = false;

// Calibration
let beta0 = 0;
let gamma0 = 0;
let isCalibrated = false;

// Input shaping
const DEADZONE_DEG = 3;
const MAX_TILT_DEG = 30;
const INPUT_GAIN = 0.12;

// Painting
let startedPainting = false;
let userRGBA;     // [r,g,b,a]
let brushWeight = 8;

// Persistent paint buffer
let paintLayer;

// Multiplayer
let socket = null;
let playersOnline = 1;

function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);

  // offscreen paint layer so strokes persist without background()
  paintLayer = createGraphics(width, height);
  paintLayer.background(255);

  // random per user/session color
  userRGBA = [
    floor(random(0, 255)),
    floor(random(0, 255)),
    floor(random(0, 255)),
    255
  ];

  connectSocket();

  if (
    typeof DeviceMotionEvent.requestPermission === "function" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    askButton = createButton("Enable Motion");
    askButton.position(width / 3, 16);
    askButton.style("font-size", "32px");
    askButton.style("padding", "37px 45px");

    askButton.mousePressed(handlePermissionButtonPressed);
    askButton.touchStarted(() => {
      handlePermissionButtonPressed();
      return false;
    });
  } else {
    window.addEventListener("devicemotion", deviceMotionHandler, true);
    window.addEventListener("deviceorientation", deviceTurnedHandler, true);
  }
}

function draw() {
  // draw the persistent paint layer
  image(paintLayer, 0, 0);

  // Move brush and send strokes (painting itself happens when server echoes back)
  if (brush && startedPainting) {
    if (hasOrientation) {
      if (!isCalibrated) calibrateTilt();

      const input = getTiltInputVector();
      brush.applyInput(input);
      brush.update(); // update position; will call sendStrokeSegment internally
    }

    brush.displayHead(); // show brush even if orientation not active yet
  }

  drawHUD();
}

function connectSocket() {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${protocol}://${location.host}`);

  socket.addEventListener("message", (ev) => {
    let msg;
    try { msg = JSON.parse(ev.data); } catch { return; }

    if (msg.t === "init" && Array.isArray(msg.strokes)) {
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
  if (!askButton) return;
  askButton.html("Requesting...");

  const motionPromise =
    typeof DeviceMotionEvent?.requestPermission === "function"
      ? DeviceMotionEvent.requestPermission()
      : Promise.resolve("not-needed");

  const orientPromise =
    typeof DeviceOrientationEvent?.requestPermission === "function"
      ? DeviceOrientationEvent.requestPermission()
      : Promise.resolve("not-needed");

  Promise.all([motionPromise, orientPromise])
    .then(([motionRes, orientRes]) => {
      askButton.html(`M:${motionRes} O:${orientRes}`);

      if (motionRes === "granted") {
        window.addEventListener("devicemotion", deviceMotionHandler, true);
      }
      if (orientRes === "granted") {
        window.addEventListener("deviceorientation", deviceTurnedHandler, true);
      }
    })
    .catch((err) => {
      askButton.html("Permission failed");
      console.error(err);
      alert("Permission error: " + (err?.message || err));
    });
}

// Device motion (not required for tilt painting, but safe)
function deviceMotionHandler(event) {
  if (event.acceleration) {
    accX = event.acceleration.x ?? 0;
    accY = event.acceleration.y ?? 0;
    accZ = event.acceleration.z ?? 0;
  }
  if (event.rotationRate) {
    rrateZ = event.rotationRate.alpha ?? 0;
    rrateX = event.rotationRate.beta ?? 0;
    rrateY = event.rotationRate.gamma ?? 0;
  }
}

function deviceTurnedHandler(event) {
  rotateDegrees = event.alpha ?? 0;
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

// Tap to start: spawn brush in CENTER (as requested)
function touchStarted() {
  startPainting();
  return false;
}

function mousePressed() {
  startPainting();
}

function startPainting() {
  if (!brush) {
    brush = new Brush(width / 2, height / 2);
    startedPainting = true;
    if (hasOrientation) calibrateTilt();
  } else {
    if (hasOrientation) calibrateTilt();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  // Resizing wipes buffers; rebuild from server history
  paintLayer = createGraphics(width, height);
  paintLayer.background(255);

  if (socket && socket.readyState === 1) socket.close();
  connectSocket();
}

function drawHUD() {
  push();
  noStroke();
  fill(0);
  textSize(24);
  textAlign(LEFT, TOP);

  const status = hasOrientation ? "OK" : "Waiting...";
  const cal = isCalibrated ? "Yes" : "No";
  const state = brush ? "Painting" : "Tap to start";

  text(`State: ${state}`, 22, 20);
  text(`Players: ${playersOnline}`, 22, 44);
  text(`Orientation: ${status}  Calib: ${cal}`, 22, 68);
  pop();
}