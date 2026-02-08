/* 
Workshop_02: Tilt Painter
By Andres Serna
Feb 6 2026
*/

let agent;
let askButton;

// // Device motion (kept, not essential for this version)
// let accX = 0, accY = 0, accZ = 0;
// let rrateX = 0, rrateY = 0, rrateZ = 0;

// Device orientation
let rotateDegrees = 0;
let frontToBack = 0; // beta
let leftToRight = 0; // gamma

// --- Tilt control state ---
let hasOrientation = false;

// Calibration offsets (neutral phone angle)
let beta0 = 0;
let gamma0 = 0;
let isCalibrated = false;

// Input shaping
const DEADZONE_DEG = 3;
const MAX_TILT_DEG = 30;
const INPUT_GAIN = 0.12;

// Painting logic
let startedPainting = false;
let userColor;

function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);

  // Random color per user/device/session
  userColor = color(random(0, 255), random(0, 255), random(0, 255), 255);

  // Start with a blank canvas ONCE
  background(255);

  if (
    typeof DeviceMotionEvent.requestPermission === "function" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    askButton = createButton("Enable Motion");
    askButton.position(width / 3, 16);
    askButton.style("font-size", "32px");
    askButton.style("padding", "37px 45px");
    askButton.mousePressed(handlePermissionButtonPressed);
  } else {
    window.addEventListener("devicemotion", deviceMotionHandler, true);
    window.addEventListener("deviceorientation", deviceTurnedHandler, true);
  }
}

function draw() {
  // IMPORTANT: no background() here, so trails persist.

  // If the agent exists and painting started, drive it with tilt
  if (agent && startedPainting && hasOrientation) {
    if (!isCalibrated) calibrateTilt();

    const input = getTiltInputVector();
    agent.applyInput(input);
    agent.updateAndPaint(); // moves + draws the trail
  }

  drawHUD();
}

function handlePermissionButtonPressed() {
  DeviceMotionEvent.requestPermission()
    .then((response) => {
      if (response === "granted") {
        window.addEventListener("devicemotion", deviceMotionHandler, true);
      }
    })
    .catch(console.error);

  DeviceOrientationEvent.requestPermission()
    .then((response) => {
      if (response === "granted") {
        window.addEventListener("deviceorientation", deviceTurnedHandler, true);
        if (askButton) askButton.html("Motion ON");
      }
    })
    .catch(console.error);
}

// Device motion
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

// Device orientation
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

// Convert tilt angles to a small acceleration vector
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

// Touch to spawn/start painting
function touchStarted() {
  // Create agent on first touch
  if (!agent) {
    agent = new Agent(touchX, touchY, userColor);
    startedPainting = true;

    // Calibrate when user "starts" so neutral feels natural
    if (hasOrientation) calibrateTilt();
  } else {
    // If already painting, a tap re-calibrates
    if (hasOrientation) calibrateTilt();
  }

  // Prevent page scroll on mobile
  return false;
}

// Optional: if you click with mouse on desktop
function mousePressed() {
  if (!agent) {
    agent = new Agent(mouseX, mouseY, userColor);
    startedPainting = true;
    if (hasOrientation) calibrateTilt();
  } else {
    if (hasOrientation) calibrateTilt();
  }
}

function drawHUD() {
  // Small overlay without clearing canvas: draw over it each frame
  push();
  noStroke();
  // fill(0, 140);
  // rect(12, 12, 340, 88, 10);

  fill(0);
  textSize(24);
  textAlign(LEFT, TOP);

  const status = hasOrientation ? "OK" : "Waiting...";
  const cal = isCalibrated ? "Yes" : "No";
  const state = agent ? "Painting" : "Tap to start";
  text(`State: ${state}`, 22, 20);
  text(`Orientation: ${status}   Calibrated: ${cal}`, 22, 40);
  text(`beta: ${frontToBack.toFixed(1)}  gamma: ${leftToRight.toFixed(1)}`, 22, 60);
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}