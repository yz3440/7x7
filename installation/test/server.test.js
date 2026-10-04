import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { WebSocket } from 'ws';
import { createInstallationServer } from '../server.js';

async function setup(t) {
  const server = createInstallationServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.shutdown());
  const base = `http://127.0.0.1:${server.address().port}`;
  const socketURL = role => `${base.replace('http:', 'ws:')}/socket?role=${role}`;
  async function connect(role) {
    const socket = new WebSocket(socketURL(role), { origin: base });
    let state;
    let sequence = 0;
    const pending = new Map();
    socket.on('message', data => {
      const m = JSON.parse(data);
      if (m.type === 'state') state = m.state;
      if (m.type === 'ack') { pending.get(m.requestId)?.(m); pending.delete(m.requestId); }
    });
    const until = async predicate => {
      const deadline = Date.now() + 2500;
      while (!predicate(state)) {
        if (Date.now() > deadline) throw new Error('Timed out waiting for state');
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      return state;
    };
    await until(s => s);
    return { socket, get state() { return state; }, until, close: () => socket.close(),
      send(message) {
        const requestId = ++sequence;
        return new Promise(resolve => {
          pending.set(requestId, resolve); socket.send(JSON.stringify({ ...message, requestId }));
        });
      } };
  }
  return { base, connect, socketURL };
}
const pattern = Array.from({ length: 7 }, (_, y) => Array.from({ length: 7 }, (_, x) => Number(x === y)));
const telemetry = { ready: true, status: 'ready', flightId: null, actionId: 0,
  x: 0, y: 0, zoom: 15, cameraX: -10.05, cameraY: -10.05, width: 1440, height: 900 };

test('WebSocket drawing → flight → arrival; navigation follows arrival and survives reconnect', async t => {
  const { connect } = await setup(t);
  const controller = await connect('controller');
  assert.equal((await controller.send({ type: 'find', pattern })).status, 409);
  const display = await connect('display');
  assert.equal((await display.send({ type: 'telemetry', telemetry })).status, 200);
  await controller.until(s => s.display?.ready);
  assert.equal((await controller.send({ type: 'draft', pattern })).status, 200);
  await display.until(s => s.revision === 1);
  assert.deepEqual(display.state.draft, pattern);
  assert.equal(display.state.flight, null);
  await controller.send({ type: 'find', pattern });
  await display.until(s => s.flight?.id === 1);
  assert.deepEqual(display.state.flight.pattern, pattern);
  await display.send({ type: 'telemetry', telemetry: { ...telemetry, status: 'arrived', flightId: 1, actionId: 1, x: 123 } });
  await controller.until(s => s.display?.status === 'arrived');
  assert.equal(controller.state.display.x, 123);
  const view = { x: -12345678.25, y: -87654321.5, zoom: 8 };
  assert.equal((await controller.send({ type: 'navigate', view })).actionId, 2);
  await display.until(s => s.view?.id === 2);
  assert.equal(display.state.flight, null);
  // A delayed pre-gesture report cannot roll back the mirror.
  await display.send({ type: 'telemetry', telemetry });
  assert.equal(controller.state.display.x, 123);
  await display.send({ type: 'telemetry', telemetry: { ...telemetry, actionId: 2, cameraX: view.x, cameraY: view.y, zoom: 8 } });
  await controller.until(s => s.display?.actionId === 2);
  assert.equal(controller.state.display.cameraX, view.x);
  const reconnected = await connect('controller');
  assert.deepEqual(reconnected.state.draft, pattern);
  assert.equal(reconnected.state.view.x, view.x);
  display.close();
  await controller.until(s => s.display === null);
  assert.equal((await controller.send({ type: 'navigate', view })).status, 409);
  const replacement = await connect('display');
  assert.equal(replacement.state.view.id, 2);
  assert.equal(replacement.state.display.ready, false);
  await replacement.send({ type: 'telemetry', telemetry: { ...telemetry, actionId: 2 } });
  await controller.send({ type: 'find', pattern });
  await replacement.until(s => s.flight?.id === 3);
  assert.equal(replacement.state.view, null);
});

test('WebSocket validates origins, roles, and payloads', async t => {
  const { base, connect, socketURL } = await setup(t);
  const controller = await connect('controller');
  const display = await connect('display');
  async function rejected(role, origin, status) {
    await new Promise((resolve, reject) => {
      const socket = new WebSocket(socketURL(role), { origin });
      socket.on('error', () => {});
      socket.on('unexpected-response', (_, response) => {
        try { assert.equal(response.statusCode, status); response.resume(); socket.terminate(); resolve(); }
        catch (error) { reject(error); }
      });
      socket.on('open', () => { socket.close(); reject(new Error('Unexpected successful connection')); });
    });
  }
  await rejected('controller', 'https://unrelated.example', 403);
  await rejected('unknown', base, 400);
  assert.equal((await controller.send({ type: 'draft', pattern: [[1]] })).status, 400);
  assert.equal((await controller.send({ type: 'telemetry', telemetry })).status, 403);
  assert.equal((await display.send({ type: 'navigate', view: { x: 0, y: 0, zoom: 1 } })).status, 403);
  assert.equal((await display.send({ type: 'telemetry', telemetry: { ...telemetry, flightId: 99 } })).status, 400);
  for (const view of [{ x: 0, y: 0, zoom: 0 }, { x: 0, y: 0, zoom: 21 }, { x: 'bad', y: 0, zoom: 1 }, { x: 1e20, y: 0, zoom: 1 }]) {
    assert.equal((await controller.send({ type: 'navigate', view })).status, 400);
  }
  assert.equal(controller.state.revision, 0);
  const close = once(controller.socket, 'close');
  controller.socket.send('x'.repeat(9000));
  assert.equal((await close)[0], 1009);
});

test('serves only installation and shared assets; obsolete HTTP messaging is unavailable', async t => {
  const { base } = await setup(t);
  for (const url of ['/', '/controller.html', '/controller.css', '/display.html', '/mirror.js', '/fullscreen.js', '/shared/BinaryPatternUniverse.js']) {
    assert.equal((await fetch(base + url)).status, 200, url);
  }
  for (const url of ['/controller_2.html', '/controller_2.css', '/server.js', '/README.md', '/main.js', '/.git/config', '/shared/%2e%2e%2fserver.js', '/events']) {
    assert.equal((await fetch(base + url)).status, 404, url);
  }
  assert.equal((await fetch(base + '/api/message', { method: 'POST' })).status, 405);
  assert.ok(Array.isArray((await (await fetch(base + '/api/network')).json()).urls));
});


test('multiple displays receive commands; newest owns telemetry and disconnect falls back', async t => {
  const { connect } = await setup(t);
  const controller = await connect('controller');
  const first = await connect('display');
  await first.send({ type: 'telemetry', telemetry });
  const firstOwner = first.state.displayOwnerId;
  const second = await connect('display');
  assert.notEqual(second.state.displayOwnerId, firstOwner);
  await second.send({ type: 'telemetry', telemetry: { ...telemetry, x: 321 } });
  await controller.until(s => s.display?.x === 321);
  assert.equal((await first.send({ type: 'telemetry', telemetry })).ignored, true);
  await controller.send({ type: 'find', pattern });
  await Promise.all([first.until(s => s.flight?.id === 1), second.until(s => s.flight?.id === 1)]);
  assert.deepEqual(first.state.flight.pattern, pattern);
  assert.deepEqual(second.state.flight.pattern, pattern);
  assert.equal(controller.state.display.x, 321);
  second.close();
  await first.until(s => s.displayOwnerId === firstOwner);
  await first.send({ type: 'telemetry', telemetry: { ...telemetry, flightId: 1, actionId: 1, status: 'arrived' } });
  await controller.until(s => s.display?.ready && s.displayOwnerId === firstOwner);
  const third = await connect('display');
  await third.send({ type: 'telemetry', telemetry: { ...telemetry, flightId: 1, actionId: 1, x: 456 } });
  const removalBroadcast = once(third.socket, 'message');
  first.close();
  await removalBroadcast;
  await controller.until(s => s.display?.x === 456);
  // Closing an older display must not clear the active display's telemetry.
  await third.send({ type: 'heartbeat' });
  assert.equal(third.state.display.x, 456);
});


test('pan, zoom and repeated find cannot interrupt a flight, including before its first telemetry', async t => {
  const { connect } = await setup(t);
  const display = await connect('display');
  const controller = await connect('controller');
  const other = await connect('controller');
  await display.send({ type: 'telemetry', telemetry });
  await controller.send({ type: 'find', pattern });
  const navigate = { type: 'navigate', view: { x: -100, y: -100, zoom: 8 } };
  assert.equal((await other.send(navigate)).status, 409);
  assert.equal((await other.send({ type: 'find', pattern })).status, 409);
  await display.send({ type: 'telemetry', telemetry: { ...telemetry, flightId: 1, actionId: 1, status: 'flying' } });
  assert.equal((await controller.send(navigate)).status, 409);
  assert.equal(display.state.flight.id, 1);
  assert.equal(display.state.view, null);
  await display.send({ type: 'telemetry', telemetry: { ...telemetry, flightId: 1, actionId: 1, status: 'arrived' } });
  assert.equal((await controller.send(navigate)).status, 200);
});

test('touch positions relay to displays without changing navigation and clear on disconnect', { timeout: 5000 }, async t => {
  const { connect } = await setup(t);
  const display = await connect('display');
  const controller = await connect('controller');
  const touches = [];
  display.socket.on('message', data => {
    const message = JSON.parse(data);
    if (message.type === 'touches') touches.push(message);
  });
  const untilTouches = async count => {
    while (touches.length < count) await new Promise(resolve => setTimeout(resolve, 5));
  };
  const points = [{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }];
  assert.equal((await controller.send({ type: 'touch', points })).status, 200);
  await untilTouches(1);
  assert.deepEqual(touches[0].points, points);
  assert.equal(display.state.view, null);
  assert.equal(display.state.revision, 0);
  for (const points of [[{ x: -1, y: 0 }], [{ x: 0, y: 2 }], [null], Array(11).fill({ x: 0, y: 0 })]) {
    assert.equal((await controller.send({ type: 'touch', points })).status, 400);
  }
  assert.equal((await display.send({ type: 'touch', points })).status, 403);
  controller.close();
  await untilTouches(2);
  assert.equal(touches[1].clientId, touches[0].clientId);
  assert.deepEqual(touches[1].points, []);
});
