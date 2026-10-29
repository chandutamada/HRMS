import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';

enum StompConnectionStatus {
  disconnected,
  connecting,
  connected,
}

/// Socket.io–compatible tracking client for the NestJS /tracking WebSocket namespace.
///
/// Protocol notes
/// ──────────────
/// Socket.io uses its own framing on top of WebSocket.
/// Packet types used here:
///   0   – ENGINE_IO open (server → client, ignored)
///   2   – EVENT  (emit)        payload: 2["event",{...}]
///   3   – ACK    (not used)
///   40  – SOCKET_IO CONNECT    payload: 40  (namespace connect)
///   42  – SOCKET_IO EVENT      payload: 42["event",{...}]
///
/// We use raw WebSocket (not the socket.io-client Dart package) to keep the
/// dependency tree minimal. The server is configured to accept websocket
/// transport, so we connect directly to the /tracking namespace path.
class StompTrackingClient {
  final String url;   // e.g. "ws://192.168.1.10:4000"
  final String? jwtToken;
  WebSocket? _socket;
  StompConnectionStatus _status = StompConnectionStatus.disconnected;
  Timer? _reconnectTimer;
  Timer? _heartbeatTimer;

  final Function(StompConnectionStatus)? onStatusChanged;
  final Function(String event, Map<String, dynamic> data)? onEvent;

  bool _isDisposed = false;

  StompTrackingClient({
    required this.url,
    this.jwtToken,
    this.onStatusChanged,
    Function(String topic, String body)? onMessage,
  }) : onEvent = (onMessage != null
            ? ((String event, Map<String, dynamic> data) =>
                onMessage(event, jsonEncode(data)))
            : null);

  StompConnectionStatus get status => _status;
  bool get isConnected => _status == StompConnectionStatus.connected;

  // ─── Connection ─────────────────────────────────────────────────────────────

  Future<void> connect() async {
    if (_isDisposed) return;
    if (_status != StompConnectionStatus.disconnected) return;

    _setStatus(StompConnectionStatus.connecting);

    try {
      // Build WebSocket URL for Socket.io /tracking namespace
      // Socket.io WS path: /tracking/socket.io/?EIO=4&transport=websocket
      String wsBase = url;
      if (wsBase.startsWith('http://')) wsBase = wsBase.replaceFirst('http://', 'ws://');
      if (wsBase.startsWith('https://')) wsBase = wsBase.replaceFirst('https://', 'wss://');

      final tokenParam = jwtToken != null
          ? '&token=${Uri.encodeComponent(jwtToken!)}'
          : '';
      final fullUri =
          '$wsBase/tracking/socket.io/?EIO=4&transport=websocket$tokenParam';

      _socket = await WebSocket.connect(fullUri)
          .timeout(const Duration(seconds: 6));

      _socket!.listen(
        _onData,
        onError: (err) {
          debugPrint('[TrackingWS] error: $err');
          _handleDisconnect();
        },
        onDone: () {
          debugPrint('[TrackingWS] remote closed');
          _handleDisconnect();
        },
        cancelOnError: true,
      );

      // Engine.IO expects a "2probe" ping during upgrade — but since we're
      // connecting directly as websocket, server sends "0{...}" open packet
      // and then we reply with namespace connect "40".
      // This is handled in _onData below.
    } catch (e) {
      debugPrint('[TrackingWS] connect failed: $e');
      _handleDisconnect();
    }
  }

  // ─── Receive ────────────────────────────────────────────────────────────────

  void _onData(dynamic raw) {
    final text = raw is String ? raw : utf8.decode(raw as List<int>);

    if (text.isEmpty) return;

    // Engine.IO packet type is the leading digit(s)
    if (text.startsWith('0')) {
      // ENGINE_IO OPEN — reply with namespace connect for /tracking
      _socket?.add('40');
      return;
    }

    if (text == '2') {
      // Engine.IO PING — reply with PONG
      _socket?.add('3');
      return;
    }

    if (text.startsWith('40')) {
      // Socket.io namespace CONNECTED
      _setStatus(StompConnectionStatus.connected);
      _startHeartbeat();
      debugPrint('[TrackingWS] namespace connected ✓');
      return;
    }

    if (text.startsWith('42')) {
      // Socket.io EVENT
      try {
        final jsonStr = text.substring(2);
        final list = jsonDecode(jsonStr) as List;
        if (list.length >= 2) {
          final event = list[0] as String;
          final data = list[1] as Map<String, dynamic>? ?? {};
          onEvent?.call(event, data);
        }
      } catch (e) {
        debugPrint('[TrackingWS] parse error: $e | raw: $text');
      }
      return;
    }

    if (text.startsWith('44')) {
      // ACK — ignore
      return;
    }
  }

  // ─── Send ────────────────────────────────────────────────────────────────────

  /// Emit a Socket.io event to the server.
  /// Returns true if the packet was sent, false if not connected.
  bool send(String event, Map<String, dynamic> payload) {
    if (!isConnected || _socket == null) return false;
    try {
      final packet = '42${jsonEncode([event, payload])}';
      _socket!.add(packet);
      return true;
    } catch (e) {
      debugPrint('[TrackingWS] send error: $e');
      _handleDisconnect();
      return false;
    }
  }

  // ─── Legacy STOMP-style send (maps to Socket.io emit) ────────────────────────

  /// Maps the old STOMP /app/track/{userId} destination to Socket.io location_ping.
  bool sendLegacy(String destination, Map<String, dynamic> payload) {
    if (destination.contains('track')) {
      return send('location_ping', payload);
    }
    return send('message', {'destination': destination, 'body': payload});
  }

  // ─── Heartbeat ───────────────────────────────────────────────────────────────

  void _startHeartbeat() {
    _heartbeatTimer?.cancel();
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 20), (_) {
      if (isConnected && _socket != null) {
        try {
          _socket!.add('2'); // ENGINE_IO PING
        } catch (_) {
          _handleDisconnect();
        }
      }
    });
  }

  // ─── Disconnect & Reconnect ──────────────────────────────────────────────────

  void _handleDisconnect() {
    _setStatus(StompConnectionStatus.disconnected);
    _heartbeatTimer?.cancel();
    try { _socket?.close(); } catch (_) {}
    _socket = null;
    if (!_isDisposed) _scheduleReconnect();
  }

  void _scheduleReconnect() {
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 5), () {
      if (!_isDisposed && _status == StompConnectionStatus.disconnected) {
        connect();
      }
    });
  }

  void disconnect() {
    _isDisposed = true;
    _reconnectTimer?.cancel();
    _heartbeatTimer?.cancel();
    if (isConnected) {
      // Socket.io disconnect packet
      try { _socket?.add('41'); } catch (_) {}
    }
    try { _socket?.close(); } catch (_) {}
    _socket = null;
    _setStatus(StompConnectionStatus.disconnected);
  }

  void _setStatus(StompConnectionStatus s) {
    if (_status != s) {
      _status = s;
      onStatusChanged?.call(_status);
    }
  }
}
