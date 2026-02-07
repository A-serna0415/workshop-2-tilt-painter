import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import fs from "fs";
import WebSocket, { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// --- Static hosting ---
app.use(express.static(path.join(__dirname, "public")));

// --- HTTP server (needed so ws can hook into it) ---
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// --- Persistence (JSON lines) ---
const DATA_DIR = path.join(__dirname, "data");
const STROKES_PATH = path.join(DATA_DIR, "strokes.jsonl");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// In-memory history (fast broadcast + init)
let strokes = [];

// Load existing history on boot
if (fs.existsSync(STROKES_PATH)) {
    const lines = fs.readFileSync(STROKES_PATH, "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
        try {
            strokes.push(JSON.parse(line));
        } catch {
            // ignore bad lines
        }
    }
}

function appendStrokeToDisk(stroke) {
    // append one JSON line
    fs.appendFile(STROKES_PATH, JSON.stringify(stroke) + "\n", () => { });
}

// --- WebSocket server ---
const wss = new WebSocketServer({ server });

function broadcast(obj) {
    const msg = JSON.stringify(obj);
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
    }
}

wss.on("connection", (ws) => {
    // Send full history to new client
    ws.send(JSON.stringify({ t: "init", strokes }));

    // Broadcast player count
    broadcast({ t: "players", n: wss.clients.size });

    ws.on("message", (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw);
        } catch {
            return;
        }

        // Expect stroke segment packets
        if (msg.t === "stroke" && msg.s) {
            const s = msg.s;

            // Minimal validation
            if (
                typeof s.x1 !== "number" || typeof s.y1 !== "number" ||
                typeof s.x2 !== "number" || typeof s.y2 !== "number" ||
                typeof s.w !== "number" || !Array.isArray(s.c)
            ) return;

            strokes.push(s);
            appendStrokeToDisk(s);

            // Broadcast this stroke segment to everyone (including sender)
            broadcast({ t: "stroke", s });
        }

        // Optional: clear command
        if (msg.t === "clear") {
            strokes = [];
            fs.writeFile(STROKES_PATH, "", () => { });
            broadcast({ t: "clear" });
        }
    });

    ws.on("close", () => {
        broadcast({ t: "players", n: wss.clients.size });
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Loaded strokes: ${strokes.length}`);
});