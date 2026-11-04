import 'dart:async';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:battery_plus/battery_plus.dart';
import '../core/constants/api_constants.dart';
import '../models/tracking_models.dart';
import 'api_service.dart';
import 'offline_tracking_buffer.dart';
import 'stomp_tracking_client.dart';

enum TrackingState {
  idle,
  tracking,
  paused,
  stopping,
}

class TrackingService extends ChangeNotifier {
  static final TrackingService _instance = TrackingService._internal();
  factory TrackingService() => _instance;
  TrackingService._internal();

  final ApiService _api = ApiService();
  final OfflineTrackingBuffer _offlineBuffer = OfflineTrackingBuffer();
  StompTrackingClient? _stompClient;

  TrackingState _state = TrackingState.idle;
  String? _sessionId;
  String _userId = 'emp_field_default';
  DateTime? _sessionStartTime;
  DateTime? _lastResumeTime;
  Duration _activeDuration = Duration.zero;
  Timer? _durationTimer;

  double _totalDistanceKm = 0.0;
  double _currentSpeedKmh = 0.0;
  double _maxSpeedKmh = 0.0;
  double _currentPaceMinPerKm = 0.0;
  double? _currentAccuracy;
  double? _currentAltitude;
  double? _currentHeading;
  Position? _currentPosition;

  final bool _isWithinOfficeHours = true;
  final bool _isWithinGeofence = false;
  double? _distanceToOfficeMeters;
  String _workLocationType = 'OFF_SITE';
  double _cachedBatteryLevel = 85.0;

  Future<void> _updateBatteryLevel() async {
    try {
      final level = await Battery().batteryLevel;
      _cachedBatteryLevel = level.toDouble();
    } catch (_) {}
  }

  final List<RoutePointDto> _routePoints = [];
  final List<CheckpointDto> _checkpoints = [];

  StreamSubscription<Position>? _positionSubscription;
  Timer? _livePingTimer;
  Timer? _sessionSyncTimer;

  // Stop Detection on Device (Stationary threshold: < 20 meters for 3 minutes)
  Position? _lastStopAnchorPosition;
  DateTime? _stopAnchorTime;
  bool _isStationaryState = false;
  CheckpointDto? _activeCheckpoint;

  final FlutterLocalNotificationsPlugin _notificationsPlugin = FlutterLocalNotificationsPlugin();
  bool _notificationsInitialized = false;

  // Getters
  TrackingState get state => _state;
  bool get isTracking => _state == TrackingState.tracking;
  bool get isPaused => _state == TrackingState.paused;
  bool get isActiveOrPaused => _state == TrackingState.tracking || _state == TrackingState.paused;
  bool get isStationary => _isStationaryState;
  String? get sessionId => _sessionId;
  String get userId => _userId;
  DateTime? get sessionStartTime => _sessionStartTime;
  DateTime? get lastResumeTime => _lastResumeTime;
  Duration get activeDuration => _activeDuration;

  double get totalDistanceKm => _totalDistanceKm;
  double get currentSpeedKmh => _currentSpeedKmh;
  double get maxSpeedKmh => _maxSpeedKmh;
  double get currentPaceMinPerKm => _currentPaceMinPerKm;
  double? get currentAccuracy => _currentAccuracy;
  double? get currentAltitude => _currentAltitude;
  double? get currentHeading => _currentHeading;
  Position? get currentPosition => _currentPosition;

  bool get isWithinOfficeHoursStatus => _isWithinOfficeHours;
  bool get isWithinGeofence => _isWithinGeofence;
  double? get distanceToOfficeMeters => _distanceToOfficeMeters;
  String get workLocationType => _workLocationType;

  int get pointsCount => _routePoints.length;
  int get checkpointsCount => _checkpoints.length;
  int get pendingOfflinePointsCount => _offlineBuffer.pendingCount;
  List<RoutePointDto> get routePoints => List.unmodifiable(_routePoints);
  List<CheckpointDto> get checkpoints => List.unmodifiable(_checkpoints);

  void setUserId(String id) {
    if (id.trim().isNotEmpty) {
      _userId = id.trim();
    }
  }

  /// Average Speed (km/h) across active duration
  double get averageSpeedKmh {
    final hours = _activeDuration.inSeconds / 3600.0;
    if (hours <= 0.001 || _totalDistanceKm <= 0.001) return 0.0;
    return _totalDistanceKm / hours;
  }

  /// Formatted duration string HH:MM:SS
  String get formattedDuration {
    final hours = _activeDuration.inHours.toString().padLeft(2, '0');
    final minutes = (_activeDuration.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (_activeDuration.inSeconds % 60).toString().padLeft(2, '0');
    return '$hours:$minutes:$seconds';
  }

  /// Formatted pace string (e.g. 5'32" /km)
  String get formattedPace {
    if (_totalDistanceKm <= 0.01 || _activeDuration.inSeconds <= 0) {
      return "--'--\"";
    }
    final paceDecimal = (_activeDuration.inMinutes / _totalDistanceKm);
    if (paceDecimal.isInfinite || paceDecimal.isNaN || paceDecimal > 99) {
      return "--'--\"";
    }
    final mins = paceDecimal.floor();
    final secs = ((paceDecimal - mins) * 60).round();
    return '$mins\'${secs.toString().padLeft(2, '0')}"';
  }

  /// Haversine Distance Calculation (meters)
  static double calculateDistanceMeters(
    double lat1,
    double lon1,
    double lat2,
    double lon2,
  ) {
    const earthRadius = 6371000.0; // meters
    final dLat = (lat2 - lat1) * (pi / 180.0);
    final dLon = (lon2 - lon1) * (pi / 180.0);

    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(lat1 * (pi / 180.0)) *
            cos(lat2 * (pi / 180.0)) *
            sin(dLon / 2) *
            sin(dLon / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return earthRadius * c;
  }

  /// Request and handle background permissions & battery optimization prompt
  Future<bool> requestPermissionsAndBatteryExemption() async {
    // 1. Precise location permission
    LocationPermission locPerm = await Geolocator.checkPermission();
    if (locPerm == LocationPermission.denied) {
      locPerm = await Geolocator.requestPermission();
      if (locPerm == LocationPermission.denied) return false;
    }
    if (locPerm == LocationPermission.deniedForever) return false;

    // 2. Background location permission (ACCESS_BACKGROUND_LOCATION / Always Allow)
    if (!kIsWeb && (defaultTargetPlatform == TargetPlatform.android || defaultTargetPlatform == TargetPlatform.iOS)) {
      final bgStatus = await Permission.locationAlways.status;
      if (!bgStatus.isGranted) {
        await Permission.locationAlways.request();
      }

      // 3. Prompt user to disable OS Battery Optimization ("Do Not Optimize")
      final batteryStatus = await Permission.ignoreBatteryOptimizations.status;
      if (!batteryStatus.isGranted) {
        await Permission.ignoreBatteryOptimizations.request();
      }
    }

    return true;
  }

  /// Initialize foreground notification service to prevent OS kills
  Future<void> _initForegroundNotification() async {
    if (_notificationsInitialized || kIsWeb) return;
    try {
      const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosInit = DarwinInitializationSettings();
      const initSettings = InitializationSettings(android: androidInit, iOS: iosInit);
      await _notificationsPlugin.initialize(initSettings);
      _notificationsInitialized = true;
    } catch (_) {}
  }

  Future<void> _showForegroundTrackingNotification() async {
    if (kIsWeb) return;
    try {
      await _initForegroundNotification();
      const androidDetails = AndroidNotificationDetails(
        'hrms_tracking_channel',
        'Field Tracking Foreground Service',
        channelDescription: 'Maintains live GPS telemetry streaming in background',
        importance: Importance.low,
        priority: Priority.low,
        ongoing: true,
        autoCancel: false,
        showWhen: true,
      );
      const notificationDetails = NotificationDetails(android: androidDetails);
      await _notificationsPlugin.show(
        888,
        'HRMS Field Tracking Active',
        'High-accuracy continuous background location active',
        notificationDetails,
      );
    } catch (_) {}
  }

  Future<void> _cancelForegroundNotification() async {
    if (kIsWeb) return;
    try {
      await _notificationsPlugin.cancel(888);
    } catch (_) {}
  }

  /// Start live location engine, foreground notification service, and background tracking
  /// Only executes for FIELD employees; OFFICE employees are excluded from continuous background tracking.
  Future<bool> startTracking({String workType = 'FIELD', String employmentType = 'FIELD'}) async {
    final type = employmentType.toUpperCase();
    if (type == 'OFFICE') {
      debugPrint('[TrackingService] Employee is OFFICE type. Continuous background tracking bypassed.');
      return false;
    }

    _workLocationType = workType;

    // Check GPS and request background permissions
    bool hasPermission = await requestPermissionsAndBatteryExemption();
    if (!hasPermission) return false;

    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return false;

    await _offlineBuffer.init();
    await _showForegroundTrackingNotification();

    _sessionId = 'session_${DateTime.now().millisecondsSinceEpoch}';
    _sessionStartTime = DateTime.now();
    _lastResumeTime = DateTime.now();
    _activeDuration = Duration.zero;
    _totalDistanceKm = 0.0;
    _currentSpeedKmh = 0.0;
    _maxSpeedKmh = 0.0;
    _currentPaceMinPerKm = 0.0;
    _routePoints.clear();
    _checkpoints.clear();
    _state = TrackingState.tracking;
    _lastStopAnchorPosition = null;
    _stopAnchorTime = null;
    _isStationaryState = false;
    _activeCheckpoint = null;

    // 1. Initialize WebSocket STOMP Client to Spring Boot Broker
    _initStompBroker();

    // 2. Start duration timer
    await _updateBatteryLevel();
    _startDurationTimer();

    // 3. Acquire initial position and send first ping to /tracking/ping
    try {
      final initialPos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      _onNewPosition(initialPos);
      await _sendFieldPing(initialPos);
    } catch (_) {}

    // 4. Stream continuous GPS positions with high accuracy and 15-meter minimum movement threshold
    _positionSubscription = Geolocator.getPositionStream(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.high,
        distanceFilter: 15, // 15 meters to minimize battery drain
      ),
    ).listen((pos) {
      _onNewPosition(pos);
      _sendFieldPing(pos);
    });

    // 5. Periodic 30-second ping upload to POST /tracking/ping and fallback keepalive
    _livePingTimer = Timer.periodic(const Duration(seconds: 30), (_) async {
      if (_state == TrackingState.tracking) {
        if (_currentPosition != null) {
          await _sendFieldPing(_currentPosition!);
        }
        if (_offlineBuffer.pendingCount > 0) {
          await _offlineBuffer.flushAndSync(_api, _sessionId!, _totalDistanceKm);
          notifyListeners();
        }
      }
    });

    // 6. Periodic session sync every 60 seconds
    _sessionSyncTimer = Timer.periodic(const Duration(seconds: 60), (_) async {
      if (isActiveOrPaused) {
        await syncSession();
      }
    });

    notifyListeners();
    return true;
  }

  /// Sends GPS telemetry ping to POST /tracking/ping every 30 seconds or on movement
  Future<void> _sendFieldPing(Position pos) async {
    try {
      await _updateBatteryLevel();
      final body = {
        'latitude': pos.latitude,
        'longitude': pos.longitude,
        'speed': pos.speed >= 0 ? pos.speed * 3.6 : 0.0,
        'accuracy': pos.accuracy,
        'altitude': pos.altitude,
        'heading': pos.heading,
        'battery': _cachedBatteryLevel,
        'batteryLevel': _cachedBatteryLevel,
        'timestamp': DateTime.now().toUtc().toIso8601String(),
      };
      await _api.dio.post('/tracking/ping', data: body);
    } catch (_) {}
  }

  Future<void> _initStompBroker() async {
    // Determine backend WebSocket host from configured ApiService or production default
    String wsEndpoint = ApiConstants.defaultWsUrl;
    final currentApiBase = _api.dio.options.baseUrl;
    if (currentApiBase.isNotEmpty && currentApiBase != ApiConstants.baseUrl) {
      wsEndpoint = currentApiBase.replaceAll(RegExp(r'/api/?$'), '');
    }

    _stompClient?.disconnect();
    final token = await _api.getToken();
    _stompClient = StompTrackingClient(
      url: wsEndpoint,
      jwtToken: token,
      onStatusChanged: (status) {
        debugPrint('[TrackingWS] status: $status');
        if (status == StompConnectionStatus.connected) {
          // Flush offline buffer on reconnect
          if (_sessionId != null) {
            _offlineBuffer.flushAndSync(_api, _sessionId!, _totalDistanceKm);
          }
          // Announce session start to HR dashboard
          _stompClient!.send('session_start', {
            'sessionId': _sessionId,
            'userId': _userId,
          });
        }
      },
    );
    _stompClient!.connect();
  }

  void pauseTracking() {
    if (_state != TrackingState.tracking) return;
    _state = TrackingState.paused;
    _currentSpeedKmh = 0.0;
    _durationTimer?.cancel();
    _durationTimer = null;
    notifyListeners();
  }

  void resumeTracking() {
    if (_state != TrackingState.paused) return;
    _state = TrackingState.tracking;
    _lastResumeTime = DateTime.now();
    _startDurationTimer();
    notifyListeners();
  }

  void _startDurationTimer() {
    _durationTimer?.cancel();
    _durationTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (_state == TrackingState.tracking) {
        _activeDuration += const Duration(seconds: 1);
        notifyListeners();
      }
    });
  }

  /// Handle incoming GPS position with high accuracy and stop detection
  void _onNewPosition(Position pos) {
    _currentPosition = pos;
    _currentAccuracy = pos.accuracy;
    _currentAltitude = pos.altitude;
    _currentHeading = pos.heading;

    if (_state != TrackingState.tracking) {
      notifyListeners();
      return;
    }

    // Filter out wild GPS noise (> 35m accuracy)
    if (pos.accuracy > 35.0) return;

    final now = DateTime.now();
    final speedMs = pos.speed >= 0 ? pos.speed : 0.0;
    final speedKmh = speedMs * 3.6;

    _currentSpeedKmh = speedKmh;
    if (speedKmh > _maxSpeedKmh) {
      _maxSpeedKmh = speedKmh;
    }

    final newPoint = RoutePointDto(
      lat: pos.latitude,
      lng: pos.longitude,
      alt: pos.altitude,
      speed: speedKmh,
      accuracy: pos.accuracy,
      heading: pos.heading,
      ts: now.millisecondsSinceEpoch,
    );

    // Calculate incremental distance
    if (_routePoints.isNotEmpty) {
      final prev = _routePoints.last;
      final distMeters = calculateDistanceMeters(
        prev.lat,
        prev.lng,
        newPoint.lat,
        newPoint.lng,
      );

      if (distMeters >= 3.0) {
        _totalDistanceKm += (distMeters / 1000.0);
      }
    }

    _routePoints.add(newPoint);

    // C. Stop Detection on Device:
    // If device moves < 20 meters over 3 minutes (180s), record a "Stop/Stationary" state event
    _evaluateStopDetection(pos, now);

    // Stream live coordinate packet via STOMP broker or cache in offline buffer
    _streamTelemetryPacket(pos, now);

    notifyListeners();
  }

  /// C. Stop Detection on Device:
  /// Detect stationary periods: If the device moves less than 20 meters over a span of 3 minutes,
  /// record a "Stop/Stationary" state event to reduce streaming frequency until movement resumes.
  void _evaluateStopDetection(Position currentPos, DateTime now) {
    if (_lastStopAnchorPosition == null) {
      _lastStopAnchorPosition = currentPos;
      _stopAnchorTime = now;
      return;
    }

    final distFromAnchor = calculateDistanceMeters(
      _lastStopAnchorPosition!.latitude,
      _lastStopAnchorPosition!.longitude,
      currentPos.latitude,
      currentPos.longitude,
    );

    if (distFromAnchor < 20.0) {
      // Device within 20m stationary circle
      final stationarySeconds = now.difference(_stopAnchorTime!).inSeconds;
      if (stationarySeconds >= 180 && !_isStationaryState) {
        // 3 minutes elapsed: transition to Stop/Stationary state
        _isStationaryState = true;
        _activeCheckpoint = CheckpointDto(
          lat: _lastStopAnchorPosition!.latitude,
          lng: _lastStopAnchorPosition!.longitude,
          arrivedAt: _stopAnchorTime!.millisecondsSinceEpoch,
          index: _checkpoints.length + 1,
          notes: 'Stationary Landmark Stop (${(stationarySeconds / 60).toStringAsFixed(0)} mins)',
        );
        _checkpoints.add(_activeCheckpoint!);
        debugPrint('Recorded Stop/Stationary state event at anchor');
      }
    } else {
      // Device moved >= 20m from anchor: resume active movement
      if (_isStationaryState) {
        _isStationaryState = false;
        if (_activeCheckpoint != null) {
          final idx = _checkpoints.indexOf(_activeCheckpoint!);
          if (idx != -1) {
            _checkpoints[idx] = _activeCheckpoint!.copyWith(
              departedAt: now.millisecondsSinceEpoch,
            );
          }
          _activeCheckpoint = null;
        }
        debugPrint('Movement resumed (>20m from anchor). Restored active streaming frequency.');
      }
      _lastStopAnchorPosition = currentPos;
      _stopAnchorTime = now;
    }
  }

  /// Stream live coordinate packet containing: userId, latitude, longitude, speed, heading, accuracy, and ISO-8601 timestamp
  void _streamTelemetryPacket(Position pos, DateTime now) {
    final packet = {
      'userId': _userId,
      'sessionId': _sessionId,
      'latitude': pos.latitude,
      'longitude': pos.longitude,
      'speed': pos.speed >= 0 ? pos.speed * 3.6 : 0.0,
      'heading': pos.heading,
      'accuracy': pos.accuracy,
      'timestamp': now.toUtc().toIso8601String(),
      'isStationary': _isStationaryState,
      'batteryLevel': _cachedBatteryLevel,
      'status': _isStationaryState ? 'STATIONARY' : 'MOVING',
    };

    // If stationary, throttle streaming to avoid unnecessary pings
    if (_isStationaryState) {
      final secondsSinceAnchor = now.difference(_stopAnchorTime!).inSeconds;
      if (secondsSinceAnchor % 60 != 0) {
        // Only stream once a minute during stationary periods
        return;
      }
    }

    // Attempt Socket.io streaming via location_ping event
    bool sent = false;
    if (_stompClient != null && _stompClient!.isConnected) {
      sent = _stompClient!.send('location_ping', packet);
    }

    // If streaming failed or offline, buffer coordinate packet locally
    if (!sent) {
      _offlineBuffer.addPoint(packet);
    }
  }

  Future<void> addCheckpoint({String? notes}) async {
    Position? pos = _currentPosition;
    if (pos == null) {
      try {
        pos = await Geolocator.getCurrentPosition();
      } catch (_) {}
    }
    if (pos == null) return;

    final now = DateTime.now().millisecondsSinceEpoch;
    final checkpoint = CheckpointDto(
      lat: pos.latitude,
      lng: pos.longitude,
      arrivedAt: now,
      departedAt: now,
      index: _checkpoints.length + 1,
      notes: notes?.trim().isNotEmpty == true ? notes!.trim() : 'Manual Landmark #${_checkpoints.length + 1}',
    );

    _checkpoints.add(checkpoint);
    notifyListeners();
    syncSession();
  }

  /// Batch-sync session route to /api/sessions/sync without coordinate loss
  Future<bool> syncSession() async {
    if (_sessionId == null || _sessionStartTime == null) return false;

    // First flush any offline buffer
    await _offlineBuffer.flushAndSync(_api, _sessionId!, _totalDistanceKm);

    try {
      final req = SessionSyncRequest(
        id: _sessionId!,
        startTime: _sessionStartTime!.millisecondsSinceEpoch,
        endTime: _state == TrackingState.idle ? DateTime.now().millisecondsSinceEpoch : null,
        distanceKm: double.parse(_totalDistanceKm.toStringAsFixed(2)),
        areaName: 'Field Operations & Dispatch',
        state: 'Active Duty',
        routePoints: _routePoints,
        checkpoints: _checkpoints,
      );

      final response = await _api.dio.post(
        '/sessions/sync',
        data: req.toJson(),
      ).catchError((_) async {
        return await _api.dio.post('/tracking/sessions/sync', data: req.toJson());
      });

      return response.statusCode == 200 || response.statusCode == 201;
    } catch (_) {
      return false;
    }
  }

  /// Stop tracking session, clean up notification and STOMP connection
  Future<void> stopTracking() async {
    _state = TrackingState.idle;
    _durationTimer?.cancel();
    _durationTimer = null;
    await _positionSubscription?.cancel();
    _positionSubscription = null;
    _livePingTimer?.cancel();
    _livePingTimer = null;
    _sessionSyncTimer?.cancel();
    _sessionSyncTimer = null;

    if (_activeCheckpoint != null) {
      _checkpoints.add(
        _activeCheckpoint!.copyWith(
          departedAt: DateTime.now().millisecondsSinceEpoch,
        ),
      );
      _activeCheckpoint = null;
    }

    _currentSpeedKmh = 0.0;
    _isStationaryState = false;

    // Notify HR dashboard session ended before disconnecting
    _stompClient?.send('session_end', {
      'sessionId': _sessionId,
      'userId': _userId,
      'distanceKm': _totalDistanceKm,
    });
    _stompClient?.disconnect();
    _stompClient = null;

    await _cancelForegroundNotification();
    await syncSession();

    notifyListeners();
  }
}
