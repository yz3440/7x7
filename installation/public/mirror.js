// Render the monitor's camera locally, preserving its viewport and aspect ratio.
// Gestures are predicted here immediately, then acknowledged by the monitor.
class MirrorUniverse extends InstallationUniverse {
  resizeCanvas() {
    const width = Number(this.canvas.dataset.width) || 1280;
    const height = Number(this.canvas.dataset.height) || 720;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width; this.canvas.height = height;
    }
    this.gl.viewport(0, 0, width, height);
  }
  startRenderLoop() {
    const frame = () => {
      if (!document.getElementById('explore-view').hidden && !document.hidden) {
        const animation = this.animationManager.update();
        if (animation) {
          this.cameraWorldPosition = animation.position;
          this.scale = animation.scale;
          this.translation.x = animation.position.x - this.originShift.x;
          this.translation.y = animation.position.y - this.originShift.y;
          this.updateOriginShift();
          if (animation.isComplete) this.onFlightComplete?.();
        }
        this.render(); this.updateInfo();
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }
}

export class Mirror {
  constructor(send) {
    this.send = send;
    this.online = false;
    this.points = new Map();
    this.view = null;
    this.ackId = 0;
    this.queue = null;
    this.inflight = new Set();
    this.generation = 0;
    this.panel = document.getElementById('explore-view');
    this.canvas = document.getElementById('canvas');
    this.frame = document.getElementById('mirror-frame');
    this.status = document.getElementById('mirror-status');
    new ResizeObserver(() => this.resize()).observe(document.getElementById('mirror-stage'));
    this.canvas.addEventListener('pointerdown', event => {
      if (!this.canNavigate() || (event.pointerType === 'mouse' && event.button !== 0)) return;
      event.preventDefault();
      this.canvas.setPointerCapture(event.pointerId);
      this.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
    });
    this.canvas.addEventListener('pointermove', event => {
      if (!this.points.has(event.pointerId) || !this.canNavigate()) return;
      event.preventDefault();
      const before = this.gesture();
      this.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
      const after = this.gesture();
      this.move(before, after, before.distance ? after.distance / before.distance : 1);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      this.canvas.addEventListener(type, event => {
        this.points.delete(event.pointerId);
        this.flush();
      });
    }
    this.canvas.addEventListener('wheel', event => {
      event.preventDefault();
      if (!this.canNavigate()) return;
      const point = { x: event.clientX, y: event.clientY };
      this.move(point, point, Math.exp(-event.deltaY * 0.001));
    }, { passive: false });
    this.canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.failed = true;
      this.status.textContent = 'The preview graphics were interrupted. Reload the iPad page to restore Explore.';
    });
  }
  remoteFlightActive() {
    const flight = this.state?.flight;
    const display = this.state?.display;
    return !!flight && (display?.flightId !== flight.id || display?.status !== 'arrived');
  }
  flightActive() { return !!this.requestedFlight || this.remoteFlightActive() || !!this.universe?.animationManager.isRunning(); }
  startFlight(pattern, requested = false) {
    this.resetNavigation();
    if (requested) this.requestedFlight = JSON.stringify(pattern);
    this.universe?.flyToPattern(pattern, 2200);
    this.updateStatus();
  }
  cancelRequestedFlight() {
    this.requestedFlight = null;
    this.universe?.animationManager.stop();
    if (this.remoteFlightActive()) this.startFlight(this.state.flight.pattern);
    this.updateStatus();
  }
  canNavigate() { return !this.flightActive() && this.online && this.state?.display?.ready && this.view && this.universe && !this.failed; }
  setOnline(online) {
    this.online = online;
    if (!online) { this.resetNavigation(); this.requestedFlight = null; }
    this.updateStatus();
  }
  resetNavigation() {
    this.generation++;
    this.queue = null;
    this.points.clear();
    this.ackId = 0;
    cancelAnimationFrame(this.timer);
    this.timer = null;
  }
  updateStatus() {
    const ready = this.online && this.state?.display?.ready && !this.failed;
    if (this.failed) return;
    this.status.textContent = !this.online ? 'Reconnecting… navigation is paused.' : !ready ? 'Waiting for the display…' : this.flightActive() ? 'Flying to pattern…' : 'Monitor view';
  }
  update(state) {
    if (this.state?.epoch !== state.epoch) {
      this.resetNavigation(); this.flightId = null; this.requestedFlight = null;
      this.universe?.animationManager.stop();
    }
    this.state = state;
    const d = state.display;
    this.updateStatus();
    if (!d?.ready || !Number.isFinite(d.cameraX)) return;
    this.canvas.dataset.width = d.width;
    this.canvas.dataset.height = d.height;
    const newFlight = state.flight && state.flight.id !== this.flightId;
    if (newFlight) {
      this.flightId = state.flight.id;
      const alreadyStarted = this.requestedFlight === JSON.stringify(state.flight.pattern);
      if (!alreadyStarted && this.remoteFlightActive()) {
        if (!this.view) {
          this.view = { x: d.cameraX, y: d.cameraY, zoom: d.zoom };
          this.universe?.setView(this.view);
        }
        this.startFlight(state.flight.pattern);
      }
      this.requestedFlight = null;
    }
    // Animate flights locally; monitor telemetry must not stop or step the animation.
    if (!this.flightActive() && !this.points.size && !this.queue && !this.inflight.size && d.actionId >= this.ackId) {
      this.view = { x: d.cameraX, y: d.cameraY, zoom: d.zoom };
      this.universe?.setView(this.view);
    }
    this.resize();
  }
  show() {
    this.panel.hidden = false;
    if (!this.universe) {
      try {
        this.universe = new MirrorUniverse();
        if (!this.universe.gl || !this.universe.program) throw new Error('WebGL2 unavailable');
        if (this.view) this.universe.setView(this.view);
        this.universe.onFlightComplete = () => {
          this.view = { x: this.universe.cameraWorldPosition.x, y: this.universe.cameraWorldPosition.y, zoom: this.universe.scale };
          this.updateStatus();
        };
        if (this.remoteFlightActive()) this.startFlight(this.state.flight.pattern);
      } catch (error) { this.failed = true; this.status.textContent = `Preview unavailable: ${error.message}`; }
    }
    this.resize(); this.updateStatus();
  }
  async stop() {
    this.queue = null; this.points.clear(); cancelAnimationFrame(this.timer);
    this.timer = null;
    await Promise.all([...this.inflight]);
  }
  resize() {
    if (this.panel.hidden) return;
    const stage = document.getElementById('mirror-stage').getBoundingClientRect();
    const w = Number(this.canvas.dataset.width) || 1280;
    const h = Number(this.canvas.dataset.height) || 720;
    const ratio = Math.min(stage.width / w, stage.height / h);
    this.frame.style.width = `${w * ratio}px`;
    this.frame.style.height = `${h * ratio}px`;
    this.universe?.resizeCanvas();
  }
  gesture() {
    const points = [...this.points.values()].slice(0, 2);
    if (points.length === 1) return { ...points[0], distance: 0 };
    return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2,
      distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) };
  }
  move(before, after, factor) {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = this.canvas.width / rect.width;
    const old = this.view;
    const zoom = Math.max(0.3, Math.min(20, old.zoom * factor));
    // Keep the world point under the gesture midpoint fixed while zooming.
    const x = old.x + ((after.x - rect.left - rect.width / 2) / zoom - (before.x - rect.left - rect.width / 2) / old.zoom) * ratio;
    const y = old.y + ((after.y - rect.top - rect.height / 2) / zoom - (before.y - rect.top - rect.height / 2) / old.zoom) * ratio;
    this.view = this.universe.clampView({ x, y, zoom });
    this.universe.setView(this.view);
    this.queue = { ...this.view };
    if (this.timer == null) this.timer = requestAnimationFrame(() => { this.timer = null; this.flush(); });
  }
  flush() {
    // Pipeline a few updates instead of waiting one network round trip per frame.
    // Under congestion, retain only the newest unsent position.
    if (this.inflight.size >= 4 || !this.queue || !this.canNavigate()) return;
    const view = this.queue; this.queue = null;
    const generation = this.generation;
    const request = this.send({ type: 'navigate', view }).then(result => {
      if (generation === this.generation) this.ackId = Math.max(this.ackId, result.actionId);
    }).catch(error => {
      if (generation !== this.generation) return;
      this.queue = null; this.status.textContent = error.message;
    }).finally(() => {
      this.inflight.delete(request);
      if (this.queue && this.timer == null) this.flush();
    });
    this.inflight.add(request);
  }
}
