import { Connection } from './connection.js';
import { TouchMarkers } from './touches.js';

const touchMarkers = new TouchMarkers(document.body);

const errorLog = document.getElementById('error-log');
let universe;
let ready = false;
let lastAction = 0;
let flightId = null;
let epoch;
let state;
let posting = false;
try {
  universe = new InstallationUniverse();
  ready = !!universe.gl && !!universe.program && !errorLog.textContent;
  if (ready) universe.flyToPattern(PATTERN_ML, 1);
} catch (error) { errorLog.textContent = `Display could not start: ${error.message}`; }

function connectionStatus(online) {
  if (!online) touchMarkers.clear();
  document.getElementById('connection').textContent = !online
    ? 'Reconnecting to the installation…'
    : state?.controllers ? '' : 'Waiting for the drawing controller';
}
const connection = new Connection('display', next => {
  state = next;
  if (epoch !== next.epoch) { epoch = next.epoch; lastAction = 0; flightId = null; }
  connectionStatus(connection.online);
  if (ready && next.flight && next.flight.id !== lastAction) {
    lastAction = next.flight.id;
    flightId = next.flight.id;
    universe.flyToPattern(next.flight.pattern, 2200);
    report();
  }
  if (ready && next.view && next.view.id !== lastAction) {
    lastAction = next.view.id;
    flightId = null;
    universe.setView(next.view);
    report();
  }
}, connectionStatus, message => touchMarkers.update(message.clientId, message.points));

async function report() {
  if (!connection.online || posting) return;
  if (state?.displayOwnerId && state.displayOwnerId !== connection.clientId) return;
  posting = true;
  const flying = ready && universe.animationManager.isRunning();
  const size = ready ? universe.PATTERN_SIZE + universe.STROKE_WIDTH : 1;
  const position = ready ? universe.cameraWorldPosition : { x: 0, y: 0 };
  const telemetry = {
    ready, status: !ready ? 'error' : flying ? 'flying' : flightId !== null ? 'arrived' : 'ready',
    flightId, x: Math.round(-(position.x + size / 2) / size),
    y: Math.round(-(position.y + size / 2) / size), zoom: ready ? universe.scale : 0,
    actionId: lastAction, cameraX: position.x, cameraY: position.y,
    width: window.innerWidth, height: window.innerHeight,
  };
  try { await connection.send({ type: 'telemetry', telemetry }); }
  catch { /* The shared connection shows reconnection status and retries. */ }
  finally { posting = false; }
}
setInterval(report, 100);
document.getElementById('canvas').addEventListener('webglcontextlost', event => {
  event.preventDefault(); ready = false;
  errorLog.textContent = 'The graphics connection was lost. Reload this display page to continue.';
  report();
});
