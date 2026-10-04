import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../public/connection.js', import.meta.url), 'utf8');

function setup() {
  class Socket {
    static OPEN = 1;
    static CLOSING = 2;
    constructor(url) { this.url = url; this.readyState = 1; this.sent = []; }
    send(data) { this.sent.push(JSON.parse(data)); }
    close() { this.readyState = 3; }
    receive(message) { this.onmessage({ data: JSON.stringify(message) }); }
  }
  const context = vm.createContext({
    WebSocket: Socket,
    window: { addEventListener() {} },
    location: { protocol: 'http:', host: '192.168.1.10:7777' },
    setInterval() {}, setTimeout, clearTimeout,
  });
  const Connection = vm.runInContext(source.replace('export class Connection', 'class Connection') + '\nConnection;', context);
  const states = [];
  const touches = [];
  const connection = new Connection('controller', state => states.push(state), () => {}, value => touches.push(value));
  connection.socket.receive({ type: 'session', clientId: 'controller-1' });
  return { connection, states, touches };
}

test('connection routes state and touch messages and resolves or rejects the matching request', async () => {
  const { connection, states, touches } = setup();
  assert.equal(connection.socket.url, 'ws://192.168.1.10:7777/socket?role=controller');
  connection.socket.receive({ type: 'state', state: { revision: 3 } });
  connection.socket.receive({ type: 'touches', clientId: 'other', points: [] });
  assert.equal(states[0].revision, 3);
  assert.equal(touches[0].clientId, 'other');
  const first = connection.send({ type: 'heartbeat' });
  const second = connection.send({ type: 'find' });
  const rejection = assert.rejects(second, /Wait for the flight/);
  connection.socket.receive({ type: 'ack', requestId: 2, status: 409, error: 'Wait for the flight' });
  connection.socket.receive({ type: 'ack', requestId: 1, status: 200 });
  assert.equal((await first).requestId, 1);
  await rejection;
  assert.equal(connection.pending.size, 0);
  connection.disconnect();
});

test('disconnect rejects pending requests and stale sockets cannot deliver state after reconnect', async () => {
  const { connection, states } = setup();
  const previous = connection.socket;
  const pending = connection.send({ type: 'heartbeat' });
  const rejection = assert.rejects(pending, /Connection lost/);
  connection.disconnect();
  await rejection;
  assert.equal(connection.pending.size, 0);
  connection.connect();
  connection.socket.receive({ type: 'session', clientId: 'controller-2' });
  previous.receive({ type: 'state', state: { revision: 99 } });
  assert.equal(states.length, 0);
  assert.equal(connection.clientId, 'controller-2');
  connection.disconnect();
});
