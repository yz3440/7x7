// Normalized canvas coordinates keep touch markers aligned across screen sizes.
export class TouchMarkers {
  constructor(container) {
    this.layer = document.createElement('div');
    this.layer.className = 'touch-markers';
    this.layer.setAttribute('aria-hidden', 'true');
    container.append(this.layer);
    this.groups = new Map();
  }
  update(owner, points) {
    let group = this.groups.get(owner);
    if (!points.length) {
      group?.remove(); this.groups.delete(owner); return;
    }
    if (!group) {
      group = document.createElement('div');
      this.groups.set(owner, group); this.layer.append(group);
    }
    while (group.children.length > points.length) group.lastElementChild.remove();
    points.forEach((point, i) => {
      let marker = group.children[i];
      if (!marker) { marker = document.createElement('span'); marker.className = 'touch-marker'; group.append(marker); }
      marker.style.left = `${point.x * 100}%`;
      marker.style.top = `${point.y * 100}%`;
    });
  }
  clear() { this.layer.replaceChildren(); this.groups.clear(); }
}

export class TouchTracker {
  constructor(canvas, container, send) {
    this.canvas = canvas;
    this.send = send;
    this.points = new Map();
    this.markers = new TouchMarkers(container);
    canvas.addEventListener('pointerdown', event => {
      if (!['touch', 'pen'].includes(event.pointerType)) return;
      canvas.setPointerCapture(event.pointerId);
      this.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.update();
    });
    canvas.addEventListener('pointermove', event => {
      if (!this.points.has(event.pointerId)) return;
      this.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
      this.update();
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
      canvas.addEventListener(type, event => {
        if (this.points.delete(event.pointerId)) this.update(true);
      });
    }
    window.addEventListener('blur', () => this.clear());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.clear(); });
  }
  update(immediate = false) {
    const rect = this.canvas.getBoundingClientRect();
    const points = rect.width && rect.height ? [...this.points.values()].map(point => ({
      x: Math.max(0, Math.min(1, (point.x - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (point.y - rect.top) / rect.height)),
    })) : [];
    this.markers.update('local', points);
    this.queued = points;
    if (immediate) this.flush();
    else if (this.frame == null) this.frame = requestAnimationFrame(() => { this.frame = null; this.flush(); });
  }
  async flush() {
    if (this.sending || !this.queued) return;
    const points = this.queued; this.queued = null;
    this.sending = true;
    try { await this.send({ type: 'touch', points }); }
    catch { /* Connection recovery is handled by the controller. */ }
    finally { this.sending = false; if (this.queued) this.flush(); }
  }
  clear() { this.points.clear(); this.update(true); }
}
