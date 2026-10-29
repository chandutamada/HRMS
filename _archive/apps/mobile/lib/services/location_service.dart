import 'package:geolocator/geolocator.dart';

class LocationResult {
  final bool success;
  final Position? position;
  final String? errorMessage;

  LocationResult({
    required this.success,
    this.position,
    this.errorMessage,
  });
}

class LocationService {
  static Future<LocationResult> getCurrentLocation() async {
    bool serviceEnabled;
    LocationPermission permission;

    // 1. Check if location services are enabled on device
    serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      return LocationResult(
        success: false,
        errorMessage: 'Location services are disabled on your device. Please enable GPS in settings to check in.',
      );
    }

    // 2. Check and request location permissions
    permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
      if (permission == LocationPermission.denied) {
        return LocationResult(
          success: false,
          errorMessage: 'Location permissions are denied. Geofence attendance requires location access.',
        );
      }
    }

    if (permission == LocationPermission.deniedForever) {
      return LocationResult(
        success: false,
        errorMessage: 'Location permissions are permanently denied. Please grant permission in Android App Settings.',
      );
    }

    // 3. Acquire current event-based location with high accuracy
    try {
      Position position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.high,
          timeLimit: Duration(seconds: 12),
        ),
      );

      return LocationResult(
        success: true,
        position: position,
      );
    } catch (e) {
      return LocationResult(
        success: false,
        errorMessage: 'Failed to obtain GPS fix: ${e.toString()}',
      );
    }
  }
}
