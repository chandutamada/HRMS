import 'dart:async';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/constants/api_constants.dart';
import '../models/tracking_models.dart';
import 'api_service.dart';
import 'gps_kalman_filter.dart';
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

  static const MethodChannel _nativeChannel =
      MethodChannel('com.hrms.mobile/native_tracking');

  final ApiService _api = ApiService();
  final OfflineTrackingBuffer _offlineBuffer = OfflineTrackingBuffer();
  final GpsKalmanFilter _kalmanFilter = GpsKalmanFilter(processNoiseAcc: 3.0);
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

  // Kinematic anomaly & speed jump verification
  Position? _lastValidRawPosition;
  DateTime? _lastValidRawTime;

  // Multi-Trigger Sampling Engine State
  Position? _lastDispatchedPosition;
  DateTime? _lastDispatchedTime;
  double? _lastDispatchedHeading;

  // Stop / Stationary Detection State (25-meter radius for >= 3 minutes)
  Position? _lastStopAnchorPosition;
  DateTime? _stopAnchorTime;
  bool _isStationaryState = false;
  CheckpointDto? _activeCheckpoint;

  final bool _isWithinOfficeHours = true;
  final bool _isWithinGeofence = false;
  double? _distanceToOfficeMeters;
  String _workLocationType = 'OFF_SITE';
  double _cachedBatteryLevel = 85.0;

  final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();
  bool _notificationsInitialized = false;

  Timer? _officeGeofenceCheckTimer;
  Map<String, dynamic>? _monitoredOffice;
  bool _isOfficeGeofenceMonitoring = false;
  bool _isOfficeOutsideGeofence = false;

  final List<RoutePointDto> _routePoints = [];
  final List<CheckpointDto> _checkpoints = [];

  StreamSubscription<Position>? _positionSubscription;
  Timer? _sessionSyncTimer;

  // Getters
  TrackingState get state => _state;
  bool get isTracking => _state == TrackingState.tracking;
  bool get isPaused => _state == TrackingState.paused;
  bool get isActiveOrPaused =>
      _state == TrackingState.tracking || _state == TrackingState.paused;
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
  bool get isOfficeOutsideGeofence => _isOfficeOutsideGeofence;
  bool get isOfficeGeofenceMonitoring => _isOfficeGeofenceMonitoring;

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

  double get averageSpeedKmh {
    final hours = _activeDuration.inSeconds / 3600.0;
    if (hours <= 0.001 || _totalDistanceKm <= 0.001) return 0.0;
    return _totalDistanceKm / hours;
  }

  String get formattedDuration {
    final hours = _activeDuration.inHours.toString().padLeft(2, '0');
    final minutes = (_activeDuration.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (_activeDuration.inSeconds % 60).toString().padLeft(2, '0');
    return '$hours:$minutes:$seconds';
  }

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

  Future<void> _updateBatteryLevel() async {
    try {
      final level = await Battery().batteryLevel;
      _cachedBatteryLevel = level.toDouble();
    } catch (_) {}
  }

  /// 1. Native WakeLock Management (PARTIAL_WAKE_LOCK for background execution)
  Future<void> _acquireNativeWakeLock() async {
    try {
      if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
        await _nativeChannel.invokeMethod('acquireWakeLock');
        debugPrint('[TrackingService] Acquired native PARTIAL_WAKE_LOCK.');
      }
    } catch (e) {
      debugPrint('[TrackingService] Could not acquire native wake lock: $e');
    }
  }

  Future<void> _releaseNativeWakeLock() async {
    try {
      if (!kIsWeb && defaultTargetPlatform == TargetPlatform.android) {
        await _nativeChannel.invokeMethod('releaseWakeLock');
        debugPrint('[TrackingService] Released native PARTIAL_WAKE_LOCK.');
      }
    } catch (e) {
      debugPrint('[TrackingService] Could not release native wake lock: $e');
    }
  }

  /// Request permissions: Fine location, Background location, Activity Recognition, & Battery Exemption
  Future<bool> requestPermissionsAndBatteryExemption() async {
    // 1. Precise location permission
    LocationPermission locPerm = await Geolocator.checkPermission();
    if (locPerm == LocationPermission.denied) {
      locPerm = await Geolocator.requestPermission();
      if (locPerm == LocationPermission.denied) return false;
    }
    if (locPerm == LocationPermission.deniedForever) return false;

    // 2. Background location permission (ACCESS_BACKGROUND_LOCATION / Allow all the time)
    if (!kIsWeb &&
        (defaultTargetPlatform == TargetPlatform.android ||
            defaultTargetPlatform == TargetPlatform.iOS)) {
      final bgStatus = await Permission.locationAlways.status;
      if (!bgStatus.isGranted) {
        await Permission.locationAlways.request();
      }

      // 3. Activity Recognition permission (Motion API)
      final activityStatus = await Permission.activityRecognition.status;
      if (!activityStatus.isGranted) {
        await Permission.activityRecognition.request();
      }

      // 4. Native Activity Recognition fallback check
      try {
        if (defaultTargetPlatform == TargetPlatform.android) {
          await _nativeChannel.invokeMethod('requestActivityRecognition');
        }
      } catch (_) {}

      // 5. Battery Optimization Exemption ("Do Not Optimize")
      final batteryStatus = await Permission.ignoreBatteryOptimizations.status;
      if (!batteryStatus.isGranted) {
        await Permission.ignoreBatteryOptimizations.request();
      }
    }

    return true;
  }

  Future<void> _initForegroundNotification() async {
    if (_notificationsInitialized || kIsWeb) return;
    try {
      const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosInit = DarwinInitializationSettings();
      const initSettings =
          InitializationSettings(android: androidInit, iOS: iosInit);
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
        channelDescription:
            'Maintains continuous GPS telemetry and road path tracking',
        importance: Importance.low,
        priority: Priority.low,
        ongoing: true,
        autoCancel: false,
        showWhen: true,
      );
      const notificationDetails = NotificationDetails(android: androidDetails);
      await _notificationsPlugin.show(
        888,
        'HRMS Live Tracking Active',
        'Continuous high-accuracy location tracking active in background',
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

  /// Start live location engine, foreground service, and motion-adaptive triggers
  Future<bool> startTracking({
    String workType = 'FIELD',
    String employmentType = 'FIELD',
    bool forceOutOfGeofence = false,
  }) async {
    final type = employmentType.toUpperCase();
    if (type == 'OFFICE' &&
        !forceOutOfGeofence &&
        workType != 'OFFICE_OUT_OF_GEOFENCE') {
      debugPrint(
          '[TrackingService] Office employee within geofence. Tracking bypassed.');
      return false;
    }

    _workLocationType = workType;

    bool hasPermission = await requestPermissionsAndBatteryExemption();
    if (!hasPermission) return false;

    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) return false;

    await _offlineBuffer.init();
    await _showForegroundTrackingNotification();

    // Acquire persistent native partial CPU WakeLock
    await _acquireNativeWakeLock();

    // Mark shift tracking active in persistent storage for BootReceiver auto-recovery
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('is_shift_tracking_active', true);
    } catch (_) {}

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

    // Reset filters and triggers
    _kalmanFilter.reset();
    _lastValidRawPosition = null;
    _lastValidRawTime = null;
    _lastDispatchedPosition = null;
    _lastDispatchedTime = null;
    _lastDispatchedHeading = null;
    _lastStopAnchorPosition = null;
    _stopAnchorTime = null;
    _isStationaryState = false;
    _activeCheckpoint = null;

    // 1. Initialize WebSocket STOMP Client
    _initStompBroker();

    // 2. Start duration timer
    await _updateBatteryLevel();
    _startDurationTimer();

    // 3. Acquire initial position
    try {
      final initialPos = await Geolocator.getCurrentPosition(
        locationSettings:
            const LocationSettings(accuracy: LocationAccuracy.bestForNavigation),
      );
      _onNewPosition(initialPos);
    } catch (_) {}

    // 4. Stream continuous GPS positions using Android foreground location service
    LocationSettings locationSettings;
    if (defaultTargetPlatform == TargetPlatform.android) {
      locationSettings = AndroidSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 0, // 0m filter so our multi-trigger engine handles distance, time, and heading curves
        forceLocationManager: false,
        intervalDuration: const Duration(seconds: 2),
        foregroundNotificationConfig: const ForegroundNotificationConfig(
          notificationTitle: "HRMS Live Tracking Active",
          notificationText:
              "High-accuracy background GPS tracking is active",
          enableWakeLock: true,
          notificationIcon:
              AndroidResource(name: 'ic_launcher', defType: 'mipmap'),
        ),
      );
    } else {
      locationSettings = const LocationSettings(
        accuracy: LocationAccuracy.bestForNavigation,
        distanceFilter: 0,
      );
    }

    _positionSubscription = Geolocator.getPositionStream(
      locationSettings: locationSettings,
    ).listen((pos) {
      _onNewPosition(pos);
    });

    // 5. Periodic session sync every 60 seconds
    _sessionSyncTimer = Timer.periodic(const Duration(seconds: 60), (_) async {
      if (isActiveOrPaused) {
        await syncSession();
      }
    });

    notifyListeners();
    return true;
  }

  /// Evaluates incoming GPS coordinate through Ghost/Noise filtering,
  /// 2D Kalman smoothing, motion detection, and the 3-Way Sampling Engine.
  void _onNewPosition(Position pos) {
    if (_state != TrackingState.tracking) return;

    final now = DateTime.now();

    // -------------------------------------------------------------
    // 1. ACCURACY & SANITY FILTERING
    // -------------------------------------------------------------
    // Drop invalid zero coordinates
    if (pos.latitude == 0.0 && pos.longitude == 0.0) return;
    if (pos.latitude.isNaN || pos.longitude.isNaN) return;

    // Immediately drop any coordinate where accuracy > 35 meters
    if (pos.accuracy > 35.0) {
      debugPrint('[TrackingService] Dropped low accuracy ping: ${pos.accuracy}m > 35m');
      return;
    }

    // -------------------------------------------------------------
    // 2. SPEED JUMP & KINEMATIC ANOMALY CHECK
    // -------------------------------------------------------------
    if (_lastValidRawPosition != null && _lastValidRawTime != null) {
      final distMeters = calculateDistanceMeters(
        _lastValidRawPosition!.latitude,
        _lastValidRawPosition!.longitude,
        pos.latitude,
        pos.longitude,
      );
      final elapsedSec =
          max(now.difference(_lastValidRawTime!).inMilliseconds / 1000.0, 0.1);
      final calculatedSpeedKmh = (distMeters / elapsedSec) * 3.6;

      // Discard physically impossible speeds (> 130 km/h vehicle or > 15 km/h walking)
      final maxFeasibleSpeed =
          (_workLocationType == 'WALKING') ? 15.0 : 130.0;
      if (calculatedSpeedKmh > maxFeasibleSpeed) {
        debugPrint(
            '[TrackingService] Discarding speed jump anomaly: ${calculatedSpeedKmh.toStringAsFixed(1)} km/h > $maxFeasibleSpeed km/h');
        return;
      }
    }
    _lastValidRawPosition = pos;
    _lastValidRawTime = now;

    // -------------------------------------------------------------
    // 3. 2D KALMAN FILTER / SENSOR SMOOTHING
    // -------------------------------------------------------------
    final smoothed = _kalmanFilter.filter(
      rawLat: pos.latitude,
      rawLng: pos.longitude,
      accuracyMeters: pos.accuracy,
      timestampMs: now.millisecondsSinceEpoch,
    );
    final smoothedLat = smoothed[0];
    final smoothedLng = smoothed[1];

    final speedMs = pos.speed >= 0 ? pos.speed : 0.0;
    final speedKmh = speedMs * 3.6;
    _currentSpeedKmh = speedKmh;
    if (speedKmh > _maxSpeedKmh) {
      _maxSpeedKmh = speedKmh;
    }

    _currentPosition = pos;
    _currentAccuracy = pos.accuracy;
    _currentAltitude = pos.altitude;
    _currentHeading = pos.heading;

    // -------------------------------------------------------------
    // 4. MOTION DETECTION & STATIONARY STATE (25m radius for >= 3 mins)
    // -------------------------------------------------------------
    _evaluateStationaryState(smoothedLat, smoothedLng, speedKmh, now);

    // If user is stationary, completely pause coordinate transmission to save battery and prevent drift
    if (_isStationaryState) {
      notifyListeners();
      return;
    }

    // -------------------------------------------------------------
    // 5. MULTI-TRIGGER SAMPLING ENGINE (While In Motion)
    // -------------------------------------------------------------
    bool shouldDispatch = false;

    if (_lastDispatchedPosition == null || _lastDispatchedTime == null) {
      shouldDispatch = true; // First coordinate
    } else {
      final displacementMeters = calculateDistanceMeters(
        _lastDispatchedPosition!.latitude,
        _lastDispatchedPosition!.longitude,
        smoothedLat,
        smoothedLng,
      );
      final elapsedSec =
          now.difference(_lastDispatchedTime!).inMilliseconds / 1000.0;

      // Calculate heading change (accounting for 0/360 wraparound)
      double headingDelta = 0.0;
      if (_lastDispatchedHeading != null && pos.heading >= 0) {
        headingDelta = (pos.heading - _lastDispatchedHeading!).abs();
        if (headingDelta > 180.0) {
          headingDelta = 360.0 - headingDelta;
        }
      }

      // Trigger 3: Heading/Bearing Change (>= 15 deg at speeds > 5 km/h for curves/turns)
      final isHeadingCurve = (headingDelta >= 15.0 && speedKmh > 5.0);

      // Trigger 2: Distance displacement >= 10 meters
      final isDisplacementMet = (displacementMeters >= 10.0);

      // Trigger 1: Max interval of 10 seconds while in motion
      final isTimeIntervalMet = (elapsedSec >= 10.0);

      if (isHeadingCurve) {
        shouldDispatch = true;
        debugPrint(
            '[TrackingEngine] Trigger 3 (Curve Turn): deltaHeading=${headingDelta.toStringAsFixed(1)}°, speed=${speedKmh.toStringAsFixed(1)}km/h');
      } else if (isDisplacementMet) {
        shouldDispatch = true;
      } else if (isTimeIntervalMet && displacementMeters >= 5.0) {
        shouldDispatch = true;
      }
    }

    if (!shouldDispatch) {
      // Discard redundant jitter point
      return;
    }

    // -------------------------------------------------------------
    // 6. RECORD AND DISPATCH VALID POINT
    // -------------------------------------------------------------
    final newPoint = RoutePointDto(
      lat: smoothedLat,
      lng: smoothedLng,
      alt: pos.altitude,
      speed: speedKmh,
      accuracy: pos.accuracy,
      heading: pos.heading,
      ts: now.millisecondsSinceEpoch,
    );

    if (_routePoints.isNotEmpty) {
      final prev = _routePoints.last;
      final distMeters = calculateDistanceMeters(
        prev.lat,
        prev.lng,
        smoothedLat,
        smoothedLng,
      );
      if (distMeters >= 3.0) {
        _totalDistanceKm += (distMeters / 1000.0);
      }
    }

    _routePoints.add(newPoint);

    // Update dispatch markers
    _lastDispatchedPosition = Position(
      longitude: smoothedLng,
      latitude: smoothedLat,
      timestamp: now,
      accuracy: pos.accuracy,
      altitude: pos.altitude,
      altitudeAccuracy: pos.altitudeAccuracy,
      heading: pos.heading,
      headingAccuracy: pos.headingAccuracy,
      speed: pos.speed,
      speedAccuracy: pos.speedAccuracy,
    );
    _lastDispatchedTime = now;
    _lastDispatchedHeading = pos.heading >= 0 ? pos.heading : null;

    // Send telemetry to server
    _dispatchTelemetry(smoothedLat, smoothedLng, pos, speedKmh, now);

    notifyListeners();
  }

  /// Evaluates stationary stops: within 25m radius for >= 3 minutes (180s)
  void _evaluateStationaryState(
      double lat, double lng, double speedKmh, DateTime now) {
    if (_lastStopAnchorPosition == null) {
      _lastStopAnchorPosition = Position(
        longitude: lng,
        latitude: lat,
        timestamp: now,
        accuracy: 5.0,
        altitude: 0.0,
        altitudeAccuracy: 0.0,
        heading: 0.0,
        headingAccuracy: 0.0,
        speed: 0.0,
        speedAccuracy: 0.0,
      );
      _stopAnchorTime = now;
      return;
    }

    final distFromAnchor = calculateDistanceMeters(
      _lastStopAnchorPosition!.latitude,
      _lastStopAnchorPosition!.longitude,
      lat,
      lng,
    );

    if (distFromAnchor < 25.0) {
      final stationarySeconds = now.difference(_stopAnchorTime!).inSeconds;
      if (stationarySeconds >= 180 && !_isStationaryState) {
        _isStationaryState = true;
        _activeCheckpoint = CheckpointDto(
          lat: _lastStopAnchorPosition!.latitude,
          lng: _lastStopAnchorPosition!.longitude,
          arrivedAt: _stopAnchorTime!.millisecondsSinceEpoch,
          index: _checkpoints.length + 1,
          notes:
              'Stationary Stop (${(stationarySeconds / 60).toStringAsFixed(0)} mins dwell)',
        );
        _checkpoints.add(_activeCheckpoint!);
        debugPrint(
            '[TrackingEngine] Entered STATIONARY Stop state (<25m for ${stationarySeconds}s). GPS transmission paused.');
      }
    } else {
      // Displaced >= 25 meters: user is moving
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
        debugPrint(
            '[TrackingEngine] Movement resumed (>25m from anchor). Resumed active GPS transmission.');
      }
      _lastStopAnchorPosition = Position(
        longitude: lng,
        latitude: lat,
        timestamp: now,
        accuracy: 5.0,
        altitude: 0.0,
        altitudeAccuracy: 0.0,
        heading: 0.0,
        headingAccuracy: 0.0,
        speed: 0.0,
        speedAccuracy: 0.0,
      );
      _stopAnchorTime = now;
    }
  }

  /// Dispatch coordinate packet over STOMP WebSocket or buffer in offline storage
  void _dispatchTelemetry(
    double lat,
    double lng,
    Position rawPos,
    double speedKmh,
    DateTime now,
  ) {
    final packet = {
      'userId': _userId,
      'sessionId': _sessionId,
      'latitude': lat,
      'longitude': lng,
      'speed': speedKmh,
      'heading': rawPos.heading >= 0 ? rawPos.heading : 0.0,
      'accuracy': rawPos.accuracy,
      'altitude': rawPos.altitude,
      'timestamp': now.toUtc().toIso8601String(),
      'isStationary': _isStationaryState,
      'batteryLevel': _cachedBatteryLevel,
      'status': _isStationaryState ? 'STATIONARY' : 'MOVING',
    };

    bool sent = false;
    if (_stompClient != null && _stompClient!.isConnected) {
      sent = _stompClient!.send('location_ping', packet);
    }

    if (!sent) {
      _offlineBuffer.addPoint(packet);
    }

    // Also send async REST ping
    _sendFieldPing(lat, lng, speedKmh, rawPos.heading, rawPos.accuracy, rawPos.altitude);
  }

  Future<void> _sendFieldPing(
    double lat,
    double lng,
    double speedKmh,
    double heading,
    double accuracy,
    double altitude,
  ) async {
    try {
      await _updateBatteryLevel();
      final body = {
        'latitude': lat,
        'longitude': lng,
        'speed': speedKmh,
        'accuracy': accuracy,
        'altitude': altitude,
        'heading': heading >= 0 ? heading : 0.0,
        'battery': _cachedBatteryLevel,
        'batteryLevel': _cachedBatteryLevel,
        'timestamp': DateTime.now().toUtc().toIso8601String(),
      };
      await _api.dio.post('/tracking/ping', data: body);
    } catch (_) {}
  }

  Future<void> _initStompBroker() async {
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
          if (_sessionId != null) {
            _offlineBuffer.flushAndSync(_api, _sessionId!, _totalDistanceKm);
          }
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
    _releaseNativeWakeLock();
    notifyListeners();
  }

  void resumeTracking() {
    if (_state != TrackingState.paused) return;
    _state = TrackingState.tracking;
    _lastResumeTime = DateTime.now();
    _acquireNativeWakeLock();
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
      notes: notes?.trim().isNotEmpty == true
          ? notes!.trim()
          : 'Manual Landmark #${_checkpoints.length + 1}',
    );

    _checkpoints.add(checkpoint);
    notifyListeners();
    syncSession();
  }

  Future<bool> syncSession() async {
    if (_sessionId == null || _sessionStartTime == null) return false;

    await _offlineBuffer.flushAndSync(_api, _sessionId!, _totalDistanceKm);

    try {
      final req = SessionSyncRequest(
        id: _sessionId!,
        startTime: _sessionStartTime!.millisecondsSinceEpoch,
        endTime: _state == TrackingState.idle
            ? DateTime.now().millisecondsSinceEpoch
            : null,
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

  /// Stop tracking session, release WakeLock, and clear boot recovery flag
  Future<void> stopTracking() async {
    _state = TrackingState.idle;
    _durationTimer?.cancel();
    _durationTimer = null;
    await _positionSubscription?.cancel();
    _positionSubscription = null;
    _sessionSyncTimer?.cancel();
    _sessionSyncTimer = null;

    // Release native CPU WakeLock
    await _releaseNativeWakeLock();

    // Clear persistent active shift flag
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('is_shift_tracking_active', false);
    } catch (_) {}

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

  /// Office geofence monitor
  void startOfficeGeofenceMonitor(Map<String, dynamic>? office) {
    if (office == null) return;
    _monitoredOffice = office;
    _isOfficeGeofenceMonitoring = true;
    _isOfficeOutsideGeofence = false;

    _officeGeofenceCheckTimer?.cancel();
    _officeGeofenceCheckTimer =
        Timer.periodic(const Duration(seconds: 15), (_) async {
      await _evaluateOfficeGeofenceBoundary();
    });
    _evaluateOfficeGeofenceBoundary();
  }

  Future<void> _evaluateOfficeGeofenceBoundary() async {
    if (!_isOfficeGeofenceMonitoring || _monitoredOffice == null) return;
    try {
      final offLat = (_monitoredOffice!['latitude'] as num?)?.toDouble();
      final offLng = (_monitoredOffice!['longitude'] as num?)?.toDouble();
      final radius = (_monitoredOffice!['radius'] as num?)?.toDouble() ?? 50.0;
      if (offLat == null || offLng == null) return;

      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );

      final distance = Geolocator.distanceBetween(
        pos.latitude,
        pos.longitude,
        offLat,
        offLng,
      );

      final threshold = radius + 10.0;

      if (distance > threshold) {
        if (!_isOfficeOutsideGeofence && _state != TrackingState.tracking) {
          _isOfficeOutsideGeofence = true;
          await startTracking(
            workType: 'OFFICE_OUT_OF_GEOFENCE',
            employmentType: 'FIELD',
            forceOutOfGeofence: true,
          );
          notifyListeners();
        }
      } else {
        if (_isOfficeOutsideGeofence) {
          _isOfficeOutsideGeofence = false;
          notifyListeners();
        }
      }
    } catch (e) {
      debugPrint('[TrackingService] Office geofence check error: $e');
    }
  }

  void stopOfficeGeofenceMonitor() {
    _isOfficeGeofenceMonitoring = false;
    _isOfficeOutsideGeofence = false;
    _monitoredOffice = null;
    _officeGeofenceCheckTimer?.cancel();
    _officeGeofenceCheckTimer = null;
  }
}
