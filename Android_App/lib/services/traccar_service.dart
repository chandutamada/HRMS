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
  double _lastSentHeading = 0.0;
  bool _isRunning = false;

  bool get isRunning => _isRunning;

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
      distanceFilter: 5, // 5m precision captures every curve, turn, and bend in the road
      intervalDuration: const Duration(seconds: 3),
      forceLocationManager: false,
      foregroundNotificationConfig: const ForegroundNotificationConfig(
        notificationTitle: "Field Duty Active",
        notificationText: "Road-accurate live GPS tracking is running in the background",
        enableWakeLock: true,
      ),
    );

    // 3. Listen to Continuous Position Stream with Heading Curve Detection
    _positionSub = Geolocator.getPositionStream(
      locationSettings: androidSettings,
    ).listen((position) {
      _handlePositionUpdate(position);
    });

    // 4. Fallback 30s heartbeat ping when stationary
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (_lastSentPosition != null) {
        _dispatchOsmAndPing(_lastSentPosition!);
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

  /// Evaluates road curve (heading change >= 15 deg) or 5m displacement
  void _handlePositionUpdate(Position position) {
    if (position.accuracy > 30.0) return; // Filter out wild GPS noise

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

      // Trigger if moved >= 5m OR turned curve >= 15 degrees while moving
      if (distance >= 5.0 || (normalizedHeadingDiff >= 15.0 && position.speed > 1.0)) {
        shouldSend = true;
      }
    }

    if (shouldSend) {
      _lastSentPosition = position;
      _lastSentHeading = position.heading;
      _dispatchOsmAndPing(position);
    }
  }

  /// Dispatches HTTP OsmAnd ping to Traccar port 5055
  Future<void> _dispatchOsmAndPing(Position pos) async {
    if (_employeeCode == null) return;

    try {
      int batteryLevel = 100;
      try {
        batteryLevel = await _battery.batteryLevel;
      } catch (_) {}

      final double speedKnots = (pos.speed >= 0 ? pos.speed : 0.0) * 1.94384; // m/s to knots

      final queryParams = {
        'id': _employeeCode,
        'lat': pos.latitude.toStringAsFixed(7),
        'lon': pos.longitude.toStringAsFixed(7),
        'timestamp': (DateTime.now().millisecondsSinceEpoch ~/ 1000).toString(),
        'speed': speedKnots.toStringAsFixed(2),
        'bearing': pos.heading.toStringAsFixed(1),
        'altitude': pos.altitude.toStringAsFixed(1),
        'batt': batteryLevel.toString(),
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
    _isRunning = false;
  }
}
