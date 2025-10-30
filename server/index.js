const path = require('path');
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Room state: roomId -> { clients: Set<ws>, users: Map<ws, User>, strokes: Stroke[], lastSeen: Map<ws, number> }
const rooms = new Map();

function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      clients: new Set(),
      users: new Map(),
      strokes: [],
      lastSeen: new Map(),
    });
  }
  return rooms.get(roomId);
}

function broadcast(roomId, data, exceptWs = null) {
  const room = rooms.get(roomId);
  if (!room) return;
  const msg = JSON.stringify(data);
  for (const client of room.clients) {
    if (client.readyState === WebSocket.OPEN && client !== exceptWs) {
      client.send(msg);
    }
  }
}

function currentPresence(room) {
  return Array.from(room.users.values());
}

wss.on('connection', (ws) => {
  let roomId = null;

  function safeSend(obj) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj));
  }

  ws.on('message', (data) => {
    let msg;
    try { msg = JSON.parse(data.toString()); } catch { return; }

    if (msg.type === 'hello') {
      roomId = msg.room || 'lobby';
      const user = msg.user || { id: `u_${Math.random().toString(36).slice(2, 8)}`, name: 'anon', color: '#888' };
      const room = getOrCreateRoom(roomId);
      room.clients.add(ws);
      room.users.set(ws, user);
      room.lastSeen.set(ws, Date.now());

      // Send history to the new client
      safeSend({ type: 'history', strokes: room.strokes });
      // Broadcast presence update
      broadcast(roomId, { type: 'presence', users: currentPresence(room) });
    }

    if (!roomId) return; // ignore messages before hello

    const room = rooms.get(roomId);
    if (!room) return;

    room.lastSeen.set(ws, Date.now());

    if (msg.type === 'draw' && msg.stroke) {
      room.strokes.push(msg.stroke);
      broadcast(roomId, { type: 'draw', stroke: msg.stroke }, null);
    } else if (msg.type === 'clear') {
      room.strokes = [];
      broadcast(roomId, { type: 'clear', by: msg.by || null }, null);
    } else if (msg.type === 'ping') {
      safeSend({ type: 'pong' });
    }
  });

  ws.on('close', () => {
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room) return;
    room.clients.delete(ws);
    room.lastSeen.delete(ws);
    room.users.delete(ws);
    broadcast(roomId, { type: 'presence', users: currentPresence(room) });
  });
});

// Heartbeat cleanup
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms) {
    for (const ws of Array.from(room.clients)) {
      const last = room.lastSeen.get(ws) || 0;
      if (now - last > 30000) { // 30s idle
        try { ws.terminate(); } catch {}
        room.clients.delete(ws);
        room.lastSeen.delete(ws);
        room.users.delete(ws);
        broadcast(roomId, { type: 'presence', users: currentPresence(room) });
      }
    }
  }
}, 10000);

server.listen(PORT, () => {
  console.log(`Realtime whiteboard server listening on http://localhost:${PORT}`);
});
