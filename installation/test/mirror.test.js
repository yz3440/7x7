import { test } from 'node:test';
import assert from 'node:assert/strict';

// The navigation scheduler can be exercised without initializing WebGL or a DOM.
globalThis.InstallationUniverse = class {};
const { Mirror } = await import('../public/mirror.js');
delete globalThis.InstallationUniverse;

function setup(t) {
  t.mock.method(globalThis, 'cancelAnimationFrame', () => {});
  const requests = [];
  const mirror = Object.assign(Object.create(Mirror.prototype), {
    inflight: new Set(), generation: 0, ackId: 0, queue: null, timer: null,
    points: new Map(), status: { textContent: '' },
    canNavigate: () => true,
    send(message) {
      return new Promise((resolve, reject) => requests.push({ message, resolve, reject }));
    },
  });
  return { mirror, requests };
}
// Node has no browser animation-frame functions.
globalThis.cancelAnimationFrame = () => {};

test('navigation pipelines updates while acknowledgements are delayed and coalesces congestion', async t => {
  const { mirror, requests } = setup(t);
  for (let x = 1; x <= 10; x++) {
    mirror.queue = { x, y: 0, zoom: 1 };
    mirror.flush();
  }
  assert.equal(requests.length, 4, 'four updates leave without waiting for a round trip');
  assert.equal(mirror.queue.x, 10, 'intermediate unsent positions are discarded');
  const first = [...mirror.inflight][0];
  requests[0].resolve({ actionId: 1 });
  await first;
  assert.equal(requests.length, 5);
  assert.equal(requests[4].message.view.x, 10);
  assert.equal(mirror.inflight.size, 4);
  requests.slice(1).forEach((request, i) => request.resolve({ actionId: i + 2 }));
  await Promise.all([...mirror.inflight]);
  assert.equal(mirror.ackId, 5);
});

test('switching away waits for all sent navigation and clears unsent movement', async t => {
  const { mirror, requests } = setup(t);
  for (let x = 1; x <= 5; x++) { mirror.queue = { x }; mirror.flush(); }
  let stopped = false;
  const stop = mirror.stop().then(() => { stopped = true; });
  const first = [...mirror.inflight][0];
  requests[0].resolve({ actionId: 1 });
  await first;
  assert.equal(stopped, false);
  requests.slice(1).forEach(request => request.resolve({ actionId: 2 }));
  await stop;
  assert.equal(requests.length, 4);
  assert.equal(mirror.queue, null);
  assert.equal(mirror.inflight.size, 0);
});

test('a delayed acknowledgement from a previous connection cannot reset navigation state', async t => {
  const { mirror, requests } = setup(t);
  mirror.queue = { x: 1 }; mirror.flush();
  mirror.resetNavigation();
  requests[0].resolve({ actionId: 100 });
  await Promise.all([...mirror.inflight]);
  assert.equal(mirror.ackId, 0);
});


test('monitor camera samples do not overwrite or restart a locally triggered flight', t => {
  const { mirror } = setup(t);
  const pattern = Array.from({ length: 7 }, () => Array(7).fill(1));
  let starts = 0;
  let cameraWrites = 0;
  let running = false;
  Object.assign(mirror, {
    online: true, view: { x: -1, y: -1, zoom: 1 },
    canvas: { dataset: {} }, resize() {}, updateStatus() {},
    universe: {
      animationManager: { isRunning: () => running, stop: () => { running = false; } },
      flyToPattern() { starts++; running = true; },
      setView() { cameraWrites++; },
    },
    state: { epoch: 'test' },
  });
  mirror.startFlight(pattern, true);
  const state = { epoch: 'test', flight: { id: 1, pattern },
    display: { ready: true, flightId: 1, actionId: 1, status: 'flying', cameraX: -100, cameraY: -100, zoom: 2, width: 1000, height: 600 } };
  mirror.update(state);
  mirror.update({ ...state, display: { ...state.display, cameraX: -200 } });
  assert.equal(starts, 1);
  assert.equal(cameraWrites, 0);
  assert.equal(Mirror.prototype.canNavigate.call(mirror), false);
  const arrived = { ...state, display: { ...state.display, status: 'arrived' } };
  mirror.update(arrived);
  assert.equal(cameraWrites, 0, 'wait for local animation even if monitor arrives first');
  running = false;
  mirror.update(arrived);
  assert.equal(cameraWrites, 1);
  assert.ok(Mirror.prototype.canNavigate.call(mirror));
});
