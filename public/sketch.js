/* 
Workshop_02: Tilt Battle
By Andres Serna
Feb 6 2026
*/

let agent;
let askButton;

// Device motion (kept for later if you want it)
let accX = 0, accY = 0, accZ = 0;
let rrateX = 0, rrateY = 0, rrateZ = 0;

// Device orientation
let rotateDegrees = 0;
let frontToBack = 0;  // beta
let leftToRight = 0;  // gamma

// --- Tilt control settings ---
let hasOrientation = false;

// Calibration offsets (neutral phone angle)
let beta0 = 0;
let gamma0 = 0;
let isCalibrated = false;

// Input shaping
const DEADZONE_DEG = 3;      // ignore tiny jitters
const MAX_TILT_DEG = 30;     // clamp tilt to this range
const INPUT_GAIN = 0.12;     // acceleration strength (tweak feel)

function setup() {
  createCanvas(windowWidth, windowHeight);
  agent = new Agent(width / 2, height / 2);

  angleMode(DEGREES);

  if (
    typeof DeviceMotionEvent.requestPermission === "function" &&
    typeof DeviceOrientationEvent.requestPermission === "function"
  ) {
    // iOS 13+
    askButton = createButton("Enable Motion");
    askButton.position(16, 16);
    askButton.style("font-size", "18px");
    askButton.style("padding", "10px 14px");
    askButton.mousePressed(handlePermissionButtonPressed);
  } else {
    window.addEventListener("devicemotion", deviceMotionHandler, true);
    window.addEventListener("deviceorientation", deviceTurnedHandler, true);
  }
}

function draw() {
  background(210, 65);

  // Temporary obstacle (visual only for now)
  //rect(50, height / 2, 500, 20);

  // If we have orientation data, drive the agent
  if (hasOrientation) {
    if (!isCalibrated) {
      calibrateTilt(); // auto-calibrate once when data becomes available
    }

    const input = getTiltInputVector(); // p5.Vector
    agent.applyInput(input);            // acceleration-like input
  }

  agent.edgeAvoid(); // keep your current boundary behavior for now
  agent.update();

  drawHUD();
}

function handlePermissionButtonPressed() {
  // Motion permission (optional for later)
  DeviceMotionEvent.requestPermission()
    .then((response) => {
      if (response === "granted") {
        window.addEventListener("devicemotion", deviceMotionHandler, true);
      }
    });

  // Orientation permission (needed for tilt steering)
  DeviceOrientationEvent.requestPermission()
    .then((response) => {
      if (response === "granted") {
        window.addEventListener("deviceorientation", deviceTurnedHandler, true);
        // Once permission is granted, we’ll calibrate as soon as we receive data.
        if (askButton) askButton.html("Motion Enabled");
      }
    })
    .catch(console.error);
}

// https://developer.mozilla.org/en-US/docs/Web/API/Window/devicemotion_event
function deviceMotionHandler(event) {
  // acceleration may be null on some devices/browsers.
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

// https://developer.mozilla.org/en-US/docs/Web/API/Window/deviceorientation_event
function deviceTurnedHandler(event) {
  rotateDegrees = event.alpha ?? 0;
  frontToBack = event.beta ?? 0;   // beta: front/back tilt
  leftToRight = event.gamma ?? 0;  // gamma: left/right tilt
  hasOrientation = true;
}

function calibrateTilt() {
  beta0 = frontToBack;
  gamma0 = leftToRight;
  isCalibrated = true;
}

// Convert tilt angles to a small acceleration vector
function getTiltInputVector() {
  // tilt deltas from neutral
  let tiltY = frontToBack - beta0;   // forward/back
  let tiltX = leftToRight - gamma0;  // left/right

  // deadzone
  tiltX = applyDeadzone(tiltX, DEADZONE_DEG);
  tiltY = applyDeadzone(tiltY, DEADZONE_DEG);

  // clamp tilt
  tiltX = constrain(tiltX, -MAX_TILT_DEG, MAX_TILT_DEG);
  tiltY = constrain(tiltY, -MAX_TILT_DEG, MAX_TILT_DEG);

  // normalize to [-1, 1]
  const nx = tiltX / MAX_TILT_DEG;
  const ny = tiltY / MAX_TILT_DEG;

  // Map to 2D: phone tilt right moves agent right.
  // For y: tilting phone "forward" (positive beta) usually should move agent down or up depending on preference.
  // Here: tilt forward moves agent DOWN (increase y). Flip ny sign if you want the opposite.
  return createVector(nx, -ny).mult(INPUT_GAIN);
}

function applyDeadzone(v, dz) {
  return Math.abs(v) < dz ? 0 : v;
}

function drawHUD() {
  push();
  noStroke();
  fill(0, 150);
  rect(12, height - 86, 320, 74, 10);

  fill(255);
  textSize(14);
  textAlign(LEFT, TOP);

  const status = hasOrientation ? "OK" : "Waiting...";
  const cal = isCalibrated ? "Yes" : "No";
  text(`Orientation: ${status}`, 22, height - 78);
  text(`Calibrated: ${cal}  (tap screen to recalibrate)`, 22, height - 58);
  text(`beta: ${frontToBack.toFixed(1)}  gamma: ${leftToRight.toFixed(1)}`, 22, height - 38);
  pop();
}

// Tap anywhere to recalibrate quickly
function mousePressed() {
  if (hasOrientation) calibrateTilt();
}

// Screen responsive
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}