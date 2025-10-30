# Realtime Whiteboard

Collaborative whiteboard where multiple users can draw together and see updates in real time via WebSockets. Includes presence indicators, board sharing (rooms), and clear/reset.

## Features
- Real-time drawing sync across connected clients
- Presence: show connected users and colors
- Room-based boards to share a specific whiteboard via URL
- Clear/reset board for everyone
- Simple Node.js server + vanilla JS frontend (no build step)

## Tech
- Backend: Node.js, Express (static files), ws (WebSocket server)
- Frontend: HTML5 Canvas + vanilla JS

## Getting Started
1. Install Node.js 18+
2. Install dependencies:
   ```pwsh
   npm install
   ```
3. Run the server:
   ```pwsh
   npm start
   ```
4. Open http://localhost:3000 in your browser.

Environment variables:
- `PORT` (default: 3000)

## Design Overview
- The server keeps in-memory state per room: connected users and the stroke history.
- Clients send `hello` with room + user info, receive history and presence.
- Drawing emits `draw` events; server broadcasts to all clients in the same room.
- `clear` resets the room history and notifies clients to clear canvases.
- Presence list updates on join/leave and via heartbeat.

### Message Types
- `hello`: { room, user: { id, name, color } }
- `history`: { strokes: Stroke[] }
- `presence`: { users: User[] }
- `draw`: { stroke: Stroke }
- `clear`: { by: string }
- `ping` / `pong`: heartbeat

Where `Stroke = { x0, y0, x1, y1, color, size }` and `User = { id, name, color }`.

## Extend / Game Modes
- Multiple tools: lines, rectangles, text, images
- Undo/redo with per-user history
- Rooms protected by passcodes or invitations
- Persistence: store history in Redis or Postgres; snapshots via PNG export
- Cursors: broadcast live pointer positions for all users
- Game modes: Pictionary/Draw & Guess, collaborative puzzles
- Moderation: owner can lock the board, kick users, or limit tools

## Notes
- This prototype stores everything in memory; restart clears all rooms.
- For production, add persistence and authentication.
