import 'dart:async';
import 'package:dio/dio.dart';
import 'package:battery_plus/battery_plus.dart';
import 'package:geolocator/geolocator.dart';
import 'package:permission_handler/permission_handler.dart';

class TraccarService {
  static final TraccarService _instance = TraccarService._internal();
  factory TraccarService() => _instance;
  TraccarService._internal();

  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 8),
    receiveTimeout: const Duration(seconds: 8),
  ));

  final Battery _battery = Battery();
  StreamSubscription<Position>? _positionSub;
  Timer? _heartbeatTimer;

  String? _employeeCode;
  String _traccarUrl = 'http://10.0.2.2:5055'; // Port 5055 OsmAnd protocol (or configured traccar host)
  Position? _lastSentPosition;
  Position? _anchorPosition;
  double _lastSentHeading = 0.0;
  DateTime? _lastSentTime;
  bool _isRunning = false;
  bool _isStationary = false;

  bool get isRunning => _isRunning;
  bool get isStationary => _isStationary;

  /// Start Traccar tracking on Punch-In
  Future<void> startTracking({
    required String employeeCode,
    String? traccarBaseUrl,
  }) async {
    if (_isRunning) return;
    _employeeCode = employeeCode;
    if (traccarBaseUrl != null && traccarBaseUrl.isNotEmpty) {
      _traccarUrl = traccarBaseUrl;
    }

    // 1. Request Battery Optimization Exemption so Android OS never kills background tracking
    await _requestBatteryOptimizationExemption();

    // 2. Configure Android Foreground Service with WakeLock
    final androidSettings = AndroidSettings(
      accuracy: LocationAccuracy.bestForNavigation,
      distanceFilter: 5, // 5m precision captures turns while moving
      intervalDuration: const Duration(seconds: 3),
      forceLocationManager: false,
      foregroundNotificationConfig: const ForegroundNotificationConfig(
        notificationTitle: "Field Duty Active • Live GPS",
        notificationText: "Continuous precision GPS tracking is active in background",
        enableWakeLock: true,
      ),
    );

    // 3. Listen to Continuous Position Stream with Heading Curve Detection
    _positionSub = Geolocator.getPositionStream(
      locationSettings: androidSettings,
    ).listen((position) {
      _handlePositionUpdate(position);
    });

    // 4. Dedicated 45s stationary heartbeat ping
    // When stationary, this guarantees the web portal continuously receives
    // "STATIONARY AT SITE" live status without stopping or disconnecting.
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 45), (_) {
      if (_anchorPosition != null) {
        _dispatchOsmAndPing(_anchorPosition!, forceStationary: true);
      } else if (_lastSentPosition != null) {
        _dispatchOsmAndPing(_lastSentPosition!, forceStationary: true);
      }
    });

    _isRunning = true;
  }

  /// Request Android Ignore Battery Optimizations
  Future<void> _requestBatteryOptimizationExemption() async {
    try {
      if (await Permission.ignoreBatteryOptimizations.isDenied) {
        await Permission.ignoreBatteryOptimizations.request();
      }
    } catch (_) {}
  }

  /// Filters GPS noise, multipath jitter and anchors stationary coordinates
  void _handlePositionUpdate(Position position) {
    // 1. Accuracy gatekeeper: Discard fixes with poor horizontal accuracy > 25 meters
    if (position.accuracy > 25.0) return;

    final now = DateTime.now();

    // 2. Stationary vs. Moving filter:
    // If speed < 0.5 m/s (~1.8 km/h), the employee is stationary (traffic halt, client site, meeting)
    if (position.speed < 0.5) {
      _isStationary = true;
      if (_anchorPosition == null) {
        _anchorPosition = position;
        _lastSentPosition = position;
        _lastSentTime = now;
        _dispatchOsmAndPing(position, forceStationary: true);
      }
      // Coordinate wandering while stationary is absorbed by freezing to _anchorPosition
      return;
    }

    // 3. Employee is Moving (speed >= 0.5 m/s)
    _isStationary = false;
    _anchorPosition = null; // Unfreeze anchor coordinate

    bool shouldSend = false;

    if (_lastSentPosition == null) {
      shouldSend = true;
    } else {
      final double distance = Geolocator.distanceBetween(
        _lastSentPosition!.latitude,
        _lastSentPosition!.longitude,
        position.latitude,
        position.longitude,
      );

      // Heading difference to capture road curves and roundabouts
      final double headingDiff = (position.heading - _lastSentHeading).abs();
      final double normalizedHeadingDiff = headingDiff > 180 ? 360 - headingDiff : headingDiff;

      final secondsSinceLast = _lastSentTime != null
          ? now.difference(_lastSentTime!).inSeconds
          : 999;

      // Moving transmission triggers:
      // - Moved >= 15-20 meters
      // - Road curvature change >= 15 deg while in motion
      // - Or at least once every 12 seconds while in transit
      if (distance >= 15.0 ||
          (normalizedHeadingDiff >= 15.0 && position.speed >= 1.0) ||
          secondsSinceLast >= 12) {
        shouldSend = true;
      }
    }

    if (shouldSend) {
      _lastSentPosition = position;
      _lastSentHeading = position.heading;
      _lastSentTime = now;
      _dispatchOsmAndPing(position, forceStationary: false);
    }
  }

  /// Dispatches HTTP OsmAnd ping to Traccar port 5055
  Future<void> _dispatchOsmAndPing(Position pos, {bool forceStationary = false}) async {
    if (_employeeCode == null) return;

    try {
      int batteryLevel = 100;
      try {
        batteryLevel = await _battery.batteryLevel;
      } catch (_) {}

      final double speedKnots = forceStationary || pos.speed < 0.5
          ? 0.0
          : (pos.speed * 1.94384); // m/s to knots

      final queryParams = {
        'id': _employeeCode,
        'lat': pos.latitude.toStringAsFixed(7),
        'lon': pos.longitude.toStringAsFixed(7),
        'timestamp': (DateTime.now().millisecondsSinceEpoch ~/ 1000).toString(),
        'speed': speedKnots.toStringAsFixed(2),
        'bearing': (forceStationary ? _lastSentHeading : pos.heading).toStringAsFixed(1),
        'altitude': pos.altitude.toStringAsFixed(1),
        'accuracy': pos.accuracy.toStringAsFixed(1),
        'batt': batteryLevel.toString(),
        'status': forceStationary ? 'STATIONARY' : 'MOVING',
      };

      await _dio.get(_traccarUrl, queryParameters: queryParams);
    } catch (_) {
      // Offline/Network fail: fail gracefully
    }
  }

  /// Stop tracking on Punch-Out
  void stopTracking() {
    _positionSub?.cancel();
    _positionSub = null;
    _heartbeatTimer?.cancel();
    _heartbeatTimer = null;
    _lastSentPosition = null;
    _anchorPosition = null;
    _isRunning = false;
    _isStationary = false;
  }
}
