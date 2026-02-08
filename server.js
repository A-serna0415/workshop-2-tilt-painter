import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static(path.join(__dirname, "public")));

// IMPORTANT: Render provides PORT
const PORT = process.env.PORT || 3000;

// Create HTTP server so WebSocket can share the same port
const server = http.createServer(app);

// RAM-only history: lasts while the server process stays alive
let strokes = [];

const wss = new WebSocketServer({ server });

function broadcast(obj) {
    const msg = JSON.stringify(obj);
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
    }
}

wss.on("connection", (ws) => {
    // Send all existing strokes to the new client
    ws.send(JSON.stringify({ t: "init", strokes }));

    // Notify everyone of current player count
    broadcast({ t: "players", n: wss.clients.size });

    ws.on("message", (raw) => {
        let msg;
        try {
            msg = JSON.parse(raw);
        } catch {
            return;
        }

        // Receive a stroke segment from a client
        if (msg.t === "stroke" && msg.s) {
            const s = msg.s;

            // Minimal validation (allow extra fields like s.id)
            const ok =
                typeof s.x1 === "number" &&
                typeof s.y1 === "number" &&
                typeof s.x2 === "number" &&
                typeof s.y2 === "number" &&
                typeof s.w === "number" &&
                Array.isArray(s.c) &&
                s.c.length === 4;

            if (!ok) return;

            strokes.push(s);
            broadcast({ t: "stroke", s });
            return;
        }

        // Optional: clear canvas for everyone
        if (msg.t === "clear") {
            strokes = [];
            broadcast({ t: "clear" });
            return;
        }
    });

    ws.on("close", () => {
        broadcast({ t: "players", n: wss.clients.size });
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});