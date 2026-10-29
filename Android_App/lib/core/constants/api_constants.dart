import 'package:flutter/foundation.dart';

class ApiConstants {
  /// Production Backend API & WebSocket URLs
  static const String baseUrl = 'https://api-hr.superbeeaeronautics.com/api';
  static const String wsUrl = 'https://api-hr.superbeeaeronautics.com';

  /// Development fallback Wi-Fi IP address & ports
  static const String devLocalWifiIp = '172.16.200.156';
  static const int apiPort = 4000;
  static const int webPort = 3000;

  /// Default base URL for REST requests (Production default)
  static String get defaultBaseUrl => baseUrl;

  /// Default WebSocket URL for real-time tracking (Production default)
  static String get defaultWsUrl => wsUrl;
}
