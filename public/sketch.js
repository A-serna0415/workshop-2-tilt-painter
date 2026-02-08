let brush;
let askButton;

// Device motion vars (defined so handler won’t crash)
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
let brushWeight = 8;

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
  paintLayer.background(0, 75);

  userRGBA = [
    floor(random(0, 255)),
    floor(random(0, 255)),
    floor(random(0, 255)),
    255
  ];

  connectSocket();

  if (
    typeof DeviceMotionEvent?.requestPermission === "function" &&
    typeof DeviceOrientationEvent?.requestPermission === "function"
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
    // Non-iOS permission flow
    window.addEventListener("devicemotion", deviceMotionHandler, true);
    window.addEventListener("deviceorientation", deviceTurnedHandler, true);

    // Spawn immediately for non-iOS too
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
        // 1) Draw locally immediately (fixes lag + “trace stops” feel)
        const fullSeg = {
          ...seg,
          c: userRGBA,
          w: brushWeight,
          id: clientId
        };
        drawStrokeToLayer(fullSeg);

        // 2) Send to server for everyone else (RAM history + broadcast)
        sendStroke(fullSeg);
      }
    }

    // Always show head
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
      // Rebuild history (refresh-safe while server is awake)
      paintLayer.background(255);
      for (const s of msg.strokes) {
        // Skip strokes we already drew locally this session
        if (s.id && s.id === clientId) continue;
        drawStrokeToLayer(s);
      }
    }

    if (msg.t === "stroke" && msg.s) {
      const s = msg.s;
      if (s.id && s.id === clientId) return; // ignore our echo
      drawStrokeToLayer(s);
    }

    if (msg.t === "clear") {
      paintLayer.background(0, 75);
    }

    if (msg.t === "players") {
      playersOnline = msg.n || 1;
    }
  });

  socket.addEventListener("close", () => {
    // Basic auto-reconnect (keeps it robust on Render/mobile)
    setTimeout(connectSocket, 1000);
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
      askButton.html(`M:${motionRes} O:${orientRes}`);

      if (motionRes === "granted") {
        window.addEventListener("devicemotion", deviceMotionHandler, true);
      }
      if (orientRes === "granted") {
        window.addEventListener("deviceorientation", deviceTurnedHandler, true);
      }

      // Spawn brush as soon as permission is granted (your request)
      if (orientRes === "granted") {
        spawnBrush();
      }
    })
    .catch((err) => {
      askButton.html("Permission failed");
      console.error(err);
      alert("Permission error: " + (err?.message || err));
    });
}

function spawnBrush() {
  if (brush) return;
  brush = new Brush(width / 2, height / 2);
  isCalibrated = false; // will auto-calibrate on first orientation read
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
  push();
  noStroke();
  fill(0);
  textSize(24);
  textAlign(LEFT, TOP);

  const status = hasOrientation ? "OK" : "Waiting...";
  const cal = isCalibrated ? "Yes" : "No";
  const state = brush ? "Painting" : "Waiting permission";

  text(`State: ${state}`, 22, 20);
  text(`Players: ${playersOnline}`, 22, 44);
  text(`Orientation: ${status}  Calib: ${cal}`, 22, 68);
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);

  // Resizing wipes buffers, rebuild from server history
  paintLayer = createGraphics(width, height);
  paintLayer.background(0, 75);

  // Keep brush centered on resize (optional nice behavior)
  if (brush) {
    brush.position.set(width / 2, height / 2);
    brush.prevPosition.set(brush.position);
  }

  if (socket && socket.readyState === 1) socket.close();
}