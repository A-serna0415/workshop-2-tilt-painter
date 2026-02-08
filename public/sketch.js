/* 
Workshop_02: Tilt Painter (Multiplayer)
By Andres Serna
Feb 6 2026
*/

let brush;
let askButton;

// Device motion vars (safe to keep)
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
let userRGBA;          // [r,g,b,a]
let brushWeight = 20;  // thicker default

// Persistent paint buffer
let paintLayer;

// Multiplayer
let socket = null;
let playersOnline = 1;

// Identify this client so we can ignore our own echoed strokes
let clientId = Math.random().toString(16).slice(2);

function setup() {
  createCanvas(windowWidth, windowHeight);
  angleMode(DEGREES);

  paintLayer = createGraphics(width, height);
  paintLayer.background(0); // black background like your screenshot

  userRGBA = [
    floor(random(0, 255)),
    floor(random(0, 255)),
    floor(random(0, 255)),
    255
  ];

  connectSocket();

  // iOS permission flow
  if (
    typeof DeviceMotionEvent?.requestPermission === "function" &&
    typeof DeviceOrientationEvent?.requestPermission === "function"
  ) {
    askButton = createButton("Enable Motion");

    // Style a button
    askButton.style("font-size", "22px");
    askButton.style("padding", "18px 22px");
    askButton.style("background", "#eee");
    askButton.style("border", "none");
    askButton.style("border-radius", "12px");

    // place top-right
    positionButtonTopRight();

    askButton.mousePressed(handlePermissionButtonPressed);
    askButton.touchStarted(() => {
      handlePermissionButtonPressed();
      return false;
    });
  } else {
    // Non-iOS (no permission prompt)
    window.addEventListener("devicemotion", deviceMotionHandler, true);
    window.addEventListener("deviceorientation", deviceTurnedHandler, true);
    spawnBrush();
  }
}

function draw() {
  image(paintLayer, 0, 0);

  if (brush) {
    if (hasOrientation) {
      if (!isCalibrated) calibrateTilt();

      brush.applyInput(getTiltInputVector());
      const seg = brush.update();

      if (seg) {
        // Draw locally instantly (no lag)
        const fullSeg = {
          ...seg,
          c: userRGBA,
          w: brushWeight,
          id: clientId
        };
        drawStrokeToLayer(fullSeg);

        // Send to server for others + history
        sendStroke(fullSeg);
      }
    }

    brush.displayHead();
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
      // rebuild from server history (while server is awake)
      paintLayer.background(0);
      for (const s of msg.strokes) {
        if (s.id && s.id === clientId) continue; // skip our own history
        drawStrokeToLayer(s);
      }
    }

    if (msg.t === "stroke" && msg.s) {
      const s = msg.s;
      if (s.id && s.id === clientId) return; // ignore our echo
      drawStrokeToLayer(s);
    }

    if (msg.t === "clear") {
      paintLayer.background(0);
    }

    if (msg.t === "players") {
      playersOnline = msg.n || 1;
    }
  });

  socket.addEventListener("close", () => {
    // auto reconnect
    setTimeout(connectSocket, 800);
  });
}

function sendStroke(seg) {
  if (!socket || socket.readyState !== 1) return;
  socket.send(JSON.stringify({ t: "stroke", s: seg }));
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
      if (motionRes === "granted") {
        window.addEventListener("devicemotion", deviceMotionHandler, true);
      }
      if (orientRes === "granted") {
        window.addEventListener("deviceorientation", deviceTurnedHandler, true);

        // Your requested behavior:
        askButton.html("Motion On");
        askButton.attribute("disabled", "");
        spawnBrush();
      } else {
        askButton.html("Enable Motion");
      }
    })
    .catch((err) => {
      askButton.html("Enable Motion");
      console.error(err);
      alert("Permission error: " + (err?.message || err));
    });
}

function spawnBrush() {
  if (brush) return;
  brush = new Brush(width / 2, height / 2);
  isCalibrated = false;
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

function drawHUD() {
  // Only 2 lines, left aligned
  push();
  fill(255);
  noStroke();
  textSize(28);
  textAlign(LEFT, TOP);

  const state = brush ? "Painting" : "Waiting";
  text(`State: ${state}`, 22, 20);
  text(`Painters: ${playersOnline}`, 22, 60);
  pop();

  // keep button pinned top-right
  positionButtonTopRight();
}

function positionButtonTopRight() {
  if (!askButton) return;
  const w = askButton.size().width || 200;
  askButton.position(width - w - 22, 16);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  // recreate layer and rely on server init to refill it
  paintLayer = createGraphics(width, height);
  paintLayer.background(0);

  // keep brush centered if it exists
  if (brush) {
    brush.position.set(width / 2, height / 2);
    brush.prevPosition.set(brush.position);
  }

  // reposition button
  positionButtonTopRight();
}