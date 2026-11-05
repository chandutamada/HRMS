class ApiConstants {
  /// Production Backend API & WebSocket URLs (Live Cloud on Render)
  static const String baseUrl = 'https://hrms-f9cq.onrender.com/api';
  static const String wsUrl = 'https://hrms-f9cq.onrender.com';

  /// Development Wi-Fi IP address & ports
  static const String devLocalWifiIp = '192.168.1.16';
  static const int apiPort = 4000;
  static const int webPort = 3000;

  /// Production fallback URLs (Live Cloud on Render)
  static const String productionBaseUrl = 'https://hrms-f9cq.onrender.com/api';
  static const String productionWsUrl = 'https://hrms-f9cq.onrender.com';

  /// Default base URL for REST requests
  static String get defaultBaseUrl => baseUrl;

  /// Default WebSocket URL for real-time tracking
  static String get defaultWsUrl => wsUrl;
}
