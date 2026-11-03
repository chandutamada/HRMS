import 'package:flutter/foundation.dart';

class ApiConstants {
  /// Default Development API & WebSocket URLs (USB / ADB Localhost via reverse port 4000)
  static const String baseUrl = 'http://localhost:4000/api';
  static const String wsUrl = 'http://localhost:4000';

  /// Development Wi-Fi IP address & ports
  static const String devLocalWifiIp = '192.168.1.16';
  static const int apiPort = 4000;
  static const int webPort = 3000;

  /// Production fallback URLs (when deployed to cloud)
  static const String productionBaseUrl = 'https://hrms.superbeeaeronautics.com/api';
  static const String productionWsUrl = 'https://hrms.superbeeaeronautics.com';

  /// Default base URL for REST requests
  static String get defaultBaseUrl => baseUrl;

  /// Default WebSocket URL for real-time tracking
  static String get defaultWsUrl => wsUrl;
}
