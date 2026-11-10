import 'dart:math';

/// High-accuracy 2D Kalman Filter for GPS coordinate smoothing.
/// Filters satellite multipath jitter, noise, and micro-drifts before points are persisted.
class GpsKalmanFilter {
  // Meters per degree latitude approximately
  static const double _metersPerDegreeLat = 111320.0;

  // Process noise acceleration (meters/sec^2)
  // Higher = more responsive to real maneuvers, lower = smoother trajectory
  final double _processNoiseAcc;

  double? _lat;
  double? _lng;
  double _varianceLat = -1.0;
  double _varianceLng = -1.0;
  int? _lastTimestampMs;

  GpsKalmanFilter({double processNoiseAcc = 3.0})
      : _processNoiseAcc = processNoiseAcc;

  /// Returns true if the filter has been initialized with at least one position
  bool get isInitialized => _lat != null && _lng != null && _varianceLat > 0;

  /// Resets filter state (e.g. at the start of a new trip or after a long disconnect)
  void reset() {
    _lat = null;
    _lng = null;
    _varianceLat = -1.0;
    _varianceLng = -1.0;
    _lastTimestampMs = null;
  }

  /// Process an incoming raw GPS coordinate and returns the smoothed [lat, lng].
  /// [accuracyMeters] is the 1-sigma horizontal accuracy reported by the GPS chip.
  List<double> filter({
    required double rawLat,
    required double rawLng,
    required double accuracyMeters,
    required int timestampMs,
  }) {
    // Clamp minimum measurement accuracy to 1.0 meter to avoid division by zero or over-confidence
    final safeAccuracy = max(accuracyMeters, 1.0);

    if (!isInitialized || _lastTimestampMs == null) {
      // First coordinate initialization
      _lat = rawLat;
      _lng = rawLng;
      _lastTimestampMs = timestampMs;

      final safeLatRad = rawLat * (pi / 180.0);
      final metersPerDegreeLng = _metersPerDegreeLat * cos(safeLatRad).abs();
      final degAccuracyLat = safeAccuracy / _metersPerDegreeLat;
      final degAccuracyLng = safeAccuracy / max(metersPerDegreeLng, 1000.0);

      _varianceLat = degAccuracyLat * degAccuracyLat;
      _varianceLng = degAccuracyLng * degAccuracyLng;
      return [_lat!, _lng!];
    }

    final dtSec = max((timestampMs - _lastTimestampMs!) / 1000.0, 0.001);
    _lastTimestampMs = timestampMs;

    // If gap between points is large (> 60 seconds), re-anchor filter
    if (dtSec > 60.0) {
      _lat = rawLat;
      _lng = rawLng;
      final safeLatRad = rawLat * (pi / 180.0);
      final metersPerDegreeLng = _metersPerDegreeLat * cos(safeLatRad).abs();
      final degAccuracyLat = safeAccuracy / _metersPerDegreeLat;
      final degAccuracyLng = safeAccuracy / max(metersPerDegreeLng, 1000.0);
      _varianceLat = degAccuracyLat * degAccuracyLat;
      _varianceLng = degAccuracyLng * degAccuracyLng;
      return [_lat!, _lng!];
    }

    // 1. Prediction Step:
    // Process noise Q represents unexpected physical movement over dt
    final safeLatRad = _lat! * (pi / 180.0);
    final metersPerDegreeLng = _metersPerDegreeLat * cos(safeLatRad).abs();

    final qMeters = (_processNoiseAcc * dtSec * dtSec) / 2.0;
    final qLatDeg = qMeters / _metersPerDegreeLat;
    final qLngDeg = qMeters / max(metersPerDegreeLng, 1000.0);

    _varianceLat += qLatDeg * qLatDeg;
    _varianceLng += qLngDeg * qLngDeg;

    // 2. Measurement Variance R:
    final rLatDeg = safeAccuracy / _metersPerDegreeLat;
    final rLngDeg = safeAccuracy / max(metersPerDegreeLng, 1000.0);
    final rVarianceLat = rLatDeg * rLatDeg;
    final rVarianceLng = rLngDeg * rLngDeg;

    // 3. Kalman Gain K:
    final kLat = _varianceLat / (_varianceLat + rVarianceLat);
    final kLng = _varianceLng / (_varianceLng + rVarianceLng);

    // 4. Update State:
    _lat = _lat! + kLat * (rawLat - _lat!);
    _lng = _lng! + kLng * (rawLng - _lng!);

    // 5. Update Covariance:
    _varianceLat = (1.0 - kLat) * _varianceLat;
    _varianceLng = (1.0 - kLng) * _varianceLng;

    return [_lat!, _lng!];
  }
}
