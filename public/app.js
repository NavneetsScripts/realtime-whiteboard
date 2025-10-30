(() => {
  const $ = (sel) => document.querySelector(sel);
  const canvas = $('#board');
  const colorInput = $('#color');
  const sizeInput = $('#size');
  const clearBtn = $('#clear');
  const shareBtn = $('#share');
  const roomInput = $('#room');
  const avatars = $('#avatars');
  const count = $('#count');

  const ctx = canvas.getContext('2d');
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(canvas.clientWidth * dpr);
    canvas.height = Math.floor(canvas.clientHeight * dpr);
    ctx.scale(dpr, dpr);
    redraw();
  }
  window.addEventListener('resize', resize);

  // Room from URL (?room=foo) else 'lobby'
  const url = new URL(window.location.href);
  const initialRoom = url.searchParams.get('room') || 'lobby';
  roomInput.value = initialRoom;

  // User info
  const user = {
    id: 'u_' + Math.random().toString(36).slice(2, 8),
    name: 'user-' + Math.random().toString(36).slice(2, 4),
    color: colorInput.value
  };

  // State
  let strokes = [];
  function redraw() {
    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
    for (const s of strokes) drawStroke(s);
  }

  function drawStroke(s) {
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.size;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.x0, s.y0);
    ctx.lineTo(s.x1, s.y1);
    ctx.stroke();
  }

  // WebSocket
  const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${wsProto}://${location.host}`);
  ws.addEventListener('open', () => {
    ws.send(JSON.stringify({ type: 'hello', room: roomInput.value, user }));
  });
  ws.addEventListener('message', (ev) => {
    let msg; try { msg = JSON.parse(ev.data); } catch { return; }
    if (msg.type === 'history' && Array.isArray(msg.strokes)) {
      strokes = msg.strokes;
      redraw();
    } else if (msg.type === 'draw' && msg.stroke) {
      strokes.push(msg.stroke);
      drawStroke(msg.stroke);
    } else if (msg.type === 'clear') {
      strokes = [];
      redraw();
    } else if (msg.type === 'presence' && Array.isArray(msg.users)) {
      count.textContent = String(msg.users.length);
      avatars.innerHTML = '';
      for (const u of msg.users) {
        const dot = document.createElement('div');
        dot.className = 'dot';
        dot.title = u.name;
        dot.style.background = u.color;
        avatars.appendChild(dot);
      }
    }
  });
  setInterval(() => ws.readyState === 1 && ws.send(JSON.stringify({ type: 'ping' })), 10000);

  // Drawing interaction
  let drawing = false;
  let last = null;

  function pos(e) {
    const rect = canvas.getBoundingClientRect();
    if (e.touches && e.touches[0]) e = e.touches[0];
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function sendSegment(a, b) {
    const stroke = { x0: a.x, y0: a.y, x1: b.x, y1: b.y, color: colorInput.value, size: Number(sizeInput.value) };
    strokes.push(stroke);
    drawStroke(stroke);
    ws.readyState === 1 && ws.send(JSON.stringify({ type: 'draw', stroke }));
  }

  canvas.addEventListener('mousedown', (e) => { drawing = true; last = pos(e); });
  canvas.addEventListener('mousemove', (e) => { if (!drawing) return; const p = pos(e); sendSegment(last, p); last = p; });
  window.addEventListener('mouseup', () => { drawing = false; last = null; });

  canvas.addEventListener('touchstart', (e) => { drawing = true; last = pos(e); e.preventDefault(); });
  canvas.addEventListener('touchmove', (e) => { if (!drawing) return; const p = pos(e); sendSegment(last, p); last = p; e.preventDefault(); });
  window.addEventListener('touchend', () => { drawing = false; last = null; });

  // Controls
  colorInput.addEventListener('change', () => { user.color = colorInput.value; });
  shareBtn.addEventListener('click', async () => {
    const link = `${location.origin}/?room=${encodeURIComponent(roomInput.value)}`;
    try { await navigator.clipboard.writeText(link); shareBtn.textContent = 'Link Copied!'; setTimeout(() => shareBtn.textContent = 'Copy Share Link', 1500); } catch {}
  });
  clearBtn.addEventListener('click', () => {
    ws.readyState === 1 && ws.send(JSON.stringify({ type: 'clear', by: user.id }));
  });

  // Initial layout
  requestAnimationFrame(resize);
})();
