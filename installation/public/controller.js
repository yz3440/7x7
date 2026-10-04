import { Connection } from './connection.js';
import { Mirror } from './mirror.js';
import { TouchTracker } from './touches.js';
import { setupFullscreen } from './fullscreen.js';

const grid = document.getElementById('grid');
const feedback = document.getElementById('feedback');
const findButton = document.getElementById('find');
const groups = document.getElementById('groups');
const connectionStatus = document.getElementById('connection');
const coordinates = {
  col: document.getElementById('draw-col'),
  row: document.getElementById('draw-row'),
  zoom: document.getElementById('draw-zoom'),
};

setupFullscreen(document.getElementById('fullscreen'), document.getElementById('fullscreen-status'));
let pattern = Array.from({ length: 7 }, () => Array(7).fill(1));
let state = null;
let dirty = false;
let version = 0;
let sending = null;
let finding = false;
let drawing = null;
let lastCell = null;
let editTimer;
const cells = [];
const mirror = new Mirror(message => connection.send(message));

function paint() {
  cells.forEach((cell, i) => {
    const black = pattern[Math.floor(i / 7)][i % 7] === 0;
    cell.classList.toggle('black', black);
    cell.setAttribute('aria-pressed', String(black));
  });
}
function updateStatus() {
  const ready = connection.online && state?.display?.ready;
  connectionStatus.textContent = !connection.online ? 'Reconnecting…' : ready ? 'Display connected' : 'Waiting for display';
  findButton.disabled = !ready || finding || mirror.remoteFlightActive();
  if (!connection.online) feedback.textContent = 'Connection lost. Your drawing is kept here while we reconnect.';
  else if (!state?.display) feedback.textContent = 'Open the display page on the monitor’s computer.';
  else if (!ready) feedback.textContent = 'The display is not ready. Check its screen for an error.';
  else if (state.flight && state.display.flightId !== state.flight.id) feedback.textContent = 'Pattern sent. Waiting for the display…';
  else if (state.display.status === 'flying') feedback.textContent = 'Finding your pattern… look at the big screen.';
  else if (state.display.status === 'arrived') feedback.textContent = 'Found it. Your pattern was here all along.';
  else feedback.textContent = 'Ready when you are.';
  const d = state?.display;
  const hasCoordinates = ready && Number.isFinite(d.x);
  coordinates.col.textContent = `col: ${hasCoordinates ? d.x.toLocaleString() : '—'}`;
  coordinates.row.textContent = `row: ${hasCoordinates ? d.y.toLocaleString() : '—'}`;
  coordinates.zoom.textContent = `zoom: ${hasCoordinates ? d.zoom.toFixed(2) + 'x' : '—'}`;
}
const connection = new Connection('controller', next => {
  state = next;
  mirror.update(next);
  if (!dirty && !sending && drawing === null) {
    pattern = next.draft.map(row => [...row]);
    paint();
  }
  updateStatus();
  if (dirty && connection.online) flush();
}, online => { mirror.setOnline(online); updateStatus(); });

function flush() {
  if (sending) return sending;
  if (!dirty || finding || !connection.online) return;

  const sentVersion = version;
  sending = connection.send({ type: 'draft', pattern })
    .then(() => {
      if (version === sentVersion) dirty = false;
    })
    .catch(error => { feedback.textContent = error.message; })
    .finally(() => {
      sending = null;
      if (dirty && connection.online) editTimer = setTimeout(flush, 80);
    });
  return sending;
}

function markDirty() {
  dirty = true;
  version++;
  groups.value = '';
  paint();
  clearTimeout(editTimer);
  editTimer = setTimeout(flush, 80);
}
for (let i = 0; i < 49; i++) {
  const cell = document.createElement('button');
  cell.type = 'button';
  cell.dataset.index = i;
  cell.setAttribute('aria-label', `Row ${Math.floor(i / 7) + 1}, column ${i % 7 + 1}`);
  cell.addEventListener('click', event => {
    // Touch/mouse strokes are handled below. Keep keyboard activation accessible.
    if (event.detail !== 0) return;
    pattern[Math.floor(i / 7)][i % 7] ^= 1;
    markDirty();
  });
  grid.append(cell);
  cells.push(cell);
}
function cellAt(event) {
  const r = grid.getBoundingClientRect();
  if (event.clientX < r.left || event.clientX >= r.right || event.clientY < r.top || event.clientY >= r.bottom) return null;
  return { x: Math.floor((event.clientX - r.left) / r.width * 7), y: Math.floor((event.clientY - r.top) / r.height * 7) };
}
function stroke(cell) {
  if (!cell) { lastCell = null; return; }
  const previous = lastCell || cell;
  // Fill intermediate cells when a finger moves faster than pointer events arrive.
  const steps = Math.max(Math.abs(cell.x - previous.x), Math.abs(cell.y - previous.y), 1);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(previous.x + (cell.x - previous.x) * i / steps);
    const y = Math.round(previous.y + (cell.y - previous.y) * i / steps);
    pattern[y][x] = drawing.value;
  }
  lastCell = cell;
  markDirty();
}
grid.addEventListener('pointerdown', event => {
  if (drawing || !event.isPrimary || event.button !== 0) return;
  const cell = cellAt(event);
  if (!cell) return;
  event.preventDefault();
  drawing = { id: event.pointerId, value: pattern[cell.y][cell.x] ^ 1 };
  grid.setPointerCapture(event.pointerId);
  stroke(cell);
});
grid.addEventListener('pointermove', event => {
  if (drawing?.id === event.pointerId) { event.preventDefault(); stroke(cellAt(event)); }
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
  grid.addEventListener(type, event => {
    if (drawing?.id !== event.pointerId) return;
    drawing = null;
    lastCell = null;
    flush();
  });
}
document.getElementById('clear').onclick = () => {
  pattern = pattern.map(row => row.map(() => 1));
  markDirty();
};
document.getElementById('invert').onclick = () => {
  pattern = pattern.map(row => row.map(value => value ^ 1));
  markDirty();
};
findButton.onclick = async () => {
  if (findButton.disabled || mirror.flightActive()) return;
  finding = true;
  updateStatus();
  const sentVersion = version;
  const targetPattern = pattern.map(row => [...row]);
  mirror.startFlight(targetPattern, true);
  await mirror.stop();
  // Let the preceding draft request finish so it cannot overwrite this flight's draft.
  await sending;
  try {
    await connection.send({ type: 'find', pattern: targetPattern });
    if (version === sentVersion) dirty = false;
  } catch (error) {
    mirror.cancelRequestedFlight();
    feedback.textContent = `${error.message}. Tap Fly To again once connected.`;
  } finally {
    finding = false;
    findButton.disabled = !connection.online || !state?.display?.ready || mirror.remoteFlightActive();
  }
  flush();
};
for (const name of Object.keys(GROUP_PATTERNS).sort()) {
  groups.append(new Option(name, name));
}
groups.onchange = () => {
  if (!GROUP_PATTERNS[groups.value]) return;
  const name = groups.value;
  // The source has an eight-cell row in one mark; match its existing 7-column drawing panel.
  pattern = GROUP_PATTERNS[name].default.slice(0, 7).map(row => row.slice(0, 7));
  markDirty();
  groups.value = name;
};
paint();

mirror.show();

new TouchTracker(document.getElementById('canvas'), document.getElementById('mirror-frame'), message => connection.send(message));
