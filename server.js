import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import WebSocket, { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.static(path.join(__dirname, "public")));

// Create HTTP server so ws can share the same port
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;

// In-memory history of stroke segments (exists only while server is alive)
let strokes = [];

// WebSocket server
const wss = new WebSocketServer({ server });

function broadcast(obj) {
    const msg = JSON.stringify(obj);
    for (const client of wss.clients) {
        if (client.readyState === WebSocket.OPEN) client.send(msg);
    }
}

wss.on("connection", (ws) => {
    // Send current history to the newly connected client
    ws.send(JSON.stringify({ t: "init", strokes }));

    // Broadcast player count
    broadcast({ t: "players", n: wss.clients.size });

    ws.on("message", (raw) => {
        let msg;
        try { msg = JSON.parse(raw); } catch { return; }

        // Receive stroke segment from a client
        if (msg.t === "stroke" && msg.s) {
            const s = msg.s;

            // Tiny validation so random junk doesn't crash your server
            if (
                typeof s.x1 !== "number" || typeof s.y1 !== "number" ||
                typeof s.x2 !== "number" || typeof s.y2 !== "number" ||
                typeof s.w !== "number" ||
                !Array.isArray(s.c) || s.c.length !== 4
            ) return;

            strokes.push(s);
            broadcast({ t: "stroke", s });
        }

        // Optional clear (handy for demos)
        if (msg.t === "clear") {
            strokes = [];
            broadcast({ t: "clear" });
        }
    });

    ws.on("close", () => {
        broadcast({ t: "players", n: wss.clients.size });
    });
});

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
});