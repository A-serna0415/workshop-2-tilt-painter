/* 
Workshop_02: Tilt Painter
By Andres Serna
Feb 6 2026
*/

let brush;
let askButton;

// Device motion
let accX = 0, accY = 0, accZ = 0;
let rrateX = 0, rrateY = 0, rrateZ = 0;

// Device orientation
let rotateDegrees = 0;
let frontToBack = 0; // beta
let leftToRight = 0; // gamma

let hasOrientation = false;

// Calibration offsets
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

  userColor = color(random(0, 255), random(0, 255), random(0, 255), 255);

  // Blank canvas once
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

    // iOS sometimes ignores mousePressed for DOM buttons. Force touch binding too:
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
  // no background() so drawing persists

  if (brush && startedPainting && hasOrientation) {
    if (!isCalibrated) calibrateTilt();

    const input = getTiltInputVector();
    brush.applyInput(input);
    brush.updateAndPaint();
  }

  drawHUD();
}

function handlePermissionButtonPressed() {
  if (!askButton) return;

  // Prove the handler is firing
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
      // Show the results on the button so you can’t miss it
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

function touchStarted() {
  if (!brush) {
    // spawn in center (your request)
    brush = new Brush(width / 2, height / 2, userColor);
    startedPainting = true;

    if (hasOrientation) calibrateTilt();
  } else {
    if (hasOrientation) calibrateTilt();
  }
  return false;
}

function mousePressed() {
  if (!brush) {
    brush = new Brush(width / 2, height / 2, userColor);
    startedPainting = true;

    if (hasOrientation) calibrateTilt();
  } else {
    if (hasOrientation) calibrateTilt();
  }
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
  text(`Orientation: ${status}   Calibrated: ${cal}`, 22, 40);
  text(`beta: ${frontToBack.toFixed(1)}  gamma: ${leftToRight.toFixed(1)}`, 22, 60);
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}