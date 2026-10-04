const HEARTBEAT_MS = 2000;
const CONNECT_TIMEOUT_MS = 5000;
const REQUEST_TIMEOUT_MS = 3000;
const INITIAL_RETRY_MS = 500;
const MAX_RETRY_MS = 5000;

export class Connection {
  constructor(role, onState, onConnection, onTouches = () => {}) {
    this.role = role;
    this.onState = onState;
    this.onConnection = onConnection;
    this.onTouches = onTouches;
    this.online = false;
    this.pending = new Map();
    this.sequence = 0;
    this.delay = INITIAL_RETRY_MS;
    this.connect();

    setInterval(() => {
      if (this.online) this.send({ type: 'heartbeat' }).catch(() => {});
    }, HEARTBEAT_MS);

    window.addEventListener('offline', () => this.disconnect());
    window.addEventListener('online', () => {
      if (this.online) return;
      clearTimeout(this.retry);
      this.connect();
    });
  }

  connect() {
    if (this.socket && this.socket.readyState < WebSocket.CLOSING) return;

    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const socket = new WebSocket(`${protocol}//${location.host}/socket?role=${this.role}`);
    this.socket = socket;
    const timeout = setTimeout(() => socket.close(), CONNECT_TIMEOUT_MS);

    socket.onmessage = ({ data }) => {
      if (socket !== this.socket) return;
      const message = JSON.parse(data);
      switch (message.type) {
        case 'session':
          clearTimeout(timeout);
          this.clientId = message.clientId;
          this.delay = INITIAL_RETRY_MS;
          this.setOnline(true);
          break;
        case 'state':
          this.onState(message.state);
          break;
        case 'touches':
          this.onTouches(message);
          break;
        case 'ack':
          this.acknowledge(message);
          break;
      }
    };
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      clearTimeout(timeout);
      if (socket !== this.socket) return;
      this.disconnect();
      this.retry = setTimeout(() => this.connect(), this.delay);
      this.delay = Math.min(MAX_RETRY_MS, this.delay * 2);
    };
  }

  acknowledge(message) {
    const request = this.pending.get(message.requestId);
    if (!request) return;
    this.pending.delete(message.requestId);
    clearTimeout(request.timeout);
    if (message.status === 200) request.resolve(message);
    else request.reject(new Error(message.error));
  }

  setOnline(value) {
    this.online = value;
    this.onConnection(value);
  }

  disconnect() {
    this.setOnline(false);
    for (const request of this.pending.values()) {
      clearTimeout(request.timeout);
      request.reject(new Error('Connection lost; reconnecting'));
    }
    this.pending.clear();
    this.socket?.close();
  }

  send(message) {
    if (!this.online || this.socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('Reconnecting to the installation'));
    }
    const requestId = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => this.disconnect(), REQUEST_TIMEOUT_MS);
      this.pending.set(requestId, { resolve, reject, timeout });
      this.socket.send(JSON.stringify({ ...message, requestId }));
    });
  }
}
