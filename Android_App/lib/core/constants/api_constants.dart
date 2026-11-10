class ApiConstants {
  /// Production Backend API & WebSocket URLs (Self-Hosted Production Server)
  static const String baseUrl = 'https://fieldtracking.gramtarang.org/api';
  static const String wsUrl = 'wss://fieldtracking.gramtarang.org';

  /// Development Wi-Fi IP address & ports
  static const String devLocalWifiIp = '192.168.1.16';
  static const int apiPort = 3000;
  static const int webPort = 3001;

  /// Production fallback URLs (Dedicated Server)
  static const String productionBaseUrl = 'https://fieldtracking.gramtarang.org/api';
  static const String productionWsUrl = 'wss://fieldtracking.gramtarang.org';

  /// Default base URL for REST requests
  static String get defaultBaseUrl => baseUrl;

  /// Default WebSocket URL for real-time tracking
  static String get defaultWsUrl => wsUrl;
}
