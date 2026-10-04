import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { networkInterfaces } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';

const root = path.dirname(fileURLToPath(import.meta.url));
const publicFiles = ['index.html', 'controller.html', 'controller.css', 'display.html', 'style.css', 'connection.js', 'controller.js', 'display.js', 'InstallationUniverse.js', 'mirror.js', 'touches.js', 'fullscreen.js'];
const sharedFiles = ['patterns.js', 'AnimationManager.js', 'BinaryPatternUniverse.js'];
const validPattern = p => Array.isArray(p) && p.length === 7 && p.every(
  row => Array.isArray(row) && row.length === 7 && row.every(cell => cell === 0 || cell === 1));

export function createInstallationServer() {
  const clients = new Map();
  const epoch = randomUUID();
  let draft = Array.from({ length: 7 }, () => Array(7).fill(1));
  let revision = 0;
  let flight = null;
  let view = null;
  let display = null;
  let primaryDisplay = null;
  let sequence = 0;
  const flightActive = () => flight && (display?.flightId !== flight.id || display?.status !== 'arrived');
  const snapshot = () => ({ epoch, draft, revision, flight, view, display,
    displayOwnerId: clients.get(primaryDisplay)?.id ?? null,
    controllers: [...clients.values()].filter(c => c.role === 'controller').length });
  function send(socket, value) {
    if (socket.readyState !== WebSocket.OPEN) return;
    // Drop a stalled connection instead of accumulating obsolete camera frames.
    if (socket.bufferedAmount > 256 * 1024) return socket.terminate();
    socket.send(JSON.stringify(value));
  }
  function broadcast() {
    const state = snapshot();
    for (const socket of clients.keys()) send(socket, { type: 'state', state });
  }
  function broadcastTouches(clientId, points) {
    for (const [socket, client] of clients) {
      if (client.role === 'display') send(socket, { type: 'touches', clientId, points });
    }
  }
  function remove(socket) {
    const client = clients.get(socket);
    if (!client) return;
    clients.delete(socket);
    if (client.role === 'controller') broadcastTouches(client.id, []);
    if (socket === primaryDisplay) {
      primaryDisplay = [...clients.keys()].reverse().find(ws => clients.get(ws).role === 'display') ?? null;
      display = primaryDisplay ? { ready: false, status: 'Starting display', flightId: null } : null;
    }
    socket.terminate();
    broadcast();
  }
  const json = (res, status, data) => {
    res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(data));
  };
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (req.method !== 'GET') return json(res, 405, { error: 'Method not allowed' });
      if (url.pathname === '/api/network') {
        const port = server.address().port;
        const addresses = Object.values(networkInterfaces()).flat().filter(a => a && a.family === 'IPv4' && !a.internal);
        return json(res, 200, { urls: addresses.map(a => `http://${a.address}:${port}`) });
      }
      const name = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      let filename;
      if (publicFiles.includes(name)) filename = path.join(root, 'public', name);
      if (name.startsWith('shared/') && sharedFiles.includes(name.slice(7))) filename = path.join(root, '..', 'libs', name.slice(7));
      if (!filename) return json(res, 404, { error: 'Not found' });
      const data = await readFile(filename);
      const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[path.extname(filename)];
      res.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
      res.end(data);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) json(res, 500, { error: 'Server error' });
      else res.end();
    }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8192, perMessageDeflate: false });
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    const role = url.searchParams.get('role');
    const reject = code => { socket.end(`HTTP/1.1 ${code} Rejected\r\nConnection: close\r\n\r\n`); };
    if (req.headers.origin !== `http://${req.headers.host}`) return reject(403);
    if (url.pathname !== '/socket' || !['controller', 'display'].includes(role)) return reject(400);
    wss.handleUpgrade(req, socket, head, ws => wss.emit('connection', ws, role));
  });
  wss.on('connection', (socket, role) => {
    const client = { id: randomUUID(), role, lastSeen: Date.now() };
    clients.set(socket, client);
    if (role === 'display') {
      primaryDisplay = socket;
      display = { ready: false, status: 'Starting display', flightId: null };
    }
    socket.on('close', () => remove(socket));
    socket.on('error', () => remove(socket));
    socket.on('message', (data, binary) => {
      let message;
      try { if (binary) throw new Error(); message = JSON.parse(data.toString()); }
      catch { send(socket, { type: 'error', error: 'Expected a JSON message' }); return; }
      if (!message || !Number.isSafeInteger(message.requestId)) return;
      const reply = (status, payload) => send(socket, { type: 'ack', requestId: message.requestId, status, ...payload });
      client.lastSeen = Date.now();
      if (message.type === 'heartbeat') return reply(200, { ok: true });
      if (client.role === 'controller' && message.type === 'touch') {
        if (!Array.isArray(message.points) || message.points.length > 10 || !message.points.every(point =>
          point && ['x', 'y'].every(key => Number.isFinite(point[key]) && point[key] >= 0 && point[key] <= 1))) {
          return reply(400, { error: 'Invalid touch positions' });
        }
        broadcastTouches(client.id, message.points.map(({ x, y }) => ({ x, y })));
        return reply(200, { ok: true });
      }
      if (client.role === 'controller' && ['draft', 'find'].includes(message.type)) {
        if (!validPattern(message.pattern)) return reply(400, { error: 'Expected a binary 7×7 pattern' });
        if (message.type === 'find' && !display?.ready) return reply(409, { error: 'Wait for the display to connect' });
        if (message.type === 'find' && flightActive()) return reply(409, { error: 'Wait for the flight to finish' });
        draft = message.pattern;
        revision++;
        if (message.type === 'find') {
          view = null;
          flight = { id: ++sequence, pattern: draft };
        }
      } else if (client.role === 'controller' && message.type === 'navigate') {
        const v = message.view;
        if (!v || !['x', 'y', 'zoom'].every(key => Number.isFinite(v[key])) ||
            Math.abs(v.x) > 2 ** 31 || Math.abs(v.y) > 2 ** 31 || v.zoom < 0.3 || v.zoom > 20) {
          return reply(400, { error: 'Invalid camera position' });
        }
        if (!display?.ready) return reply(409, { error: 'Wait for the display to connect' });
        if (flightActive()) return reply(409, { error: 'Wait for the flight to finish' });
        flight = null;
        view = { id: ++sequence, x: v.x, y: v.y, zoom: v.zoom };
      } else if (client.role === 'display' && message.type === 'telemetry') {
        // Every display receives commands; only the newest connection reports
        // the camera used by the iPad mirror. Older tabs cannot overwrite it.
        if (socket !== primaryDisplay) return reply(200, { ok: true, ignored: true });
        const t = message.telemetry;
        if (!t || typeof t.ready !== 'boolean' || !['ready', 'flying', 'arrived', 'error'].includes(t.status) ||
            !(t.flightId === null || Number.isSafeInteger(t.flightId)) ||
            !Number.isSafeInteger(t.actionId) || t.actionId < 0 || t.actionId > sequence ||
            !['x', 'y', 'zoom', 'cameraX', 'cameraY', 'width', 'height'].every(key => Number.isFinite(t[key])) ||
            t.width <= 0 || t.height <= 0 || t.width > 16384 || t.height > 16384) {
          return reply(400, { error: 'Invalid display status' });
        }
        // An in-flight acknowledgement must not roll the mirror back after a newer gesture.
        if (t.actionId < sequence) return reply(200, { ok: true, actionId: sequence });
        if (t.flightId !== (flight?.id ?? null)) return reply(400, { error: 'Invalid flight acknowledgement' });
        display = { ready: t.ready, status: t.status, flightId: t.flightId, actionId: t.actionId,
          x: t.x, y: t.y, zoom: t.zoom, cameraX: t.cameraX, cameraY: t.cameraY, width: t.width, height: t.height };
      } else return reply(403, { error: 'Message not allowed for this device' });
      broadcast();
      reply(200, { ok: true, actionId: sequence });
    });
    send(socket, { type: 'session', clientId: client.id });
    broadcast();
  });
  const timer = setInterval(() => {
    for (const [socket, c] of clients) if (Date.now() - c.lastSeen > 10000) remove(socket);
  }, 2000);
  timer.unref();
  server.on('close', () => clearInterval(timer));
  server.shutdown = () => {
    clearInterval(timer);
    for (const socket of [...clients.keys()]) remove(socket);
    wss.close();
    server.close();
    server.closeAllConnections();
  };
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createInstallationServer();
  const port = Number(process.env.PORT || 7777);
  server.listen(port, process.env.HOST || '0.0.0.0', () => {
    console.log(`Installation setup: http://localhost:${server.address().port}`);
    for (const a of Object.values(networkInterfaces()).flat()) {
      if (a && a.family === 'IPv4' && !a.internal) console.log(`iPad: http://${a.address}:${server.address().port}/controller.html`);
    }
  });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; server.shutdown(); });
  process.on('SIGINT', () => server.shutdown());
  process.on('SIGTERM', () => server.shutdown());
}
