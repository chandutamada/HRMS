/**
 * Pure TypeScript Zero-Dependency STOMP over WebSocket Client
 * Connects directly to Spring Boot WebSocket broker (/ws-tracking)
 */
export class StompClient {
  private ws: WebSocket | null = null;
  private url: string;
  private subscriptions: Map<string, (msg: any) => void> = new Map();
  private isConnected = false;
  private reconnectTimer: any = null;
  private heartbeatTimer: any = null;
  private onConnectCallback?: () => void;
  private onDisconnectCallback?: () => void;

  constructor(url: string, onConnect?: () => void, onDisconnect?: () => void) {
    this.url = url;
    this.onConnectCallback = onConnect;
    this.onDisconnectCallback = onDisconnect;
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      let endpoint = this.url;
      if (endpoint.startsWith('http://')) {
        endpoint = endpoint.replace('http://', 'ws://');
      } else if (endpoint.startsWith('https://')) {
        endpoint = endpoint.replace('https://', 'wss://');
      }

      // Append /websocket if not present for SockJS endpoint compatibility
      const wsUrl = endpoint.endsWith('/websocket') ? endpoint : `${endpoint}/websocket`;
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        // Send STOMP CONNECT frame
        const connectFrame = [
          'CONNECT',
          'accept-version:1.2,1.1,1.0',
          'heart-beat:10000,10000',
          '',
          '\x00',
        ].join('\n');
        this.ws?.send(connectFrame);
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        this.handleDisconnect();
      };

      this.ws.onerror = (err) => {
        console.warn('STOMP WebSocket error:', err);
        this.handleDisconnect();
      };
    } catch (err) {
      console.warn('STOMP Connection failed:', err);
      this.handleDisconnect();
    }
  }

  private handleMessage(data: string) {
    const frames = data.split('\x00');
    for (const frame of frames) {
      const trimmed = frame.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('CONNECTED')) {
        this.isConnected = true;
        this.startHeartbeat();
        this.onConnectCallback?.();
        // Resubscribe active subscriptions
        this.subscriptions.forEach((_, topic) => {
          this.sendSubscribe(topic);
        });
      } else if (trimmed.startsWith('MESSAGE')) {
        this.parseMessageFrame(trimmed);
      }
    }
  }

  private parseMessageFrame(frame: string) {
    const lines = frame.split('\n');
    let destination = '';
    let bodyStartIndex = -1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('destination:')) {
        destination = line.substring('destination:'.length).trim();
      } else if (line === '' && bodyStartIndex === -1) {
        bodyStartIndex = i + 1;
        break;
      }
    }

    if (destination && bodyStartIndex !== -1) {
      const body = lines.slice(bodyStartIndex).join('\n').trim();
      try {
        const parsed = JSON.parse(body);
        const cb = this.subscriptions.get(destination);
        if (cb) cb(parsed);
      } catch {
        const cb = this.subscriptions.get(destination);
        if (cb) cb(body);
      }
    }
  }

  public subscribe(destination: string, callback: (msg: any) => void) {
    this.subscriptions.set(destination, callback);
    if (this.isConnected) {
      this.sendSubscribe(destination);
    }
    return () => {
      this.subscriptions.delete(destination);
    };
  }

  private sendSubscribe(destination: string) {
    const subFrame = [
      'SUBSCRIBE',
      `id:sub-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      `destination:${destination}`,
      'ack:auto',
      '',
      '\x00',
    ].join('\n');
    this.ws?.send(subFrame);
  }

  private startHeartbeat() {
    clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send('\n');
      }
    }, 15000);
  }

  private handleDisconnect() {
    this.isConnected = false;
    clearInterval(this.heartbeatTimer);
    this.onDisconnectCallback?.();
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, 5000);
  }

  public disconnect() {
    clearTimeout(this.reconnectTimer);
    clearInterval(this.heartbeatTimer);
    if (this.isConnected && this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send('DISCONNECT\n\n\x00');
    }
    this.ws?.close();
    this.ws = null;
    this.isConnected = false;
  }
}
